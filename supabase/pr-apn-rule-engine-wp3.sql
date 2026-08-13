-- =============================================================================
-- ALLBEE — APN RULE ENGINE — WORK PACKAGE 3
-- Authoritative wallet / ledger, reversals, cancellations and withdrawals.
--
-- Model (non-redesign): the existing derived wallets (apn_withdrawal_wallets,
-- apn_referral_wallets) and the withdrawal engine remain untouched as the
-- compatibility surface. WP3 adds the authoritative layer the foundation (WP1)
-- designed but never wired:
--
--   apn_commission_ledger  (append-only; extended with adjustment/reversal/
--                           recovery types + eligible_from + original_event_id)
--         |-- wired by triggers from the WORKING sources:
--         |     * apn_revenue_collections  -> partner / district / state events
--         |     * apn_referral_earnings    -> referral events
--         `-- read by apn_consolidated_wallets (NEW, derived, immutable)
--
-- ELIGIBILITY: the established ALLBEE rule (app: "paid on the 5th of the
-- following month") is implemented ONCE as apn_commission_eligibility_date():
-- revenue on the 31st -> 5th of next month; revenue on the 1st -> next cycle's
-- 5th (the already-approved next-cycle rule). No day-of-month exceptions.
-- Eligibility is DERIVED from received dates; source commission_status rows are
-- never rewritten by this engine.
--
-- WALLET IMMUTABILITY: apn_consolidated_wallets is derived-only. No grants for
-- INSERT/UPDATE/DELETE to any app role; RLS is select-only; a guard trigger
-- rejects every direct UPDATE/DELETE unless the engine's refresh() explicitly
-- opened the path with set_config('apn.consolidated.refresh','on',true).
-- UPDATE wallet_balance = ... is therefore impossible from the frontend.
--
-- REVERSAL: apn_commission_reverse_project() books per-type reversal ledger
-- events referencing the originals (never edits/deletes originals), voids the
-- operational referral earnings rows (existing engine pattern), marks the
-- collection 'Reversed' + project 'Cancelled', creates finance reversal rows
-- ONLY when the project already has finance posted (no orphans), and splits
-- already-paid amounts into 'recovery' events against the partner's paid pool.
-- Future eligible earnings offset the recovery debt automatically in the
-- wallet (recovery_recovered/remaining are derived, not stored balances).
-- A finance-locked month blocks the reversal before anything is booked
-- (except for the existing approved Super Admin behavior of fin_lock_guard).
-- apn_commission_cancel_project() is the canonical cancellation path — it is
-- NOT apn_delete_commission_project() (deletion erases operational rows and is
-- only allowed when no accounting history exists; reversal preserves history).
--
-- WITHDRAWAL: 'failed' state added to the existing state machine (requested →
-- under_review → approved → processing → paid | failed, plus the existing
-- rejected/cancelled/expired). A failed payment releases the reserved amount:
-- 'failed' is not in the reserved set, so the wallet refresh restores the
-- unpaid eligible amount automatically. Duplicate/concurrent protection
-- already row-locks the wallet row (apn_request_withdrawal) — unmodified.
--
-- SAFETY: ledger recording never blocks production inserts — the recorder
-- wrapper catches validation/rate-cap failures and logs them to apn_rule_audit.
--
-- Idempotent and safe to re-run. Applies on top of: schema.sql,
-- apn-commission-engine-v4.sql, apn-referral-engine-pr2.sql,
-- apn-withdrawal-settlement-engine-pr3.sql, pr-apn-rule-engine-foundation.sql,
-- pr-apn-rule-engine-wp2.sql.
-- =============================================================================

begin;

-- ── 01 Eligibility rule (the established 5th-of-following-month) ─────────────
create or replace function public.apn_commission_eligibility_date(p_received_date date)
returns date
language sql immutable as $$
  select (date_trunc('month', p_received_date) + interval '1 month 4 days')::date;
$$;

revoke all on function public.apn_commission_eligibility_date(date) from public, anon;
grant execute on function public.apn_commission_eligibility_date(date) to authenticated;

-- ── 02 Ledger schema extensions (idempotent) ─────────────────────────────────
alter table public.apn_commission_ledger drop constraint if exists apn_commission_ledger_commission_type_check;
alter table public.apn_commission_ledger add constraint apn_commission_ledger_commission_type_check
  check (commission_type in ('partner','district','state','referral','adjustment','reversal','recovery'));

alter table public.apn_commission_ledger add column if not exists eligible_from date;
alter table public.apn_commission_ledger add column if not exists original_event_id uuid
  references public.apn_commission_ledger(id) on delete restrict;

-- ── 03 Operational status extensions (idempotent) ────────────────────────────
alter table public.apn_revenue_collections drop constraint if exists apn_revenue_collections_status_check;
alter table public.apn_revenue_collections add constraint apn_revenue_collections_status_check
  check (commission_status in ('Pending','Approved','Payable','Paid','Reversed'));

alter table public.apn_withdrawal_requests drop constraint if exists apn_withdrawal_requests_status_check;
alter table public.apn_withdrawal_requests add constraint apn_withdrawal_requests_status_check
  check (status in ('pending','under_review','approved','rejected','processing','paid','failed','cancelled','expired'));

-- Columns consumed by apn_mark_withdrawal_failed (failure payload + actor trail).
alter table public.apn_withdrawal_requests add column if not exists data jsonb;
alter table public.apn_withdrawal_requests add column if not exists cancelled_by text;

-- ── 04 Rate helper + safe ledger recorder ────────────────────────────────────
create or replace function public.apn_commission_rate_for(p_commission_type text)
returns numeric
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select r.percent
  from public.apn_rule_sets rs
  join public.apn_commission_rules r on r.rule_set_id = rs.id
  where rs.status = 'active'
    and r.commission_type = p_commission_type
    and r.active
    and (rs.effective_from is null or rs.effective_from::date <= current_date)
    and (rs.effective_to is null or rs.effective_to::date >= current_date)
  order by rs.effective_from desc nulls last, r.tier_min asc
  limit 1;
$$;

revoke all on function public.apn_commission_rate_for(text) from public, anon;

create or replace function public.apn_ledger_record_safe(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz,
  p_snapshot jsonb,
  p_eligible_from date default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.apn_ledger_entry(
    p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
    p_base_amount, p_percent, p_amount, p_event_at, p_snapshot);
  v_id := (v_result->>'id')::uuid;
  if v_id is not null and p_eligible_from is not null then
    update public.apn_commission_ledger set eligible_from = p_eligible_from
    where id = v_id and eligible_from is null;
  end if;
  return v_result;
exception when others then
  begin
    perform public.apn_rule_audit('ledger record deferred', 'apn_commission_ledger', p_idempotency_key,
      jsonb_build_object('error', SQLERRM, 'sourceId', p_source_id, 'commissionType', p_commission_type,
        'amount', p_amount, 'partnerId', p_partner_id));
  exception when others then null;
  end;
  return jsonb_build_object('id', null, 'duplicate', false, 'deferred', true, 'error', SQLERRM);
end;
$$;

revoke all on function public.apn_ledger_record_safe(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb, date) from public, anon, authenticated;

-- ── 05 Consolidated wallet (derived-only, immutable surface) ─────────────────
create table if not exists public.apn_consolidated_wallets (
  partner_id text primary key references public.apn_users(id) on delete restrict,
  earned numeric(14,2) not null default 0,
  pending numeric(14,2) not null default 0,
  eligible numeric(14,2) not null default 0,
  total_balance numeric(14,2) not null default 0,
  reserved numeric(14,2) not null default 0,
  withdrawable numeric(14,2) not null default 0,
  withdrawn numeric(14,2) not null default 0,
  reversed numeric(14,2) not null default 0,
  recovery_outstanding numeric(14,2) not null default 0,
  recovery_recovered numeric(14,2) not null default 0,
  recovery_remaining numeric(14,2) not null default 0,
  commission_breakdown jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.apn_consolidated_wallets enable row level security;
revoke all on public.apn_consolidated_wallets from public, anon, authenticated;
grant select on public.apn_consolidated_wallets to authenticated;

drop policy if exists apn_consolidated_wallets_read on public.apn_consolidated_wallets;
create policy apn_consolidated_wallets_read on public.apn_consolidated_wallets
  for select to authenticated
  using (public.apn_withdrawal_can_manage() or partner_id = auth.uid()::text);

create or replace function public.apn_consolidated_wallet_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if coalesce(current_setting('apn.consolidated.refresh', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Consolidated wallet balances are derived from ledger events and cannot be edited directly.' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists apn_consolidated_wallet_mutation_trg on public.apn_consolidated_wallets;
create trigger apn_consolidated_wallet_mutation_trg
  before update or delete on public.apn_consolidated_wallets
  for each row execute function public.apn_consolidated_wallet_guard();

create or replace function public.apn_consolidated_wallet_refresh(p_partner_id text)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_earned numeric := 0;
  v_pending numeric := 0;
  v_gross_eligible numeric := 0;
  v_reversed numeric := 0;
  v_recovery_total numeric := 0;
  v_withdrawn numeric := 0;
  v_reserved numeric := 0;
  v_net_eligible numeric := 0;
  v_recovered numeric := 0;
  v_remaining numeric := 0;
  v_eligible numeric := 0;
  v_breakdown jsonb;
begin
  if p_partner_id is null or trim(p_partner_id) = '' then return; end if;

  select coalesce(sum(amount) filter (where amount > 0), 0)
    into v_earned
  from public.apn_commission_ledger
  where partner_id = p_partner_id
    and commission_type in ('partner','referral','district','state','adjustment');

  select coalesce(sum(amount) filter (where amount > 0 and coalesce(eligible_from, event_at::date) > current_date), 0)
    into v_pending
  from public.apn_commission_ledger
  where partner_id = p_partner_id
    and commission_type in ('partner','referral','district','state','adjustment');

  select coalesce(sum(amount) filter (where amount > 0 and coalesce(eligible_from, event_at::date) <= current_date), 0)
    into v_gross_eligible
  from public.apn_commission_ledger
  where partner_id = p_partner_id
    and commission_type in ('partner','referral','district','state','adjustment');

  select coalesce(sum(-amount) filter (where commission_type = 'reversal'), 0)
    into v_reversed
  from public.apn_commission_ledger
  where partner_id = p_partner_id and amount < 0;

  select coalesce(sum(-amount) filter (where commission_type = 'recovery'), 0)
    into v_recovery_total
  from public.apn_commission_ledger
  where partner_id = p_partner_id and amount < 0;

  -- Actually paid out: settled withdrawal requests + paid referral withdrawals +
  -- legacy collections/commissions already marked Paid (never rewritten by the
  -- reversal/recovery engine — those add separate negative ledger events).
  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0)
    into v_withdrawn
  from public.apn_withdrawal_requests where partner_id = p_partner_id;

  v_withdrawn := v_withdrawn
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status = 'paid'), 0)
    + coalesce((select sum(commission_generated) from public.apn_revenue_collections where partner_id = p_partner_id and commission_status = 'Paid'), 0)
    + coalesce((select sum(case when coalesce(c.data->>'amount','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (c.data->>'amount')::numeric else 0 end)
                from public.apn_commissions c
                where c.data->>'partnerId' = p_partner_id and coalesce(c.data->>'kind','partner') <> 'district'
                  and coalesce(c.data->>'status','Pending') = 'Paid'), 0);

  -- In-flight reservations: open withdrawal requests + legacy referral requests.
  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing')), 0)
    into v_reserved
  from public.apn_withdrawal_requests where partner_id = p_partner_id;

  v_reserved := v_reserved
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0);

  -- Net eligible after unpaid reversals; future eligible earnings offset the
  -- recovery debt automatically (derived — no stored balance, no hidden
  -- deductions: recovery_recovered/remaining show exactly where the debt is).
  v_net_eligible := greatest(0, v_gross_eligible - v_reversed);
  v_eligible := v_net_eligible;
  v_recovered := least(v_recovery_total, v_net_eligible);
  v_remaining := greatest(0, v_recovery_total - v_recovered);

  v_breakdown := jsonb_build_object(
    'partner', coalesce((select sum(amount) from public.apn_commission_ledger where partner_id = p_partner_id and commission_type = 'partner' and amount > 0), 0),
    'referral', coalesce((select sum(amount) from public.apn_commission_ledger where partner_id = p_partner_id and commission_type = 'referral' and amount > 0), 0),
    'district', coalesce((select sum(amount) from public.apn_commission_ledger where partner_id = p_partner_id and commission_type = 'district' and amount > 0), 0),
    'state', coalesce((select sum(amount) from public.apn_commission_ledger where partner_id = p_partner_id and commission_type = 'state' and amount > 0), 0),
    'adjustment', coalesce((select sum(amount) from public.apn_commission_ledger where partner_id = p_partner_id and commission_type = 'adjustment' and amount > 0), 0),
    'reversal', v_reversed,
    'recovery', v_recovery_total
  );

  perform set_config('apn.consolidated.refresh', 'on', true);
  insert into public.apn_consolidated_wallets
    (partner_id, earned, pending, eligible, total_balance, reserved, withdrawable, withdrawn,
     reversed, recovery_outstanding, recovery_recovered, recovery_remaining, commission_breakdown, updated_at)
  values
    (p_partner_id, v_earned, v_pending, v_eligible, v_net_eligible, v_reserved,
     greatest(0, v_net_eligible - v_withdrawn - v_reserved - v_remaining), v_withdrawn,
     v_reversed, v_recovery_total, v_recovered, v_remaining, v_breakdown, now())
  on conflict (partner_id) do update set
    earned = excluded.earned, pending = excluded.pending, eligible = excluded.eligible,
    total_balance = excluded.total_balance, reserved = excluded.reserved,
    withdrawable = excluded.withdrawable, withdrawn = excluded.withdrawn,
    reversed = excluded.reversed, recovery_outstanding = excluded.recovery_outstanding,
    recovery_recovered = excluded.recovery_recovered, recovery_remaining = excluded.recovery_remaining,
    commission_breakdown = excluded.commission_breakdown, updated_at = now();
end;
$$;

create or replace function public.apn_consolidated_wallet_refresh_from_request()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.partner_id is not null then perform public.apn_consolidated_wallet_refresh(old.partner_id); end if;
    return old;
  end if;
  if new.partner_id is not null then perform public.apn_consolidated_wallet_refresh(new.partner_id); end if;
  return new;
end;
$$;

drop trigger if exists apn_consolidated_wallet_request_trg on public.apn_withdrawal_requests;
create trigger apn_consolidated_wallet_request_trg
  after insert or update or delete on public.apn_withdrawal_requests
  for each row execute function public.apn_consolidated_wallet_refresh_from_request();

create or replace function public.apn_consolidated_wallet(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_row public.apn_consolidated_wallets%rowtype;
begin
  if p_partner_id is null or trim(p_partner_id) = '' then
    raise exception 'Partner id is required.' using errcode = 'invalid_parameter_value';
  end if;
  if auth.uid()::text <> p_partner_id and not public.apn_withdrawal_can_manage() then
    raise exception 'Wallet access denied.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_consolidated_wallet_refresh(p_partner_id);
  select * into v_row from public.apn_consolidated_wallets where partner_id = p_partner_id;
  if not found then
    return jsonb_build_object('partnerId', p_partner_id, 'earned', 0, 'pending', 0, 'eligible', 0,
      'totalBalance', 0, 'reserved', 0, 'withdrawable', 0, 'withdrawn', 0, 'reversed', 0,
      'recoveryOutstanding', 0, 'recoveryRecovered', 0, 'recoveryRemaining', 0,
      'commissionBreakdown', '{}'::jsonb, 'updatedAt', null);
  end if;
  return jsonb_build_object('partnerId', v_row.partner_id, 'earned', v_row.earned, 'pending', v_row.pending,
    'eligible', v_row.eligible, 'totalBalance', v_row.total_balance, 'reserved', v_row.reserved,
    'withdrawable', v_row.withdrawable, 'withdrawn', v_row.withdrawn, 'reversed', v_row.reversed,
    'recoveryOutstanding', v_row.recovery_outstanding, 'recoveryRecovered', v_row.recovery_recovered,
    'recoveryRemaining', v_row.recovery_remaining, 'commissionBreakdown', v_row.commission_breakdown,
    'updatedAt', v_row.updated_at);
end;
$$;

revoke all on function public.apn_consolidated_wallet_refresh(text) from public, anon;
revoke all on function public.apn_consolidated_wallet(text) from public, anon;
grant execute on function public.apn_consolidated_wallet(text) to authenticated;

-- ── 06 Ledger wiring triggers ────────────────────────────────────────────────
create or replace function public.apn_ledger_collection_after_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_rate numeric;
  v_dhead text;
  v_shead text;
  v_drate numeric;
  v_srate numeric;
  v_damt numeric;
  v_samt numeric;
  v_eligible date;
  v_event timestamptz;
begin
  if tg_op = 'DELETE' then
    if old.partner_id is not null then perform public.apn_consolidated_wallet_refresh(old.partner_id); end if;
    return old;
  end if;
  if new.partner_id is null or coalesce(new.received_amount, 0) <= 0 then
    return new;
  end if;
  v_eligible := public.apn_commission_eligibility_date(new.received_date);
  v_event := coalesce(new.created_at, new.received_date::timestamptz, now());

  if coalesce(new.commission_generated, 0) > 0 then
    select commission_rate into v_rate from public.apn_commission_projects where id = new.project_id;
    perform public.apn_ledger_record_safe(
      'col:' || new.id || ':partner', new.id, 'revenue_collection', new.partner_id, 'partner',
      new.received_amount, coalesce(v_rate, 0), new.commission_generated, v_event,
      jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text, 'source', 'wp3'),
      v_eligible);

    select district_head_id, state_head_id into v_dhead, v_shead
    from public.apn_hierarchy_assignments
    where partner_id = new.partner_id and status = 'active'
    limit 1;

    if v_dhead is not null then
      v_drate := public.apn_commission_rate_for('district');
      if v_drate is not null then
        v_damt := round(new.received_amount * v_drate / 100, 2);
        if v_damt > 0 then
          perform public.apn_ledger_record_safe(
            'col:' || new.id || ':district', new.id, 'revenue_collection', v_dhead, 'district',
            new.received_amount, v_drate, v_damt, v_event,
            jsonb_build_object('projectId', new.project_id, 'partnerId', new.partner_id, 'source', 'wp3'),
            v_eligible);
        end if;
      end if;
    end if;

    if v_shead is not null then
      v_srate := public.apn_commission_rate_for('state');
      if v_srate is not null then
        v_samt := round(new.received_amount * v_srate / 100, 2);
        if v_samt > 0 then
          perform public.apn_ledger_record_safe(
            'col:' || new.id || ':state', new.id, 'revenue_collection', v_shead, 'state',
            new.received_amount, v_srate, v_samt, v_event,
            jsonb_build_object('projectId', new.project_id, 'partnerId', new.partner_id, 'source', 'wp3'),
            v_eligible);
        end if;
      end if;
    end if;
  end if;

  perform public.apn_consolidated_wallet_refresh(new.partner_id);
  if v_dhead is not null then perform public.apn_consolidated_wallet_refresh(v_dhead); end if;
  if v_shead is not null then perform public.apn_consolidated_wallet_refresh(v_shead); end if;
  return new;
end;
$$;

drop trigger if exists apn_ledger_collection_trg on public.apn_revenue_collections;
create trigger apn_ledger_collection_trg
  after insert or update or delete on public.apn_revenue_collections
  for each row execute function public.apn_ledger_collection_after_change();

create or replace function public.apn_ledger_referral_after_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_eligible date;
  v_event timestamptz;
begin
  if tg_op = 'DELETE' then
    if old.referrer_id is not null then perform public.apn_consolidated_wallet_refresh(old.referrer_id); end if;
    return old;
  end if;
  if new.status = 'void' or coalesce(new.referral_amount, 0) <= 0 then
    return new;
  end if;
  v_eligible := public.apn_commission_eligibility_date(new.collection_at::date);
  v_event := coalesce(new.created_at, new.collection_at, now());
  perform public.apn_ledger_record_safe(
    'earn:' || new.id::text, new.id::text, 'referral', new.referrer_id, 'referral',
    new.revenue_amount, new.referral_percent, new.referral_amount, v_event,
    jsonb_build_object('collectionId', new.source_collection_id, 'relationshipId', new.relationship_id,
      'selfEarning', coalesce((new.snapshot->>'selfEarning')::boolean, false), 'source', 'wp3'),
    v_eligible);
  perform public.apn_consolidated_wallet_refresh(new.referrer_id);
  return new;
end;
$$;

drop trigger if exists apn_ledger_referral_trg on public.apn_referral_earnings;
create trigger apn_ledger_referral_trg
  after insert or update or delete on public.apn_referral_earnings
  for each row execute function public.apn_ledger_referral_after_change();

-- ── 06b Finance expense: self-describing payload (additive redefinition) ───────
-- Byte-faithful copy of the foundation function plus one added payload key
-- (apnProjectId) so reversal rows and the app UI can address the originating
-- project. Same deterministic id + map + audit: fully idempotent re-run.
create or replace function public.apn_ensure_finance_expense(p_ledger_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_ledger public.apn_commission_ledger%rowtype;
  v_expense_type text;
  v_deterministic text;
  v_txn_id text;
  v_payload jsonb;
  v_mapped text;
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may post ledger expenses.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_ledger from public.apn_commission_ledger where id = p_ledger_id;
  if not found then
    raise exception 'Ledger entry not found.' using errcode = 'no_data_found';
  end if;
  select deterministic_id into v_mapped from public.apn_finance_expense_map where ledger_id = p_ledger_id;
  if v_mapped is not null then
    return jsonb_build_object('deterministicId', v_mapped, 'duplicate', true);
  end if;
  v_expense_type := case when v_ledger.source_type = 'reversal' then 'reversal' else 'commission' end;
  v_deterministic := case
    when v_ledger.source_type = 'reversal' then 'apn-expense-rev:' || coalesce(v_ledger.reversed_by::text, v_ledger.id::text)
    else 'apn-expense-ledger:' || v_ledger.id::text
  end;
  v_txn_id := v_deterministic;
  if not exists (select 1 from public.transactions where id = v_txn_id) then
    v_payload := jsonb_build_object(
      'id', v_txn_id,
      'kind', 'expense',
      'date', (v_ledger.event_at::date)::text,
      'category', 'APN ' || v_ledger.commission_type || ' commission',
      'scope', 'partner',
      'amount', v_ledger.amount,
      'notes', 'APN ' || v_ledger.commission_type || ' commission on ' || v_ledger.source_type || ' event ' || v_ledger.source_id,
      'source', 'apn-commission',
      'apnCommissionExpense', true,
      'apnPartnerId', v_ledger.partner_id,
      'apnLedgerId', v_ledger.id::text,
      'apnProjectId', coalesce((v_ledger.snapshot->>'projectId')::text, ''),
      'apnCommissionType', v_ledger.commission_type,
      'createdAt', (extract(epoch from now()) * 1000)::bigint::text
    );
    perform set_config('row_security', 'off', true);
    insert into public.transactions (id, data, updated_at)
    values (v_txn_id, v_payload, now())
    on conflict (id) do nothing;
  end if;
  insert into public.apn_finance_expense_map (ledger_id, deterministic_id, finance_transaction_id, expense_type, status, posted_at)
  values (p_ledger_id, v_deterministic, v_txn_id, v_expense_type, 'posted', now());
  perform public.apn_rule_audit('posted ledger expense', 'apn_finance_expense_map', p_ledger_id::text,
    jsonb_build_object('deterministicId', v_deterministic, 'expenseType', v_expense_type));
  return jsonb_build_object('deterministicId', v_deterministic, 'transactionId', v_txn_id, 'duplicate', false);
end;
$$;
revoke all on function public.apn_ensure_finance_expense(uuid) from public, anon;
grant execute on function public.apn_ensure_finance_expense(uuid) to authenticated;

-- ── 07 Reversal engine ───────────────────────────────────────────────────────
create or replace function public.apn_commission_reverse_project(p_project_id text, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_project public.apn_commission_projects%rowtype;
  v_collection record;
  v_event record;
  v_earning record;
  v_ledger_ref uuid;
  v_rev_json jsonb;
  v_rec_json jsonb;
  v_rev_ledger_id uuid;
  v_rec_ledger_id uuid;
  v_reversal_count integer := 0;
  v_recovery_count integer := 0;
  v_partners text[] := array[]::text[];
  v_partner text;
  v_collection_ids text[] := array[]::text[];
  v_rev_ledgers uuid[] := array[]::uuid[];
  v_paid_pool numeric := 0;
  v_rec numeric;
  v_has_finance boolean := false;
  v_actor text := auth.uid()::text;
  v_timeline_id text;
begin
  if not (public.is_admin() or public.can_finance()) then
    raise exception 'Only APN administrators or Finance users can reverse commissions.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A cancellation reason is required to reverse commissions.' using errcode = 'check_violation';
  end if;

  select * into v_project from public.apn_commission_projects where id = p_project_id for update;
  if not found then
    raise exception 'Commission project not found.' using errcode = 'no_data_found';
  end if;
  if v_project.status = 'Cancelled' then
    raise exception 'This project is already cancelled.' using errcode = 'duplicate_object';
  end if;

  v_has_finance := exists (
    select 1 from public.transactions t
    where coalesce(t.data->>'apnCommissionExpense', 'false') = 'true'
      and (
        t.data->>'apnProjectId' = p_project_id
        or t.data->>'apnLedgerId' in (
          select l.id::text from public.apn_commission_ledger l
          where l.source_id in (select c.id from public.apn_revenue_collections c where c.project_id = p_project_id)
        )
      )
  );

  -- Mirror fin_lock_guard semantics: a locked period blocks the reversal before
  -- anything is booked (Super Admin still bypasses, as in the existing guard).
  if v_has_finance and public.is_period_locked(current_date) and not public.is_superadmin() then
    raise exception 'This month is locked. Ask a Super Admin to unlock % before reversing this project.', to_char(current_date, 'YYYY-MM')
      using errcode = 'check_violation';
  end if;

  for v_collection in
    select c.id from public.apn_revenue_collections c
    where c.project_id = p_project_id
    order by c.received_date asc, c.created_at asc
  loop
    for v_event in
      select l.* from public.apn_commission_ledger l
      where l.source_id = v_collection.id and l.source_type = 'revenue_collection' and l.amount > 0
      order by l.event_at asc
    loop
      if v_event.reversed_by is not null then continue; end if;

      select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0)
        + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = v_event.partner_id and status = 'paid'), 0)
        + coalesce((select sum(commission_generated) from public.apn_revenue_collections where partner_id = v_event.partner_id and commission_status = 'Paid'), 0)
        into v_paid_pool
      from public.apn_withdrawal_requests where partner_id = v_event.partner_id;
      -- FIFO consumption: recovery already booked for this partner+project in
      -- this reversal eats the pool, so a partner's paid money is never
      -- recovered more than once across the project's events.
      v_paid_pool := greatest(0, v_paid_pool - coalesce(
        (select sum(-amount) from public.apn_commission_ledger
         where partner_id = v_event.partner_id and commission_type = 'recovery'
           and snapshot->>'projectId' = p_project_id), 0));

      v_rev_json := public.apn_ledger_entry(
        'rev:led:' || v_event.id::text, v_event.id::text, 'reversal', v_event.partner_id, 'reversal',
        v_event.base_amount, v_event.percent, -v_event.amount, now(),
        jsonb_build_object('originalId', v_event.id, 'originalType', v_event.commission_type,
          'projectId', p_project_id, 'collectionId', v_collection.id, 'reason', p_reason,
          'initiatedBy', v_actor, 'source', 'wp3'));
      v_rev_ledger_id := nullif(v_rev_json->>'id', '')::uuid;

      if v_rev_ledger_id is not null then
        update public.apn_commission_ledger set original_event_id = v_event.id, eligible_from = null
        where id = v_rev_ledger_id;
        update public.apn_commission_ledger set reversed_by = v_rev_ledger_id where id = v_event.id;
        insert into public.apn_reversals (original_ledger_id, reversal_ledger_id, amount, reason, initiated_by, status, applied_at)
        values (v_event.id, v_rev_ledger_id, v_event.amount, p_reason, nullif(v_actor, ''), 'applied', now());

        if v_paid_pool > 0 then
          v_rec := least(v_event.amount, v_paid_pool);
          v_rec_json := public.apn_ledger_entry(
            'rec:led:' || v_event.id::text, v_event.id::text, 'reversal', v_event.partner_id, 'recovery',
            v_event.base_amount, v_event.percent, -v_rec, now(),
            jsonb_build_object('originalId', v_event.id, 'originalType', v_event.commission_type,
              'projectId', p_project_id, 'collectionId', v_collection.id, 'reason', p_reason,
              'initiatedBy', v_actor, 'source', 'wp3', 'recoveryOfReversed', v_rev_ledger_id::text));
          v_rec_ledger_id := nullif(v_rec_json->>'id', '')::uuid;
          if v_rec_ledger_id is not null then
            update public.apn_commission_ledger set original_event_id = v_event.id where id = v_rec_ledger_id;
            v_recovery_count := v_recovery_count + 1;
          end if;
        end if;

        v_reversal_count := v_reversal_count + 1;
        v_rev_ledgers := array_append(v_rev_ledgers, v_rev_ledger_id);
        if not v_event.partner_id = any(v_partners) then
          v_partners := array_append(v_partners, v_event.partner_id);
        end if;
      end if;
    end loop;

    for v_earning in
      select e.id, e.referrer_id, e.referral_amount, e.revenue_amount, e.referral_percent, e.created_at
      from public.apn_referral_earnings e
      where e.source_collection_id = v_collection.id and e.status <> 'void'
      order by e.created_at asc
    loop
      select l.id into v_ledger_ref from public.apn_commission_ledger l
      where l.source_id = v_earning.id::text and l.source_type = 'referral' and l.amount > 0 and l.reversed_by is null
      order by l.created_at asc limit 1;

      if v_ledger_ref is not null then
        select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0)
          + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = v_earning.referrer_id and status = 'paid'), 0)
          + coalesce((select sum(commission_generated) from public.apn_revenue_collections where partner_id = v_earning.referrer_id and commission_status = 'Paid'), 0)
          into v_paid_pool
        from public.apn_withdrawal_requests where partner_id = v_earning.referrer_id;
        v_paid_pool := greatest(0, v_paid_pool - coalesce(
          (select sum(-amount) from public.apn_commission_ledger
           where partner_id = v_earning.referrer_id and commission_type = 'recovery'
             and snapshot->>'projectId' = p_project_id), 0));

        v_rev_json := public.apn_ledger_entry(
          'rev:led:' || v_ledger_ref::text, v_ledger_ref::text, 'reversal', v_earning.referrer_id, 'reversal',
          v_earning.revenue_amount, v_earning.referral_percent, -v_earning.referral_amount, now(),
          jsonb_build_object('originalId', v_ledger_ref, 'originalType', 'referral',
            'projectId', p_project_id, 'collectionId', v_collection.id, 'reason', p_reason,
            'initiatedBy', v_actor, 'source', 'wp3'));
        v_rev_ledger_id := nullif(v_rev_json->>'id', '')::uuid;

        if v_rev_ledger_id is not null then
          update public.apn_commission_ledger set original_event_id = v_ledger_ref, eligible_from = null
          where id = v_rev_ledger_id;
          update public.apn_commission_ledger set reversed_by = v_rev_ledger_id where id = v_ledger_ref;
          insert into public.apn_reversals (original_ledger_id, reversal_ledger_id, amount, reason, initiated_by, status, applied_at)
          values (v_ledger_ref, v_rev_ledger_id, v_earning.referral_amount, p_reason, nullif(v_actor, ''), 'applied', now());

          if v_paid_pool > 0 then
            v_rec := least(v_earning.referral_amount, v_paid_pool);
            v_rec_json := public.apn_ledger_entry(
              'rec:led:' || v_ledger_ref::text, v_ledger_ref::text, 'reversal', v_earning.referrer_id, 'recovery',
              v_earning.revenue_amount, v_earning.referral_percent, -v_rec, now(),
              jsonb_build_object('originalId', v_ledger_ref, 'originalType', 'referral',
                'projectId', p_project_id, 'collectionId', v_collection.id, 'reason', p_reason,
                'initiatedBy', v_actor, 'source', 'wp3', 'recoveryOfReversed', v_rev_ledger_id::text));
            v_rec_ledger_id := nullif(v_rec_json->>'id', '')::uuid;
            if v_rec_ledger_id is not null then
              update public.apn_commission_ledger set original_event_id = v_ledger_ref where id = v_rec_ledger_id;
              v_recovery_count := v_recovery_count + 1;
            end if;
          end if;

          v_reversal_count := v_reversal_count + 1;
          v_rev_ledgers := array_append(v_rev_ledgers, v_rev_ledger_id);
          if not v_earning.referrer_id = any(v_partners) then
            v_partners := array_append(v_partners, v_earning.referrer_id);
          end if;
        end if;
      end if;

      update public.apn_referral_earnings
      set status = 'void',
          snapshot = snapshot || jsonb_build_object('reversedAt', now(), 'reversedBy', v_actor, 'reversalReason', p_reason)
      where id = v_earning.id;
    end loop;

    update public.apn_revenue_collections
    set commission_status = 'Reversed',
        data = data || jsonb_build_object('commissionStatus', 'Reversed', 'reversedAt', now(), 'reversedBy', v_actor, 'reversalReason', p_reason),
        updated_at = now()
    where id = v_collection.id;

    v_collection_ids := array_append(v_collection_ids, v_collection.id);
  end loop;

  if v_reversal_count = 0 then
    raise exception 'Nothing to reverse: this project has no earned commission ledger events.' using errcode = 'no_data_found';
  end if;

  update public.apn_commission_projects
  set status = 'Cancelled',
      data = data || jsonb_build_object('cancelledAt', now(), 'cancelledBy', v_actor, 'cancellationReason', p_reason),
      updated_at = now()
  where id = p_project_id;

  if v_has_finance then
    foreach v_rev_ledger_id in array v_rev_ledgers loop
      if v_rev_ledger_id is not null then
        perform public.apn_ensure_finance_expense(v_rev_ledger_id);
      end if;
    end loop;
  end if;

  foreach v_partner in array v_partners loop
    perform public.apn_consolidated_wallet_refresh(v_partner);
  end loop;

  foreach v_partner in array v_partners loop
    v_timeline_id := 'apn-timeline:commission-reversed:' || gen_random_uuid()::text;
    insert into public.apn_timeline (id, data, updated_at)
    values (v_timeline_id, jsonb_build_object(
      'id', v_timeline_id, 'ts', (extract(epoch from now()) * 1000)::bigint,
      'user', coalesce(nullif(v_actor, ''), 'System'), 'userId', v_actor,
      'action', 'commission-reversed', 'module', 'APN', 'entity', 'Project',
      'entityId', p_project_id, 'message', 'Project cancelled — commission reversed.',
      'metadata', jsonb_build_object('projectId', p_project_id, 'reason', p_reason,
        'partnerId', v_partner, 'source', 'wp3')), now());
  end loop;

  return jsonb_build_object(
    'projectId', p_project_id, 'status', 'Cancelled', 'reason', p_reason,
    'collectionsReversed', coalesce(array_length(v_collection_ids, 1), 0),
    'reversals', v_reversal_count, 'recoveryEvents', v_recovery_count,
    'partnersAffected', coalesce(array_length(v_partners, 1), 0),
    'financeReversals', case when v_has_finance then coalesce(array_length(v_rev_ledgers, 1), 0) else 0 end);
end;
$$;

create or replace function public.apn_commission_cancel_project(p_project_id text, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  -- Canonical cancellation path: reversal preserves accounting history.
  -- Deletion (apn_delete_commission_project) remains restricted to projects
  -- with no financial history and is never used for cancellation.
  return public.apn_commission_reverse_project(p_project_id, p_reason);
end;
$$;

create or replace function public.apn_reversal_history(p_partner_id text)
returns table (
  reversal_id uuid,
  project_id text,
  original_amount numeric,
  reversed_amount numeric,
  reason text,
  initiated_by text,
  reversed_at timestamptz,
  original_commission_type text,
  original_commission_amount numeric,
  resulting_wallet numeric,
  recovery_outstanding numeric,
  recovery_recovered numeric,
  recovery_remaining numeric
)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_wallet public.apn_consolidated_wallets%rowtype;
begin
  if p_partner_id is null or trim(p_partner_id) = '' then
    raise exception 'Partner id is required.' using errcode = 'invalid_parameter_value';
  end if;
  if auth.uid()::text <> p_partner_id and not public.apn_withdrawal_can_manage() then
    raise exception 'Reversal history access denied.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_consolidated_wallet_refresh(p_partner_id);
  select * into v_wallet from public.apn_consolidated_wallets where partner_id = p_partner_id;

  return query
  select
    r.id as reversal_id,
    (l2.snapshot->>'projectId')::text as project_id,
    r.amount as original_amount,
    -l2.amount as reversed_amount,
    r.reason,
    coalesce(r.initiated_by, 'System') as initiated_by,
    l2.event_at as reversed_at,
    coalesce(l2.snapshot->>'originalType', 'partner') as original_commission_type,
    r.amount as original_commission_amount,
    coalesce(v_wallet.total_balance, 0) as resulting_wallet,
    coalesce(v_wallet.recovery_outstanding, 0) as recovery_outstanding,
    coalesce(v_wallet.recovery_recovered, 0) as recovery_recovered,
    coalesce(v_wallet.recovery_remaining, 0) as recovery_remaining
  from public.apn_reversals r
  join public.apn_commission_ledger l2 on l2.id = r.reversal_ledger_id
  where r.original_ledger_id in (
    select l.id from public.apn_commission_ledger l where l.partner_id = p_partner_id and l.amount > 0
  )
  order by l2.event_at desc;
end;
$$;

revoke all on function public.apn_commission_reverse_project(text, text) from public, anon;
revoke all on function public.apn_commission_cancel_project(text, text) from public, anon;
revoke all on function public.apn_reversal_history(text) from public, anon;
grant execute on function public.apn_commission_reverse_project(text, text) to authenticated;
grant execute on function public.apn_commission_cancel_project(text, text) to authenticated;
grant execute on function public.apn_reversal_history(text) to authenticated;

-- ── 08 Withdrawal: 'failed' state + restore of the unpaid eligible amount ─────
create or replace function public.apn_mark_withdrawal_failed(p_request_id uuid, p_reason text default 'Payment failed')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_old public.apn_withdrawal_requests%rowtype;
  v_partner_id text;
  v_wallet_type text;
  v_amount numeric;
  v_actor text := auth.uid()::text;
begin
  if not public.apn_withdrawal_can_manage() then
    raise exception 'Only APN administrators or Finance users may mark withdrawals failed.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_old from public.apn_withdrawal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Withdrawal request not found.' using errcode = 'no_data_found';
  end if;
  if v_old.status <> 'processing' then
    raise exception 'Only a processing withdrawal can be marked failed (current status: %).', v_old.status using errcode = 'check_violation';
  end if;
  v_partner_id := v_old.partner_id;
  v_wallet_type := v_old.wallet_type;
  v_amount := public.apn_withdrawal_request_amount(v_old.requested_amount, v_old.approved_amount, v_old.status);

  update public.apn_withdrawal_requests
  set status = 'failed',
      cancelled_at = now(), cancelled_by = nullif(v_actor, ''),
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('failureReason', p_reason, 'failedAt', now())
  where id = p_request_id;

  -- Release the reservation on the columnar transaction journal: 'failed' is
  -- not in the reserved set, so the consolidated refresh restores the unpaid
  -- eligible amount automatically.
  insert into public.apn_wallet_transactions
    (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, metadata, created_by)
  values
    (v_partner_id, v_wallet_type, p_request_id, 'release', v_amount, 'release',
     'Payment failed — eligible balance restored.',
     jsonb_build_object('failureReason', p_reason, 'source', 'wp3'), nullif(v_actor, ''));

  return jsonb_build_object('requestId', p_request_id, 'status', 'failed', 'restoredAmount', v_amount);
end;
$$;

revoke all on function public.apn_mark_withdrawal_failed(uuid, text) from public, anon;
grant execute on function public.apn_mark_withdrawal_failed(uuid, text) to authenticated;

commit;

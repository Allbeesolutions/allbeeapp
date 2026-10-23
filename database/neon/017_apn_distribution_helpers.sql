-- =============================================================================
-- ALLBEE — APN Distribution Helpers (Neon Port)
-- File: database/neon/017_apn_distribution_helpers.sql
--
-- Ported from: supabase/pr-apn-rule-engine-wp3.sql
-- =============================================================================

begin;

-- 1. Eligibility rule (the established 5th-of-following-month)
create or replace function public.apn_commission_eligibility_date(p_received_date date)
returns date
language sql immutable as $$
  select (date_trunc('month', p_received_date) + interval '1 month 4 days')::date;
$$;
revoke all on function public.apn_commission_eligibility_date(date) from public, anon;
grant execute on function public.apn_commission_eligibility_date(date) to authenticated;

-- 2. Ledger schema extensions
alter table public.apn_commission_ledger drop constraint if exists apn_commission_ledger_commission_type_check;
alter table public.apn_commission_ledger add constraint apn_commission_ledger_commission_type_check
  check (commission_type in ('partner','district','state','referral','adjustment','reversal','recovery'));

alter table public.apn_commission_ledger add column if not exists eligible_from date;
alter table public.apn_commission_ledger add column if not exists original_event_id uuid
  references public.apn_commission_ledger(id) on delete restrict;

-- 3. Operational status extensions
alter table public.apn_revenue_collections drop constraint if exists apn_revenue_collections_status_check;
alter table public.apn_revenue_collections add constraint apn_revenue_collections_status_check
  check (commission_status in ('Pending','Approved','Payable','Paid','Reversed'));

alter table public.apn_withdrawal_requests drop constraint if exists apn_withdrawal_requests_status_check;
alter table public.apn_withdrawal_requests add constraint apn_withdrawal_requests_status_check
  check (status in ('pending','under_review','approved','rejected','processing','paid','failed','cancelled','expired'));

alter table public.apn_withdrawal_requests add column if not exists data jsonb;
alter table public.apn_withdrawal_requests add column if not exists cancelled_by text;

-- 4. Rate helper + safe ledger recorder
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

-- 5. Consolidated wallet (derived-only, immutable surface)
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

  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing')), 0)
    into v_reserved
  from public.apn_withdrawal_requests where partner_id = p_partner_id;

  v_reserved := v_reserved
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0);

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

commit;
notify pgrst, 'reload schema';

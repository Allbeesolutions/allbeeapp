-- =============================================================================
-- ALLBEE — APN RULE ENGINE — WORK PACKAGE 9: LEDGER WIRING INTEGRITY
-- File: supabase/pr-apn-rule-engine-wp9.sql
--
-- DISCOVERY (read-only audit, 2026-08-14, production):
--   * engine.withdrawal-wallets — apn_withdrawal_wallets (claims center) is
--     deliberately source-derived (apn_withdrawal_source_totals: v4 collections
--     + legacy blob + referral earnings + reservations), NOT ledger-derived.
--     Recomputing it FROM the ledger is unsafe: the ledger excludes historical
--     legacy Paid rows (WP8 kept them in the claims center on purpose) and the
--     wallet carries its own reservation/external-legacy math. The ledger
--     linkage (WP3 triggers) is the correct convergence — but it silently
--     DEFERS every event when a non-admin writer records a collection or
--     referral earning: apn_ledger_entry gates on is_admin/can_module, and the
--     WP3 triggers call it with the WRITING user's identity. Reachable today:
--     crm_record_revenue (PR4) lets the assigned partner record revenue on
--     their own project (crm_can_read partner match) — a partner-issued
--     collection defers partner + district + state ledger events, so the
--     ledger-derived consolidated wallet (portal snapshot / AI) diverges from
--     the source-derived claims center (withdrawal wallet). The linkage was
--     wired but not universal.
--   * engine.referral-trigger — ledger half IS wired (apn_ledger_referral_trg
--     fires on apn_referral_earnings, the canonical product of
--     apn_referral_collection_after_insert). The apn_finance_expense_map half
--     is correctly NOT automatic: apn_ensure_finance_expense is a finance-role
--     action (manual / reversal-only), because auto-posting earnings to the
--     finance ledger would double-book expenses the finance team controls.
--   * engine.crm-assignments — NOT implemented by design: mirroring per-LEAD
--     assignment columns (work routing) into the per-PARTNER
--     apn_hierarchy_assignments (commission routing) would couple two domains,
--     thrash on conflicting heads across leads, and no UI sets the head
--     columns today (crm_assign_lead passes nulls). Hierarchy stays an
--     admin-gated surface; the marker is closed with documentation only.
--
-- DESIGN (the single WP9 scope — ledger wiring integrity):
--   1. apn_ledger_entry_owner(...) — the engine's ledger entry routine as an
--      owner-role function (byte-equivalent to the cap-fixed apn_ledger_entry
--      WITHOUT the is_admin/can_module gate; freeze guard + idempotency +
--      partner check + rate-max + 15%/35% caps + audit all preserved).
--      Revoked from every app role: reachable only by SECURITY DEFINER
--      engine functions.
--   2. apn_ledger_entry(...) — refactored into a thin gated wrapper that runs
--      the same role gate as before, then delegates to the owner routine.
--      Direct authenticated callers keep exactly today's surface.
--   3. apn_ledger_record_owner(...) — the safe recorder (eligible_from wiring
--      + exception deferral to apn_rule_audit) that calls the owner routine;
--      revoked from every app role.
--   4. The WP3 trigger functions apn_ledger_collection_after_change /
--      apn_ledger_referral_after_change now record through the owner path, so
--      every collection / referral-earning event lands in the ledger for
--      EVERY writer — admin, finance, staff, or partner — keeping the claims
--      center and the portal wallet provably symmetric.
--   5. Markers: engine.referral-trigger and engine.withdrawal-wallets →
--      completed (with the rationale above); engine.crm-assignments stays
--      review_required with documentation notes.
--
-- No rule-set, cap, wallet, withdrawal, referral, or CRM behavior changes.
-- Idempotent and safe to re-run; verify suite: pr-apn-rule-engine-wp9-verify.sql.
-- =============================================================================

begin;

-- ── 1. OWNER-ROLE LEDGER ENTRY (engine-internal; no app-role grants) ─────────
create or replace function public.apn_ledger_entry_owner(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row public.apn_commission_ledger%rowtype;
  v_secondary numeric;
  v_total numeric;
  v_base numeric := greatest(0, coalesce(p_base_amount, 0));
  v_event timestamptz := coalesce(p_event_at, now());
  v_max_percent numeric;
begin
  perform public.apn_guard_operational();
  if nullif(trim(p_idempotency_key), '') is null or nullif(trim(p_source_id), '') is null then
    raise exception 'Ledger idempotency key and source id are required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.apn_users u where u.id = p_partner_id) then
    raise exception 'Unknown APN partner.' using errcode = 'foreign_key_violation';
  end if;
  select * into v_row from public.apn_commission_ledger where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_row.id, 'duplicate', true, 'amount', v_row.amount);
  end if;
  select max(r.max_percent) into v_max_percent
  from public.apn_rule_sets rs
  join public.apn_commission_rules r on r.rule_set_id = rs.id
  where rs.status = 'active'
    and rs.effective_from <= v_event
    and (rs.effective_to is null or rs.effective_to >= v_event)
    and r.commission_type = p_commission_type
    and r.active;
  if v_max_percent is not null and p_percent > v_max_percent then
    raise exception 'Rate % exceeds the active rule maximum (%) for %.', p_percent, v_max_percent, p_commission_type
      using errcode = 'check_violation';
  end if;
  if p_commission_type in ('referral','district','state') then
    select coalesce(sum(amount), 0) into v_secondary
    from public.apn_commission_ledger
    where source_id = p_source_id and source_type = p_source_type
      and commission_type in ('referral','district','state')
      and amount > 0;
    if v_secondary + p_amount > round(v_base * 15 / 100, 2) then
      raise exception 'Secondary commission cap exceeded (15%% max per event).' using errcode = 'check_violation';
    end if;
  end if;
  select coalesce(sum(amount), 0) into v_total
  from public.apn_commission_ledger
  where source_id = p_source_id and source_type = p_source_type
    and amount > 0;
  if v_total + p_amount > round(v_base * 35 / 100, 2) then
    raise exception 'Total commission cap exceeded (35%% max per event).' using errcode = 'check_violation';
  end if;
  insert into public.apn_commission_ledger
    (idempotency_key, source_id, source_type, partner_id, commission_type,
     base_amount, percent, amount, event_at, snapshot, created_by)
  values
    (p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
     v_base, p_percent, p_amount, v_event, coalesce(p_snapshot, '{}'::jsonb), auth.uid()::text)
  returning * into v_row;
  perform public.apn_rule_audit('recorded ledger entry', 'apn_commission_ledger', v_row.id::text,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'commissionType', p_commission_type,
      'amount', p_amount, 'sourceType', p_source_type));
  return jsonb_build_object('id', v_row.id, 'duplicate', false, 'amount', v_row.amount,
    'commissionType', p_commission_type);
end;
$$;
revoke all on function public.apn_ledger_entry_owner(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) from public, anon, authenticated;

-- ── 2. GATED PUBLIC LEDGER ENTRY (unchanged surface; delegates to the owner) ─
create or replace function public.apn_ledger_entry(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if not (public.is_admin() or public.can_module('apn')) then
    raise exception 'Only APN administrators may record ledger entries.' using errcode = 'insufficient_privilege';
  end if;
  return public.apn_ledger_entry_owner(
    p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
    p_base_amount, p_percent, p_amount, p_event_at, p_snapshot);
end;
$$;
revoke all on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) from public, anon;
grant execute on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) to authenticated;

-- ── 3. OWNER-ROLE SAFE RECORDER (trigger path; no app-role grants) ───────────
create or replace function public.apn_ledger_record_owner(
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
  v_result := public.apn_ledger_entry_owner(
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
revoke all on function public.apn_ledger_record_owner(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb, date) from public, anon, authenticated;

-- ── 4. ENGINE TRIGGERS RECORD THROUGH THE OWNER PATH (WP3 bodies, re-pointed) ─
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
    perform public.apn_ledger_record_owner(
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
          perform public.apn_ledger_record_owner(
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
          perform public.apn_ledger_record_owner(
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
  perform public.apn_ledger_record_owner(
    'earn:' || new.id::text, new.id::text, 'referral', new.referrer_id, 'referral',
    new.revenue_amount, new.referral_percent, new.referral_amount, v_event,
    jsonb_build_object('collectionId', new.source_collection_id, 'relationshipId', new.relationship_id,
      'selfEarning', coalesce((new.snapshot->>'selfEarning')::boolean, false), 'source', 'wp3'),
    v_eligible);
  perform public.apn_consolidated_wallet_refresh(new.referrer_id);
  return new;
end;
$$;

-- ── 5. MIGRATION MARKER CLOSURE ───────────────────────────────────────────────
update public.apn_migrations
set status = 'completed',
    notes = 'WP9: ledger linkage verified wired and made universal — the WP3 collection/referral triggers now record through the owner-role path (apn_ledger_record_owner), so every writer (admin, finance, staff, partner) lands the same deterministic ledger events; the source-derived claims center (apn_withdrawal_wallets) is preserved by design and stays symmetric with the ledger-derived portal wallet. Finance-expense posting remains a deliberate finance-role action (manual/reversal-only).',
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, 'wp9')
where id = 'engine.withdrawal-wallets'
  and status <> 'completed';

update public.apn_migrations
set status = 'completed',
    notes = 'WP9: ledger half wired at the canonical point — apn_ledger_referral_trg fires on apn_referral_earnings (the deterministic product of apn_referral_collection_after_insert) and now records through the owner-role path for every writer; apn_finance_expense_map is NOT auto-wired because posting commission expenses is a finance-role action (apn_ensure_finance_expense, manual + reversal flows) — automatic posting would double-book the finance ledger.',
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, 'wp9')
where id = 'engine.referral-trigger'
  and status <> 'completed';

update public.apn_migrations
set notes = 'WP9: evaluated and NOT implemented as written — per-lead CRM assignment (work routing) and per-partner apn_hierarchy_assignments (commission routing) are different domains; auto-mirroring would couple them, thrash on conflicting heads across a partner''s leads, and no UI sets the head columns today (crm_assign_lead passes nulls). Hierarchy remains the admin-gated commission-routing surface; lead assignment stays the CRM work-routing surface.'
where id = 'engine.crm-assignments'
  and status = 'review_required';

commit;
notify pgrst, 'reload schema';
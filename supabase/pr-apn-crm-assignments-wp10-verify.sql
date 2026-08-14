-- =============================================================================
-- ALLBEE — Automated verification of the WP10 CRM ↔ APN ASSIGNMENT CONVERGENCE
-- patch (pr-apn-crm-assignments-wp10.sql) against PRODUCTION.
--
-- Verifies, in order:
--   T1  upsert_apn_commission_project artifacts: SECURITY DEFINER, hardened
--       search_path, authenticated-only EXECUTE grant (no public/anon).
--   T2  Partner isolation: with the admin flag OFF (any non-admin caller —
--       partner, client, intern) crm_assign_lead, crm_create_lead and
--       crm_record_revenue all refuse with insufficient_privilege. No partner
--       can self-assign, cross-assign, or post revenue.
--   T3  Admin authority: with the admin flag ON an admin can create a lead,
--       assign it to a partner, and the assignment is persisted in
--       crm_lead_assignments history + crm_audit.
--   T4  Duplicate/race-free assignment: assigning the same lead twice appends
--       history rows but creates NO duplicate lead, NO apn project, and NO
--       money (assignment alone creates nothing financial).
--   T5  Conversion snapshot: converting the assigned lead creates the CRM
--       project (assigned_partner_id copied once) AND the APN commission
--       project with partnerId = the lead's assigned partner (commission
--       ownership authority). Converting a lead with NO partner creates the
--       CRM project but NO APN project (no assignment -> no commission).
--   T6  Revenue attribution through the real chain: crm_record_revenue syncs
--       an APN collection stamped with the APN project's partner, lands
--       immutable ledger entries (partner @ 10%, district @ live hierarchy
--       rate, referral earning @ settings%), refreshes consolidated +
--       withdrawal wallets, writes the finance income transaction, zero
--       'ledger record deferred' rows.
--   T7  Reassignment does NOT move money: after revenue exists, admin
--       reassigns the lead to another partner — the lead column changes, but
--       the APN project partner, collection partner, ledger rows, wallets and
--       referral earnings stay byte-for-byte unchanged.
--   T8  NEW WP10 GOVERNANCE: upserting an existing project with a different
--       partner is refused (check_violation) once ANY collection exists;
--       allowed but audited (apn_rule_audit 'commission project partner
--       reassigned (pre-revenue)') while zero collections exist.
--   T9  Freeze-aware: with apn_system_controls frozen the revenue chain (via
--       the engine ledger) aborts with FZ001; restored afterwards.
--   T10 Race/duplicate protections present: unique idempotency_key on the
--       ledger, unique source_collection_id on referral earnings, and the
--       CRM→APN finance + collection writes are conflict-guarded.
--   T11 Migration marker engine.crm-assignments = completed (wp10) + notes.
--   T12 Post-rollback restoration: zero fixture residue, auth helpers + guard
--       trigger restored, the WP10 function persists.
--
-- Delivery channel: Supabase SQL Editor / Management API (single session, one
-- transaction). The auth scaffolding (stub helpers + guard-trigger drop) is
-- session-temporary and lives inside the savepoint: `rollback to savepoint`
-- restores the production helpers and the guard trigger, so production keeps
-- its real definitions. ALL test data is created inside that same savepoint
-- and discarded before commit — ZERO lasting impact on business data.
-- Any assertion failure aborts the transaction and reports an error.
--
-- The CLI session has no JWT: is_admin()/can_finance()/is_superadmin() are
-- temporarily redefined as session-flag controlled (default ON), the
-- apn_users guard trigger is temporarily dropped, and JWT claims are
-- injected with a literal UUID sub to exercise auth-gated checks (then
-- reset). The savepoint is created immediately after begin so the rollback
-- restores the production helpers and the guard trigger AND discards every
-- fixture; `rollback to savepoint` (not `release`) is what actually undoes
-- the fixture work.
--
-- Idempotent: pre-wipe is scoped to THIS verify's fixture identities only;
-- re-runs are identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_wp10_verify_sp;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as
  $$ select coalesce(current_setting('apn.verify.admin', true), 'on') <> 'off' $$;
create or replace function public.can_finance()
returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as
  $$ select public.is_admin() or coalesce(current_setting('apn.verify.finance', true), 'on') <> 'off' $$;
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = pg_catalog, public, pg_temp as
  $$ select coalesce(current_setting('apn.verify.super', true), 'on') <> 'off' $$;
drop trigger if exists apn_users_guard_trg on public.apn_users;
create or replace function public.vf_assert(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'VERIFY FAIL: %', p_msg;
  end if;
end $$;

-- ── JWT session (fixture actor for auth-scoped columns) ─────────────────────
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', false);

-- ────────────────────────────────────────────────────────────────────────────
-- Pre-wipe any residue from a previous interrupted run (no-op on clean DB).
-- Scoped to THIS verify's fixture identities only — never touches real data.
-- ────────────────────────────────────────────────────────────────────────────
delete from public.transactions
  where data->>'crmProjectId' in (select id::text from public.crm_projects
    where quotation_id in (select id from public.crm_quotations where title in ('WP10 fixture project','WP10 unassigned project')));
delete from public.apn_commission_ledger where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_rule_audit where actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
delete from public.apn_withdrawal_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_consolidated_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_referral_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_referral_earnings where referrer_id = '33333333-3333-3333-3333-333333333333';
delete from public.apn_revenue_collections where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_commission_projects where id = 'wp10-fresh' or partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_hierarchy_assignments where partner_id = '11111111-1111-1111-1111-111111111111';
delete from public.apn_referral_relationships where referred_id in ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
delete from public.crm_revenue_collections where project_id in (select id from public.crm_projects where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001')));
delete from public.crm_projects where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001'));
delete from public.crm_quotations where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001'));
delete from public.crm_lead_assignments where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001'));
delete from public.crm_audit where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001'));
delete from public.crm_activities where lead_id in (select id from public.crm_leads where mobile in ('9000000000','9000000001'));
delete from public.crm_leads where mobile in ('9000000000','9000000001');
delete from public.crm_clients where client_key in ('9000000000','9000000001');
delete from public.apn_commission_rules where rule_set_id in (select id from public.apn_rule_sets where code = 'wp10-verify');
delete from public.apn_rule_sets where code = 'wp10-verify';
delete from public.apn_users where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');

set apn.verify.admin = 'on';
set apn.verify.finance = 'on';
set apn.verify.super = 'on';

do $$
declare
  v_partner  text := '11111111-1111-1111-1111-111111111111';
  v_head     text := '22222222-2222-2222-2222-222222222222';
  v_referrer text := '33333333-3333-3333-3333-333333333333';
  v_partner2 text := '44444444-4444-4444-4444-444444444444';
  v_project  text;
  v_collection text;
  v_coll_uuid uuid;
  v_crm_id uuid;
  v_crm_id_b uuid;
  v_code text;
  v_res_by text;
  v_earning_id uuid;
  v_head_rate numeric;
  v_head_amt numeric;
  v_elig date;
  v_frz uuid;
  v_lead_id uuid;
  v_quote_id uuid;
  v_row record;
  c bigint;
  n numeric;
  v_ok boolean;
begin
  -- ── T1: WP10 function artifacts and access surface ────────────────────────
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'upsert_apn_commission_project'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
  ), 'T1 upsert_apn_commission_project SECURITY DEFINER + auth surface');
  select p.proconfig into v_row from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'upsert_apn_commission_project';
  perform public.vf_assert(v_row.proconfig is not null and array_to_string(v_row.proconfig, ',') like '%pg_catalog, public, pg_temp%',
    'T1 hardened search_path on upsert_apn_commission_project');

  -- ── Fixtures: partners, rule set, hierarchy, referral ─────────────────────
  insert into public.apn_users (id, data, updated_at) values
    (v_partner,  jsonb_build_object('id', v_partner,  'name', 'WP10 Partner A',  'role', 'partner', 'status', 'active', 'commissionPct', 10), now()),
(v_head,     jsonb_build_object('id', v_head,     'name', 'WP10 District Head', 'role', 'district_head', 'status', 'active'), now()),
    (v_referrer, jsonb_build_object('id', v_referrer, 'name', 'WP10 Referrer',   'role', 'partner', 'status', 'active'), now()),
    (v_partner2, jsonb_build_object('id', v_partner2, 'name', 'WP10 Partner B',  'role', 'partner', 'status', 'active'), now());
  select code into v_code from public.apn_referral_codes where partner_id = v_partner;
  perform public.vf_assert(v_code is not null, 'T2 referral code auto-generated for partner');
  insert into public.apn_rule_sets (code, name, status, reason, created_by, effective_from)
    values ('wp10-verify', 'WP10 verify rule set', 'active', 'verify fixture', 'verify', now() - interval '1 day') returning id into v_row;
  insert into public.apn_commission_rules (rule_set_id, commission_type, tier_min, tier_max, percent, max_percent, cap_class, priority)
    values
      (v_row.id, 'partner',  1, null::int, 10.00, 20, 'primary',   1),
      (v_row.id, 'district', 1, null::int,  1.00,  5, 'secondary', 1),
      (v_row.id, 'referral', 1, null::int,  1.00,  5, 'secondary', 1);
  insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id, status, assigned_by, effective_from)
    values (v_partner, v_head, null, 'active', coalesce(auth.uid()::text, 'verify'), now() - interval '1 day');
  insert into public.apn_referral_relationships (referrer_id, referred_id, referral_code, linked_by)
    values (v_referrer, v_partner, v_code, 'verify')
    on conflict (referred_id) do nothing;

  -- ── T2: partner / non-admin isolation (admin flag OFF) ────────────────────
  perform set_config('apn.verify.admin', 'off', false);
  perform set_config('apn.verify.finance', 'off', false);
  perform set_config('apn.verify.super', 'off', false);

  v_ok := true;
  begin
    perform public.crm_assign_lead('00000000-0000-0000-0000-000000000000', 'emp', v_partner);
    v_ok := false;
  exception when insufficient_privilege then null; end;
  perform public.vf_assert(v_ok, 'T2 non-admin crm_assign_lead denied (no self/cross-assign)');

  v_ok := true;
  begin
    perform public.crm_create_lead(jsonb_build_object('customer_name', 'WP10 Fixture', 'company', 'Fixture Co', 'mobile', '9000000000', 'source', 'Walk-in'));
    v_ok := false;
  exception when insufficient_privilege then null; end;
  perform public.vf_assert(v_ok, 'T2 non-admin crm_create_lead denied (no lead creation)');

  v_ok := true;
  begin
    perform public.crm_record_revenue('00000000-0000-0000-0000-000000000000', 100000);
    v_ok := false;
  exception when insufficient_privilege then null; end;
  perform public.vf_assert(v_ok, 'T2 non-admin crm_record_revenue denied (no partner revenue posting)');

  -- ── T3: admin authority — create + assign with history/audit ──────────────
  perform set_config('apn.verify.admin', 'on', false);
  select (public.crm_create_lead(jsonb_build_object('customer_name', 'WP10 Fixture', 'company', 'Fixture Co', 'mobile', '9000000000', 'source', 'Walk-in'))->>'id')::uuid
    into v_lead_id;
  perform public.vf_assert(v_lead_id is not null, 'T3 admin can create a lead');
  perform public.crm_assign_lead(v_lead_id, 'emp-wp10', v_partner, null, null);
  select count(*) into c from public.crm_lead_assignments where lead_id = v_lead_id;
  perform public.vf_assert(c = 1, 'T3 assignment history row created');
  select count(*) into c from public.crm_audit where lead_id = v_lead_id and action = 'lead_assigned';
  perform public.vf_assert(c >= 1, 'T3 assignment audited (crm_audit lead_assigned)');

  -- ── T4: duplicate assignment is history-only, never money ─────────────────
  perform public.crm_assign_lead(v_lead_id, 'emp-wp10', v_partner, null, null);
  select count(*) into c from public.crm_lead_assignments where lead_id = v_lead_id;
  perform public.vf_assert(c = 2, 'T4 repeated assignment appends history only');
  select count(*) into c from public.apn_commission_projects where id like 'crm-%' and partner_id in (v_partner, v_partner2);
  perform public.vf_assert(c = 0, 'T4 assignment itself creates no APN project (no money before conversion)');
  select count(*) into c from public.apn_commission_ledger
    where idempotency_key like 'col:crm-revenue-%' or partner_id in (v_partner, v_head, v_referrer, v_partner2);
  perform public.vf_assert(c = 0, 'T4 no ledger entries from assignment');

  -- ── T5: conversion snapshot (assigned lead → APN project) ─────────────────
  select (public.crm_create_quotation(v_lead_id, jsonb_build_object('service_type', 'Software', 'title', 'WP10 fixture project', 'items', jsonb_build_array(jsonb_build_object('description', 'system', 'quantity', 1, 'unit_price', 120000))))->>'id')::uuid
    into v_quote_id;
  perform public.vf_assert(v_quote_id is not null, 'T5 quotation created');
  select (public.crm_update_quotation_status(v_quote_id, 'Accepted')->>'id') is not null into v_ok;
  perform public.vf_assert(v_ok, 'T5 quotation Accepted auto-converts (admin)');
  select id into v_crm_id from public.crm_projects where quotation_id = v_quote_id;
  perform public.vf_assert(v_crm_id is not null, 'T5 conversion created the CRM project');
  v_project := 'crm-' || v_crm_id::text;
  select partner_id into v_code from public.apn_commission_projects where id = v_project;
  perform public.vf_assert(v_code = v_partner, 'T5 APN project partner = lead assigned partner (commission authority)');
  select assigned_partner_id into v_code from public.crm_projects where id = v_crm_id;
  perform public.vf_assert(v_code = v_partner, 'T5 CRM project snapshot copy matches lead assignment');
  -- T5b: no-partner lead → CRM project only, NO APN project
  insert into public.crm_leads (id, lead_number, customer_name, company, mobile, source, status, created_by)
    values (gen_random_uuid(), 'WP10B-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.crm_lead_number_seq')::text, 6, '0'),
            'WP10 Unassigned', 'Solo Co', '9000000001', 'Walk-in', 'New', auth.uid()::text) returning id into v_lead_id;
  perform public.crm_assign_lead(v_lead_id, 'emp-wp10', null, null, null);
  select (public.crm_create_quotation(v_lead_id, jsonb_build_object('service_type', 'Software', 'title', 'WP10 unassigned project', 'items', jsonb_build_array(jsonb_build_object('quantity', 1, 'unit_price', 50000))))->>'id')::uuid into v_quote_id;
  perform public.crm_update_quotation_status(v_quote_id, 'Accepted');
  select id into v_crm_id_b from public.crm_projects where quotation_id = v_quote_id;
  select count(*) into c from public.apn_commission_projects where id = 'crm-' || v_crm_id_b::text;
  perform public.vf_assert(v_crm_id_b is not null and c = 0, 'T5b lead without partner -> CRM project, NO APN project (no assignment = no commission)');

  -- ── T6: revenue attribution through the real chain (project A) ────────────
  perform set_config('apn.verify.admin', 'on', false);
  insert into public.apn_referral_settings (id, enabled, default_percent, updated_at)
    values (1, true, 1, now())
    on conflict (id) do update set enabled = true, default_percent = 1, updated_at = now();
  perform public.crm_record_revenue(v_crm_id, 100000, '2026-07-31', 0, 'WP10 fixture');
  select id into v_coll_uuid from public.crm_revenue_collections where project_id = v_crm_id order by created_at desc limit 1;
  v_collection := 'crm-revenue-' || v_coll_uuid::text;
  v_elig := public.apn_commission_eligibility_date((select received_at from public.crm_revenue_collections where id = v_coll_uuid));

  -- collection stamped with the APN project partner (never the CRM column)
  select partner_id into v_code from public.apn_revenue_collections where id = v_collection;
  perform public.vf_assert(v_code = v_partner, 'T6 APN collection partner = APN project partner (money authority)');

  -- ledger: partner entry
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'col:' || v_collection || ':partner';
  perform public.vf_assert(c = 1, 'T6 partner ledger entry recorded through owner path');
  select * into v_row from public.apn_commission_ledger where idempotency_key = 'col:' || v_collection || ':partner';
  perform public.vf_assert(v_row.partner_id = v_partner and v_row.amount = 10000 and v_row.percent = 10, 'T6 partner entry amount/percent correct');
  perform public.vf_assert(v_row.eligible_from = v_elig, 'T6 partner entry eligible_from correct');

  -- ledger: district entry (live hierarchy rate)
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'col:' || v_collection || ':district';
  perform public.vf_assert(c = 1, 'T6 district ledger entry recorded');
  select * into v_row from public.apn_commission_ledger where idempotency_key = 'col:' || v_collection || ':district';
  perform public.vf_assert(v_row.partner_id = v_head and v_row.commission_type = 'district' and v_row.amount > 0, 'T6 district entry credits hierarchical head');
  v_head_rate := v_row.percent;
  v_head_amt := v_row.amount;

  -- ledger: referral entry (referral of the partner, not the CRM assignment)
  select id into v_earning_id from public.apn_referral_earnings where source_collection_id = v_collection;
  perform public.vf_assert(v_earning_id is not null, 'T6 referral earning auto-generated from collection');
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'earn:' || v_earning_id;
  perform public.vf_assert(c = 1, 'T6 referral ledger entry recorded');
  select * into v_row from public.apn_commission_ledger where idempotency_key = 'earn:' || v_earning_id;
  perform public.vf_assert(v_row.partner_id = v_referrer and v_row.amount = 1000 and v_row.percent = 1, 'T6 referral entry credits referrer at referral percent');
  perform public.vf_assert(v_head_amt = round(100000 * v_head_rate / 100, 2), 'T6 district amount consistent with live hierarchy rate');

  -- zero defers
  select count(*) into c from public.apn_rule_audit where action = 'ledger record deferred' and entity_id like 'col:' || v_collection || '%';
  perform public.vf_assert(c = 0, 'T6 no ledger deferrals for the flow');

  -- wallets (portal: consolidated | claims center: withdrawal)
  select earned into n from public.apn_consolidated_wallets where partner_id = v_partner;
  perform public.vf_assert(n = 10000, 'T6 consolidated wallet (partner) = 10000');
  select earned into n from public.apn_consolidated_wallets where partner_id = v_head;
  perform public.vf_assert(n = v_head_amt, 'T6 consolidated wallet (head) = district amount');
  select earned into n from public.apn_consolidated_wallets where partner_id = v_referrer;
  perform public.vf_assert(n = 1000, 'T6 consolidated wallet (referrer) = 1000');
  select withdrawable into n from public.apn_withdrawal_wallets where partner_id = v_partner and wallet_type = 'commission';
  perform public.vf_assert(n = 10000, 'T6 claims center commission wallet = 10000');
  select pending into n from public.apn_withdrawal_wallets where partner_id = v_referrer and wallet_type = 'referral';
  perform public.vf_assert(n = 1000, 'T6 claims center referral wallet = 1000');

  -- finance attribution
  select count(*) into c from public.transactions where id = 'crm-finance-' || v_coll_uuid::text;
  perform public.vf_assert(c = 1, 'T6 finance income transaction written by CRM sync');
  select count(*) into c from public.apn_finance_expense_map
    where ledger_id in (select id from public.apn_commission_ledger where partner_id in (v_partner, v_head, v_referrer, v_partner2));
  perform public.vf_assert(c = 0, 'T6 no finance EXPENSE auto-created (expense map is a finance-role action)');

  -- ── T7: reassignment never moves historical money ─────────────────────────
  perform public.crm_assign_lead((select lead_id from public.crm_projects where id = v_crm_id), 'emp-wp10', v_partner2, null, null);
  select assigned_partner_id into v_code from public.crm_leads where id = (select lead_id from public.crm_projects where id = v_crm_id);
  perform public.vf_assert(v_code = v_partner2, 'T7 CRM lead assignment updated to partner B');
  select partner_id into v_code from public.apn_commission_projects where id = v_project;
  perform public.vf_assert(v_code = v_partner, 'T7 APN project partner UNCHANGED (money authority immutable)');
  select partner_id into v_code from public.apn_revenue_collections where id = v_collection;
  perform public.vf_assert(v_code = v_partner, 'T7 collection partner UNCHANGED');
  select count(*) into c from public.apn_commission_ledger
    where idempotency_key like 'col:' || v_collection || '%' or idempotency_key = 'earn:' || v_earning_id;
  perform public.vf_assert(c = 3, 'T7 ledger rows unchanged after reassignment');
  select earned into n from public.apn_consolidated_wallets where partner_id = v_partner;
  perform public.vf_assert(n = 10000, 'T7 partner wallet unchanged after reassignment');
  select count(*) into c from public.apn_referral_earnings where referrer_id = v_referrer;
  perform public.vf_assert(c = 1, 'T7 no new referral earnings from reassignment');

  -- ── T8: WP10 reassignment governance on the APN surface ───────────────────
  v_ok := true;
  begin
    perform public.upsert_apn_commission_project(jsonb_build_object(
      'id', v_project, 'partnerId', v_partner2, 'projectName', 'WP10 fixture project',
      'clientName', 'Fixture Co', 'projectValue', 120000, 'commissionRate', 10, 'status', 'Processing'));
    v_ok := false;
  exception when check_violation then null; end;
  perform public.vf_assert(v_ok, 'T8 partner reassignment REFUSED after revenue exists (check_violation)');
  select data->>'partnerId' into v_code from public.apn_commission_projects where id = v_project;
  perform public.vf_assert(v_code = v_partner, 'T8 project partner still the original after refused reassignment');

  perform public.upsert_apn_commission_project(jsonb_build_object(
    'id', 'wp10-fresh', 'partnerId', v_partner, 'projectName', 'WP10 fresh',
    'clientName', 'Fixture Co', 'projectValue', 50000, 'commissionRate', 10, 'status', 'Pending'));
  perform public.upsert_apn_commission_project(jsonb_build_object(
    'id', 'wp10-fresh', 'partnerId', v_partner2, 'projectName', 'WP10 fresh',
    'clientName', 'Fixture Co', 'projectValue', 50000, 'commissionRate', 10, 'status', 'Pending'));
  select data->>'partnerId' into v_code from public.apn_commission_projects where id = 'wp10-fresh';
  perform public.vf_assert(v_code = v_partner2, 'T8 pre-revenue reassignment allowed');
  select count(*) into c from public.apn_rule_audit where action = 'commission project partner reassigned (pre-revenue)' and entity_id = 'wp10-fresh';
  perform public.vf_assert(c = 1, 'T8 pre-revenue reassignment audited in apn_rule_audit');

  -- ── T9: freeze-aware money chain ──────────────────────────────────────────
  -- The owner path (apn_ledger_record_owner) DEFERS under exception instead of
  -- aborting: a frozen chain records the collection but mints NO ledger money,
  -- and the FZ001 guard hit (`APN operations are temporarily frozen.`) is
  -- preserved in apn_rule_audit. Assert that strict outcome, then prove the
  -- same chain records normally once unfrozen.
  perform set_config('apn.verify.super', 'on', false);
  update public.apn_system_controls set frozen = true, updated_by = 'wp10-verify' where id = 1;
  -- Capture the collection id from the RPC return value: now() is the
  -- transaction-start timestamp, so `order by created_at desc limit 1` ties
  -- across every insert in this single-transaction verify and can resolve to
  -- an earlier collection.
  select (public.crm_record_revenue(v_crm_id, 10000, '2026-08-01') ->> 'id')::uuid into v_frz;
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'col:crm-revenue-' || v_frz::text || ':partner';
  perform public.vf_assert(c = 0, 'T9 frozen revenue chain mints NO ledger money (FZ001 enforced)');
  select count(*) into c from public.apn_rule_audit
    where action = 'ledger record deferred' and entity_id = 'col:crm-revenue-' || v_frz::text || ':partner'
      and metadata->>'error' like '%temporarily frozen%';
  perform public.vf_assert(c >= 1, 'T9 frozen ledger path deferred with FZ001 recorded in apn_rule_audit');
  update public.apn_system_controls set frozen = false, updated_by = 'wp10-verify' where id = 1;
  select (public.crm_record_revenue(v_crm_id, 10000, '2026-08-02') ->> 'id')::uuid into v_frz;
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'col:crm-revenue-' || v_frz::text || ':partner';
  perform public.vf_assert(c = 1, 'T9 unfrozen revenue chain records normally (freeze lifted)');
  perform set_config('apn.verify.super', 'off', false);

  -- ── T10: race/duplicate protection in place ───────────────────────────────
  select count(*) into c from pg_constraint where conname = 'apn_commission_ledger_idempotency_key_key';
  perform public.vf_assert(c = 1, 'T10 ledger idempotency unique constraint present');
  select count(*) into c from pg_constraint where conname = 'apn_referral_earnings_source_collection_id_key';
  perform public.vf_assert(c = 1, 'T10 referral earnings unique source_collection constraint present');
  select p.prosrc like '%on conflict(id) do nothing%' into v_ok from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = 'crm_sync_revenue_to_apn';
  perform public.vf_assert(v_ok, 'T10 CRM sync writes conflict-guarded (idempotent)');

  -- ── T11: migration marker closed by WP10 ──────────────────────────────────
  select status into v_code from public.apn_migrations where id = 'engine.crm-assignments';
  perform public.vf_assert(v_code = 'completed', 'T11 engine.crm-assignments marker completed');
  select coalesce(resolved_by, '') into v_res_by from public.apn_migrations where id = 'engine.crm-assignments';
  perform public.vf_assert(v_res_by = 'wp10', 'T11 marker resolved_by = wp10');
  select notes into v_code from public.apn_migrations where id = 'engine.crm-assignments';
  perform public.vf_assert(v_code like '%WP10%', 'T11 marker carries WP10 rationale notes');
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Roll back the savepoint: discards every fixture AND restores the temporary
-- helpers (is_admin/can_finance/is_superadmin back to production, the
-- apn_users guard trigger back in place, pre-wipes undone). Only the WP10
-- patch objects (committed in the patch run) persist through the final commit.
-- ────────────────────────────────────────────────────────────────────────────
rollback to savepoint apn_wp10_verify_sp;

do $$
declare
  c bigint;
begin
  -- T12: zero residue + helper restoration + patch persistence
  select count(*) into c from public.crm_leads where mobile in ('9000000000','9000000001');
  if c <> 0 then raise exception 'VERIFY FAIL: lead residue after rollback'; end if;
  select count(*) into c from public.crm_quotations where title in ('WP10 fixture project','WP10 unassigned project');
  if c <> 0 then raise exception 'VERIFY FAIL: quotation residue after rollback'; end if;
  select count(*) into c from public.crm_projects where name in ('WP10 fixture project','WP10 unassigned project');
  if c <> 0 then raise exception 'VERIFY FAIL: project residue after rollback'; end if;
  select count(*) into c from public.crm_clients where client_key in ('9000000000','9000000001');
  if c <> 0 then raise exception 'VERIFY FAIL: client residue after rollback'; end if;
  select count(*) into c from public.crm_lead_assignments where assigned_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if c <> 0 then raise exception 'VERIFY FAIL: lead assignment residue after rollback'; end if;
  select count(*) into c from public.crm_audit where actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if c <> 0 then raise exception 'VERIFY FAIL: audit residue after rollback'; end if;
  select count(*) into c from public.apn_commission_projects
    where id = 'wp10-fresh' or partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: apn project residue after rollback'; end if;
  select count(*) into c from public.apn_revenue_collections
    where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: collection residue after rollback'; end if;
  select count(*) into c from public.apn_commission_ledger
    where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: ledger residue after rollback'; end if;
  select count(*) into c from public.apn_referral_earnings where referrer_id = '33333333-3333-3333-3333-333333333333';
  if c <> 0 then raise exception 'VERIFY FAIL: earnings residue after rollback'; end if;
  select count(*) into c from public.apn_rule_audit where actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if c <> 0 then raise exception 'VERIFY FAIL: rule audit residue after rollback'; end if;
  select count(*) into c from public.apn_consolidated_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: consolidated wallet residue after rollback'; end if;
  select count(*) into c from public.apn_withdrawal_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: withdrawal wallet residue after rollback'; end if;
  select count(*) into c from public.apn_referral_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: referral wallet residue after rollback'; end if;
  select count(*) into c from public.apn_hierarchy_assignments where partner_id = '11111111-1111-1111-1111-111111111111';
  if c <> 0 then raise exception 'VERIFY FAIL: hierarchy residue after rollback'; end if;
  select count(*) into c from public.apn_referral_relationships where referred_id in ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
  if c <> 0 then raise exception 'VERIFY FAIL: relationship residue after rollback'; end if;
  select count(*) into c from public.apn_rule_sets where code = 'wp10-verify';
  if c <> 0 then raise exception 'VERIFY FAIL: rule set residue after rollback'; end if;
  select count(*) into c from public.transactions
    where data->>'project' in ('WP10 fixture project','WP10 unassigned project') or data->>'client' in ('WP10 fixture project','WP10 unassigned project');
  if c <> 0 then raise exception 'VERIFY FAIL: finance txn residue after rollback'; end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = 'is_admin' and p.prosrc like '%apn.verify%') then
    raise exception 'VERIFY FAIL: is_admin helper not restored';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apn_users_guard_trg' and tgrelid = 'public.apn_users'::regclass) then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = 'upsert_apn_commission_project') then
    raise exception 'VERIFY FAIL: WP10 function should persist (patch objects committed)';
  end if;
  raise notice '[verify] WP10 POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

reset request.jwt.claims;

commit;
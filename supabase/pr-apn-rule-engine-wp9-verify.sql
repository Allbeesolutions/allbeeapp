-- =============================================================================
-- ALLBEE — Automated verification of the WP9 LEDGER WIRING INTEGRITY patch
-- (pr-apn-rule-engine-wp9.sql) against PRODUCTION.
--
-- Verifies, in order:
--   T1  apn_ledger_entry_owner + apn_ledger_record_owner exist, are SECURITY
--       DEFINER, and are EXECUTE-revoked from public/anon/authenticated.
--       apn_ledger_entry keeps its authenticated-only grant; the WP3
--       apn_ledger_record_safe legacy surface still exists (unchanged).
--   T2  The engine triggers are re-pointed: apn_ledger_collection_after_change
--       and apn_ledger_referral_after_change bodies call apn_ledger_record_owner
--       (owner-role path) — not the gated apn_ledger_entry or the old
--       apn_ledger_record_safe fallback.
--   T3  Direct gate preserved: with admin/finance flags OFF the RPC-level
--       apn_ledger_entry refuses with insufficient_privilege.
--   T4  Freeze honored on the owner path: with apn_system_controls frozen the
--       owner entry raises FZ001 (guard_operational still enforced).
--   T5  Caps still enforced: an owner entry above a commission-type maximum
--       (rule set), the secondary (15%) cap, or the total (35%) cap raises
--       check_violation.
--   T6  END-TO-END: a NON-ADMIN writer inserts a revenue collection for a
--       fixture partner (project + hierarchy + referral relationship in place)
--       and the deterministic partner + district + referral ledger events land
--       through the owner path with correct amounts/percent/eligible_from,
--       no 'ledger record deferred' rows, and the consolidated wallet
--       (portal) + withdrawal wallets (claims center) agree on the money.
--   T7  Idempotency: re-touching the same collection creates NO duplicate
--       ledger rows and stays deferral-free.
--   T8  Migration markers: engine.referral-trigger + engine.withdrawal-wallets
--       completed; engine.crm-assignments kept review_required with notes.
--   T9  Post-rollback restoration: zero fixture residue, auth helpers and the
--       apn_users_guard_trg restored, patch artifacts persist.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session, whole
-- file runs in ONE transaction). ALL test data is created inside a single
-- savepoint that is rolled back before commit, so this file has ZERO lasting
-- impact on business data. If any assertion fails the transaction aborts, the
-- editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), is_admin() /
-- can_finance() / is_superadmin() are temporarily redefined as session-flag
-- controlled (default ON) and the apn_users guard trigger is temporarily
-- dropped — all rolled back with the savepoint. JWT claims are injected with
-- set_config using a literal UUID sub to exercise the auth-gated checks.
--
-- Idempotent: only reads state + creates/rolls back test data; a second run is
-- identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_wp9_verify_sp;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select coalesce(current_setting('apn.verify.admin', true) <> 'off', true);
$$;

create or replace function public.can_finance()
returns boolean language sql security definer set search_path = public as $$
  select coalesce(current_setting('apn.verify.admin', true) <> 'off', true);
$$;

create or replace function public.is_superadmin()
returns boolean language sql security definer set search_path = public as $$
  select coalesce(current_setting('apn.verify.super', true) <> 'off', true);
$$;

create or replace function public.vf_assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'VERIFY FAIL: %', msg;
  end if;
end $$;

drop trigger if exists apn_users_guard_trg on public.apn_users;

set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- Wipe any residue from a previous interrupted run (no-op on a clean database).
-- Scoped to THIS verify's fixture partners + keys only — never touches real
-- production 'earn:<uuid>' rows.
delete from public.apn_commission_ledger
where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')
   or idempotency_key like 'col:wp9-%' or idempotency_key like 'wp9-%';
delete from public.apn_rule_audit
where entity_id like 'col:wp9-%' or entity_id like 'wp9-%'
   or entity_id in (select 'earn:' || e.id::text from public.apn_referral_earnings e where e.referrer_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333'));
delete from public.apn_referral_earnings where source_collection_id = 'wp9-verify-collection';
delete from public.apn_revenue_collections where id = 'wp9-verify-collection';
delete from public.apn_commission_projects where id = 'wp9-verify-project';
delete from public.apn_hierarchy_assignments where partner_id = '11111111-1111-1111-1111-111111111111';
delete from public.apn_referral_relationships where referred_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
delete from public.apn_commission_rules where rule_set_id in (select id from public.apn_rule_sets where code = 'wp9-verify');
delete from public.apn_rule_sets where code = 'wp9-verify';
delete from public.apn_users where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');

do $$
declare
  v_partner text := '11111111-1111-1111-1111-111111111111';
  v_head    text := '22222222-2222-2222-2222-222222222222';
  v_referrer text := '33333333-3333-3333-3333-333333333333';
  v_project text := 'wp9-verify-project';
  v_collection text := 'wp9-verify-collection';
  v_code text;
  v_earning_id uuid;
  v_head_rate numeric;
  v_head_amt numeric;
  v_elig_coll date;
  v_elig_ref date;
  v_row record;
  c bigint;
  n numeric;
  r jsonb;
  v_ok boolean;
begin
  -- ── T1 artifacts exist + correct access surface ────────────────────────────
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'apn_ledger_entry_owner'
      and p.prosecdef
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
  ), 'T1 apn_ledger_entry_owner SECURITY DEFINER + revoked from app roles');
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'apn_ledger_record_owner'
      and p.prosecdef
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
  ), 'T1 apn_ledger_record_owner SECURITY DEFINER + revoked from app roles');
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'apn_ledger_entry'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
  ), 'T1 apn_ledger_entry authenticated-only grant preserved');
  perform public.vf_assert(exists (
    select 1 from pg_proc p where p.proname = 'apn_ledger_record_safe'
  ), 'T1 legacy apn_ledger_record_safe surface unchanged');

  -- ── T2 trigger bodies re-pointed to the owner path ────────────────────────
  select prosrc into v_row from pg_proc where proname = 'apn_ledger_collection_after_change';
  perform public.vf_assert(v_row.prosrc like '%apn_ledger_record_owner%'
    and v_row.prosrc not like '%apn_ledger_record_safe%'
    and v_row.prosrc not like '%public.apn_ledger_entry(%',
    'T2 collection trigger records through apn_ledger_record_owner');
  select prosrc into v_row from pg_proc where proname = 'apn_ledger_referral_after_change';
  perform public.vf_assert(v_row.prosrc like '%apn_ledger_record_owner%'
    and v_row.prosrc not like '%apn_ledger_record_safe%'
    and v_row.prosrc not like '%public.apn_ledger_entry(%',
    'T2 referral trigger records through apn_ledger_record_owner');

  -- ── Fixtures (all inside the savepoint) ───────────────────────────────────
  insert into public.apn_users (id, data, updated_at) values
    (v_partner,  jsonb_build_object('id', v_partner, 'name', 'WP9 Partner', 'status', 'active', 'role', 'partner'), now()),
    (v_head,     jsonb_build_object('id', v_head, 'name', 'WP9 District Head', 'status', 'active', 'role', 'district_head'), now()),
    (v_referrer, jsonb_build_object('id', v_referrer, 'name', 'WP9 Referrer', 'status', 'active', 'role', 'partner'), now());

  -- Deterministic commission rates: a fixture rule set active NOW (rolled back)
  -- so apn_commission_rate_for('district') = 1% regardless of production rule
  -- history. Never visible outside this transaction.
  with rs as (
    insert into public.apn_rule_sets (code, name, status, reason, created_by, effective_from)
    values ('wp9-verify', 'WP9 verify rule set', 'active', 'verify fixture', 'verify', now() - interval '1 day')
    returning id
  )
  insert into public.apn_commission_rules (rule_set_id, commission_type, tier_min, tier_max, percent, max_percent, cap_class, priority)
  select rs.id, x.ct, x.tmin, x.tmax::int, x.pct, x.maxp, x.cap, 1
  from rs
  cross join (values
    ('partner',  1, null, 10.00, 20, 'primary'),
    ('district', 1, null,  1.00,  5, 'secondary'),
    ('referral', 1, null,  1.00,  5, 'secondary')
  ) as x(ct, tmin, tmax, pct, maxp, cap);

  -- Referral settings pinned to a deterministic 1% default (rolled back).
  insert into public.apn_referral_settings (id, enabled, default_percent, updated_at)
  values (1, true, 1, now())
  on conflict (id) do update set enabled = true, default_percent = 1, updated_at = now();

  -- Project + hierarchy + referral relationship for the collection flow.
  insert into public.apn_commission_projects (id, data, updated_at)
  values (v_project, jsonb_build_object('id', v_project, 'partnerId', v_partner,
    'projectName', 'WP9 Verify Project', 'clientName', 'WP9 Client',
    'projectValue', 100000, 'commissionRate', 10, 'maximumCommission', 10000,
    'totalReceived', 0, 'totalCommissionPaid', 0, 'remainingAmount', 100000,
    'remainingCommission', 10000, 'status', 'Pending'), now());

  insert into public.apn_hierarchy_assignments (partner_id, district_head_id, status)
  values (v_partner, v_head, 'active')
  on conflict (partner_id) do update set district_head_id = excluded.district_head_id, status = 'active';

  -- Referral relationship: v_referrer referred v_partner (active).
  select code into v_code from public.apn_referral_codes where partner_id = v_referrer;
  insert into public.apn_referral_relationships (referrer_id, referred_id, referral_code, linked_by)
  values (v_referrer, v_partner, v_code, 'verify');

  -- Rate + eligibility expectations computed from the live helpers.
  v_head_rate := public.apn_commission_rate_for('district');
  perform public.vf_assert(v_head_rate is not null and v_head_rate > 0,
    'T6 fixture district rate resolved (derived from live helper)');
  v_head_amt := round(100000 * v_head_rate / 100, 2);
  v_elig_coll := public.apn_commission_eligibility_date('2026-07-31'::date);
  v_elig_ref := public.apn_commission_eligibility_date(current_date);

  -- ── T3 direct (RPC-level) gate preserved ──────────────────────────────────
  perform set_config('apn.verify.admin', 'off', true);
  perform set_config('apn.verify.super', 'off', true);
  begin
    r := public.apn_ledger_entry('wp9-gate', 'wp9-gate-src', 'revenue_collection',
      v_partner, 'partner', 1000, 10, 100, now(), '{}'::jsonb);
    raise exception 'VERIFY FAIL: T3 apn_ledger_entry should have been refused';
  exception when insufficient_privilege then null;
  end;
  perform set_config('apn.verify.admin', 'on', true);
  perform set_config('apn.verify.super', 'on', true);

  -- ── T4 freeze enforced on the owner path ──────────────────────────────────
  update public.apn_system_controls set frozen = true where id = 1;
  begin
    r := public.apn_ledger_entry_owner('wp9-freeze', 'wp9-freeze-src', 'revenue_collection',
      v_partner, 'partner', 1000, 10, 100, now(), '{}'::jsonb);
    raise exception 'VERIFY FAIL: T4 owner entry should have been frozen';
  exception when others then
    if sqlstate <> 'FZ001' then
      raise exception 'VERIFY FAIL: T4 expected FZ001, got %: %', sqlstate, SQLERRM;
    end if;
  end;
  update public.apn_system_controls set frozen = false where id = 1;

  -- ── T5 engine caps still enforced on the owner path ───────────────────────
  -- 15% secondary cap: district 30% amount on 1000 base (2% passes the rule
  -- maximum, so the SECONDARY cap must raise).
  begin
    r := public.apn_ledger_entry_owner('wp9-cap-sec', 'wp9-cap-src', 'revenue_collection',
      v_partner, 'district', 1000, 2, 300, now(), '{}'::jsonb);
    raise exception 'VERIFY FAIL: T5 secondary cap should have fired';
  exception when check_violation then null;
  end;
  -- 35% total cap: partner 40% amount on 1000 base (10% passes the maximum,
  -- so the TOTAL cap must raise).
  begin
    r := public.apn_ledger_entry_owner('wp9-cap-tot', 'wp9-tot-src', 'revenue_collection',
      v_partner, 'partner', 1000, 10, 400, now(), '{}'::jsonb);
    raise exception 'VERIFY FAIL: T5 total cap should have fired';
  exception when check_violation then null;
  end;

  -- ── T6 END-TO-END non-admin writer: the collection insert (admin flag OFF) ─
  perform set_config('apn.verify.admin', 'off', true);
  perform set_config('apn.verify.super', 'off', true);

  insert into public.apn_revenue_collections
    (id, project_id, partner_id, received_amount, commission_generated,
     incentive, received_date, commission_status, created_by, data)
  values
    (v_collection, v_project, v_partner, 100000, 10000,
     0, '2026-07-31', 'Payable', v_partner, '{}'::jsonb);

  -- partner entry (project rate 10% -> 10000 on 100000)
  select count(*) into c from public.apn_commission_ledger
  where idempotency_key = 'col:' || v_collection || ':partner';
  perform public.vf_assert(c = 1, 'T6 partner ledger entry exists');
  select * into v_row from public.apn_commission_ledger
  where idempotency_key = 'col:' || v_collection || ':partner';
  perform public.vf_assert(v_row.partner_id = v_partner and v_row.commission_type = 'partner'
    and v_row.amount = 10000 and v_row.percent = 10 and v_row.base_amount = 100000
    and v_row.source_id = v_collection and v_row.source_type = 'revenue_collection'
    and v_row.eligible_from = v_elig_coll,
    'T6 partner entry amounts/percent/eligibility correct');

  -- district entry (resolved rate -> v_head_amt)
  select count(*) into c from public.apn_commission_ledger
  where idempotency_key = 'col:' || v_collection || ':district';
  perform public.vf_assert(c = 1, 'T6 district ledger entry exists');
  select * into v_row from public.apn_commission_ledger
  where idempotency_key = 'col:' || v_collection || ':district';
  perform public.vf_assert(v_row.partner_id = v_head and v_row.commission_type = 'district'
    and v_row.amount = v_head_amt and v_row.percent = v_head_rate and v_row.eligible_from = v_elig_coll,
    'T6 district entry amounts/percent/eligibility correct');

  -- referral entry: auto-derived earning from apn_referral_collection_after_insert
  select id into v_earning_id from public.apn_referral_earnings
  where source_collection_id = v_collection;
  perform public.vf_assert(v_earning_id is not null, 'T6 referral earning auto-generated');
  select count(*) into c from public.apn_commission_ledger
  where idempotency_key = 'earn:' || v_earning_id::text;
  perform public.vf_assert(c = 1, 'T6 referral ledger entry exists');
  select * into v_row from public.apn_commission_ledger
  where idempotency_key = 'earn:' || v_earning_id::text;
  perform public.vf_assert(v_row.partner_id = v_referrer and v_row.commission_type = 'referral'
    and v_row.amount = 1000 and v_row.percent = 1 and v_row.eligible_from = v_elig_ref,
    'T6 referral entry amounts/percent/eligibility correct');

  -- exactly the deterministic entries, ZERO deferrals
  select count(*) into c from public.apn_rule_audit
  where action = 'ledger record deferred'
    and (entity_id like 'col:' || v_collection || '%' or entity_id like 'earn:' || v_earning_id || '%');
  perform public.vf_assert(c = 0, 'T6 no ledger deferrals for the flow');

  -- portal wallet: consolidated wallet refreshed by the trigger
  select earned into n from public.apn_consolidated_wallets where partner_id = v_partner;
  perform public.vf_assert(n = 10000, 'T6 consolidated wallet (partner) = 10000');
  select earned into n from public.apn_consolidated_wallets where partner_id = v_head;
  perform public.vf_assert(n = v_head_amt, 'T6 consolidated wallet (head) = head amount');
  select earned into n from public.apn_consolidated_wallets where partner_id = v_referrer;
  perform public.vf_assert(n = 1000, 'T6 consolidated wallet (referrer) = 1000');

  -- claims center: source-derived withdrawal wallets agree on the same money
  select withdrawable into n from public.apn_withdrawal_wallets
  where partner_id = v_partner and wallet_type = 'commission';
  perform public.vf_assert(n = 10000, 'T6 claims center commission wallet = 10000');
  select pending into n from public.apn_withdrawal_wallets
  where partner_id = v_referrer and wallet_type = 'referral';
  perform public.vf_assert(n = 1000, 'T6 claims center referral wallet = 1000');

  -- ── T7 idempotency: re-touch fires triggers again -> no duplicate rows ─────
  update public.apn_revenue_collections
  set received_amount = 110000, commission_generated = 11000, updated_at = now()
  where id = v_collection;
  select count(*) into c from public.apn_commission_ledger
  where source_id = v_collection and source_type = 'revenue_collection';
  perform public.vf_assert(c = 2, 'T7 re-touch creates no duplicate collection entries');
  select count(*) into c from public.apn_commission_ledger
  where idempotency_key = 'earn:' || v_earning_id::text;
  perform public.vf_assert(c = 1, 'T7 re-touch creates no duplicate referral entry');
  select count(*) into c from public.apn_rule_audit
  where action = 'ledger record deferred'
    and (entity_id like 'col:' || v_collection || '%' or entity_id like 'earn:%');
  perform public.vf_assert(c = 0, 'T7 re-touch still deferral-free');

  -- ── T8 migration markers ───────────────────────────────────────────────────
  select status = 'completed' into v_ok from public.apn_migrations
  where id = 'engine.referral-trigger';
  perform public.vf_assert(v_ok, 'T8 referral-trigger marker completed');
  select status = 'completed' into v_ok from public.apn_migrations
  where id = 'engine.withdrawal-wallets';
  perform public.vf_assert(v_ok, 'T8 withdrawal-wallets marker completed');
  select status = 'review_required' and coalesce(notes, '') like '%WP9%' into v_ok
  from public.apn_migrations where id = 'engine.crm-assignments';
  perform public.vf_assert(v_ok, 'T8 crm-assignments kept review_required with WP9 notes');

  raise notice '[verify] WP9 end-to-end flow OK';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The savepoint is released (nothing but test data and temporary helpers live
-- in it); the transaction then commits the patch artifacts and removes nothing.
-- ─────────────────────────────────────────────────────────────────────────────
rollback to savepoint apn_wp9_verify_sp;

do $$
declare
  c bigint;
begin
  if exists (select 1 from public.apn_users where id in
    ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')) then
    raise exception 'VERIFY FAIL: apn_users fixture residue after rollback';
  end if;
  if exists (select 1 from public.apn_revenue_collections where id = 'wp9-verify-collection') then
    raise exception 'VERIFY FAIL: collections residue after rollback';
  end if;
  if exists (select 1 from public.apn_commission_ledger
    where idempotency_key like 'col:wp9-%' or idempotency_key like 'wp9-%'
       or partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')) then
    raise exception 'VERIFY FAIL: ledger residue after rollback';
  end if;
  if exists (select 1 from public.apn_rule_audit where entity_id like 'col:wp9-%' or entity_id like 'wp9-%') then
    raise exception 'VERIFY FAIL: audit residue after rollback';
  end if;
  if exists (select 1 from public.apn_withdrawal_wallets where partner_id in
    ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333'))
    or exists (select 1 from public.apn_consolidated_wallets where partner_id in
    ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333'))
    or exists (select 1 from public.apn_referral_wallets where partner_id in
    ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')) then
    raise exception 'VERIFY FAIL: wallet residue after rollback';
  end if;
  select count(*) into c from public.apn_rule_sets where code = 'wp9-verify';
  if c <> 0 then
    raise exception 'VERIFY FAIL: fixture rule set residue after rollback';
  end if;
  select count(*) into c from public.apn_referral_relationships where referred_id = '11111111-1111-1111-1111-111111111111';
  if c <> 0 then
    raise exception 'VERIFY FAIL: referral relationship residue after rollback';
  end if;
  if exists (select 1 from pg_proc
    where oid in ('public.is_admin()'::regprocedure, 'public.can_finance()'::regprocedure, 'public.is_superadmin()'::regprocedure)
      and prosrc like '%apn.verify%') then
    raise exception 'VERIFY FAIL: auth helpers not restored';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apn_users_guard_trg' and tgrelid = 'public.apn_users'::regclass) then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  -- Patch artifacts committed outside the savepoint must persist
  if not exists (select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'apn_ledger_entry_owner')
    or not exists (select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'apn_ledger_record_owner') then
    raise exception 'VERIFY FAIL: owner-role ledger artifacts should persist (patch objects committed)';
  end if;
  raise notice '[verify] POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

reset request.jwt.claims;

commit;
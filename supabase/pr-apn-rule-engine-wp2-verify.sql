-- =============================================================================
-- ALLBEE — Automated verification of the APN Rule Engine WORK PACKAGE 2
-- (referral pipeline, option 1: self-referral earnings) against PRODUCTION.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session used
-- for the whole file, so BEGIN/COMMIT applies). The whole file runs inside one
-- transaction; ALL test data, triggers and helper functions are created inside
-- a single savepoint that is explicitly rolled back before commit, so this
-- file has ZERO lasting impact on business data. If any assertion fails,
-- the transaction aborts, the editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), is_admin() is
-- temporarily redefined to return true and the apn_users guard trigger is
-- temporarily dropped — all rolled back with the savepoint, restoring the
-- exact production definitions (re-asserted after the rollback).
--
-- Idempotent: this file only reads state + creates/rolls back test data; a
-- second run is identical and harmless. Safe to keep in the repo.
--
-- Prerequisites: WP1 (pr-apn-rule-engine-foundation.sql), the commission
-- engine v4 (apn-commission-engine-v4.sql) and the referral engine pr2
-- (apn-referral-engine-pr2.sql) must already be applied.
-- =============================================================================

begin;

savepoint apn_rule_wp2_verify_sp;

-- Temporary test scaffolding (removed by the savepoint rollback below).
create or replace function public.vf_assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'VERIFY FAIL: %', msg;
  end if;
end $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select true;
$$;

drop trigger if exists apn_users_guard_trg on public.apn_users;

do $$
declare
  r jsonb;
  c bigint;
  n numeric;
  v_pct numeric;
  v_wp numeric;
  v_code text;
  v_p1 text := 'verify-p1';
  v_p2 text := 'verify-p2';
  v_p3 text := 'verify-p3';
begin
  -- Refuse to run if the current month is finance-locked or the referral
  -- system is disabled (the wallet assertions below would fail for the
  -- wrong reason). If disabled, enable it for this run only — the savepoint
  -- rollback restores the original value.
  if exists (select 1 from public.fin_locks where period = to_char(current_date, 'YYYY-MM')) then
    raise exception 'VERIFY ABORT: finance period % is locked on production.', to_char(current_date, 'YYYY-MM');
  end if;
  update public.apn_referral_settings set enabled = true where id = 1;

  -- Idempotency guard: remove any residue a previous NON-ATOMIC run may have
  -- left behind (child-first FK order). In the normal atomic single-session
  -- execution nothing is found here, and the savepoint rollback erases
  -- everything this run creates regardless.
  delete from public.apn_referral_snapshots where earning_id in (select id from public.apn_referral_earnings where referrer_id like 'verify-%');
  delete from public.apn_referral_earnings where referrer_id like 'verify-%' or referred_id like 'verify-%' or source_collection_id like 'verify-%';
  delete from public.apn_referral_wallets where partner_id like 'verify-%';
  delete from public.apn_withdrawal_wallets where partner_id like 'verify-%';
  delete from public.apn_referral_withdrawals where partner_id like 'verify-%';
  delete from public.apn_referral_timeline where partner_id like 'verify-%';
  delete from public.apn_referral_activities where partner_id like 'verify-%';
  delete from public.apn_referral_relationships where referrer_id like 'verify-%' or referred_id like 'verify-%';
  delete from public.apn_referral_codes where partner_id like 'verify-%' or code like 'verify-%';
  delete from public.apn_revenue_collections where id like 'verify-%' or partner_id like 'verify-%';
  delete from public.apn_users where id like 'verify-%';

  -- Test partners: p1 unlinked, p2 linked to referrer p3.
  insert into public.apn_users (id, data, updated_at) values
    (v_p1, jsonb_build_object('id', v_p1, 'status', 'active', 'name', 'Verify Partner One', 'role', 'partner'), now()),
    (v_p2, jsonb_build_object('id', v_p2, 'status', 'active', 'name', 'Verify Partner Two', 'role', 'partner'), now()),
    (v_p3, jsonb_build_object('id', v_p3, 'status', 'active', 'name', 'Verify Partner Three', 'role', 'partner'), now());

  -- Referral code + active relationship p3 → p2. New users already receive a
  -- code automatically (apn_referral_identity_trg → apn_referral_ensure_code),
  -- so we reuse the idempotent ensure function instead of inserting directly.
  v_code := public.apn_referral_ensure_code(v_p3);
  perform public.vf_assert(v_code is not null and v_code <> '', 'T0 referral code ensured');
  insert into public.apn_referral_relationships (referrer_id, referred_id, referral_code, linked_by)
  values (v_p3, v_p2, v_code, 'verify');

  -- ── T1 catalog: function exists + grants ────────────────────────────────────
  perform public.vf_assert(to_regprocedure('public.apn_engine_record_partner_earning(text,text,numeric)') is not null,
    'T1 function exists');
  perform public.vf_assert(has_function_privilege('authenticated', 'public.apn_engine_record_partner_earning(text,text,numeric)', 'EXECUTE'),
    'T1 authenticated can execute');
  perform public.vf_assert(has_function_privilege('anon', 'public.apn_engine_record_partner_earning(text,text,numeric)', 'EXECUTE') = false,
    'T1 anon cannot execute');
  perform public.vf_assert(has_function_privilege('public', 'public.apn_engine_record_partner_earning(text,text,numeric)', 'EXECUTE') = false,
    'T1 public cannot execute');
  raise notice '[verify] 01 function + grants OK';

  -- ── T2 unlinked partner: explicit percent, wallet impact, idempotency ──────
  insert into public.apn_revenue_collections (id, project_id, partner_id, received_amount, commission_generated, commission_status, created_by)
  values ('verify-col-1', 'verify-proj', v_p1, 1000, 100, 'Pending', 'verify');

  r := public.apn_engine_record_partner_earning(v_p1, 'verify-col-1', 2);
  perform public.vf_assert(coalesce((r->>'inserted')::boolean, false), 'T2 first call inserted');
  perform public.vf_assert((r->>'reason') = 'recorded', 'T2 reason recorded');
  perform public.vf_assert((r->>'amount')::numeric = 20, 'T2 amount = 1000 * 2% = 20');
  select count(*) into c from public.apn_referral_earnings
  where source_collection_id = 'verify-col-1';
  perform public.vf_assert(c = 1, 'T2 exactly one earning for col-1');
  select count(*) into c from public.apn_referral_earnings
  where source_collection_id = 'verify-col-1' and referrer_id = v_p1 and referred_id = v_p1
    and relationship_id is null and status = 'pending'
    and referral_percent = 2 and referral_amount = 20 and revenue_amount = 1000
    and (snapshot->>'selfEarning')::boolean and (snapshot->>'source') = 'rule-engine';
  perform public.vf_assert(c = 1, 'T2 self-earning row shape correct');
  select pending into v_wp from public.apn_referral_wallets where partner_id = v_p1;
  perform public.vf_assert(v_wp = 20, 'T2 referral wallet pending = 20 (wallet impact)');
  select pending into v_wp from public.apn_withdrawal_source_totals(v_p1, 'referral');
  perform public.vf_assert(v_wp = 20, 'T2 withdrawal referral source pending = 20');

  r := public.apn_engine_record_partner_earning(v_p1, 'verify-col-1', 2);
  perform public.vf_assert(coalesce((r->>'inserted')::boolean, false) = false, 'T2 duplicate call skipped');
  perform public.vf_assert((r->>'reason') = 'duplicate', 'T2 duplicate reason');
  select count(*) into c from public.apn_referral_earnings where source_collection_id = 'verify-col-1';
  perform public.vf_assert(c = 1, 'T2 duplicate did not double-book');
  raise notice '[verify] 02 self-earning + wallet + idempotency OK';

  -- ── T3 default snapshot percent path ────────────────────────────────────────
  select default_percent into v_pct from public.apn_referral_settings where id = 1;
  insert into public.apn_revenue_collections (id, project_id, partner_id, received_amount, commission_generated, commission_status, created_by)
  values ('verify-col-2', 'verify-proj', v_p1, 1000, 100, 'Pending', 'verify');

  r := public.apn_engine_record_partner_earning(v_p1, 'verify-col-2');
  perform public.vf_assert(coalesce((r->>'inserted')::boolean, false), 'T3 default-percent call inserted');
  perform public.vf_assert((r->>'amount')::numeric = round(1000 * v_pct / 100, 2),
    'T3 amount uses settings default_percent');
  raise notice '[verify] 03 default percent path OK';

  -- ── T4 linked partner: skipped; referrer booked by the existing trigger ─────
  insert into public.apn_revenue_collections (id, project_id, partner_id, received_amount, commission_generated, commission_status, created_by)
  values ('verify-col-3', 'verify-proj', v_p2, 1000, 100, 'Pending', 'verify');

  r := public.apn_engine_record_partner_earning(v_p2, 'verify-col-3');
  perform public.vf_assert(coalesce((r->>'inserted')::boolean, false) = false, 'T4 linked partner skipped');
  perform public.vf_assert((r->>'reason') = 'linked', 'T4 skip reason linked');
  perform public.vf_assert(not exists (
    select 1 from public.apn_referral_earnings where referrer_id = v_p2 and source_collection_id = 'verify-col-3'
  ), 'T4 no self-earning for linked partner');
  select count(*) into c from public.apn_referral_earnings
  where source_collection_id = 'verify-col-3' and referrer_id = v_p3 and referred_id = v_p2
    and relationship_id is not null and status = 'pending'
    and referral_amount = round(1000 * v_pct / 100, 2);
  perform public.vf_assert(c = 1, 'T4 referrer earning booked by existing trigger');
  raise notice '[verify] 04 linked partner skip OK';

  -- ── T5 unknown collection is rejected ───────────────────────────────────────
  begin
    perform public.apn_engine_record_partner_earning(v_p1, 'verify-col-missing');
    raise exception 'T5 expected missing-collection rejection';
  exception
    when foreign_key_violation then
      raise notice '[verify] 05 missing collection rejected OK';
  end;

  raise notice '[verify] ALL TESTS PASSED';
end $$;

rollback to savepoint apn_rule_wp2_verify_sp;

-- ── Post-rollback restoration proof: production state is byte-identical ───────
do $$
begin
  if (select count(*) from pg_trigger where tgname = 'apn_users_guard_trg' and not tgisinternal) <> 1 then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  if (select prosrc from pg_proc where oid = 'public.is_admin()'::regprocedure) not like '%superadmin%''%admin%' then
    raise exception 'VERIFY FAIL: is_admin not restored';
  end if;
  if exists (select 1 from public.apn_users where id like 'verify-%') then
    raise exception 'VERIFY FAIL: apn_users residue after rollback';
  end if;
  if exists (select 1 from public.apn_referral_codes where code like 'verify-%') then
    raise exception 'VERIFY FAIL: referral codes residue after rollback';
  end if;
  if exists (select 1 from public.apn_referral_relationships where referred_id like 'verify-%') then
    raise exception 'VERIFY FAIL: relationships residue after rollback';
  end if;
  if exists (select 1 from public.apn_referral_earnings where referrer_id like 'verify-%') then
    raise exception 'VERIFY FAIL: earnings residue after rollback';
  end if;
  if exists (select 1 from public.apn_revenue_collections where id like 'verify-%') then
    raise exception 'VERIFY FAIL: collections residue after rollback';
  end if;
  if exists (select 1 from public.apn_referral_wallets where partner_id like 'verify-%') then
    raise exception 'VERIFY FAIL: referral wallets residue after rollback';
  end if;
  if exists (select 1 from public.apn_withdrawal_wallets where partner_id like 'verify-%') then
    raise exception 'VERIFY FAIL: withdrawal wallets residue after rollback';
  end if;
  raise notice '[verify] post-rollback restoration proof OK';
end $$;

commit;

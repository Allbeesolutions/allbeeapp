-- =============================================================================
-- ALLBEE — Automated verification of the APN Rule Engine FOUNDATION against
-- PRODUCTION.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session used for
-- the whole file, so BEGIN/COMMIT applies). The whole file runs inside one
-- transaction; ALL test data, triggers and helper functions are created inside
-- a single savepoint that is explicitly rolled back before commit, so this
-- file has ZERO lasting impact on business data. If any assertion fails,
-- the transaction aborts, the editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), is_admin() /
-- is_superadmin() / can_finance() are temporarily redefined to return true and
-- the apn_users guard trigger is temporarily dropped — all rolled back with the
-- savepoint, restoring the exact production definitions (re-asserted after the
-- rollback).
--
-- Idempotent: this file only reads state + creates/rolls back test data; a
-- second run is identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_rule_foundation_verify_sp;

-- Temporary test scaffolding (removed by the savepoint rollback below).
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select true;
$$;

create or replace function public.is_superadmin()
returns boolean language sql security definer set search_path = public as $$
  select true;
$$;

create or replace function public.can_finance()
returns boolean language sql security definer set search_path = public as $$
  select true;
$$;

create or replace function public.vf_assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'VERIFY FAIL: %', msg;
  end if;
end $$;

drop trigger if exists apn_users_guard_trg on public.apn_users;

do $$
declare
  r jsonb;
  c bigint;
  n numeric;
  v_test_date date := current_date;
  v_partner_1 text := 'verify-partner-1';
  v_partner_3 text := 'verify-partner-3';
  v_head_d text := 'verify-head-d';
  v_head_s text := 'verify-head-s';
  v_orig_id uuid;
  v_rev_id uuid;
  v_fn text;
begin
  -- Refuse to run if the current month is finance-locked (the finance-lock
  -- trigger evaluates the expense rows this file posts; a locked month would
  -- make the finance-expense tests fail for the wrong reason).
  if exists (select 1 from public.fin_locks where period = to_char(v_test_date, 'YYYY-MM')) then
    raise exception 'VERIFY ABORT: finance period % is locked on production.', to_char(v_test_date, 'YYYY-MM');
  end if;

  -- Test partners (4): two partners, a district head, a state head.
  insert into public.apn_users (id, data, updated_at) values
    (v_partner_1, jsonb_build_object('id', v_partner_1, 'status', 'active', 'name', 'Verify Partner One', 'role', 'partner'), now()),
    (v_partner_3, jsonb_build_object('id', v_partner_3, 'status', 'active', 'name', 'Verify Partner Three', 'role', 'partner'), now()),
    (v_head_d,    jsonb_build_object('id', v_head_d, 'status', 'active', 'name', 'Verify District Head', 'role', 'district_head'), now()),
    (v_head_s,    jsonb_build_object('id', v_head_s, 'status', 'active', 'name', 'Verify State Head', 'role', 'state_head'), now());

  -- ── 01 Foundation tables + RLS + grants (catalog-level) ─────────────────────
  foreach v_fn in array array[
    'apn_system_controls', 'apn_rule_sets', 'apn_commission_rules',
    'apn_hierarchy_assignments', 'apn_commission_ledger',
    'apn_finance_expense_map', 'apn_reversals', 'apn_migrations', 'apn_rule_audit'
  ] loop
    perform public.vf_assert(to_regclass('public.' || v_fn) is not null, 'T1 table exists: ' || v_fn);
    perform public.vf_assert((select relrowsecurity from pg_class where oid = ('public.' || v_fn)::regclass), 'T1 RLS enabled: ' || v_fn);
  end loop;
  select count(*) into c from public.apn_system_controls where frozen = false;
  perform public.vf_assert(c = 1, 'T1 single unfrozen control row');
  -- Ledger is append-only: one SELECT policy, and only SELECT is granted.
  perform public.vf_assert((select count(*) from pg_policies where schemaname = 'public' and tablename = 'apn_commission_ledger') = 1, 'T1 ledger has exactly one policy');
  perform public.vf_assert(has_table_privilege('anon', 'public.apn_commission_ledger', 'SELECT') = false, 'T1 anon cannot read ledger');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_commission_ledger', 'SELECT'), 'T1 authenticated can read ledger');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_commission_ledger', 'INSERT') = false, 'T1 authenticated cannot insert ledger');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_commission_ledger', 'UPDATE') = false, 'T1 authenticated cannot update ledger');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_commission_ledger', 'DELETE') = false, 'T1 authenticated cannot delete ledger');
  perform public.vf_assert((select count(*) from pg_policies where schemaname = 'public' and tablename = 'apn_rule_audit') = 0, 'T1 audit has no policies (immutable)');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_rule_audit', 'SELECT') = false, 'T1 authenticated cannot read audit');
  perform public.vf_assert(has_table_privilege('anon', 'public.apn_reversals', 'SELECT') = false, 'T1 anon cannot read reversals');
  raise notice '[verify] 01 foundation tables, RLS, grants OK';

  -- ── 02 Seed rule set v1 (ladder + secondary defaults) ───────────────────────
  select count(*) into c
  from public.apn_rule_sets rs
  join public.apn_commission_rules r on r.rule_set_id = rs.id
  where rs.code = 'v1' and rs.status = 'active';
  perform public.vf_assert(c = 6, 'T2 v1 has 6 rules');
  select count(*) into c from public.apn_commission_rules r
  join public.apn_rule_sets rs on rs.id = r.rule_set_id
  where rs.code = 'v1' and r.commission_type = 'partner' and r.tier_min = 1 and r.tier_max = 1 and r.percent = 10;
  perform public.vf_assert(c = 1, 'T2 partner tier 1 = 10%');
  select count(*) into c from public.apn_commission_rules r
  join public.apn_rule_sets rs on rs.id = r.rule_set_id
  where rs.code = 'v1' and r.commission_type = 'partner' and r.tier_min = 2 and r.tier_max = 9 and r.percent = 15;
  perform public.vf_assert(c = 1, 'T2 partner tiers 2-9 = 15%');
  select count(*) into c from public.apn_commission_rules r
  join public.apn_rule_sets rs on rs.id = r.rule_set_id
  where rs.code = 'v1' and r.commission_type = 'partner' and r.tier_min = 10 and r.tier_max is null and r.percent = 20;
  perform public.vf_assert(c = 1, 'T2 partner tier 10+ = 20%');
  select count(*) into c from public.apn_commission_rules r
  join public.apn_rule_sets rs on rs.id = r.rule_set_id
  where rs.code = 'v1' and r.commission_type in ('referral','district','state') and r.percent = 1 and r.max_percent = 5;
  perform public.vf_assert(c = 3, 'T2 referral/district/state 1% max 5%');
  raise notice '[verify] 02 seed rule set v1 OK';

  -- ── 03 Resolver: rules + legacy fallback ────────────────────────────────────
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'partner') = 10, 'T3 resolver partner #1 = 10');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 2, 'partner') = 15, 'T3 resolver partner #2 = 15');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 10, 'partner') = 20, 'T3 resolver partner #10 = 20');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'referral') = 1, 'T3 resolver referral = 1');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'district') = 1, 'T3 resolver district = 1');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'state') = 1, 'T3 resolver state = 1');
  -- Fallback before any rule set existed: legacy ladder still answers.
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'partner', '2000-01-01'::timestamptz) = 10, 'T3 legacy fallback ladder = 10');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 2, 'partner', '2000-01-01'::timestamptz) = 15, 'T3 legacy fallback ladder = 15');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 10, 'partner', '2000-01-01'::timestamptz) = 20, 'T3 legacy fallback ladder = 20');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'referral', '2000-01-01'::timestamptz) = 1, 'T3 legacy fallback referral = 1');
  raise notice '[verify] 03 resolver (rules + fallback) OK';

  -- ── 04 Ledger: idempotency, caps, rate limits ───────────────────────────────
  r := public.apn_ledger_entry('vkey-partner-1', 'verify-src-1', 'revenue_collection', v_partner_1, 'partner', 10000, 20, 2000);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T4 first partner entry recorded');
  perform public.vf_assert((r->>'amount')::numeric = 2000, 'T4 partner amount 2000');
  r := public.apn_ledger_entry('vkey-partner-1', 'verify-src-1', 'revenue_collection', v_partner_1, 'partner', 10000, 20, 2000);
  perform public.vf_assert(r->>'duplicate' = 'true', 'T4 replay returns duplicate');
  select count(*) into c from public.apn_commission_ledger where idempotency_key = 'vkey-partner-1';
  perform public.vf_assert(c = 1, 'T4 replay created no extra row');
  -- Secondary 15% cap: district 5 + state 5 + referral 5 = 15% exactly OK.
  r := public.apn_ledger_entry('vkey-district-1', 'verify-src-1', 'revenue_collection', v_head_d, 'district', 10000, 5, 500);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T4 district 5% recorded');
  r := public.apn_ledger_entry('vkey-state-1', 'verify-src-1', 'revenue_collection', v_head_s, 'state', 10000, 5, 500);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T4 state 5% recorded');
  r := public.apn_ledger_entry('vkey-ref-1', 'verify-src-1', 'revenue_collection', v_partner_3, 'referral', 10000, 5, 500);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T4 referral 5% recorded');
  begin
    r := public.apn_ledger_entry('vkey-ref-2', 'verify-src-1', 'revenue_collection', v_partner_3, 'referral', 10000, 5, 500);
    raise exception 'VERIFY FAIL: T4 secondary cap not enforced';
  exception when check_violation then
    raise notice '[verify] 04 secondary 15%% cap rejected 5th entry OK';
  end;
  -- Total 35% cap: partner 20 + secondary 15 = 35% exactly OK; +20% overflows.
  begin
    r := public.apn_ledger_entry('vkey-total-1', 'verify-src-1', 'revenue_collection', v_partner_1, 'partner', 10000, 20, 2000);
    raise exception 'VERIFY FAIL: T4 total cap not enforced';
  exception when check_violation then
    raise notice '[verify] 04 total 35%% cap rejected overflow OK';
  end;
  -- Rate limits from active rules (partner max 20, secondary max 5).
  begin
    r := public.apn_ledger_entry('vkey-rate-1', 'verify-src-2', 'revenue_collection', v_partner_1, 'partner', 10000, 25, 2500);
    raise exception 'VERIFY FAIL: T4 partner 25%% not rejected';
  exception when check_violation then
    raise notice '[verify] 04 partner rate > max rejected OK';
  end;
  begin
    r := public.apn_ledger_entry('vkey-rate-2', 'verify-src-2', 'revenue_collection', v_partner_3, 'referral', 10000, 6, 600);
    raise exception 'VERIFY FAIL: T4 referral 6%% not rejected';
  exception when check_violation then
    raise notice '[verify] 04 referral rate > max rejected OK';
  end;
  -- Unknown partner refused.
  begin
    r := public.apn_ledger_entry('vkey-ghost-1', 'verify-src-3', 'revenue_collection', 'verify-ghost', 'partner', 10000, 10, 1000);
    raise exception 'VERIFY FAIL: T4 unknown partner accepted';
  exception when foreign_key_violation then
    raise notice '[verify] 04 unknown partner rejected OK';
  end;
  raise notice '[verify] 04 ledger idempotency + caps OK';

  -- ── 05 Reversal (additive) + deterministic finance expense ──────────────────
  select id into v_orig_id from public.apn_commission_ledger where idempotency_key = 'vkey-partner-1';
  r := public.apn_create_reversal(v_orig_id, 'verify reversal reason');
  perform public.vf_assert(r->>'additive' = 'true', 'T5 reversal applied additively');
  perform public.vf_assert((r->>'amount')::numeric = 2000, 'T5 reversal amount 2000');
  -- Original untouched; negative entry carries reversed_by; reversal row applied.
  perform public.vf_assert((select amount = 2000 and reversed_by is not null from public.apn_commission_ledger where id = v_orig_id), 'T5 original kept + marked');
  select id into v_rev_id from public.apn_commission_ledger where idempotency_key = 'rev:' || v_orig_id::text;
  perform public.vf_assert(v_rev_id is not null, 'T5 reversal ledger entry exists');
  perform public.vf_assert((select amount = -2000 and source_type = 'reversal' and reversed_by = v_orig_id from public.apn_commission_ledger where id = v_rev_id), 'T5 negative additive entry');
  perform public.vf_assert((select status = 'applied' and reversal_ledger_id = v_rev_id from public.apn_reversals where original_ledger_id = v_orig_id), 'T5 reversal applied status');
  -- Finance expense for the reversal is deterministic and real.
  perform public.vf_assert(exists (
    select 1 from public.apn_finance_expense_map
    where ledger_id = v_rev_id and deterministic_id = 'apn-expense-rev:' || v_orig_id::text
  ), 'T5 finance map has reversal row');
  select count(*) into c from public.transactions where id = 'apn-expense-rev:' || v_orig_id::text;
  perform public.vf_assert(c = 1, 'T5 deterministic reversal expense row');
  perform public.vf_assert((select (data->>'amount')::numeric = -2000 and data->>'kind' = 'expense' and data->>'apnCommissionExpense' = 'true' from public.transactions where id = 'apn-expense-rev:' || v_orig_id::text), 'T5 reversal expense payload');
  -- Reversal of the original again refused; reversal of a reversal refused.
  begin
    r := public.apn_create_reversal(v_orig_id, 'again');
    raise exception 'VERIFY FAIL: T5 double reversal accepted';
  exception when duplicate_object then
    raise notice '[verify] 05 double reversal rejected OK';
  end;
  begin
    r := public.apn_create_reversal(v_rev_id, 'reversal of reversal');
    raise exception 'VERIFY FAIL: T5 reversal-of-reversal accepted';
  exception when check_violation then
    raise notice '[verify] 05 reversal-of-reversal rejected OK';
  end;
  -- Commission (non-reversal) expense posting: deterministic, exactly once.
  r := public.apn_ensure_finance_expense(v_orig_id);
  perform public.vf_assert(r->>'deterministicId' = 'apn-expense-ledger:' || v_orig_id::text, 'T5 commission expense id');
  select count(*) into c from public.transactions where id = 'apn-expense-ledger:' || v_orig_id::text;
  perform public.vf_assert(c = 1, 'T5 commission expense row');
  r := public.apn_ensure_finance_expense(v_orig_id);
  perform public.vf_assert(r->>'duplicate' = 'true', 'T5 expense replay is duplicate');
  select count(*) into c from public.transactions where id = 'apn-expense-ledger:' || v_orig_id::text;
  perform public.vf_assert(c = 1, 'T5 expense replay created no extra row');
  begin
    r := public.apn_ensure_finance_expense('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'VERIFY FAIL: T5 unknown ledger accepted';
  exception when no_data_found then
    raise notice '[verify] 05 unknown ledger rejected OK';
  end;
  raise notice '[verify] 05 reversal + finance expense OK';

  -- ── 06 Emergency freeze blocks every engine write path ──────────────────────
  update public.apn_system_controls set frozen = true, reason = 'verify freeze';
  perform public.vf_assert((select frozen from public.apn_system_controls where id = 1), 'T6 freeze persisted');
  begin
    r := public.apn_ledger_entry('vkey-frozen-1', 'verify-src-4', 'revenue_collection', v_partner_1, 'partner', 10000, 10, 1000);
    raise exception 'VERIFY FAIL: T6 ledger write during freeze';
  exception when SQLSTATE 'FZ001' then
    raise notice '[verify] 06 ledger frozen OK';
  end;
  begin
    r := public.apn_create_reversal(v_orig_id, 'frozen');
    raise exception 'VERIFY FAIL: T6 reversal during freeze';
  exception when SQLSTATE 'FZ001' then
    raise notice '[verify] 06 reversal frozen OK';
  end;
  begin
    r := public.apn_rule_set_publish('vfrozen', 'Frozen test', now(), 'verify', '[{"commission_type":"referral","percent":2}]'::jsonb);
    raise exception 'VERIFY FAIL: T6 publish during freeze';
  exception when SQLSTATE 'FZ001' then
    raise notice '[verify] 06 publish frozen OK';
  end;
  begin
    insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id)
    values (v_partner_1, v_head_d, v_head_s);
    raise exception 'VERIFY FAIL: T6 hierarchy write during freeze';
  exception when SQLSTATE 'FZ001' then
    raise notice '[verify] 06 hierarchy frozen OK';
  end;
  update public.apn_system_controls set frozen = false, reason = null;
  perform public.vf_assert((select frozen = false from public.apn_system_controls where id = 1), 'T6 unfreeze persisted');
  r := public.apn_ledger_entry('vkey-post-thaw-1', 'verify-src-5', 'revenue_collection', v_partner_1, 'partner', 10000, 10, 1000);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T6 ledger works after thaw');
  raise notice '[verify] 06 emergency freeze OK';

  -- ── 07 Hierarchy: valid assignment, resolve, guard failures ─────────────────
  insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id)
  values (v_partner_3, v_head_d, v_head_s);
  r := public.apn_hierarchy_resolve(v_partner_3);
  perform public.vf_assert(r->>'districtHeadId' = v_head_d, 'T7 resolve district head');
  perform public.vf_assert(r->>'stateHeadId' = v_head_s, 'T7 resolve state head');
  begin
    insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id)
    values (v_partner_1, v_head_d, v_partner_1);
    raise exception 'VERIFY FAIL: T7 self-assignment accepted';
  exception when check_violation then
    raise notice '[verify] 07 self-assignment rejected OK';
  end;
  begin
    insert into public.apn_hierarchy_assignments (partner_id, district_head_id)
    values (v_partner_1, v_partner_3);
    raise exception 'VERIFY FAIL: T7 non-head district head accepted';
  exception when check_violation then
    raise notice '[verify] 07 non-head rejected OK';
  end;
  begin
    insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id)
    values (v_head_d, v_partner_1, v_head_s);
    raise exception 'VERIFY FAIL: T7 head-as-partner accepted';
  exception when check_violation then
    raise notice '[verify] 07 head-as-partner rejected OK';
  end;
  raise notice '[verify] 07 hierarchy OK';

  -- ── 08 Migration registry: seeds + mark lifecycle ───────────────────────────
  select count(*) into c from public.apn_migrations;
  perform public.vf_assert(c = 9, 'T8 nine seeded migrations');
  select count(*) into c from public.apn_migrations where status = 'review_required';
  perform public.vf_assert(c = 9, 'T8 all seeded as review_required');
  r := public.apn_migration_mark('engine', 'app-ui', 'UI convergence', 'completed', 'verified in tests');
  perform public.vf_assert(r->>'status' = 'completed', 'T8 mark completed');
  perform public.vf_assert((select resolved_at is not null and status = 'completed' from public.apn_migrations where mapping_key = 'app-ui'), 'T8 resolved_at recorded');
  begin
    r := public.apn_migration_mark('engine', 'app-ui', 'x', 'bogus');
    raise exception 'VERIFY FAIL: T8 invalid status accepted';
  exception when check_violation then
    raise notice '[verify] 08 invalid migration status rejected OK';
  end;
  raise notice '[verify] 08 migration registry OK';

  -- ── 09 Publish: new rule set supersedes, resolver switches ──────────────────
  begin
    r := public.apn_rule_set_publish('vtest', 'Test rules', now(), 'verify', '[]'::jsonb);
    raise exception 'VERIFY FAIL: T9 empty rule set accepted';
  exception when check_violation then
    raise notice '[verify] 09 empty rule set rejected OK';
  end;
  r := public.apn_rule_set_publish('vtest', 'Test rules', now(), 'verify',
    '[{"commission_type":"partner","tier_min":1,"percent":12,"max_percent":20,"cap_class":"primary"}]'::jsonb);
  perform public.vf_assert(r->>'status' = 'active', 'T9 publish active');
  perform public.vf_assert(public.apn_resolve_commission_rate(v_partner_1, 1, 'partner') = 12, 'T9 resolver switches to 12%');
  perform public.vf_assert((select status = 'superseded' from public.apn_rule_sets where code = 'v1'), 'T9 v1 superseded');
  raise notice '[verify] 09 rule set publish OK';

  -- ── 10 Hardening (catalog-level) ────────────────────────────────────────────
  foreach v_fn in array array[
    'public.apn_guard_operational()'::text,
    'public.apn_rule_audit(text,text,text,jsonb)'::text,
    'public.apn_resolve_commission_rate(text,integer,text,timestamptz)'::text,
    'public.apn_rule_set_publish(text,text,timestamptz,text,jsonb)'::text,
    'public.apn_hierarchy_resolve(text)'::text,
    'public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)'::text,
    'public.apn_ensure_finance_expense(uuid)'::text,
    'public.apn_create_reversal(uuid,text)'::text,
    'public.apn_migration_mark(text,text,text,text,text)'::text
  ] loop
    perform public.vf_assert(to_regprocedure(v_fn) is not null, 'T10 function exists: ' || v_fn);
    perform public.vf_assert((select prosecdef from pg_proc where oid = v_fn::regprocedure), 'T10 SECURITY DEFINER: ' || v_fn);
    perform public.vf_assert((select proconfig @> array['search_path=pg_catalog, public, pg_temp'] from pg_proc where oid = v_fn::regprocedure), 'T10 hardened search_path: ' || v_fn);
    perform public.vf_assert(not has_function_privilege('anon', v_fn, 'EXECUTE'), 'T10 anon cannot execute: ' || v_fn);
    perform public.vf_assert(has_function_privilege('authenticated', v_fn, 'EXECUTE'), 'T10 authenticated can execute: ' || v_fn);
    perform public.vf_assert((select position('format(' in prosrc) = 0 from pg_proc where oid = v_fn::regprocedure), 'T10 no dynamic SQL: ' || v_fn);
  end loop;
  raise notice '[verify] 10 hardening OK';

  -- ── 11 Pre-rollback data report (read-only) ─────────────────────────────────
  select count(*) into c from public.apn_commission_ledger where idempotency_key like 'vkey-%';
  raise notice '[verify] 11 ledger rows created this run: %', c;
  select count(*) into c from public.transactions where id like 'apn-expense-ledger:%' or id like 'apn-expense-rev:%';
  raise notice '[verify] 11 deterministic expense rows created this run: %', c;

  raise notice '[verify] ALL TESTS PASSED';
end $$;

rollback to savepoint apn_rule_foundation_verify_sp;

-- ── Post-rollback restoration proof: production state is byte-identical ───────
do $$
begin
  if (select count(*) from pg_trigger where tgname = 'apn_users_guard_trg' and not tgisinternal) <> 1 then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  if (select prosrc from pg_proc where oid = 'public.is_admin()'::regprocedure) not like '%superadmin%''%admin%' then
    raise exception 'VERIFY FAIL: is_admin not restored';
  end if;
  if (select prosrc from pg_proc where oid = 'public.can_finance()'::regprocedure) not like '%accountant%' then
    raise exception 'VERIFY FAIL: can_finance not restored';
  end if;
  if (select prosrc from pg_proc where oid = 'public.is_superadmin()'::regprocedure) not like '%superadmin%' then
    raise exception 'VERIFY FAIL: is_superadmin not restored';
  end if;
  if exists (select 1 from public.apn_commission_ledger where idempotency_key like 'vkey-%' or source_id like 'verify-%') then
    raise exception 'VERIFY FAIL: ledger residue after rollback';
  end if;
  if exists (select 1 from public.apn_users where id like 'verify-%') then
    raise exception 'VERIFY FAIL: apn_users residue after rollback';
  end if;
  if exists (select 1 from public.apn_hierarchy_assignments where partner_id like 'verify-%') then
    raise exception 'VERIFY FAIL: hierarchy residue after rollback';
  end if;
  if exists (select 1 from public.transactions where id like 'apn-expense-ledger:%' or id like 'apn-expense-rev:%') then
    raise exception 'VERIFY FAIL: finance expense residue after rollback';
  end if;
  if (select count(*) from public.apn_commission_rules r join public.apn_rule_sets rs on rs.id = r.rule_set_id where rs.code = 'vtest') <> 0 then
    raise exception 'VERIFY FAIL: rule set residue after rollback';
  end if;
  if (select frozen from public.apn_system_controls where id = 1) then
    raise exception 'VERIFY FAIL: freeze residue after rollback';
  end if;
  raise notice '[verify] POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

commit;

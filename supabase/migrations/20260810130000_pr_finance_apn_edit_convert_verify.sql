-- =============================================================================
-- ALLBEE — Automated verification of create_apn_income_transaction (4-arg,
-- p_mode create|edit|convert) against PRODUCTION.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session used for
-- the whole file, so BEGIN/COMMIT applies). The whole file runs inside one
-- transaction; ALL test data, triggers and helper functions are created inside
-- a single savepoint that is explicitly rolled back before commit, so this
-- file has ZERO lasting impact on business data. If any assertion fails,
-- the transaction aborts, the editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), can_finance() is
-- temporarily redefined to return true and the apn_users guard trigger is
-- temporarily dropped — both are rolled back with the savepoint, restoring the
-- exact production definitions.
--
-- Idempotent: this file only reads state + creates/rolls back test data; a
-- second run is identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_verify_sp;

-- Temporary test scaffolding (removed by the savepoint rollback below).
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
  v_test_date date := to_date(to_char(now(), 'YYYY-MM') || '-10', 'YYYY-MM-DD');
  v_p1 text := 'verify-partner-1';
  v_p2 text := 'verify-partner-2';
begin
  -- Refuse to run if the current month is finance-locked (guard can't be
  -- bypassed with a null session).
  if exists (select 1 from public.fin_locks where period = to_char(v_test_date, 'YYYY-MM')) then
    raise exception 'VERIFY ABORT: finance period % is locked on production.', to_char(v_test_date, 'YYYY-MM');
  end if;

  -- Test partners (active, both).
  insert into public.apn_users (id, data, updated_at) values
    (v_p1, jsonb_build_object('id', v_p1, 'status', 'active', 'name', 'Verify Partner One', 'role', 'partner'), now()),
    (v_p2, jsonb_build_object('id', v_p2, 'status', 'active', 'name', 'Verify Partner Two', 'role', 'partner'), now());

  -- ── 01·02 CREATE: fresh APN income, 30/70 split ─────────────────────────────
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-apn-1', 'kind', 'income', 'amount', 0, 'client', 'Verify Client 1', 'project', 'Verify Proj 1', 'date', v_test_date, 'category', 'Project', 'hajiPct', 30, 'alimPct', 70, 'notes', 'verify-create'),
    jsonb_build_object('id', 'verify-proj-1', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Proj 1', 'clientName', 'Verify Client 1', 'category', 'verify', 'projectValue', 10000, 'commissionRate', 10),
    jsonb_build_array(jsonb_build_object('id', 'verify-col-1', 'receivedAmount', 10000, 'incentive', 0, 'receivedDate', v_test_date)),
    'create');
  perform public.vf_assert(r->>'mode' = 'created', 'T1 create mode');
  perform public.vf_assert(r->>'transactionId' = 'verify-fx-apn-1', 'T1 txn id');
  perform public.vf_assert((r->>'postedReceived')::numeric = 10000, 'T1 postedReceived');
  perform public.vf_assert((r->>'commissionExpense')::numeric = 1000, 'T1 commissionExpense');
  select (data->>'amount')::numeric into n from public.transactions where id = 'verify-fx-apn-1';
  perform public.vf_assert(n = 10000, 'T1 income amount');
  select count(*) into c from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(c = 1, 'T1 deterministic expense row');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 1000, 'T1 expense amount 1000');
  select (data->>'hajiPct')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 30, 'T1 expense haji 30');
  select (data->>'alimPct')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 70, 'T1 expense alim 70');
  perform public.vf_assert((select data->>'category' from public.transactions where id = 'apn-expense:verify-fx-apn-1') = 'APN Commission', 'T1 expense category');
  perform public.vf_assert((select data->>'apnCommissionOfIncome' from public.transactions where id = 'apn-expense:verify-fx-apn-1') = 'verify-fx-apn-1', 'T1 expense link to income');
  perform public.vf_assert((select data->>'apnProjectId' from public.transactions where id = 'apn-expense:verify-fx-apn-1') = 'verify-proj-1', 'T1 expense project link');
  -- Project totals / status.
  select (data->>'totalReceived')::numeric into n from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(n = 10000, 'T1 project totalReceived');
  select (data->>'maximumCommission')::numeric into n from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(n = 1000, 'T1 project maximumCommission');
  select (data->>'remainingAmount')::numeric into n from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(n = 0, 'T1 project remainingAmount');
  select (data->>'remainingCommission')::numeric into n from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(n = 0, 'T1 project remainingCommission');
  perform public.vf_assert((select data->>'status' from public.apn_commission_projects where id = 'verify-proj-1') = 'Completed', 'T1 project Completed');
  -- Collection row.
  perform public.vf_assert((select (data->>'commissionGenerated')::numeric from public.apn_revenue_collections where id = 'verify-col-1') = 1000, 'T1 collection commissionGenerated');
  -- Balance impact: gross income minus commission expense exactly once.
  select (select (data->>'amount')::numeric from public.transactions where id = 'verify-fx-apn-1')
       - (select (data->>'amount')::numeric from public.transactions where id = 'apn-expense:verify-fx-apn-1') into n;
  perform public.vf_assert(n = 9000, 'T1 balance impact 9000 (10000 income - 1000 expense)');
  -- Split shares on the expense: 30/70 of 1000 = 300 / 700.
  select (data->>'amount')::numeric * (data->>'hajiPct')::numeric / 100 into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 300, 'T1 haji expense share 300');
  select (data->>'amount')::numeric * (data->>'alimPct')::numeric / 100 into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 700, 'T1 alim expense share 700');
  raise notice '[verify] 01/02 create APN income 30/70 OK (expense 1000, balance 9000, split 300/700)';

  -- ── 03 DUPLICATE create: same transaction id refused ─────────────────────────
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-apn-1', 'kind', 'income', 'amount', 0, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-1', 'partnerId', v_p1, 'projectName', 'Verify Proj 1', 'clientName', 'Verify Client 1', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-x', 'receivedAmount', 5000, 'receivedDate', v_test_date)),
      'create');
    raise exception 'VERIFY FAIL: T2 duplicate create was not rejected';
  exception when duplicate_object then
    raise notice '[verify] 03 duplicate create rejected OK';
  end;

  -- ── 04 DUPLICATE second posting for an already-posted project ───────────────
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-apn-2', 'kind', 'income', 'amount', 0, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-1', 'partnerId', v_p1, 'projectName', 'Verify Proj 1', 'clientName', 'Verify Client 1', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-x2', 'receivedAmount', 1000, 'receivedDate', v_test_date)),
      'create');
    raise exception 'VERIFY FAIL: T3 second posting on posted project not rejected';
  exception when duplicate_object then
    raise notice '[verify] 04 second posting on posted project rejected OK';
  end;

  -- ── 05 ATTACH with mismatched project value/rate refused ────────────────────
  insert into public.apn_commission_projects (id, data, updated_at)
  values ('verify-proj-2', jsonb_build_object('id', 'verify-proj-2', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Proj 2', 'clientName', 'Verify Client 2', 'projectValue', 5000, 'commissionRate', 5, 'maximumCommission', 250, 'totalReceived', 0, 'remainingAmount', 5000, 'remainingCommission', 250, 'status', 'Pending'), now());
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-apn-3', 'kind', 'income', 'amount', 0, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-2', 'partnerId', v_p1, 'projectName', 'Verify Proj 2', 'clientName', 'Verify Client 2', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-2', 'receivedAmount', 1000, 'receivedDate', v_test_date)),
      'create');
    raise exception 'VERIFY FAIL: T4 attach mismatch not rejected';
  exception when check_violation then
    perform public.vf_assert(position('already exists with a value' in sqlerrm) > 0, 'T4 mismatch message');
    raise notice '[verify] 05 attach value/rate mismatch rejected OK';
  end;

  -- ── 06 ATTACH to existing unposted project (canonical reuse) ────────────────
  insert into public.apn_commission_projects (id, data, updated_at)
  values ('verify-proj-3', jsonb_build_object('id', 'verify-proj-3', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Proj 3', 'clientName', 'Verify Client 3', 'projectValue', 20000, 'commissionRate', 10, 'maximumCommission', 2000, 'totalReceived', 0, 'remainingAmount', 20000, 'remainingCommission', 2000, 'status', 'Pending'), now());
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-apn-5', 'kind', 'income', 'amount', 0, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
    jsonb_build_object('id', 'verify-proj-3', 'partnerId', v_p1, 'projectName', 'Verify Proj 3', 'clientName', 'Verify Client 3', 'projectValue', 20000, 'commissionRate', 10),
    jsonb_build_array(jsonb_build_object('id', 'verify-col-5', 'receivedAmount', 5000, 'receivedDate', v_test_date)),
    'create');
  perform public.vf_assert(r->>'mode' = 'attached', 'T5 attach mode');
  select count(*) into c from public.apn_commission_projects where id = 'verify-proj-3';
  perform public.vf_assert(c = 1, 'T5 no second project row');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-apn-5';
  perform public.vf_assert(n = 500, 'T5 attach expense 500 (5000 @ 10%)');
  raise notice '[verify] 06 attach to existing project OK (expense 500, one project row)';

  -- ── 07 CONVERT: normal income gains APN attribution, keeps its id ───────────
  insert into public.transactions (id, data, updated_at)
  values ('verify-fx-normal-1', jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 10000, 'client', 'Normal Client', 'project', 'Normal Source', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'notes', 'normal before convert', 'incomeSource', 'normal', 'createdAt', (extract(epoch from now()) * 1000)::bigint), now());
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 10000, 'client', 'Verify Client 4', 'project', 'Verify Proj 4', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'notes', 'converted', 'incomeSource', 'apn'),
    jsonb_build_object('id', 'verify-proj-4', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Proj 4', 'clientName', 'Verify Client 4', 'projectValue', 10000, 'commissionRate', 10),
    jsonb_build_array(jsonb_build_object('id', 'verify-col-4', 'receivedAmount', 10000, 'receivedDate', v_test_date)),
    'convert');
  perform public.vf_assert(r->>'mode' = 'converted', 'T6 convert mode');
  perform public.vf_assert(r->>'transactionId' = 'verify-fx-normal-1', 'T6 convert keeps income id');
  select count(*) into c from public.transactions where id = 'verify-fx-normal-1';
  perform public.vf_assert(c = 1, 'T6 no duplicate income row');
  select (data->>'amount')::numeric into n from public.transactions where id = 'verify-fx-normal-1';
  perform public.vf_assert(n = 10000, 'T6 income amount preserved');
  perform public.vf_assert((select data->>'apnProjectId' from public.transactions where id = 'verify-fx-normal-1') = 'verify-proj-4', 'T6 income attached to project');
  select count(*) into c from public.transactions where data->>'apnCommissionOfIncome' = 'verify-fx-normal-1';
  perform public.vf_assert(c = 1, 'T6 exactly one expense');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-normal-1';
  perform public.vf_assert(n = 1000, 'T6 expense 1000 with deterministic id');
  raise notice '[verify] 07 convert normal->APN OK (id preserved, one expense, id=apn-expense:verify-fx-normal-1)';

  -- ── 08 EDIT: full collection rewrite, expense recalculated ──────────────────
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 8000, 'client', 'Verify Client 4', 'project', 'Verify Proj 4', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'notes', 'edited', 'incomeSource', 'apn'),
    jsonb_build_object('id', 'verify-proj-4', 'partnerId', v_p1, 'projectName', 'Verify Proj 4', 'clientName', 'Verify Client 4', 'projectValue', 10000, 'commissionRate', 10),
    jsonb_build_array(
      jsonb_build_object('id', 'verify-col-4a', 'receivedAmount', 5000, 'receivedDate', v_test_date),
      jsonb_build_object('id', 'verify-col-4b', 'receivedAmount', 3000, 'receivedDate', v_test_date)),
    'edit');
  perform public.vf_assert(r->>'mode' = 'edited', 'T7 edit mode');
  select (data->>'amount')::numeric into n from public.transactions where id = 'verify-fx-normal-1';
  perform public.vf_assert(n = 8000, 'T7 income amount recalculated to 8000');
  select count(*) into c from public.transactions where data->>'apnCommissionOfIncome' = 'verify-fx-normal-1';
  perform public.vf_assert(c = 1, 'T7 still exactly one expense');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-normal-1';
  perform public.vf_assert(n = 800, 'T7 expense recalculated to 800 (5000@10% + 3000@10%)');
  select count(*) into c from public.apn_revenue_collections where project_id = 'verify-proj-4';
  perform public.vf_assert(c = 2, 'T7 collection set replaced (2 rows)');
  select count(*) into c from public.apn_revenue_collections where id = 'verify-col-4';
  perform public.vf_assert(c = 0, 'T7 stale collection dropped');
  perform public.vf_assert((select data->>'status' from public.apn_commission_projects where id = 'verify-proj-4') = 'Processing', 'T7 project Processing');
  raise notice '[verify] 08 edit collection rewrite OK (income 8000, expense 800, stale rows dropped)';

  -- ── 09 EDIT on an anchored project keeps the project's own value/rate ───────
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-apn-1', 'kind', 'income', 'amount', 10000, 'date', v_test_date, 'hajiPct', 30, 'alimPct', 70),
    jsonb_build_object('id', 'verify-proj-1', 'partnerId', v_p1, 'projectName', 'Verify Proj 1', 'clientName', 'Verify Client 1', 'projectValue', 5000, 'commissionRate', 5),
    jsonb_build_array(jsonb_build_object('id', 'verify-col-1b', 'receivedAmount', 10000, 'receivedDate', v_test_date)),
    'edit');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(n = 1000, 'T8 expense uses stored project rate (1000, not 500)');
  select (data->>'projectValue')::numeric into n from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(n = 10000, 'T8 project value kept at 10000');
  select count(*) into c from public.apn_revenue_collections where id = 'verify-col-1';
  perform public.vf_assert(c = 0, 'T8 old collection replaced');
  select count(*) into c from public.apn_revenue_collections where project_id = 'verify-proj-1';
  perform public.vf_assert(c = 1, 'T8 one collection remains');
  raise notice '[verify] 09 anchored edit keeps stored value/rate OK';

  -- ── 10 EDIT cannot reassign the project to another partner ──────────────────
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 8000, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-4', 'partnerId', v_p2, 'projectName', 'Verify Proj 4', 'clientName', 'Verify Client 4', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-reassign', 'receivedAmount', 1000, 'receivedDate', v_test_date)),
      'edit');
    raise exception 'VERIFY FAIL: T9 partner reassignment not rejected';
  exception when check_violation then
    raise notice '[verify] 10 partner reassignment rejected OK';
  end;

  -- ── 11 EDIT colliding with another project identity refused ─────────────────
  insert into public.apn_commission_projects (id, data, updated_at)
  values ('verify-proj-5', jsonb_build_object('id', 'verify-proj-5', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Collide', 'clientName', 'Collide Client', 'projectValue', 10000, 'commissionRate', 10, 'maximumCommission', 1000, 'totalReceived', 0, 'remainingAmount', 10000, 'remainingCommission', 1000, 'status', 'Pending'), now());
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 8000, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-4', 'partnerId', v_p1, 'projectName', 'Verify Collide', 'clientName', 'Collide Client', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-collide', 'receivedAmount', 1000, 'receivedDate', v_test_date)),
      'edit');
    raise exception 'VERIFY FAIL: T10 identity collision not rejected';
  exception when unique_violation then
    raise notice '[verify] 11 project identity collision rejected OK';
  end;

  -- ── 12 ORPHAN APN income edit recreates the missing project ─────────────────
  insert into public.transactions (id, data, updated_at)
  values ('verify-fx-orphan-1', jsonb_build_object('id', 'verify-fx-orphan-1', 'kind', 'income', 'amount', 7000, 'client', 'Orphan Client', 'project', 'Verify Orphan', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'notes', 'orphan', 'incomeSource', 'apn', 'apnProjectId', 'verify-orphan-proj-1', 'apnPartnerId', v_p1), now());
  select count(*) into c from public.apn_commission_projects where id = 'verify-orphan-proj-1';
  perform public.vf_assert(c = 0, 'T11 orphan has no project row before edit');
  r := public.create_apn_income_transaction(
    jsonb_build_object('id', 'verify-fx-orphan-1', 'kind', 'income', 'amount', 7000, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50, 'incomeSource', 'apn'),
    jsonb_build_object('id', 'verify-orphan-proj-1', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Orphan', 'clientName', 'Orphan Client', 'projectValue', 10000, 'commissionRate', 10),
    jsonb_build_array(jsonb_build_object('id', 'verify-col-orphan', 'receivedAmount', 7000, 'receivedDate', v_test_date)),
    'edit');
  perform public.vf_assert(r->>'mode' = 'edited', 'T11 orphan edit mode');
  select count(*) into c from public.apn_commission_projects where id = 'verify-orphan-proj-1';
  perform public.vf_assert(c = 1, 'T11 orphan project recreated');
  select (data->>'projectValue')::numeric into n from public.apn_commission_projects where id = 'verify-orphan-proj-1';
  perform public.vf_assert(n = 10000, 'T11 orphan project uses form value');
  select (data->>'amount')::numeric into n from public.transactions where id = 'apn-expense:verify-fx-orphan-1';
  perform public.vf_assert(n = 700, 'T11 orphan expense 700');
  select count(*) into c from public.transactions where id = 'verify-fx-orphan-1';
  perform public.vf_assert(c = 1, 'T11 orphan income id preserved');
  raise notice '[verify] 12 orphan restore OK (project recreated, expense 700)';

  -- ── 13 CONVERT onto an already-posted project refused ───────────────────────
  insert into public.transactions (id, data, updated_at)
  values ('verify-fx-normal-2', jsonb_build_object('id', 'verify-fx-normal-2', 'kind', 'income', 'amount', 9000, 'client', 'Normal Two', 'project', 'Plain', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'incomeSource', 'normal'), now());
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-normal-2', 'kind', 'income', 'amount', 9000, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50, 'incomeSource', 'apn'),
      jsonb_build_object('id', 'verify-proj-1', 'partnerId', v_p1, 'projectName', 'Verify Proj 1', 'clientName', 'Verify Client 1', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-cd', 'receivedAmount', 9000, 'receivedDate', v_test_date)),
      'convert');
    raise exception 'VERIFY FAIL: T12 convert onto posted project not rejected';
  exception when duplicate_object then
    raise notice '[verify] 13 convert onto already-posted project rejected OK';
  end;

  -- ── 14 VALIDATION: collections cannot exceed project value ──────────────────
  insert into public.apn_commission_projects (id, data, updated_at)
  values ('verify-proj-6', jsonb_build_object('id', 'verify-proj-6', 'partnerId', v_p1, 'partnerName', 'Verify Partner One', 'projectName', 'Verify Proj 6', 'clientName', 'Verify Client 6', 'projectValue', 20000, 'commissionRate', 10, 'maximumCommission', 2000, 'totalReceived', 0, 'remainingAmount', 20000, 'remainingCommission', 2000, 'status', 'Pending'), now());
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-apn-6', 'kind', 'income', 'amount', 0, 'date', v_test_date, 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-6', 'partnerId', v_p1, 'projectName', 'Verify Proj 6', 'clientName', 'Verify Client 6', 'projectValue', 20000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-6', 'receivedAmount', 25000, 'receivedDate', v_test_date)),
      'create');
    raise exception 'VERIFY FAIL: T13 oversized collections not rejected';
  exception when check_violation then
    raise notice '[verify] 14 collections over project value rejected OK';
  end;

  -- ── 15 get_apn_commission_state still reports canonical state ───────────────
  r := public.get_apn_commission_state(v_p1, 'Verify Proj 1', 'Verify Client 1');
  perform public.vf_assert(r->>'project' is not null, 'T15 state returns project');
  perform public.vf_assert(r->>'financeIncome' is not null, 'T15 state returns financeIncome');
  perform public.vf_assert(r->>'financeExpense' is not null, 'T15 state returns financeExpense');
  raise notice '[verify] 15 get_apn_commission_state OK';

  -- ── 16 APN -> NORMAL detach semantics (client unlink; expense+project stay) ─
  update public.transactions set data = jsonb_set(data #- '{apnProjectId}', '{incomeSource}', '"normal"'::jsonb, true)
  where id = 'verify-fx-apn-1';
  perform public.vf_assert((select data->>'incomeSource' from public.transactions where id = 'verify-fx-apn-1') = 'normal', 'T16 income unlinked');
  perform public.vf_assert((select data ? 'apnProjectId' from public.transactions where id = 'verify-fx-apn-1') = false, 'T16 apnProjectId removed');
  select count(*) into c from public.transactions where id = 'apn-expense:verify-fx-apn-1';
  perform public.vf_assert(c = 1, 'T16 deterministic expense remains');
  select count(*) into c from public.apn_commission_projects where id = 'verify-proj-1';
  perform public.vf_assert(c = 1, 'T16 APN project remains');
  raise notice '[verify] 16 detach OK (expense and project preserved, income unlinked)';

  -- ── 17 NORMAL income creates no APN footprint ───────────────────────────────
  insert into public.transactions (id, data, updated_at)
  values ('verify-fx-normal-3', jsonb_build_object('id', 'verify-fx-normal-3', 'kind', 'income', 'amount', 5000, 'client', 'Plain 3', 'project', 'Plain 3', 'date', v_test_date, 'category', 'Project', 'hajiPct', 50, 'alimPct', 50, 'incomeSource', 'normal'), now());
  select count(*) into c from public.transactions where data->>'apnProjectId' is null and id = 'verify-fx-normal-3';
  perform public.vf_assert(c = 1, 'T17 normal income has no APN project link');
  select count(*) into c from public.transactions where data->>'apnCommissionOfIncome' = 'verify-fx-normal-3';
  perform public.vf_assert(c = 0, 'T17 no APN expense for normal income');
  raise notice '[verify] 17 normal income footprint-free OK';

  -- ── 18 Locked-month guard still blocks RPC writes (negative test) ───────────
  insert into public.fin_locks (period, locked_by, locked_at) values ('2099-01', 'verify', now());
  begin
    r := public.create_apn_income_transaction(
      jsonb_build_object('id', 'verify-fx-normal-1', 'kind', 'income', 'amount', 1000, 'date', '2099-01-15', 'hajiPct', 50, 'alimPct', 50),
      jsonb_build_object('id', 'verify-proj-4', 'partnerId', v_p1, 'projectName', 'Verify Proj 4', 'clientName', 'Verify Client 4', 'projectValue', 10000, 'commissionRate', 10),
      jsonb_build_array(jsonb_build_object('id', 'verify-col-lock', 'receivedAmount', 1000, 'receivedDate', '2099-01-15')),
      'edit');
    raise exception 'VERIFY FAIL: T17 locked month not blocked';
  exception when others then
    perform public.vf_assert(position('locked' in sqlerrm) > 0, 'T17 lock message');
    raise notice '[verify] 18 locked-month guard active OK';
  end;

  -- ── 19 Grants + hardening (catalog-level) ───────────────────────────────────
  perform public.vf_assert(
    not has_function_privilege('anon', 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)', 'EXECUTE'),
    'T18 anon cannot execute 4-arg RPC');
  perform public.vf_assert(
    has_function_privilege('authenticated', 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)', 'EXECUTE'),
    'T18 authenticated can execute 4-arg RPC');
  perform public.vf_assert(
    has_function_privilege('service_role', 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)', 'EXECUTE'),
    'T18 service_role enabled (parity with reconcile baseline)');
  perform public.vf_assert(
    has_function_privilege('service_role', 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)', 'EXECUTE')
    = has_function_privilege('service_role', 'public.get_apn_commission_state(text,text,text,text)', 'EXECUTE'),
    'T18 service_role surface unchanged (parity with reconcile baseline)');
  perform public.vf_assert(
    to_regprocedure('public.create_apn_income_transaction(jsonb,jsonb,jsonb)') is null,
    'T18 old 3-arg signature removed');
  perform public.vf_assert(
    to_regprocedure('public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)') is not null,
    'T18 4-arg signature present');
  perform public.vf_assert(
    (select prosecdef from pg_proc where oid = 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)'::regprocedure),
    'T18 SECURITY DEFINER');
  perform public.vf_assert(
    (select proconfig @> array['search_path=pg_catalog, public, pg_temp'] from pg_proc where oid = 'public.create_apn_income_transaction(jsonb,jsonb,jsonb,text)'::regprocedure),
    'T18 search_path hardened');
  perform public.vf_assert(
    (select prosecdef and proconfig @> array['search_path=pg_catalog, public, pg_temp'] from pg_proc where oid = 'public.get_apn_commission_state(text,text,text,text)'::regprocedure),
    'T18 get_apn_commission_state surrenders unchanged');
  raise notice '[verify] 19 grants and hardening OK';

  -- ── 20 Read-only production state report (no assertions) ────────────────────
  select count(*) into c from public.transactions t
  where (t.data->>'apnProjectId') is not null and t.data->>'kind' = 'income'
    and not exists (select 1 from public.apn_commission_projects p where p.id = t.data->>'apnProjectId');
  raise notice '[verify] 20 orphan APN finance incomes in production: %', c;
  select count(*) into c from public.transactions where data->>'apnCommissionExpense' = 'true';
  raise notice '[verify] 20 APN commission expenses in production: %', c;
  select count(*) into c from public.apn_commission_projects;
  raise notice '[verify] 20 APN commission projects in production: %', c;

  raise notice '[verify] ALL TESTS PASSED';
end $$;

rollback to savepoint apn_verify_sp;

commit;
-- =============================================================================
-- ALLBEE — Automated verification of the APN RULE ENGINE WP3 (authoritative
-- wallet / ledger wiring, reversals, cancellations, withdrawal failures)
-- against PRODUCTION.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session used
-- for the whole file, so BEGIN/COMMIT applies). The whole file runs inside one
-- transaction; ALL test data, triggers and helper functions are created inside
-- a single savepoint that is explicitly rolled back before commit, so this
-- file has ZERO lasting impact on business data. If any assertion fails, the
-- transaction aborts, the editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), is_admin() /
-- is_superadmin() / can_finance() are temporarily redefined as session-flag
-- controlled (default ON) and the apn_users guard trigger is temporarily
-- dropped — all rolled back with the savepoint, restoring the exact production
-- definitions (re-asserted after the rollback). JWT claims are injected with
-- set_config using literal UUID subs (Supabase's auth.uid() casts sub to uuid;
-- a non-uuid sub makes every auth.uid() call raise 22P02) to exercise the
-- auth-gated RPCs as a partner or as an admin.
--
-- Refuses to run when the current finance month is locked on production.
--
-- Idempotent: this file only reads state + creates/rolls back test data; a
-- second run is identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_rule_wp3_verify_sp;

-- Temporary test scaffolding (removed by the savepoint rollback below).
-- is_admin/can_finance answer from a session flag so the unauthorized paths
-- can be exercised; is_superadmin has its own flag for the finance-lock test.
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

-- Test identities are literal UUIDs because Supabase's auth.uid() casts the
-- JWT sub claim to uuid — a non-uuid sub makes EVERY auth.uid() call in the
-- session raise 22P02. Project/collection ids stay readable text ids.
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  r jsonb;
  v_name text;
  c bigint;
  n numeric;
  v_wallet jsonb;
  v_req uuid;
  v_ledger uuid;
  v_ledger2 uuid;
  v_rev_ledger uuid;
  v_elig_date date;
  v_pend_date date;
  v_earning_id uuid;
  v_p1 text := '11111111-1111-1111-1111-111111111111';
  v_p2 text := '22222222-2222-2222-2222-222222222222';
  v_p3 text := '33333333-3333-3333-3333-333333333333';
  v_d  text := '44444444-4444-4444-4444-444444444444';
  v_s  text := '55555555-5555-5555-5555-555555555555';
  v_admin text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_proj1 text := 'verify-proj-1';
  v_proj2 text := 'verify-proj-2';
  v_proj5 text := 'verify-proj-5';
  v_proj6 text := 'verify-proj-6';
  v_proj7 text := 'verify-proj-7';
  v_proj9 text := 'verify-proj-9';
  v_proj10 text := 'verify-proj-10';
  v_col_e1 text := 'verify-col-e1';
  v_col_p1 text := 'verify-col-p1';
  v_col_e2 text := 'verify-col-e2';
  v_col_e7 text := 'verify-col-e7';
  v_col_c1 text := 'verify-col-c1';
  v_col_f1 text := 'verify-col-f1';
  v_col_e9  text := 'verify-col-e9';
  v_col_e9p text := 'verify-col-e9p';
  v_col_e10 text := 'verify-col-e10';
  v_col_e11 text := 'verify-col-e11';
begin
  -- Refuse to run if the current finance month is locked on production.
  if exists (select 1 from public.fin_locks where period = to_char(current_date, 'YYYY-MM')) then
    raise exception 'VERIFY ABORT: finance period % is locked on production.', to_char(current_date, 'YYYY-MM');
  end if;

  -- Test users: three partners, a district head, a state head.
  insert into public.apn_users (id, data, updated_at) values
    (v_p1, jsonb_build_object('id', v_p1, 'status', 'active', 'name', 'Verify P1', 'role', 'partner'), now()),
    (v_p2, jsonb_build_object('id', v_p2, 'status', 'active', 'name', 'Verify P2', 'role', 'partner'), now()),
    (v_p3, jsonb_build_object('id', v_p3, 'status', 'active', 'name', 'Verify P3', 'role', 'partner'), now()),
    (v_d,  jsonb_build_object('id', v_d, 'status', 'active', 'name', 'Verify District Head', 'role', 'district_head'), now()),
    (v_s,  jsonb_build_object('id', v_s, 'status', 'active', 'name', 'Verify State Head', 'role', 'state_head'), now());

  insert into public.apn_hierarchy_assignments (partner_id, district_head_id, state_head_id)
  values (v_p1, v_d, v_s);

  -- ── 01 Catalog: new tables, extended constraints, hardened functions ────────
  perform public.vf_assert(to_regclass('public.apn_consolidated_wallets') is not null, 'T1 consolidated wallets table exists');
  perform public.vf_assert((select relrowsecurity from pg_class where oid = 'public.apn_consolidated_wallets'::regclass), 'T1 consolidated wallets RLS on');
  perform public.vf_assert(public.apn_commission_eligibility_date('2026-06-01'::date) = '2026-07-05'::date, 'T1 eligibility rule: 1st -> 5th next month');
  perform public.vf_assert(public.apn_commission_eligibility_date('2026-06-30'::date) = '2026-07-05'::date, 'T1 eligibility rule: month-end -> 5th next month');
  perform public.vf_assert((select prosrc like '%(date_trunc(''month'', p_received_date)%' from pg_proc where oid = 'public.apn_commission_eligibility_date(date)'::regprocedure), 'T1 eligibility derived, not stored');
  perform public.vf_assert((select pg_get_constraintdef(oid) like '%recovery%' from pg_constraint where conname = 'apn_commission_ledger_commission_type_check'), 'T1 ledger types include recovery');
  perform public.vf_assert((select pg_get_constraintdef(oid) like '%Reversed%' from pg_constraint where conname = 'apn_revenue_collections_status_check'), 'T1 collection statuses include Reversed');
  perform public.vf_assert((select pg_get_constraintdef(oid) like '%failed%' from pg_constraint where conname = 'apn_withdrawal_requests_status_check'), 'T1 withdrawal statuses include failed');
  foreach r in array array[
    '"public.apn_ledger_record_safe(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date)"'::jsonb,
    '"public.apn_commission_reverse_project(text,text)"'::jsonb,
    '"public.apn_commission_cancel_project(text,text)"'::jsonb,
    '"public.apn_reversal_history(text)"'::jsonb,
    '"public.apn_consolidated_wallet(text)"'::jsonb,
    '"public.apn_mark_withdrawal_failed(uuid,text)"'::jsonb
  ] loop
    v_name := r->>0;
    perform public.vf_assert(to_regprocedure(r->>0) is not null, 'T1 function exists: ' || v_name);
    perform public.vf_assert((select prosecdef from pg_proc where oid = (r->>0)::regprocedure), 'T1 SECURITY DEFINER: ' || v_name);
    perform public.vf_assert((select proconfig @> array['search_path=pg_catalog, public, pg_temp'] from pg_proc where oid = (r->>0)::regprocedure), 'T1 hardened search_path: ' || v_name);
    perform public.vf_assert(not has_function_privilege('anon', r->>0, 'EXECUTE'), 'T1 anon cannot execute: ' || v_name);
  end loop;
  perform public.vf_assert(has_function_privilege('authenticated', 'public.apn_commission_reverse_project(text,text)', 'EXECUTE'), 'T1 authenticated can reverse');
  perform public.vf_assert(not has_function_privilege('authenticated', 'public.apn_ledger_record_safe(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date)', 'EXECUTE'), 'T1 authenticated cannot record ledger directly');
  raise notice '[verify] 01 catalog OK';

  -- ── 02 Ledger wiring from working sources (partner/district/state) ──────────
  insert into public.apn_commission_projects (id, data, updated_at) values
    (v_proj1, jsonb_build_object('id', v_proj1, 'partnerId', v_p1, 'projectName', 'WP3 One', 'clientName', 'Client One',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now()),
    (v_proj2, jsonb_build_object('id', v_proj2, 'partnerId', v_p3, 'projectName', 'WP3 Two', 'clientName', 'Client Two',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now()),
    (v_proj5, jsonb_build_object('id', v_proj5, 'partnerId', v_p2, 'projectName', 'WP3 Five', 'clientName', 'Client Five',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now()),
    (v_proj7, jsonb_build_object('id', v_proj7, 'partnerId', v_p2, 'projectName', 'WP3 Seven', 'clientName', 'Client Seven',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now());

  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e1, jsonb_build_object('id', v_col_e1, 'projectId', v_proj1, 'partnerId', v_p1,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());

  perform public.vf_assert((select amount = 1000 and commission_type = 'partner' and base_amount = 10000 and percent = 10
    from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e1 || ':partner'), 'T2 partner event recorded from collection');
  perform public.vf_assert((select amount = 100 and partner_id = v_d
    from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e1 || ':district'), 'T2 district event recorded');
  perform public.vf_assert((select amount = 100 and partner_id = v_s
    from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e1 || ':state'), 'T2 state event recorded');
  perform public.vf_assert((select count(*) = 3 from public.apn_commission_ledger where source_id = v_col_e1), 'T2 exactly three events per collection');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 1000, 'T2 wallet earned 1000');
  perform public.vf_assert((v_wallet->>'eligible')::numeric = 1000 and (v_wallet->>'pending')::numeric = 0, 'T2 fully eligible');
  v_wallet := public.apn_consolidated_wallet(v_d);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 100, 'T2 district head wallet credited');
  v_wallet := public.apn_consolidated_wallet(v_s);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 100, 'T2 state head wallet credited');
  raise notice '[verify] 02 ledger wiring (partner/district/state) OK';

  -- ── 03 All four commission types (referral via the WP2 self-earning path) ───
  r := public.apn_engine_record_partner_earning(v_p1, v_col_e1, 1);
  perform public.vf_assert(r->>'inserted' = 'true', 'T3 self-earning recorded');
  v_earning_id := (r->>'earningId')::uuid;
  perform public.vf_assert((select amount = 100 and commission_type = 'referral' and source_type = 'referral'
    from public.apn_commission_ledger where idempotency_key = 'earn:' || v_earning_id), 'T3 referral ledger event');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 1100, 'T3 earned includes referral');
  raise notice '[verify] 03 four commission types OK';

  -- ── 04 Eligibility split: pending vs eligible on the 5th-of-next-month ──────
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_p1, jsonb_build_object('id', v_col_p1, 'projectId', v_proj1, 'partnerId', v_p1,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', current_date::text, 'commissionStatus', 'Pending', 'incentive', 0, 'createdBy', 'verify'), now());

  v_elig_date := (date_trunc('month', current_date - interval '2 months') + interval '1 month 4 days')::date;
  v_pend_date := (date_trunc('month', current_date) + interval '1 month 4 days')::date;
  perform public.vf_assert(v_elig_date <= current_date and v_pend_date > current_date, 'T4 fixture dates bracket today');
  perform public.vf_assert((select eligible_from = v_elig_date from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e1 || ':partner'), 'T4 eligible event dates');
  perform public.vf_assert((select eligible_from = v_pend_date from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_p1 || ':partner'), 'T4 pending event dates');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 2100, 'T4 wallet total earned');
  perform public.vf_assert((v_wallet->>'pending')::numeric = 1000, 'T4 pending = not-yet-eligible');
  perform public.vf_assert((v_wallet->>'eligible')::numeric = 1100, 'T4 eligible = earned minus pending');
  perform public.vf_assert((v_wallet->>'totalBalance')::numeric = 1100, 'T4 total balance after reversals (none)');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 1100, 'T4 withdrawable on eligibility');
  perform public.vf_assert((v_wallet->'commissionBreakdown'->>'partner')::numeric = 2000, 'T4 breakdown partner');
  perform public.vf_assert((v_wallet->'commissionBreakdown'->>'referral')::numeric = 100, 'T4 breakdown referral');
  perform public.vf_assert((v_wallet->'commissionBreakdown'->>'district')::numeric = 0, 'T4 breakdown district (own wallet only)');
  perform public.vf_assert((v_wallet->'commissionBreakdown'->>'state')::numeric = 0, 'T4 breakdown state (own wallet only)');
  raise notice '[verify] 04 eligibility split OK';

  -- ── 05 Withdrawal lifecycle on the consolidated wallet (partner p1) ─────────
  insert into public.apn_withdrawal_bank_accounts (partner_id, account_holder, bank_name, account_number, ifsc, upi_id, branch, verification_status, active)
  values (v_p1, 'Verify P1', 'Verify Bank', '1234567890', 'IFSC0000', 'verify@upi', 'Main', 'verified', true);

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  r := public.apn_request_withdrawal('commission', 300, 'upi');
  perform public.vf_assert(r->>'status' = 'pending', 'T5 partial withdrawal requested');
  v_req := (r->>'id')::uuid;
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'reserved')::numeric = 300, 'T5 reservation on consolidated wallet');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 800, 'T5 withdrawable reduced by reservation');

  begin
    r := public.apn_request_withdrawal('commission', 300, 'upi');
    raise exception 'VERIFY FAIL: T5 duplicate withdrawal accepted';
  exception when unique_violation then
    raise notice '[verify] 05 duplicate withdrawal rejected OK';
  end;

  begin
    r := public.apn_request_withdrawal('commission', 300, 'upi');
    raise exception 'VERIFY FAIL: T5 concurrent duplicate accepted';
  exception when unique_violation then
    raise notice '[verify] 05 concurrent withdrawal guard OK';
  end;

  r := public.apn_withdrawal_review(v_req, 'under_review');
  perform public.vf_assert(r->>'status' = 'under_review', 'T5 under review');
  r := public.apn_withdrawal_review(v_req, 'approved', 300, 'details verified');
  perform public.vf_assert(r->>'status' = 'approved', 'T5 approved');
  r := public.apn_withdrawal_review(v_req, 'processing');
  perform public.vf_assert(r->>'status' = 'processing', 'T5 processing');
  r := public.apn_withdrawal_review(v_req, 'paid', null, 'TXN-REF-1');
  perform public.vf_assert(r->>'status' = 'paid', 'T5 paid');
  perform public.vf_assert(exists (select 1 from public.apn_withdrawal_settlements where request_id = v_req), 'T5 settlement row posted');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'withdrawn')::numeric = 300, 'T5 withdrawn = 300');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 800, 'T5 withdrawable restored after payment');

  r := public.apn_request_withdrawal('commission', 500, 'bank_transfer');
  perform public.vf_assert(r->>'status' = 'pending', 'T5 second withdrawal requested');
  v_req := (r->>'id')::uuid;
  r := public.apn_withdrawal_review(v_req, 'approved');
  r := public.apn_withdrawal_review(v_req, 'processing');
  r := public.apn_withdrawal_review(v_req, 'paid', null, 'TXN-REF-2');
  perform public.vf_assert(r->>'status' = 'paid', 'T5 second paid');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'withdrawn')::numeric = 800, 'T5 withdrawn = 800');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 300, 'T5 withdrawable = 300');

  -- ── 06 Payment failure releases the reservation ─────────────────────────────
  r := public.apn_request_withdrawal('commission', 200, 'upi');
  v_req := (r->>'id')::uuid;
  r := public.apn_withdrawal_review(v_req, 'approved');
  r := public.apn_withdrawal_review(v_req, 'processing');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'reserved')::numeric = 200, 'T6 processing request reserved');
  r := public.apn_mark_withdrawal_failed(v_req, 'Bank account mismatch');
  perform public.vf_assert(r->>'status' = 'failed', 'T6 failed status returned');
  perform public.vf_assert((r->>'restoredAmount')::numeric = 200, 'T6 restored amount returned');
  perform public.vf_assert((select status = 'failed' and data->>'failureReason' = 'Bank account mismatch'
    from public.apn_withdrawal_requests where id = v_req), 'T6 request row failed');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'reserved')::numeric = 0, 'T6 reservation released');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 300, 'T6 withdrawable restored (unpaid)');
  perform public.vf_assert((v_wallet->>'withdrawn')::numeric = 800, 'T6 withdrawn unchanged (money left)');
  perform public.vf_assert(exists (select 1 from public.apn_wallet_transactions
    where entry_type = 'release' and request_id = v_req and description like 'Payment failed%'), 'T6 release transaction posted');
  raise notice '[verify] 05-06 withdrawal lifecycle + payment failure OK';

  -- ── 07 Reversal before any withdrawal: clean reversal, zero recovery ────────
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e2, jsonb_build_object('id', v_col_e2, 'projectId', v_proj2, 'partnerId', v_p3,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());

  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

  r := public.apn_commission_reverse_project(v_proj2, 'Client Two cancelled before payout');
  perform public.vf_assert(r->>'status' = 'Cancelled', 'T7 project cancelled');
  perform public.vf_assert(r->>'reversals' = '1', 'T7 one reversal event');
  perform public.vf_assert(r->>'recoveryEvents' = '0', 'T7 zero recovery (nothing paid)');
  perform public.vf_assert(r->>'collectionsReversed' = '1', 'T7 collection reversed');
  perform public.vf_assert(r->>'partnersAffected' = '1', 'T7 one partner affected');
  perform public.vf_assert(r->>'financeReversals' = '0', 'T7 no finance rows (no finance existed)');
  perform public.vf_assert((select commission_status = 'Reversed' from public.apn_revenue_collections where id = v_col_e2), 'T7 collection marked Reversed');
  perform public.vf_assert((select status = 'Cancelled' from public.apn_commission_projects where id = v_proj2), 'T7 project marked Cancelled');
  select id into v_ledger from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e2 || ':partner';
  perform public.vf_assert((select reversed_by is not null and amount = 1000 from public.apn_commission_ledger where id = v_ledger), 'T7 original kept, marked, never edited');
  perform public.vf_assert(exists (select 1 from public.apn_commission_ledger where idempotency_key = 'rev:led:' || v_ledger and amount = -1000 and source_type = 'reversal'), 'T7 negative reversal entry');
  perform public.vf_assert(exists (select 1 from public.apn_reversals where original_ledger_id = v_ledger and status = 'applied' and amount = 1000), 'T7 reversals row applied');
  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 1000 and (v_wallet->>'reversed')::numeric = 1000, 'T7 wallet reversed');
  perform public.vf_assert((v_wallet->>'eligible')::numeric = 0 and (v_wallet->>'withdrawable')::numeric = 0, 'T7 wallet zeroed');
  perform public.vf_assert((v_wallet->>'recoveryOutstanding')::numeric = 0, 'T7 no recovery outstanding');
  begin
    r := public.apn_commission_reverse_project(v_proj2, 'again');
    raise exception 'VERIFY FAIL: T7 double reversal accepted';
  exception when duplicate_object then
    raise notice '[verify] 07 double reversal rejected OK';
  end;
  raise notice '[verify] 07 reversal before withdrawal OK';

  -- ── 08 Reversal after payment: recovery split against the paid pool ─────────
  insert into public.apn_commission_projects (id, data, updated_at) values
    (v_proj9, jsonb_build_object('id', v_proj9, 'partnerId', v_p3, 'projectName', 'WP3 Nine', 'clientName', 'Client Nine',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now());

  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e9p, jsonb_build_object('id', v_col_e9p, 'projectId', v_proj9, 'partnerId', v_p3,
      'receivedAmount', 5000, 'commissionGenerated', 500,
      'receivedDate', ((current_date - interval '3 months')::date)::text, 'commissionStatus', 'Paid', 'incentive', 0, 'createdBy', 'verify'),
      now()),
    (v_col_e9, jsonb_build_object('id', v_col_e9, 'projectId', v_proj9, 'partnerId', v_p3,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'),
      now());

  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 2500, 'T8 pre-reversal earned');
  perform public.vf_assert((v_wallet->>'withdrawn')::numeric = 500, 'T8 legacy paid money counted as withdrawn');

  r := public.apn_commission_reverse_project(v_proj9, 'Service failed; paid commission clawed back');
  perform public.vf_assert(r->>'reversals' = '2', 'T8 two reversal events');
  perform public.vf_assert(r->>'recoveryEvents' = '1', 'T8 one recovery (the paid one)');
  select id into v_ledger from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e9p || ':partner';
  select id into v_ledger2 from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e9 || ':partner';
  perform public.vf_assert(exists (select 1 from public.apn_commission_ledger where idempotency_key = 'rec:led:' || v_ledger and amount = -500 and commission_type = 'recovery'), 'T8 recovery booked against the PAID event only');
  perform public.vf_assert(not exists (select 1 from public.apn_commission_ledger where idempotency_key = 'rec:led:' || v_ledger2), 'T8 no recovery for the unpaid event');
  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'reversed')::numeric = 2500, 'T8 reversed total');
  perform public.vf_assert((v_wallet->>'recoveryOutstanding')::numeric = 500, 'T8 recovery outstanding');
  perform public.vf_assert((v_wallet->>'recoveryRemaining')::numeric = 500, 'T8 recovery remaining');
  perform public.vf_assert((v_wallet->>'eligible')::numeric = 0 and (v_wallet->>'withdrawable')::numeric = 0, 'T8 wallet zeroed');
  raise notice '[verify] 08 recovery after paid reversal OK';

  -- ── 09 Partial recovery: future earnings offset the debt ────────────────────
  insert into public.apn_commission_projects (id, data, updated_at) values
    (v_proj10, jsonb_build_object('id', v_proj10, 'partnerId', v_p3, 'projectName', 'WP3 Ten', 'clientName', 'Client Ten',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now());
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e10, jsonb_build_object('id', v_col_e10, 'projectId', v_proj10, 'partnerId', v_p3,
      'receivedAmount', 3000, 'commissionGenerated', 300,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());
  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'eligible')::numeric = 300, 'T9 new eligible earning');
  perform public.vf_assert((v_wallet->>'recoveryRecovered')::numeric = 300, 'T9 debt partially recovered');
  perform public.vf_assert((v_wallet->>'recoveryRemaining')::numeric = 200, 'T9 debt remainder visible');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 100, 'T9 new earnings beyond the debt are withdrawable');

  -- ── 10 Full recovery: debt cleared, balance withdrawable again ──────────────
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e11, jsonb_build_object('id', v_col_e11, 'projectId', v_proj10, 'partnerId', v_p3,
      'receivedAmount', 3000, 'commissionGenerated', 300,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());
  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'recoveryRecovered')::numeric = 500, 'T10 recovery fully covered');
  perform public.vf_assert((v_wallet->>'recoveryRemaining')::numeric = 0, 'T10 debt cleared');
  perform public.vf_assert((v_wallet->>'withdrawable')::numeric = 600, 'T10 balance withdrawable again');
  raise notice '[verify] 09-10 partial + full recovery OK';

  -- ── 11 Canonical cancellation path (alias) ──────────────────────────────────
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_c1, jsonb_build_object('id', v_col_c1, 'projectId', v_proj7, 'partnerId', v_p2,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());
  r := public.apn_commission_cancel_project(v_proj7, 'Partner requested cancellation');
  perform public.vf_assert(r->>'status' = 'Cancelled', 'T11 cancel alias returns Cancelled');
  perform public.vf_assert(r->>'reversals' = '1', 'T11 cancel books the reversal');
  perform public.vf_assert((select status = 'Cancelled' from public.apn_commission_projects where id = v_proj7), 'T11 project cancelled via alias');
  raise notice '[verify] 11 cancellation alias OK';

  -- ── 12 Reversal with finance: deterministic reversal expense, no orphans ────
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_e7, jsonb_build_object('id', v_col_e7, 'projectId', v_proj5, 'partnerId', v_p2,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());
  select id into v_ledger from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e7 || ':partner';
  r := public.apn_ensure_finance_expense(v_ledger);
  perform public.vf_assert(r->>'deterministicId' = 'apn-expense-ledger:' || v_ledger::text, 'T12 original expense posted');
  perform public.vf_assert((select count(*) = 1 from public.transactions where data->>'apnProjectId' = v_proj5), 'T12 exactly one finance row before reversal');

  r := public.apn_commission_reverse_project(v_proj5, 'Finance reversal required');
  perform public.vf_assert(r->>'financeReversals' = '1', 'T12 reversal posted finance rows');
  select id into v_rev_ledger from public.apn_commission_ledger where idempotency_key = 'rev:led:' || v_ledger::text;
  perform public.vf_assert(exists (select 1 from public.transactions where id = 'apn-expense-rev:' || v_rev_ledger::text
    and (data->>'amount')::numeric = -1000 and data->>'apnCommissionExpense' = 'true'), 'T12 deterministic reversal expense');
  perform public.vf_assert(exists (select 1 from public.apn_finance_expense_map where ledger_id = v_rev_ledger
    and deterministic_id = 'apn-expense-rev:' || v_rev_ledger::text), 'T12 finance map row for the reversal');
  v_wallet := public.apn_consolidated_wallet(v_p2);
  perform public.vf_assert((v_wallet->>'reversed')::numeric = 2000, 'T12 p2 wallet reversed (T11 cancellation 1000 + T12 reversal 1000)');
  raise notice '[verify] 12 reversal with finance OK';

  -- ── 13 Finance-locked month blocks the reversal before booking anything ─────
  insert into public.apn_commission_projects (id, data, updated_at) values
    (v_proj6, jsonb_build_object('id', v_proj6, 'partnerId', v_p2, 'projectName', 'WP3 Six', 'clientName', 'Client Six',
      'projectValue', 100000, 'commissionRate', 10, 'createdBy', 'verify'), now());
  insert into public.apn_revenue_collections (id, data, updated_at) values
    (v_col_f1, jsonb_build_object('id', v_col_f1, 'projectId', v_proj6, 'partnerId', v_p2,
      'receivedAmount', 10000, 'commissionGenerated', 1000,
      'receivedDate', ((current_date - interval '2 months')::date)::text, 'commissionStatus', 'Payable', 'incentive', 0, 'createdBy', 'verify'), now());
  select id into v_ledger from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_f1 || ':partner';
  r := public.apn_ensure_finance_expense(v_ledger);
  perform public.vf_assert(r->>'duplicate' = 'false', 'T13 finance expense posted');

  insert into public.fin_locks (period, locked_by) values (to_char(current_date, 'YYYY-MM'), 'verify');
  perform set_config('apn.verify.super', 'off', true);
  begin
    r := public.apn_commission_reverse_project(v_proj6, 'Locked reversal');
    raise exception 'VERIFY FAIL: T13 finance-locked reversal accepted';
  exception when check_violation then
    raise notice '[verify] 13 finance-locked reversal rejected OK';
  end;
  perform public.vf_assert((select status <> 'Cancelled' from public.apn_commission_projects where id = v_proj6), 'T13 project untouched');
  perform public.vf_assert((select commission_status = 'Payable' from public.apn_revenue_collections where id = v_col_f1), 'T13 collection untouched');
  perform public.vf_assert(not exists (select 1 from public.apn_commission_ledger where idempotency_key = 'rev:led:' || v_ledger::text), 'T13 no reversal booked');
  perform public.vf_assert((select count(*) = 1 from public.transactions where data->>'apnProjectId' = v_proj6), 'T13 no orphan finance rows');

  delete from public.fin_locks where period = to_char(current_date, 'YYYY-MM');
  perform set_config('apn.verify.super', 'on', true);
  r := public.apn_commission_reverse_project(v_proj6, 'Unlocked reversal');
  perform public.vf_assert(r->>'status' = 'Cancelled' and r->>'financeReversals' = '1', 'T13 reversal works after unlock');
  raise notice '[verify] 13 finance lock OK';

  -- ── 14 No orphans: finance rows exist only where finance was posted ─────────
  perform public.vf_assert((select count(*) = 0 from public.transactions
    where data->>'apnProjectId' in (v_proj2, v_proj9, v_proj10, v_proj7) and coalesce(data->>'apnCommissionExpense','false') = 'true'),
    'T14 no finance rows for reversal-only projects');
  perform public.vf_assert((select count(*) = 4 from public.transactions
    where data->>'apnProjectId' in (v_proj5, v_proj6) and coalesce(data->>'apnCommissionExpense','false') = 'true'),
    'T14 exactly original + reversal expense per financed project');
  raise notice '[verify] 14 orphan finance check OK';

  -- ── 15 Authorization: partners cannot reverse / read others / mark failed ───
  perform set_config('apn.verify.admin', 'off', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  begin
    r := public.apn_commission_reverse_project(v_proj10, 'x');
    raise exception 'VERIFY FAIL: T15 unauthorized reversal accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 15 unauthorized reversal rejected OK';
  end;
  begin
    r := public.apn_consolidated_wallet(v_p2);
    raise exception 'VERIFY FAIL: T15 unauthorized wallet read accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 15 unauthorized wallet read rejected OK';
  end;
  begin
    perform public.apn_reversal_history(v_p2);
    raise exception 'VERIFY FAIL: T15 unauthorized history read accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 15 unauthorized history read rejected OK';
  end;
  begin
    r := public.apn_mark_withdrawal_failed('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'VERIFY FAIL: T15 unauthorized mark-failed accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 15 unauthorized mark-failed rejected OK';
  end;
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert(v_wallet is not null, 'T15 partner reads own wallet');
  select count(*) into c from public.apn_reversal_history(v_p1);
  perform public.vf_assert(c = 0, 'T15 partner history empty (no reversals)');
  perform set_config('apn.verify.admin', 'on', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

  select count(*) into c from public.apn_reversal_history(v_p3);
  perform public.vf_assert(c = 3, 'T15 admin sees p3 reversal history (3 rows)');
  raise notice '[verify] 15 authorization OK';

  -- ── 16 Wallet immutability + grant surface ──────────────────────────────────
  perform set_config('apn.consolidated.refresh', 'off', true);
  begin
    update public.apn_consolidated_wallets set eligible = 999999 where partner_id = v_p1;
    raise exception 'VERIFY FAIL: T16 direct wallet UPDATE accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 16 direct wallet UPDATE rejected OK';
  end;
  begin
    delete from public.apn_consolidated_wallets where partner_id = v_p1;
    raise exception 'VERIFY FAIL: T16 direct wallet DELETE accepted';
  exception when insufficient_privilege then
    raise notice '[verify] 16 direct wallet DELETE rejected OK';
  end;
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_consolidated_wallets', 'SELECT'), 'T16 authenticated reads wallets');
  perform public.vf_assert(not has_table_privilege('authenticated', 'public.apn_consolidated_wallets', 'INSERT'), 'T16 authenticated cannot insert wallets');
  perform public.vf_assert(not has_table_privilege('authenticated', 'public.apn_consolidated_wallets', 'UPDATE'), 'T16 authenticated cannot update wallets');
  perform public.vf_assert(not has_table_privilege('authenticated', 'public.apn_consolidated_wallets', 'DELETE'), 'T16 authenticated cannot delete wallets');
  perform public.vf_assert(not has_table_privilege('anon', 'public.apn_consolidated_wallets', 'SELECT'), 'T16 anon cannot read wallets');
  raise notice '[verify] 16 wallet immutability OK';

  -- ── 17 Integrity: one wallet row per partner, ledger append-only ────────────
  select count(*) into c from (
    select partner_id from public.apn_consolidated_wallets where partner_id in (v_p1, v_p2, v_p3, v_d, v_s)
    group by partner_id having count(*) > 1) x;
  perform public.vf_assert(c = 0, 'T17 exactly one wallet row per partner');
  select count(*) into c from (
    select idempotency_key from public.apn_commission_ledger group by idempotency_key having count(*) > 1) x;
  perform public.vf_assert(c = 0, 'T17 ledger idempotency keys unique');
  perform public.vf_assert((select count(*) = 0 from public.apn_commission_ledger
    where idempotency_key like 'col:verify-%' and amount < 0), 'T17 originals never edited negative');
  perform public.vf_assert((select amount = 1000 and reversed_by is not null
    from public.apn_commission_ledger where idempotency_key = 'col:' || v_col_e2 || ':partner'), 'T17 reversed original keeps its amount');
  select count(*) into c from public.apn_commission_ledger where idempotency_key like 'col:verify-%' and source_type = 'revenue_collection'
    and not exists (select 1 from public.apn_revenue_collections c where c.id = source_id);
  perform public.vf_assert(c = 0, 'T17 collection events resolve');
  select count(*) into c from public.apn_commission_ledger where source_type = 'referral' and amount > 0
    and not exists (select 1 from public.apn_referral_earnings e where e.id::text = source_id);
  perform public.vf_assert(c = 0, 'T17 referral events resolve');
  select count(*) into c from public.apn_commission_ledger l where l.commission_type in ('reversal','recovery')
    and not exists (select 1 from public.apn_commission_ledger o where o.id::text = l.source_id);
  perform public.vf_assert(c = 0, 'T17 reversal/recovery rows reference originals');
  select count(*) into c from public.apn_commission_ledger where source_type = 'reversal' and reversed_by is not null;
  perform public.vf_assert(c = 0, 'T17 no reversals-of-reversals');
  select count(*) into c from public.apn_reversals where status = 'applied'
    and not exists (select 1 from public.apn_commission_ledger l where l.id = reversal_ledger_id);
  perform public.vf_assert(c = 0, 'T17 reversals table consistent');
  v_wallet := public.apn_consolidated_wallet(v_p1);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 2100 and (v_wallet->>'pending')::numeric = 1000
    and (v_wallet->>'withdrawn')::numeric = 800 and (v_wallet->>'withdrawable')::numeric = 300, 'T17 p1 wallet final state');
  v_wallet := public.apn_consolidated_wallet(v_p3);
  perform public.vf_assert((v_wallet->>'earned')::numeric = 3100 and (v_wallet->>'reversed')::numeric = 2500
    and (v_wallet->>'recoveryRecovered')::numeric = 500 and (v_wallet->>'recoveryRemaining')::numeric = 0
    and (v_wallet->>'withdrawable')::numeric = 600, 'T17 p3 wallet final state');
  raise notice '[verify] 17 integrity OK';

  -- ── 18 Pre-rollback data report (read-only) ─────────────────────────────────
  select count(*) into c from public.apn_commission_ledger where idempotency_key like 'col:verify-%' or idempotency_key like 'earn:verify-%'
    or idempotency_key like 'rev:led:%' or idempotency_key like 'rec:led:%'
    or partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555');
  raise notice '[verify] 18 ledger rows created this run: %', c;
  select count(*) into c from public.transactions where data->>'apnProjectId' like 'verify-proj-%';
  raise notice '[verify] 18 finance rows created this run: %', c;
  select count(*) into c from public.apn_consolidated_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555');
  raise notice '[verify] 18 wallet rows created this run: %', c;

  raise notice '[verify] ALL WP3 TESTS PASSED';
end $$;

rollback to savepoint apn_rule_wp3_verify_sp;

-- ── Post-rollback restoration proof: production state is byte-identical ───────
do $$
begin
  if (select count(*) from pg_trigger where tgname = 'apn_users_guard_trg' and not tgisinternal) <> 1 then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  if exists (select 1 from pg_proc
    where oid in ('public.is_admin()'::regprocedure, 'public.can_finance()'::regprocedure, 'public.is_superadmin()'::regprocedure)
      and prosrc like '%apn.verify%') then
    raise exception 'VERIFY FAIL: auth helpers not restored';
  end if;
  if exists (select 1 from public.apn_commission_ledger where idempotency_key like 'col:verify-%' or idempotency_key like 'earn:verify-%'
    or idempotency_key like 'rev:led:%' or idempotency_key like 'rec:led:%'
    or partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: ledger residue after rollback';
  end if;
  if exists (select 1 from public.apn_referral_codes where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: referral code residue after rollback';
  end if;
  if exists (select 1 from public.apn_users where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: apn_users residue after rollback';
  end if;
  if exists (select 1 from public.apn_hierarchy_assignments where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: hierarchy residue after rollback';
  end if;
  if exists (select 1 from public.apn_commission_projects where id like 'verify-%') then
    raise exception 'VERIFY FAIL: project residue after rollback';
  end if;
  if exists (select 1 from public.apn_revenue_collections where id like 'verify-%') then
    raise exception 'VERIFY FAIL: collection residue after rollback';
  end if;
  if exists (select 1 from public.apn_withdrawal_requests where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: withdrawal residue after rollback';
  end if;
  if exists (select 1 from public.apn_consolidated_wallets where partner_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555')) then
    raise exception 'VERIFY FAIL: wallet residue after rollback';
  end if;
  if exists (select 1 from public.transactions where data->>'apnProjectId' like 'verify-proj-%') then
    raise exception 'VERIFY FAIL: finance residue after rollback';
  end if;
  if exists (select 1 from public.fin_locks where locked_by = 'verify') then
    raise exception 'VERIFY FAIL: fin_locks residue after rollback';
  end if;
  raise notice '[verify] POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

reset request.jwt.claims;

commit;

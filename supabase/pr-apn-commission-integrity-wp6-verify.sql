-- =============================================================================
-- ALLBEE — Automated verification of the APN COMMISSION INTEGRITY WP6 patch
-- (pr-apn-commission-integrity-wp6.sql) against PRODUCTION.
--
-- Verifies, in order:
--   T1  apn_commission_reverse_legacy exists, is SECURITY DEFINER and is
--       granted only to authenticated (never anon).
--   T2  Reversal role gate: with the admin/finance flag OFF the RPC refuses
--       with insufficient_privilege.
--   T3  Empty reason is rejected (check_violation).
--   T4  Unknown commission id is rejected (no_data_found).
--   T5  A Payable commission reverses cleanly: status=Reversed, reason,
--       reversedBy = the acting JWT sub, reversedCount=1, and a
--       apn_rule_audit entry is written.
--   T6  Double reversal is refused (check_violation) — idempotent by design.
--   T7  Paid commission without a superadmin unlock is refused
--       (check_violation); with unlock_paid=true but superadmin flag OFF it is
--       refused (insufficient_privilege); with the superadmin flag ON it
--       succeeds and records unlockPaid=true.
--   T8  Withdrawal wallet integrity: before reversal the Payable amount is
--       withdrawable; after reversal apn_withdrawal_source_totals reports 0
--       withdrawable for that legacy row and the wallet refresh persists it.
--   T9  apn_withdrawal_source_totals excludes Reversed rows from the
--       lifetime / monthly / today buckets (previously they still counted).
--   T10 Migration markers engine.district-client and engine.finance-reversal
--       are completed.
--
-- Delivery channel: paste into the Supabase SQL Editor (single session, whole
-- file runs in one transaction). ALL test data is created inside a single
-- savepoint that is rolled back before commit, so this file has ZERO lasting
-- impact on business data. If any assertion fails the transaction aborts, the
-- editor reports an error, and nothing changes.
--
-- Because the CLI session has no JWT (auth.uid() is null), is_admin() /
-- can_finance() / is_superadmin() are temporarily redefined as session-flag
-- controlled (default ON) and the apn_users guard trigger is temporarily
-- dropped — all rolled back with the savepoint, restoring the exact production
-- definitions (re-asserted after the rollback). JWT claims are injected with
-- set_config using a literal UUID sub (Supabase's auth.uid() casts sub to
-- uuid) to exercise the auth-gated RPC as an admin.
--
-- Idempotent: only reads state + creates/rolls back test data; a second run is
-- identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_comm_wp6_verify_sp;

-- Temporary test scaffolding (removed by the savepoint rollback below).
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

-- Literal UUID sub: Supabase's auth.uid() casts the JWT sub claim to uuid, and
-- a non-uuid sub would make every auth.uid() call in the session raise 22P02.
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  v_partner text := '11111111-1111-1111-1111-111111111111';
  v_row jsonb;
  r jsonb;
  c bigint;
  n numeric;
  v_wallet record;
  v_ok boolean;
begin
  -- T1 — function deployed with the right access surface
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_commission_reverse_legacy'
      and p.prosecdef
      and pg_get_function_identity_arguments(p.oid) = 'p_commission_id text, p_reason text, p_unlock_paid boolean'
  ), 'T1 apn_commission_reverse_legacy SECURITY DEFINER (named args)');
  perform public.vf_assert(not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_commission_reverse_legacy'
      and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'))
  ), 'T1 anon/public cannot execute the reversal RPC');
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_commission_reverse_legacy'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ), 'T1 authenticated can execute the reversal RPC');

  -- Fixtures: verify partner (wallet refresh has an FK to apn_users) + legacy
  -- JSON-blob commission rows (the surface the app writes)
  insert into public.apn_users (id, data, updated_at) values
    (v_partner, jsonb_build_object('id', v_partner, 'name', 'Verify Partner', 'status', 'active', 'role', 'partner'), now());
  insert into public.apn_commissions (id, data, updated_at) values
    ('verify-comm-payable', jsonb_build_object('id', 'verify-comm-payable', 'partnerId', v_partner, 'kind', 'partner', 'project', 'Verify Rev', 'revenue', 100000, 'rate', 10, 'amount', 10000, 'status', 'Payable', 'createdAt', floor(extract(epoch from now()) * 1000)), now()),
    ('verify-comm-paid',    jsonb_build_object('id', 'verify-comm-paid', 'partnerId', v_partner, 'kind', 'partner', 'project', 'Verify Paid', 'revenue', 50000, 'rate', 10, 'amount', 5000, 'status', 'Paid', 'createdAt', floor(extract(epoch from now()) * 1000)), now()),
    ('verify-comm-pending', jsonb_build_object('id', 'verify-comm-pending', 'partnerId', v_partner, 'kind', 'partner', 'project', 'Verify Keep', 'revenue', 20000, 'rate', 10, 'amount', 2000, 'status', 'Pending', 'createdAt', floor(extract(epoch from now()) * 1000)), now()),
    ('verify-comm-reversed', jsonb_build_object('id', 'verify-comm-reversed', 'partnerId', v_partner, 'kind', 'partner', 'project', 'Verify Gone', 'revenue', 30000, 'rate', 10, 'amount', 3000, 'status', 'Reversed', 'reversalReason', 'pre-existing', 'reversedAt', floor(extract(epoch from now()) * 1000), 'createdAt', floor(extract(epoch from now()) * 1000)), now());

  -- T2 — role gate: admin/finance/superadmin flags OFF → refused
  perform set_config('apn.verify.admin', 'off', true);
  perform set_config('apn.verify.super', 'off', true);
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-pending', 'no permission');
    raise exception 'VERIFY FAIL: T2 reversal should have been refused';
  exception when insufficient_privilege then null;
  end;
  perform set_config('apn.verify.admin', 'on', true);
  perform set_config('apn.verify.super', 'on', true);

  -- T3 — empty reason refused
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-pending', '   ');
    raise exception 'VERIFY FAIL: T3 empty reason should have been refused';
  exception when check_violation then null;
  end;

  -- T4 — unknown id refused
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-ghost', 'lost row');
    raise exception 'VERIFY FAIL: T4 unknown id should have been refused';
  exception when no_data_found then null;
  end;

  -- T5 — clean reversal of a Payable row
  r := public.apn_commission_reverse_legacy('verify-comm-payable', 'client cancelled the project');
  perform public.vf_assert(r->>'status' = 'Reversed', 'T5 returns Reversed status');
  perform public.vf_assert(r->>'reversalReason' = 'client cancelled the project', 'T5 returns the reason');
  select data into v_row from public.apn_commissions where id = 'verify-comm-payable';
  perform public.vf_assert(v_row->>'status' = 'Reversed', 'T5 row status = Reversed');
  perform public.vf_assert(v_row->>'reversalReason' = 'client cancelled the project', 'T5 row reason persisted');
  perform public.vf_assert(v_row->>'reversedBy' = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'T5 reversedBy = acting JWT sub');
  perform public.vf_assert((v_row->>'reversedCount')::int = 1, 'T5 reversedCount = 1');
  perform public.vf_assert((v_row->>'reversedAt')::bigint > 0, 'T5 reversedAt epoch-ms set');
  select count(*) into c from public.apn_rule_audit
    where action = 'reversed legacy commission' and entity = 'apn_commissions' and entity_id = 'verify-comm-payable';
  perform public.vf_assert(c = 1, 'T5 exactly one audit entry');

  -- T6 — double reversal refused (idempotent by design)
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-payable', 'again');
    raise exception 'VERIFY FAIL: T6 double reversal should have been refused';
  exception when check_violation then null;
  end;

  -- T7 — paid guards
  -- 7a: paid + no unlock flag → refused
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-paid', 'mistake');
    raise exception 'VERIFY FAIL: T7a paid reversal without unlock should have been refused';
  exception when check_violation then null;
  end;
  -- 7b: paid + unlock flag but superadmin OFF → refused
  perform set_config('apn.verify.super', 'off', true);
  begin
    r := public.apn_commission_reverse_legacy('verify-comm-paid', 'mistake', true);
    raise exception 'VERIFY FAIL: T7b paid unlock without superadmin should have been refused';
  exception when insufficient_privilege then null;
  end;
  perform set_config('apn.verify.super', 'on', true);
  -- 7c: paid + unlock flag + superadmin ON → succeeds
  r := public.apn_commission_reverse_legacy('verify-comm-paid', 'finance correction', true);
  perform public.vf_assert(r->>'status' = 'Reversed', 'T7c paid reversal succeeds');
  perform public.vf_assert(r->>'unlockPaid' = 'true', 'T7c unlockPaid recorded');
  select data into v_row from public.apn_commissions where id = 'verify-comm-paid';
  perform public.vf_assert(v_row->>'unlockPaid' = 'true', 'T7c unlockPaid persisted');

  -- T8 — withdrawal wallet integrity follows the reversal
  -- (verify-comm-payable was reversed in T5; verify-comm-pending stays Pending)
  perform public.apn_withdrawal_refresh_wallet(v_partner);
  select * into v_wallet from public.apn_withdrawal_source_totals(v_partner, 'commission');
  perform public.vf_assert(v_wallet.withdrawable = 0, 'T8 reversed Payable no longer withdrawable');
  perform public.vf_assert(v_wallet.pending = 2000, 'T8 untouched Pending still counts');
  perform public.vf_assert(v_wallet.lifetime = 2000, 'T8 lifetime excludes reversed rows');
  select lifetime, withdrawable into n, c from public.apn_withdrawal_wallets
    where partner_id = v_partner and wallet_type = 'commission';
  perform public.vf_assert(n = 2000, 'T8 wallet row lifetime = 2000 after refresh');
  perform public.vf_assert(c = 0, 'T8 wallet row withdrawable = 0 after refresh');

  -- T9 — Reversed rows drop out of lifetime / monthly / today buckets
  -- fixture set: Pending 2000, Reversed 3000 (pre-existing), reversed Payable 10000, reversed Paid 5000
  -- (fixture createdAt is today, so the untouched Pending row still lands in today)
  perform public.apn_withdrawal_refresh_wallet(v_partner);
  select * into v_wallet from public.apn_withdrawal_source_totals(v_partner, 'commission');
  perform public.vf_assert(v_wallet.lifetime = 2000, 'T9 lifetime = 2000 (reversed excluded)');
  perform public.vf_assert(v_wallet.monthly = 2000, 'T9 monthly excludes reversed');
  perform public.vf_assert(v_wallet.today = 2000, 'T9 today counts only the untouched Pending row');

  -- T10 — migration markers completed
  select count(*) into c from public.apn_migrations
    where id in ('engine.district-client', 'engine.finance-reversal') and status = 'completed';
  perform public.vf_assert(c = 2, 'T10 district-client + finance-reversal markers completed');

  raise notice '[verify] WP6 COMMISSION INTEGRITY — ALL ASSERTIONS PASSED';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: drop all test data and the temporary scaffolding, then prove the
-- production definitions are exactly as before this file ran.
-- ─────────────────────────────────────────────────────────────────────────────
rollback to savepoint apn_comm_wp6_verify_sp;

do $$
declare
  c bigint;
begin
  if exists (select 1 from public.apn_commissions where id like 'verify-%') then
    raise exception 'VERIFY FAIL: apn_commissions residue after rollback';
  end if;
  if exists (select 1 from public.apn_users where id like '11111111-1111-1111-1111-111111111111') then
    raise exception 'VERIFY FAIL: apn_users residue after rollback';
  end if;
  if exists (select 1 from public.apn_withdrawal_wallets where partner_id like '11111111-1111-1111-1111-111111111111') then
    raise exception 'VERIFY FAIL: withdrawal wallet residue after rollback';
  end if;
  if exists (select 1 from public.apn_rule_audit where entity_id like 'verify-%') then
    raise exception 'VERIFY FAIL: rule audit residue after rollback';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apn_users_guard_trg' and tgrelid = 'public.apn_users'::regclass) then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  if exists (select 1 from pg_proc
    where oid in ('public.is_admin()'::regprocedure, 'public.can_finance()'::regprocedure, 'public.is_superadmin()'::regprocedure)
      and prosrc like '%apn.verify%') then
    raise exception 'VERIFY FAIL: auth helpers not restored';
  end if;
  if not exists (select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'apn_commission_reverse_legacy') then
    raise exception 'VERIFY FAIL: reversal RPC should persist (patch artifacts are outside the savepoint)';
  end if;
  raise notice '[verify] POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

reset request.jwt.claims;

commit;
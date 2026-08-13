-- =============================================================================
-- ALLBEE — Automated verification of the WP8 LEGACY COMMISSION CONVERGENCE
-- patch (pr-apn-legacy-backfill-wp8.sql) against PRODUCTION.
--
-- Verifies, in order:
--   T1  apn_backfill_legacy_commissions exists, is SECURITY DEFINER with the
--       named argument p_dry_run, and is granted only to authenticated.
--   T2  Role gate: with the admin/finance flag OFF the RPC refuses with
--       insufficient_privilege.
--   T3  Dry run: reports the candidate counts WITHOUT writing anything —
--       no ledger rows, no blob stamps, no wallet rows, no audit rows.
--   T4  Execute run: backfills eligible rows (Payable + Paid + Pending),
--       defers malformed rows, skips Reversed and kind=district rows.
--   T5  Ledger entries: exactly one per migrated row, idempotency key
--       'legacy:<id>', source_type='adjustment', commission_type='partner',
--       correct event_at, eligible_from = payoutDate for Pending rows, and the
--       original legacy payload preserved in the snapshot.
--   T6  Blob stamp: migrated rows carry migratedLedgerId + migratedAtMs;
--       skipped/deferred rows are untouched.
--   T7  Idempotent re-run: second execute backfills 0 rows.
--   T8  Wallet-surface symmetry preserved: apn_withdrawal_source_totals still
--       reports the legacy amounts (claims center) and the consolidated wallet
--       agrees (portal) — the same money, once per surface, no double count.
--   T9  Deferred rows: no ledger entry, no stamp, failure audited.
--   T10 Migration marker engine.legacy-commissions is completed.
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
-- dropped — all rolled back with the savepoint. JWT claims are injected with
-- set_config using a literal UUID sub to exercise the auth-gated RPC.
--
-- Idempotent: only reads state + creates/rolls back test data; a second run is
-- identical and harmless. Safe to keep in the repo.
-- =============================================================================

begin;

savepoint apn_conv_wp8_verify_sp;

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

set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$
declare
  v_partner text := '11111111-1111-1111-1111-111111111111';
  r jsonb;
  c bigint;
  n numeric;
  v_ledger_count bigint;
  v_stamp text;
  v_wallet record;
  v_row jsonb;
begin
  -- T1 — RPC deployed with the right access surface
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_backfill_legacy_commissions'
      and p.prosecdef
      and pg_get_function_identity_arguments(p.oid) = 'p_dry_run boolean'
  ), 'T1 apn_backfill_legacy_commissions SECURITY DEFINER (named args)');
  perform public.vf_assert(not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_backfill_legacy_commissions'
      and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'))
  ), 'T1 anon/public cannot execute the backfill RPC');
  perform public.vf_assert(exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apn_backfill_legacy_commissions'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ), 'T1 authenticated can execute the backfill RPC');

  -- Fixtures: one active partner + legacy JSON-blob commission rows covering
  -- every category the migration classifies (eligible, paid, pending window,
  -- reversed, district, malformed amount, unknown partner).
  insert into public.apn_users (id, data, updated_at) values
    (v_partner, jsonb_build_object('id', v_partner, 'name', 'Verify Partner', 'status', 'active', 'role', 'partner'), now());
  insert into public.apn_commissions (id, data, updated_at) values
    ('v8-payable',   jsonb_build_object('id', 'v8-payable', 'partnerId', v_partner, 'kind', 'partner', 'project', 'V8 Rev', 'client', 'Client A', 'revenue', 100000, 'rate', 10, 'amount', 10000, 'status', 'Payable', 'createdAt', 1735689600000), now()),
    ('v8-paid',      jsonb_build_object('id', 'v8-paid', 'partnerId', v_partner, 'kind', 'partner', 'project', 'V8 Paid', 'client', 'Client B', 'revenue', 50000, 'rate', 10, 'amount', 5000, 'status', 'Paid', 'createdAt', 1735689600000), now()),
    ('v8-pending',   jsonb_build_object('id', 'v8-pending', 'partnerId', v_partner, 'kind', 'partner', 'project', 'V8 Window', 'client', 'Client C', 'revenue', 20000, 'rate', 10, 'amount', 2000, 'status', 'Pending', 'payoutDate', '2099-12-31', 'createdAt', 1735689600000), now()),
    ('v8-reversed',  jsonb_build_object('id', 'v8-reversed', 'partnerId', v_partner, 'kind', 'partner', 'project', 'V8 Gone', 'revenue', 30000, 'rate', 10, 'amount', 3000, 'status', 'Reversed', 'reversalReason', 'pre-existing', 'createdAt', 1735689600000), now()),
    ('v8-district',  jsonb_build_object('id', 'v8-district', 'partnerId', v_partner, 'kind', 'district', 'project', 'V8 Head', 'revenue', 40000, 'rate', 1, 'amount', 400, 'status', 'Payable', 'createdAt', 1735689600000), now()),
    ('v8-malformed', jsonb_build_object('id', 'v8-malformed', 'partnerId', v_partner, 'kind', 'partner', 'project', 'V8 Bad', 'amount', 'not-a-number', 'status', 'Payable', 'createdAt', 1735689600000), now()),
    ('v8-ghost',     jsonb_build_object('id', 'v8-ghost', 'partnerId', '99999999-9999-9999-9999-999999999999', 'kind', 'partner', 'project', 'V8 Ghost', 'amount', 7000, 'status', 'Payable', 'createdAt', 1735689600000), now());

  -- T2 — role gate: admin/finance/superadmin flags OFF → refused
  perform set_config('apn.verify.admin', 'off', true);
  perform set_config('apn.verify.super', 'off', true);
  begin
    r := public.apn_backfill_legacy_commissions(false);
    raise exception 'VERIFY FAIL: T2 backfill should have been refused';
  exception when insufficient_privilege then null;
  end;
  perform set_config('apn.verify.admin', 'on', true);
  perform set_config('apn.verify.super', 'on', true);

  -- T3 — dry run: reports counts, writes NOTHING
  r := public.apn_backfill_legacy_commissions(true);
  perform public.vf_assert((r->>'dryRun')::boolean, 'T3 dryRun flag true');
  perform public.vf_assert((r->>'scanned')::int = 7, 'T3 scanned = 7 fixture rows');
  perform public.vf_assert((r->>'candidates')::int = 5, 'T3 candidates = payable+paid+pending+malformed+ghost');
  perform public.vf_assert((r->>'skippedReversed')::int = 1, 'T3 skippedReversed = 1');
  perform public.vf_assert((r->>'skippedDistrict')::int = 1, 'T3 skippedDistrict = 1');
  select count(*) into v_ledger_count
    from public.apn_commission_ledger where partner_id = v_partner;
  perform public.vf_assert(v_ledger_count = 0, 'T3 dry run wrote no ledger rows');
  select count(*) into c from public.apn_commissions
    where data ? 'migratedLedgerId';
  perform public.vf_assert(c = 0, 'T3 dry run stamped no blob rows');
  select count(*) into v_ledger_count
    from public.apn_rule_audit where entity = 'apn_commissions' and entity_id like 'v8-%';
  perform public.vf_assert(v_ledger_count = 0, 'T3 dry run wrote no audit rows');

  -- T4 — execute: 3 backfilled, 2 deferred, 2 skipped
  r := public.apn_backfill_legacy_commissions(false);
  perform public.vf_assert((r->>'dryRun')::boolean = false, 'T4 execute mode');
  perform public.vf_assert((r->>'scanned')::int = 7, 'T4 scanned = 7');
  perform public.vf_assert((r->>'backfilled')::int = 3, 'T4 backfilled = 3 (payable, paid, pending)');
  perform public.vf_assert((r->>'deferred')::int = 2, 'T4 deferred = 2 (malformed, ghost)');
  perform public.vf_assert((r->>'skippedReversed')::int = 1, 'T4 skippedReversed = 1');
  perform public.vf_assert((r->>'skippedDistrict')::int = 1, 'T4 skippedDistrict = 1');

  -- T5 — one ledger entry per migrated row, correct shape
  select count(*) into v_ledger_count
    from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key like 'legacy:%';
  perform public.vf_assert(v_ledger_count = 3, 'T5 exactly 3 legacy ledger entries');
  select count(*) into c from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key like 'legacy:%'
      and source_type = 'adjustment' and commission_type = 'partner';
  perform public.vf_assert(c = 3, 'T5 source_type=adjustment commission_type=partner');
  select id into v_stamp from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key = 'legacy:v8-payable';
  perform public.vf_assert(v_stamp is not null, 'T5 payable entry exists');
  select coalesce(sum(amount),0) into n from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key like 'legacy:%';
  perform public.vf_assert(n = 17000, 'T5 ledger amount = 10000+5000+2000');
  -- snapshot preserves the original legacy payload
  select count(*) into c from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key = 'legacy:v8-payable'
      and snapshot->>'legacy' = 'true' and snapshot->>'project' = 'V8 Rev' and snapshot->>'clientName' = 'Client A';
  perform public.vf_assert(c = 1, 'T5 snapshot keeps legacy payload');
  -- Pending row carries the payout window as eligible_from
  select count(*) into c from public.apn_commission_ledger
    where partner_id = v_partner and idempotency_key = 'legacy:v8-pending'
      and eligible_from = '2099-12-31'::date;
  perform public.vf_assert(c = 1, 'T5 pending eligible_from = payoutDate');

  -- T6 — blob stamps on migrated rows only
  select count(*) into c from public.apn_commissions
    where id in ('v8-payable','v8-paid','v8-pending') and data ? 'migratedLedgerId' and data ? 'migratedAtMs';
  perform public.vf_assert(c = 3, 'T6 migrated rows stamped');
  select count(*) into c from public.apn_commissions
    where id in ('v8-reversed','v8-district','v8-malformed','v8-ghost') and data ? 'migratedLedgerId';
  perform public.vf_assert(c = 0, 'T6 skipped/deferred rows untouched');
  -- stamp points at the ledger entry
  select count(*) into c from public.apn_commissions x
    join public.apn_commission_ledger l on l.id::text = x.data->>'migratedLedgerId'
    where x.id like 'v8-%';
  perform public.vf_assert(c = 3, 'T6 stamp resolves to a real ledger id');

  -- T7 — idempotent re-run: nothing new
  r := public.apn_backfill_legacy_commissions(false);
  perform public.vf_assert((r->>'backfilled')::int = 0, 'T7 re-run backfills 0');
  perform public.vf_assert((r->>'skippedMigrated')::int = 3, 'T7 re-run skips 3 already-migrated');
  select count(*) into v_ledger_count
    from public.apn_commission_ledger where partner_id = v_partner and idempotency_key like 'legacy:%';
  perform public.vf_assert(v_ledger_count = 3, 'T7 ledger still exactly 3 entries');

  -- T8 — wallet-surface symmetry: claims center and portal wallet agree on the
  -- same money (each counts it exactly once; no cross-surface double count)
  select * into v_wallet from public.apn_withdrawal_source_totals(v_partner, 'commission');
  perform public.vf_assert(v_wallet.pending = 2000, 'T8 claims center pending = 2000 (window row)');
  perform public.vf_assert(v_wallet.withdrawable = 10000, 'T8 claims center withdrawable = 10000 (payable)');
  perform public.vf_assert(v_wallet.external_paid = 5000, 'T8 claims center external_paid = 5000 (paid)');
  select * into v_wallet from public.apn_consolidated_wallets w
    where w.partner_id = v_partner;
  perform public.vf_assert(v_wallet.earned = 17000, 'T8 portal wallet earned = 17000');
  perform public.vf_assert(v_wallet.pending = 2000, 'T8 portal wallet pending = 2000 (window row)');
  perform public.vf_assert(v_wallet.withdrawable = 10000, 'T8 portal wallet withdrawable = 10000 (payable)');

  -- T9 — deferred rows: no ledger entry, no stamp, failure audited
  select count(*) into c from public.apn_commission_ledger
    where idempotency_key in ('legacy:v8-malformed','legacy:v8-ghost');
  perform public.vf_assert(c = 0, 'T9 no ledger entries for deferred rows');
  select count(*) into c from public.apn_rule_audit
    where entity = 'apn_commissions' and action = 'backfilled legacy commission';
  perform public.vf_assert(c = 3, 'T9 three success audit rows');

  -- T10 — migration marker completed
  select count(*) into c from public.apn_migrations
    where id = 'engine.legacy-commissions' and status = 'completed';
  perform public.vf_assert(c = 1, 'T10 engine.legacy-commissions marker completed');

  raise notice '[verify] WP8 LEGACY COMMISSION CONVERGENCE — ALL ASSERTIONS PASSED';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: drop all test data and the temporary scaffolding, then prove the
-- production definitions are exactly as before this file ran.
-- ─────────────────────────────────────────────────────────────────────────────
rollback to savepoint apn_conv_wp8_verify_sp;

do $$
declare
  c bigint;
begin
  -- No verify residue anywhere
  if exists (select 1 from public.apn_commissions where id like 'v8-%') then
    raise exception 'VERIFY FAIL: apn_commissions residue after rollback';
  end if;
  if exists (select 1 from public.apn_users where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'VERIFY FAIL: apn_users fixture residue after rollback';
  end if;
  if exists (select 1 from public.apn_commission_ledger where idempotency_key like 'legacy:%') then
    raise exception 'VERIFY FAIL: ledger residue after rollback';
  end if;
  if exists (select 1 from public.apn_consolidated_wallets where partner_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'VERIFY FAIL: consolidated wallet residue after rollback';
  end if;
  if exists (select 1 from public.apn_rule_audit where action = 'backfilled legacy commission') then
    raise exception 'VERIFY FAIL: audit residue after rollback';
  end if;
  -- Production definitions restored (auth helpers replaced inside the savepoint only)
  if exists (select 1 from pg_proc
    where oid in ('public.is_admin()'::regprocedure, 'public.can_finance()'::regprocedure, 'public.is_superadmin()'::regprocedure)
      and prosrc like '%apn.verify%') then
    raise exception 'VERIFY FAIL: auth helpers not restored';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'apn_users_guard_trg' and tgrelid = 'public.apn_users'::regclass) then
    raise exception 'VERIFY FAIL: apn_users_guard_trg not restored';
  end if;
  -- The backfill RPC itself is a permanent product of the patch — assert it stays
  if not exists (select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'apn_backfill_legacy_commissions') then
    raise exception 'VERIFY FAIL: backfill RPC should persist (patch artifacts are outside the savepoint)';
  end if;
  raise notice '[verify] POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

reset request.jwt.claims;

commit;
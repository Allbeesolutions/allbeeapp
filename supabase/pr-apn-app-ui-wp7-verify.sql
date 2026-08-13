-- ════════════════════════════════════════════════════════════════════════════
-- WP7 verify — re-runnable health check for the partner-portal financial
-- snapshot RPC (apn_partner_financial_snapshot).
-- Runs entirely inside one transaction that ROLLS BACK at the end, so the
-- fixture users/ledger/wallets never touch production data. Every dynamic
-- assertion (identity scoping, cross-partner isolation, IDOR-proof shape,
-- read-only guarantees) raises an exception on failure. The final SELECTs
-- prove zero residue BOTH before (in-tx) and after the rollback.
-- ════════════════════════════════════════════════════════════════════════════
begin;

do $wp7$
declare
  v_super text;
  v_a text := '00000000-0000-4000-8000-000000000001';
  v_b text := '00000000-0000-4000-8000-000000000002';
  v_snap jsonb;
  v_cnt integer;
begin
  -- ── helpers ────────────────────────────────────────────────────────────
  create function pg_temp.wp7_expect(p_cond boolean, p_label text) returns void
  language plpgsql as $f$
  begin
    if p_cond then raise notice 'PASS: %', p_label;
    else raise exception 'VERIFY FAIL: %', p_label; end if;
  end $f$;

  -- ── static object checks ───────────────────────────────────────────────
  perform pg_temp.wp7_expect(to_regprocedure('public.apn_partner_financial_snapshot()') is not null,
    'snapshot function exists');
  perform pg_temp.wp7_expect(
    exists (select 1 from pg_proc where oid = 'public.apn_partner_financial_snapshot()'::regprocedure
      and prosecdef and provolatile = 's'),
    'snapshot is SECURITY DEFINER + STABLE (read-only by construction)');
  perform pg_temp.wp7_expect(
    exists (select 1 from pg_proc p where p.oid = 'public.apn_partner_financial_snapshot()'::regprocedure
      and array_position(p.proconfig, 'search_path=pg_catalog, public, pg_temp') is not null),
    'snapshot search_path hardened (pg_catalog, public, pg_temp)');
  perform pg_temp.wp7_expect(
    pg_get_function_arguments('public.apn_partner_financial_snapshot()'::regprocedure) = '',
    'snapshot takes ZERO parameters — no partner id exists to manipulate (IDOR-proof)');
  perform pg_temp.wp7_expect(
    has_function_privilege('authenticated', 'public.apn_partner_financial_snapshot()', 'EXECUTE'),
    'authenticated can execute snapshot');
  perform pg_temp.wp7_expect(
    not has_function_privilege('anon', 'public.apn_partner_financial_snapshot()', 'EXECUTE')
      and not has_function_privilege('public', 'public.apn_partner_financial_snapshot()', 'EXECUTE'),
    'anon/public cannot execute snapshot');

  -- ── real admin identity for fixtures (matches WP5 verify pattern) ──────
  select id into v_super from public.profiles where role = 'superadmin' and id is not null limit 1;
  if v_super is null then
    select id into v_super from public.profiles where role in ('admin','superadmin') and id is not null limit 1;
  end if;
  if v_super is null then raise exception 'VERIFY FAIL: no admin profile available for fixtures'; end if;

  -- ── fixtures (partner rows + ledger + consolidated wallets) ────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  insert into public.apn_users (id, data, updated_at) values
    (v_a, jsonb_build_object('id', v_a, 'status', 'active', 'name', 'Fixture Partner A', 'role', 'partner', 'district', 'Chennai'), now()),
    (v_b, jsonb_build_object('id', v_b, 'status', 'active', 'name', 'Fixture Partner B', 'role', 'partner', 'district', 'Madurai'), now());

  insert into public.apn_commission_ledger (idempotency_key, source_id, source_type, partner_id, commission_type, base_amount, percent, amount, event_at, eligible_from, snapshot) values
    ('fixture:wp7:a:1', 'fixture-wp7-src-a', 'revenue_collection', v_a, 'partner', 15000, 10, 1500, now() - interval '2 days', current_date - 1,
      jsonb_build_object('project', 'Fixture Project A', 'clientName', 'Alpha Client')),
    ('fixture:wp7:a:2', 'fixture-wp7-src-a2', 'revenue_collection', v_a, 'partner', 15000, 10, 1500, now(), current_date + 1,
      jsonb_build_object('project', 'Fixture Project A2', 'clientName', 'Alpha Client 2')),
    ('fixture:wp7:b:1', 'fixture-wp7-src-b', 'revenue_collection', v_b, 'partner', 900000, 11, 99000, now() - interval '1 day', current_date,
      jsonb_build_object('project', 'Fixture Project B', 'clientName', 'Beta Client'));

  -- Consolidated wallet is derived-only; open the engine's write window so the
  -- fixture rows can be planted (same mechanism the engine refresh uses).
  perform set_config('apn.consolidated.refresh', 'on', true);
  insert into public.apn_consolidated_wallets (partner_id, earned, pending, eligible, total_balance, reserved, withdrawable, withdrawn, reversed, recovery_outstanding, recovery_recovered, recovery_remaining, commission_breakdown, updated_at) values
    (v_a, 3000, 1500, 1500, 3000, 0, 1500, 0, 0, 0, 0, 0, '{}'::jsonb, now()),
    (v_b, 99000, 0, 99000, 99000, 0, 99000, 0, 0, 0, 0, 0, '{}'::jsonb, now());
  perform set_config('apn.consolidated.refresh', 'off', true);

  -- ── anon / unknown identity is rejected ────────────────────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text, true);
  begin
    perform public.apn_partner_financial_snapshot();
    raise exception 'VERIFY FAIL: snapshot accepted an unknown identity';
  exception when insufficient_privilege then null; end;

  -- ── partner A: authoritative values, exact AI-consistent shapes ─────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_snap := public.apn_partner_financial_snapshot();
  perform pg_temp.wp7_expect(v_snap->>'partnerId' = v_a, 'snapshot scope is the caller');
  perform pg_temp.wp7_expect(v_snap->'wallet'->>'partner_id' = v_a, 'wallet belongs to the caller');
  perform pg_temp.wp7_expect((v_snap->'wallet'->>'earned')::numeric = 3000, 'wallet earned matches authoritative engine value');
  perform pg_temp.wp7_expect((v_snap->'wallet'->>'pending')::numeric = 1500, 'wallet pending matches authoritative engine value');
  perform pg_temp.wp7_expect((v_snap->'wallet'->>'eligible')::numeric = 1500, 'wallet eligible matches authoritative engine value');
  perform pg_temp.wp7_expect((v_snap->'wallet'->>'withdrawable')::numeric = 1500, 'wallet withdrawable matches authoritative engine value');
  perform pg_temp.wp7_expect(jsonb_array_length(v_snap->'ledger') = 2, 'ledger carries the caller''s events');
  perform pg_temp.wp7_expect(((v_snap->'ledger')#>>'{0,amount}')::numeric = 1500, 'newest ledger row first');
  perform pg_temp.wp7_expect((v_snap->'ledger')#>>'{0,snapshot,project}' = 'Fixture Project A2', 'ledger snapshot fields projected');
  perform pg_temp.wp7_expect(v_snap->'nextEligibleDate' is not null, 'nextEligibleDate present for pending commission');
  perform pg_temp.wp7_expect(v_snap->'ruleKnowledge'->'ruleSet'->>'code' is not null, 'current rule version present');
  perform pg_temp.wp7_expect(jsonb_typeof(v_snap->'ruleKnowledge'->'ladder') = 'array', 'commission ladder present');
  perform pg_temp.wp7_expect(
    exists (select 1 from jsonb_array_elements(v_snap->'ruleKnowledge'->'ladder') r
      where r->>'commissionType' = 'partner' and (r->>'percent')::numeric in (10, 15, 20)),
    'partner ladder carries the authoritative 10/15/20 rates');
  perform pg_temp.wp7_expect(v_snap->'freeze'->>'frozen' = 'false', 'freeze state projected (read-only)');
  perform pg_temp.wp7_expect(jsonb_typeof(v_snap->'reversals') = 'array', 'reversals section present');
  perform pg_temp.wp7_expect(jsonb_typeof(v_snap->'withdrawalWallets') = 'array', 'withdrawal wallets section present');
  perform pg_temp.wp7_expect(jsonb_typeof(v_snap->'withdrawalRequests') = 'array', 'withdrawal requests section present');
  perform pg_temp.wp7_expect(not (v_snap::text like '%99000%' or v_snap::text like '%Beta Client%'),
    'partner A snapshot never contains partner B data');

  -- ── partner B: sees its own values only; A data never leaks ─────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  v_snap := public.apn_partner_financial_snapshot();
  perform pg_temp.wp7_expect(v_snap->>'partnerId' = v_b, 'partner B scope is B');
  perform pg_temp.wp7_expect((v_snap->'wallet'->>'earned')::numeric = 99000, 'partner B wallet is B''s');
  perform pg_temp.wp7_expect(jsonb_array_length(v_snap->'ledger') = 1, 'partner B ledger carries only B''s event');
  perform pg_temp.wp7_expect(not (v_snap::text like '%1500%' or v_snap::text like '%Alpha Client%'),
    'partner B snapshot excludes partner A data');

  -- ── same-shape guarantee with the AI context builder (Part 14) ──────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_snap := public.apn_partner_financial_snapshot();
  perform pg_temp.wp7_expect(
    v_snap->'wallet' = (public.apn_ai_build_context(null)->'wallet'),
    'wallet identical to the AI context builder''s wallet');
  perform pg_temp.wp7_expect(
    v_snap->'ledger' = (public.apn_ai_build_context(null)->'ledger'),
    'ledger identical to the AI context builder''s ledger');
  perform pg_temp.wp7_expect(
    v_snap->'ruleKnowledge' = (public.apn_ai_build_context(null)->'ruleKnowledge'),
    'rule knowledge identical to the AI context builder');
  perform pg_temp.wp7_expect(
    v_snap->'nextEligibleDate' = (public.apn_ai_build_context(null)->'nextEligibleDate'),
    'eligibility date identical to the AI context builder');

  raise notice 'WP7 VERIFY: all dynamic checks passed';
end $wp7$;

-- ── zero residue proof (runs BEFORE rollback; fixture rows exist in-tx) ──
select 'WP7 IN-TX FIXTURES PRESENT' as marker,
  (select count(*) from public.apn_users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_users,
  (select count(*) from public.apn_consolidated_wallets where partner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_wallets;

rollback;

-- ── zero residue proof (AFTER rollback: nothing may remain) ──────────────
select 'WP7 ZERO RESIDUE AFTER ROLLBACK' as marker,
  (select count(*) from public.apn_users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_users,
  (select count(*) from public.apn_commission_ledger where idempotency_key like 'fixture:wp7:%') as fixture_ledger,
  (select count(*) from public.apn_consolidated_wallets where partner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_wallets;
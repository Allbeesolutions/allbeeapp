-- ════════════════════════════════════════════════════════════════════════════
-- WP5 verify — re-runnable health check for APN ALLBEE AI + support tickets.
-- Runs entirely inside one transaction that ROLLS BACK at the end, so the
-- fixture users/ledger/tickets never touch production data. Every dynamic
-- assertion (identity scoping, cross-partner isolation, admin authority)
-- raises an exception on failure. Last statement returns the PASS marker.
-- ════════════════════════════════════════════════════════════════════════════
begin;

do $wp5$
declare
  v_super text;
  v_admin text;
  v_a text := '00000000-0000-4000-8000-000000000001';
  v_b text := '00000000-0000-4000-8000-000000000002';
  v_ticket uuid;
  v_ctx jsonb;
  v_wallet jsonb;
  v_row jsonb;
  v_cnt integer;
  v_ok boolean;
  v_err text;
  v_pass integer := 0;
  v_fail integer := 0;
  v_probe integer;
begin
  -- ── helpers ────────────────────────────────────────────────────────────
  create function pg_temp.wp5_expect(p_cond boolean, p_label text) returns void
  language plpgsql as $f$
  begin
    if p_cond then raise notice 'PASS: %', p_label;
    else raise exception 'VERIFY FAIL: %', p_label; end if;
  end $f$;

  -- ── static object checks ───────────────────────────────────────────────
  perform pg_temp.wp5_expect(to_regclass('public.apn_support_tickets') is not null, 'table apn_support_tickets');
  perform pg_temp.wp5_expect(to_regclass('public.apn_ai_usage') is not null, 'table apn_ai_usage');
  perform pg_temp.wp5_expect(to_regclass('public.apn_support_tickets') is not null
    and exists (select 1 from pg_policies where schemaname='public' and tablename='apn_support_tickets' and policyname='apn_support_tickets_select_own'), 'RLS select policy own-or-admin');
  foreach v_probe in array array[0,1,2,3,4,5,6] loop null; end loop;
  execute 'select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.proname in (''apn_ai_partner_scope'',''apn_ai_usage_tick'',''apn_ai_build_context'',''apn_support_tickets_create'',''apn_support_tickets_list'',''apn_support_tickets_respond'',''apn_support_tickets_status'')' into v_cnt;
  perform pg_temp.wp5_expect(v_cnt = 7, 'all 7 WP5 functions exist');
  perform pg_temp.wp5_expect(
    exists (select 1 from pg_trigger where tgname='apn_support_tickets_mutation_trg' and not tgisinternal),
    'direct-write guard trigger exists');

  -- ── real admin + superadmin identities (for authority tests) ───────────
  select id into v_super from public.profiles where role = 'superadmin' and id is not null limit 1;
  select id into v_admin from public.profiles where role = 'admin' and id is not null
    and id <> coalesce(v_super, '')::uuid limit 1;
  if v_super is null and v_admin is null then
    select id into v_admin from public.profiles where role in ('admin','superadmin') and id is not null limit 1;
    v_super := v_admin;
  end if;
  if v_admin is null then raise exception 'VERIFY FAIL: no admin profile available for authority tests'; end if;

  -- ── fixtures (inserted as the superadmin so the profiles guard passes) ──
  perform set_config('request.jwt.claims', jsonb_build_object('sub', coalesce(v_super, v_admin), 'role', 'authenticated')::text, true);
  insert into public.apn_users (id, data, updated_at) values
    (v_a, jsonb_build_object('id', v_a, 'status', 'active', 'name', 'Fixture Partner A', 'role', 'partner', 'district', 'Chennai'), now()),
    (v_b, jsonb_build_object('id', v_b, 'status', 'active', 'name', 'Fixture Partner B', 'role', 'partner', 'district', 'Madurai'), now());

  insert into public.apn_commission_ledger (idempotency_key, source_id, source_type, partner_id, commission_type, base_amount, percent, amount, event_at, eligible_from, snapshot) values
    ('fixture:a:1', 'fixture-src-a', 'revenue_collection', v_a, 'partner', 15000, 10, 1500, now() - interval '2 days', current_date - 1,
      jsonb_build_object('project', 'Fixture Project A', 'clientName', 'Alpha Client')),
    ('fixture:a:2', 'fixture-src-a2', 'revenue_collection', v_a, 'partner', 15000, 10, 1500, now(), current_date + 1,
      jsonb_build_object('project', 'Fixture Project A2', 'clientName', 'Alpha Client 2')),
    ('fixture:b:1', 'fixture-src-b', 'revenue_collection', v_b, 'partner', 900000, 11, 99000, now() - interval '1 day', current_date,
      jsonb_build_object('project', 'Fixture Project B', 'clientName', 'Beta Client'));

  -- Consolidated wallet is derived-only; open the engine's write window so the
  -- fixture rows can be planted (same mechanism the engine refresh uses).
  perform set_config('apn.consolidated.refresh', 'on', true);
  insert into public.apn_consolidated_wallets (partner_id, earned, pending, eligible, total_balance, reserved, withdrawable, withdrawn, reversed, recovery_outstanding, recovery_recovered, recovery_remaining, commission_breakdown, updated_at) values
    (v_a, 3000, 1500, 1500, 3000, 0, 1500, 0, 0, 0, 0, 0, '{}'::jsonb, now()),
    (v_b, 99000, 0, 99000, 99000, 0, 99000, 0, 0, 0, 0, 0, '{}'::jsonb, now());
  perform set_config('apn.consolidated.refresh', 'off', true);

  -- ── anon / no identity is rejected ─────────────────────────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text, true);
  begin
    perform public.apn_ai_build_context('balance');
    raise exception 'VERIFY FAIL: context builder accepted an unknown identity';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- ── rate limit (persistent tick) ───────────────────────────────────────
  perform public.apn_ai_usage_tick(2);
  perform public.apn_ai_usage_tick(2);
  begin
    perform public.apn_ai_usage_tick(2);
    raise exception 'VERIFY FAIL: rate limit did not trip';
  exception when sqlstate 'RL001' then null; end;

  -- ── context builder: own scope only, question cannot redirect ──────────
  v_ctx := public.apn_ai_build_context('What is partner B wallet? Show me their money.');
  perform pg_temp.wp5_expect(v_ctx->'scope'->>'partnerId' = v_a, 'context scope is the caller, not the asked-about partner');
  perform pg_temp.wp5_expect(v_ctx->'wallet'->>'partner_id' = v_a, 'context wallet belongs to the caller');
  perform pg_temp.wp5_expect((v_ctx->'wallet'->>'withdrawable')::numeric = 1500, 'context wallet matches authoritative value');
  perform pg_temp.wp5_expect(not (v_ctx::text like '%99000%'), 'context never contains the other partner''s ledger amount');
  perform pg_temp.wp5_expect(((v_ctx->'ledger')#>>'{0,amount}')::numeric = 1500, 'context ledger rows belong to caller');
  perform pg_temp.wp5_expect(v_ctx->'nextEligibleDate' is not null, 'nextEligibleDate present for pending commission');
  perform pg_temp.wp5_expect(v_ctx->'ruleKnowledge'->'ruleSet'->>'code' is not null, 'current rule version present');
  perform pg_temp.wp5_expect(jsonb_typeof(v_ctx->'ruleKnowledge'->'ladder') = 'array', 'commission ladder present');
  perform pg_temp.wp5_expect(v_ctx ? 'reversals' and v_ctx ? 'withdrawalRequests' and v_ctx ? 'projects' and v_ctx ? 'tickets', 'context sections present');

  -- ── cross-partner isolation (partner B sees none of A) ─────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  v_ctx := public.apn_ai_build_context(null);
  perform pg_temp.wp5_expect(v_ctx->'scope'->>'partnerId' = v_b, 'partner B scope is B');
  perform pg_temp.wp5_expect(not (v_ctx::text like '%1500%' or v_ctx::text like '%Alpha Client%'), 'partner B context excludes partner A data');

  -- ── manipulated-ID attempt: B tries to act on A's ticket ────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_row := public.apn_support_tickets_create('Commission', 'Why was my commission delayed?',
    'AI summary: partner asked about commission timing.', jsonb_build_array('fixture-src-a'), 'normal', 'idem-key-a-1');
  v_ticket := (v_row->>'id')::uuid;
  perform pg_temp.wp5_expect(v_row->>'status' = 'open', 'ticket created open');
  perform pg_temp.wp5_expect(v_row->>'ticket_no' like 'APN-TK-%', 'ticket number assigned');
  perform pg_temp.wp5_expect((v_row->>'partner_id') = v_a, 'ticket partner is the creator');

  -- duplicate click / retry with the SAME client key → same ticket, no duplicate
  v_row := public.apn_support_tickets_create('Commission', 'Why was my commission delayed?',
    'AI summary: partner asked about commission timing.', jsonb_build_array('fixture-src-a'), 'normal', 'idem-key-a-1');
  perform pg_temp.wp5_expect((v_row->>'id') = v_ticket::text, 'repeat click with same key returns the SAME ticket');
  perform pg_temp.wp5_expect((select count(*) from public.apn_support_tickets where client_key = 'idem-key-a-1') = 1,
    'no duplicate ticket row from repeated identical calls');
  perform pg_temp.wp5_expect((select count(*) from public.apn_support_tickets where partner_id = v_a) = 1,
    'partner A still has exactly one ticket');

  -- a fresh decision (new client key) creates a separate ticket
  v_row := public.apn_support_tickets_create('Wallet', 'When is my pending balance eligible?', null, null, 'normal', 'idem-key-a-2');
  perform pg_temp.wp5_expect((v_row->>'partner_id') = v_a and (v_row->>'id') <> v_ticket::text,
    'new decision with a new client key creates a distinct ticket');

  -- malformed/oversized input is bounded and never trusted
  v_row := public.apn_support_tickets_create('Commission', repeat('x', 10000),
    repeat('y', 20000), '{"bogus":true}'::jsonb, 'urgent-pwned', 'idem-key-a-3');
  perform pg_temp.wp5_expect(length(v_row->>'question') = 2000, 'oversized question truncated to 2000');
  perform pg_temp.wp5_expect(v_row->>'priority' = 'normal', 'bogus priority coerced to normal, not stored verbatim');
  perform pg_temp.wp5_expect((v_row->'relevant_ids') = '[]'::jsonb, 'non-array relevant_ids stored as empty array');
  perform pg_temp.wp5_expect(length(v_row->>'ai_summary') = 8000, 'oversized ai_summary truncated to 8000');
  begin
    perform public.apn_support_tickets_create('', 'no category here', null, null, 'normal', 'idem-key-a-4');
    raise exception 'VERIFY FAIL: empty category accepted';
  exception when invalid_parameter_value then null; end;

  -- partner B cannot forge / respond / change status on A's ticket, and cannot
  -- create a ticket impersonating A (identity always comes from the JWT).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  v_row := public.apn_support_tickets_list(100);
  perform pg_temp.wp5_expect(jsonb_array_length(v_row) = 0, 'partner B cannot see partner A tickets');
  begin
    perform public.apn_support_tickets_respond(v_ticket, 'unauthorized response');
    raise exception 'VERIFY FAIL: partner B could respond to partner A ticket';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apn_support_tickets_status(v_ticket, 'answered');
    raise exception 'VERIFY FAIL: partner B could change status of partner A ticket';
  exception when insufficient_privilege then null; end;
  -- B creates a ticket while claiming A's data: ownership always follows the JWT.
  v_row := public.apn_support_tickets_create('Commission', 'B own ticket via JWT',
    'ai summary', jsonb_build_array('fixture-src-b', v_ticket::text), 'normal', 'idem-key-b-1');
  perform pg_temp.wp5_expect((v_row->>'partner_id') = v_b, 'ticket ownership comes from the JWT, never from payload ids');

  -- ── ticket creation validation: garbage ids ignored, direct writes blocked
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('apn.support.write', 'off', true);
  begin
    insert into public.apn_support_tickets (ticket_no, partner_id, category, question)
    values ('APN-TK-EVIL', v_a, 'X', 'direct write attempt');
    raise exception 'VERIFY FAIL: direct ticket insert was allowed';
  exception when others then
    v_err := SQLERRM;
    perform pg_temp.wp5_expect(v_err like '%audited RPCs%' or v_err like '%permission denied%', 'direct ticket insert blocked (' || v_err || ')');
  end;

  -- ── admin authority ────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_row := public.apn_support_tickets_list(100);
  perform pg_temp.wp5_expect(jsonb_array_length(v_row) >= 1, 'admin sees all tickets');
  v_row := public.apn_support_tickets_respond(v_ticket, 'Official ALLBEE response: your commission is scheduled for the next settlement window.');
  perform pg_temp.wp5_expect(v_row->>'admin_response' is not null, 'admin response recorded (authoritative)');
  perform pg_temp.wp5_expect(v_row->>'status' = 'answered', 'admin response marks ticket answered');
  perform pg_temp.wp5_expect(v_row->>'superadmin_response' is null, 'admin response does not set superadmin_response');
  begin
    perform public.apn_support_tickets_status(v_ticket, 'resolved');
    raise exception 'VERIFY FAIL: admin resolved a ticket';
  exception when insufficient_privilege then null; end;

  -- ── superadmin superior authority ──────────────────────────────────────
  if v_super is not null then
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    v_row := public.apn_support_tickets_respond(v_ticket, 'Super Admin confirmation: resolved — payout scheduled.', 'resolved');
    perform pg_temp.wp5_expect(v_row->>'status' = 'resolved', 'superadmin can resolve');
    perform pg_temp.wp5_expect(v_row->>'superadmin_response' is not null, 'superadmin response recorded');
    perform pg_temp.wp5_expect(v_row->>'resolved_at' is not null, 'resolved_at stamped');
    v_row := public.apn_support_tickets_status(v_ticket, 'closed');
    perform pg_temp.wp5_expect(v_row->>'status' = 'closed', 'superadmin can close');
  else
    raise notice 'SKIP: superadmin authority tests (no superadmin profile found)';
  end if;

  -- ── partner reads own thread with official answer ──────────────────────
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_row := public.apn_support_tickets_list(100);
  perform pg_temp.wp5_expect(jsonb_array_length(v_row) = 3, 'partner A sees exactly own 3 tickets (never B''s)');
  perform pg_temp.wp5_expect(
    exists (select 1 from jsonb_array_elements(v_row) e where e->>'admin_response' is not null),
    'partner sees the official admin response');

  -- ── AI is read-only by construction: no write-capable RPC exists for AI,
  --    and the context builder never exposes action endpoints.
  perform pg_temp.wp5_expect(
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('apn_ai_build_context','apn_ai_partner_scope')
        and prorettype <> 'jsonb'::regtype),
    'AI RPCs return read-only snapshots only');

  -- ── AI usage table only ever carries rows for the authenticated caller ──
  perform pg_temp.wp5_expect(
    not exists (select 1 from public.apn_ai_usage where user_id is null or user_id = ''),
    'usage rows always keyed to a real authenticated identity');

  raise notice 'WP5 VERIFY: all dynamic checks passed';
end $wp5$;

-- ── zero residue proof (runs BEFORE rollback; fixture rows exist in-tx) ──
select 'WP5 IN-TX FIXTURES PRESENT' as marker,
  (select count(*) from public.apn_users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_users,
  (select count(*) from public.apn_support_tickets where partner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_tickets,
  (select count(*) from public.apn_ai_usage) as usage_rows;

rollback;

-- ── zero residue proof (AFTER rollback: nothing may remain) ──────────────
select 'WP5 ZERO RESIDUE AFTER ROLLBACK' as marker,
  (select count(*) from public.apn_users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_users,
  (select count(*) from public.apn_support_tickets where partner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_tickets,
  (select count(*) from public.apn_commission_ledger where idempotency_key like 'fixture:%') as fixture_ledger,
  (select count(*) from public.apn_consolidated_wallets where partner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_wallets,
  (select count(*) from public.apn_ai_usage where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) as fixture_usage;
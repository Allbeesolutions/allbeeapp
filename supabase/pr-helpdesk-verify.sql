-- ════════════════════════════════════════════════════════════════════════════
-- ALLBEE — Automated verification of the client-portal Helpdesk (support_tickets)
-- against PRODUCTION.
--
-- Delivery channel: Supabase Management API / SQL Editor (single session for
-- the whole file, so BEGIN/ROLLBACK applies to everything). The file runs
-- inside ONE transaction: real client/staff/admin ids from production are used
-- ONLY as JWT identities (never mutated), and every support ticket / message /
-- audit row is created inside that transaction and ROLLED BACK before the final
-- select, so there is ZERO lasting impact on production data. If any assertion
-- fails, the transaction aborts and nothing persists.
--
-- Identity model: the helpdesk RPCs are SECURITY DEFINER and read auth.uid()
-- from request.jwt.claims; RLS policy checks are exercised by switching the
-- session role to `authenticated` inside the transaction (a plain DO block is
-- invoker-rights, so SET LOCAL ROLE is permitted there).
--
-- Idempotent: reads state + creates/rolls back test rows only; a second run
-- is identical and harmless. Safe to keep in the repo alongside the patch.
--
-- Prerequisite: supabase/pr-helpdesk.sql must be applied to the database.
-- ════════════════════════════════════════════════════════════════════════════

begin;

savepoint helpdesk_verify_sp;

-- ── assertion helper (matches repo convention; dropped with the savepoint) ─
create or replace function public.vf_assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'VERIFY FAIL: %', msg;
  end if;
end $$;

do $helpdesk$
declare
  v_a uuid := 'd6b97483-e4ba-4f7e-a6fd-a2785dba5554';            -- real approved client A (BIOTIN)
  v_b uuid := '00000000-0000-4000-8000-0000000000A2';            -- unknown / not-a-client identity B
  v_staff uuid;
  v_admin uuid;
  v_a_name text;
  v_a_email text;
  v_ticket_a uuid;
  v_ticket_b uuid;
  v_ticket_c uuid;
  v_ticket_no text;
  v_ticket_no2 text;
  v_msg_id uuid;
  v_n bigint;
  v_cnt bigint;
  v_ok boolean;
  v_fin1 bigint; v_fin2 bigint; v_fin3 bigint;
  v_fin1b bigint; v_fin2b bigint; v_fin3b bigint;
begin
  -- ── pick real identities (identity-only; never mutated) ────────────────
  select id into v_staff from public.profiles
    where role in ('accountant','staff','intern') and active and approved limit 1;
  select id into v_admin from public.profiles
    where role in ('admin','superadmin') and active and approved limit 1;
  select name, email into v_a_name, v_a_email from public.profiles where id = v_a;
  if v_staff is null or v_admin is null or v_a_name is null then
    raise exception 'VERIFY FAIL: required identities missing (client/staff/admin)';
  end if;

  -- ── static object + posture checks ─────────────────────────────────────
  perform public.vf_assert(to_regclass('public.support_tickets') is not null, 'table support_tickets exists');
  perform public.vf_assert(to_regclass('public.support_ticket_messages') is not null, 'table support_ticket_messages exists');
  perform public.vf_assert(to_regclass('public.support_ticket_audit') is not null, 'table support_ticket_audit exists');
  perform public.vf_assert(
    (select relrowsecurity from pg_class where oid='public.support_tickets'::regclass)
    and (select relrowsecurity from pg_class where oid='public.support_ticket_messages'::regclass)
    and (select relrowsecurity from pg_class where oid='public.support_ticket_audit'::regclass),
    'RLS enabled on all three helpdesk tables');
  perform public.vf_assert(
    (select count(*) from pg_policies where schemaname='public' and tablename in ('support_tickets','support_ticket_messages','support_ticket_audit')) = 5,
    'all 5 intended RLS policies present (tickets s+i, messages s+i, audit s)');
  perform public.vf_assert(
    (select count(*) from pg_indexes where schemaname='public' and indexname like 'support_%_idx'
      and tablename in ('support_tickets','support_ticket_messages','support_ticket_audit')) = 4,
    'non-pkey indexes present (client, status, message ticket, audit ticket)');

  -- every helpdesk function: SECURITY DEFINER + a set search_path
  perform public.vf_assert(
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('apn_is_staff','apn_can_view_ticket','apn_create_support_ticket','apn_helpdesk_client_message','apn_helpdesk_staff_message','apn_set_support_ticket_status','apn_assign_support_ticket')
      and p.prosecdef and p.proconfig is not null) = 7,
    'all 7 helpdesk functions are SECURITY DEFINER with a hardened search_path');

  -- no anon / PUBLIC execute on any helpdesk function or helper
  perform public.vf_assert(
    not exists (select 1 from information_schema.routine_privileges r
      where r.routine_schema='public' and r.routine_name in ('apn_is_staff','apn_can_view_ticket','apn_create_support_ticket','apn_helpdesk_client_message','apn_helpdesk_staff_message','apn_set_support_ticket_status','apn_assign_support_ticket')
      and r.grantee in ('PUBLIC','anon')),
    'no anon or PUBLIC execute on helpdesk functions');

  -- admin-only assignment is hard-coded in the function body
  perform public.vf_assert(
    exists (select 1 from pg_proc p where p.proname='apn_assign_support_ticket'
      and pg_get_functiondef(p.oid) ilike '%public.is_admin()%'),
    'apn_assign_support_ticket remains ADMIN-ONLY (is_admin gate in body)');

  -- ── financial isolation (in-suite guard) ────────────────────────────────
  select count(*) into v_fin1 from public.apn_commission_ledger;
  select count(*) into v_fin2 from public.apn_consolidated_wallets;
  select count(*) into v_fin3 from public.apn_withdrawal_wallets;
  perform public.vf_assert(
    not exists (select 1 from pg_proc p
      where p.proname in ('apn_create_support_ticket','apn_helpdesk_client_message','apn_helpdesk_staff_message','apn_set_support_ticket_status','apn_assign_support_ticket')
      and pg_get_functiondef(p.oid) ~* 'apn_commission_ledger|apn_consolidated_wallets|apn_withdrawal_wallets|apn_rule_sets|apn_referral_|apn_commission'),
    'helpdesk RPCs reference NO financial engine objects');

  -- ══ T1 — client A can create a ticket (identity from JWT server-side) ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_ticket_a := public.apn_create_support_ticket('Understanding my invoice', 'I have a question about the latest invoice I received.', 'Invoice', 'Normal');
  perform public.vf_assert(v_ticket_a is not null, 'T1 client A created a ticket');

  select ticket_no into v_ticket_no from public.support_tickets where id = v_ticket_a;
  perform public.vf_assert(v_ticket_no ~ '^SUP-[0-9]{8}-[A-Z0-9]{5}$', 'T15 ticket number server-generated in SUP-YYYYMMDD-XXXXX format');
  perform public.vf_assert(
    (select client_id from public.support_tickets where id = v_ticket_a) = v_a
    and (select client_name from public.support_tickets where id = v_ticket_a) = v_a_name
    and (select client_email from public.support_tickets where id = v_ticket_a) = coalesce(v_a_email, ''),
    'client snapshot (name/email) recorded at creation');

  -- ══ T2 — client A can read ticket A (raw RLS) ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_tickets where id = v_ticket_a;
  perform public.vf_assert(v_n = 1, 'T2 client A can read their own ticket');
  reset role;

  -- ══ T3 — client A cannot read client B's ticket (RLS) ══
  insert into public.support_tickets (client_id, subject, client_name)
  values (v_b, 'B ticket for isolation', 'Unknown B') returning id into v_ticket_b;
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_tickets where id = v_ticket_b;
  perform public.vf_assert(v_n = 0, 'T3 client A cannot read client B ticket');
  -- …and B (unknown identity) cannot read A's ticket
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_tickets where id = v_ticket_a;
  perform public.vf_assert(v_n = 0, 'T3 unknown identity cannot read client A ticket');
  reset role;

  -- ══ T4 — client A cannot modify client B's ticket (no UPDATE/DELETE policy) ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  update public.support_tickets set status='closed' where id = v_ticket_b;
  get diagnostics v_cnt = row_count;
  perform public.vf_assert(v_cnt = 0, 'T4 client A cannot UPDATE client B ticket');
  delete from public.support_tickets where id = v_ticket_b;
  get diagnostics v_cnt = row_count;
  perform public.vf_assert(v_cnt = 0, 'T4 client A cannot DELETE client B ticket');
  reset role;

  -- ══ T5 — client A cannot message into client B's ticket ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  begin
    insert into public.support_ticket_messages (ticket_id, author_id, author_role, body)
    values (v_ticket_b, v_a, 'client', 'tampering');
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform public.vf_assert(not v_ok, 'T5 RLS blocks client A INSERT into client B ticket');
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  begin
    perform public.apn_helpdesk_client_message(v_ticket_b, 'tampering via RPC');
    raise exception 'VERIFY FAIL: T5 client A posted into client B ticket via RPC';
  exception when insufficient_privilege then null; end;

  -- ══ T6/T7 — client cannot change status or assign ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  begin
    perform public.apn_set_support_ticket_status(v_ticket_a, 'closed');
    raise exception 'VERIFY FAIL: T6 client A changed status';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apn_assign_support_ticket(v_ticket_a, v_staff);
    raise exception 'VERIFY FAIL: T7 client A assigned a ticket';
  exception when insufficient_privilege then null; end;

  -- ══ T14 — unauthorized / anonymous access fails ══
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated')::text, true);  -- no sub
  begin
    perform public.apn_create_support_ticket('Anon', 'x', 'General', 'Normal');
    raise exception 'VERIFY FAIL: T14 anonymous create allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  begin
    perform public.apn_create_support_ticket('Staff pretending', 'x', 'General', 'Normal');
    raise exception 'VERIFY FAIL: T14 non-client create allowed';
  exception when insufficient_privilege then null; end;

  -- ══ T8/T9 — authorized staff can read & respond ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_tickets where id = v_ticket_a or id = v_ticket_b;
  perform public.vf_assert(v_n = 2, 'T8 staff sees all tickets (both A and B)');
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  v_msg_id := public.apn_helpdesk_staff_message(v_ticket_a, 'Official reply from the team.', true);
  perform public.vf_assert(v_msg_id is not null, 'T9 staff can respond (public reply)');
  perform public.vf_assert(
    (select author_role from public.support_ticket_messages where id = v_msg_id) = 'staff'
    and (select author_public from public.support_ticket_messages where id = v_msg_id) is true,
    'T9 reply recorded as staff/public');

  -- ══ T10 — internal notes are hidden from the client ══
  v_msg_id := public.apn_helpdesk_staff_message(v_ticket_a, 'INTERNAL: escalate to finance', false);
  perform public.vf_assert(
    (select author_public from public.support_ticket_messages where id = v_msg_id) is false,
    'internal note stored as private');
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_ticket_messages where ticket_id = v_ticket_a;
  -- client sees EXACTLY the 1 public reply, never the internal note
  perform public.vf_assert(v_n = 1, 'T10 client sees only the public reply, not the internal note');
  select count(*) into v_n from public.support_ticket_messages where ticket_id = v_ticket_a and body ilike '%INTERNAL%';
  perform public.vf_assert(v_n = 0, 'T10 internal-note ROW hidden from client at RLS level');
  -- audit confidentiality: client sees their own ticket_created audit only,
  -- never staff status/assignment actions or their metadata
  select count(*) into v_n from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'assigned';
  perform public.vf_assert(v_n = 0, 'T10 client cannot read assignment audit (staff-only)');
  select count(*) into v_n from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'ticket_created';
  perform public.vf_assert(v_n = 1, 'T10 client can read their own ticket_created audit');
  reset role;

  -- ops visibility: staff DOES see the internal note + full audit trail
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_ticket_messages where ticket_id = v_ticket_a and body ilike '%INTERNAL%';
  perform public.vf_assert(v_n = 1, 'T10 staff can see the internal note (ops line)');
  select count(*) into v_n from public.support_ticket_audit where ticket_id = v_ticket_a;
  perform public.vf_assert(v_n >= 1, 'T10 staff sees the full audit trail');
  reset role;

  -- ══ T11 — staff changes status only through the intended RPC ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  update public.support_tickets set status='resolved' where id = v_ticket_a;
  get diagnostics v_cnt = row_count;
  perform public.vf_assert(v_cnt = 0, 'T11 direct status UPDATE by staff is RLS-blocked');
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform public.apn_set_support_ticket_status(v_ticket_a, 'in_progress', 'Working on it');
  perform public.vf_assert(
    (select status from public.support_tickets where id = v_ticket_a) = 'in_progress',
    'T11 staff changes status ONLY via the RPC');

  -- ══ T12/T13 — assignment: admin only, non-admin staff rejected ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  begin
    perform public.apn_assign_support_ticket(v_ticket_a, v_staff);
    raise exception 'VERIFY FAIL: T13 non-admin staff assigned a ticket';
  exception when insufficient_privilege then null; end;
  perform public.vf_assert(
    (select assignee_id from public.support_tickets where id = v_ticket_a) is null,
    'T13 ticket stays unassigned after non-admin attempt');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.apn_assign_support_ticket(v_ticket_a, v_staff);
  perform public.vf_assert(
    (select assignee_id from public.support_tickets where id = v_ticket_a) = v_staff,
    'T12 admin assignment recorded');

  -- ══ lifecycle — client reply after staff/assignment, then resolved ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_msg_id := public.apn_helpdesk_client_message(v_ticket_a, 'Thanks, that answers my question.');
  perform public.vf_assert(v_msg_id is not null, 'lifecycle client reply sent');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform public.apn_set_support_ticket_status(v_ticket_a, 'resolved', 'Client confirmed');
  perform public.vf_assert(
    (select status from public.support_tickets where id = v_ticket_a) = 'resolved'
    and (select closed_at from public.support_tickets where id = v_ticket_a) is not null,
    'lifecycle final status resolved + closed_at stamped');

  -- ══ T16 — duplicate / retry safety ══
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_ticket_no2 := null;
  v_ticket_c := public.apn_create_support_ticket('Understanding my invoice', 'I have a question about the latest invoice I received.', 'Invoice', 'Normal');
  select ticket_no into v_ticket_no2 from public.support_tickets where id = v_ticket_c;
  perform public.vf_assert(v_ticket_no2 is not null and v_ticket_no2 <> v_ticket_no, 'T16 repeated identical submit creates a distinct ticket number');
  perform public.vf_assert(
    (select count(*) from public.support_tickets where subject='Understanding my invoice') = 2,
    'T16 two identical submits → two rows, no loss/corruption');
  perform public.vf_assert(
    (select count(*) from (select ticket_no from public.support_tickets group by ticket_no having count(*)>1)) = 0,
    'T15/T16 ticket numbers unique (no collisions)');

  -- ══ T17 — audit records for privileged mutations ══
  perform public.vf_assert(
    (select count(*) from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'ticket_created') = 1,
    'T17 audit: ticket_created');
  perform public.vf_assert(
    (select count(*) from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'status_in_progress') = 1,
    'T17 audit: status_in_progress');
  perform public.vf_assert(
    (select count(*) from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'status_resolved') = 1,
    'T17 audit: status_resolved');
  perform public.vf_assert(
    (select count(*) from public.support_ticket_audit where ticket_id = v_ticket_a and action = 'assigned') = 1
    and (select count(*) from public.support_ticket_audit where ticket_id = v_ticket_b and action = 'assigned') = 0,
    'T17 audit: assigned once — and client B ticket never assigned');

  -- ══ lifecycle thread state from client perspective ══
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.support_ticket_messages where ticket_id = v_ticket_a;
  perform public.vf_assert(v_n = 2, 'client thread = 1 public staff reply + 1 client reply (internal note excluded)');
  reset role;

  -- ══ financial isolation recheck: nothing moved in-tx ══
  select count(*) into v_fin1b from public.apn_commission_ledger;
  select count(*) into v_fin2b from public.apn_consolidated_wallets;
  select count(*) into v_fin3b from public.apn_withdrawal_wallets;
  perform public.vf_assert(v_fin1b = v_fin1 and v_fin2b = v_fin2 and v_fin3b = v_fin3,
    'financial engine row counts unchanged across the helpdesk lifecycle');

  raise notice 'HELPDESK VERIFY: all dynamic checks passed';
end $helpdesk$;

-- ── zero residue proof (BEFORE rollback: fixture rows must exist in-tx) ──
select 'HELPDESK IN-TX FIXTURES PRESENT' as marker,
  (select count(*) from public.support_tickets where client_id in ('d6b97483-e4ba-4f7e-a6fd-a2785dba5554','00000000-0000-4000-8000-0000000000A2')) as fixture_tickets,
  (select count(*) from public.support_ticket_audit where ticket_id in (select id from public.support_tickets where client_id in ('d6b97483-e4ba-4f7e-a6fd-a2785dba5554','00000000-0000-4000-8000-0000000000A2'))) as fixture_audit;

rollback;

-- ── zero residue proof (AFTER rollback: nothing may remain) ──────────────
select 'HELPDESK ZERO RESIDUE AFTER ROLLBACK' as marker,
  (select count(*) from public.support_tickets where client_id in ('d6b97483-e4ba-4f7e-a6fd-a2785dba5554','00000000-0000-4000-8000-0000000000A2')) as fixture_tickets,
  (select count(*) from public.support_ticket_messages where author_id in ('d6b97483-e4ba-4f7e-a6fd-a2785dba5554','00000000-0000-4000-8000-0000000000A2')) as fixture_messages,
  (select count(*) from public.support_ticket_audit where author_id in ('d6b97483-e4ba-4f7e-a6fd-a2785dba5554','00000000-0000-4000-8000-0000000000A2')) as fixture_audit,
  (select count(*) from public.support_tickets where subject like 'B ticket for isolation') as fixture_b,
  (select count(*) from pg_proc where proname='vf_assert') as leftover_helpers;

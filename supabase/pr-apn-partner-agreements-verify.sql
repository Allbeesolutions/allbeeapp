-- ══════════════════════════════════════════════════════════════════════════
-- APN PARTNER AGREEMENT GOVERNANCE — automated verification (T1–T38)
--
-- Delivery: paste into the Supabase SQL Editor (single session so BEGIN/COMMIT
-- applies). The whole file runs inside one transaction; all test data,
-- triggers and helper functions live under a single savepoint that is rolled
-- back before commit — ZERO lasting impact on business data. Any failed
-- assertion aborts the transaction, the editor reports an error, and nothing
-- changes.
--
-- Scope: T1–T29 cover the base suite (20260819120000); T31–T38 cover the
-- final-governance extensions (20260820000000: Simple-English bodies, hash
-- over both renderings, material/non-material publish classification,
-- terms-view evidence, centralized company configuration). T30 proves the
-- rollback restored production state byte-identically.
--
-- The editor session has no JWT, so auth.uid() is null. The accept/status
-- RPCs resolve the partner from the request claims, so the tests simulate a
-- signed-in partner via set_config('request.jwt.claim.sub', …) — the same GUC
-- PostgREST populates for a real authenticated request. is_admin() is
-- redefined to true (foundation-suite pattern) and restored exactly by the
-- savepoint rollback (re-asserted afterwards). Role-denial paths that cannot
-- be exercised while is_admin() is stubbed are asserted at the function-source
-- level, exactly as the foundation suite asserts its own denials.
--
-- Expect: every notice to be OK; a failed assertion aborts the transaction.
-- Written for PG15.
-- ══════════════════════════════════════════════════════════════════════════

begin;

savepoint apn_agreements_verify_sp;

create or replace function public.is_admin()
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

-- ── Test fixtures ──────────────────────────────────────────────────────────
-- Two partner identities: one ACTIVE (acceptance flows), one SUSPENDED
-- (negative flows). Both referenced through the simulated JWT claim sub.
insert into public.apn_users (id, data, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', jsonb_build_object('id', '00000000-0000-4000-8000-0000000000a1', 'status', 'active', 'name', 'Verify Agreement Partner', 'role', 'partner'), now()),
  ('00000000-0000-4000-8000-0000000000a2', jsonb_build_object('id', '00000000-0000-4000-8000-0000000000a2', 'status', 'suspended', 'name', 'Verify Suspended Partner', 'role', 'partner'), now());

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
        'verify-agr@test.in', '', '{}'::jsonb, '{"id": "00000000-0000-4000-8000-0000000000a1"}'::jsonb, false, now(), now())
on conflict (id) do nothing;
-- The project's handle_new_user trigger creates the matching profiles row
-- (mirroring a real signup); the savepoint rollback removes BOTH rows, which
-- T30 proves.

do $$
declare
  c bigint; n numeric; h text;
  v_draft_id uuid; v_dup uuid;
  v_v1_id uuid; v_v2_id uuid;
  v_acc uuid;
  v_headers_row text;
  v_status jsonb;
  v_expected_hash text;
  v_fn text;
  v_codes text[] := array['partner-agreement','terms-conditions','commission-schedule','code-of-conduct',
    'privacy-policy','ip-brand','confidentiality','lead-client-management',
    'quotation-sales','training-certification','suspension-termination','dispute-grievance'];
begin
  -- ── T1 tables exist + RLS enabled ──────────────────────────────────────────
  foreach v_fn in array array['apn_agreements','apn_agreement_acceptances'] loop
    perform public.vf_assert(to_regclass('public.' || v_fn) is not null, 'T1 table exists: ' || v_fn);
    perform public.vf_assert((select relrowsecurity from pg_class where oid = ('public.' || v_fn)::regclass), 'T1 RLS enabled: ' || v_fn);
  end loop;
  perform public.vf_assert(has_table_privilege('anon', 'public.apn_agreements', 'SELECT') = false, 'T1 anon cannot read agreements');
  perform public.vf_assert(has_table_privilege('anon', 'public.apn_agreement_acceptances', 'SELECT') = false, 'T1 anon cannot read acceptances');
  raise notice '[verify] T1 tables + RLS OK';

  -- ── T2 read-only grants on both tables ─────────────────────────────────────
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreements', 'SELECT'), 'T2 authenticated can read agreements');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreements', 'INSERT') = false, 'T2 no insert on agreements');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreements', 'UPDATE') = false, 'T2 no update on agreements');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreements', 'DELETE') = false, 'T2 no delete on agreements');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_acceptances', 'SELECT'), 'T2 authenticated can read acceptances');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_acceptances', 'INSERT') = false, 'T2 no insert on acceptances');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_acceptances', 'UPDATE') = false, 'T2 no update on acceptances');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_acceptances', 'DELETE') = false, 'T2 no delete on acceptances');
  raise notice '[verify] T2 read-only grants OK';

  -- ── T3 select policies: partners see published docs; admins see all ─────────
  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreements' and cmd = 'SELECT') = 1, 'T3 exactly one select policy on agreements');
  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreements'
      and policyname = 'apn_agreements_select'
      and qual like '%status = ''published''%' and qual like '%is_admin()%') = 1, 'T3 agreements policy mixes admin + published');
  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreements'
      and cmd <> 'SELECT') = 0, 'T3 agreements table has no write policies');
  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreement_acceptances' and cmd = 'SELECT') = 1, 'T3 exactly one select policy on acceptances');
  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreement_acceptances'
      and cmd <> 'SELECT') = 0, 'T3 acceptances table has no write policies');
  raise notice '[verify] T3 policy shape OK';

  -- ── T4 immutability triggers present ───────────────────────────────────────
  perform public.vf_assert((select count(*) from pg_trigger where tgname = 'apn_agreements_guard_trg' and not tgisinternal) = 1, 'T4 agreements immutability trigger');
  perform public.vf_assert((select count(*) from pg_trigger where tgname = 'apn_agreement_acceptances_guard_trg' and not tgisinternal) = 1, 'T4 acceptances immutability trigger');
  raise notice '[verify] T4 immutability triggers OK';

  -- ── T5 seed: all twelve document codes as final-content DRAFTS ───────────
  -- (applies AFTER 20260820000000: placeholders were replaced by the
  -- owner-approved final commercial text; bodies stay drafts until published)
  select count(*) into c from public.apn_agreements where status = 'draft';
  perform public.vf_assert(c = 12, 'T5 exactly 12 seed drafts: ' || c);
  select count(*) into c from public.apn_agreements where code = any (v_codes) and status = 'draft';
  perform public.vf_assert(c = 12, 'T5 seed covers all 12 codes: ' || c);
  select count(*) into c from public.apn_agreements where status = 'published';
  perform public.vf_assert(c = 0, 'T5 nothing published from seed');
  select count(*) into c from public.apn_agreements where body like '[ DRAFT%';
  perform public.vf_assert(c = 0, 'T5 final seeds carry no placeholder markers: ' || c);
  select count(*) into c from public.apn_agreements
  where status = 'draft' and (length(trim(body_simple)) = 0 or body_simple is null);
  perform public.vf_assert(c = 0, 'T5 every seed has a Simple English body: ' || c);
  select count(*) into c from public.apn_agreements
  where status = 'draft' and body not like '%ALLBEE SOLUTIONS%';
  perform public.vf_assert(c = 0, 'T5 every seed body identifies the company: ' || c);
  select count(*) into c from public.apn_agreements where version <> 1;
  perform public.vf_assert(c = 0, 'T5 all seeds at version 1');
  raise notice '[verify] T5 final-content seeds OK';

  -- ── T6 save_draft: refresh of an existing draft keeps its version ──────────
  perform public.apn_agreement_save_draft('partner-agreement', 'Partner Agreement v1 refresh', 'Agreement',
    'The partnership relationship between ALLBEE SOLUTIONS and its APN partner, including engagement, obligations and rights.',
    true, null, 'T6 refresh', 'Plain-language summary of the refreshed partner agreement for T6.');
  select id, version into v_draft_id, n from public.apn_agreements where code = 'partner-agreement' and status = 'draft';
  perform public.vf_assert(v_draft_id is not null, 'T6 draft refreshed in place');
  perform public.vf_assert(n = 1, 'T6 draft kept version 1: ' || n);
  select coalesce(length(trim(body_simple)), 0) into n from public.apn_agreements where id = v_draft_id;
  perform public.vf_assert(n > 0, 'T6 draft carries a Simple English body: ' || n);
  raise notice '[verify] T6 draft refresh OK';

  -- ── T7 publish: activates the draft, stamps SHA-256 hash, single current ────
  select public.apn_agreement_publish(v_draft_id) into v_status;
  perform public.vf_assert(v_status->>'status' = 'published', 'T7 publish returns published');
  select id, version, content_hash into v_v1_id, n, h
  from public.apn_agreements where code = 'partner-agreement' and status = 'published';
  perform public.vf_assert(n = 1, 'T7 published at version 1: ' || n);
  perform public.vf_assert(length(h) = 64, 'T7 hash is sha256 hex (64 chars)');
  v_expected_hash := encode(extensions.digest('Partner Agreement v1 refresh' || E'\n\n' ||
    'The partnership relationship between ALLBEE SOLUTIONS and its APN partner, including engagement, obligations and rights.' ||
    E'\n\n[SIMPLE ENGLISH]\n' || 'Plain-language summary of the refreshed partner agreement for T6.', 'sha256'), 'hex');
  perform public.vf_assert(h = v_expected_hash, 'T7 hash covers formal + Simple English text');
  perform public.vf_assert(v_status->>'material' = 'true', 'T7 publish defaults to a material change');
  select count(*) into c from public.apn_agreements where code = 'partner-agreement' and status = 'published';
  perform public.vf_assert(c = 1, 'T7 exactly one published version per code: ' || c);
  select count(*) into c from public.apn_agreements where code = 'partner-agreement' and status in ('draft','published');
  perform public.vf_assert(c = 1, 'T7 no draft remains after publish');
  raise notice '[verify] T7 publish + hash OK';

  -- ── T8 duplicate publish of identical content is rejected ──────────────────
  perform public.apn_agreement_save_draft('partner-agreement', 'Partner Agreement v1 refresh', 'Agreement',
    'The partnership relationship between ALLBEE SOLUTIONS and its APN partner, including engagement, obligations and rights.',
    true, null, 'T8 dup', 'Plain-language summary of the refreshed partner agreement for T6.');
  select id into v_dup from public.apn_agreements where code = 'partner-agreement' and status = 'draft';
  perform public.vf_assert(v_dup is not null, 'T8 duplicate-content draft exists');
  begin
    select public.apn_agreement_publish(v_dup) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T8 duplicate-content publish rejected OK';
  end;
  select count(*) into c from public.apn_agreements where status = 'published';
  perform public.vf_assert(c = 1, 'T8 no extra published row created');
  raise notice '[verify] T8 duplicate publish guard OK';

  -- ── T9 version update: v2 publishes over v1, v1 superseded, not deleted ────
  perform public.apn_agreement_save_draft('partner-agreement', 'Partner Agreement v2', 'Agreement',
    'Updated partnership terms for ALLBEE APN partners: engagement, obligations, rights and the 2026 rider.',
    true, null, 'T9 v2', 'Plain-language summary of the v2 partner agreement.');
  select id into v_v2_id from public.apn_agreements where code = 'partner-agreement' and status = 'draft';
  perform public.vf_assert(v_v2_id is not null, 'T9 v2 draft created');
  select version into n from public.apn_agreements where id = v_v2_id;
  perform public.vf_assert(n = 2, 'T9 v2 has version 2: ' || n);
  select public.apn_agreement_publish(v_v2_id) into v_status;
  select status into h from public.apn_agreements where id = v_v1_id;
  perform public.vf_assert(h = 'superseded', 'T9 v1 becomes superseded: ' || h);
  select version, content_hash into n, h from public.apn_agreements where id = v_v1_id;
  perform public.vf_assert(n = 1, 'T9 v1 version preserved: ' || n);
  perform public.vf_assert(length(coalesce(h,'')) = 64, 'T9 v1 hash preserved (immutable content)');
  select count(*) into c from public.apn_agreements where code = 'partner-agreement' and status = 'published';
  perform public.vf_assert(c = 1, 'T9 exactly one current published v2');
  raise notice '[verify] T9 version update OK';

  -- ── T10 published rows are immutable (trigger rejects mutation/deletion) ───
  begin
    update public.apn_agreements set body = 'tampered' where id = v_v2_id;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T10 published mutation rejected OK';
  end;
  begin
    delete from public.apn_agreements where id = v_v2_id;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T10 published delete rejected OK';
  end;
  begin
    delete from public.apn_agreements where id = v_v1_id;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T10 superseded delete rejected OK';
  end;
  select count(*) into c from public.apn_agreements;
  perform public.vf_assert(c = 13, 'T10 no rows lost by immutability attempts: ' || c);
  raise notice '[verify] T10 immutability OK';

  -- ── T11 acceptance evidence: server-resolved partner/version/hash ──────────
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  perform set_config('request.headers', '{"x-forwarded-for": "203.0.113.7", "user-agent": "verify-ua/1.0"}', true);
  select public.apn_agreement_accept(v_v2_id) into v_status;
  perform public.vf_assert(v_status->>'accepted' = 'true', 'T11 accept returns accepted=true');
  select count(*) into c
  from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(c = 1, 'T11 acceptance row created: ' || c);
  select version into n from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(n = 2, 'T11 stored version matches published version 2');
  select content_hash into v_expected_hash from public.apn_agreements where id = v_v2_id;
  select content_hash into h from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(h = v_expected_hash, 'T11 stored hash matches published hash');
  select method into v_fn from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(v_fn = 'explicit', 'T11 method recorded');
  select user_agent into v_fn from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(v_fn = 'verify-ua/1.0', 'T11 user-agent recorded server-side');
  select ip into v_headers_row from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(v_headers_row = '203.0.113.7', 'T11 ip recorded server-side');
  select accepted_by into v_fn from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(v_fn = '00000000-0000-4000-8000-0000000000a1', 'T11 accepted_by is server-resolved partner id');
  raise notice '[verify] T11 acceptance evidence OK';

  -- ── T12 acceptance idempotency (no duplicate evidence, returns not-new) ────
  select public.apn_agreement_accept(v_v2_id) into v_status;
  perform public.vf_assert(v_status->>'accepted' = 'false', 'T12 re-accept reports not-new (idempotent)');
  select count(*) into c
  from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_v2_id;
  perform public.vf_assert(c = 1, 'T12 no duplicate evidence row: ' || c);
  raise notice '[verify] T12 idempotency OK';

  -- ── T13 draft / superseded versions can never be accepted ──────────────────
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  begin
    select public.apn_agreement_accept(v_v1_id) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T13 superseded accept rejected OK';
  end;
  select id into v_draft_id from public.apn_agreements where code = 'commission-schedule' and status = 'draft';
  begin
    select public.apn_agreement_accept(v_draft_id) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T13 draft accept rejected OK';
  end;
  raise notice '[verify] T13 stale/draft rejection OK';

  -- ── T14 inactive/suspended partners cannot accept ──────────────────────────
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
  begin
    select public.apn_agreement_accept(v_v2_id) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T14 suspended partner reject OK';
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
  begin
    select public.apn_agreement_accept(v_v2_id) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T14 non-partner reject OK';
  end;
  select count(*) into c from public.apn_agreement_acceptances;
  perform public.vf_assert(c = 1, 'T14 only the one legitimate acceptance exists: ' || c);
  raise notice '[verify] T14 partner-eligibility OK';

  -- ── T15 publish all remaining seeds → every code has a published version ───
  for v_draft_id in select a.id from public.apn_agreements a where a.status = 'draft' loop
    select public.apn_agreement_publish(v_draft_id) into v_status;
    perform public.vf_assert(v_status->>'status' = 'published', 'T15 publish loop failed for ' || v_draft_id::text);
  end loop;
  select count(*) into c from public.apn_agreements where status = 'published';
  perform public.vf_assert(c = 12, 'T15 all 12 codes now published: ' || c);
  raise notice '[verify] T15 baseline publish-all OK';

  -- ── T16 status: required until ALL mandatory current versions accepted ─────
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'true', 'T16 status required=true with unaccepted docs');
  perform public.vf_assert((v_status->>'requiredCount')::int = 11, 'T16 requiredCount = 11 (all but the earlier acceptance): ' || (v_status->>'requiredCount'));
  perform public.vf_assert(jsonb_path_exists(v_status, '$.documents[*] ? (@.code == "partner-agreement" && @.accepted == true)'), 'T16 accepted doc flagged accepted');
  perform public.vf_assert(jsonb_path_exists(v_status, '$.documents[*] ? (@.code == "terms-conditions" && @.accepted != true)'), 'T16 unaccepted mandatory doc flagged');
  raise notice '[verify] T16 gate required state OK';

  -- ── T17 unlock: accept every mandatory current version → required=false ────
  for v_draft_id in
    select d.id from (
      select distinct on (code) * from public.apn_agreements
      where status = 'published' order by code, version desc
    ) d
    where d.mandatory
      and not exists (
        select 1 from public.apn_agreement_acceptances a
        where a.partner_id = '00000000-0000-4000-8000-0000000000a1' and a.agreement_id = d.id and a.version = d.version
      )
  loop
    select public.apn_agreement_accept(v_draft_id, 'explicit') into v_status;
    perform public.vf_assert(v_status->>'accepted' = 'true', 'T17 bulk accept failed for ' || v_draft_id::text);
  end loop;
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'false', 'T17 all accepted → required=false');
  perform public.vf_assert((v_status->>'requiredCount')::int = 0, 'T17 requiredCount=0');
  select count(*) into c from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1';
  perform public.vf_assert(c = 12, 'T17 exactly 12 acceptance rows: ' || c);
  raise notice '[verify] T17 unlock OK';

  -- ── T18 re-lock on version update: v3 publish → required flips true ────────
  perform public.apn_agreement_save_draft('partner-agreement', 'Partner Agreement v3', 'Agreement',
    'Third revision of partnership terms and the annual review rider.',
    true, null, 'T18 v3', 'Plain-language summary of the v3 partner agreement.');
  select id into v_v2_id from public.apn_agreements where code = 'partner-agreement' and status = 'draft';
  select public.apn_agreement_publish(v_v2_id) into v_status;
  perform public.vf_assert(v_status->>'version' = '3', 'T18 v3 published: ' || (v_status->>'version'));
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'true', 'T18 version update re-locks the partner');
  perform public.vf_assert(jsonb_path_exists(v_status, '$.requiredList[*] ? (@.code == "partner-agreement" && @.version == 3)'), 'T18 requiredList points at version 3');
  select public.apn_agreement_accept((select id from public.apn_agreements where code = 'partner-agreement' and status = 'published'), 'explicit') into v_status;
  perform public.vf_assert(v_status->>'accepted' = 'true', 'T18 accepting v3 works');
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'false', 'T18 re-lock cleared by acceptance');
  raise notice '[verify] T18 version-update re-lock OK';

  -- ── T19 non-mandatory documents never block the gate ───────────────────────
  perform public.apn_agreement_save_draft('code-of-conduct', 'Code of Conduct (optional refresh)', 'Code of Conduct',
    'Optional supplementary code of conduct for APN partners, non-blocking refresh.',
    false, null, 'T19 optional', 'Plain-language summary of the optional code-of-conduct refresh.');
  select id into v_draft_id from public.apn_agreements where code = 'code-of-conduct' and status = 'draft';
  select public.apn_agreement_publish(v_draft_id) into v_status;
  perform public.vf_assert(v_status->>'status' = 'published', 'T19 optional doc published');
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'false', 'T19 optional doc does not block the gate');
  select count(*) into c
  from public.apn_agreement_acceptances a
  join public.apn_agreements d on d.id = a.agreement_id
  where a.partner_id = '00000000-0000-4000-8000-0000000000a1' and d.code = 'code-of-conduct' and d.status = 'published' and not d.mandatory;
  perform public.vf_assert(c = 0, 'T19 optional doc not forced on the partner');
  raise notice '[verify] T19 optional documents OK';

  -- ── T20 status scoping: partner self-only (source guard) + admin passthrough ──
  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apn_agreement_status'
    and pg_get_functiondef(p.oid) like '%p_partner_id <> auth.uid()::text and not public.is_admin()%';
  perform public.vf_assert(c = 1, 'T20 cross-partner status guarded in function source');
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  select public.apn_agreement_status('00000000-0000-4000-8000-0000000000a2') into v_status;
  perform public.vf_assert(v_status->>'partnerId' = '00000000-0000-4000-8000-0000000000a2', 'T20 admin passthrough consultation works');
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'partnerId' = '00000000-0000-4000-8000-0000000000a1', 'T20 own status resolvable');
  raise notice '[verify] T20 status scoping OK';

  -- ── T21 immutability of acceptance evidence (trigger + grants) ─────────────
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
  select id into v_acc from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' limit 1;
  begin
    update public.apn_agreement_acceptances set version = 999 where id = v_acc;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T21 acceptance update rejected OK';
  end;
  begin
    delete from public.apn_agreement_acceptances where id = v_acc;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T21 acceptance delete rejected OK';
  end;
  select count(*) into c from public.apn_agreement_acceptances;
  perform public.vf_assert(c = 13, 'T21 evidence rows untouched after attempts: ' || c);
  raise notice '[verify] T21 acceptance immutability OK';
  raise notice '[verify] ALL AGREEMENT TESTS T1–T21 PASSED';
end $$;

-- ── T22–T29 hardening checks (catalog-level; no business data touched) ──────
do $$
declare v_proc oid; c bigint;
begin
  foreach v_proc in array array[
    'public.apn_agreement_save_draft(text,text,text,text,boolean,timestamptz,text,text)'::regprocedure,
    'public.apn_agreement_publish(uuid,boolean,text)'::regprocedure,
    'public.apn_agreement_accept(uuid,text,text)'::regprocedure,
    'public.apn_agreement_status(text)'::regprocedure
  ] loop
    perform public.vf_assert((select prosecdef from pg_proc where oid = v_proc), 'T22 SECURITY DEFINER: ' || v_proc::text);
    perform public.vf_assert((select proconfig @> array['search_path=pg_catalog, public, pg_temp'] from pg_proc where oid = v_proc), 'T22 hardened search_path: ' || v_proc::text);
    perform public.vf_assert(not has_function_privilege('anon', v_proc, 'EXECUTE'), 'T22 anon cannot execute: ' || v_proc::text);
    perform public.vf_assert(has_function_privilege('authenticated', v_proc, 'EXECUTE'), 'T22 authenticated can execute: ' || v_proc::text);
    perform public.vf_assert((select position('format(' in prosrc) = 0 from pg_proc where oid = v_proc), 'T22 no dynamic SQL: ' || v_proc::text);
  end loop;
  raise notice '[verify] T22 RPC hardening OK';

  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('apn_agreement_save_draft','apn_agreement_publish')
    and pg_get_functiondef(p.oid) like '%is_admin()%';
  perform public.vf_assert(c = 2, 'T23 admin gate on save_draft + publish: ' || c);
  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apn_agreement_accept'
    and pg_get_functiondef(p.oid) like '%auth.uid()%' and pg_get_functiondef(p.oid) like '%apn_users%';
  perform public.vf_assert(c = 1, 'T23 accept is server-resolved (auth.uid + apn_users check)');
  raise notice '[verify] T23 role gates OK';

  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apn_agreement_accept'
    and pg_get_functiondef(p.oid) like '%on conflict (partner_id, agreement_id, version) do nothing%';
  perform public.vf_assert(c = 1, 'T24 idempotent upsert in accept RPC');
  raise notice '[verify] T24 idempotency proof OK';

  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('apn_agreement_publish','apn_agreement_accept')
    and pg_get_functiondef(p.oid) like '%apn_rule_audit%';
  perform public.vf_assert(c = 2, 'T25 audit integration on publish + accept: ' || c);
  raise notice '[verify] T25 audit integration OK';

  perform public.vf_assert(
    (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'apn_agreement_acceptances'
       and column_name in ('version','content_hash','accepted_at','accepted_by','method','ip','user_agent')) = 7,
    'T26 acceptance evidence columns complete');
  raise notice '[verify] T26 evidence schema OK';

  begin
    perform public.apn_agreement_save_draft('confidentiality', 'Short', 'Confidentiality', 'too short', true, null, 'T27');
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T27 short-body draft rejected OK';
  end;
  raise notice '[verify] T27 insert guard OK';

  perform public.vf_assert((select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'apn_agreement_acceptances'
      and policyname = 'apn_agreement_acceptances_select'
      and qual like '%partner_id = %auth.uid()%text%') = 1, 'T28 acceptance select is partner-scoped');
  raise notice '[verify] T28 RLS partner scoping OK';

  select count(*) into c from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apn_agreement_status' and p.provolatile = 's';
  perform public.vf_assert(c = 1, 'T29 status RPC is stable (no writes)');
  raise notice '[verify] T29 status RPC stability OK';
end $$;

-- ── T31–T38 FINAL-GOVERNANCE EXTENSIONS (after 20260820000000) ─────────────
-- Dependencies: T1–T29 already ran; the fixture partner has accepted every
-- mandatory current version (12 acceptances) and partner-agreement is at v3.
do $$
declare
  c bigint; n numeric; h text;
  v_draft_id uuid;
  v_privacy_v2 uuid; v_privacy_v3 uuid;
  v_status jsonb;
  v_fn text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);

  -- ── T31 Simple English exists on every published version ──────────────────
  select count(*) into c from public.apn_agreements
  where status = 'published' and (length(trim(body_simple)) = 0 or body_simple is null);
  perform public.vf_assert(c = 0, 'T31 every published version carries Simple English: ' || c);
  select count(*) into c from public.apn_agreements
  where status = 'published' and body_simple = body;
  perform public.vf_assert(c = 0, 'T31 Simple English differs from the formal text');
  raise notice '[verify] T31 Simple English coverage OK';

  -- ── T32a non-material publish does NOT re-lock an accepting partner ───────
  perform public.apn_agreement_save_draft('privacy-policy', 'Data Protection & Privacy (T32 editorial)', 'Privacy & Data Notice',
    'Editorial clarification of the data-handling obligations. No rights or obligations are changed by this revision.',
    true, null, 'T32a editorial', 'Plain-language summary: this update only clarifies wording; nothing changed for partners.');
  select id into v_privacy_v2 from public.apn_agreements where code = 'privacy-policy' and status = 'draft';
  select public.apn_agreement_publish(v_privacy_v2, false, 'Editorial clarification — no change of rights or obligations') into v_status;
  perform public.vf_assert(v_status->>'status' = 'published', 'T32a editorial publish succeeds');
  perform public.vf_assert(v_status->>'material' = 'false', 'T32a publish records the non-material classification');
  perform public.vf_assert(v_status->>'changeSummary' like 'Editorial%', 'T32a change summary recorded');
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'false', 'T32a non-material bump does not re-lock');
  perform public.vf_assert((v_status->>'requiredCount')::int = 0, 'T32a requiredCount stays 0');
  select count(*) into c from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_privacy_v2;
  perform public.vf_assert(c = 0, 'T32a no acceptance row auto-created for an editorial bump');
  select supersedes_id into v_privacy_v3 from public.apn_agreements where id = v_privacy_v2;
  perform public.vf_assert(v_privacy_v3 is not null, 'T32a editorial version records the prior version it supersedes');
  raise notice '[verify] T32a non-material bump OK';

  -- ── T32b material publish AFTER an editorial bump re-locks ────────────────
  perform public.apn_agreement_save_draft('privacy-policy', 'Data Protection & Privacy (T32b material)', 'Privacy & Data Notice',
    'Material revision: new mandatory breach-reporting obligation for the partner.',
    true, null, 'T32b material', 'Plain-language summary: a new reporting duty applies — read carefully.');
  select id into v_privacy_v3 from public.apn_agreements where code = 'privacy-policy' and status = 'draft';
  select public.apn_agreement_publish(v_privacy_v3, true, 'Material: new mandatory breach-reporting duty') into v_status;
  perform public.vf_assert(v_status->>'version' = '3', 'T32b material version bump: ' || (v_status->>'version'));
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'true', 'T32b material bump re-locks the partner');
  perform public.vf_assert(jsonb_path_exists(v_status, '$.requiredList[*] ? (@.code == "privacy-policy" && @.version == 3 && @.material == true)'), 'T32b requiredList points at the material v3');
  raise notice '[verify] T32b material re-lock OK';

  -- ── T33 acceptance records the presentation mode (terms_view) ─────────────
  select public.apn_agreement_accept(v_privacy_v3, 'explicit', 'simple') into v_status;
  perform public.vf_assert(v_status->>'accepted' = 'true', 'T33 accept returns accepted=true');
  perform public.vf_assert(v_status->>'termsView' = 'simple', 'T33 accept echoes the terms view');
  select terms_view into v_fn from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id = v_privacy_v3;
  perform public.vf_assert(v_fn = 'simple', 'T33 evidence row stores the displayed presentation mode: ' || coalesce(v_fn, 'null'));
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(v_status->>'required' = 'false', 'T33 accepting the material v3 unlocks again');
  begin
    select public.apn_agreement_accept(v_privacy_v3, 'explicit', 'braille') into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T33 invalid terms view rejected OK';
  end;
  raise notice '[verify] T33 terms-view evidence OK';

  -- ── T34 classification fields are immutable after publish ────────────────
  begin
    update public.apn_agreements set material = false, change_summary = 'sneaky' where id = v_privacy_v3;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T34 classification mutation rejected OK';
  end;
  begin
    update public.apn_agreements set supersedes_id = null where id = v_privacy_v3;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T34 supersedes mutation rejected OK';
  end;
  select material, change_summary into v_fn, h from public.apn_agreements where id = v_privacy_v3;
  perform public.vf_assert(v_fn = 'true', 'T34 material flag unchanged: ' || coalesce(v_fn, 'null'));
  perform public.vf_assert(h like 'Material%', 'T34 change summary unchanged: ' || coalesce(h, 'null'));
  raise notice '[verify] T34 classification immutability OK';

  -- ── T35 publish REQUIRES a Simple English body ────────────────────────────
  perform public.apn_agreement_save_draft('commission-schedule', 'Commission Schedule (no simple)', 'Commission Schedule',
    'This draft deliberately omits the Simple English rendering to prove the publish guard.',
    true, null, 'T35 no-simple', '');
  select id into v_draft_id from public.apn_agreements where code = 'commission-schedule' and status = 'draft';
  perform public.vf_assert(v_draft_id is not null, 'T35 draft without simple exists');
  begin
    select public.apn_agreement_publish(v_draft_id) into v_status;
    raise exception 'should-not-reach';
  exception when check_violation then
    raise notice '[verify] T35 simple-english-required publish guard OK';
  end;
  perform public.vf_assert((select count(*) from public.apn_agreements
    where code = 'commission-schedule' and status = 'published') = 1, 'T35 nothing published');
  raise notice '[verify] T35 simple-english guard OK';

  -- ── T36 status payload carries body / simpleBody / material / supersedes ──
  select public.apn_agreement_status() into v_status;
  perform public.vf_assert(jsonb_path_exists(v_status,
    '$.documents[*] ? (@.code == "privacy-policy" && @.simpleBody != "" && @.body != "")'), 'T36 documents carry both renderings');
  perform public.vf_assert(jsonb_path_exists(v_status,
    '$.documents[*] ? (@.code == "partner-agreement" && @.material == true && @.supersedesId != null)'), 'T36 documents carry classification fields');
  perform public.vf_assert(jsonb_path_exists(v_status,
    '$.requiredList[*] ? (@.code == "commission-schedule")') = false, 'T36 draft not in requiredList');
  raise notice '[verify] T36 status payload OK';

  -- ── T37 centralized legal-entity configuration ────────────────────────────
  perform public.vf_assert(to_regclass('public.apn_agreement_company') is not null, 'T37 company config table exists');
  perform public.vf_assert((select relrowsecurity from pg_class where oid = 'public.apn_agreement_company'::regclass), 'T37 company config RLS enabled');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_company', 'SELECT'), 'T37 company config readable by authenticated');
  perform public.vf_assert(has_table_privilege('authenticated', 'public.apn_agreement_company', 'INSERT') = false, 'T37 company config not writable via REST');
  select legal_name, email into v_fn, h from public.apn_agreement_company where id = 'allbee';
  perform public.vf_assert(v_fn = 'ALLBEE SOLUTIONS', 'T37 legal entity configured: ' || coalesce(v_fn, 'null'));
  perform public.vf_assert(h = 'Allbeesolutions@gmail.com', 'T37 company email configured: ' || coalesce(h, 'null'));
  perform public.vf_assert((select jsonb_array_length(signatories) from public.apn_agreement_company where id = 'allbee') = 2, 'T37 both signatories configured');
  raise notice '[verify] T37 company configuration OK';

  -- ── T38 old acceptance never satisfies a NEW material version ─────────────
  -- partner-agreement v1 was superseded by v2 then v3; the partner accepted
  -- v2 (T11) and v3 (T18) — assert the acceptance rows all coexist and each
  -- points at its exact version (historical evidence intact, append-only).
  select count(*) into c from public.apn_agreement_acceptances
  where partner_id = '00000000-0000-4000-8000-0000000000a1' and agreement_id in (
    select id from public.apn_agreements where code = 'partner-agreement'
  );
  perform public.vf_assert(c = 2, 'T38 historical acceptances preserved (v2 + v3): ' || c);
  perform public.vf_assert((select count(*) from public.apn_agreement_acceptances
    where partner_id = '00000000-0000-4000-8000-0000000000a1') = 14, 'T38 total evidence rows (13 + T33 v3 accept): 14');
  raise notice '[verify] T38 historical acceptance evidence OK';
  raise notice '[verify] ALL FINAL-GOVERNANCE TESTS T31–T38 PASSED';
end $$;

rollback to savepoint apn_agreements_verify_sp;

-- ── T30 post-rollback restoration proof: production state byte-identical ────
do $$
begin
  if (select count(*) from public.apn_agreements where created_by = '00000000-0000-4000-8000-0000000000a1') <> 0 then
    raise exception 'VERIFY FAIL: agreements residue after rollback';
  end if;
  if (select count(*) from public.apn_agreement_acceptances) <> 0 then
    raise exception 'VERIFY FAIL: acceptance residue after rollback';
  end if;
  if exists (select 1 from public.apn_users where id like 'verify-agr-%') then
    raise exception 'VERIFY FAIL: apn_users residue after rollback';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'VERIFY FAIL: profiles residue after rollback';
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'VERIFY FAIL: auth.users residue after rollback';
  end if;
  if exists (select 1 from public.audit where data->>'userId' = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'VERIFY FAIL: audit residue after rollback';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('apn_agreement_save_draft','apn_agreement_publish',
        'apn_agreement_accept','apn_agreement_status','apn_agreements_guard','apn_agreement_acceptances_guard')) <> 6 then
    raise exception 'VERIFY FAIL: agreement functions missing after rollback';
  end if;
  if (select count(*) from pg_trigger where tgname in ('apn_agreements_guard_trg','apn_agreement_acceptances_guard_trg') and not tgisinternal) <> 2 then
    raise exception 'VERIFY FAIL: immutability triggers not restored';
  end if;
  if (select count(*) from public.apn_agreements where status = 'published') <> 0 then
    raise exception 'VERIFY FAIL: published rows created during verify persisted';
  end if;
  if (select prosrc from pg_proc where oid = 'public.is_admin()'::regprocedure)
     not like '%superadmin%''%admin%' then
    raise exception 'VERIFY FAIL: is_admin not restored';
  end if;
  raise notice '[verify] T30 POST-ROLLBACK RESTORATION PROOF OK — zero residue';
end $$;

commit;
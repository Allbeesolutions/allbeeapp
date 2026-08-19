-- ══════════════════════════════════════════════════════════════════════════
-- APN — VERSIONED PARTNER AGREEMENT & T&C GOVERNANCE
--   • apn_agreements              versioned, immutable legal documents
--   • apn_agreement_acceptances   immutable per-partner acceptance evidence
--   • SECURITY DEFINER RPCs:      save_draft → publish → accept → status
--   • 12 document categories seeded as clearly-marked DRAFT placeholders
-- Idempotent: safe to re-run in the Supabase SQL editor (DDL guarded with
-- if not exists, seeds guarded with on-conflict / exists checks).
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── 1. AGREEMENT DOCUMENTS (versioned; published rows are immutable) ───────
create table if not exists public.apn_agreements (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in (
    'partner-agreement','terms-conditions','commission-schedule','code-of-conduct',
    'privacy-policy','ip-brand','confidentiality','lead-client-management',
    'quotation-sales','training-certification','suspension-termination','dispute-grievance')),
  version integer not null check (version >= 1),
  title text not null,
  category text not null check (category in (
    'Agreement','Terms & Conditions','Commission Schedule','Code of Conduct',
    'Privacy & Data Notice','IP & Brand','Confidentiality','Lead & Client Management',
    'Quotation & Sales','Training & Certification','Suspension & Termination','Dispute & Grievance')),
  body text not null,
  content_hash text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  mandatory boolean not null default true,
  reason text,
  effective_from timestamptz not null default now(),
  published_at timestamptz,
  published_by text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version)
);

alter table public.apn_agreements enable row level security;
revoke all on public.apn_agreements from public, anon, authenticated;
grant select on public.apn_agreements to authenticated;

-- Partners may read only PUBLISHED documents through REST; the management
-- group may read everything (drafts + superseded history for the console).
drop policy if exists apn_agreements_select on public.apn_agreements;
create policy apn_agreements_select on public.apn_agreements
  for select to authenticated
  using (public.is_admin() or status = 'published');

-- ── 2. ACCEPTANCE EVIDENCE (append-only; written only by the accept RPC) ───
create table if not exists public.apn_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  agreement_id uuid not null references public.apn_agreements(id) on delete restrict,
  version integer not null,
  content_hash text not null,
  accepted_at timestamptz not null default now(),
  accepted_by text,
  method text not null default 'explicit',
  ip text,
  user_agent text,
  unique (partner_id, agreement_id, version)
);

alter table public.apn_agreement_acceptances enable row level security;
revoke all on public.apn_agreement_acceptances from public, anon, authenticated;
grant select on public.apn_agreement_acceptances to authenticated;

drop policy if exists apn_agreement_acceptances_select on public.apn_agreement_acceptances;
create policy apn_agreement_acceptances_select on public.apn_agreement_acceptances
  for select to authenticated
  using (public.is_admin() or partner_id = auth.uid()::text);

create index if not exists apn_agreements_code_version_idx on public.apn_agreements (code, version desc);
create index if not exists apn_agreement_acceptances_partner_idx on public.apn_agreement_acceptances (partner_id, agreement_id);

-- ── 3. IMMUTABILITY GUARDS (belt-and-suspenders under the grant model) ──────
-- No client role has write grants on either table; the RPCs below are the only
-- writers. These triggers additionally forbid any field mutation of published
-- / superseded documents and any delete of acceptance evidence.
create or replace function public.apn_agreements_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Agreement documents cannot be deleted.' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not public.is_admin() then
      raise exception 'Only administrators may create agreement documents.' using errcode = 'insufficient_privilege';
    end if;
    if length(trim(new.body)) < 10 then
      raise exception 'Agreement body is too short.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.status in ('published','superseded') then
    if old.status = 'published' and new.status = 'superseded'
       and old.title = new.title and old.category = new.category and old.body = new.body
       and old.content_hash = new.content_hash then
      return new;  -- the publish RPC marks the previous version superseded
    end if;
    raise exception 'Published agreement versions are immutable.' using errcode = 'check_violation';
  end if;
  if old.status = 'draft' and new.status <> 'draft' and not public.is_admin() then
    raise exception 'Only administrators may publish agreement documents.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists apn_agreements_guard_trg on public.apn_agreements;
create trigger apn_agreements_guard_trg
  before insert or update or delete on public.apn_agreements
  for each row execute function public.apn_agreements_guard();

create or replace function public.apn_agreement_acceptances_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  raise exception 'Acceptance evidence is immutable.' using errcode = 'check_violation';
end;
$$;
drop trigger if exists apn_agreement_acceptances_guard_trg on public.apn_agreement_acceptances;
create trigger apn_agreement_acceptances_guard_trg
  before update or delete on public.apn_agreement_acceptances
  for each row execute function public.apn_agreement_acceptances_guard();

-- ── 4. WRITE RPCs (SECURITY DEFINER; the only write path) ──────────────────
-- Create (or refresh) the working draft of a document code. A new draft gets
-- version = max(version) + 1, so every future publish is a fresh immutable
-- version and NEVER mutates a previously published document.
create or replace function public.apn_agreement_save_draft(
  p_code text,
  p_title text,
  p_category text,
  p_body text,
  p_mandatory boolean default true,
  p_effective_from timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators may edit agreement documents.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_title), '') is null
     or nullif(trim(p_category), '') is null or nullif(trim(p_body), '') is null then
    raise exception 'Code, title, category and body are required.' using errcode = 'check_violation';
  end if;
  if p_category not in (
    'Agreement','Terms & Conditions','Commission Schedule','Code of Conduct',
    'Privacy & Data Notice','IP & Brand','Confidentiality','Lead & Client Management',
    'Quotation & Sales','Training & Certification','Suspension & Termination','Dispute & Grievance') then
    raise exception 'Unknown agreement category.' using errcode = 'check_violation';
  end if;
  select id, version into v_id, v_version
  from public.apn_agreements
  where code = p_code and status = 'draft'
  order by version desc limit 1;
  if v_id is null then
    select coalesce(max(version), 0) + 1 into v_version from public.apn_agreements where code = p_code;
    insert into public.apn_agreements (code, version, title, category, body, mandatory, effective_from, reason, created_by)
    values (p_code, v_version, trim(p_title), p_category, p_body, coalesce(p_mandatory, true),
            coalesce(p_effective_from, now()), p_reason, auth.uid()::text)
    returning id into v_id;
  else
    update public.apn_agreements
    set title = trim(p_title), category = p_category, body = p_body,
        mandatory = coalesce(p_mandatory, true),
        effective_from = coalesce(p_effective_from, now()),
        reason = p_reason, updated_at = now()
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'code', p_code, 'version', v_version, 'status', 'draft');
end;
$$;
revoke all on function public.apn_agreement_save_draft(text, text, text, text, boolean, timestamptz, text) from public, anon;
grant execute on function public.apn_agreement_save_draft(text, text, text, text, boolean, timestamptz, text) to authenticated;

-- Publish a draft: stamps the SHA-256 content hash, activates it (and only it)
-- as the current version of its code, and marks every earlier published
-- version superseded. Rejects an identical re-publish of the same content.
create or replace function public.apn_agreement_publish(p_agreement_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row public.apn_agreements%rowtype;
  v_hash text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators may publish agreement documents.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_row from public.apn_agreements where id = p_agreement_id;
  if not found then
    raise exception 'Agreement document not found.' using errcode = 'no_data_found';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'Only drafts can be published.' using errcode = 'check_violation';
  end if;
  v_hash := encode(digest(v_row.title || E'\n\n' || v_row.body, 'sha256'), 'hex');
  if exists (
    select 1 from public.apn_agreements x
    where x.code = v_row.code and x.status = 'published' and x.content_hash = v_hash
  ) then
    raise exception 'An identical version of this document is already published.' using errcode = 'check_violation';
  end if;
  perform set_config('row_security', 'off', true);
  update public.apn_agreements
  set status = 'published', content_hash = v_hash, published_at = now(),
      published_by = auth.uid()::text, updated_at = now()
  where id = p_agreement_id;
  update public.apn_agreements set status = 'superseded', updated_at = now()
  where code = v_row.code and status = 'published' and id <> p_agreement_id;
  perform public.apn_rule_audit('published agreement', 'apn_agreements', p_agreement_id::text,
    jsonb_build_object('code', v_row.code, 'version', v_row.version, 'contentHash', v_hash,
      'title', v_row.title, 'category', v_row.category));
  return jsonb_build_object('id', p_agreement_id, 'code', v_row.code, 'version', v_row.version,
    'status', 'published', 'contentHash', v_hash);
end;
$$;
revoke all on function public.apn_agreement_publish(uuid) from public, anon;
grant execute on function public.apn_agreement_publish(uuid) to authenticated;

-- Record the caller's acceptance of the CURRENT published version of a
-- document. The partner id, version and content hash are resolved server-side
-- from auth.uid() and the published row — a client can never select which
-- version it accepts or accept on behalf of another partner. Acceptance is
-- idempotent (unique partner + document + version) and the evidence row is
-- permanently immutable. The server-observed request headers supply the IP
-- and User-Agent when PostgREST exposes them.
create or replace function public.apn_agreement_accept(p_agreement_id uuid, p_method text default 'explicit')
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_partner_id text := auth.uid()::text;
  v_row public.apn_agreements%rowtype;
  v_id uuid;
  v_ip text;
  v_ua text;
  v_headers text := nullif(current_setting('request.headers', true), '');
begin
  if v_partner_id is null then
    raise exception 'Sign in to accept an agreement.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.apn_users u
    where u.id = v_partner_id and coalesce(u.data->>'status', '') = 'active'
  ) then
    raise exception 'Only an active APN partner can accept agreements.' using errcode = 'check_violation';
  end if;
  select * into v_row from public.apn_agreements where id = p_agreement_id;
  if not found then
    raise exception 'Agreement document not found.' using errcode = 'no_data_found';
  end if;
  if v_row.status <> 'published' then
    raise exception 'Only the currently published version can be accepted.' using errcode = 'check_violation';
  end if;
  if v_headers is not null and v_headers <> '' then
    begin
      v_ip := (v_headers::jsonb->>'x-forwarded-for');
      v_ua := (v_headers::jsonb->>'user-agent');
    exception when others then null; end;
  end if;
  perform set_config('row_security', 'off', true);
  insert into public.apn_agreement_acceptances
    (partner_id, agreement_id, version, content_hash, accepted_by, method, ip, user_agent)
  values
    (v_partner_id, p_agreement_id, v_row.version, v_row.content_hash, v_partner_id,
     coalesce(nullif(trim(p_method), ''), 'explicit'), v_ip, v_ua)
  on conflict (partner_id, agreement_id, version) do nothing
  returning id into v_id;
  perform public.apn_rule_audit('accepted agreement', 'apn_agreement_acceptances', coalesce(v_id::text, p_agreement_id::text),
    jsonb_build_object('partnerId', v_partner_id, 'agreementId', p_agreement_id::text,
      'code', v_row.code, 'version', v_row.version, 'contentHash', v_row.content_hash,
      'method', coalesce(nullif(trim(p_method), ''), 'explicit')));
  return jsonb_build_object('agreementId', p_agreement_id, 'code', v_row.code, 'version', v_row.version,
    'contentHash', v_row.content_hash, 'accepted', v_id is not null);
end;
$$;
revoke all on function public.apn_agreement_accept(uuid, text) from public, anon;
grant execute on function public.apn_agreement_accept(uuid, text) to authenticated;

-- ── 5. STATUS (single source of truth for the app's agreement gate) ────────
-- Returns, for the calling partner (or any partner when an admin passes one):
--   • documents — the CURRENT published version of every document code, with
--     the caller's acceptance state (accepted / acceptedAt / acceptedVersion)
--   • requiredList / required — mandatory current documents not yet accepted;
--     the app must block APN access until required is false.
create or replace function public.apn_agreement_status(p_partner_id text default null)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_pid text := coalesce(p_partner_id, auth.uid()::text);
  v_docs jsonb;
  v_required jsonb;
  v_doc record;
  v_acc record;
  v_required_list jsonb := '[]'::jsonb;
begin
  if p_partner_id is not null and p_partner_id <> auth.uid()::text and not public.is_admin() then
    raise exception 'You can only view your own agreement status.' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', docs.id, 'code', docs.code, 'title', docs.title, 'category', docs.category,
    'version', docs.version, 'mandatory', docs.mandatory, 'contentHash', docs.content_hash,
    'effectiveFrom', docs.effective_from, 'publishedAt', docs.published_at,
    'accepted', coalesce(acc.accepted, false),
    'acceptedAt', acc.accepted_at, 'acceptedVersion', acc.version
  ) order by docs.code), '[]'::jsonb)
  into v_docs
  from (
    select distinct on (code) *
    from public.apn_agreements
    where status = 'published'
    order by code, version desc
  ) docs
  left join lateral (
    select a.accepted_at, a.version, true as accepted
    from public.apn_agreement_acceptances a
    where a.partner_id = v_pid and a.agreement_id = docs.id and a.version = docs.version
  ) acc on true;
  for v_doc in
    select d.*
    from (
      select distinct on (code) *
      from public.apn_agreements
      where status = 'published'
      order by code, version desc
    ) d
    where d.mandatory
      and not exists (
        select 1 from public.apn_agreement_acceptances a
        where a.partner_id = v_pid and a.agreement_id = d.id and a.version = d.version
      )
  loop
    v_required_list := v_required_list || jsonb_build_object(
      'id', v_doc.id, 'code', v_doc.code, 'title', v_doc.title, 'category', v_doc.category,
      'version', v_doc.version, 'mandatory', v_doc.mandatory, 'contentHash', v_doc.content_hash,
      'effectiveFrom', v_doc.effective_from, 'publishedAt', v_doc.published_at);
  end loop;
  v_required := jsonb_build_object('count', jsonb_array_length(v_required_list), 'documents', v_required_list);
  return jsonb_build_object(
    'partnerId', v_pid,
    'documents', v_docs,
    'required', jsonb_array_length(v_required_list) > 0,
    'requiredList', v_required_list,
    'requiredCount', jsonb_array_length(v_required_list),
    'requestedAt', now()
  );
end;
$$;
revoke all on function public.apn_agreement_status(text) from public, anon;
grant execute on function public.apn_agreement_status(text) to authenticated;

-- ── 6. SEED — the twelve driver documents as marked DRAFT placeholders. ─────
-- The scaffolding is live from day one, but NO text binds a partner until the
-- business/legal owner supplies the final wording and an admin publishes it
-- (drafts never activate the gate). The DRAFT marker is intentional: replace
-- the placeholder body below, then Publish from the admin console.
insert into public.apn_agreements (code, version, title, category, body, status, mandatory, created_by, reason)
select d.code, 1, d.title, d.category,
       '[ DRAFT — placeholder ] ALLBEE SOLUTIONS ' || d.title || '. This document is a placeholder prepared for the '
       || 'agreement governance rollout. It must NOT be treated as binding. The final wording will be provided by the '
       || 'ALLBEE business/legal owner before publication; until then this document remains draft.',
       'draft', true, 'system', 'Seed draft — awaiting final legal wording from the owner.'
from (values
  ('partner-agreement',        'Partner Agreement',                    'Agreement'),
  ('terms-conditions',         'Terms & Conditions',                   'Terms & Conditions'),
  ('commission-schedule',      'Commission Schedule',                  'Commission Schedule'),
  ('code-of-conduct',          'Code of Conduct',                      'Code of Conduct'),
  ('privacy-policy',           'Privacy & Data Notice',                'Privacy & Data Notice'),
  ('ip-brand',                 'IP & Brand Usage',                     'IP & Brand'),
  ('confidentiality',          'Confidentiality Undertaking',          'Confidentiality'),
  ('lead-client-management',   'Lead & Client Management',             'Lead & Client Management'),
  ('quotation-sales',          'Quotation & Sales Practices',          'Quotation & Sales'),
  ('training-certification',   'Training & Certification',             'Training & Certification'),
  ('suspension-termination',   'Suspension & Termination',             'Suspension & Termination'),
  ('dispute-grievance',        'Dispute & Grievance',                  'Dispute & Grievance')
) as d(code, title, category)
where not exists (select 1 from public.apn_agreements a where a.code = d.code);
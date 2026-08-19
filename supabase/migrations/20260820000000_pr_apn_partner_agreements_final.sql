-- ══════════════════════════════════════════════════════════════════════════
-- APN — FINAL PARTNER AGREEMENT SYSTEM (production content + governance)
--   Applies ON TOP of 20260819120000_pr_apn_partner_agreements.sql.
--   What this migration delivers:
--     1. schema refinements
--          • body_simple        — Simple-English rendering of the SAME legal
--                                 version (required before publish)
--          • material           — material vs non-material (editorial) change
--                                 classification recorded at publish time
--          • supersedes_id      — the exact prior version a publish replaces
--          • change_summary     — admin note for version history
--          • apn_agreements.material/supersedes_id/change_summary become
--            IMMUTABLE once published (hardened guard trigger)
--          • terms_view         — 'normal' | 'simple' recorded on acceptance
--                                 evidence (which presentation was displayed)
--          • apn_agreement_company — centralized legal-entity configuration
--     2. final commercial content for all 12 documents (owner-approved rules)
--         replacing ONLY the `[ DRAFT` marked placeholder seeds (idempotent;
--         customized drafts and any published history are never touched)
--     3. status RPC satisfaction rule for non-material versions:
--         a non-material bump is satisfied by acceptance of the version it
--         supersedes; a material bump always requires a fresh acceptance.
--   Idempotent: safe to re-run in the Supabase SQL editor.
--   NOTE: final wording still requires review by qualified legal counsel —
--   that review status is stated inside every document body (Phase 20).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 0. DROP OBSOLETE BASE OVERLOADS ────────────────────────────────────────
-- The base migration shipped 1-arg publish / 7-arg save_draft / 2-arg accept
-- signatures. The re-defined 3/8/3-arg versions below carry default arguments,
-- so BOTH overloads exist side by side and ANY positional call becomes
-- ambiguous ("function is not unique"). Drop the obsolete shapes — the new
-- signatures are the only ones the app and the verification suite call.
drop function if exists public.apn_agreement_publish(uuid);
drop function if exists public.apn_agreement_save_draft(text, text, text, text, boolean, timestamptz, text);
drop function if exists public.apn_agreement_accept(uuid, text);

-- ── 1.1 AGREEMENTS — simple-English body + classification fields ───────────
alter table public.apn_agreements
  add column if not exists body_simple text not null default '',
  add column if not exists material boolean not null default true,
  add column if not exists supersedes_id uuid references public.apn_agreements(id) on delete set null,
  add column if not exists change_summary text;

create index if not exists apn_agreements_supersedes_idx on public.apn_agreements (supersedes_id);

-- ── 1.2 ACCEPTANCES — which presentation mode was displayed ────────────────
alter table public.apn_agreement_acceptances
  add column if not exists terms_view text not null default 'normal';

-- ── 1.3 COMPANY / LEGAL-ENTITY CONFIGURATION (single source of truth) ──────
-- Bodies are static legal text, so the address/email/signatories are ALSO
-- seeded into the documents below; this row is the centralized configuration
-- that future migrations and the app's Agreement Center read, so a change of
-- address, email or signatory needs exactly one place to update.
create table if not exists public.apn_agreement_company (
  id text primary key default 'allbee',
  legal_name text not null,
  trade_name text not null default 'ALLBEE',
  address_line1 text not null,
  address_line2 text not null default '',
  city text not null,
  state text not null,
  country text not null default 'India',
  postal_code text not null,
  email text not null,
  governance_framework text not null default 'India / Tamil Nadu',
  governing_law text not null default 'India',
  jurisdiction_place text not null default 'Nagapattinam, Tamil Nadu',
  signatories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.apn_agreement_company enable row level security;
revoke all on public.apn_agreement_company from public, anon, authenticated;
grant select on public.apn_agreement_company to authenticated;

drop policy if exists apn_agreement_company_select on public.apn_agreement_company;
create policy apn_agreement_company_select on public.apn_agreement_company
  for select to authenticated using (true);

insert into public.apn_agreement_company
  (id, legal_name, trade_name, address_line1, address_line2, city, state, country, postal_code, email,
   governance_framework, governing_law, jurisdiction_place, signatories)
values (
  'allbee', 'ALLBEE SOLUTIONS', 'ALLBEE',
  'No.80, Noori Complex', 'Nagore', 'Nagapattinam', 'Tamil Nadu', 'India', '611 002',
  'Allbeesolutions@gmail.com', 'India / Tamil Nadu', 'India', 'Nagapattinam, Tamil Nadu',
  jsonb_build_array(
    jsonb_build_object('name', 'Z. Mohamed Backer Alim Sahib', 'role', 'Founder & CEO', 'credentials', 'B.E ECE, DECE, CCNA'),
    jsonb_build_object('name', 'Syed Hasan Kuddos Sahib S', 'role', 'Co-Founder & CFO', 'credentials', 'BBA (Financial Service), LLB (Hons) pursuing')
  )
)
on conflict (id) do nothing;

-- ── 1.4 HARDENED IMMUTABILITY GUARD ────────────────────────────────────────
-- A published/superseded version is now fully frozen: status is the ONLY
-- field a published row may change (published → superseded). Classification
-- fields (material, supersedes_id, change_summary, body_simple) included.
create or replace function public.apn_agreements_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_unchanged boolean;
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
    v_unchanged := old.title = new.title and old.category = new.category
      and old.body = new.body and old.body_simple = new.body_simple
      and old.content_hash = new.content_hash and old.mandatory = new.mandatory
      and old.material = new.material and old.supersedes_id is not distinct from new.supersedes_id
      and old.change_summary is not distinct from new.change_summary
      and old.effective_from is not distinct from new.effective_from
      and old.published_at is not distinct from new.published_at
      and old.published_by is not distinct from new.published_by
      and old.reason is not distinct from new.reason;
    if old.status = 'published' and new.status = 'superseded' and v_unchanged then
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

-- ── 1.5 SAVE DRAFT + SIMPLE ENGLISH ────────────────────────────────────────
-- p_body_simple is the plain-language rendering of the SAME legal version.
-- While a draft, it may be empty; publish REQUIRES it (Simple English must
-- exist for every published document).
create or replace function public.apn_agreement_save_draft(
  p_code text,
  p_title text,
  p_category text,
  p_body text,
  p_mandatory boolean default true,
  p_effective_from timestamptz default null,
  p_reason text default null,
  p_body_simple text default ''
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
    insert into public.apn_agreements (code, version, title, category, body, body_simple, mandatory, effective_from, reason, created_by)
    values (p_code, v_version, trim(p_title), p_category, p_body, coalesce(p_body_simple, ''),
            coalesce(p_mandatory, true), coalesce(p_effective_from, now()), p_reason, auth.uid()::text)
    returning id into v_id;
  else
    update public.apn_agreements
    set title = trim(p_title), category = p_category, body = p_body,
        body_simple = coalesce(p_body_simple, ''),
        mandatory = coalesce(p_mandatory, true),
        effective_from = coalesce(p_effective_from, now()),
        reason = p_reason, updated_at = now()
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'code', p_code, 'version', v_version, 'status', 'draft');
end;
$$;
revoke all on function public.apn_agreement_save_draft(text, text, text, text, boolean, timestamptz, text, text) from public, anon;
grant execute on function public.apn_agreement_save_draft(text, text, text, text, boolean, timestamptz, text, text) to authenticated;

-- ── 1.6 PUBLISH + CHANGE CLASSIFICATION ────────────────────────────────────
-- p_material: true (default) = partners must review & accept → APN blocked
-- until accepted; false = editorial/non-material → no re-blocking (the status
-- RPC treats acceptance of the superseded version as satisfaction).
-- p_change_summary is stored on the version for the admin history view.
-- The content hash now covers BOTH the formal text and the Simple-English
-- rendering, so acceptance evidence pins the exact content displayed.
create or replace function public.apn_agreement_publish(p_agreement_id uuid, p_material boolean default true, p_change_summary text default null)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row public.apn_agreements%rowtype;
  v_hash text;
  v_prior uuid;
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
  if coalesce(nullif(trim(v_row.body_simple), ''), '') = '' then
    raise exception 'A Simple English version is required before publishing.' using errcode = 'check_violation';
  end if;
  v_hash := encode(extensions.digest(v_row.title || E'\n\n' || v_row.body || E'\n\n[SIMPLE ENGLISH]\n' || v_row.body_simple, 'sha256'), 'hex');
  if exists (
    select 1 from public.apn_agreements x
    where x.code = v_row.code and x.status = 'published' and x.content_hash = v_hash
  ) then
    raise exception 'An identical version of this document is already published.' using errcode = 'check_violation';
  end if;
  perform set_config('row_security', 'off', true);
  select id into v_prior
  from public.apn_agreements
  where code = v_row.code and status = 'published'
  order by version desc limit 1;
  update public.apn_agreements
  set status = 'published', content_hash = v_hash,
      material = coalesce(p_material, true),
      change_summary = nullif(trim(p_change_summary), ''),
      supersedes_id = v_prior,
      published_at = now(), published_by = auth.uid()::text, updated_at = now()
  where id = p_agreement_id;
  update public.apn_agreements set status = 'superseded', updated_at = now()
  where code = v_row.code and status = 'published' and id <> p_agreement_id;
  perform public.apn_rule_audit('published agreement', 'apn_agreements', p_agreement_id::text,
    jsonb_build_object('code', v_row.code, 'version', v_row.version, 'contentHash', v_hash,
      'material', coalesce(p_material, true), 'changeSummary', nullif(trim(p_change_summary), ''),
      'supersedesId', v_prior, 'title', v_row.title, 'category', v_row.category));
  return jsonb_build_object('id', p_agreement_id, 'code', v_row.code, 'version', v_row.version,
    'status', 'published', 'contentHash', v_hash, 'material', coalesce(p_material, true),
    'changeSummary', nullif(trim(p_change_summary), ''), 'supersedesId', v_prior);
end;
$$;
revoke all on function public.apn_agreement_publish(uuid, boolean, text) from public, anon;
grant execute on function public.apn_agreement_publish(uuid, boolean, text) to authenticated;

-- ── 1.7 ACCEPT + TERMS VIEW ────────────────────────────────────────────────
-- p_terms_view records which presentation mode ('normal' | 'simple') was
-- displayed at acceptance. Acceptance logic is otherwise unchanged and the
-- evidence row remains permanently immutable.
create or replace function public.apn_agreement_accept(p_agreement_id uuid, p_method text default 'explicit', p_terms_view text default 'normal')
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
  if coalesce(p_terms_view, 'normal') not in ('normal','simple') then
    raise exception 'Unknown terms view.' using errcode = 'check_violation';
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
    (partner_id, agreement_id, version, content_hash, accepted_by, method, terms_view, ip, user_agent)
  values
    (v_partner_id, p_agreement_id, v_row.version, v_row.content_hash, v_partner_id,
     coalesce(nullif(trim(p_method), ''), 'explicit'), coalesce(p_terms_view, 'normal'), v_ip, v_ua)
  on conflict (partner_id, agreement_id, version) do nothing
  returning id into v_id;
  perform public.apn_rule_audit('accepted agreement', 'apn_agreement_acceptances', coalesce(v_id::text, p_agreement_id::text),
    jsonb_build_object('partnerId', v_partner_id, 'agreementId', p_agreement_id::text,
      'code', v_row.code, 'version', v_row.version, 'contentHash', v_row.content_hash,
      'method', coalesce(nullif(trim(p_method), ''), 'explicit'),
      'termsView', coalesce(p_terms_view, 'normal')));
  return jsonb_build_object('agreementId', p_agreement_id, 'code', v_row.code, 'version', v_row.version,
    'contentHash', v_row.content_hash, 'accepted', v_id is not null,
    'termsView', coalesce(p_terms_view, 'normal'));
end;
$$;
revoke all on function public.apn_agreement_accept(uuid, text, text) from public, anon;
grant execute on function public.apn_agreement_accept(uuid, text, text) to authenticated;

-- ── 1.8 STATUS — satisfaction rule for non-material versions ────────────────
-- documents now carry material / supersedesId / changeSummary AND the
-- full rendered texts (simpleBody) so the gate and reader need no second
-- lookup. requiredList applies the rule:
--   material version  → direct acceptance of THIS version required
--   non-material bump → acceptance of the superseded version satisfies it
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
    'material', docs.material, 'supersedesId', docs.supersedes_id, 'changeSummary', docs.change_summary,
    'body', docs.body, 'simpleBody', docs.body_simple,
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
      and not (
        exists (
          select 1 from public.apn_agreement_acceptances a
          where a.partner_id = v_pid and a.agreement_id = d.id and a.version = d.version
        )
        or (
          d.material = false and d.supersedes_id is not null
          and exists (
            select 1 from public.apn_agreement_acceptances a
            where a.partner_id = v_pid and a.agreement_id = d.supersedes_id
          )
        )
      )
  loop
    v_required_list := v_required_list || jsonb_build_object(
      'id', v_doc.id, 'code', v_doc.code, 'title', v_doc.title, 'category', v_doc.category,
      'version', v_doc.version, 'mandatory', v_doc.mandatory, 'contentHash', v_doc.content_hash,
      'material', v_doc.material, 'supersedesId', v_doc.supersedes_id, 'changeSummary', v_doc.change_summary,
      'body', v_doc.body, 'simpleBody', v_doc.body_simple,
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

-- ══════════════════════════════════════════════════════════════════════════
-- 2. FINAL DOCUMENT CONTENT (12 documents; owner-approved commercial rules)
--    Replaces ONLY drafts that still carry the `[ DRAFT` placeholder marker.
--    Published/superseded history, customized drafts and acceptance evidence
--    are NEVER touched. All bodies are re-runnable (guard on the marker).
--    Each document states its review status: commercial terms finalized,
--    legal text pending qualified-counsel approval before production use.
-- ══════════════════════════════════════════════════════════════════════════

-- 2.1 APN PARTNER MASTER AGREEMENT ─────────────────────────────────────────
update public.apn_agreements set
  title = 'APN Partner Master Agreement',
  body = $doc1$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. PURPOSE AND PARTIES
1.1 This APN Partner Master Agreement ("Master Agreement") is between ALLBEE SOLUTIONS, No.80, Noori Complex, Nagore – 611 002, Tamil Nadu, India, email Allbeesolutions@gmail.com ("AllBee"), and the partner whose identity and APN partner account are recorded in the APN system ("Partner").
1.2 The Partner has applied to participate in the ALLBEE Partner Network ("APN") and has been approved by AllBee. This Master Agreement states the basis on which the Partner participates in APN.

2. THE APN PARTNER AGREEMENT SYSTEM
2.1 This Master Agreement is the controlling document of a system of agreements. The following documents are schedules to this Master Agreement and are published, versioned and accepted through the same system: General Terms & Conditions; Commission & Compensation Schedule; Code of Conduct & Prohibited Activities; Data Protection & Privacy; Brand & Intellectual Property Usage; Confidentiality & Trade Secrets; Lead Ownership, Referral & Customer Handling Rules; Quotation & Pricing Rules; Training & Certification; Account Governance, Inactivity, Suspension & Termination; and Disputes, Governing Law & General Legal Terms.
2.2 The current published version of each document becomes binding on the date it is accepted by the Partner in the manner described in clause 5. Where a document says it is not required, or is later replaced, the version expressed as current in the APN agreement system governs.
2.3 If any Schedule conflicts with this Master Agreement, this Master Agreement prevails to the extent of the conflict.

3. INDEPENDENT RELATIONSHIP
3.1 The Partner participates in APN as an independent business and referral partner. The Partner is not an employee of AllBee and is not engaged as an agent, and nothing in this system creates a contract of employment, a partnership, a joint venture or a principal-agent relationship.
3.2 The Partner is not authorised to bind AllBee to any contract, commitment, price, discount or representation.
3.3 APN activity measures, including check-ins and activity records, exist for APN activity governance and continuity of the APN relationship. They are not employment attendance records and are not evidence of an employment relationship.
3.4 The Partner is responsible for the Partner's own applicable taxes, registrations and statutory obligations, subject to any lawful deduction or reporting AllBee is required to perform.

4. PARTNER STATUS
4.1 The Partner's status is recorded in the APN system and progresses along the following ladder as AllBee determines from time to time: Trainee Partner, Active Partner, Senior Partner, District Leader and State Leader.
4.2 A change in status does not by itself create any additional commission or compensation rate beyond the Commission & Compensation Schedule.

5. ELECTRONIC ACCEPTANCE
5.1 The Partner accepts each current version of the documents in this system electronically through the APN portal. Each acceptance records the partner identity, partner/account ID, agreement ID, version, acceptance timestamp, acceptance method, the presentation mode displayed (formal terms or Simple English), the document content hash and, where the system receives it, device and IP metadata.
5.2 Acceptance evidence is append-only. A historical acceptance record is never altered, overwritten or deleted. When a document is updated, a new version is created and, where that change is material, the Partner must accept the new version.

6. VERSIONING AND CLASSIFICATION OF CHANGES
6.1 The version expressed as current in the APN agreement system governs. Historical versions remain readable, and acceptance records always refer to the exact version accepted.
6.2 Changes are classified at the time of publication. A material change is a new version that the Partner must review and accept, and APN functionality remains blocked until the new version is accepted. A non-material (editorial) change is published without requiring a fresh acceptance and does not block APN access.
6.3 Where AllBee is uncertain whether a change is material, it is treated as material.

7. COMMISSION PARTICIPATION
7.1 The Partner earns commission only as provided in the Commission & Compensation Schedule and only through the APN commission engine operated by AllBee. This Master Agreement creates no other entitlement.
7.2 Commission eligibility, reversals, adjustments and offsets are governed by that Schedule and by the commission rules implemented in the APN system, not by this clause.

8. TERM, TERMINATION AND SUSPENSION
8.1 This Master Agreement continues while the Partner's APN account is approved and active under the Account Governance, Inactivity, Suspension & Termination schedule and may be suspended, made inactive or terminated as provided there.
8.2 On termination the clauses that must survive (including confidentiality, data protection, intellectual property, commission reconciliation and dispute resolution) survive in accordance with their terms.

9. AMENDMENTS AND ENTIRE AGREEMENT
9.1 This system of agreements, in its current versions, constitutes the entire agreement between AllBee and the Partner concerning APN, and replaces and supersedes any prior oral or written understanding on the same subject.
9.2 Amendments take effect only through new published versions of the documents in this system.

10. GENERAL
10.1 Assignment: the Partner may not assign or transfer the benefits or obligations of this Master Agreement without AllBee's prior written consent.
10.2 Waiver: a delay or failure by either party to enforce a right is not a waiver of that right.
10.3 Severability: if any part of this system is found unenforceable, the remainder continues in force to the fullest extent permitted by law.
10.4 Notices: AllBee gives notices through the APN system and to the email recorded for the Partner; the Partner should keep them current.
10.5 Signatories: AllBee's authorized signatories are the Founder & CEO and the Co-Founder & CFO as configured in the ALLBEE legal entity configuration.

Authorized for the company: Z. Mohamed Backer Alim Sahib (Founder & CEO); Syed Hasan Kuddos Sahib S (Co-Founder & CFO).$doc1$,
  body_simple = $doc1s$WHAT THIS IS
• This is the main APN agreement between you and ALLBEE SOLUTIONS. All the other APN documents (commission, conduct, data, brand, confidentiality, leads, quotations, training, suspension and disputes) are part of this same system.

WHAT YOU CAN DO
• You can take part in APN as an independent business and referral partner. You earn commission as described in the Commission & Compensation Schedule.
• You can use the APN portal, and your status can grow from Trainee Partner up to State Leader.

WHAT YOU CANNOT DO
• You are NOT an employee of AllBee. You cannot sign contracts for AllBee, fix prices, promise discounts, or bind AllBee in any way.
• You cannot treat activity check-ins as job attendance — they exist to keep APN healthy.
• You cannot transfer this agreement to someone else without AllBee's permission.

WHAT HAPPENS IF YOU BREAK THIS RULE
• AllBee can suspend, make inactive or close your APN account under the Account Governance schedule. Your own taxes and legal duties stay yours, subject to lawful deductions by AllBee.
• When a material change is published, your APN access stays blocked until you accept the new version. Small editorial changes do not block you.$doc1s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'partner-agreement' and status = 'draft' and body like '[ DRAFT%';

-- 2.2 GENERAL TERMS & CONDITIONS ───────────────────────────────────────────
update public.apn_agreements set
  title = 'General Terms & Conditions',
  body = $doc2$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. ACCOUNT AND APPROVAL
1.1 The Partner's username, password and security details are personal and confidential. The Partner shall not share credentials with any person and shall immediately report any suspected compromise through the support process.
1.2 The Partner shall keep the contact and record details in the APN system accurate and current.

2. USE OF THE SYSTEM
2.1 The Partner shall use the APN system and portal only for legitimate APN business purposes and in compliance with these terms and the Code of Conduct.
2.2 The Partner shall not: scrape, bulk-export or systematically extract data from AllBee systems; use automated means to create accounts, referrals, attendance, activity, leads or transactions; or interfere with the normal operation of the systems.

3. INFORMATION AND RECORDS
3.1 Information the Partner provides to AllBee must be truthful and accurate. False, duplicate or manipulated records are a material breach.
3.2 Transactions with customers are recorded through the prescribed APN processes. Unless the exception in the Lead Ownership, Referral & Customer Handling Rules applies, customers pay AllBee directly.

4. QUOTATIONS AND ESTIMATES
4.1 Quotations created by the Partner are estimates prepared under the Quotation & Pricing Rules. They are not binding contracts and are not committed by AllBee until AllBee's official acceptance process completes.

5. LIABILITY
5.1 AllBee provides the APN system with reasonable care and makes it available on an "as is" and "as available" basis to the extent permitted by law.
5.2 To the extent permitted by law, AllBee's aggregate liability to the Partner arising out of or in connection with this system of agreements shall not exceed the commission amounts paid to the Partner in the three months preceding the event giving rise to liability, except where the liability arises from AllBee's fraud or willful misconduct.
5.3 Nothing in these terms excludes or limits any liability that cannot be excluded or limited under applicable law.

6. NO GUARANTEE OF RESULTS
6.1 AllBee does not guarantee any minimum volume of leads, customers, revenue or commission to the Partner.

7. GENERAL
7.1 Electronic records of AllBee are the ordinary evidence of APN transactions, subject to applicable law.
7.2 The Partner may not assign these terms or any APN entitlement without AllBee's prior written consent.
7.3 These terms are governed by and interpreted in accordance with the Disputes, Governing Law & General Legal Terms schedule.$doc2$,
  body_simple = $doc2s$WHAT THIS IS
• These are the general rules for using the APN account and AllBee systems.

WHAT YOU CAN DO
• You can use the APN portal for genuine APN business. You can ask support questions and update your contact details.

WHAT YOU CANNOT DO
• Never share your password or login with anyone.
• Never scrape or bulk-copy the APN database, and never use automation to fake activities, referrals or leads.
• Never give false information or create duplicate/fake records.
• Quotations you make are estimates — you cannot present them as final binding contracts.

WHAT HAPPENS IF YOU BREAK THIS RULE
• False records and misuse of the system are serious breaches and can lead to suspension or termination. AllBee is not liable beyond what the law allows, and does not guarantee any minimum earnings.$doc2s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'terms-conditions' and status = 'draft' and body like '[ DRAFT%';

-- 2.3 COMMISSION & COMPENSATION SCHEDULE ──────────────────────────────────
update public.apn_agreements set
  title = 'Commission & Compensation Schedule',
  body = $doc3$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. ELIGIBLE REVENUE
1.1 Commission is earned on eligible customer revenue that AllBee has received and reconciled for the Partner's successful referrals, as determined by the APN commission engine and the prevailing commission rule version.
1.2 Eligibility follows the established APN rule: revenue becomes eligible in the ordinary course on the 5th of the following month, subject to reconciliation and the controls of the APN financial system.

2. REFERRAL COMMISSION RATES
2.1 The Partner earns commission on the Partner's successful referrals at the following rates, counted as the ORDER of the Partner's successful/eligible referrals:
   - 1st successful referral: 10%
   - 2nd through 9th successful referrals: 15%
   - 10th successful referral onward: 20%
2.2 The rate ladder is based on the number of successful, eligible referrals according to the APN business rules. It is not a cumulative revenue tier. The count and the rates applied are those calculated by the APN commission engine for the prevailing rule version.

3. REFERRAL PARTNER (RECRUITER) OVERRIDE
3.1 Where the Partner recruited another partner ("Recruited Partner") using the Partner's referral code, the Partner receives a referral override of 1% of the Recruited Partner's eligible revenue, continuing under the APN referral architecture and its rules.
3.2 There is currently no separate District Leader or State Leader override percentage. Leadership status does not create additional commission rates by itself (see clause 4).

4. STATUS AND LEADERSHIP ROLES
4.1 Progress along the partner status ladder (Trainee, Active, Senior, District Leader, State Leader) does not by itself entitle the Partner to any specific commission percentage. Compensation is determined only by this Schedule and the APN engine.

5. PAYMENT TIMING
5.1 Commission is ordinarily processed by the 5th of the following month, subject to reconciliation and applicable controls. This is not an unconditional payment date: valid adjustments or reconciliations may delay or adjust a payment.
5.2 There is no artificial minimum payout threshold. Payouts follow the APN withdrawal and settlement process.

6. REVERSALS AND ADJUSTMENTS
6.1 If a commission becomes invalid because of a refund, cancellation, reversal, customer non-payment, duplicate attribution, fraud, or any other valid financial adjustment, the commission may be reversed or adjusted in the APN financial system.
6.2 If a reversal produces a negative balance for the Partner, the negative amount remains recorded and future eligible commissions offset it under the existing financial rules.

7. INACTIVITY
7.1 If the Partner is inactive for 21 days, the APN account becomes inactive and requires admin re-approval to resume under the Account Governance schedule.
7.2 Commissions the Partner previously earned legitimately are not automatically erased merely because the account becomes inactive.

8. TERMINATION
8.1 On termination, properly earned commissions remain subject to reconciliation and are not automatically confiscated. Legitimate unpaid commissions are settled through the normal process. Outstanding negative balances and adjustments remain handled under the existing financial rules.

9. TAXES AND DEDUCTIONS
9.1 The Partner is responsible for the Partner's own applicable taxes and statutory obligations. AllBee may make lawful deductions and statutory reporting as required.$doc3$,
  body_simple = $doc3s$WHAT THIS IS
• This is how AllBee pays you for your referrals.

WHAT YOU CAN DO
• Earn 10% on your 1st successful referral, 15% on your 2nd to 9th, and 20% from your 10th onward. The referral count is by successful referrals, not by revenue size.
• If someone you recruited with your code earns eligible revenue, you get 1% of it — that is the only override that exists today.
• Commission is normally processed by the 5th of the following month.

WHAT YOU CANNOT DO
• Your status (Senior, District Leader, State Leader) does not add a commission rate by itself.
• You cannot demand payment before reconciliation completes, and reversals for refunds, cancellations or fraud can reduce past commissions.

WHAT HAPPENS IF YOU BREAK THIS RULE / OTHER NOTES
• If a reversal makes your balance negative it stays recorded and future eligible commissions offset it.
• If you are inactive for 21 days your account becomes inactive and needs admin re-approval — but commissions you already earned legitimately are not wiped out.
• You pay your own taxes; AllBee may make lawful deductions and reports.$doc3s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'commission-schedule' and status = 'draft' and body like '[ DRAFT%';

-- 2.4 CODE OF CONDUCT & PROHIBITED ACTIVITIES ──────────────────────────────
update public.apn_agreements set
  title = 'Code of Conduct & Prohibited Activities',
  body = $doc4$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. STANDARD OF CONDUCT
1.1 The Partner shall deal honestly and fairly with customers, fellow partners and AllBee, and shall represent AllBee only within the authorized scope of the Partner's APN role.
1.2 The Partner shall communicate professionally and shall not harass, mislead or deceive any customer, partner or AllBee personnel.

2. PROHIBITED ACTIVITIES
2.1 The Partner shall not:
   (a) create, submit or encourage duplicate, fake or fictitious referrals, leads, customers, attendance, activity or transactions;
   (b) manipulate, inflate or misstate attribution, referral links, revenue or achievement;
   (c) claim to own, operate or represent a branch or office of AllBee, or hold oneself out as AllBee, its employee, partner or director beyond the authorized identity described in the Brand & Intellectual Property Usage schedule;
   (d) promise customers discounts, prices, delivery dates, contracts or outcomes that AllBee has not authorized;
   (e) misuse customer or partner information, or use it outside legitimate APN purposes;
   (f) seek, offer or accept compensation for manipulating commissions, referrals or any APN record;
   (g) use AllBee systems in violation of the General Terms & Conditions.

3. REPORTING
3.1 The Partner shall promptly report suspected misconduct, manipulation, fraud or abuse that the Partner becomes aware of, using the support process.

4. INVESTIGATION AND CONSEQUENCES
4.1 Breaches of this Code are reviewed by AllBee and may lead to investigation, temporary suspension while the matter is reviewed, or termination under the Account Governance, Inactivity, Suspension & Termination schedule. AllBee preserves audit and history records of the matter.$doc4$,
  body_simple = $doc4s$WHAT THIS IS
• The personal behaviour rules for every APN partner.

WHAT YOU CAN DO
• Be honest and fair with customers, other partners and AllBee. Report anything you see that looks like fraud or cheating.

WHAT YOU CANNOT DO
• No fake or duplicate referrals, leads or activity — ever.
• No manipulating attribution, links or records to earn more.
• Never claim to be an AllBee office, branch or employee, and never promise prices or deals AllBee did not approve.
• No misuse of customer data, and no bribery or deals to rig commissions.

WHAT HAPPENS IF YOU BREAK THIS RULE
• AllBee investigates and may suspend you while it reviews, or terminate your account for serious breaches. The records are kept, not deleted.$doc4s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'code-of-conduct' and status = 'draft' and body like '[ DRAFT%';

-- 2.5 DATA PROTECTION & PRIVACY ────────────────────────────────────────────
update public.apn_agreements set
  title = 'Data Protection & Privacy',
  body = $doc5$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. SCOPE
1.1 This document sets out how the Partner handles customer information and partner information obtained through the APN system. AllBee's privacy practices and any separate privacy policy published by AllBee for the business apply to the customer relationship; this document applies to the Partner's handling obligations.

2. COLLECTION MINIMISATION
2.1 The Partner shall collect only the customer information necessary for legitimate APN business purposes and shall keep it accurate.

3. USE LIMITATION
3.1 The Partner shall use customer information only for legitimate APN business purposes, as permitted by applicable law. The Partner shall not sell, rent, trade or otherwise misuse customer information, and shall not use it to operate or feed any personal or third-party business.

4. NO EXPORT OR SCRAPING
4.1 The Partner shall not export, scrape or systematically extract the APN database, customer records or any AllBee system data beyond what the prescribed APN processes provide.

5. CREDENTIALS AND SECURITY
5.1 The Partner shall keep accounts, credentials and security information confidential and shall not disclose them to any person.

6. INCIDENTS
6.1 The Partner shall immediately report any suspected data or security incident affecting customer information or APN systems through the support process.

7. RETENTION AND RETURN
7.1 After termination or when AllBee requests, the Partner shall delete or return customer and APN information in the Partner's possession, following AllBee's instructions and subject to legal retention requirements.

8. CONFLICT
8.1 If this document conflicts with a separately published AllBee privacy policy or with applicable law, the privacy policy or the law prevails to the extent of the conflict.$doc5$,
  body_simple = $doc5s$WHAT THIS IS
• How you must handle customer and partner information.

WHAT YOU CAN DO
• Collect only what you genuinely need for APN work, keep it accurate, and report any data or security problem to AllBee right away.

WHAT YOU CANNOT DO
• No selling, renting or trading customer information, and no using it for your own or other businesses.
• No scraping or bulk-copying the APN database.
• Never share your login or security details.
• After you leave, delete or return information as AllBee instructs (unless the law says you must keep it).

WHAT HAPPENS IF YOU BREAK THIS RULE
• Data misuse is serious and can lead to suspension or termination, and to action under applicable law. AllBee's own published privacy policy applies to the customer side and wins if these two conflict.$doc5s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'privacy-policy' and status = 'draft' and body like '[ DRAFT%';

-- 2.6 BRAND & INTELLECTUAL PROPERTY USAGE ─────────────────────────────────
update public.apn_agreements set
  title = 'Brand & Intellectual Property Usage',
  body = $doc6$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. LIMITED PERMISSION
1.1 AllBee grants the Partner a limited, revocable, non-exclusive permission to use the AllBee name and brand materials solely for authorized APN activities, in accordance with official AllBee brand guidelines and using only official materials.

2. PERMITTED IDENTITY
2.1 The Partner may describe the Partner's APN role in a manner approved by AllBee, including as an "Authorized AllBee APN Partner". The Partner shall not describe the Partner's role in a way that AllBee has not authorized.

3. PROHIBITED CLAIMS AND USE
3.1 The Partner shall not:
   (a) claim or imply that the Partner operates an "AllBee branch" or "AllBee office", or that the Partner owns AllBee;
   (b) claim authority to sign contracts or bind AllBee legally;
   (c) change official prices or make unauthorized promises;
   (d) register or use names, domains or social handles that imitate or could be confused with AllBee;
   (e) use AllBee marks beyond the official materials or in a way that misleads customers.

4. INTELLECTUAL PROPERTY OWNERSHIP
4.1 All AllBee names, marks, logos, materials, software and content remain the property of AllBee or its licensors. The Partner acquires no ownership by use under this permission.

5. CESSATION
5.1 On termination or on AllBee's request, the Partner shall immediately stop all use of AllBee branding and identity and return or destroy official materials as instructed. This obligation survives termination.$doc6$,
  body_simple = $doc6s$WHAT THIS IS
• How you may use the AllBee name and branding.

WHAT YOU CAN DO
• Use official AllBee materials as given to you, and describe yourself in the approved way — for example as an "Authorized AllBee APN Partner".

WHAT YOU CANNOT DO
• Never call yourself an "AllBee branch" or "AllBee office", and never say you own AllBee.
• Never sign contracts for AllBee, change prices, or make promises AllBee did not approve.
• Never copy the AllBee look, register look-alike names or social handles, or use the brand beyond official materials.

WHAT HAPPENS IF YOU BREAK THIS RULE
• Your permission to use the brand is withdrawn and you must stop using it immediately when asked or when you leave. The brand itself always stays AllBee's property.$doc6s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'ip-brand' and status = 'draft' and body like '[ DRAFT%';

-- 2.7 CONFIDENTIALITY & TRADE SECRETS ─────────────────────────────────────
update public.apn_agreements set
  title = 'Confidentiality & Trade Secrets',
  body = $doc7$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. CONFIDENTIAL INFORMATION
1.1 "Confidential Information" means information AllBee or its partners disclose to the Partner or the Partner accesses through the APN system that is not public, including: customer information; pricing and commission structures; quotations; internal processes; business strategies; financial and business information; partner information; software and system information; credentials and security information; proprietary materials; and trade secrets.

2. OBLIGATIONS
2.1 The Partner shall keep Confidential Information confidential and use it only to perform the Partner's APN role. The Partner shall take reasonable care to protect it.
2.2 The Partner may disclose Confidential Information only: (a) with AllBee's prior authorization; (b) where required by law or legal process, after giving AllBee prompt notice where lawfully possible; or (c) to the Partner's professional advisers bound by confidentiality, to the extent needed.

3. EXCLUSIONS
3.1 These obligations do not apply to information that is already public (through no breach of this document by the Partner), is independently developed by the Partner, or is lawfully received from a third party without confidentiality obligations.

4. RETURN AND DELETION
4.1 On termination or earlier request, the Partner shall return or delete Confidential Information in the Partner's possession, subject to legal retention requirements.

5. SURVIVAL
5.1 These obligations continue after termination: for trade secrets, for as long as the information remains a trade secret; for other Confidential Information, for a period of 3 years after termination or such longer period as applicable law requires. Nothing in this clause 5 requires confidence to be maintained where it is no longer protected under law.$doc7$,
  body_simple = $doc7s$WHAT THIS IS
• What you must keep secret from working in APN.

WHAT YOU CAN DO
• Use confidential information only for your APN work. Share it with your own confidential advisers if needed, and give it back or delete it when asked or when you leave.

WHAT YOU CANNOT DO
• Never leak customer details, pricing, commission structures, quotations, internal plans, partner data, system details or passwords to outsiders.
• This duty does not cover information already public or independently yours, and it lasts for as long as the information is secret (trade secrets) or up to 3 years after you leave (other confidential information), or longer if the law demands.

WHAT HAPPENS IF YOU BREAK THIS RULE
• Disclosure of trade secrets or confidential information is a serious breach that can lead to termination and legal action.$doc7s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'confidentiality' and status = 'draft' and body like '[ DRAFT%';

-- 2.8 LEAD OWNERSHIP, REFERRAL & CUSTOMER HANDLING RULES ───────────────────
update public.apn_agreements set
  title = 'Lead Ownership, Referral & Customer Handling Rules',
  body = $doc8$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. LEAD OWNERSHIP
1.1 AllBee owns and controls leads generated through AllBee systems. The Partner receives attribution and commission according to the APN system and the Commission & Compensation Schedule, and has no ownership right in the leads themselves.

2. REFERRAL RULES
2.1 Referrals are created through official APN referral codes and links and are recorded in the referral architecture of the APN system. A recruiter's referral override (currently 1% of the recruited partner's eligible revenue) applies under that architecture.
2.2 The Partner shall not create duplicate or fake referrals, or restructure referrals to manipulate attribution or commission.

3. PROHIBITED CONDUCT
3.1 The Partner shall not:
   (a) divert AllBee leads or customers outside the APN system;
   (b) secretly transfer customers to the Partner's personal business or any third party;
   (c) manipulate attribution, referral links or lead records;
   (d) misuse customer information;
   (e) represent AllBee outside the authorized scope of the Partner's role;
   (f) take any action that deprives AllBee of a customer, a transaction or a legitimate attribution.

4. CUSTOMER HANDLING
4.1 The Partner shall deal with customers professionally and honestly, and shall use customer information only for legitimate APN business purposes and in accordance with applicable law and AllBee policy.

5. PAYMENTS BY CUSTOMERS
5.1 Customers pay AllBee directly. Any arrangement where the customer pays the Partner personally is not an APN transaction unless it is an authorized cash transaction under this clause.
5.2 EXCEPTION — cash: where a customer specifically pays in cash through an authorized APN transaction, the Partner may collect the cash, but must: record the transaction; generate and record the required receipt/evidence; report the collection through the prescribed AllBee process; and remit or deposit the amount according to AllBee's prescribed process.
5.3 The Partner shall never conceal, delay, divert or personally retain company or customer money. Failure to remit collected cash is a serious breach of this agreement.

6. BREACHES
6.1 Breaches of this document are subject to the Account Governance, Inactivity, Suspension & Termination schedule, and may also trigger commission reversal or adjustment under the Commission & Compensation Schedule.$doc8$,
  body_simple = $doc8s$WHAT THIS IS
• Who owns leads, how referrals work, and the one rule about handling customer money.

WHAT YOU CAN DO
• Work AllBee leads inside the APN system and get your attribution and commission there. Use official referral codes to recruit partners (you earn 1% of a recruited partner's eligible revenue).

WHAT YOU CANNOT DO
• Never take AllBee leads or customers outside the system, and never move them to your own or another business.
• No fake or duplicate referrals, no fiddling with attribution, no misuse of customer information.
• Customers pay AllBee directly. Cash is collected by you ONLY when a customer specifically pays cash through an authorized APN transaction — and then you must record it, issue/report the receipt, and hand the money over through the prescribed process. Never hide, hold, delay or keep company or customer money.

WHAT HAPPENS IF YOU BREAK THIS RULE
• Lead diversion or keeping customer cash is serious and leads to suspension or termination, plus commission reversals under the compensation schedule.$doc8s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'lead-client-management' and status = 'draft' and body like '[ DRAFT%';

-- 2.9 QUOTATION & PRICING RULES ────────────────────────────────────────────
update public.apn_agreements set
  title = 'Quotation & Pricing Rules',
  body = $doc9$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. CREATION THROUGH THE OFFICIAL SYSTEM
1.1 Approved APN partners may create quotations through the official quotation system of AllBee only. The quotation wizard and its PDF output are part of that system and may not be replaced by personal documents.

2. NATURE OF QUOTATIONS
2.1 Quotations prepared by the Partner are estimates. They are not automatically binding contracts and may not be presented as final contracts. Final acceptance of any project is subject to AllBee's official process.

3. PRICING DISCIPLINE
3.1 Quotations must use approved AllBee pricing. The Partner shall not arbitrarily modify approved pricing, promise unauthorized discounts, or guarantee delivery dates unless an approved timeline exists.
3.2 The Partner shall not represent a quotation as an offer AllBee is bound to honour.

4. RECORDS AND VALIDITY
4.1 Quotations and their versions are recorded in the quotation system. Pricing and terms shown apply as at the recorded version and subject to AllBee's official acceptance process.$doc9$,
  body_simple = $doc9s$WHAT THIS IS
• The rules for quotations you give customers.

WHAT YOU CAN DO
• Create quotations only in the official AllBee quotation system using approved prices. Quote delivery only when an approved timeline exists.

WHAT YOU CANNOT DO
• Never write quotations outside the official system or as your own documents.
• Never change approved prices, promise discounts AllBee did not approve, or promise delivery dates that are not approved.
• Never present a quotation as a final, binding contract — only AllBee's official process finalizes a deal.

WHAT HAPPENS IF YOU BREAK THIS RULE
• Unauthorized pricing or promises are a serious breach and quotations made outside the rules may not be honoured.$doc9s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'quotation-sales' and status = 'draft' and body like '[ DRAFT%';

-- 2.10 TRAINING & CERTIFICATION ────────────────────────────────────────────
update public.apn_agreements set
  title = 'Training & Certification',
  body = $doc10$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. ONBOARDING AND CONTINUING TRAINING
1.1 The Partner shall complete the prescribed onboarding training and any continuing training or certification that AllBee publishes for APN partners, through the APN learning system.
1.2 Training materials remain AllBee's property and may not be reproduced or distributed outside the APN system.

2. CERTIFICATION AND QUIZZES
2.1 Where AllBee prescribes quizzes or certification, the Partner shall complete them in the prescribed manner. Results become part of the Partner's APN record.
2.2 Certification reflects completion of AllBee's prescribed training; it does not create employment status, professional qualifications or a right to any commission rate beyond the Commission & Compensation Schedule.

3. UPDATES
3.1 When AllBee publishes updated training, the Partner is expected to complete the updated version within a reasonable time.$doc10$,
  body_simple = $doc10s$WHAT THIS IS
• The training rules for staying active in APN.

WHAT YOU CAN DO
• Complete onboarding, quizzes and certifications in the APN learning system. Learn updated material when AllBee publishes it.

WHAT YOU CANNOT DO
• Never copy or share AllBee training content outside the APN system.
• Certification does not make you an employee and does not create special commission rates.

WHAT HAPPENS IF YOU BREAK THIS RULE
• Incomplete required training can affect your standing as an active partner; sharing training materials is a confidentiality and conduct issue.$doc10s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'training-certification' and status = 'draft' and body like '[ DRAFT%';

-- 2.11 ACCOUNT GOVERNANCE, INACTIVITY, SUSPENSION & TERMINATION ────────────
update public.apn_agreements set
  title = 'Account Governance, Inactivity, Suspension & Termination',
  body = $doc11$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. DISTINCT STATES
1.1 This document distinguishes four states of the APN relationship: (A) inactivity; (B) temporary suspension; (C) investigation; and (D) termination. Each has separate triggers and consequences.

2. (A) INACTIVITY
2.1 If the Partner records no qualifying APN activity for 21 consecutive days, the APN account becomes inactive and requires admin re-approval to resume.
2.2 Commissions the Partner previously earned legitimately are not automatically erased merely because the account becomes inactive. The Partner may apply for reactivation under the prescribed process.

3. (B) TEMPORARY SUSPENSION AND (C) INVESTIGATION
3.1 Where AllBee has reason to believe serious misconduct has occurred, AllBee may temporarily suspend APN access immediately while it investigates and reviews the matter.
3.2 Serious misconduct includes, but is not limited to: fraud; theft or diversion of money; fake referrals; manipulation of commissions or attribution; customer deception; unauthorized contractual commitments; serious misuse of customer data; credential or security abuse; impersonation; serious brand misuse; deliberate manipulation of AllBee systems; and any other material breach of this system of agreements.
3.3 The Partner may respond and be heard through the dispute process in the Disputes, Governing Law & General Legal Terms schedule. Investigation records are preserved; this system does not provide for arbitrary deletion of audit or history.

4. (D) TERMINATION
4.1 AllBee may terminate the APN relationship for serious misconduct or for a material breach that remains uncured after notice and a reasonable cure period. The Partner may also end the relationship by notice.
4.2 On termination: APN access stops; the Partner stops representing AllBee; all AllBee branding use stops; and company and customer data in the Partner's possession is returned or deleted where legally appropriate.
4.3 Properly earned commissions remain subject to reconciliation on termination and are not automatically confiscated; legitimate unpaid commissions are settled through the normal process. Outstanding negative balances and adjustments remain handled according to the existing financial rules.
4.4 Preserved history survives termination for records, audit and reconciliation purposes.$doc11$,
  body_simple = $doc11s$WHAT THIS IS
• What happens to your account when you go quiet, get suspended or leave.

WHAT YOU CAN DO
• If you are inactive for 21 days the account goes inactive and an admin must re-approve it — apply through the prescribed process, and know that commissions you already earned legitimately are not wiped out.
• If AllBee investigates you, you may respond through the dispute process.

WHAT YOU CANNOT DO
• Serious misconduct (fraud, taking money, fake referrals, rigging commissions, deceiving customers, misusing data, impersonation, abusing the brand or systems) can mean instant temporary suspension while it is investigated, and can end in termination.

WHAT HAPPENS WHEN THE ACCOUNT ENDS
• Your access stops, you stop representing AllBee, branding stops, and data is returned or deleted as required.
• Earned, reconciled commissions are still paid through the normal process and are not confiscated; negative balances still follow the existing financial rules; audit history is kept.$doc11s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'suspension-termination' and status = 'draft' and body like '[ DRAFT%';

-- 2.12 DISPUTES, GOVERNING LAW & GENERAL LEGAL TERMS ──────────────────────
update public.apn_agreements set
  title = 'Disputes, Governing Law & General Legal Terms',
  body = $doc12$[Document status: commercial terms finalized by ALLBEE SOLUTIONS management; this text remains subject to review and approval by qualified legal counsel before production publication.]

1. RESOLUTION SEQUENCE
1.1 Disputes arising out of or in connection with this system of agreements shall first be raised by the Partner through the prescribed process in this order: (1) partner issue through the support ticket or internal complaint process; (2) admin review; (3) Super Admin / final internal review; (4) a good-faith internal settlement attempt.
1.2 If the matter is not resolved by the internal process, the parties may pursue arbitration or other appropriate legal process where applicable, and ultimately the courts of the jurisdiction having legal power over the matter.
1.3 Nothing in this document prevents either party from seeking urgent interim relief where applicable law allows.

2. GOVERNING LAW
2.1 This system of agreements is initially governed by the law of the Republic of India, applied within the framework of the State of Tamil Nadu as the principal operating framework at execution. The current principal place of dispute is Nagapattinam, Tamil Nadu.
2.2 The framework is drafted so that expansion of the partners' operations to other Indian states can be reflected through published updates to this schedule without rewriting the agreement system.

3. ARBITRATION
3.1 Where the parties agree to arbitration, or where arbitration is required by applicable law, the arbitration shall be conducted in accordance with the law applicable to arbitration in India as in force, with the seat at Nagapattinam, Tamil Nadu.

4. JURISDICTION
4.1 Subject to applicable law and to clause 1, the courts of Nagapattinam, Tamil Nadu shall have jurisdiction over disputes not otherwise resolved. If applicable law does not permit such designation, the courts having jurisdiction under applicable law apply.

5. GENERAL LEGAL TERMS
5.1 Severability, waiver, entire agreement, notices and assignment: as provided in the APN Partner Master Agreement and the General Terms & Conditions.
5.2 A printed version of electronically accepted documents and of this system's records shall be admissible in proceedings to the same extent as other records created in the ordinary course, subject to applicable law.
5.3 These documents are written in English; in any dispute over meaning, the formal English text controls.$doc12$,
  body_simple = $doc12s$WHAT THIS IS
• How disagreements between you and AllBee get sorted out, and which law applies.

WHAT YOU CAN DO
• Raise any issue first through your support ticket or complaint; it then goes to admin review, then Super Admin/internal final review, then a good-faith settlement attempt.

WHAT YOU CANNOT DO
• You cannot skip the internal steps and jump straight to court unless the law allows urgent relief.
• Chinese whispers aside: the formal English text of these documents controls in any dispute.

WHAT HAPPENS NEXT / OTHER NOTES
• If internal steps fail, arbitration or other appropriate legal process may follow, and ultimately the courts that have legal power — currently Nagapattinam, Tamil Nadu under Indian law. Past that, the framework can be updated as APN expands to other states without rewriting everything.$doc12s$,
  reason = 'Final commercial content 2026-08-20 — pending qualified legal counsel review.'
where code = 'dispute-grievance' and status = 'draft' and body like '[ DRAFT%';

-- ══════════════════════════════════════════════════════════════════════════
-- 3. CONSISTENCY PROOF
--    A safety snapshot the operator can re-run to confirm the finalized state
--    before publishing (NOTHING in this section modifies data).
-- ══════════════════════════════════════════════════════════════════════════
-- select 'final-content drafts' as check,
--   count(*) as drafts,
--   count(*) filter (where body like '[ DRAFT%') as placeholders_left,
--   count(*) filter (where length(trim(body_simple)) = 0) as missing_simple
-- from public.apn_agreements where status = 'draft';
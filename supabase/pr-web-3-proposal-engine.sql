begin;

-- PR-WEB-3: Enterprise AI Proposal & Quotation Engine.
-- Content is generated from PR-Web-2 requirement data and the PR-Web-1.5
-- knowledge/pricing catalog. Proposal data is versioned and auditable.

alter table public.proposal_templates add column if not exists theme text not null default 'modern';
alter table public.proposal_templates add column if not exists brand jsonb not null default '{}'::jsonb;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(), proposal_number text not null unique,
  requirement_session_id uuid references public.web_requirement_sessions(id) on delete set null,
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  template_id uuid references public.proposal_templates(id) on delete set null,
  proposal_title text not null, service_slug text not null default '', customer_name text not null default '',
  customer_email text, customer_phone text, apn_partner_id text,
  theme text not null default 'modern',
  pricing_mode text not null default 'estimated' check (pricing_mode in ('estimated','official','negotiated','discounted','custom')),
  currency text not null default 'INR', subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0), tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0), optional_addons jsonb not null default '[]'::jsonb,
  scope jsonb not null default '{}'::jsonb, timeline jsonb not null default '{}'::jsonb, knowledge_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','sent','viewed','revision_requested','approved','rejected','expired','converted')),
  current_version integer not null default 1 check (current_version > 0), public_token_hash text unique,
  public_token_expires_at timestamptz, created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  sent_at timestamptz, viewed_at timestamptz, approved_at timestamptz, rejected_at timestamptz, expires_at timestamptz
);

create table if not exists public.proposal_section_definitions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.proposal_templates(id) on delete cascade,
  section_key text not null, name text not null, section_type text not null default 'rich_text', sort_order integer not null default 0,
  enabled boolean not null default true, default_content jsonb not null default '{}'::jsonb, archived_at timestamptz,
  created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(template_id, section_key)
);
create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  version integer not null, snapshot jsonb not null default '{}'::jsonb, reason text not null default '', created_by text, created_at timestamptz not null default now(), unique(proposal_id,version)
);
create table if not exists public.proposal_sections (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_id uuid not null references public.proposal_versions(id) on delete cascade, section_key text not null, name text not null,
  section_type text not null default 'rich_text', sort_order integer not null default 0, enabled boolean not null default true,
  content jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(version_id,section_key)
);
create table if not exists public.proposal_approvals (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  action text not null check (action in ('sent','viewed','approved','rejected','revision_requested','question')), comment text not null default '',
  actor_id text, actor_name text, actor_type text not null default 'internal' check (actor_type in ('internal','customer','system')), created_at timestamptz not null default now()
);
create table if not exists public.proposal_comments (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  comment text not null, author_id text, author_name text, author_type text not null default 'internal' check (author_type in ('internal','customer')), created_at timestamptz not null default now()
);
create table if not exists public.proposal_downloads (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  token_hash text, downloaded_at timestamptz not null default now(), ip_hash text, user_agent text
);
create table if not exists public.proposal_shares (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, created_by text, created_at timestamptz not null default now(), revoked_at timestamptz
);
create table if not exists public.proposal_analytics (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  event text not null check (event in ('created','viewed','downloaded','shared','approved','rejected','revision_requested','question')), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.proposal_pdfs (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  storage_path text, checksum text, status text not null default 'pending' check (status in ('pending','ready','failed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(proposal_id,version)
);
create table if not exists public.proposal_audit (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, action text not null,
  actor_id text, actor_name text, actor_type text not null default 'internal', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.proposal_timeline (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, event_type text not null,
  title text not null, description text not null default '', related_id text, created_by text, created_at timestamptz not null default now()
);
create table if not exists public.proposal_revisions (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, from_version integer not null, to_version integer not null,
  reason text not null default '', change_summary jsonb not null default '{}'::jsonb, created_by text, created_at timestamptz not null default now(), unique(proposal_id,to_version)
);
create table if not exists public.proposal_signatures (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  signer_name text not null, signer_email text, signature_text text not null, signature_hash text, signed_at timestamptz not null default now()
);
create table if not exists public.proposal_attachments (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  file_name text not null, file_url text, storage_path text, mime_type text, file_size bigint, uploaded_by text, created_at timestamptz not null default now()
);
create table if not exists public.proposal_finance_forecasts (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade, version integer not null,
  expected_revenue numeric(14,2) not null default 0, payment_schedule jsonb not null default '[]'::jsonb, invoice_draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(proposal_id,version)
);
create table if not exists public.crm_project_milestones (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.crm_projects(id) on delete cascade, proposal_id uuid references public.proposals(id) on delete set null,
  name text not null, sort_order integer not null default 0, due_date date, percentage numeric(5,2) not null default 0, status text not null default 'Pending', created_at timestamptz not null default now()
);

alter table public.crm_quotations add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create index if not exists proposals_status_idx on public.proposals(status,updated_at desc);
create index if not exists proposals_customer_idx on public.proposals(customer_name,customer_email);
create index if not exists proposals_lead_idx on public.proposals(crm_lead_id,created_at desc);
create index if not exists proposal_versions_proposal_idx on public.proposal_versions(proposal_id,version desc);
create index if not exists proposal_sections_proposal_idx on public.proposal_sections(proposal_id,version_id,sort_order);
create index if not exists proposal_analytics_event_idx on public.proposal_analytics(event,created_at desc);
create index if not exists proposal_timeline_proposal_idx on public.proposal_timeline(proposal_id,created_at desc);
create index if not exists proposal_audit_proposal_idx on public.proposal_audit(proposal_id,created_at desc);
create index if not exists proposal_finance_proposal_idx on public.proposal_finance_forecasts(proposal_id,version desc);

insert into public.proposal_templates(slug,name,body,theme,brand) values('modern','Modern Enterprise Proposal','{"description":"Clean, professional proposal layout."}'::jsonb,'modern','{}'::jsonb)
on conflict(slug) do update set theme=coalesce(public.proposal_templates.theme,'modern');

do $$ declare t uuid; begin
  select id into t from public.proposal_templates where slug='modern';
  insert into public.proposal_section_definitions(template_id,section_key,name,section_type,sort_order) values
    (t,'executive_summary','Executive Summary','rich_text',10),(t,'business_understanding','Business Understanding','rich_text',20),(t,'objectives','Objectives','list',30),(t,'recommended_solution','Recommended Solution','rich_text',40),(t,'modules','Modules','table',50),(t,'features','Features','list',60),(t,'timeline','Timeline','timeline',70),(t,'pricing','Pricing','pricing',80),(t,'optional_addons','Optional Add-ons','pricing',90),(t,'hosting','Hosting','rich_text',100),(t,'amc','AMC','rich_text',110),(t,'payment_schedule','Payment Schedule','payment_schedule',120),(t,'deliverables','Deliverables','list',130),(t,'support','Support','rich_text',140),(t,'warranty','Warranty','rich_text',150),(t,'terms','Terms','rich_text',160),(t,'company_profile','Company Profile','rich_text',170),(t,'acceptance','Acceptance','signature',180),(t,'signature','Signature','signature',190)
  on conflict(template_id,section_key) do update set name=excluded.name,section_type=excluded.section_type,sort_order=excluded.sort_order,updated_at=now();
end $$;

create or replace function public.proposal_public_get(p_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype;
begin
  select * into p from public.proposals where public_token_hash=md5(trim(p_token)) and public_token_expires_at>now();
  if not found then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if;
  update public.proposals set viewed_at=coalesce(viewed_at,now()),status=case when status='sent' then 'viewed' else status end,updated_at=now() where id=p.id;
  perform public.proposal_log(p.id,'viewed',jsonb_build_object('description','Proposal viewed through customer link.'),'customer');
  return public.proposal_get(p.id)||jsonb_build_object('public_token',p_token);
end $$;

create or replace function public.proposal_create_revision(p_proposal_id uuid,p_patch jsonb default '{}'::jsonb,p_reason text default 'Revision requested') returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype; oldv integer; newv integer; v public.proposal_versions%rowtype; snap jsonb;
begin
  if not public.is_admin() then raise exception 'Only administrators can create proposal revisions.' using errcode='insufficient_privilege'; end if;
  select * into p from public.proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  oldv:=p.current_version; newv:=oldv+1; snap:=(select snapshot from public.proposal_versions where proposal_id=p.id and version=oldv)||coalesce(p_patch,'{}'::jsonb);
  update public.proposals set current_version=newv,proposal_title=coalesce(snap->>'proposal_title',proposal_title),pricing_mode=coalesce(snap->>'pricing_mode',pricing_mode),subtotal=coalesce(nullif(snap->>'subtotal','')::numeric,subtotal),discount_amount=coalesce(nullif(snap->>'discount_amount','')::numeric,discount_amount),tax_amount=coalesce(nullif(snap->>'tax_amount','')::numeric,tax_amount),grand_total=coalesce(nullif(snap->>'grand_total','')::numeric,grand_total),status='draft',updated_at=now() where id=p.id returning * into p;
  insert into public.proposal_versions(proposal_id,version,snapshot,reason,created_by) values(p.id,newv,snap,p_reason,auth.uid()::text) returning * into v;
  insert into public.proposal_revisions(proposal_id,from_version,to_version,reason,change_summary,created_by) values(p.id,oldv,newv,p_reason,coalesce(p_patch,'{}'::jsonb),auth.uid()::text);
  insert into public.proposal_sections(proposal_id,version_id,section_key,name,section_type,sort_order,enabled,content) select proposal_id,v.id,section_key,name,section_type,sort_order,enabled,content from public.proposal_sections where proposal_id=p.id and version_id=(select id from public.proposal_versions where proposal_id=p.id and version=oldv);
  perform public.proposal_log(p.id,'revision_requested',jsonb_build_object('description',p_reason,'from_version',oldv,'to_version',newv),'internal');
  return public.proposal_get(p.id);
end $$;

create or replace function public.proposal_finalize_approval(p_proposal_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype; l public.crm_leads%rowtype; q public.crm_quotations%rowtype; pr public.crm_projects%rowtype; snap jsonb; schedule jsonb; item jsonb; apn_key text; apn_rate numeric; i integer:=0;
begin
  select * into p from public.proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  snap:=coalesce((select snapshot from public.proposal_versions where proposal_id=p.id and version=p.current_version),'{}'::jsonb);
  if p.crm_lead_id is not null then select * into l from public.crm_leads where id=p.crm_lead_id for update; end if;
  select * into q from public.crm_quotations where proposal_id=p.id limit 1;
  if q.id is null and l.id is not null then
    insert into public.crm_quotations(quote_number,lead_id,client_id,service_type,title,items,subtotal,discount,tax,gst,grand_total,validity_until,status,approval_status,created_by,proposal_id)
    values('QT-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,l.client_id,coalesce((select name from public.services where slug=p.service_slug),initcap(replace(p.service_slug,'-',' '))),p.proposal_title,coalesce(snap->'pricing'->'optional_addons','[]'::jsonb),p.subtotal,p.discount_amount,p.tax_amount,p.tax_amount,p.grand_total,p.expires_at::date,'Accepted','Approved',coalesce(auth.uid()::text,'proposal-engine'),p.id) returning * into q;
    update public.crm_leads set quotation_id=q.id,status='Converted',updated_at=now() where id=l.id;
  end if;
  select * into pr from public.crm_projects where quotation_id=q.id limit 1;
  if pr.id is null and q.id is not null and l.id is not null then
    insert into public.crm_projects(project_number,lead_id,quotation_id,client_id,name,service_type,project_value,status,assigned_employee_id,assigned_partner_id,created_by)
    values('PRJ-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,q.id,q.client_id,p.proposal_title,p.service_slug,p.grand_total,'Open',l.assigned_employee_id,l.assigned_partner_id,coalesce(auth.uid()::text,'proposal-engine')) returning * into pr;
    update public.crm_leads set project_id=pr.id,status='Converted',converted_at=coalesce(converted_at,now()),updated_at=now() where id=l.id;
  end if;
  schedule:=coalesce(snap->'knowledge'->'payment_terms','[]'::jsonb);
  for item in select value from jsonb_array_elements(schedule) loop
    i:=i+1; insert into public.crm_project_milestones(project_id,proposal_id,name,sort_order,percentage,status) values(pr.id,p.id,coalesce(item->>'label','Payment milestone '||i),i,coalesce(nullif(item->>'percent','')::numeric,0),'Pending');
  end loop;
  if l.assigned_partner_id is not null and to_regclass('public.apn_commission_projects') is not null and pr.id is not null then
    apn_key:='proposal-'||pr.id::text; apn_rate:=coalesce((select nullif(data->>'commissionPct','')::numeric from public.apn_users where id=l.assigned_partner_id),10);
    insert into public.apn_commission_projects(id,data,updated_at) values(apn_key,jsonb_build_object('id',apn_key,'partnerId',l.assigned_partner_id,'projectName',pr.name,'clientName',p.customer_name,'category',p.service_slug,'projectValue',p.grand_total,'commissionRate',apn_rate,'maximumCommission',round(p.grand_total*apn_rate/100,2),'totalReceived',0,'remainingAmount',p.grand_total,'remainingCommission',round(p.grand_total*apn_rate/100,2),'status','Pending','createdBy','proposal-engine','createdAt',(extract(epoch from now())*1000)::bigint),now()) on conflict(id) do nothing;
    update public.crm_projects set apn_project_id=apn_key,updated_at=now() where id=pr.id;
  end if;
  update public.proposals set status='converted',updated_at=now() where id=p.id;
  perform public.proposal_log(p.id,'converted',jsonb_build_object('description','Customer-approved proposal converted to CRM project.','crm_quotation_id',q.id,'crm_project_id',pr.id),'system');
  return jsonb_build_object('proposal_id',p.id,'quotation_id',q.id,'project_id',pr.id,'apn_project_id',apn_key);
end $$;

create or replace function public.proposal_record_action(p_proposal_id uuid,p_action text,p_comment text default '',p_token text default null,p_signer_name text default null,p_signer_email text default null,p_signature text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype; is_public boolean:=p_token is not null; actor_type text:=case when is_public then 'customer' else 'internal' end; actor_name text:=coalesce(nullif(p_signer_name,''),public.proposal_actor_name());
begin
  if p_action not in ('sent','viewed','approved','rejected','revision_requested','question') then raise exception 'Invalid proposal action.' using errcode='invalid_parameter_value'; end if;
  select * into p from public.proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  if is_public then if p.public_token_hash<>md5(trim(p_token)) or p.public_token_expires_at<=now() then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if; elsif not public.is_admin() and p.created_by<>auth.uid()::text then raise exception 'Proposal access denied.' using errcode='insufficient_privilege'; end if;
  insert into public.proposal_approvals(proposal_id,version,action,comment,actor_id,actor_name,actor_type) values(p.id,p.current_version,p_action,coalesce(p_comment,''),case when is_public then null else auth.uid()::text end,actor_name,actor_type);
  if p_action='approved' then update public.proposals set status='approved',approved_at=now(),updated_at=now() where id=p.id; if is_public then insert into public.proposal_signatures(proposal_id,version,signer_name,signer_email,signature_text,signature_hash) values(p.id,p.current_version,actor_name,p_signer_email,coalesce(p_signature,p_comment),md5(coalesce(p_signature,p_comment)||coalesce(p_signer_email,''))); end if; perform public.proposal_finalize_approval(p.id);
  elsif p_action='rejected' then update public.proposals set status='rejected',rejected_at=now(),updated_at=now() where id=p.id;
  elsif p_action='revision_requested' then update public.proposals set status='revision_requested',updated_at=now() where id=p.id;
  elsif p_action='sent' then update public.proposals set status='sent',sent_at=coalesce(sent_at,now()),updated_at=now() where id=p.id;
  end if;
  perform public.proposal_log(p.id,p_action,jsonb_build_object('description',coalesce(nullif(p_comment,''),initcap(replace(p_action,'_',' '))),'comment',p_comment),actor_type);
  return public.proposal_get(p.id);
end $$;

create or replace function public.proposal_public_action(p_token text,p_action text,p_comment text default '',p_signer_name text default null,p_signer_email text default null,p_signature text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin select id into pid from public.proposals where public_token_hash=md5(trim(p_token)) and public_token_expires_at>now(); if pid is null then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if; return public.proposal_record_action(pid,p_action,p_comment,p_token,p_signer_name,p_signer_email,p_signature); end $$;


create or replace function public.proposal_actor_name() returns text language sql stable security definer set search_path=public as $$ select coalesce((select name from public.profiles where id=auth.uid()),'System') $$;

create or replace function public.proposal_get(p_proposal_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'proposal',to_jsonb(p)-'public_token_hash',
  'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.version desc) from public.proposal_versions v where v.proposal_id=p.id),'[]'::jsonb),
  'sections',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.proposal_sections s where s.proposal_id=p.id and s.version_id=(select id from public.proposal_versions where proposal_id=p.id and version=p.current_version)),'[]'::jsonb),
  'approvals',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.proposal_approvals a where a.proposal_id=p.id),'[]'::jsonb),
  'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.proposal_comments c where c.proposal_id=p.id),'[]'::jsonb)
) from public.proposals p where p.id=p_proposal_id;
$$;

create or replace function public.proposal_log(p_proposal_id uuid,p_action text,p_metadata jsonb default '{}'::jsonb,p_actor_type text default 'internal') returns void language plpgsql security definer set search_path=public as $$
declare n text:=public.proposal_actor_name(); aid text:=auth.uid()::text; ev text:=case when p_action in ('created','viewed','downloaded','shared','approved','rejected','revision_requested','question') then p_action else 'created' end;
begin
  insert into public.proposal_audit(proposal_id,action,actor_id,actor_name,actor_type,metadata) values(p_proposal_id,p_action,aid,n,p_actor_type,coalesce(p_metadata,'{}'::jsonb));
  insert into public.proposal_timeline(proposal_id,event_type,title,description,related_id,created_by) values(p_proposal_id,p_action,initcap(replace(p_action,'_',' ')),coalesce(p_metadata->>'description',initcap(replace(p_action,'_',' '))),p_proposal_id::text,coalesce(aid,n));
  insert into public.proposal_analytics(proposal_id,event,metadata) values(p_proposal_id,ev,coalesce(p_metadata,'{}'::jsonb));
end $$;

create or replace function public.proposal_write_sections(p_proposal_id uuid,p_version_id uuid,p_snapshot jsonb) returns void language plpgsql security definer set search_path=public as $$
declare d record; c jsonb;
begin
  for d in select * from public.proposal_section_definitions where template_id=(select template_id from public.proposals where id=p_proposal_id) and enabled and archived_at is null order by sort_order loop
    c:=case d.section_key
      when 'executive_summary' then jsonb_build_object('text',format('%s requires a %s solution aligned to the captured business goals and delivery timeline.',coalesce(p_snapshot->>'customer_name','The customer'),coalesce(p_snapshot->>'service_name',p_snapshot->>'service_slug','business')))
      when 'business_understanding' then jsonb_build_object('industry',p_snapshot->'answers'->>'industry','business_name',p_snapshot->'answers'->>'business_name','existing_software',p_snapshot->'answers'->>'existing_software','location',p_snapshot->'answers'->>'location','pain_points',p_snapshot->'answers'->>'pain_points')
      when 'objectives' then jsonb_build_object('items',jsonb_build_array(p_snapshot->'answers'->>'goals',p_snapshot->'answers'->>'pain_points'))
      when 'recommended_solution' then jsonb_build_object('service',p_snapshot->>'service_name','package',p_snapshot->'pricing'->>'package','description',p_snapshot->>'service_description')
      when 'modules' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'package_features','[]'::jsonb))
      when 'features' then jsonb_build_object('items',coalesce(p_snapshot->'summary'->'selectedFeatures','[]'::jsonb))
      when 'timeline' then coalesce(p_snapshot->'timeline','{}'::jsonb)
      when 'pricing' then jsonb_build_object('mode',p_snapshot->>'pricing_mode','estimate',p_snapshot->'pricing')
      when 'optional_addons' then jsonb_build_object('items',coalesce(p_snapshot->'pricing'->'optional_addons','[]'::jsonb))
      when 'hosting' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'hosting','[]'::jsonb))
      when 'amc' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'maintenance','[]'::jsonb))
      when 'payment_schedule' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'payment_terms','[]'::jsonb))
      when 'deliverables' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'package_features','[]'::jsonb))
      when 'support' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'support_policies','[]'::jsonb))
      when 'warranty' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'warranty_policies','[]'::jsonb))
      when 'terms' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'terms','[]'::jsonb))
      when 'company_profile' then jsonb_build_object('items',coalesce(p_snapshot->'knowledge'->'company_profile','[]'::jsonb))
      when 'acceptance' then jsonb_build_object('status','pending')
      when 'signature' then jsonb_build_object('signer_name',p_snapshot->'answers'->>'contact_name','signer_email',p_snapshot->'answers'->>'email','signature_text','')
      else coalesce(d.default_content,'{}'::jsonb)
    end;
    insert into public.proposal_sections(proposal_id,version_id,section_key,name,section_type,sort_order,enabled,content) values(p_proposal_id,p_version_id,d.section_key,d.name,d.section_type,d.sort_order,true,coalesce(c,'{}'::jsonb));
  end loop;
end $$;

create or replace function public.proposal_create_from_requirement(p_session_id text,p_template_slug text default 'modern',p_reason text default 'Requirement discovery completed') returns jsonb language plpgsql security definer set search_path=public as $$
declare rs public.web_requirement_sessions%rowtype; c public.web_ai_conversations%rowtype; p public.proposals%rowtype; v public.proposal_versions%rowtype; t uuid; answers jsonb; pricing jsonb; snapshot jsonb; token text; service_name text; lead_id uuid; proposal_no text;
begin
  select * into rs from public.web_requirement_sessions where session_id=trim(p_session_id) for update;
  if not found or rs.status<>'completed' then raise exception 'Only completed requirement sessions can generate proposals.' using errcode='check_violation'; end if;
  select * into p from public.proposals where requirement_session_id=rs.id limit 1;
  if p.id is not null then return public.proposal_get(p.id); end if;
  select * into c from public.web_ai_conversations where id=rs.conversation_id;
  answers:=coalesce(c.state->'answers','{}'::jsonb); pricing:=public.knowledge_estimate(rs.service_slug,answers); lead_id:=c.crm_lead_id;
  select t0.id,s.name into t,service_name from public.proposal_templates t0 left join public.services s on s.slug=rs.service_slug where t0.slug=coalesce(nullif(p_template_slug,''),'modern') and t0.active limit 1;
  if t is null then select id into t from public.proposal_templates where slug='modern' and active limit 1; end if;
  proposal_no:='PR-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  snapshot:=jsonb_build_object(
    'customer_name',coalesce(answers->>'business_name',answers->>'contact_name','Customer'),'customer_email',answers->>'email','customer_phone',answers->>'phone',
    'service_slug',rs.service_slug,'service_name',coalesce(service_name,initcap(replace(rs.service_slug,'-',' '))),'service_description',(select description from public.services where slug=rs.service_slug),
    'answers',answers,'summary',coalesce(rs.requirement_summary,'{}'::jsonb),'pricing',pricing,'pricing_mode',case when coalesce((pricing->>'known')::boolean,false) then 'official' else 'custom' end,
    'timeline',jsonb_build_object('requested',answers->>'timeline','estimated',rs.requirement_summary->>'estimatedTimeline'),
    'knowledge',jsonb_build_object(
      'package_features',coalesce((select jsonb_agg(jsonb_build_object('name',pf.name,'description',pf.description,'included',pf.included) order by pf.sort_order,pf.name) from public.package_features pf join public.service_packages sp on sp.id=pf.package_id join public.services sx on sx.id=sp.service_id where sx.slug=rs.service_slug and pf.active),'[]'::jsonb),
      'payment_terms',coalesce((select jsonb_agg(to_jsonb(x) order by x.slug) from public.payment_terms x where x.active),'[]'::jsonb),
      'hosting',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.hosting_plans x where x.active and (x.service_id is null or x.service_id=(select id from public.services where slug=rs.service_slug))),'[]'::jsonb),
      'maintenance',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.maintenance_plans x where x.active and (x.service_id is null or x.service_id=(select id from public.services where slug=rs.service_slug))),'[]'::jsonb),
      'terms',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.company_policies x where x.active and x.published),'[]'::jsonb),
      'support_policies',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.company_policies x where x.active and x.published and lower(x.name||' '||x.body) like '%support%'),'[]'::jsonb),
      'warranty_policies',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.company_policies x where x.active and x.published and lower(x.name||' '||x.body) like '%warranty%'),'[]'::jsonb),
      'company_profile',coalesce((select jsonb_agg(to_jsonb(x) order by x.title) from public.knowledge_articles x where x.active and x.published and lower(x.title||' '||x.body) like '%company%'),'[]'::jsonb)
    )
  );
  insert into public.proposals(proposal_number,requirement_session_id,crm_lead_id,template_id,proposal_title,service_slug,customer_name,customer_email,customer_phone,apn_partner_id,theme,pricing_mode,currency,subtotal,grand_total,optional_addons,scope,timeline,knowledge_snapshot,status,current_version,public_token_hash,public_token_expires_at,created_by,expires_at)
  values(proposal_no,rs.id,lead_id,t,coalesce(snapshot->>'customer_name','Customer')||' — '||coalesce(snapshot->>'service_name','Business proposal'),rs.service_slug,snapshot->>'customer_name',snapshot->>'customer_email',snapshot->>'customer_phone',c.referral_partner_id,coalesce((select theme from public.proposal_templates where id=t),'modern'),snapshot->>'pricing_mode',coalesce(pricing->>'currency','INR'),coalesce(nullif(pricing->>'estimated_cost','')::numeric,0),coalesce(nullif(pricing->>'estimated_cost','')::numeric,0),coalesce(pricing->'optional_addons','[]'::jsonb),jsonb_build_object('included',snapshot->'knowledge'->'package_features','requested',answers),snapshot->'timeline',snapshot->'knowledge','draft',1,md5(token),now()+interval '30 days','proposal-engine',current_date+30) returning * into p;
  insert into public.proposal_versions(proposal_id,version,snapshot,reason,created_by) values(p.id,1,snapshot,p_reason,'proposal-engine') returning * into v;
  perform public.proposal_write_sections(p.id,v.id,snapshot);
  insert into public.proposal_finance_forecasts(proposal_id,version,expected_revenue,payment_schedule,invoice_draft) values(p.id,1,p.grand_total,coalesce(snapshot->'knowledge'->'payment_terms','[]'::jsonb),jsonb_build_object('status','draft','proposal_number',p.proposal_number,'amount',p.grand_total));
  perform public.proposal_log(p.id,'created',jsonb_build_object('description','Proposal generated from completed requirement discovery.','requirement_session_id',rs.id),'system');
  return public.proposal_get(p.id)||jsonb_build_object('public_token',token);
end $$;

create or replace function public.proposal_regenerate_public_link(p_proposal_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype; token text;
begin
  if not public.is_admin() then raise exception 'Only administrators can create proposal links.' using errcode='insufficient_privilege'; end if;
  select * into p from public.proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  update public.proposals set public_token_hash=md5(token),public_token_expires_at=now()+interval '30 days',updated_at=now() where id=p.id;
  perform public.proposal_log(p.id,'shared',jsonb_build_object('description','A customer proposal link was created.'),'internal');
  return jsonb_build_object('proposal_id',p.id,'public_token',token,'expires_at',now()+interval '30 days');
end $$;

create or replace function public.proposal_admin_list(p_search text default '',p_status text default null,p_limit integer default 50,p_offset integer default 0) returns jsonb language sql security definer set search_path=public as $$
with base as (select p.*,count(*) over() as total_count from public.proposals p where public.is_admin() and (coalesce(trim(p_search),'')='' or lower(p.proposal_number||' '||p.customer_name||' '||p.proposal_title||' '||p.service_slug) like '%'||lower(trim(p_search))||'%') and (p_status is null or p_status='' or p.status=p_status)), rows as (select * from base order by updated_at desc offset greatest(0,p_offset) limit greatest(1,least(coalesce(p_limit,50),100))) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(rows) order by updated_at desc) from rows),'[]'::jsonb),'total',coalesce((select max(total_count) from base),0));
$$;

create or replace function public.proposal_admin_summary() returns jsonb language sql security definer set search_path=public as $$
select case when public.is_admin() then jsonb_build_object('created',(select count(*) from public.proposals),'viewed',(select count(*) from public.proposal_analytics where event='viewed'),'downloaded',(select count(*) from public.proposal_analytics where event='downloaded'),'approved',(select count(*) from public.proposals where status in ('approved','converted')),'rejected',(select count(*) from public.proposals where status='rejected'),'revision_requested',(select count(*) from public.proposals where status='revision_requested'),'average_value',(select coalesce(round(avg(grand_total),2),0) from public.proposals),'conversion_rate',(select case when count(*)=0 then 0 else round(count(*) filter(where status in ('approved','converted'))::numeric*100/count(*),2) end from public.proposals)) else '{}'::jsonb end;
$$;

create or replace function public.proposal_save_section_definition(p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.proposal_section_definitions%rowtype; t uuid;
begin if not public.is_admin() then raise exception 'Proposal section access denied.' using errcode='insufficient_privilege'; end if; t:=nullif(p_payload->>'template_id','')::uuid; insert into public.proposal_section_definitions(id,template_id,section_key,name,section_type,sort_order,enabled,default_content,archived_at,created_by) values(coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()),t,coalesce(p_payload->>'section_key','section'),coalesce(p_payload->>'name','Section'),coalesce(p_payload->>'section_type','rich_text'),coalesce((p_payload->>'sort_order')::integer,0),coalesce((p_payload->>'enabled')::boolean,true),coalesce(p_payload->'default_content','{}'::jsonb),case when coalesce((p_payload->>'enabled')::boolean,true) then null else now() end,auth.uid()::text) on conflict(template_id,section_key) do update set name=excluded.name,section_type=excluded.section_type,sort_order=excluded.sort_order,enabled=excluded.enabled,default_content=excluded.default_content,archived_at=excluded.archived_at,updated_at=now() returning * into r; return to_jsonb(r); end $$;

create or replace view public.proposal_pipeline as select p.id,p.proposal_number,p.proposal_title,p.customer_name,p.customer_email,p.service_slug,p.status,p.current_version,p.grand_total,p.crm_lead_id,p.created_at,p.updated_at,p.approved_at,coalesce((select count(*) from public.proposal_analytics a where a.proposal_id=p.id),0) as event_count from public.proposals p;
create or replace view public.proposal_analytics_summary as select event,count(*)::bigint as event_count,min(created_at) as first_event,max(created_at) as last_event from public.proposal_analytics group by event;
create or replace view public.proposal_public_view as select p.id,p.proposal_number,p.proposal_title,p.customer_name,p.service_slug,p.theme,p.pricing_mode,p.currency,p.subtotal,p.discount_amount,p.tax_amount,p.grand_total,p.optional_addons,p.scope,p.timeline,p.status,p.current_version,p.public_token_expires_at,p.created_at,p.updated_at from public.proposals p;

create or replace function public.proposal_after_requirement_completed() returns trigger language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin if new.status='completed' and old.status is distinct from new.status then result:=public.proposal_create_from_requirement(new.session_id,'modern','Requirement discovery completed'); update public.web_ai_conversations set state=coalesce(state,'{}'::jsonb)||jsonb_build_object('proposal',result),last_activity_at=now() where id=new.conversation_id; end if; return new; end $$;
drop trigger if exists proposal_requirement_completed_trg on public.web_requirement_sessions;
create trigger proposal_requirement_completed_trg after update of status on public.web_requirement_sessions for each row execute function public.proposal_after_requirement_completed();

alter table public.proposals enable row level security;
alter table public.proposal_section_definitions enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.proposal_approvals enable row level security;
alter table public.proposal_comments enable row level security;
alter table public.proposal_downloads enable row level security;
alter table public.proposal_shares enable row level security;
alter table public.proposal_analytics enable row level security;
alter table public.proposal_pdfs enable row level security;
alter table public.proposal_audit enable row level security;
alter table public.proposal_timeline enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.proposal_signatures enable row level security;
alter table public.proposal_attachments enable row level security;
alter table public.proposal_finance_forecasts enable row level security;
alter table public.crm_project_milestones enable row level security;

drop policy if exists proposals_admin_select on public.proposals;
create policy proposals_admin_select on public.proposals for select to authenticated using (public.is_admin() or created_by=auth.uid()::text or crm_lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
do $$ declare t text; begin foreach t in array array['proposal_section_definitions','proposal_versions','proposal_sections','proposal_approvals','proposal_comments','proposal_downloads','proposal_shares','proposal_analytics','proposal_pdfs','proposal_audit','proposal_timeline','proposal_revisions','proposal_signatures','proposal_attachments','proposal_finance_forecasts','crm_project_milestones'] loop execute format('drop policy if exists proposal_admin_%s on public.%I',t,t); execute format('create policy proposal_admin_%s on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t,t); end loop; end $$;

do $$ declare t text; begin foreach t in array array['proposals','proposal_section_definitions','proposal_versions','proposal_sections','proposal_approvals','proposal_comments','proposal_downloads','proposal_shares','proposal_analytics','proposal_pdfs','proposal_audit','proposal_timeline','proposal_revisions','proposal_signatures','proposal_attachments','proposal_finance_forecasts','crm_project_milestones'] loop begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; when others then null; end; end loop; end $$;

grant select on public.proposal_templates,public.proposal_pipeline,public.proposal_analytics_summary,public.proposal_public_view to authenticated;
grant execute on function public.proposal_get(uuid),public.proposal_create_from_requirement(text,text,text),public.proposal_create_revision(uuid,jsonb,text),public.proposal_record_action(uuid,text,text,text,text,text,text),public.proposal_admin_list(text,text,integer,integer),public.proposal_admin_summary(),public.proposal_save_section_definition(jsonb) to authenticated;
grant execute on function public.proposal_regenerate_public_link(uuid) to authenticated;
grant execute on function public.proposal_public_get(text),public.proposal_public_action(text,text,text,text,text,text) to anon,authenticated;

do $$ declare theme_slug text; theme_name text; begin
  for theme_slug,theme_name in select * from (values ('modern','Modern'),('corporate','Corporate'),('minimal','Minimal'),('executive','Executive'),('luxury','Luxury'),('dark','Dark'),('light','Light')) as themes(slug,name) loop
    insert into public.proposal_templates(slug,name,body,theme,brand) values(theme_slug,theme_name||' Enterprise Proposal','{}'::jsonb,theme_slug,'{}'::jsonb) on conflict(slug) do update set theme=excluded.theme,updated_at=now();
    insert into public.proposal_section_definitions(template_id,section_key,name,section_type,sort_order)
      select (select id from public.proposal_templates where slug=theme_slug),section_key,name,section_type,sort_order from public.proposal_section_definitions where template_id=(select id from public.proposal_templates where slug='modern')
      on conflict(template_id,section_key) do update set name=excluded.name,section_type=excluded.section_type,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;

commit;

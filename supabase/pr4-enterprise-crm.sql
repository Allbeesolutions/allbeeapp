-- ALLBEE PR4 — Enterprise CRM + Lead-to-Revenue lifecycle
-- Additive, backward-compatible, and safe to rerun. The legacy JSON CRM
-- collections remain available; these normalized tables are the canonical PR4
-- workflow and integrate with the existing APN/finance/audit surfaces.

begin;

create sequence if not exists public.crm_lead_number_seq;

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  customer_name text not null,
  company text,
  mobile text,
  email text,
  location text,
  address text,
  city text,
  district text,
  state text,
  country text,
  pincode text,
  business_type text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text not null unique,
  source text not null default 'Manual Entry',
  lead_owner_id text,
  assigned_employee_id text,
  assigned_partner_id text,
  assigned_district_head_id text,
  assigned_state_head_id text,
  company text,
  customer_name text not null,
  mobile text,
  email text,
  location text,
  address text,
  city text,
  district text,
  state text,
  country text default 'India',
  pincode text,
  business_type text,
  project_category text,
  expected_budget numeric(14,2) not null default 0,
  expected_closing_date date,
  priority text not null default 'Medium',
  lead_score integer not null default 0,
  status text not null default 'New',
  remarks text,
  tags text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz,
  client_id uuid references public.crm_clients(id) on delete set null,
  quotation_id uuid,
  project_id uuid,
  constraint crm_leads_source_check check (source in ('Website','WhatsApp','Instagram','Facebook','Walk-in','Phone Call','Referral','Existing Client','APN Referral','Employee Referral','Manual Entry')),
  constraint crm_leads_status_check check (status in ('New','Assigned','Contacted','Follow-up','Interested','Quotation Sent','Negotiation','Won','Lost','On Hold','Cancelled','Converted','Closed')),
  constraint crm_leads_priority_check check (priority in ('Low','Medium','High','Urgent')),
  constraint crm_leads_score_check check (lead_score between 0 and 100),
  constraint crm_leads_budget_check check (expected_budget >= 0)
);

create table if not exists public.crm_lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  employee_id text,
  partner_id text,
  district_head_id text,
  state_head_id text,
  assigned_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  follow_up_date date not null,
  follow_up_time time,
  reminder_at timestamptz,
  priority text not null default 'Medium',
  notes text not null default '',
  outcome text,
  next_follow_up date,
  completed_by text,
  completed_at timestamptz,
  status text not null default 'Open',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_follow_up_priority_check check (priority in ('Low','Medium','High','Urgent')),
  constraint crm_follow_up_status_check check (status in ('Open','Completed','Cancelled'))
);

create table if not exists public.crm_quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  client_id uuid references public.crm_clients(id) on delete set null,
  service_type text not null default 'Custom Services',
  title text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(7,2) not null default 0,
  gst numeric(7,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  validity_until date,
  status text not null default 'Draft',
  version integer not null default 1,
  approval_status text not null default 'Not Required',
  approved_by text,
  approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_quotes_status_check check (status in ('Draft','Pending Approval','Approved','Sent','Viewed','Accepted','Rejected','Expired','Converted')),
  constraint crm_quotes_service_check check (service_type in ('Website','Mobile App','Software','Marketing','Training','AMC','Custom Services')),
  constraint crm_quotes_values_check check (subtotal >= 0 and discount >= 0 and tax >= 0 and gst >= 0 and grand_total >= 0)
);

create table if not exists public.crm_quotation_versions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.crm_quotations(id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (quotation_id, version)
);

create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique,
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  quotation_id uuid not null references public.crm_quotations(id) on delete restrict,
  client_id uuid references public.crm_clients(id) on delete set null,
  name text not null,
  service_type text not null default 'Custom Services',
  project_value numeric(14,2) not null default 0,
  status text not null default 'Open',
  assigned_employee_id text,
  assigned_partner_id text,
  apn_project_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_projects_status_check check (status in ('Open','In Progress','On Hold','Completed','Cancelled')),
  constraint crm_projects_value_check check (project_value >= 0)
);

create table if not exists public.crm_revenue_collections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects(id) on delete restrict,
  received_amount numeric(14,2) not null,
  received_at date not null default current_date,
  commission_generated numeric(14,2) not null default 0,
  incentive numeric(14,2) not null default 0,
  status text not null default 'Received',
  remarks text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint crm_revenue_amount_check check (received_amount > 0 and commission_generated >= 0 and incentive >= 0),
  constraint crm_revenue_status_check check (status in ('Received','Processing','Completed','Cancelled'))
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete restrict,
  project_id uuid references public.crm_projects(id) on delete restrict,
  event_type text not null,
  title text not null,
  description text not null default '',
  actor_id text,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete restrict,
  project_id uuid references public.crm_projects(id) on delete restrict,
  quotation_id uuid references public.crm_quotations(id) on delete restrict,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  reminder_day integer not null,
  due_at timestamptz not null,
  priority text not null default 'Normal',
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  unique (lead_id, reminder_day)
);

create table if not exists public.crm_audit (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete restrict,
  project_id uuid references public.crm_projects(id) on delete restrict,
  quotation_id uuid references public.crm_quotations(id) on delete restrict,
  action text not null,
  actor_id text,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_status_updated_idx on public.crm_leads(status, updated_at desc);
create index if not exists crm_leads_assignment_idx on public.crm_leads(assigned_employee_id, assigned_partner_id, updated_at desc);
create index if not exists crm_leads_location_idx on public.crm_leads(district, state);
create index if not exists crm_leads_search_idx on public.crm_leads using gin (to_tsvector('simple', coalesce(lead_number,'') || ' ' || coalesce(customer_name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,'') || ' ' || coalesce(mobile,'')));
create index if not exists crm_follow_ups_due_idx on public.crm_follow_ups(status, follow_up_date, follow_up_time);
create index if not exists crm_quotes_lead_status_idx on public.crm_quotations(lead_id, status, updated_at desc);
create index if not exists crm_projects_lead_idx on public.crm_projects(lead_id, status);
create index if not exists crm_revenue_project_date_idx on public.crm_revenue_collections(project_id, received_at desc);
create index if not exists crm_activities_lead_date_idx on public.crm_activities(lead_id, created_at desc);
create index if not exists crm_audit_lead_date_idx on public.crm_audit(lead_id, created_at desc);

create or replace function public.crm_can_manage()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('accountant','staff','intern','district_head','state_head') and active);
$$;

create or replace function public.crm_can_read(p_employee text default null, p_partner text default null, p_district text default null, p_state text default null)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin()
    or auth.uid()::text = p_employee
    or auth.uid()::text = p_partner
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'district_head' and active and name = p_district)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'state_head' and active and name = p_state);
$$;

create or replace function public.crm_actor_name() returns text language sql security definer stable set search_path = public as $$ select coalesce(public.current_name(), 'System'); $$;

create or replace function public.crm_log_event(p_event text, p_title text, p_description text, p_lead uuid default null, p_project uuid default null, p_quote uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor text := auth.uid()::text; v_name text := public.crm_actor_name(); v_id text := 'crm:' || gen_random_uuid()::text;
begin
  insert into public.crm_activities(lead_id, project_id, event_type, title, description, actor_id, actor_name, metadata)
  values (p_lead, p_project, p_event, p_title, p_description, v_actor, v_name, p_metadata);
  insert into public.crm_audit(lead_id, project_id, quotation_id, action, actor_id, actor_name, metadata)
  values (p_lead, p_project, p_quote, p_event, v_actor, v_name, p_metadata);
  if to_regclass('public.audit') is not null then
    insert into public.audit(id, data, updated_at) values (v_id, jsonb_build_object('id',v_id,'ts',(extract(epoch from now())*1000)::bigint,'user',v_name,'userId',v_actor,'action',p_event,'module','Leads','entity','CRM','entityId',coalesce(p_lead::text,p_project::text,p_quote::text),'description',p_description), now());
  end if;
end $$;

create or replace function public.crm_notify(p_title text, p_message text, p_priority text default 'Normal', p_lead uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := 'crm-notification:' || gen_random_uuid()::text; v_name text := public.crm_actor_name();
begin
  if to_regclass('public.notifications') is not null then
    insert into public.notifications(id, data, updated_at) values (v_id, jsonb_build_object('id',v_id,'title',p_title,'message',p_message,'body',p_message,'senderName',v_name,'senderDesignation','CRM','senderAvatar',null,'date',current_date::text,'time',to_char(current_timestamp,'HH24:MI'),'priority',p_priority,'module','Leads','leadId',p_lead,'createdAt',(extract(epoch from now())*1000)::bigint), now());
  end if;
end $$;

create or replace function public.crm_create_lead(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.crm_leads%rowtype; v_lead_id uuid := coalesce(nullif(p_payload->>'id','')::uuid, gen_random_uuid()); v_score integer := greatest(0, least(100, coalesce(nullif(p_payload->>'lead_score','')::integer, 0))); v_source text := coalesce(nullif(trim(p_payload->>'source'),''),'Manual Entry');
begin
  if not public.crm_can_manage() then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  if nullif(trim(p_payload->>'customer_name'),'') is null then raise exception 'Customer name is required.' using errcode='check_violation'; end if;
  if v_source not in ('Website','WhatsApp','Instagram','Facebook','Walk-in','Phone Call','Referral','Existing Client','APN Referral','Employee Referral','Manual Entry') then raise exception 'Invalid lead source.' using errcode='invalid_parameter_value'; end if;
  insert into public.crm_leads(id, lead_number, source, lead_owner_id, assigned_employee_id, assigned_partner_id, assigned_district_head_id, assigned_state_head_id, company, customer_name, mobile, email, location, address, city, district, state, country, pincode, business_type, project_category, expected_budget, expected_closing_date, priority, lead_score, status, remarks, tags, created_by)
  values (v_lead_id, 'CRM-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(nextval('public.crm_lead_number_seq')::text, 6, '0'), v_source, nullif(p_payload->>'lead_owner_id',''), nullif(p_payload->>'assigned_employee_id',''), nullif(p_payload->>'assigned_partner_id',''), nullif(p_payload->>'assigned_district_head_id',''), nullif(p_payload->>'assigned_state_head_id',''), nullif(p_payload->>'company',''), trim(p_payload->>'customer_name'), nullif(p_payload->>'mobile',''), nullif(p_payload->>'email',''), nullif(p_payload->>'location',''), nullif(p_payload->>'address',''), nullif(p_payload->>'city',''), nullif(p_payload->>'district',''), nullif(p_payload->>'state',''), coalesce(nullif(p_payload->>'country',''),'India'), nullif(p_payload->>'pincode',''), nullif(p_payload->>'business_type',''), nullif(p_payload->>'project_category',''), greatest(0, coalesce(nullif(p_payload->>'expected_budget','')::numeric,0)), nullif(p_payload->>'expected_closing_date','')::date, coalesce(nullif(p_payload->>'priority',''),'Medium'), v_score, coalesce(nullif(p_payload->>'status',''),'New'), nullif(p_payload->>'remarks',''), coalesce(array(select jsonb_array_elements_text(p_payload->'tags')), '{}'), auth.uid()::text)
  returning * into v_row;
  perform public.crm_log_event('lead_created','Lead created',format('%s was added to the pipeline.',v_row.customer_name),v_row.id);
  perform public.crm_notify('New lead',format('%s was added to the CRM pipeline.',v_row.customer_name),'Normal',v_row.id);
  return to_jsonb(v_row);
end $$;

create or replace function public.crm_update_lead(p_lead_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.crm_leads%rowtype; v_status text;
begin
  select * into v from public.crm_leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found.' using errcode='no_data_found'; end if;
  if not public.crm_can_read(v.assigned_employee_id,v.assigned_partner_id,v.district,v.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  v_status := coalesce(p_patch->>'status',v.status);
  if v_status not in ('New','Assigned','Contacted','Follow-up','Interested','Quotation Sent','Negotiation','Won','Lost','On Hold','Cancelled','Converted','Closed') then raise exception 'Invalid lead status.' using errcode='invalid_parameter_value'; end if;
  update public.crm_leads set company=coalesce(p_patch->>'company',company), customer_name=coalesce(nullif(trim(p_patch->>'customer_name'),''),customer_name), mobile=coalesce(p_patch->>'mobile',mobile), email=coalesce(p_patch->>'email',email), location=coalesce(p_patch->>'location',location), address=coalesce(p_patch->>'address',address), city=coalesce(p_patch->>'city',city), district=coalesce(p_patch->>'district',district), state=coalesce(p_patch->>'state',state), pincode=coalesce(p_patch->>'pincode',pincode), business_type=coalesce(p_patch->>'business_type',business_type), project_category=coalesce(p_patch->>'project_category',project_category), expected_budget=coalesce(nullif(p_patch->>'expected_budget','')::numeric,expected_budget), expected_closing_date=coalesce(nullif(p_patch->>'expected_closing_date','')::date,expected_closing_date), priority=coalesce(p_patch->>'priority',priority), lead_score=greatest(0,least(100,coalesce(nullif(p_patch->>'lead_score','')::integer,lead_score))), status=v_status, remarks=coalesce(p_patch->>'remarks',remarks), tags=case when p_patch ? 'tags' then array(select jsonb_array_elements_text(p_patch->'tags')) else tags end, updated_at=now(), converted_at=case when v_status='Converted' then coalesce(converted_at,now()) else converted_at end where id=p_lead_id returning * into v;
  perform public.crm_log_event('lead_updated','Lead updated',format('%s was updated.',v.customer_name),v.id);
  return to_jsonb(v);
end $$;

create or replace function public.crm_assign_lead(p_lead_id uuid,p_employee_id text default null,p_partner_id text default null,p_district_head_id text default null,p_state_head_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.crm_leads%rowtype;
begin
  if not public.is_admin() then raise exception 'Only CRM administrators may assign leads.' using errcode='insufficient_privilege'; end if;
  update public.crm_leads set assigned_employee_id=p_employee_id,assigned_partner_id=p_partner_id,assigned_district_head_id=p_district_head_id,assigned_state_head_id=p_state_head_id,status=case when status='New' then 'Assigned' else status end,updated_at=now() where id=p_lead_id returning * into v;
  if not found then raise exception 'Lead not found.' using errcode='no_data_found'; end if;
  insert into public.crm_lead_assignments(lead_id,employee_id,partner_id,district_head_id,state_head_id,assigned_by) values (v.id,p_employee_id,p_partner_id,p_district_head_id,p_state_head_id,auth.uid()::text);
  perform public.crm_log_event('lead_assigned','Lead assigned',format('%s was assigned to the selected team and partner owners.',v.customer_name),v.id);
  perform public.crm_notify('Lead assignment',format('%s has been assigned for follow-up.',v.customer_name),'Important',v.id);
  return to_jsonb(v);
end $$;

create or replace function public.crm_add_follow_up(p_lead_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.crm_follow_ups%rowtype;
begin
  if not exists(select 1 from public.crm_leads l where l.id=p_lead_id and public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  insert into public.crm_follow_ups(lead_id,follow_up_date,follow_up_time,reminder_at,priority,notes,next_follow_up,created_by)
  values(p_lead_id,(p_payload->>'follow_up_date')::date,nullif(p_payload->>'follow_up_time','')::time,nullif(p_payload->>'reminder_at','')::timestamptz,coalesce(nullif(p_payload->>'priority',''),'Medium'),coalesce(p_payload->>'notes',''),nullif(p_payload->>'next_follow_up','')::date,auth.uid()::text) returning * into v;
  update public.crm_leads set status=case when status in ('New','Assigned','Contacted') then 'Follow-up' else status end,updated_at=now() where id=p_lead_id;
  perform public.crm_log_event('follow_up_created','Follow-up scheduled',format('Follow-up scheduled for %s.',v.follow_up_date),p_lead_id);
  perform public.crm_notify('Follow-up scheduled','A lead follow-up was scheduled.','Normal',p_lead_id);
  return to_jsonb(v);
end $$;

create or replace function public.crm_create_quotation(p_lead_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.crm_quotations%rowtype; l public.crm_leads%rowtype; c public.crm_clients%rowtype; v_sub numeric:=0; v_discount numeric:=greatest(0,coalesce(nullif(p_payload->>'discount','')::numeric,0)); v_gst numeric:=greatest(0,coalesce(nullif(coalesce(p_payload->>'gst',p_payload->>'tax'),'')::numeric,0)); item jsonb;
begin
  select * into l from public.crm_leads where id=p_lead_id for update;
  if not found or not public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  insert into public.crm_clients(client_key,customer_name,company,mobile,email,location,address,city,district,state,country,pincode,business_type,created_by)
  values(coalesce(nullif(lower(trim(l.email)),''),nullif(regexp_replace(l.mobile,'[^0-9]','','g'),''),lower(trim(l.customer_name))),l.customer_name,l.company,l.mobile,l.email,l.location,l.address,l.city,l.district,l.state,l.country,l.pincode,l.business_type,auth.uid()::text)
  on conflict(client_key) do update set updated_at=now() returning * into c;
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb))='array' then for item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop v_sub:=v_sub+greatest(0,coalesce(nullif(item->>'quantity','')::numeric,1))*greatest(0,coalesce(nullif(coalesce(item->>'unit_price',item->>'price'),'')::numeric,0)); end loop; end if;
  insert into public.crm_quotations(quote_number,lead_id,client_id,service_type,title,items,subtotal,discount,tax,gst,grand_total,validity_until,status,approval_status,created_by)
  values('QT-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),p_lead_id,c.id,coalesce(nullif(p_payload->>'service_type',''),'Custom Services'),coalesce(nullif(p_payload->>'title',''),l.customer_name||' proposal'),coalesce(p_payload->'items','[]'::jsonb),round(v_sub,2),v_discount,v_gst,v_gst,round(greatest(0,v_sub-v_discount)*(1+v_gst/100),2),nullif(p_payload->>'validity_until','')::date,coalesce(nullif(p_payload->>'status',''),'Draft'),case when public.is_admin() then 'Not Required' else 'Pending' end,auth.uid()::text) returning * into v;
  insert into public.crm_quotation_versions(quotation_id,version,snapshot,created_by) values(v.id,v.version,to_jsonb(v),auth.uid()::text);
  update public.crm_leads set client_id=c.id,quotation_id=v.id,status=case when status in ('New','Assigned','Contacted','Follow-up','Interested') then 'Quotation Sent' else status end,updated_at=now() where id=p_lead_id;
  perform public.crm_log_event('quotation_created','Quotation created',format('%s was created for %s.',v.quote_number,l.customer_name),p_lead_id,null,v.id);
  perform public.crm_notify('Quotation created',format('%s is ready for review.',v.quote_number),'Normal',p_lead_id);
  return to_jsonb(v);
end $$;

create or replace function public.crm_convert_quotation(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.crm_quotations%rowtype; l public.crm_leads%rowtype; p public.crm_projects%rowtype; apn_id text; apn_rate numeric; apn_data jsonb; v_apn_project_id text;
begin
  if not public.is_admin() then raise exception 'Only CRM administrators may convert quotations.' using errcode='insufficient_privilege'; end if;
  select * into q from public.crm_quotations where id=p_quote_id for update; if not found then raise exception 'Quotation not found.' using errcode='no_data_found'; end if;
  select * into l from public.crm_leads where id=q.lead_id for update;
  if q.status not in ('Accepted','Converted') then raise exception 'Only accepted quotations can create projects.' using errcode='check_violation'; end if;
  select * into p from public.crm_projects where quotation_id=q.id limit 1;
  if p.id is null then
    insert into public.crm_projects(project_number,lead_id,quotation_id,client_id,name,service_type,project_value,assigned_employee_id,assigned_partner_id,created_by)
    values('PRJ-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,q.id,q.client_id,q.title,q.service_type,q.grand_total,l.assigned_employee_id,l.assigned_partner_id,auth.uid()::text) returning * into p;
  end if;
  apn_id := nullif(l.assigned_partner_id,'');
  if apn_id is not null and to_regclass('public.apn_commission_projects') is not null and p.apn_project_id is null then
    apn_rate := coalesce((select nullif(u.data->>'commissionPct','')::numeric from public.apn_users u where u.id=apn_id),10);
    v_apn_project_id := 'crm-'||p.id::text;
    apn_data := jsonb_build_object('id',v_apn_project_id,'partnerId',apn_id,'projectName',p.name,'clientName',l.customer_name,'category',p.service_type,'projectValue',p.project_value,'commissionRate',apn_rate,'maximumCommission',round(p.project_value*apn_rate/100,2),'totalReceived',0,'remainingAmount',p.project_value,'remainingCommission',round(p.project_value*apn_rate/100,2),'status','Pending','createdBy',auth.uid()::text,'createdAt',(extract(epoch from now())*1000)::bigint);
    insert into public.apn_commission_projects(id,data,updated_at) values(v_apn_project_id,apn_data,now()) on conflict(id) do nothing;
    update public.crm_projects set apn_project_id=v_apn_project_id,updated_at=now() where id=p.id returning * into p;
  end if;
  update public.crm_quotations set status='Converted',updated_at=now() where id=q.id;
  update public.crm_leads set status='Converted',converted_at=coalesce(converted_at,now()),project_id=p.id,updated_at=now() where id=l.id;
  perform public.crm_log_event('project_created','Project created',format('%s was created from %s.',p.name,q.quote_number),l.id,p.id,q.id);
  perform public.crm_notify('Project created',format('%s is now in the delivery pipeline.',p.name),'Important',l.id);
  return to_jsonb(p);
end $$;

create or replace function public.crm_update_quotation_status(p_quote_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.crm_quotations%rowtype; result jsonb;
begin
  if p_status not in ('Draft','Pending Approval','Approved','Sent','Viewed','Accepted','Rejected','Expired','Converted') then raise exception 'Invalid quotation status.' using errcode='invalid_parameter_value'; end if;
  select * into q from public.crm_quotations where id=p_quote_id for update; if not found then raise exception 'Quotation not found.' using errcode='no_data_found'; end if;
  if not public.is_admin() and p_status in ('Approved','Accepted','Converted') then raise exception 'Approval access denied.' using errcode='insufficient_privilege'; end if;
  update public.crm_quotations set status=p_status,approval_status=case when p_status='Approved' then 'Approved' else approval_status end,approved_by=case when p_status='Approved' then auth.uid()::text else approved_by end,approved_at=case when p_status='Approved' then now() else approved_at end,updated_at=now() where id=p_quote_id;
  select to_jsonb(x) into result from public.crm_quotations x where x.id=p_quote_id;
  perform public.crm_log_event('quotation_'||lower(replace(p_status,' ', '_')),'Quotation status updated',format('%s is now %s.',q.quote_number,p_status),q.lead_id,null,q.id,jsonb_build_object('status',p_status));
  if p_status='Accepted' then result:=public.crm_convert_quotation(p_quote_id); end if;
  return result;
end $$;

create or replace function public.crm_record_revenue(p_project_id uuid,p_amount numeric,p_received_at date default current_date,p_incentive numeric default 0,p_remarks text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.crm_projects%rowtype; r public.crm_revenue_collections%rowtype;
begin
  if not public.is_admin() and not exists(select 1 from public.crm_projects x where x.id=p_project_id and public.crm_can_read(x.assigned_employee_id,x.assigned_partner_id,null,null)) then raise exception 'Revenue access denied.' using errcode='insufficient_privilege'; end if;
  if p_amount<=0 or p_incentive<0 then raise exception 'Revenue and incentive values are invalid.' using errcode='check_violation'; end if;
  select * into p from public.crm_projects where id=p_project_id for update; if not found then raise exception 'Project not found.' using errcode='no_data_found'; end if;
  if coalesce((select sum(received_amount) from public.crm_revenue_collections where project_id=p.id and status<>'Cancelled'),0)+p_amount>p.project_value then raise exception 'Revenue exceeds project value.' using errcode='check_violation'; end if;
  insert into public.crm_revenue_collections(project_id,received_amount,received_at,incentive,remarks,created_by) values(p.id,p_amount,coalesce(p_received_at,current_date),p_incentive,p_remarks,auth.uid()::text) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.crm_sync_revenue_to_apn()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.crm_projects%rowtype; apn public.apn_commission_projects%rowtype; v_comm numeric:=0; v_data jsonb;
begin
  select * into p from public.crm_projects where id=new.project_id;
  if p.apn_project_id is not null and to_regclass('public.apn_commission_projects') is not null then
    select * into apn from public.apn_commission_projects where id=p.apn_project_id for update;
    if apn.id is not null then
      v_comm:=least(greatest(0,apn.maximum_commission-coalesce(apn.total_commission_paid,0)-coalesce((select sum(commission_generated) from public.crm_revenue_collections where project_id=p.id and id<>new.id and status<>'Cancelled'),0)),round(new.received_amount*apn.commission_rate/100,2));
      update public.crm_revenue_collections set commission_generated=v_comm,status='Processing' where id=new.id;
      v_data:=jsonb_build_object('id','crm-revenue-'||new.id::text,'projectId',apn.id,'partnerId',apn.partner_id,'receivedAmount',new.received_amount,'commissionGenerated',v_comm,'incentive',new.incentive,'receivedDate',new.received_at::text,'commissionStatus','Payable','createdBy',auth.uid()::text);
      insert into public.apn_revenue_collections(id,project_id,partner_id,received_amount,commission_generated,incentive,received_date,created_by,commission_status,data,updated_at) values('crm-revenue-'||new.id::text,apn.id,apn.partner_id,new.received_amount,v_comm,new.incentive,new.received_at,auth.uid()::text,'Payable',v_data,now()) on conflict(id) do nothing;
      update public.apn_commission_projects set total_received=coalesce(total_received,0)+new.received_amount,remaining_amount=greatest(0,project_value-(coalesce(total_received,0)+new.received_amount)),remaining_commission=greatest(0,maximum_commission-coalesce((select sum(c.commission_generated) from public.apn_revenue_collections c where c.project_id=apn.id and c.commission_status<>'Paid'),0)-coalesce(total_commission_paid,0)),status=case when coalesce(total_received,0)+new.received_amount>=project_value then 'Completed' else 'Processing' end,updated_at=now(),data=data||jsonb_build_object('totalReceived',coalesce(total_received,0)+new.received_amount,'remainingAmount',greatest(0,project_value-(coalesce(total_received,0)+new.received_amount)),'remainingCommission',greatest(0,maximum_commission-coalesce((select sum(c.commission_generated) from public.apn_revenue_collections c where c.project_id=apn.id and c.commission_status<>'Paid'),0)-coalesce(total_commission_paid,0)),'status',case when coalesce(total_received,0)+new.received_amount>=project_value then 'Completed' else 'Processing' end) where id=apn.id;
    end if;
  end if;
  if to_regclass('public.transactions') is not null then
    insert into public.transactions(id,data,updated_at) values('crm-finance-'||new.id::text,jsonb_build_object('id','crm-finance-'||new.id::text,'kind','income','amount',new.received_amount,'date',new.received_at::text,'client',p.name,'project',p.name,'category','Project','notes',coalesce(new.remarks,'CRM revenue collection'),'createdAt',(extract(epoch from now())*1000)::bigint,'crmProjectId',p.id::text),now()) on conflict(id) do nothing;
  end if;
  update public.crm_projects set status=case when coalesce((select sum(received_amount) from public.crm_revenue_collections where project_id=p.id and status<>'Cancelled'),0)>=project_value then 'Completed' else 'In Progress' end,updated_at=now() where id=p.id;
  perform public.crm_log_event('revenue_collected','Revenue collected',format('%s was collected for %s.',to_char(new.received_amount,'FM999G999G990D00'),p.name),p.lead_id,p.id,null,jsonb_build_object('amount',new.received_amount,'commission',v_comm));
  perform public.crm_notify('Revenue collected',format('Revenue was recorded for %s.',p.name),'Normal',p.lead_id);
  return new;
end $$;
drop trigger if exists crm_revenue_sync_trg on public.crm_revenue_collections;
create trigger crm_revenue_sync_trg after insert on public.crm_revenue_collections for each row execute function public.crm_sync_revenue_to_apn();

create or replace function public.crm_generate_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare l record; d integer; count_added integer:=0; v_priority text;
begin
  for l in select * from public.crm_leads where status not in ('Won','Lost','Cancelled','Converted','Closed') loop
    d:=greatest(0,extract(day from now()-l.updated_at)::integer);
    foreach d in array array[2,5,10,15] loop
      if greatest(0,extract(day from now()-l.updated_at)::integer)>=d and not exists(select 1 from public.crm_reminders r where r.lead_id=l.id and r.reminder_day=d) then
        v_priority:=case when d>=10 then 'High' else 'Normal' end;
        insert into public.crm_reminders(lead_id,reminder_day,due_at,priority) values(l.id,d,l.updated_at+make_interval(days=>d),v_priority);
        perform public.crm_notify(case when d>=15 then 'Lead escalated' else 'Lead reminder' end,format('%s has had no follow-up for %s days.',l.customer_name,d),v_priority,l.id);
        count_added:=count_added+1;
      end if;
    end loop;
  end loop;
  return count_added;
end $$;

create or replace view public.crm_lead_pipeline as
select l.*,coalesce(f.open_follow_ups,0) open_follow_ups,coalesce(q.quote_count,0) quote_count,coalesce(r.revenue,0) revenue,coalesce(p.project_count,0) project_count
from public.crm_leads l
left join (select lead_id,count(*) filter(where status='Open') open_follow_ups from public.crm_follow_ups group by lead_id) f on f.lead_id=l.id
left join (select lead_id,count(*) quote_count from public.crm_quotations group by lead_id) q on q.lead_id=l.id
left join (select lead_id,count(*) project_count from public.crm_projects group by lead_id) p on p.lead_id=l.id
left join (select p.lead_id,sum(r.received_amount) revenue from public.crm_projects p join public.crm_revenue_collections r on r.project_id=p.id and r.status<>'Cancelled' group by p.lead_id) r on r.lead_id=l.id;

create or replace view public.crm_lead_dashboard as
select count(*) filter(where status='New') new_leads,count(*) filter(where priority in ('High','Urgent')) hot_leads,count(*) filter(where priority='Low') cold_leads,count(*) filter(where status='Won' or status='Converted') won_leads,count(*) filter(where status='Lost') lost_leads,count(*) filter(where status not in ('Won','Lost','Cancelled','Converted','Closed')) active_leads,coalesce((select sum(received_amount) from public.crm_revenue_collections where status<>'Cancelled'),0) revenue,case when count(*)=0 then 0 else round(count(*) filter(where status in ('Won','Converted','Closed'))*100.0/count(*),2) end conversion_rate from public.crm_leads;

create or replace view public.crm_revenue_summary as
select p.id project_id,p.project_number,p.name,p.assigned_partner_id,p.project_value,coalesce(sum(r.received_amount) filter(where r.status<>'Cancelled'),0) total_revenue,coalesce(sum(r.commission_generated) filter(where r.status<>'Cancelled'),0) total_commission,coalesce(sum(r.incentive) filter(where r.status<>'Cancelled'),0) total_incentive from public.crm_projects p left join public.crm_revenue_collections r on r.project_id=p.id group by p.id;

alter table public.crm_clients enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_lead_assignments enable row level security;
alter table public.crm_follow_ups enable row level security;
alter table public.crm_quotations enable row level security;
alter table public.crm_quotation_versions enable row level security;
alter table public.crm_projects enable row level security;
alter table public.crm_revenue_collections enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_files enable row level security;
alter table public.crm_reminders enable row level security;
alter table public.crm_audit enable row level security;

drop policy if exists crm_clients_select on public.crm_clients;
create policy crm_clients_select on public.crm_clients for select to authenticated using (public.is_admin() or created_by=auth.uid()::text);
drop policy if exists crm_leads_select on public.crm_leads;
create policy crm_leads_select on public.crm_leads for select to authenticated using (public.is_admin() or created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text);
drop policy if exists crm_lead_assignments_select on public.crm_lead_assignments;
create policy crm_lead_assignments_select on public.crm_lead_assignments for select to authenticated using (public.is_admin() or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_follow_ups_select on public.crm_follow_ups;
create policy crm_follow_ups_select on public.crm_follow_ups for select to authenticated using (public.is_admin() or created_by=auth.uid()::text or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_quotations_select on public.crm_quotations;
create policy crm_quotations_select on public.crm_quotations for select to authenticated using (public.is_admin() or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_quotation_versions_select on public.crm_quotation_versions;
create policy crm_quotation_versions_select on public.crm_quotation_versions for select to authenticated using (public.is_admin() or quotation_id in (select id from public.crm_quotations where lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text)));
drop policy if exists crm_projects_select on public.crm_projects;
create policy crm_projects_select on public.crm_projects for select to authenticated using (public.is_admin() or created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text);
drop policy if exists crm_revenue_collections_select on public.crm_revenue_collections;
create policy crm_revenue_collections_select on public.crm_revenue_collections for select to authenticated using (public.is_admin() or project_id in (select id from public.crm_projects where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_activities_select on public.crm_activities;
create policy crm_activities_select on public.crm_activities for select to authenticated using (public.is_admin() or actor_id=auth.uid()::text or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text) or project_id in (select id from public.crm_projects where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_files_select on public.crm_files;
create policy crm_files_select on public.crm_files for select to authenticated using (public.is_admin() or uploaded_by=auth.uid()::text or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text) or project_id in (select id from public.crm_projects where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_reminders_select on public.crm_reminders;
create policy crm_reminders_select on public.crm_reminders for select to authenticated using (public.is_admin() or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
drop policy if exists crm_audit_select on public.crm_audit;
create policy crm_audit_select on public.crm_audit for select to authenticated using (public.is_admin() or actor_id=auth.uid()::text or lead_id in (select id from public.crm_leads where created_by=auth.uid()::text or assigned_employee_id=auth.uid()::text or assigned_partner_id=auth.uid()::text));
do $$ declare t text; begin foreach t in array array['crm_clients','crm_leads','crm_lead_assignments','crm_follow_ups','crm_quotations','crm_quotation_versions','crm_projects','crm_revenue_collections','crm_activities','crm_files','crm_reminders','crm_audit'] loop execute format('grant select on public.%I to authenticated',t); end loop; end $$;
grant execute on function public.crm_create_lead(jsonb),public.crm_update_lead(uuid,jsonb),public.crm_assign_lead(uuid,text,text,text,text),public.crm_add_follow_up(uuid,jsonb),public.crm_create_quotation(uuid,jsonb),public.crm_convert_quotation(uuid),public.crm_update_quotation_status(uuid,text),public.crm_record_revenue(uuid,numeric,date,numeric,text),public.crm_generate_reminders() to authenticated;

do $$ declare t text; begin foreach t in array array['crm_clients','crm_leads','crm_lead_assignments','crm_follow_ups','crm_quotations','crm_quotation_versions','crm_projects','crm_revenue_collections','crm_activities','crm_files','crm_reminders','crm_audit'] loop begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; when others then null; end; end loop; end $$;

do $$ begin if exists(select 1 from pg_namespace where nspname='cron') then begin perform cron.schedule('crm-lead-reminders-daily','15 3 * * *','select public.crm_generate_reminders()'); exception when others then null; end; end if; end $$;

commit;
select pg_notify('pgrst','reload schema');

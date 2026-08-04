begin;

-- PR-Web-2: deterministic requirement discovery infrastructure. This migration
-- extends PR-Web-1 rather than replacing it: the public RPC contract stays
-- web_ai_start/web_ai_message so existing links and referral attribution live.

create table if not exists public.web_requirement_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  conversation_id uuid not null unique references public.web_ai_conversations(id) on delete cascade,
  service_slug text,
  status text not null default 'active' check (status in ('active','completed','abandoned','rate_limited')),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  estimated_revenue numeric(14,2),
  dropoff_question_slug text,
  last_question_slug text,
  requirement_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz
);
create table if not exists public.web_requirement_questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  question_key text not null,
  prompt text not null,
  question_type text not null default 'text' check (question_type in ('text','email','phone','number','choice','multi_choice','textarea')),
  choices jsonb not null default '[]'::jsonb,
  help_text text not null default '',
  required boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.web_requirement_question_flow (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.web_requirement_questions(id) on delete cascade,
  service_slug text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  unique(question_id, service_slug)
);
update public.web_requirement_question_flow set service_slug='' where service_slug is null;
alter table public.web_requirement_question_flow alter column service_slug set not null;
create table if not exists public.web_requirement_question_rules (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.web_requirement_questions(id) on delete cascade,
  condition_key text not null,
  operator text not null default 'equals' check (operator in ('equals','contains','not_equals','exists')),
  condition_value text not null default '',
  action text not null default 'show' check (action in ('show','skip')),
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(question_id, condition_key, operator, condition_value)
);
create table if not exists public.web_requirement_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.web_requirement_sessions(id) on delete cascade,
  question_id uuid not null references public.web_requirement_questions(id) on delete restrict,
  answer_text text not null default '',
  answer_value jsonb not null default '{}'::jsonb,
  source text not null default 'customer',
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, question_id)
);
create table if not exists public.web_requirement_replay (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.web_requirement_sessions(id) on delete cascade,
  sequence_no integer not null,
  actor text not null check (actor in ('customer','assistant','system')),
  content text not null,
  question_slug text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, sequence_no)
);
create table if not exists public.web_requirement_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.web_requirement_sessions(id) on delete cascade,
  snapshot_no integer not null,
  summary jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, snapshot_no)
);
create table if not exists public.web_requirement_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.web_requirement_sessions(id) on delete cascade,
  resume_token text not null unique,
  draft jsonb not null default '{}'::jsonb,
  last_saved_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '90 days'
);
create table if not exists public.web_requirement_completion_analytics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.web_requirement_sessions(id) on delete set null,
  event text not null check (event in ('started','service_detected','question_answered','snapshot','completed','abandoned','saved_draft','resumed','rate_limited')),
  service_slug text,
  question_slug text,
  completion_percent integer not null default 0,
  estimated_revenue numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists web_requirement_sessions_status_idx on public.web_requirement_sessions(status,last_activity_at desc);
create index if not exists web_requirement_sessions_service_idx on public.web_requirement_sessions(service_slug,started_at desc);
create index if not exists web_requirement_answers_session_idx on public.web_requirement_answers(session_id,answered_at);
create index if not exists web_requirement_flow_service_idx on public.web_requirement_question_flow(service_slug,sort_order);
create index if not exists web_requirement_rules_question_idx on public.web_requirement_question_rules(question_id,active,priority);
create index if not exists web_requirement_analytics_event_idx on public.web_requirement_completion_analytics(event,created_at desc);
create index if not exists web_requirement_analytics_service_idx on public.web_requirement_completion_analytics(service_slug,event,created_at desc);

do $$
declare qid uuid;
begin
  insert into public.web_requirement_questions(slug,question_key,prompt,question_type,choices,required,sort_order) values
    ('business-name','business_name','What is your business or project name?','text','[]',false,10),
    ('industry','industry','Which industry or business type best describes you?','text', '[]',false,20),
    ('users','users','How many people will use or manage this solution?','choice','["1–10","11–50","51–200","200+"]',false,30),
    ('branches','branches','How many branches, locations, or campuses do you have?','choice','["1","2–5","6+"]',false,40),
    ('location','location','Where is the business based, and where will you serve customers?','text','[]',false,50),
    ('goals','goals','What would you like this solution to improve or make easier?','textarea','[]',false,60),
    ('pain-points','pain_points','What is the biggest problem with your current process?','textarea','[]',false,70),
    ('existing-software','existing_software','Are you replacing or connecting to any existing software?','text','[]',false,80),
    ('integrations','integrations','Which integrations or communication channels are important?','multi_choice','["WhatsApp","Email","Payment gateway","Google Business","Analytics","Cloud backup","Existing software","Other"]',false,90),
    ('budget','budget','What budget range should we plan around?','choice','["Below ₹15,000","₹15,000–₹50,000","₹50,000–₹1,00,000","₹1,00,000–₹5,00,000","Above ₹5,00,000","Not sure"]',false,100),
    ('timeline','timeline','When would you like to launch or start?','choice','["This month","1–3 months","3–6 months","Just exploring"]',false,110),
    ('contact-name','contact_name','What is your name?','text', '[]',true,900),
    ('phone','phone','What phone or WhatsApp number should our team use?','phone','[]',true,910),
    ('email','email','What email address should receive the requirement summary?','email','[]',true,920),
    ('restaurant-ordering','restaurant_ordering','Do you need online ordering, delivery, or WhatsApp ordering?','multi_choice','["Online ordering","Delivery","WhatsApp ordering","Pickup","Not needed"]',false,200),
    ('restaurant-operations','restaurant_operations','Which restaurant operations matter most?','multi_choice','["Menu management","Reservations","Offers","Loyalty program","Analytics","Admin panel"]',false,210),
    ('restaurant-languages','restaurant_languages','Which languages should customers be able to use?','choice','["English only","English + Tamil","More languages"]',false,220),
    ('erp-departments','erp_departments','Which departments should the ERP connect?','multi_choice','["Inventory","Billing","GST","Attendance","Payroll","Warehouse","CRM","POS","Accounting"]',false,300),
    ('erp-scale','erp_scale','How complex is your ERP operation?','multi_choice','["Multiple departments","Multiple warehouses","Multiple branches","Approval workflows","Mobile app","Cloud access"]',false,310),
    ('website-scope','website_scope','What should the website include?','multi_choice','["Business pages","Landing pages","Blog","Portfolio","Contact forms","Admin panel","SEO","Analytics"]',false,400),
    ('ecommerce-scope','ecommerce_scope','Which commerce capabilities do you need?','multi_choice','["Product catalog","Payment gateway","Shipping","Offers and coupons","WhatsApp ordering","Customer accounts","Analytics"]',false,410)
  on conflict(slug) do update set prompt=excluded.prompt,question_type=excluded.question_type,choices=excluded.choices,required=excluded.required,updated_at=now();

  insert into public.web_requirement_question_flow(question_id,service_slug,sort_order)
  select id,'',sort_order from public.web_requirement_questions where slug in ('business-name','industry','users','branches','location','goals','pain-points','existing-software','integrations','budget','timeline','contact-name','phone','email') on conflict(question_id,service_slug) do update set sort_order=excluded.sort_order,active=true;
  insert into public.web_requirement_question_flow(question_id,service_slug,sort_order)
  select id,'restaurant',sort_order from public.web_requirement_questions where slug in ('restaurant-ordering','restaurant-operations','restaurant-languages') on conflict(question_id,service_slug) do update set sort_order=excluded.sort_order,active=true;
  insert into public.web_requirement_question_flow(question_id,service_slug,sort_order)
  select id,'erp',sort_order from public.web_requirement_questions where slug in ('erp-departments','erp-scale') on conflict(question_id,service_slug) do update set sort_order=excluded.sort_order,active=true;
  insert into public.web_requirement_question_flow(question_id,service_slug,sort_order)
  select id,'ecommerce',sort_order from public.web_requirement_questions where slug='ecommerce-scope' on conflict(question_id,service_slug) do update set sort_order=excluded.sort_order,active=true;
  insert into public.web_requirement_question_flow(question_id,service_slug,sort_order)
  select id,'website',sort_order from public.web_requirement_questions where slug='website-scope' on conflict(question_id,service_slug) do update set sort_order=excluded.sort_order,active=true;

  insert into public.web_requirement_question_rules(question_id,condition_key,operator,condition_value,action)
  select q.id,'service','equals','restaurant','show' from public.web_requirement_questions q where q.slug in ('restaurant-ordering','restaurant-operations','restaurant-languages') on conflict(question_id,condition_key,operator,condition_value) do update set active=true;
  insert into public.web_requirement_question_rules(question_id,condition_key,operator,condition_value,action)
  select q.id,'service','equals','erp','show' from public.web_requirement_questions q where q.slug in ('erp-departments','erp-scale') on conflict(question_id,condition_key,operator,condition_value) do update set active=true;
  insert into public.web_requirement_question_rules(question_id,condition_key,operator,condition_value,action)
  select q.id,'service','equals','ecommerce','show' from public.web_requirement_questions q where q.slug='ecommerce-scope' on conflict(question_id,condition_key,operator,condition_value) do update set active=true;
  insert into public.web_requirement_question_rules(question_id,condition_key,operator,condition_value,action)
  select q.id,'service','equals','website','show' from public.web_requirement_questions q where q.slug='website-scope' on conflict(question_id,condition_key,operator,condition_value) do update set active=true;
end $$;

create or replace function public.web_requirement_detect_service(p_text text) returns text language plpgsql stable security definer set search_path=public as $$
declare t text:=lower(coalesce(p_text,'')); begin
  if t like '%restaurant%' then return 'restaurant'; elsif t like '%e-commerce%' or t like '%ecommerce%' or t like '%online store%' then return 'ecommerce'; elsif t like '%real estate%' or t like '%property%' then return 'real-estate'; elsif t like '%hospital%' then return 'hospital'; elsif t like '%school%' or t like '%college%' then return 'school'; elsif t like '%hotel%' then return 'hotel'; elsif t like '%gym%' or t like '%fitness%' then return 'gym'; elsif t like '%salon%' then return 'salon'; elsif t like '%portfolio%' then return 'portfolio'; elsif t like '%corporate%' then return 'corporate'; elsif t like '%inventory%' then return 'inventory'; elsif t like '%hrms%' or t like '%human resource%' then return 'hrms'; elsif t like '%attendance%' then return 'attendance'; elsif t like '%accounting%' or t like '%accounts%' then return 'accounting'; elsif t like '%pos%' or t like '%point of sale%' then return 'pos'; elsif t like '%crm%' then return 'crm'; elsif t like '%erp%' then return 'erp'; elsif t like '%digital marketing%' or t like '%marketing%' then return 'digital-marketing'; elsif t like '%seo%' then return 'seo'; elsif t like '%hosting%' then return 'hosting'; elsif t like '%amc%' or t like '%maintenance%' then return 'amc'; elsif t like '%training%' or t like '%course%' then return 'training'; elsif t like '%consult%' then return 'consultation'; elsif t like '%website%' or t like '%web site%' then return 'website'; end if;
  return public.knowledge_resolve_service(t)::text;
end $$;

create or replace function public.web_requirement_next_question(p_service text,p_answers jsonb) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',q.id,'slug',q.slug,'key',q.question_key,'label',q.prompt,'type',q.question_type,'quick_replies',q.choices,'help_text',q.help_text,'required',q.required)
  from public.web_requirement_questions q join public.web_requirement_question_flow f on f.question_id=q.id
  where q.active and q.archived_at is null and f.active and (f.service_slug='' or f.service_slug=p_service)
    and not (p_answers ? q.question_key)
    and (not exists(select 1 from public.web_requirement_question_rules r where r.question_id=q.id and r.active) or exists(select 1 from public.web_requirement_question_rules r where r.question_id=q.id and r.active and ((r.condition_key='service' and lower(coalesce(p_answers->>'service',''))=lower(r.condition_value)) or (r.operator='exists' and p_answers ? r.condition_key) or (r.operator='equals' and lower(coalesce(p_answers->>r.condition_key,''))=lower(r.condition_value)) or (r.operator='contains' and lower(coalesce(p_answers->>r.condition_key,'')) like '%'||lower(r.condition_value)||'%'))))
  order by f.sort_order,q.sort_order,q.slug limit 1;
$$;

create or replace function public.web_requirement_summary(p_service text,p_answers jsonb,p_estimate jsonb,p_step integer) returns jsonb language sql stable security definer set search_path=public as $$
  with applicable as (select q.question_key from public.web_requirement_questions q join public.web_requirement_question_flow f on f.question_id=q.id where q.active and q.archived_at is null and f.active and (f.service_slug='' or f.service_slug=p_service) and (not exists(select 1 from public.web_requirement_question_rules r where r.question_id=q.id and r.active) or exists(select 1 from public.web_requirement_question_rules r where r.question_id=q.id and r.active and r.condition_key='service' and p_answers->>'service'=r.condition_value)))
  select jsonb_build_object('businessType',coalesce(p_service,'unknown'),'selectedFeatures',coalesce(p_answers->'features',p_answers->'modules',p_answers->'restaurant_ordering',p_answers->'restaurant_operations',p_answers->'erp_departments','[]'::jsonb),'recommendedPackage',p_estimate->>'package','estimatedTimeline',coalesce(p_answers->>'timeline','To be confirmed'),'estimatedCost',p_estimate->'estimated_cost','progress',case when (select count(*) from applicable)=0 then 0 else least(100,round((select count(*) from applicable where p_answers ? question_key)*100.0/(select count(*) from applicable))) end,'answered',p_step,'total', (select count(*) from applicable));
$$;

create or replace function public.web_requirement_upsert_lead(p_conversation_id uuid,p_service text,p_answers jsonb,p_estimate jsonb,p_lead_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare lid uuid:=p_lead_id; label text:=coalesce((select name from public.services where slug=p_service),initcap(replace(coalesce(p_service,'solution'),'-',' '))); name text:=coalesce(nullif(p_answers->>'contact_name',''),nullif(p_answers->>'business_name',''),'Website enquiry');
begin
  if lid is null then select id into lid from public.crm_leads where remarks like '%'||p_conversation_id::text||'%' order by created_at limit 1; end if;
  if lid is null then
    insert into public.crm_leads(id,lead_number,source,company,customer_name,mobile,email,business_type,project_category,expected_budget,priority,status,remarks,tags,website_referral_code,website_referral_partner_id)
    select gen_random_uuid(),'CRM-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,6,'0'),'Website',p_answers->>'business_name',name,p_answers->>'phone',p_answers->>'email',p_service,label,coalesce(nullif(p_estimate->>'estimated_cost','')::numeric,0),'Medium','New',left(jsonb_build_object('conversation_id',p_conversation_id,'answers',p_answers,'estimate',p_estimate)::text,4000),array['web-ai',p_service],c.referral_code,c.referral_partner_id from public.web_ai_conversations c where c.id=p_conversation_id returning id into lid;
  else update public.crm_leads set company=coalesce(nullif(p_answers->>'business_name',''),company),customer_name=name,mobile=coalesce(nullif(p_answers->>'phone',''),mobile),email=coalesce(nullif(p_answers->>'email',''),email),business_type=p_service,project_category=label,expected_budget=coalesce(nullif(p_estimate->>'estimated_cost','')::numeric,0),remarks=left(jsonb_build_object('conversation_id',p_conversation_id,'answers',p_answers,'estimate',p_estimate)::text,4000),updated_at=now() where id=lid; end if;
  return lid;
end $$;

create or replace function public.web_ai_payload(p_conversation_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; s public.web_ai_settings%rowtype; r public.web_requirement_sessions%rowtype; q jsonb; summary jsonb;
begin
  select * into c from public.web_ai_conversations where id=p_conversation_id; if not found then return '{}'::jsonb; end if; select * into s from public.web_ai_settings where id='default'; select * into r from public.web_requirement_sessions where conversation_id=c.id; q:=public.web_requirement_next_question(c.service_key,coalesce(c.state->'answers','{}'::jsonb)); summary:=coalesce(r.requirement_summary,public.web_requirement_summary(c.service_key,coalesce(c.state->'answers','{}'::jsonb),c.estimate,coalesce((c.state->>'step')::integer,0)));
  return jsonb_build_object('conversationId',c.id,'sessionId',c.session_id,'status',c.status,'state',c.state,'leadScore',c.lead_score,'leadTemperature',c.lead_temperature,'estimate',c.estimate,'summary',summary,'nextQuestion',q,'referralAttached',c.referral_partner_id is not null,'question',q,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'content',m.content,'message_type',m.message_type,'metadata',m.metadata,'created_at',m.created_at) order by m.created_at) from public.web_ai_messages m where m.conversation_id=c.id),'[]'::jsonb),'config',jsonb_build_object('enabled',s.enabled,'business_hours',s.business_hours,'fallback_contact',s.fallback_contact,'pricing_visibility',s.pricing_visibility));
end $$;

create or replace function public.web_ai_start(p_session_id text,p_ref text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; v_id uuid:=gen_random_uuid(); v_partner text; s public.web_ai_settings%rowtype; v_state jsonb:='{"step":0,"answers":{},"quick_replies":["Restaurant website","School website","E-commerce","ERP","CRM","Business website","Digital marketing"]}'::jsonb;
begin
  if nullif(trim(p_session_id),'') is null then raise exception 'Session is required.' using errcode='invalid_parameter_value'; end if; select * into s from public.web_ai_settings where id='default'; if not coalesce(s.enabled,true) then return jsonb_build_object('status','disabled','config',public.web_ai_config(),'messages','[]'::jsonb); end if; select * into c from public.web_ai_conversations where session_id=trim(p_session_id) and status in ('active','completed','abandoned'); if found then update public.web_ai_sessions set last_seen_at=now(),expires_at=now()+interval '90 days' where session_id=c.session_id; insert into public.web_requirement_completion_analytics(session_id,event,service_slug,completion_percent) select id,'resumed',service_slug,completion_percent from public.web_requirement_sessions where conversation_id=c.id; return public.web_ai_payload(c.id); end if;
  v_partner:=public.web_ai_referral_partner(p_ref); insert into public.web_ai_conversations(id,session_id,referral_code,referral_partner_id,state) values(v_id,trim(p_session_id),nullif(trim(p_ref),''),v_partner,v_state); insert into public.web_ai_sessions(session_id,conversation_id) values(trim(p_session_id),v_id); insert into public.web_requirement_sessions(session_id,conversation_id) values(trim(p_session_id),v_id); insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(v_id,'assistant',s.welcome_message,'welcome',jsonb_build_object('quick_replies',v_state->'quick_replies')); insert into public.web_requirement_replay(session_id,sequence_no,actor,content) select id,1,'assistant',s.welcome_message from public.web_requirement_sessions where conversation_id=v_id; insert into public.web_requirement_completion_analytics(session_id,event) select id,'started' from public.web_requirement_sessions where conversation_id=v_id; return public.web_ai_payload(v_id);
end $$;

create or replace function public.web_ai_message(p_session_id text,p_message text,p_client_event_id text default null,p_honeypot text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; s public.web_ai_settings%rowtype; rs public.web_requirement_sessions%rowtype; q jsonb; next_q jsonb; v_message text; v_answers jsonb; v_service text; v_estimate jsonb; v_summary jsonb; v_step integer; v_lead_id uuid; v_assistant text; v_event integer; v_score integer:=0;
begin
  if nullif(trim(p_honeypot),'') is not null then raise exception 'Unable to process this request.' using errcode='invalid_parameter_value'; end if; v_message:=left(regexp_replace(trim(coalesce(p_message,'')),'<[^>]*>','','g'),500); if v_message='' then raise exception 'Message is required.' using errcode='invalid_parameter_value'; end if;
  select * into c from public.web_ai_conversations where session_id=trim(p_session_id) for update; if not found then raise exception 'Conversation not found.' using errcode='no_data_found'; end if; if c.status<>'active' then return public.web_ai_payload(c.id); end if; select * into s from public.web_ai_settings where id='default'; if (select turn_count from public.web_ai_sessions where session_id=c.session_id)>=s.max_conversation_length then update public.web_ai_conversations set status='rate_limited',last_activity_at=now() where id=c.id; return public.web_ai_payload(c.id); end if; if p_client_event_id is not null and exists(select 1 from public.web_ai_messages where conversation_id=c.id and client_event_id=p_client_event_id) then return public.web_ai_payload(c.id); end if;
  select * into rs from public.web_requirement_sessions where conversation_id=c.id for update; v_answers:=coalesce(c.state->'answers','{}'::jsonb); v_step:=coalesce((c.state->>'step')::integer,0); v_service:=c.service_key; q:=case when c.state ? 'current_question_id' then (select jsonb_build_object('id',x.id,'slug',x.slug,'key',x.question_key,'label',x.prompt,'type',x.question_type,'quick_replies',x.choices) from public.web_requirement_questions x where x.id=(c.state->>'current_question_id')::uuid) else null end;
  insert into public.web_ai_messages(conversation_id,client_event_id,role,content,message_type) values(c.id,p_client_event_id,'user',v_message,'text'); update public.web_ai_sessions set turn_count=turn_count+1,last_seen_at=now(),expires_at=now()+interval '90 days' where session_id=c.session_id; v_event:=coalesce((select max(sequence_no)+1 from public.web_requirement_replay where session_id=rs.id),1); insert into public.web_requirement_replay(session_id,sequence_no,actor,content,question_slug) values(rs.id,v_event,'customer',v_message,q->>'slug');
  if v_service is null then v_service:=public.web_requirement_detect_service(v_message); if v_service is null then v_assistant:='I can help with websites, business systems, marketing, automation, hosting, AMC, training, or consultation. What are you looking to build?'; next_q:=null; else v_answers:=v_answers||jsonb_build_object('service',v_service); v_assistant:=format('Great — I''ll help you plan a %s.',coalesce((select name from public.services where slug=v_service),initcap(replace(v_service,'-',' ')))); end if;
  else
    if q is not null then v_answers:=v_answers||jsonb_build_object(q->>'key',v_message); insert into public.web_requirement_answers(session_id,question_id,answer_text,answer_value) values(rs.id,(q->>'id')::uuid,v_message,case when q->>'type'='multi_choice' then jsonb_build_object('value',string_to_array(v_message,',')) else jsonb_build_object('value',v_message) end) on conflict(session_id,question_id) do update set answer_text=excluded.answer_text,answer_value=excluded.answer_value,updated_at=now(); end if;
  end if;
  if v_service is not null then v_estimate:=public.knowledge_estimate(v_service,v_answers); next_q:=coalesce(next_q,public.web_requirement_next_question(v_service,v_answers)); v_summary:=public.web_requirement_summary(v_service,v_answers,v_estimate,v_step+1); v_lead_id:=public.web_requirement_upsert_lead(c.id,v_service,v_answers,v_estimate,c.crm_lead_id); if next_q is null then v_score:=least(100,20+(select count(*) from jsonb_object_keys(v_answers))*5); update public.web_ai_conversations set status='completed',service_key=v_service,state=jsonb_build_object('step',v_step+1,'answers',v_answers),estimate=v_estimate,lead_score=v_score,lead_temperature=case when v_score>=75 then 'Hot' when v_score>=45 then 'Warm' else 'Cold' end,crm_lead_id=v_lead_id,completed_at=now(),last_activity_at=now() where id=c.id; update public.web_requirement_sessions set status='completed',service_slug=v_service,completion_percent=100,estimated_revenue=nullif(v_estimate->>'estimated_cost','')::numeric,requirement_summary=v_summary,last_activity_at=now(),completed_at=now() where id=rs.id; insert into public.web_requirement_completion_analytics(session_id,event,service_slug,completion_percent,estimated_revenue,metadata) values(rs.id,'completed',v_service,100,nullif(v_estimate->>'estimated_cost','')::numeric,jsonb_build_object('crm_lead_id',v_lead_id)); v_assistant:=format('Thank you. I have captured your %s requirements and created a live draft for the AllBee team. I''ll share the estimate and next steps now.',coalesce((select name from public.services where slug=v_service),v_service)); else v_step:=v_step+1; update public.web_ai_conversations set service_key=v_service,state=jsonb_build_object('step',v_step,'answers',v_answers,'current_question_id',next_q->>'id','current_question_slug',next_q->>'slug'),estimate=v_estimate,crm_lead_id=v_lead_id,last_activity_at=now() where id=c.id; update public.web_requirement_sessions set service_slug=v_service,last_question_slug=next_q->>'slug',completion_percent=(v_summary->>'progress')::integer,estimated_revenue=nullif(v_estimate->>'estimated_cost','')::numeric,requirement_summary=v_summary,last_activity_at=now() where id=rs.id; insert into public.web_requirement_completion_analytics(session_id,event,service_slug,question_slug,completion_percent,estimated_revenue) values(rs.id,'question_answered',v_service,next_q->>'slug',(v_summary->>'progress')::integer,nullif(v_estimate->>'estimated_cost','')::numeric); v_assistant:=next_q->>'label'; end if;
  else update public.web_ai_conversations set state=jsonb_build_object('step',0,'answers',v_answers),last_activity_at=now() where id=c.id; end if;
  if (select status from public.web_ai_conversations where id=c.id)='active' then insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(c.id,'assistant',v_assistant,'question',jsonb_build_object('quick_replies',coalesce(next_q->'quick_replies','[]'::jsonb),'summary',v_summary)); v_event:=v_event+1; insert into public.web_requirement_replay(session_id,sequence_no,actor,content,question_slug,metadata) values(rs.id,v_event,'assistant',v_assistant,next_q->>'slug',jsonb_build_object('summary',v_summary)); else insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(c.id,'assistant',v_assistant,'estimate',jsonb_build_object('estimate',v_estimate,'summary',v_summary)); end if; return public.web_ai_payload(c.id);
end $$;

create or replace function public.web_ai_abandon(p_session_id text) returns jsonb language plpgsql security definer set search_path=public as $$ declare c public.web_ai_conversations%rowtype; begin select * into c from public.web_ai_conversations where session_id=trim(p_session_id) for update; if found and c.status='active' then update public.web_ai_conversations set status='abandoned',abandoned_at=now(),last_activity_at=now() where id=c.id; update public.web_requirement_sessions set status='abandoned',abandoned_at=now(),last_activity_at=now(),dropoff_question_slug=(select state->>'current_question_slug' from public.web_ai_conversations where id=c.id) where conversation_id=c.id; insert into public.web_requirement_completion_analytics(session_id,event,service_slug,completion_percent) select id,'abandoned',service_slug,completion_percent from public.web_requirement_sessions where conversation_id=c.id; end if; return coalesce(public.web_ai_payload(c.id),'{}'::jsonb); end $$;

create or replace function public.web_requirement_save_draft(p_session_id text,p_draft jsonb) returns jsonb language plpgsql security definer set search_path=public as $$ declare rs public.web_requirement_sessions%rowtype; token text:=replace(gen_random_uuid()::text,'-',''); begin select * into rs from public.web_requirement_sessions where session_id=trim(p_session_id) for update; if not found then raise exception 'Requirement session not found.' using errcode='no_data_found'; end if; insert into public.web_requirement_drafts(session_id,resume_token,draft) values(rs.id,token,coalesce(p_draft,'{}'::jsonb)) on conflict(session_id) do update set draft=excluded.draft,last_saved_at=now(),expires_at=now()+interval '90 days',resume_token=public.web_requirement_drafts.resume_token returning jsonb_build_object('resume_token',resume_token,'saved_at',last_saved_at) into p_draft; insert into public.web_requirement_completion_analytics(session_id,event,service_slug,completion_percent,estimated_revenue) values(rs.id,'saved_draft',rs.service_slug,rs.completion_percent,rs.estimated_revenue); return p_draft; end $$;

create or replace function public.web_requirement_admin_summary() returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('sessions',(select count(*) from public.web_requirement_sessions),'active',(select count(*) from public.web_requirement_sessions where status='active'),'completed',(select count(*) from public.web_requirement_sessions where status='completed'),'abandoned',(select count(*) from public.web_requirement_sessions where status='abandoned'),'average_completion',(select coalesce(round(avg(completion_percent),2),0) from public.web_requirement_sessions),'estimated_revenue',(select coalesce(sum(estimated_revenue),0) from public.web_requirement_sessions where status='completed'),'popular_services',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb) from (select service_slug,count(*) sessions from public.web_requirement_sessions where service_slug is not null group by service_slug) x),'dropoffs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.drops desc),'[]'::jsonb) from (select dropoff_question_slug,count(*) drops from public.web_requirement_sessions where dropoff_question_slug is not null group by dropoff_question_slug) x)) where public.is_admin(); $$;

create or replace function public.web_requirement_admin_list(p_entity text,p_search text default '',p_page integer default 1,p_page_size integer default 25) returns jsonb language plpgsql security definer set search_path=public as $$ declare items jsonb; total integer; off integer:=greatest(0,(coalesce(p_page,1)-1)*least(greatest(coalesce(p_page_size,25),1),100)); lim integer:=least(greatest(coalesce(p_page_size,25),1),100); q text:='%'||lower(coalesce(p_search,''))||'%'; begin if not public.is_admin() then raise exception 'Requirement builder access denied.' using errcode='insufficient_privilege'; end if; if p_entity='questions' then select count(*) into total from public.web_requirement_questions where lower(slug||' '||prompt) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (select id,slug,question_key,prompt,question_type,choices,required,active,sort_order from public.web_requirement_questions where lower(slug||' '||prompt) like q order by sort_order,slug offset off limit lim) x; elsif p_entity='rules' then select count(*) into total from public.web_requirement_question_rules r where lower(r.condition_key||' '||r.condition_value) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (select r.*,question_row.slug question_slug,question_row.prompt from public.web_requirement_question_rules r join public.web_requirement_questions question_row on question_row.id=r.question_id where lower(r.condition_key||' '||r.condition_value||' '||question_row.slug) like q order by r.priority,question_row.slug offset off limit lim) x; elsif p_entity='analytics' then select count(*) into total from public.web_requirement_completion_analytics where lower(event||' '||coalesce(service_slug,'')||' '||coalesce(question_slug,'')) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (select * from public.web_requirement_completion_analytics where lower(event||' '||coalesce(service_slug,'')||' '||coalesce(question_slug,'')) like q order by created_at desc offset off limit lim) x; else raise exception 'Unknown requirement entity.' using errcode='invalid_parameter_value'; end if; return jsonb_build_object('items',coalesce(items,'[]'::jsonb),'total',coalesce(total,0),'page',coalesce(p_page,1),'page_size',lim); end $$;

create or replace function public.web_requirement_admin_save(p_entity text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$ declare q public.web_requirement_questions%rowtype; r public.web_requirement_question_rules%rowtype; result jsonb; begin if not public.is_admin() then raise exception 'Requirement builder access denied.' using errcode='insufficient_privilege'; end if; if p_entity='questions' then insert into public.web_requirement_questions(id,slug,question_key,prompt,question_type,choices,help_text,required,active,sort_order,archived_at) values(coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()),coalesce(p_payload->>'slug',lower(regexp_replace(p_payload->>'prompt','[^a-z0-9]+','-','g'))),coalesce(p_payload->>'question_key',p_payload->>'slug'),coalesce(p_payload->>'prompt',''),coalesce(p_payload->>'question_type','text'),coalesce(p_payload->'choices','[]'::jsonb),coalesce(p_payload->>'help_text',''),coalesce((p_payload->>'required')::boolean,false),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'sort_order')::integer,0),case when coalesce((p_payload->>'active')::boolean,true) then null else now() end) on conflict(slug) do update set question_key=excluded.question_key,prompt=excluded.prompt,question_type=excluded.question_type,choices=excluded.choices,help_text=excluded.help_text,required=excluded.required,active=excluded.active,sort_order=excluded.sort_order,archived_at=excluded.archived_at,updated_at=now() returning * into q; result:=to_jsonb(q); elsif p_entity='rules' then insert into public.web_requirement_question_rules(id,question_id,condition_key,operator,condition_value,action,priority,active) values(coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()),(p_payload->>'question_id')::uuid,p_payload->>'condition_key',coalesce(p_payload->>'operator','equals'),coalesce(p_payload->>'condition_value',''),coalesce(p_payload->>'action','show'),coalesce((p_payload->>'priority')::integer,0),coalesce((p_payload->>'active')::boolean,true)) on conflict(question_id,condition_key,operator,condition_value) do update set action=excluded.action,priority=excluded.priority,active=excluded.active returning * into r; result:=to_jsonb(r); else raise exception 'Unknown requirement entity.' using errcode='invalid_parameter_value'; end if; perform public.knowledge_log_change('requirement_'||p_entity,coalesce(p_payload->>'id',result->>'id'),'updated',null,result,coalesce(p_payload->>'reason','Requirement builder update'),'approved'); return result; end $$;

create or replace view public.web_requirement_funnel as
select event,count(*)::integer as event_count,min(created_at) as first_seen,max(created_at) as last_seen from public.web_requirement_completion_analytics group by event;
create or replace view public.web_requirement_service_summary as
select service_slug,count(*)::integer as sessions,count(*) filter(where status='completed')::integer as completed,count(*) filter(where status='abandoned')::integer as abandoned,coalesce(round(avg(completion_percent),2),0) as average_completion,coalesce(sum(estimated_revenue) filter(where status='completed'),0) as estimated_revenue from public.web_requirement_sessions where service_slug is not null group by service_slug;
create or replace view public.web_requirement_question_dropoff as
select dropoff_question_slug,count(*)::integer as dropoff_count from public.web_requirement_sessions where dropoff_question_slug is not null group by dropoff_question_slug;

alter table public.web_requirement_sessions enable row level security; alter table public.web_requirement_questions enable row level security; alter table public.web_requirement_question_flow enable row level security; alter table public.web_requirement_question_rules enable row level security; alter table public.web_requirement_answers enable row level security; alter table public.web_requirement_replay enable row level security; alter table public.web_requirement_snapshots enable row level security; alter table public.web_requirement_drafts enable row level security; alter table public.web_requirement_completion_analytics enable row level security;
do $$ declare t text; begin foreach t in array array['web_requirement_sessions','web_requirement_questions','web_requirement_question_flow','web_requirement_question_rules','web_requirement_answers','web_requirement_replay','web_requirement_snapshots','web_requirement_drafts','web_requirement_completion_analytics'] loop execute format('drop policy if exists requirement_admin_read_%s on public.%I',t,t); execute format('create policy requirement_admin_read_%s on public.%I for select to authenticated using (public.is_admin())',t,t); end loop; end $$;
grant execute on function public.web_requirement_detect_service(text),public.web_requirement_next_question(text,jsonb),public.web_requirement_summary(text,jsonb,jsonb,integer),public.web_requirement_save_draft(text,jsonb) to anon,authenticated;
grant execute on function public.web_requirement_admin_summary(),public.web_requirement_admin_list(text,text,integer,integer),public.web_requirement_admin_save(text,jsonb) to authenticated;
do $$ declare t text; begin foreach t in array array['web_requirement_sessions','web_requirement_questions','web_requirement_question_flow','web_requirement_question_rules','web_requirement_answers','web_requirement_replay','web_requirement_snapshots','web_requirement_drafts','web_requirement_completion_analytics'] loop begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; end; end loop; end $$;

commit;

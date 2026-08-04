-- ALLBEE PR-WEB-1 — Deterministic AI Sales Consultant
-- Public, provider-neutral sales consultation infrastructure. The browser
-- only calls the guarded RPCs below; no LLM or external AI provider is used.

begin;

alter table if exists public.crm_leads add column if not exists website_referral_code text;
alter table if exists public.crm_leads add column if not exists website_referral_partner_id text;
create index if not exists crm_leads_website_referral_idx on public.crm_leads(website_referral_partner_id, created_at desc);

create table if not exists public.web_ai_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  welcome_message text not null default 'Hello 👋\n\nI''m the AllBee AI Sales Consultant.\n\nI''ll help you understand pricing, recommend the best solution, and prepare an estimated quotation.\n\nWhat would you like to build today?',
  business_hours text not null default 'Monday–Saturday, 9:00 AM–6:00 PM IST',
  fallback_contact text not null default '',
  max_conversation_length integer not null default 18,
  pricing_visibility boolean not null default true,
  pricing_rules jsonb not null default '{"website":{"base":15000,"label":"Website (starter)","options":{"ecommerce":12000,"seo":5000,"extra":4000,"maintenance":6000}},"marketing":{"base":8000,"label":"Digital marketing (monthly)","options":{"ads":5000,"content":4000,"social":3000}},"course":{"base":5000,"label":"Course admission","options":{"advanced":3000,"certification":1500}}}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint web_ai_max_length_check check (max_conversation_length between 6 and 40)
);

create table if not exists public.web_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  status text not null default 'active',
  source text not null default 'Website',
  referral_code text,
  referral_partner_id text,
  service_key text,
  state jsonb not null default '{}'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  lead_score integer not null default 0,
  lead_temperature text not null default 'Cold',
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint web_ai_conversation_status_check check (status in ('active','completed','abandoned','rate_limited','disabled')),
  constraint web_ai_temperature_check check (lead_temperature in ('Hot','Warm','Cold')),
  constraint web_ai_score_check check (lead_score between 0 and 100)
);

create table if not exists public.web_ai_sessions (
  session_id text primary key,
  conversation_id uuid not null unique references public.web_ai_conversations(id) on delete cascade,
  resume_token_hash text,
  turn_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  constraint web_ai_turn_count_check check (turn_count >= 0)
);

create table if not exists public.web_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.web_ai_conversations(id) on delete cascade,
  client_event_id text,
  role text not null,
  content text not null,
  message_type text not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint web_ai_message_role_check check (role in ('system','user','assistant')),
  constraint web_ai_message_type_check check (message_type in ('text','welcome','question','quick_reply','estimate','error')),
  unique (conversation_id, client_event_id)
);

create table if not exists public.web_ai_analytics (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.web_ai_conversations(id) on delete set null,
  event text not null,
  service_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.web_ai_suggestions_cache (
  cache_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_ai_conversations_status_idx on public.web_ai_conversations(status, last_activity_at desc);
create index if not exists web_ai_conversations_referral_idx on public.web_ai_conversations(referral_partner_id, created_at desc);
create index if not exists web_ai_messages_conversation_idx on public.web_ai_messages(conversation_id, created_at);
create index if not exists web_ai_analytics_event_idx on public.web_ai_analytics(event, created_at desc);
create index if not exists web_ai_analytics_service_idx on public.web_ai_analytics(service_key, created_at desc);
create index if not exists web_ai_sessions_expiry_idx on public.web_ai_sessions(expires_at);
create index if not exists web_ai_cache_expiry_idx on public.web_ai_suggestions_cache(expires_at);

insert into public.web_ai_settings(id) values ('default') on conflict(id) do nothing;

create or replace function public.web_ai_service_key(p_text text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_text,'')) ~ '(restaurant|cafe|hotel|food|dining)' then 'restaurant'
    when lower(coalesce(p_text,'')) ~ '(school|college|education|institute|student)' then 'school'
    when lower(coalesce(p_text,'')) ~ '(hospital|clinic|healthcare|medical)' then 'hospital'
    when lower(coalesce(p_text,'')) ~ '(e[ -]?commerce|online store|shop|shopping|catalog)' then 'ecommerce'
    when lower(coalesce(p_text,'')) ~ '(erp|inventory|pos|hrms|attendance|billing|accounting)' then 'erp'
    when lower(coalesce(p_text,'')) ~ '(crm|sales pipeline|customer management)' then 'crm'
    when lower(coalesce(p_text,'')) ~ '(digital marketing|social media|ads|marketing)' then 'marketing'
    when lower(coalesce(p_text,'')) ~ '(seo|search engine)' then 'seo'
    when lower(coalesce(p_text,'')) ~ '(portfolio|personal website)' then 'portfolio'
    when lower(coalesce(p_text,'')) ~ '(business website|corporate website|company website|website)' then 'business_website'
    when lower(coalesce(p_text,'')) ~ '(automation|ai solution|artificial intelligence)' then 'automation'
    when lower(coalesce(p_text,'')) ~ '(hosting|domain|maintenance|amc)' then 'maintenance'
    when lower(coalesce(p_text,'')) ~ '(training|course|learn)' then 'course'
    else null
  end;
$$;

create or replace function public.web_ai_service_label(p_key text)
returns text language sql immutable as $$
  select case p_key
    when 'restaurant' then 'Restaurant website'
    when 'school' then 'School website'
    when 'hospital' then 'Hospital website'
    when 'ecommerce' then 'E-commerce'
    when 'erp' then 'Custom ERP'
    when 'crm' then 'CRM'
    when 'marketing' then 'Digital marketing'
    when 'seo' then 'SEO'
    when 'portfolio' then 'Portfolio website'
    when 'business_website' then 'Business website'
    when 'automation' then 'AI and automation'
    when 'maintenance' then 'Hosting / AMC / maintenance'
    when 'course' then 'Training'
    else 'Custom solution'
  end;
$$;

create or replace function public.web_ai_question(p_service text, p_index integer)
returns jsonb language plpgsql immutable as $$
declare questions jsonb;
begin
  if p_service='restaurant' then
    questions:=jsonb_build_array(
      jsonb_build_object('key','business_name','label','What is your restaurant or business name?','type','text'),
      jsonb_build_object('key','branches','label','How many branches do you have?','type','quick','quick_replies',jsonb_build_array('1','2–5','6+')),
      jsonb_build_object('key','features','label','Which features matter most? You can choose several or describe them.','type','quick','quick_replies',jsonb_build_array('Online ordering','Table booking','WhatsApp ordering','Menu management','Admin panel')),
      jsonb_build_object('key','languages','label','Do you need multiple languages?','type','quick','quick_replies',jsonb_build_array('English only','English + Tamil','More languages')),
      jsonb_build_object('key','timeline','label','When would you like to launch?','type','quick','quick_replies',jsonb_build_array('This month','1–3 months','3–6 months','Just exploring')),
      jsonb_build_object('key','budget','label','What budget range should we plan around?','type','quick','quick_replies',jsonb_build_array('Below ₹15,000','₹15,000–₹50,000','₹50,000–₹1,00,000','Above ₹1,00,000','Not sure')),
      jsonb_build_object('key','contact_name','label','What is your name?','type','text'),
      jsonb_build_object('key','phone','label','What phone or WhatsApp number should our team use?','type','text'),
      jsonb_build_object('key','email','label','What email address should receive the estimate?','type','email')
    );
  elsif p_service='school' then
    questions:=jsonb_build_array(
      jsonb_build_object('key','business_name','label','What is your school, college, or institute name?','type','text'),
      jsonb_build_object('key','branches','label','How many branches or campuses do you have?','type','quick','quick_replies',jsonb_build_array('1','2–5','6+')),
      jsonb_build_object('key','features','label','Which modules do you need?','type','quick','quick_replies',jsonb_build_array('Admissions','Attendance','Fees and billing','Parent portal','Online classes')),
      jsonb_build_object('key','users','label','Approximately how many students or staff will use it?','type','quick','quick_replies',jsonb_build_array('Below 100','100–500','500–2,000','2,000+')),
      jsonb_build_object('key','timeline','label','When would you like to launch?','type','quick','quick_replies',jsonb_build_array('This month','1–3 months','3–6 months','Just exploring')),
      jsonb_build_object('key','budget','label','What budget range should we plan around?','type','quick','quick_replies',jsonb_build_array('Below ₹15,000','₹15,000–₹50,000','₹50,000–₹1,00,000','Above ₹1,00,000','Not sure')),
      jsonb_build_object('key','contact_name','label','What is your name?','type','text'),jsonb_build_object('key','phone','label','What phone or WhatsApp number should our team use?','type','text'),jsonb_build_object('key','email','label','What email address should receive the estimate?','type','email')
    );
  elsif p_service='ecommerce' then
    questions:=jsonb_build_array(
      jsonb_build_object('key','business_name','label','What is the store or brand name?','type','text'),
      jsonb_build_object('key','catalog_size','label','How large is your product catalog?','type','quick','quick_replies',jsonb_build_array('Below 50 products','50–500','500+','Not sure')),
      jsonb_build_object('key','features','label','Which commerce features do you need?','type','quick','quick_replies',jsonb_build_array('Payment gateway','Shipping integration','WhatsApp ordering','Offers and coupons','Admin panel')),
      jsonb_build_object('key','languages','label','Do you need multiple languages?','type','quick','quick_replies',jsonb_build_array('English only','English + Tamil','More languages')),
      jsonb_build_object('key','timeline','label','When would you like to launch?','type','quick','quick_replies',jsonb_build_array('This month','1–3 months','3–6 months','Just exploring')),
      jsonb_build_object('key','budget','label','What budget range should we plan around?','type','quick','quick_replies',jsonb_build_array('Below ₹15,000','₹15,000–₹50,000','₹50,000–₹1,00,000','Above ₹1,00,000','Not sure')),
      jsonb_build_object('key','contact_name','label','What is your name?','type','text'),jsonb_build_object('key','phone','label','What phone or WhatsApp number should our team use?','type','text'),jsonb_build_object('key','email','label','What email address should receive the estimate?','type','email')
    );
  elsif p_service in ('erp','crm') then
    questions:=jsonb_build_array(
      jsonb_build_object('key','business_name','label','What is the business or company name?','type','text'),
      jsonb_build_object('key','modules','label','Which modules are most important?','type','quick','quick_replies',case when p_service='erp' then jsonb_build_array('Inventory','POS and billing','HRMS and attendance','Accounting','Custom modules') else jsonb_build_array('Lead management','Follow-ups','Quotations','Reports','Customer support') end),
      jsonb_build_object('key','users','label','How many people will use the system?','type','quick','quick_replies',jsonb_build_array('1–10','11–50','51–200','200+')),
      jsonb_build_object('key','integrations','label','Do you need integrations with existing tools?','type','text'),
      jsonb_build_object('key','timeline','label','When would you like to launch?','type','quick','quick_replies',jsonb_build_array('This month','1–3 months','3–6 months','Just exploring')),
      jsonb_build_object('key','budget','label','What budget range should we plan around?','type','quick','quick_replies',jsonb_build_array('Below ₹50,000','₹50,000–₹1,00,000','₹1,00,000–₹5,00,000','Above ₹5,00,000','Not sure')),
      jsonb_build_object('key','contact_name','label','What is your name?','type','text'),jsonb_build_object('key','phone','label','What phone or WhatsApp number should our team use?','type','text'),jsonb_build_object('key','email','label','What email address should receive the estimate?','type','email')
    );
  else
    questions:=jsonb_build_array(
      jsonb_build_object('key','business_name','label','What is your business or project name?','type','text'),
      jsonb_build_object('key','features','label','What should the solution help you do?','type','text'),
      jsonb_build_object('key','timeline','label','When would you like to launch?','type','quick','quick_replies',jsonb_build_array('This month','1–3 months','3–6 months','Just exploring')),
      jsonb_build_object('key','budget','label','What budget range should we plan around?','type','quick','quick_replies',jsonb_build_array('Below ₹15,000','₹15,000–₹50,000','₹50,000–₹1,00,000','Above ₹1,00,000','Not sure')),
      jsonb_build_object('key','contact_name','label','What is your name?','type','text'),jsonb_build_object('key','phone','label','What phone or WhatsApp number should our team use?','type','text'),jsonb_build_object('key','email','label','What email address should receive the estimate?','type','email')
    );
  end if;
  if p_index < 0 or p_index >= jsonb_array_length(questions) then return null; end if;
  return questions->p_index;
end $$;

create or replace function public.web_ai_score(p_answers jsonb, p_turns integer)
returns integer language sql immutable as $$
  select least(100,greatest(0,35
    + case when lower(coalesce(p_answers->>'budget','')) ~ '(50|75|100|1,00|5,00|above)' then 25 when lower(coalesce(p_answers->>'budget','')) ~ '(15|30)' then 15 else 5 end
    + case when lower(coalesce(p_answers->>'timeline','')) ~ '(this month|immediately|urgent)' then 25 when lower(coalesce(p_answers->>'timeline','')) ~ '(1–3|1-3)' then 20 when lower(coalesce(p_answers->>'timeline','')) ~ '(3–6|3-6)' then 12 else 5 end
    + case when (select count(*) from jsonb_object_keys(coalesce(p_answers,'{}'::jsonb))) >= 5 then 10 else 4 end
    + least(5,greatest(0,coalesce(p_turns,0)))
  ));
$$;

create or replace function public.web_ai_temperature(p_score integer)
returns text language sql immutable as $$ select case when p_score>=70 then 'Hot' when p_score>=45 then 'Warm' else 'Cold' end; $$;

create or replace function public.web_ai_estimate(p_service text, p_answers jsonb, p_pricing jsonb)
returns jsonb language plpgsql immutable as $$
declare v_base numeric; v_total numeric; v_label text; v_addons jsonb:='[]'::jsonb; f text:=lower(coalesce(p_answers->>'features','')||' '||coalesce(p_answers->>'modules',''));
begin
  if p_pricing is null or p_pricing='{}'::jsonb then
    return jsonb_build_object('known',false,'estimated_cost',null,'currency','INR','package','Custom technical consultation','delivery_time','Confirmed after technical discussion','included_features',jsonb_build_array('Requirement discovery','Technical proposal'),'optional_addons',jsonb_build_array(),'hosting','Confirmed in final quotation','amc','Available after technical discussion','taxes','Applicable taxes confirmed in final quotation','payment_terms','Confirmed in final quotation','disclaimer','This is an estimated quotation. Final pricing will be confirmed after technical discussion.');
  end if;
  if p_service in ('restaurant','school','hospital','portfolio','business_website','ecommerce') then v_base:=coalesce((p_pricing->'website'->>'base')::numeric,15000); v_label:=coalesce(p_pricing->'website'->>'label','Website (starter)');
  elsif p_service='marketing' then v_base:=coalesce((p_pricing->'marketing'->>'base')::numeric,8000); v_label:=coalesce(p_pricing->'marketing'->>'label','Digital marketing (monthly)');
  elsif p_service='course' then v_base:=coalesce((p_pricing->'course'->>'base')::numeric,5000); v_label:=coalesce(p_pricing->'course'->>'label','Course admission');
  else return jsonb_build_object('known',false,'estimated_cost',null,'currency','INR','package','Custom technical consultation','delivery_time','Confirmed after technical discussion','included_features',jsonb_build_array('Requirement discovery','Technical proposal'),'optional_addons',jsonb_build_array(),'hosting','Confirmed in final quotation','amc','Available after technical discussion','taxes','Applicable taxes confirmed in final quotation','payment_terms','Confirmed in final quotation','disclaimer','This is an estimated quotation. Final pricing will be confirmed after technical discussion.'); end if;
  v_total:=v_base;
  if p_service='ecommerce' then v_total:=v_total+coalesce((p_pricing->'website'->'options'->>'ecommerce')::numeric,12000); v_addons:=v_addons||jsonb_build_array(jsonb_build_object('name','E-commerce store','amount',coalesce((p_pricing->'website'->'options'->>'ecommerce')::numeric,12000))); end if;
  if f ~ '(seo|search)' then v_total:=v_total+coalesce((p_pricing->'website'->'options'->>'seo')::numeric,5000); v_addons:=v_addons||jsonb_build_array(jsonb_build_object('name','SEO setup','amount',coalesce((p_pricing->'website'->'options'->>'seo')::numeric,5000))); end if;
  if f ~ '(maintenance|amc|hosting)' then v_total:=v_total+coalesce((p_pricing->'website'->'options'->>'maintenance')::numeric,6000); v_addons:=v_addons||jsonb_build_array(jsonb_build_object('name','Annual maintenance','amount',coalesce((p_pricing->'website'->'options'->>'maintenance')::numeric,6000))); end if;
  return jsonb_build_object('known',true,'estimated_cost',round(v_total,2),'currency','INR','package',v_label,'delivery_time','Confirmed after technical discussion','included_features',jsonb_build_array(v_label),'optional_addons',v_addons,'hosting','Available; confirm requirement','amc','Available; official annual quote follows','taxes','Applicable taxes confirmed in final quotation','payment_terms','Confirmed in final quotation','disclaimer','This is an estimated quotation. Final pricing will be confirmed after technical discussion.');
end $$;

create or replace function public.web_ai_referral_partner(p_code text)
returns text language sql security definer stable set search_path=public as $$
  select partner_id::text from public.apn_referral_codes where active and upper(code)=upper(trim(coalesce(p_code,''))) order by created_at limit 1;
$$;

create or replace function public.web_ai_config()
returns jsonb language sql security definer stable set search_path=public as $$
  select jsonb_build_object('enabled',enabled,'welcome_message',welcome_message,'business_hours',business_hours,'fallback_contact',fallback_contact,'max_conversation_length',max_conversation_length,'pricing_visibility',pricing_visibility) from public.web_ai_settings where id='default';
$$;

create or replace function public.web_ai_payload(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; s public.web_ai_settings%rowtype; q jsonb;
begin
  select * into c from public.web_ai_conversations where id=p_conversation_id;
  if not found then return '{}'::jsonb; end if;
  select * into s from public.web_ai_settings where id='default';
  q:=public.web_ai_question(c.service_key,coalesce((c.state->>'step')::integer,0)-1);
  return jsonb_build_object('conversationId',c.id,'sessionId',c.session_id,'status',c.status,'state',c.state,'leadScore',c.lead_score,'leadTemperature',c.lead_temperature,'estimate',c.estimate,'referralAttached',c.referral_partner_id is not null,'question',q,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'content',m.content,'message_type',m.message_type,'metadata',m.metadata,'created_at',m.created_at) order by m.created_at) from public.web_ai_messages m where m.conversation_id=c.id),'[]'::jsonb),'config',jsonb_build_object('enabled',s.enabled,'business_hours',s.business_hours,'fallback_contact',s.fallback_contact,'pricing_visibility',s.pricing_visibility));
end $$;

create or replace function public.web_ai_start(p_session_id text, p_ref text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; v_id uuid:=gen_random_uuid(); v_partner text; s public.web_ai_settings%rowtype; v_state jsonb:='{"step":0,"total_questions":0,"answers":{},"quick_replies":["Restaurant website","School website","E-commerce","Custom ERP","CRM","Business website","Digital marketing","Portfolio website"]}'::jsonb;
begin
  if nullif(trim(p_session_id),'') is null then raise exception 'Session is required.' using errcode='invalid_parameter_value'; end if;
  select * into s from public.web_ai_settings where id='default';
  if not coalesce(s.enabled,true) then return jsonb_build_object('status','disabled','config',public.web_ai_config(),'messages','[]'::jsonb); end if;
  select * into c from public.web_ai_conversations where session_id=trim(p_session_id) and status in ('active','completed');
  if found then update public.web_ai_sessions set last_seen_at=now(),expires_at=now()+interval '30 days' where session_id=c.session_id; return public.web_ai_payload(c.id); end if;
  v_partner:=public.web_ai_referral_partner(p_ref);
  insert into public.web_ai_conversations(id,session_id,referral_code,referral_partner_id,state) values(v_id,trim(p_session_id),nullif(trim(p_ref),''),v_partner,v_state);
  insert into public.web_ai_sessions(session_id,conversation_id) values(trim(p_session_id),v_id);
  insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(v_id,'assistant',s.welcome_message,'welcome',jsonb_build_object('quick_replies',v_state->'quick_replies'));
  insert into public.web_ai_analytics(conversation_id,event,service_key,metadata) values(v_id,'started',null,jsonb_build_object('referral_attached',v_partner is not null));
  return public.web_ai_payload(v_id);
end $$;

create or replace function public.web_ai_message(p_session_id text,p_message text,p_client_event_id text default null,p_honeypot text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype; s public.web_ai_settings%rowtype; v_message text; v_step integer; v_q jsonb; v_service text; v_answers jsonb; v_score integer; v_temp text; v_estimate jsonb; v_lead_id uuid; v_partner text; v_name text; v_phone text; v_email text; v_label text; v_assistant text; v_quick jsonb:='[]'::jsonb; v_next jsonb;
begin
  if nullif(trim(p_honeypot),'') is not null then raise exception 'Unable to process this request.' using errcode='invalid_parameter_value'; end if;
  v_message:=left(regexp_replace(trim(coalesce(p_message,'')),'<[^>]*>','','g'),500);
  if v_message='' then raise exception 'Message is required.' using errcode='invalid_parameter_value'; end if;
  select * into c from public.web_ai_conversations where session_id=trim(p_session_id) for update;
  if not found then raise exception 'Conversation not found.' using errcode='no_data_found'; end if;
  if c.status<>'active' then return public.web_ai_payload(c.id); end if;
  select * into s from public.web_ai_settings where id='default';
  if (select turn_count from public.web_ai_sessions where session_id=c.session_id) >= s.max_conversation_length then update public.web_ai_conversations set status='rate_limited',last_activity_at=now() where id=c.id; return public.web_ai_payload(c.id); end if;
  if p_client_event_id is not null and exists(select 1 from public.web_ai_messages where conversation_id=c.id and client_event_id=p_client_event_id) then return public.web_ai_payload(c.id); end if;
  insert into public.web_ai_messages(conversation_id,client_event_id,role,content,message_type) values(c.id,p_client_event_id,'user',v_message,'text');
  update public.web_ai_sessions set turn_count=turn_count+1,last_seen_at=now(),expires_at=now()+interval '30 days' where session_id=c.session_id;
  v_step:=coalesce((c.state->>'step')::integer,0); v_service:=c.service_key; v_answers:=coalesce(c.state->'answers','{}'::jsonb);
  if v_step=0 then
    v_service:=public.web_ai_service_key(v_message);
    if v_service is null then v_assistant:='I can help with websites, e-commerce, ERP, CRM, marketing, SEO, automation, hosting, AMC, and training. Which solution are you exploring?'; v_quick:=c.state->'quick_replies';
    else
      v_q:=public.web_ai_question(v_service,0); v_step:=1; v_assistant:=format('Great — I''ll help you plan a %s. %s',public.web_ai_service_label(v_service),v_q->>'label'); v_quick:=coalesce(v_q->'quick_replies','[]'::jsonb); v_answers:=v_answers||jsonb_build_object('service',v_service);
    end if;
  else
    v_q:=public.web_ai_question(v_service,v_step-1); v_answers:=v_answers||jsonb_build_object(v_q->>'key',v_message);
    if v_q->>'key'='phone' and length(regexp_replace(v_message,'[^0-9]','','g'))<7 then v_assistant:='Please share a valid phone or WhatsApp number so our team can reach you.'; v_step:=v_step; v_q:=v_q; v_quick:='[]'::jsonb;
    elsif v_q->>'key'='email' and v_message !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then v_assistant:='That email does not look complete yet. Please enter a valid email address.'; v_quick:='[]'::jsonb;
    elsif v_q->>'key'='email' then
      v_score:=public.web_ai_score(v_answers,(select turn_count from public.web_ai_sessions where session_id=c.session_id)); v_temp:=public.web_ai_temperature(v_score); v_estimate:=public.web_ai_estimate(v_service,v_answers,case when s.pricing_visibility then s.pricing_rules else '{}'::jsonb end); v_name:=coalesce(v_answers->>'contact_name',v_answers->>'business_name','Website enquiry'); v_phone:=v_answers->>'phone'; v_email:=v_answers->>'email'; v_partner:=c.referral_partner_id; v_label:=public.web_ai_service_label(v_service); v_lead_id:=gen_random_uuid();
      insert into public.crm_leads(id,lead_number,source,assigned_partner_id,company,customer_name,mobile,email,business_type,project_category,expected_budget,priority,lead_score,status,remarks,tags,created_by,website_referral_code,website_referral_partner_id)
      values(v_lead_id,'CRM-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,6,'0'),'Website',v_partner,v_answers->>'business_name',v_name,v_phone,v_email,v_service,v_label,case when (v_estimate->>'estimated_cost') is null or v_estimate->>'estimated_cost'='null' then 0 else (v_estimate->>'estimated_cost')::numeric end,case when v_temp='Hot' then 'High' when v_temp='Warm' then 'Medium' else 'Low' end,v_score,'New',left(jsonb_build_object('conversation',c.id,'answers',v_answers,'estimate',v_estimate)::text,4000),array['web-ai',v_service]||case when v_partner is not null then array['apn-referral'] else array[]::text[] end,null,c.referral_code,v_partner);
      perform public.crm_log_event('web_ai_lead_captured','AI sales lead captured',format('%s requested %s through the website consultant.',v_name,v_label),v_lead_id,null,null,jsonb_build_object('conversation_id',c.id,'lead_score',v_score,'temperature',v_temp,'estimate',v_estimate,'referral_partner_id',v_partner));
      perform public.crm_notify('New AI sales lead',format('%s requested %s. Estimated value: %s. Lead score: %s/100.',v_name,v_label,coalesce(to_char((v_estimate->>'estimated_cost')::numeric,'FM999G999G990D00'),'Custom'),v_score),'Important',v_lead_id);
      update public.web_ai_conversations set status='completed',service_key=v_service,state=jsonb_build_object('step',v_step+1,'total_questions',v_step,'answers',v_answers),estimate=v_estimate,lead_score=v_score,lead_temperature=v_temp,crm_lead_id=v_lead_id,completed_at=now(),last_activity_at=now() where id=c.id;
      insert into public.web_ai_analytics(conversation_id,event,service_key,metadata) values(c.id,'completed',v_service,jsonb_build_object('lead_score',v_score,'temperature',v_temp,'estimated_cost',v_estimate->>'estimated_cost','crm_lead_id',v_lead_id,'referral_attached',v_partner is not null));
      v_assistant:=format('Thank you, %s. I''ve prepared an estimate for your %s and sent your requirements to the AllBee team.',v_name,v_label); v_quick:=jsonb_build_array('Download estimate','Send by WhatsApp','Send by email','Save draft');
    else
      v_step:=v_step+1; v_next:=public.web_ai_question(v_service,v_step-1); v_assistant:=coalesce(v_next->>'label','Thanks — I have what I need.'); v_quick:=coalesce(v_next->'quick_replies','[]'::jsonb);
    end if;
  end if;
  if c.status='active' then
    update public.web_ai_conversations set service_key=v_service,state=jsonb_build_object('step',v_step,'total_questions',10,'answers',v_answers,'quick_replies',v_quick),last_activity_at=now() where id=c.id;
    insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(c.id,'assistant',v_assistant,case when v_step=0 then 'question' else 'question' end,jsonb_build_object('quick_replies',v_quick));
    insert into public.web_ai_analytics(conversation_id,event,service_key,metadata) values(c.id,'message',v_service,jsonb_build_object('step',v_step));
  else
    insert into public.web_ai_messages(conversation_id,role,content,message_type,metadata) values(c.id,'assistant',v_assistant,'estimate',jsonb_build_object('quick_replies',v_quick,'estimate',v_estimate));
  end if;
  return public.web_ai_payload(c.id);
end $$;

create or replace function public.web_ai_abandon(p_session_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.web_ai_conversations%rowtype;
begin
  select * into c from public.web_ai_conversations where session_id=trim(p_session_id) for update;
  if found and c.status='active' then update public.web_ai_conversations set status='abandoned',abandoned_at=now(),last_activity_at=now() where id=c.id; insert into public.web_ai_analytics(conversation_id,event,service_key) values(c.id,'abandoned',c.service_key); end if;
  return coalesce(public.web_ai_payload(c.id),'{}'::jsonb);
end $$;

create or replace function public.web_ai_admin_summary()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Website AI analytics access denied.' using errcode='insufficient_privilege'; end if;
  return jsonb_build_object('funnel',coalesce((select jsonb_agg(to_jsonb(x) order by x.event) from public.web_ai_funnel x),'[]'::jsonb),'popular_services',coalesce((select jsonb_agg(to_jsonb(x) order by x.conversations desc) from public.web_ai_popular_services x),'[]'::jsonb),'conversion',coalesce((select to_jsonb(x) from public.web_ai_conversion_summary x limit 1),'{}'::jsonb));
end $$;

create or replace function public.web_ai_save_settings(p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Website AI settings access denied.' using errcode='insufficient_privilege'; end if;
  update public.web_ai_settings set enabled=coalesce((p_patch->>'enabled')::boolean,enabled),welcome_message=coalesce(nullif(p_patch->>'welcome_message',''),welcome_message),business_hours=coalesce(nullif(p_patch->>'business_hours',''),business_hours),fallback_contact=coalesce(p_patch->>'fallback_contact',fallback_contact),max_conversation_length=coalesce(nullif(p_patch->>'max_conversation_length','')::integer,max_conversation_length),pricing_visibility=coalesce((p_patch->>'pricing_visibility')::boolean,pricing_visibility),updated_by=auth.uid()::text,updated_at=now() where id='default' returning jsonb_build_object('enabled',enabled,'welcome_message',welcome_message,'business_hours',business_hours,'fallback_contact',fallback_contact,'max_conversation_length',max_conversation_length,'pricing_visibility',pricing_visibility,'pricing_rules',pricing_rules) into result;
  return result;
end $$;

create or replace view public.web_ai_funnel as
select event,count(*)::integer as event_count,min(created_at) first_seen,max(created_at) last_seen from public.web_ai_analytics group by event;

create or replace view public.web_ai_popular_services as
select c.service_key,public.web_ai_service_label(c.service_key) service_label,count(*)::integer conversations,count(*) filter(where c.status='completed')::integer completed,coalesce(round(avg(c.lead_score),2),0) average_score from public.web_ai_conversations c where c.service_key is not null group by c.service_key;

create or replace view public.web_ai_conversion_summary as
select count(*)::integer conversations_started,count(*) filter(where status='completed')::integer conversations_completed,count(*) filter(where status='abandoned')::integer conversations_abandoned,coalesce(round(avg(extract(epoch from (completed_at-started_at))/60) filter(where status='completed'),2),0) average_duration_minutes,coalesce(sum(nullif(estimate->>'estimated_cost','')::numeric) filter(where status='completed'),0) estimated_revenue,case when count(*)=0 then 0 else round(count(*) filter(where status='completed')*100.0/count(*),2) end conversion_rate from public.web_ai_conversations;

alter table public.web_ai_settings enable row level security;
alter table public.web_ai_conversations enable row level security;
alter table public.web_ai_sessions enable row level security;
alter table public.web_ai_messages enable row level security;
alter table public.web_ai_analytics enable row level security;
alter table public.web_ai_suggestions_cache enable row level security;

drop policy if exists web_ai_settings_admin_select on public.web_ai_settings;
create policy web_ai_settings_admin_select on public.web_ai_settings for select to authenticated using (public.is_admin());
drop policy if exists web_ai_conversations_admin_select on public.web_ai_conversations;
create policy web_ai_conversations_admin_select on public.web_ai_conversations for select to authenticated using (public.is_admin());
drop policy if exists web_ai_sessions_admin_select on public.web_ai_sessions;
create policy web_ai_sessions_admin_select on public.web_ai_sessions for select to authenticated using (public.is_admin());
drop policy if exists web_ai_messages_admin_select on public.web_ai_messages;
create policy web_ai_messages_admin_select on public.web_ai_messages for select to authenticated using (public.is_admin());
drop policy if exists web_ai_analytics_admin_select on public.web_ai_analytics;
create policy web_ai_analytics_admin_select on public.web_ai_analytics for select to authenticated using (public.is_admin());
drop policy if exists web_ai_cache_admin_select on public.web_ai_suggestions_cache;
create policy web_ai_cache_admin_select on public.web_ai_suggestions_cache for select to authenticated using (public.is_admin());

grant execute on function public.web_ai_service_key(text),public.web_ai_service_label(text),public.web_ai_question(text,integer),public.web_ai_score(jsonb,integer),public.web_ai_temperature(integer),public.web_ai_estimate(text,jsonb,jsonb),public.web_ai_config(),public.web_ai_start(text,text),public.web_ai_message(text,text,text,text),public.web_ai_abandon(text) to anon,authenticated;
grant execute on function public.web_ai_admin_summary(),public.web_ai_save_settings(jsonb) to authenticated;
grant select on public.web_ai_funnel,public.web_ai_popular_services,public.web_ai_conversion_summary to authenticated;

do $$ declare t text; begin
  foreach t in array array['web_ai_settings','web_ai_conversations','web_ai_sessions','web_ai_messages','web_ai_analytics','web_ai_suggestions_cache'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; end;
  end loop;
end $$;

commit;
select pg_notify('pgrst','reload schema');

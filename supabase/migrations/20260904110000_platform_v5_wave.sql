-- ALLBEE Platform v5 development wave: durable execution, memory versions,
-- automation history, notification delivery audit, search history, and security controls.
begin;

alter table public.ai_crm_actions add column if not exists idempotency_key text;
alter table public.ai_crm_actions add column if not exists attempt_count integer not null default 0;
alter table public.ai_crm_actions add column if not exists next_retry_at timestamptz;
alter table public.ai_crm_actions add column if not exists provider_message_id text;
alter table public.ai_crm_actions add column if not exists provider_status text;
alter table public.ai_crm_actions add column if not exists provider_response jsonb;
alter table public.ai_crm_actions add column if not exists last_attempt_at timestamptz;
alter table public.ai_crm_actions add column if not exists blocked_reason text;
create unique index if not exists ai_crm_actions_idempotency_idx on public.ai_crm_actions(idempotency_key) where idempotency_key is not null;

create table if not exists public.ai_crm_action_attempts (
  id uuid primary key default gen_random_uuid(), action_id uuid not null references public.ai_crm_actions(id) on delete cascade,
  attempt_no integer not null, provider text, status text not null, provider_message_id text,
  response jsonb, error_message text, started_at timestamptz not null default now(), finished_at timestamptz,
  unique(action_id,attempt_no)
);
create index if not exists ai_crm_action_attempts_action_idx on public.ai_crm_action_attempts(action_id,attempt_no desc);
alter table public.ai_crm_action_attempts enable row level security;
revoke all on public.ai_crm_action_attempts from public,anon,authenticated;
grant select on public.ai_crm_action_attempts to authenticated;
create policy ai_crm_action_attempts_select on public.ai_crm_action_attempts for select to authenticated using(public.is_admin() or exists(select 1 from public.ai_crm_actions a where a.id=action_id and a.requested_by=auth.uid()));

create or replace function public.ai_crm_action_create_v3(p_lead_id uuid,p_action_type text,p_payload jsonb,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; k text:=nullif(trim(p_idempotency_key),'');
begin
  if k is not null then select to_jsonb(a) into v from public.ai_crm_actions a where a.idempotency_key=k limit 1; if v is not null then return v; end if; end if;
  select public.ai_crm_action_create(p_lead_id,p_action_type,p_payload) into v;
  if k is not null then update public.ai_crm_actions set idempotency_key=k where id=(v->>'id')::uuid; select to_jsonb(a) into v from public.ai_crm_actions a where a.id=(v->>'id')::uuid; end if;
  return v;
end $$;
create or replace function public.ai_crm_action_retry(p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.ai_crm_actions%rowtype;
begin
  select * into a from public.ai_crm_actions where id=p_action_id for update;
  if not found or not(public.is_admin() or a.requested_by=auth.uid()) then raise exception 'AI action access denied.' using errcode='insufficient_privilege'; end if;
  if a.status<>'failed' then raise exception 'Only failed actions can be retried.' using errcode='check_violation'; end if;
  if a.attempt_count>=5 then raise exception 'Retry limit reached.' using errcode='program_limit_exceeded'; end if;
  update public.ai_crm_actions set status='approved',failure_reason=null,blocked_reason=null,next_retry_at=null,updated_at=now() where id=a.id returning * into a;
  return to_jsonb(a);
end $$;
revoke execute on function public.ai_crm_action_create_v3(uuid,text,jsonb,text),public.ai_crm_action_retry(uuid) from public,anon;
grant execute on function public.ai_crm_action_create_v3(uuid,text,jsonb,text),public.ai_crm_action_retry(uuid) to authenticated;

create table if not exists public.ai_memory_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.ai_memory_documents(id) on delete cascade,
  version_no integer not null, content_hash text not null, content text not null, metadata jsonb not null default '{}',
  embedding extensions.vector(1536), created_at timestamptz not null default now(), created_by uuid,
  unique(document_id,version_no), unique(document_id,content_hash)
);
create index if not exists ai_memory_versions_doc_idx on public.ai_memory_versions(document_id,version_no desc);
alter table public.ai_memory_versions enable row level security;
revoke all on public.ai_memory_versions from public,anon,authenticated;
grant select on public.ai_memory_versions to authenticated;
create policy ai_memory_versions_select on public.ai_memory_versions for select to authenticated using(public.ai_can_read());

create or replace function public.ai_memory_admin_stats()
returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object('documents',(select count(*) from public.ai_memory_documents where active),'embedded',(select count(*) from public.ai_memory_documents where active and embedding is not null),'pending',(select count(*) from public.ai_memory_documents where active and embedding is null),'versions',(select count(*) from public.ai_memory_versions))
where public.ai_can_read()
$$;
revoke execute on function public.ai_memory_admin_stats() from public,anon; grant execute on function public.ai_memory_admin_stats() to authenticated;

create table if not exists public.business_automation_rule_versions (
  id uuid primary key default gen_random_uuid(), rule_id text not null references public.business_automation_rules(id) on delete cascade,
  version_no integer not null, config jsonb not null default '{}', enabled boolean not null, changed_by uuid, created_at timestamptz not null default now(),
  unique(rule_id,version_no)
);
create table if not exists public.business_automation_executions (
  id uuid primary key default gen_random_uuid(), queue_id uuid references public.business_automation_queue(id) on delete set null,
  rule_id text not null, rule_version integer, status text not null, attempt_no integer not null default 1,
  started_at timestamptz not null default now(), finished_at timestamptz, result jsonb, error_message text
);
create index if not exists business_automation_exec_idx on public.business_automation_executions(rule_id,started_at desc);
alter table public.business_automation_rule_versions enable row level security;
alter table public.business_automation_executions enable row level security;
revoke all on public.business_automation_rule_versions,public.business_automation_executions from public,anon,authenticated;
grant select on public.business_automation_rule_versions,public.business_automation_executions to authenticated;
create policy automation_versions_select on public.business_automation_rule_versions for select to authenticated using(public.is_admin());
create policy automation_exec_select on public.business_automation_executions for select to authenticated using(public.is_admin());

create or replace function public.business_automation_history(p_limit integer default 50)
returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb) from (select * from public.business_automation_executions where public.is_admin() order by started_at desc limit greatest(1,least(p_limit,200))) x
$$;
revoke execute on function public.business_automation_history(integer) from public,anon; grant execute on function public.business_automation_history(integer) to authenticated;

create table if not exists public.notification_delivery_audit (
  id uuid primary key default gen_random_uuid(), notification_id text, user_id uuid, channel text not null,
  status text not null, provider_message_id text, error_message text, attempted_at timestamptz not null default now(), delivered_at timestamptz, read_at timestamptz
);
create index if not exists notification_delivery_audit_user_idx on public.notification_delivery_audit(user_id,attempted_at desc);
alter table public.notification_delivery_audit enable row level security;
revoke all on public.notification_delivery_audit from public,anon,authenticated;
grant select on public.notification_delivery_audit to authenticated;
create policy notification_delivery_audit_select on public.notification_delivery_audit for select to authenticated using(public.is_admin() or user_id=auth.uid());

alter table public.notifications add column if not exists snoozed_until timestamptz;
alter table public.notifications add column if not exists dismissed_at timestamptz;
alter table public.notifications add column if not exists group_key text;
alter table public.notifications add column if not exists deep_link jsonb;
create index if not exists notifications_group_idx on public.notifications(group_key,updated_at desc);

create table if not exists public.global_search_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  query text not null, filters jsonb not null default '{}', used_at timestamptz not null default now()
);
create table if not exists public.global_search_saved (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, query text not null, filters jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(user_id,name)
);
create index if not exists global_search_history_user_idx on public.global_search_history(user_id,used_at desc);
alter table public.global_search_history enable row level security;
alter table public.global_search_saved enable row level security;
revoke all on public.global_search_history,public.global_search_saved from public,anon,authenticated;
grant select,insert,delete on public.global_search_history,public.global_search_saved to authenticated;
create policy search_history_self on public.global_search_history for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy search_saved_self on public.global_search_saved for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.global_search_recent(p_limit integer default 10)
returns jsonb language sql security definer stable set search_path=public as $$ select coalesce(jsonb_agg(to_jsonb(x) order by x.used_at desc),'[]'::jsonb) from (select id,query,filters,used_at from public.global_search_history where user_id=auth.uid() order by used_at desc limit greatest(1,least(p_limit,50))) x $$;
create or replace function public.global_search_save(p_name text,p_query text,p_filters jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$ declare x public.global_search_saved%rowtype; begin insert into public.global_search_saved(user_id,name,query,filters) values(auth.uid(),trim(p_name),trim(p_query),coalesce(p_filters,'{}')) on conflict(user_id,name) do update set query=excluded.query,filters=excluded.filters returning * into x; return to_jsonb(x); end $$;
revoke execute on function public.global_search_recent(integer),public.global_search_save(text,text,jsonb) from public,anon; grant execute on function public.global_search_recent(integer),public.global_search_save(text,text,jsonb) to authenticated;

create or replace function public.finance_reconciliation_summary()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare revenue numeric:=0; expenses numeric:=0; commissions numeric:=0; settlements numeric:=0; exceptions integer:=0;
begin
  if not public.is_admin() then raise exception 'Finance reconciliation requires admin access.' using errcode='insufficient_privilege'; end if;
  select coalesce(sum(received_amount),0) into revenue from public.crm_revenue_collections where status<>'Cancelled';
  select coalesce(sum((data->>'amount')::numeric),0) into expenses from public.transactions where coalesce(data->>'kind','')='expense';
  select coalesce(sum((data->>'amount')::numeric),0) into commissions from public.transactions where coalesce(data->>'kind','')='expense' and (coalesce(data->>'category','') ilike '%commission%' or coalesce(data->>'category','') ilike '%referral%');
  select 0 into exceptions;
  return jsonb_build_object('revenue',revenue,'expenses',expenses,'commission_expenses',commissions,'settlement_exceptions',exceptions,'net',revenue-expenses);
end $$;
revoke execute on function public.finance_reconciliation_summary() from public,anon; grant execute on function public.finance_reconciliation_summary() to authenticated;

create table if not exists public.security_sensitive_actions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), action_type text not null,
  target_id text, confirmed boolean not null default false, ip_hint text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists security_sensitive_actions_user_idx on public.security_sensitive_actions(user_id,created_at desc);
alter table public.security_sensitive_actions enable row level security;
revoke all on public.security_sensitive_actions from public,anon,authenticated;
grant select on public.security_sensitive_actions to authenticated;
create policy security_sensitive_select on public.security_sensitive_actions for select to authenticated using(public.is_admin() or user_id=auth.uid());

create or replace function public.security_record_sensitive_action(p_action_type text,p_target_id text,p_confirmed boolean,p_metadata jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public as $$ declare x uuid; begin if not p_confirmed then raise exception 'Sensitive action confirmation is required.' using errcode='check_violation'; end if; insert into public.security_sensitive_actions(user_id,action_type,target_id,confirmed,metadata) values(auth.uid(),p_action_type,p_target_id,true,coalesce(p_metadata,'{}')) returning id into x; return x; end $$;
revoke execute on function public.security_record_sensitive_action(text,text,boolean,jsonb) from public,anon; grant execute on function public.security_record_sensitive_action(text,text,boolean,jsonb) to authenticated;

commit;
notify pgrst,'reload schema';

begin;
-- AI CRM v4: durable delivery lifecycle, webhook receipts and DLQ.
alter table public.ai_crm_actions add column if not exists delivery_state text not null default 'pending';
alter table public.ai_crm_actions add column if not exists delivery_updated_at timestamptz not null default now();
alter table public.ai_crm_actions add column if not exists approval_actor uuid;
create table if not exists public.ai_crm_delivery_events(id uuid primary key default gen_random_uuid(),action_id uuid not null references public.ai_crm_actions(id) on delete cascade,event_type text not null,provider text,status text,payload jsonb,created_at timestamptz not null default now());
create table if not exists public.ai_crm_dead_letters(id uuid primary key default gen_random_uuid(),action_id uuid not null references public.ai_crm_actions(id) on delete cascade,reason text not null,attempts integer not null default 0,created_at timestamptz not null default now(),resolved_at timestamptz);
create index if not exists ai_crm_delivery_events_action_idx on public.ai_crm_delivery_events(action_id,created_at desc);
create index if not exists ai_crm_dead_letters_open_idx on public.ai_crm_dead_letters(resolved_at,created_at desc);
alter table public.ai_crm_delivery_events enable row level security; alter table public.ai_crm_dead_letters enable row level security;
revoke all on public.ai_crm_delivery_events,public.ai_crm_dead_letters from public,anon,authenticated; grant select on public.ai_crm_delivery_events,public.ai_crm_dead_letters to authenticated;
create policy ai_crm_delivery_events_select on public.ai_crm_delivery_events for select to authenticated using(public.is_admin() or exists(select 1 from public.ai_crm_actions a where a.id=action_id and a.requested_by=auth.uid()));
create policy ai_crm_dead_letters_select on public.ai_crm_dead_letters for select to authenticated using(public.is_admin());
create or replace function public.ai_crm_record_delivery(p_action_id uuid,p_event_type text,p_provider text,p_status text,p_payload jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$ begin insert into public.ai_crm_delivery_events(action_id,event_type,provider,status,payload) values(p_action_id,p_event_type,p_provider,p_status,coalesce(p_payload,'{}')); update public.ai_crm_actions set provider_status=p_status,delivery_state=p_status,delivery_updated_at=now() where id=p_action_id; end $$;
revoke execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) from public,anon,authenticated; grant execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) to service_role;

-- AI Memory v5: explicit lifecycle and source conflict metadata.
alter table public.ai_memory_documents add column if not exists expires_at timestamptz; alter table public.ai_memory_documents add column if not exists version_no integer not null default 1; alter table public.ai_memory_documents add column if not exists conflict_state text not null default 'clean';
create index if not exists ai_memory_expiry_idx on public.ai_memory_documents(active,expires_at);
create or replace function public.ai_memory_archive_expired() returns integer language plpgsql security definer set search_path=public as $$ declare n integer; begin update public.ai_memory_documents set active=false where active and expires_at is not null and expires_at<=now(); get diagnostics n=row_count; return n; end $$;
revoke execute on function public.ai_memory_archive_expired() from public,anon,authenticated; grant execute on function public.ai_memory_archive_expired() to service_role;

-- Automation v4: event bus, retry scheduling, dead letters and simulation/rollback metadata.
create table if not exists public.business_automation_events(id uuid primary key default gen_random_uuid(),event_type text not null,entity text,entity_id uuid,payload jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists public.business_automation_dead_letters(id uuid primary key default gen_random_uuid(),queue_id uuid references public.business_automation_queue(id) on delete cascade,reason text not null,attempts integer not null default 0,created_at timestamptz not null default now(),resolved_at timestamptz);
alter table public.business_automation_rules add column if not exists version integer not null default 1; alter table public.business_automation_rules add column if not exists simulation_only boolean not null default false;
create index if not exists automation_events_created_idx on public.business_automation_events(created_at desc); create index if not exists automation_dlq_open_idx on public.business_automation_dead_letters(resolved_at,created_at desc);
alter table public.business_automation_events enable row level security; alter table public.business_automation_dead_letters enable row level security;
revoke all on public.business_automation_events,public.business_automation_dead_letters from public,anon,authenticated; grant select on public.business_automation_events,public.business_automation_dead_letters to authenticated;
create policy automation_events_admin on public.business_automation_events for select to authenticated using(public.is_admin()); create policy automation_dlq_admin on public.business_automation_dead_letters for select to authenticated using(public.is_admin());

-- Notification v5: category preferences, delivery/read metrics and reminder fields.
alter table public.notification_preferences add column if not exists categories jsonb not null default '{}';
alter table public.notifications add column if not exists snooze_count integer not null default 0; alter table public.notifications add column if not exists read_at timestamptz;
create index if not exists notifications_snooze_idx on public.notifications(snoozed_until) where snoozed_until is not null;

-- Search v5 analytics.
create table if not exists public.global_search_analytics(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),query text not null,result_count integer not null default 0,selected_result text,created_at timestamptz not null default now());
create index if not exists global_search_analytics_idx on public.global_search_analytics(created_at desc);
alter table public.global_search_analytics enable row level security; revoke all on public.global_search_analytics from public,anon,authenticated; grant insert,select on public.global_search_analytics to authenticated;
create policy search_analytics_self on public.global_search_analytics for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Security v5 session/device inventory without exposing secrets.
create table if not exists public.security_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,device_label text,platform text,last_seen_at timestamptz not null default now(),revoked_at timestamptz,created_at timestamptz not null default now());
create index if not exists security_sessions_user_idx on public.security_sessions(user_id,last_seen_at desc);
alter table public.security_sessions enable row level security; revoke all on public.security_sessions from public,anon,authenticated; grant select,update on public.security_sessions to authenticated;
create policy security_sessions_self on public.security_sessions for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy security_sessions_revoke on public.security_sessions for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
commit;
notify pgrst,'reload schema';

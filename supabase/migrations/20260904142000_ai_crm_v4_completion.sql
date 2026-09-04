begin;
-- Normalize delivery state, enrich provider health, and expose complete timeline data.
create or replace function public.ai_crm_record_delivery(p_action_id uuid,p_event_type text,p_provider text,p_status text,p_payload jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$
declare v_state text;
begin
 v_state:=case when p_event_type='dead_letter' or (p_status='failed' and p_event_type='provider_failed') then 'failed' when p_status='delivered' then 'delivered' when p_status='accepted' then 'accepted' when p_status in ('executing','retry_scheduled','queued') then p_status else p_status end;
 insert into public.ai_crm_delivery_events(action_id,event_type,provider,status,payload) values(p_action_id,p_event_type,p_provider,p_status,coalesce(p_payload,'{}')) on conflict do nothing;
 update public.ai_crm_actions set provider_status=p_status,delivery_state=v_state,delivery_updated_at=now(),provider_event_id=coalesce(provider_event_id,p_payload->>'event_id') where id=p_action_id;
end $$;
revoke execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) to authenticated,service_role;

create or replace function public.ai_crm_provider_health() returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(x order by x.provider),'[]'::jsonb) from (select e.provider,count(*) total,count(*) filter(where e.status in('delivered','accepted')) success,count(*) filter(where e.status='failed') failed,count(*) filter(where e.event_type='retry_scheduled') retries,count(*) filter(where e.event_type='dead_letter') dlq,round(coalesce(avg(extract(epoch from (a.delivery_updated_at-a.delivery_attempted_at))*1000) filter(where a.delivery_updated_at is not null and a.delivery_attempted_at is not null),0),0) latency_ms,round(case when count(*)>0 then 100.0*count(*) filter(where e.status in('delivered','accepted'))/count(*) else 0 end,2) success_rate,max(e.created_at) last_event,max(e.created_at) filter(where e.status='failed') last_failure from public.ai_crm_delivery_events e left join public.ai_crm_actions a on a.id=e.action_id where e.created_at>now()-interval '30 days' group by e.provider) x $$;

create or replace function public.ai_crm_admin_actions(p_limit integer default 100) returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (select id,lead_id,action_type,status,delivery_state,attempt_count,next_retry_at,provider_status,provider_message_id,provider_response,failure_reason,blocked_reason,delivery_attempted_at,delivery_updated_at,created_at,updated_at from public.ai_crm_actions where public.is_admin() order by created_at desc limit greatest(1,least(p_limit,300))) x $$;

create or replace function public.ai_crm_action_timeline(p_action_id uuid) returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]') from (select 'delivery' source,event_type,provider,status,payload,created_at from public.ai_crm_delivery_events e where e.action_id=p_action_id and (public.is_admin() or exists(select 1 from public.ai_crm_actions a where a.id=e.action_id and a.requested_by=auth.uid())) union all select 'attempt' source,'attempt_'||status event_type,provider,status,jsonb_build_object('attempt_no',attempt_no,'message_id',provider_message_id,'response',response,'error',error_message) payload,coalesce(finished_at,started_at) created_at from public.ai_crm_action_attempts t where t.action_id=p_action_id and (public.is_admin() or exists(select 1 from public.ai_crm_actions a where a.id=t.action_id and a.requested_by=auth.uid()))) x $$;
commit;
notify pgrst,'reload schema';
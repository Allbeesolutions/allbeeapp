begin;
alter table public.business_automation_events add column if not exists dedupe_key text;
create unique index if not exists business_automation_events_dedupe_idx on public.business_automation_events(dedupe_key) where dedupe_key is not null;
create or replace function public.business_automation_emit(p_event_type text,p_entity text,p_entity_id uuid,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; k text:=encode(extensions.digest(coalesce(p_event_type,'')||'|'||coalesce(p_entity,'')||'|'||coalesce(p_entity_id::text,'')||'|'||coalesce(p_payload,'{}'::jsonb)::text,'sha256'),'hex');
begin insert into public.business_automation_events(event_type,entity,entity_id,payload,dedupe_key) values(p_event_type,p_entity,p_entity_id,coalesce(p_payload,'{}'),k) on conflict(dedupe_key) do update set payload=excluded.payload returning id into v_id; return v_id; end $$;
revoke execute on function public.business_automation_emit(text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.business_automation_dispatch_event(p_event_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare e public.business_automation_events%rowtype; r record; n integer:=0;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.'; end if;
 select * into e from public.business_automation_events where id=p_event_id;
 if not found then return 0; end if;
 for r in select * from public.business_automation_rules where enabled and not simulation_only and trigger_type='event' and (entity=e.entity or entity='*') loop
  insert into public.business_automation_queue(rule_id,entity,entity_id,payload) values(r.id,e.entity,e.entity_id,e.payload) on conflict(rule_id,entity_id) do nothing;
  if found then n:=n+1; end if;
 end loop;
 return n;
end $$;
revoke execute on function public.business_automation_dispatch_event(uuid) from public,anon,authenticated; grant execute on function public.business_automation_dispatch_event(uuid) to service_role;

create or replace function public.business_automation_worker(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare q record; r record; n integer:=0; e uuid; skipped integer:=0;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.'; end if;
 for q in select * from public.business_automation_queue where status in ('approved','queued') and (next_retry_at is null or next_retry_at<=now()) and dead_lettered_at is null order by coalesce(next_retry_at,requested_at) for update skip locked limit greatest(1,least(p_limit,50)) loop
  select * into r from public.business_automation_rules where id=q.rule_id;
  if not found or not r.enabled or r.simulation_only then update public.business_automation_queue set status='rejected',failure_reason=case when not found then 'Rule no longer exists.' when r.simulation_only then 'Simulation-only rule cannot execute.' else 'Rule is disabled.' end where id=q.id; skipped:=skipped+1; continue; end if;
  update public.business_automation_queue set status='executing',attempt_count=attempt_count+1,next_retry_at=null where id=q.id;
  insert into public.business_automation_executions(queue_id,rule_id,rule_version,status,attempt_no) values(q.id,q.rule_id,r.version,'executing',q.attempt_count+1) returning id into e;
  begin
   if q.payload->>'simulation'='true' then raise exception 'Simulation payload must not reach execution worker.'; end if;
   if q.rule_id like '%review' then insert into public.notifications(id,data,updated_at,group_key,deep_link) values('automation:'||q.id::text,jsonb_build_object('title',coalesce(q.payload->>'title','Automation review'),'message',coalesce(q.payload->>'reason','Automation rule requires review'),'type','automation','entity',q.entity,'entity_id',q.entity_id::text,'created_at',now()),now(),'automation:'||q.rule_id,jsonb_build_object('module',q.entity,'id',q.entity_id)); end if;
   update public.business_automation_executions set status='executed',finished_at=now(),result=jsonb_build_object('notification_created',q.rule_id like '%review') where id=e;
   update public.business_automation_queue set status='executed',executed_at=now() where id=q.id; n:=n+1;
  exception when others then
   if q.attempt_count>=5 then update public.business_automation_queue set status='failed',dead_lettered_at=now(),failure_reason=sqlerrm where id=q.id; insert into public.business_automation_dead_letters(queue_id,reason,attempts) values(q.id,sqlerrm,q.attempt_count); update public.business_automation_executions set status='dead_letter',finished_at=now(),error_message=sqlerrm where id=e;
   else update public.business_automation_queue set status='approved',next_retry_at=now()+make_interval(mins=>least(60,power(2,q.attempt_count)::int)),failure_reason=sqlerrm where id=q.id; update public.business_automation_executions set status='retry_scheduled',finished_at=now(),error_message=sqlerrm where id=e; end if;
  end;
 end loop; return jsonb_build_object('executed',n,'skipped',skipped,'ran_at',now()); end $$;
revoke execute on function public.business_automation_worker(integer) from public,anon,authenticated; grant execute on function public.business_automation_worker(integer) to service_role;
commit;
notify pgrst,'reload schema';

begin;
create or replace function public.business_automation_worker(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare q record; r record; n integer:=0; e uuid; skipped integer:=0; attempt integer;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.'; end if;
 for q in select * from public.business_automation_queue where status in ('approved','queued') and (next_retry_at is null or next_retry_at<=now()) and dead_lettered_at is null order by coalesce(next_retry_at,requested_at) for update skip locked limit greatest(1,least(p_limit,50)) loop
  select * into r from public.business_automation_rules where id=q.rule_id;
  if not found or not r.enabled or r.simulation_only then update public.business_automation_queue set status='rejected',failure_reason=case when not found then 'Rule no longer exists.' when r.simulation_only then 'Simulation-only rule cannot execute.' else 'Rule is disabled.' end where id=q.id; skipped:=skipped+1; continue; end if;
  attempt:=q.attempt_count+1;
  update public.business_automation_queue set status='executing',attempt_count=attempt,next_retry_at=null where id=q.id;
  insert into public.business_automation_executions(queue_id,rule_id,rule_version,status,attempt_no) values(q.id,q.rule_id,r.version,'executing',attempt) returning id into e;
  begin
   if q.payload->>'simulation'='true' then raise exception 'Simulation payload must not reach execution worker.'; end if;
   if q.rule_id like '%review' then insert into public.notifications(id,data,updated_at,group_key,deep_link) values('automation:'||q.id::text,jsonb_build_object('title',coalesce(q.payload->>'title','Automation review'),'message',coalesce(q.payload->>'reason','Automation rule requires review'),'type','automation','entity',q.entity,'entity_id',q.entity_id::text,'created_at',now()),now(),'automation:'||q.rule_id,jsonb_build_object('module',q.entity,'id',q.entity_id)); end if;
   update public.business_automation_executions set status='executed',finished_at=now(),result=jsonb_build_object('notification_created',q.rule_id like '%review') where id=e;
   update public.business_automation_queue set status='executed',executed_at=now() where id=q.id; n:=n+1;
  exception when others then
   if attempt>=5 then update public.business_automation_queue set status='failed',dead_lettered_at=now(),failure_reason=sqlerrm where id=q.id; insert into public.business_automation_dead_letters(queue_id,reason,attempts) values(q.id,sqlerrm,attempt); update public.business_automation_executions set status='dead_letter',finished_at=now(),error_message=sqlerrm where id=e;
   else update public.business_automation_queue set status='approved',next_retry_at=now()+make_interval(mins=>least(60,power(2,attempt)::int)),failure_reason=sqlerrm where id=q.id; update public.business_automation_executions set status='retry_scheduled',finished_at=now(),error_message=sqlerrm where id=e; end if;
  end;
 end loop; return jsonb_build_object('executed',n,'skipped',skipped,'ran_at',now()); end $$;
revoke execute on function public.business_automation_worker(integer) from public,anon,authenticated; grant execute on function public.business_automation_worker(integer) to service_role;
commit;
notify pgrst,'reload schema';

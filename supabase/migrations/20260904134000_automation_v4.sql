begin;
alter table public.business_automation_queue add column if not exists attempt_count integer not null default 0;
alter table public.business_automation_queue add column if not exists next_retry_at timestamptz;
alter table public.business_automation_queue add column if not exists dead_lettered_at timestamptz;
create index if not exists automation_queue_due_idx on public.business_automation_queue(status,next_retry_at,requested_at);

create or replace function public.business_automation_emit(p_event_type text,p_entity text,p_entity_id uuid,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare id uuid;
begin insert into public.business_automation_events(event_type,entity,entity_id,payload) values(p_event_type,p_entity,p_entity_id,coalesce(p_payload,'{}')) returning id into id; return id; end $$;
revoke execute on function public.business_automation_emit(text,text,uuid,jsonb) from public,anon,authenticated;

drop trigger if exists automation_emit_crm on public.crm_leads;
create trigger automation_emit_crm after insert or update on public.crm_leads for each row execute function public.business_automation_trigger();

create or replace function public.business_automation_worker(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare q record; n integer:=0; e uuid; begin
 if auth.role()<>'service_role' then raise exception 'Service role required.'; end if;
 for q in select * from public.business_automation_queue where status='approved' and (next_retry_at is null or next_retry_at<=now()) and dead_lettered_at is null order by coalesce(next_retry_at,requested_at) for update skip locked limit greatest(1,least(p_limit,50)) loop
  update public.business_automation_queue set status='executing',attempt_count=attempt_count+1,next_retry_at=null where id=q.id;
  insert into public.business_automation_executions(queue_id,rule_id,rule_version,status,attempt_no) select q.id,q.rule_id,r.version,'executing',q.attempt_count+1 from public.business_automation_rules r where r.id=q.rule_id returning id into e;
  begin
   if q.rule_id like '%review' then
    insert into public.notifications(id,data,updated_at,group_key,deep_link) values('automation:'||q.id::text,jsonb_build_object('title',coalesce(q.payload->>'title','Automation review'),'message',coalesce(q.payload->>'reason','Automation rule requires review'),'type','automation','entity',q.entity,'entity_id',q.entity_id::text,'created_at',now()),now(),'automation:'||q.rule_id,jsonb_build_object('module',q.entity,'id',q.entity_id));
   end if;
   update public.business_automation_executions set status='executed',finished_at=now(),result=jsonb_build_object('notification_created',true) where id=e;
   update public.business_automation_queue set status='executed',executed_at=now() where id=q.id; n:=n+1;
  exception when others then
   if q.attempt_count>=5 then update public.business_automation_queue set status='failed',dead_lettered_at=now(),failure_reason=sqlerrm where id=q.id; insert into public.business_automation_dead_letters(queue_id,reason,attempts) values(q.id,sqlerrm,q.attempt_count); update public.business_automation_executions set status='dead_letter',finished_at=now(),error_message=sqlerrm where id=e;
   else update public.business_automation_queue set status='approved',next_retry_at=now()+make_interval(mins=>least(60,power(2,q.attempt_count)::int)),failure_reason=sqlerrm where id=q.id; update public.business_automation_executions set status='retry_scheduled',finished_at=now(),error_message=sqlerrm where id=e; end if;
  end;
 end loop; return jsonb_build_object('executed',n,'ran_at',now()); end $$;
revoke execute on function public.business_automation_worker(integer) from public,anon,authenticated; grant execute on function public.business_automation_worker(integer) to service_role;
create or replace function public.business_automation_rule_snapshot(p_rule_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.business_automation_rules%rowtype; nextv integer; begin if not public.is_admin() then raise exception 'Admin access required.'; end if; select * into r from public.business_automation_rules where id=p_rule_id for update;if not found then raise exception 'Rule not found.';end if;select coalesce(max(version_no),0)+1 into nextv from public.business_automation_rule_versions where rule_id=p_rule_id;insert into public.business_automation_rule_versions(rule_id,version_no,config,enabled,changed_by) values(r.id,nextv,r.config,r.enabled,auth.uid());return jsonb_build_object('rule_id',r.id,'version',nextv);end $$;
revoke execute on function public.business_automation_rule_snapshot(text) from public,anon;grant execute on function public.business_automation_rule_snapshot(text) to authenticated;
create or replace function public.business_automation_rule_rollback(p_rule_id text,p_version integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.business_automation_rule_versions%rowtype;r public.business_automation_rules%rowtype;begin if not public.is_admin() then raise exception 'Admin access required.';end if;select * into v from public.business_automation_rule_versions where rule_id=p_rule_id and version_no=p_version;if not found then raise exception 'Rule version not found.';end if;select * into r from public.business_automation_rules where id=p_rule_id for update;update public.business_automation_rules set config=v.config,enabled=v.enabled,version=coalesce(version,1)+1,updated_at=now() where id=p_rule_id;return jsonb_build_object('rule_id',p_rule_id,'rolled_back_to',p_version);end $$;
revoke execute on function public.business_automation_rule_rollback(text,integer) from public,anon;grant execute on function public.business_automation_rule_rollback(text,integer) to authenticated;
create or replace function public.business_automation_dlq_recover(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.business_automation_dead_letters%rowtype;begin if not public.is_admin() then raise exception 'Admin access required.';end if;select * into d from public.business_automation_dead_letters where id=p_id for update;if not found or d.resolved_at is not null then raise exception 'DLQ item unavailable.';end if;update public.business_automation_queue set status='approved',attempt_count=0,next_retry_at=now(),dead_lettered_at=null,failure_reason=null where id=d.queue_id;update public.business_automation_dead_letters set resolved_at=now() where id=p_id;return jsonb_build_object('queue_id',d.queue_id,'recovered',true);end $$;
revoke execute on function public.business_automation_dlq_recover(uuid) from public,anon;grant execute on function public.business_automation_dlq_recover(uuid) to authenticated;

do $outer$ begin if exists(select 1 from pg_extension where extname='pg_cron') then begin perform cron.unschedule('allbee_automation_worker');exception when others then null;end;perform cron.schedule('allbee_automation_worker','*/5 * * * *','select public.business_automation_worker(20);');end if;end $outer$;
commit;
notify pgrst,'reload schema';

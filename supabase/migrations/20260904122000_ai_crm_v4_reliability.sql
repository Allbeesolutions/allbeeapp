begin;
-- AI CRM v4 reliability: race-safe creation, delivery receipts, worker leasing and DLQ recovery.
alter table public.ai_crm_actions add column if not exists delivery_attempted_at timestamptz;
alter table public.ai_crm_actions add column if not exists delivery_lock_until timestamptz;
alter table public.ai_crm_actions add column if not exists provider_event_id text;
create unique index if not exists ai_crm_delivery_provider_event_idx on public.ai_crm_delivery_events(provider,event_type,((payload->>'event_id'))) where payload ? 'event_id';
create index if not exists ai_crm_retry_due_idx on public.ai_crm_actions(status,next_retry_at) where next_retry_at is not null;
create unique index if not exists ai_crm_dlq_open_action_idx on public.ai_crm_dead_letters(action_id) where resolved_at is null;

create or replace function public.ai_crm_action_create_v4(p_lead_id uuid,p_action_type text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype; k text:=nullif(trim(p_idempotency_key),'');
begin
 if auth.uid() is null then raise exception 'Authentication required.' using errcode='not_authenticated'; end if;
 if k is null then raise exception 'Idempotency key is required.' using errcode='invalid_parameter_value'; end if;
 insert into public.ai_crm_actions(lead_id,action_type,payload,requested_by,idempotency_key)
 values(p_lead_id,p_action_type,coalesce(p_payload,'{}'),auth.uid(),k)
 on conflict (idempotency_key) do nothing returning * into v;
 if v.id is null then select * into v from public.ai_crm_actions where idempotency_key=k; end if;
 return to_jsonb(v);
end $$;
revoke execute on function public.ai_crm_action_create_v4(uuid,text,jsonb,text) from public,anon;
grant execute on function public.ai_crm_action_create_v4(uuid,text,jsonb,text) to authenticated;

create or replace function public.ai_crm_worker_claim(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public as $$
declare out jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.' using errcode='insufficient_privilege'; end if;
 with picked as (select id from public.ai_crm_actions where status='approved' and (next_retry_at is null or next_retry_at<=now()) and (delivery_lock_until is null or delivery_lock_until<now()) order by coalesce(next_retry_at,created_at),created_at for update skip locked limit greatest(1,least(p_limit,50)))
 update public.ai_crm_actions a set status='executing',delivery_state='executing',delivery_attempted_at=now(),delivery_lock_until=now()+interval '10 minutes',updated_at=now(),attempt_count=a.attempt_count+1 from picked where a.id=picked.id
 returning to_jsonb(a) into out;
 return coalesce(out,'{}');
end $$;
revoke execute on function public.ai_crm_worker_claim(integer) from public,anon,authenticated;
grant execute on function public.ai_crm_worker_claim(integer) to service_role;

create or replace function public.ai_crm_worker_result(p_action_id uuid,p_ok boolean,p_error text default null,p_provider text default null,p_message_id text default null,p_response jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare a public.ai_crm_actions%rowtype; delay_seconds integer;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.' using errcode='insufficient_privilege'; end if;
 select * into a from public.ai_crm_actions where id=p_action_id for update;
 if not found then return; end if;
 if p_ok then
  update public.ai_crm_actions set status='executed',delivery_state='accepted',provider_status='accepted',provider_message_id=coalesce(p_message_id,provider_message_id),provider_response=p_response,delivery_lock_until=null,next_retry_at=null,executed_at=now(),updated_at=now() where id=a.id;
  perform public.ai_crm_record_delivery(a.id,'accepted',p_provider,'accepted',jsonb_build_object('message_id',p_message_id));
 else
  delay_seconds:=least(3600,30*power(2,greatest(0,a.attempt_count-1))::integer);
  if a.attempt_count>=5 then
   update public.ai_crm_actions set status='failed',delivery_state='dead_letter',provider_status='failed',failure_reason=p_error,blocked_reason='Retry limit reached; moved to DLQ.',delivery_lock_until=null,next_retry_at=null,updated_at=now() where id=a.id;
   insert into public.ai_crm_dead_letters(action_id,reason,attempts) values(a.id,coalesce(p_error,'Provider delivery failed.'),a.attempt_count) on conflict (action_id) where resolved_at is null do nothing;
   perform public.ai_crm_record_delivery(a.id,'dead_letter',p_provider,'failed',jsonb_build_object('reason',p_error,'attempts',a.attempt_count));
  else
   update public.ai_crm_actions set status='approved',delivery_state='retry_scheduled',provider_status='failed',failure_reason=p_error,next_retry_at=now()+make_interval(secs=>delay_seconds),delivery_lock_until=null,updated_at=now() where id=a.id;
   perform public.ai_crm_record_delivery(a.id,'retry_scheduled',p_provider,'failed',jsonb_build_object('reason',p_error,'retry_at',now()+make_interval(secs=>delay_seconds),'attempts',a.attempt_count));
  end if;
 end if;
end $$;
revoke execute on function public.ai_crm_worker_result(uuid,boolean,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_crm_worker_result(uuid,boolean,text,text,text,jsonb) to service_role;

create or replace function public.ai_crm_dlq_recover(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.ai_crm_dead_letters%rowtype; a public.ai_crm_actions%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
 select * into d from public.ai_crm_dead_letters where id=p_id for update;
 if not found or d.resolved_at is not null then raise exception 'DLQ item is unavailable.'; end if;
 select * into a from public.ai_crm_actions where id=d.action_id for update;
 update public.ai_crm_actions set status='approved',delivery_state='retry_scheduled',blocked_reason=null,failure_reason=null,attempt_count=0,next_retry_at=now(),delivery_lock_until=null,updated_at=now() where id=a.id;
 update public.ai_crm_dead_letters set resolved_at=now() where id=d.id;
 return (select to_jsonb(x) from public.ai_crm_actions x where x.id=a.id);
end $$;
revoke execute on function public.ai_crm_dlq_recover(uuid) from public,anon;
grant execute on function public.ai_crm_dlq_recover(uuid) to authenticated;

create or replace function public.ai_crm_admin_actions(p_limit integer default 100)
returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (select id,lead_id,action_type,status,delivery_state,attempt_count,next_retry_at,provider_status,provider_message_id,failure_reason,blocked_reason,created_at,updated_at from public.ai_crm_actions where public.is_admin() order by created_at desc limit greatest(1,least(p_limit,300))) x
$$;
revoke execute on function public.ai_crm_admin_actions(integer) from public,anon;
grant execute on function public.ai_crm_admin_actions(integer) to authenticated;

create or replace function public.ai_crm_action_timeline(p_action_id uuid)
returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]') from (select event_type,provider,status,payload,created_at from public.ai_crm_delivery_events e where e.action_id=p_action_id and (public.is_admin() or exists(select 1 from public.ai_crm_actions a where a.id=e.action_id and a.requested_by=auth.uid()))) x
$$;
revoke execute on function public.ai_crm_action_timeline(uuid) from public,anon;
grant execute on function public.ai_crm_action_timeline(uuid) to authenticated;

commit;
notify pgrst,'reload schema';

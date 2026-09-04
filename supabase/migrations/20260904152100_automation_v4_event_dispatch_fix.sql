begin;
create or replace function public.business_automation_dispatch_event(p_event_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare e public.business_automation_events%rowtype; r record; n integer:=0;
begin
 select * into e from public.business_automation_events where id=p_event_id;
 if not found then return 0; end if;
 for r in select * from public.business_automation_rules where enabled and not simulation_only and trigger_type='event' and (entity=e.entity or entity='*') loop
  if e.entity_id is not null then
   insert into public.business_automation_queue(rule_id,entity,entity_id,payload) values(r.id,e.entity,e.entity_id,e.payload) on conflict(rule_id,entity_id) do nothing;
   if found then n:=n+1; end if;
  end if;
 end loop;
 return n;
end $$;
revoke execute on function public.business_automation_dispatch_event(uuid) from public,anon,authenticated; grant execute on function public.business_automation_dispatch_event(uuid) to service_role;

create or replace function public.business_automation_emit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare v_event uuid;
begin
 if TG_TABLE_NAME='apn_users' then select public.business_automation_emit(TG_OP||'_apn_user','apn_users',null,jsonb_build_object('id',new.id,'data',new.data)) into v_event;
 elsif TG_TABLE_NAME='transactions' then select public.business_automation_emit(TG_OP||'_transaction','transactions',null,jsonb_build_object('id',new.id,'data',new.data)) into v_event;
 else select public.business_automation_emit(TG_OP||'_'||TG_TABLE_NAME,TG_TABLE_NAME,new.id,'{}'::jsonb) into v_event; end if;
 perform public.business_automation_dispatch_event(v_event);
 return new;
end $$;
commit;
notify pgrst,'reload schema';

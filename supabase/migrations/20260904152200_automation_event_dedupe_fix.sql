begin;
create or replace function public.business_automation_emit(p_event_type text,p_entity text,p_entity_id uuid,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; k text:=encode(extensions.digest(coalesce(p_event_type,'')||'|'||coalesce(p_entity,'')||'|'||coalesce(p_entity_id::text,'')||'|'||coalesce(p_payload,'{}'::jsonb)::text,'sha256'),'hex');
begin
 insert into public.business_automation_events(event_type,entity,entity_id,payload,dedupe_key) values(p_event_type,p_entity,p_entity_id,coalesce(p_payload,'{}'),k) on conflict do nothing;
 select id into v_id from public.business_automation_events where dedupe_key=k limit 1;
 return v_id;
end $$;
revoke execute on function public.business_automation_emit(text,text,uuid,jsonb) from public,anon,authenticated;
commit;
notify pgrst,'reload schema';

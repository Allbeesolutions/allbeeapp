begin;
create or replace function public.ai_crm_record_delivery(p_action_id uuid,p_event_type text,p_provider text,p_status text,p_payload jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$
declare v_state text;
begin
 v_state:=case when p_event_type='dead_letter' then 'dead_letter' when p_event_type='provider_failed' or p_status='failed' then 'failed' when p_status='delivered' then 'delivered' when p_status='accepted' then 'accepted' when p_status in ('executing','retry_scheduled','queued') then p_status else p_status end;
 insert into public.ai_crm_delivery_events(action_id,event_type,provider,status,payload) values(p_action_id,p_event_type,p_provider,p_status,coalesce(p_payload,'{}')) on conflict do nothing;
 update public.ai_crm_actions set provider_status=p_status,delivery_state=v_state,delivery_updated_at=now(),provider_event_id=coalesce(provider_event_id,p_payload->>'event_id') where id=p_action_id;
end $$;
revoke execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb) to authenticated,service_role;
commit;
notify pgrst,'reload schema';
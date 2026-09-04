begin;
create or replace function public.ai_crm_action_create_v4(p_lead_id uuid,p_action_type text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype; k text:=nullif(trim(p_idempotency_key),'');
begin
 if auth.uid() is null then raise exception 'Authentication required.' using errcode='28000'; end if;
 if k is null then raise exception 'Idempotency key is required.' using errcode='22023'; end if;
 begin
  insert into public.ai_crm_actions(lead_id,action_type,payload,requested_by,idempotency_key) values(p_lead_id,p_action_type,coalesce(p_payload,'{}'),auth.uid(),k) returning * into v;
 exception when unique_violation then
  select * into v from public.ai_crm_actions where idempotency_key=k limit 1;
 end;
 if v.id is null then raise exception 'Unable to create or recover idempotent AI CRM action.'; end if;
 return to_jsonb(v);
end $$;
revoke execute on function public.ai_crm_action_create_v4(uuid,text,jsonb,text) from public,anon;
grant execute on function public.ai_crm_action_create_v4(uuid,text,jsonb,text) to authenticated;
commit;
notify pgrst,'reload schema';
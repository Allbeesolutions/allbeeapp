begin;
create or replace function public.business_automation_upsert_rule(
  p_id text, p_title text, p_trigger_type text, p_entity text, p_condition_key text,
  p_action_type text, p_config jsonb default '{}', p_enabled boolean default true
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.business_automation_rules%rowtype; nextv integer;
begin
  if not public.is_admin() then raise exception 'Automation rule management requires admin access.' using errcode='insufficient_privilege'; end if;
  if nullif(trim(coalesce(p_id,'')),'') is null or nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Rule id and title are required.'; end if;
  if p_trigger_type not in ('scheduled','event') then raise exception 'Invalid trigger type.'; end if;
  if p_action_type not in ('notify','schedule_follow_up','send_email','send_whatsapp') then raise exception 'Invalid action type.'; end if;
  select * into v from public.business_automation_rules where id=p_id for update;
  if found then
    nextv:=coalesce(v.version,1)+1;
    insert into public.business_automation_rule_versions(rule_id,version_no,config,enabled,changed_by) values(v.id,nextv,v.config,v.enabled,auth.uid()) on conflict do nothing;
    update public.business_automation_rules set title=trim(p_title),trigger_type=p_trigger_type,entity=trim(p_entity),condition_key=trim(p_condition_key),action_type=p_action_type,config=coalesce(p_config,'{}'),enabled=p_enabled,version=nextv,updated_at=now() where id=p_id returning * into v;
  else
    insert into public.business_automation_rules(id,title,trigger_type,entity,condition_key,action_type,config,enabled,version) values(trim(p_id),trim(p_title),p_trigger_type,trim(p_entity),trim(p_condition_key),p_action_type,coalesce(p_config,'{}'),p_enabled,1) returning * into v;
    insert into public.business_automation_rule_versions(rule_id,version_no,config,enabled,changed_by) values(v.id,1,v.config,v.enabled,auth.uid()) on conflict do nothing;
  end if;
  return jsonb_build_object('id',v.id,'title',v.title,'version',v.version,'enabled',v.enabled);
end $$;
revoke execute on function public.business_automation_upsert_rule(text,text,text,text,text,text,jsonb,boolean) from public,anon;
grant execute on function public.business_automation_upsert_rule(text,text,text,text,text,text,jsonb,boolean) to authenticated;

create or replace function public.business_automation_delete_rule(p_id text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if not public.is_admin() then raise exception 'Automation rule management requires admin access.' using errcode='insufficient_privilege'; end if;
 delete from public.business_automation_rules where id=p_id;
 return jsonb_build_object('deleted',true,'id',p_id);
end $$;
revoke execute on function public.business_automation_delete_rule(text) from public,anon;
grant execute on function public.business_automation_delete_rule(text) to authenticated;
commit;
notify pgrst,'reload schema';

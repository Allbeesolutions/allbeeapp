begin;

-- security_sessions is written through RPCs; clients never need direct UPDATE.
revoke update on public.security_sessions from authenticated,anon,public;

-- These three proposal functions are intentionally anonymous/public because a
-- customer token is their authentication boundary. All other SECURITY DEFINER
-- functions in public must not be callable by anon/public.
revoke execute on function public.apn_send_message_v2(uuid,text,uuid) from public,anon;
revoke execute on function public.apn_edit_message(uuid,text) from public,anon;
revoke execute on function public.apn_toggle_reaction(uuid,text) from public,anon;
revoke execute on function public.apn_send_message_v3(uuid,text,uuid,jsonb) from public,anon;
revoke execute on function public.apn_list_messages(uuid) from public,anon;
revoke execute on function public.business_automation_approve(uuid) from public,anon;
revoke execute on function public.business_automation_reject(uuid,text) from public,anon;
revoke execute on function public.ai_memory_sync_entity(text,text,text,text,jsonb) from public,anon;
revoke execute on function public.ai_memory_crm_trigger() from public,anon;
revoke execute on function public.ai_memory_apn_trigger() from public,anon;
revoke execute on function public.ai_memory_finance_trigger() from public,anon;
revoke execute on function public.business_automation_emit_trigger() from public,anon;


create or replace function public.security_v5_audit()
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare sensitive text[]:=array['ai_crm_actions','business_automation_queue','business_automation_rules','notification_preferences','apn_chat_attachments','crm_revenue_collections','crm_quotations','crm_projects','apn_withdrawal_requests','apn_wallet_transactions','apn_commissions','apn_referral_earnings','security_sessions','security_sensitive_actions']; rls_bad integer:=0; anon_write integer:=0; auth_write integer:=0; definer_public integer:=0; definer_no_path integer:=0; invoker_bad integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
  select count(*) into rls_bad from unnest(sensitive) t(name) where to_regclass('public.'||name) is null or not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=name and c.relrowsecurity);
  select count(*) into anon_write from unnest(sensitive) t(name) where to_regclass('public.'||name) is not null and (has_table_privilege('anon','public.'||name,'insert') or has_table_privilege('anon','public.'||name,'update') or has_table_privilege('anon','public.'||name,'delete'));
  select count(*) into auth_write from unnest(sensitive) t(name) where to_regclass('public.'||name) is not null and (has_table_privilege('authenticated','public.'||name,'insert') or has_table_privilege('authenticated','public.'||name,'update') or has_table_privilege('authenticated','public.'||name,'delete'));
  select count(*) into definer_public from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname not in ('proposal_public_get','proposal_public_action','proposal_public_projection') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('public',p.oid,'execute'));
  select count(*) into definer_no_path from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%');
  select count(*) into invoker_bad from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and c.relname in ('ai_lead_scores','ai_partner_scores','ai_employee_scores','ai_finance_forecast','crm_lead_pipeline','crm_lead_dashboard','crm_revenue_summary') and not (coalesce(c.reloptions,'{}') @> array['security_invoker=true']);
  return jsonb_build_object('checked_at',now(),'rls_failures',rls_bad,'anon_sensitive_writes',anon_write,'authenticated_sensitive_writes',auth_write,'definer_public_or_anon_execute',definer_public,'definer_without_explicit_search_path',definer_no_path,'security_invoker_view_failures',invoker_bad,'status',case when rls_bad+anon_write+auth_write+definer_public+definer_no_path+invoker_bad=0 then 'secure' else 'attention_required' end);
end $$;

commit;
notify pgrst,'reload schema';

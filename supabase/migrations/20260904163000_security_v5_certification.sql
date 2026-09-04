begin;

-- Security v5: deployment-time boundary audit for sensitive tables, RPCs and views.
create or replace function public.security_v5_audit()
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare sensitive text[]:=array['ai_crm_actions','business_automation_queue','business_automation_rules','notification_preferences','apn_chat_attachments','crm_revenue_collections','crm_quotations','crm_projects','apn_withdrawal_requests','apn_wallet_transactions','apn_commissions','apn_referral_earnings','security_sessions','security_sensitive_actions']; rls_bad integer:=0; anon_write integer:=0; auth_write integer:=0; definer_public integer:=0; definer_no_path integer:=0; invoker_bad integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
  select count(*) into rls_bad from unnest(sensitive) t(name) where to_regclass('public.'||name) is null or not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=name and c.relrowsecurity);
  select count(*) into anon_write from unnest(sensitive) t(name) where to_regclass('public.'||name) is not null and (has_table_privilege('anon','public.'||name,'insert') or has_table_privilege('anon','public.'||name,'update') or has_table_privilege('anon','public.'||name,'delete'));
  select count(*) into auth_write from unnest(sensitive) t(name) where to_regclass('public.'||name) is not null and (has_table_privilege('authenticated','public.'||name,'insert') or has_table_privilege('authenticated','public.'||name,'update') or has_table_privilege('authenticated','public.'||name,'delete'));
  select count(*) into definer_public from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('public',p.oid,'execute'));
  select count(*) into definer_no_path from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%');
  select count(*) into invoker_bad from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and c.relname in ('ai_lead_scores','ai_partner_scores','ai_employee_scores','ai_finance_forecast','crm_lead_pipeline','crm_lead_dashboard','crm_revenue_summary') and not (coalesce(c.reloptions,'{}') @> array['security_invoker=true']);
  return jsonb_build_object('checked_at',now(),'rls_failures',rls_bad,'anon_sensitive_writes',anon_write,'authenticated_sensitive_writes',auth_write,'definer_public_or_anon_execute',definer_public,'definer_without_explicit_search_path',definer_no_path,'security_invoker_view_failures',invoker_bad,'status',case when rls_bad+anon_write+auth_write+definer_public+definer_no_path+invoker_bad=0 then 'secure' else 'attention_required' end);
end $$;

create or replace function public.security_v5_assert()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare a jsonb;
begin
  a:=public.security_v5_audit();
  if a->>'status'<>'secure' then raise exception 'Security v5 assertions failed: %',a using errcode='integrity_constraint_violation'; end if;
  return a;
end $$;

revoke execute on function public.security_v5_audit(),public.security_v5_assert() from public,anon;
grant execute on function public.security_v5_audit(),public.security_v5_assert() to authenticated;

commit;
notify pgrst,'reload schema';

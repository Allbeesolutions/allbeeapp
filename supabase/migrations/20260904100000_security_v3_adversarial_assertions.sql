-- Security v3: deployment-time assertions for sensitive data boundaries.

-- Explicitly remove direct write grants; sensitive writes must go through guarded RPCs.
do $$ declare t text; harden text[] := array['crm_revenue_collections','crm_quotations','crm_projects','apn_withdrawal_requests','apn_wallet_transactions','apn_commissions','apn_referral_earnings','ai_crm_actions','business_automation_queue','business_automation_rules','notification_preferences','apn_chat_attachments']; begin foreach t in array harden loop execute format('revoke insert,update,delete on table public.%I from public,anon,authenticated',t); end loop; end $$;
do $$
declare t text; sensitive text[] := array['ai_crm_actions','business_automation_queue','business_automation_rules','notification_preferences','apn_chat_attachments','crm_revenue_collections','crm_quotations','crm_projects','apn_withdrawal_requests','apn_wallet_transactions','apn_commissions','apn_referral_earnings'];
begin
  foreach t in array sensitive loop
    if to_regclass('public.'||t) is null then raise exception 'Security assertion failed: missing table public.%',t; end if;
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t) then raise exception 'Security assertion failed: RLS disabled on public.%',t; end if;
    if has_table_privilege('anon','public.'||t,'insert') or has_table_privilege('anon','public.'||t,'update') or has_table_privilege('anon','public.'||t,'delete') then raise exception 'Security assertion failed: anon write privilege on public.%',t; end if;
  end loop;
  if has_function_privilege('anon','public.ai_crm_action_complete(uuid,boolean,text)','execute') then raise exception 'Security assertion failed: anon can complete AI CRM actions'; end if;
  if has_function_privilege('authenticated','public.ai_crm_action_complete(uuid,boolean,text)','execute') then raise exception 'Security assertion failed: authenticated can complete AI CRM actions'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='ai_crm_actions' and policyname='ai_crm_actions_select') then raise exception 'Security assertion failed: AI CRM action select policy missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='apn_chat_attachments' and policyname='apn_chat_attachments_select') then raise exception 'Security assertion failed: chat attachment select policy missing'; end if;
end $$;

create or replace function public.security_v3_audit()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
  select jsonb_build_object('checked_at',now(),'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity),'sensitive_write_privileges',jsonb_build_object('anon_ai_crm_complete',has_function_privilege('anon','public.ai_crm_action_complete(uuid,boolean,text)','execute'),'authenticated_ai_crm_complete',has_function_privilege('authenticated','public.ai_crm_action_complete(uuid,boolean,text)','execute')),'policies',(select count(*) from pg_policies where schemaname='public')) into r; return r;
end $$;
revoke execute on function public.security_v3_audit() from public,anon; grant execute on function public.security_v3_audit() to authenticated;

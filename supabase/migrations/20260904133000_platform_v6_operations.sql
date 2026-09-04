begin;
create or replace function public.platform_v6_ops_snapshot() returns jsonb language plpgsql security definer stable set search_path=public as $$
declare r jsonb;
begin
 if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
 select jsonb_build_object('automation',jsonb_build_object('rules',(select count(*) from business_automation_rules where coalesce(active,true)),'queued',(select count(*) from business_automation_queue where status in ('queued','pending_approval')),'failed',(select count(*) from business_automation_executions where status='failed'),'dlq',(select count(*) from business_automation_dead_letters where resolved_at is null)),'notifications',jsonb_build_object('total',(select count(*) from notifications),'delivery_events',(select count(*) from notification_delivery_audit)),'chat',jsonb_build_object('messages',(select count(*) from team_chat)),'search',jsonb_build_object('history',(select count(*) from global_search_history),'saved',(select count(*) from global_search_saved),'analytics',(select count(*) from global_search_analytics)),'apn',jsonb_build_object('partners',(select count(*) from apn_users where coalesce(data->>'status','active')='active'),'wallet_entries',(select count(*) from apn_wallet_transactions),'withdrawals',(select count(*) from apn_withdrawal_requests)),'finance',jsonb_build_object('transactions',(select count(*) from transactions),'income',(select coalesce(sum((data->>'amount')::numeric),0) from transactions where lower(coalesce(data->>'kind',''))='income'),'expenses',(select coalesce(sum((data->>'amount')::numeric),0) from transactions where lower(coalesce(data->>'kind',''))='expense')),'security',jsonb_build_object('sessions',(select count(*) from security_sessions where revoked_at is null),'sensitive_events',(select count(*) from security_sensitive_actions),'permission_rows',(select count(*) from security_permission_matrix))) into r;
 return r;
end $$;
revoke execute on function public.platform_v6_ops_snapshot() from public,anon; grant execute on function public.platform_v6_ops_snapshot() to authenticated;
create or replace function public.platform_v6_security_verify() returns jsonb language plpgsql security definer stable set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
 return jsonb_build_object('permission_rows',(select count(*) from security_permission_matrix),'active_sessions',(select count(*) from security_sessions where revoked_at is null),'sensitive_events',(select count(*) from security_sensitive_actions),'checked_at',now());
end $$;
revoke execute on function public.platform_v6_security_verify() from public,anon; grant execute on function public.platform_v6_security_verify() to authenticated;
commit;

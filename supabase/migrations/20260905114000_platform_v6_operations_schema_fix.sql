begin;

-- Platform V6 operations snapshot must match the canonical V2/V4 schema.
-- business_automation_rules uses enabled (not active), and queue uses
-- pending_approval/approved/executing rather than a nonexistent queued state.
create or replace function public.platform_v6_ops_snapshot()
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
  select jsonb_build_object(
    'automation',jsonb_build_object(
      'rules',(select count(*) from public.business_automation_rules where enabled),
      'queued',(select count(*) from public.business_automation_queue where status in ('approved','executing')),
      'pending_approval',(select count(*) from public.business_automation_queue where status='pending_approval'),
      'failed',(select count(*) from public.business_automation_executions where status='failed'),
      'dlq',(select count(*) from public.business_automation_dead_letters where resolved_at is null)
    ),
    'notifications',jsonb_build_object('total',(select count(*) from public.notifications),'delivery_events',(select count(*) from public.notification_delivery_audit)),
    'chat',jsonb_build_object('messages',(select count(*) from public.chat)),
    'search',jsonb_build_object('history',(select count(*) from public.global_search_history),'saved',(select count(*) from public.global_search_saved),'analytics',(select count(*) from public.global_search_analytics)),
    'apn',jsonb_build_object('partners',(select count(*) from public.apn_users where coalesce(data->>'status','active')='active'),'wallet_entries',(select count(*) from public.apn_wallet_transactions),'withdrawals',(select count(*) from public.apn_withdrawal_requests)),
    'finance',jsonb_build_object('transactions',(select count(*) from public.transactions),'income',(select coalesce(sum((data->>'amount')::numeric),0) from public.transactions where lower(coalesce(data->>'kind',''))='income'),'expenses',(select coalesce(sum((data->>'amount')::numeric),0) from public.transactions where lower(coalesce(data->>'kind',''))='expense')),
    'security',jsonb_build_object('sessions',(select count(*) from public.security_sessions where revoked_at is null),'sensitive_events',(select count(*) from public.security_sensitive_actions),'permission_rows',(select count(*) from public.security_permission_matrix))
  ) into r;
  return r;
end $$;
revoke execute on function public.platform_v6_ops_snapshot() from public,anon;
grant execute on function public.platform_v6_ops_snapshot() to authenticated;

commit;
notify pgrst,'reload schema';

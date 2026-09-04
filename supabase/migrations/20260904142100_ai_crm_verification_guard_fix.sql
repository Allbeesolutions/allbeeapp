begin;
create or replace function public.ai_crm_delivery_verification()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_total bigint; v_accepted bigint; v_failed bigint; v_dlq bigint; v_due bigint; v_duplicates bigint;
begin
 if not public.is_admin() and auth.uid() is null then raise exception 'Authentication required.' using errcode='28000'; end if;
 select count(*) into v_total from public.ai_crm_actions;
 select count(*) into v_accepted from public.ai_crm_actions where delivery_state in ('accepted','delivered');
 select count(*) into v_failed from public.ai_crm_actions where delivery_state='failed';
 select count(*) into v_dlq from public.ai_crm_actions where delivery_state='dead_letter';
 select count(*) into v_due from public.ai_crm_actions where status='approved' and next_retry_at is not null and next_retry_at<=now();
 select count(*)-count(distinct provider_event_id) into v_duplicates from public.ai_crm_actions where provider_event_id is not null;
 return jsonb_build_object('total',v_total,'accepted',v_accepted,'failed',v_failed,'dead_letter',v_dlq,'retry_due',v_due,'duplicate_provider_events',v_duplicates,'checked_at',now());
end $$;
revoke execute on function public.ai_crm_delivery_verification() from public,anon;
grant execute on function public.ai_crm_delivery_verification() to authenticated;
commit;
notify pgrst,'reload schema';
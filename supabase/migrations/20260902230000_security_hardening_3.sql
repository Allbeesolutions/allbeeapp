-- Security 2.1: close implicit PUBLIC/anon execution on SECURITY DEFINER functions.
-- SECURITY DEFINER RPCs must never inherit PostgreSQL's default PUBLIC EXECUTE grant.
begin;

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon',
      r.schema_name, r.function_name, r.identity_args
    );
  end loop;
end $$;

do $$
declare
  r record;
begin
  -- Restore authenticated access only to SECURITY DEFINER RPCs exposed by the app.
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname = any(array[
        'admin_restore_json_backup','apn_accept_friend_request',
        'apn_admin_mark_delivered','apn_admin_mark_read',
        'apn_admin_open_partner_chat','apn_admin_send_message',
        'apn_agreement_accept','apn_agreement_publish','apn_agreement_save_draft',
        'apn_agreement_status','apn_delete_message',
        'apn_finalize_finance_income_revoke','apn_get_district_conversation',
        'apn_get_or_create_admin_conversation','apn_get_or_create_person_conversation',
        'apn_get_state_conversation','apn_list_chat_contacts','apn_list_conversations',
        'apn_list_friend_requests','apn_list_messages','apn_mark_delivered',
        'apn_mark_read','apn_message_info','apn_open_person_chat','apn_presence_heartbeat',
        'apn_reject_friend_request','apn_send_friend_request','apn_send_message',
        'apn_state_head_approve_partner','apn_state_head_partner_action',
        'apn_state_head_reject_partner','create_apn_income_transaction',
        'mark_apn_action_badge_seen'
      ])
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      r.schema_name, r.function_name, r.identity_args
    );
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

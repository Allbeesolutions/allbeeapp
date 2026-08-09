-- pr-external-audit-phase2.sql — Phase 2B: external/stored-RPC surface hardening (idempotent).
--
-- Goal: anonymous callers must only reach the *public* surface. Revoking
-- EXECUTE from anon here does NOT affect:
--   - authenticated app users  (they keep EXECUTE on every function)
--   - triggers / edge functions (service_role retains EXECUTE on all)
--   - RLS policy evaluation (predicates below are kept; SQL ones are inlined)
--
-- KEPT for anon (public web flows + pure read-only helpers):
--   login/identity: username_to_email, username_available, email_available
--   public pricing/knowledge: knowledge_get_pricing, knowledge_estimate,
--     knowledge_search, knowledge_resolve_service
--   public web-AI advisor: web_ai_{config,service_key,service_label,temperature,
--     question,start,message,abandon,score,estimate,referral_partner}
--   public requirement flow: web_requirement_{detect_service,next_question,
--     save_draft,summary}
--   public proposal links: proposal_public_get, proposal_public_action,
--     proposal_actor_name
--   read-only predicates/identity (also in RLS policies): is_admin,
--     is_superadmin, is_internal, is_client, is_partner, is_apn_admin,
--     is_period_locked, app_role, my_role, current_name, can_module,
--     can_finance, ai_can_read, crm_can_manage/can_read,
--     apn_withdrawal_can_manage, guid_tsv, crm_actor_name,
--     apn_withdrawal_actor_role
--
-- REVOKED here: every other non-PUBLIC RPC (admin tools, CRM, APN/referrals,
-- AI insights, knowledge admin, proposal admin, counters, internal table
-- provisioning `_allbee_*`, and per-table trigger guards `*_guard`), plus
-- `purge_recycle` which had NO internal authority check (anon could
-- permanently delete recycle-bin rows), and `handle_new_user`.



-- Revoke anonymous EXECUTE from non-public functions (idempotent):
revoke execute on function public._allbee_realtime(tbl text) from anon, public;
revoke execute on function public._allbee_table(tbl text, gate text) from anon, public;
revoke execute on function public.ai_generate_report(p_report_type text, p_format text) from anon, public;
revoke execute on function public.ai_generate_timeline(p_period text) from anon, public;
revoke execute on function public.ai_get_dashboard() from anon, public;
revoke execute on function public.ai_natural_language_search(p_query text) from anon, public;
revoke execute on function public.ai_refresh_insights() from anon, public;
revoke execute on function public.ai_save_settings(p_enabled boolean, p_sensitivity text, p_forecast_period integer, p_prediction_model text) from anon, public;
revoke execute on function public.apn_approve_withdrawal(p_request_id uuid, p_approved_amount numeric, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_cancel_withdrawal(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_commission_project_sync() from anon, public;
revoke execute on function public.apn_commission_rate_for_project(p_partner_id text, p_project_number integer) from anon, public;
revoke execute on function public.apn_commissions_guard() from anon, public;
revoke execute on function public.apn_create_withdrawal_batch(p_frequency text, p_scheduled_for date, p_notes text) from anon, public;
revoke execute on function public.apn_delete_commission_project(p_project_id text, p_reason text) from anon, public;
revoke execute on function public.apn_log_withdrawal_export(p_format text, p_filters jsonb, p_row_count integer) from anon, public;
revoke execute on function public.apn_mark_withdrawal_paid(p_request_id uuid, p_payment_reference text) from anon, public;
revoke execute on function public.apn_mark_withdrawal_processing(p_request_id uuid, p_batch_id uuid, p_notes text) from anon, public;
revoke execute on function public.apn_percent_limits() from anon, public;
revoke execute on function public.apn_referral_audit(p_action text, p_partner_id text, p_entity_id text, p_metadata jsonb) from anon, public;
revoke execute on function public.apn_referral_code_available(p_code text, p_exclude_partner text) from anon, public;
revoke execute on function public.apn_referral_collection_after_insert() from anon, public;
revoke execute on function public.apn_referral_dashboard(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_earning_after_change() from anon, public;
revoke execute on function public.apn_referral_ensure_code(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_identity_after_insert() from anon, public;
revoke execute on function public.apn_referral_leaderboard(p_period text) from anon, public;
revoke execute on function public.apn_referral_link_code(p_partner_id text, p_code text, p_source text) from anon, public;
revoke execute on function public.apn_referral_network(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_notify(p_partner_id text, p_title text, p_body text, p_event_type text) from anon, public;
revoke execute on function public.apn_referral_refresh_wallet(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_rename_code(p_partner_id text, p_new_code text) from anon, public;
revoke execute on function public.apn_referral_request_withdrawal(p_partner_id text, p_amount numeric, p_note text) from anon, public;
revoke execute on function public.apn_referral_set_relationship_status(p_relationship_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_set_withdrawal_status(p_withdrawal_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_update_earning_status(p_earning_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_update_settings(p_enabled boolean, p_percent numeric) from anon, public;
revoke execute on function public.apn_referral_withdrawal_after_change() from anon, public;
revoke execute on function public.apn_registration_guard(p_email text, p_meta jsonb) from anon, public;
revoke execute on function public.apn_reject_withdrawal(p_request_id uuid, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_reopen_withdrawal(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_request_withdrawal(p_wallet_type text, p_amount numeric, p_preferred_method text, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_revenue_collection_sync() from anon, public;
revoke execute on function public.apn_set_withdrawal_bank_verification(p_partner_id text, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_unlock_withdrawal_wallet(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_upsert_withdrawal_bank_account(p_partner_id text, p_account_holder text, p_bank_name text, p_account_number text, p_confirm_account_number text, p_ifsc text, p_upi_id text, p_branch text) from anon, public;
revoke execute on function public.apn_users_apnid_immutable() from anon, public;
revoke execute on function public.apn_users_guard() from anon, public;
revoke execute on function public.apn_withdrawal_add_timeline(p_request apn_withdrawal_requests, p_title text, p_description text) from anon, public;
revoke execute on function public.apn_withdrawal_audit_event(p_action text, p_partner_id text, p_request_id uuid, p_metadata jsonb) from anon, public;
revoke execute on function public.apn_withdrawal_dashboard(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_next_settlement_date() from anon, public;
revoke execute on function public.apn_withdrawal_notify(p_partner_id text, p_title text, p_body text, p_priority text, p_event_type text) from anon, public;
revoke execute on function public.apn_withdrawal_partner_is_active(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_prevent_mutation() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_collection() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_referral_earning() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_request() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_wallet(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_request_amount(p_requested numeric, p_approved numeric, p_status text) from anon, public;
revoke execute on function public.apn_withdrawal_review(p_request_id uuid, p_action text, p_approved_amount numeric, p_reason text, p_notes text, p_batch_id uuid) from anon, public;
revoke execute on function public.apn_withdrawal_source_totals(p_partner_id text, p_wallet_type text) from anon, public;
revoke execute on function public.create_apn_income_transaction(p_transaction jsonb, p_project jsonb, p_collections jsonb) from anon, public;
revoke execute on function public.crm_add_follow_up(p_lead_id uuid, p_payload jsonb) from anon, public;
revoke execute on function public.crm_assign_lead(p_lead_id uuid, p_employee_id text, p_partner_id text, p_district_head_id text, p_state_head_id text) from anon, public;
revoke execute on function public.crm_can_manage() from anon, public;
revoke execute on function public.crm_can_read(p_employee text, p_partner text, p_district text, p_state text) from anon, public;
revoke execute on function public.crm_convert_quotation(p_quote_id uuid) from anon, public;
revoke execute on function public.crm_create_lead(p_payload jsonb) from anon, public;
revoke execute on function public.crm_create_quotation(p_lead_id uuid, p_payload jsonb) from anon, public;
revoke execute on function public.crm_generate_reminders() from anon, public;
revoke execute on function public.crm_log_event(p_event text, p_title text, p_description text, p_lead uuid, p_project uuid, p_quote uuid, p_metadata jsonb) from anon, public;
revoke execute on function public.crm_notify(p_title text, p_message text, p_priority text, p_lead uuid) from anon, public;
revoke execute on function public.crm_record_revenue(p_project_id uuid, p_amount numeric, p_received_at date, p_incentive numeric, p_remarks text) from anon, public;
revoke execute on function public.crm_sync_revenue_to_apn() from anon, public;
revoke execute on function public.crm_update_lead(p_lead_id uuid, p_patch jsonb) from anon, public;
revoke execute on function public.crm_update_quotation_status(p_quote_id uuid, p_status text) from anon, public;
revoke execute on function public.delete_apn_commission_project(p_project_id text) from anon, public;
revoke execute on function public.fin_lock_guard() from anon, public;
revoke execute on function public.guard_fin_lock() from anon, public;
revoke execute on function public.handle_new_user() from anon, public;
revoke execute on function public.is_apn_admin() from anon, public;
revoke execute on function public.is_partner() from anon, public;
revoke execute on function public.knowledge_admin_list(p_entity text, p_search text, p_page integer, p_page_size integer) from anon, public;
revoke execute on function public.knowledge_admin_save(p_entity text, p_payload jsonb) from anon, public;
revoke execute on function public.knowledge_admin_summary() from anon, public;
revoke execute on function public.knowledge_export(p_entity text, p_search text) from anon, public;
revoke execute on function public.knowledge_import(p_entity text, p_rows jsonb) from anon, public;
revoke execute on function public.knowledge_log_change(p_entity_type text, p_entity_id text, p_action text, p_old jsonb, p_new jsonb, p_reason text, p_approval_status text) from anon, public;
revoke execute on function public.mark_apn_action_badge_seen(p_action_type text) from anon, public;
revoke execute on function public.next_apn_number() from anon, public;
revoke execute on function public.next_task_number() from anon, public;
revoke execute on function public.prevent_audit_mutation() from anon, public;
revoke execute on function public.profiles_guard() from anon, public;
revoke execute on function public.profiles_identity_guard() from anon, public;
revoke execute on function public.proposal_admin_list(p_search text, p_status text, p_limit integer, p_offset integer) from anon, public;
revoke execute on function public.proposal_admin_summary() from anon, public;
revoke execute on function public.proposal_after_requirement_completed() from anon, public;
revoke execute on function public.proposal_create_revision(p_proposal_id uuid, p_patch jsonb, p_reason text) from anon, public;
revoke execute on function public.proposal_log(p_proposal_id uuid, p_action text, p_metadata jsonb, p_actor_type text) from anon, public;
revoke execute on function public.proposal_record_action(p_proposal_id uuid, p_action text, p_comment text, p_token text, p_signer_name text, p_signer_email text, p_signature text) from anon, public;
revoke execute on function public.proposal_regenerate_public_link(p_proposal_id uuid) from anon, public;
revoke execute on function public.proposal_save_section_definition(p_payload jsonb) from anon, public;
revoke execute on function public.purge_recycle() from anon, public;
revoke execute on function public.upsert_apn_commission_project(p_project jsonb, p_collections jsonb) from anon, public;
revoke execute on function public.web_ai_admin_summary() from anon, public;
revoke execute on function public.web_ai_save_settings(p_patch jsonb) from anon, public;
revoke execute on function public.web_requirement_admin_list(p_entity text, p_search text, p_page integer, p_page_size integer) from anon, public;
revoke execute on function public.web_requirement_admin_save(p_entity text, p_payload jsonb) from anon, public;
revoke execute on function public.web_requirement_admin_summary() from anon, public;


-- Idempotency/verifiability guard (fails loudly if someone adds a public shell):
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.prokind='f' and has_function_privilege('anon', p.oid, 'EXECUTE');  -- expect 39 rows

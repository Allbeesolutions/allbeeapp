-- WP4 verify — re-runnable health check for the APN lifecycle patch.
-- Expect: every row to return true / OK (alongside the informational counts).

select 'apn_admin_consoles' as obj, exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_admin_consoles') as ok
union all select 'apn_admin_notes', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_admin_notes')
union all select 'apn_zone_requests', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_zone_requests')
union all select 'apn_target_client_levels', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_levels')
union all select 'apn_target_client_products', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_products')
union all select 'apn_target_client_prescriptions', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_prescriptions')
union all select 'apn_target_client_prescription_items', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_prescription_items')
union all select 'apn_target_client_loyalty', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_loyalty')
union all select 'apn_target_client_loyalty_rewards', exists (
  select 1 from pg_tables where schemaname='public' and tablename='apn_target_client_loyalty_rewards')
union all select 'fn apn_zone_request_hub_note', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_zone_request_hub_note')
union all select 'fn apn_zone_requests_send', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_zone_requests_send')
union all select 'fn apn_zone_requests_approve', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_zone_requests_approve')
union all select 'fn apn_zone_requests_reject', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_zone_requests_reject')
union all select 'fn apn_add_block_interactions', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_add_block_interactions')
union all select 'fn apn_add_prescription_items', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_add_prescription_items')
union all select 'fn apn_add_prescription_condition_items', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_add_prescription_condition_items')
union all select 'fn apn_apex_mix_details', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_apex_mix_details')
union all select 'fn apn_apex_prescription_balance', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_apex_prescription_balance')
union all select 'fn apn_apex_prescription_submit', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_apex_prescription_submit')
union all select 'fn apn_apex_prescription_target', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_apex_prescription_target')
union all select 'fn apn_users_guard allows banned', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_users_guard'
    and pg_get_functiondef(p.oid) like '%banned%')
union all select 'fn apn_profile_name_sync', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_profile_name_sync')
union all select 'trg apn_zone_request_hub_note_trg', exists (
  select 1 from pg_trigger where tgname='apn_zone_request_hub_note_trg' and not tgisinternal)
union all select 'trg apn_profile_name_sync_trg', exists (
  select 1 from pg_trigger where tgname='apn_profile_name_sync_trg' and not tgisinternal)
union all select 'fn apn_is_district_head_of', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_is_district_head_of')
union all select 'trg apn_users_head_guard_trg', exists (
  select 1 from pg_trigger where tgname='apn_users_head_guard_trg' and not tgisinternal)
union all select 'pol apn_users_head_update', exists (
  select 1 from pg_policies where schemaname='public' and tablename='apn_users' and policyname='apn_users_head_update')
union all select 'pol client tables own-select (partner_id)', (
  select count(*) = 6 from pg_policies
  where schemaname='public' and tablename in (
    'apn_target_client_levels','apn_target_client_products','apn_target_client_prescriptions',
    'apn_target_client_prescription_items','apn_target_client_loyalty','apn_target_client_loyalty_rewards')
    and policyname like '%_select' and pg_get_expr(polqual, polrelid) like '%partner_id%')
union all select 'rpc revoked from anon/public', (
  select count(*) = 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
    lateral unnest(p.proacl) acl
  where n.nspname='public' and p.proname in (
    'apn_zone_requests_send','apn_zone_requests_approve','apn_zone_requests_reject',
    'apn_add_block_interactions','apn_add_prescription_items','apn_add_prescription_condition_items',
    'apn_apex_prescription_submit','apn_apex_prescription_balance','apn_apex_prescription_target','apn_apex_mix_details')
    and (acl.grantee = 0 or acl.grantee = (select oid from pg_roles where rolname = 'anon')))
union all select 'guard pre-approve INSERT branch', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_users_guard'
    and pg_get_functiondef(p.oid) like '%p.approved and p.active%')
union all select 'guard partner-field protection restored', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_users_guard'
    and pg_get_functiondef(p.oid) like '%Self-service APN profile fields%')
union all select 'banned is superadmin-only', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_users_guard'
    and pg_get_functiondef(p.oid) like '%banned'' is a super-admin-only status%');

-- informational (0 is fine; they only show how much exists already)
select 'counters',
  (select count(*) from public.apn_admin_notes) as apn_admin_notes,
  (select count(*) from public.apn_zone_requests) as apn_zone_requests,
  (select count(*) from public.apn_target_client_prescriptions) as prescriptions;
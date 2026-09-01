-- Phase 2 / P0: extend atomic JSON restore to normalized relational data.
-- Legacy JSON-row tables remain transactional; normalized tables are restored
-- from the same JSON payload using their real SQL column types.
-- APN users themselves are intentionally preserved because additional live
-- APN ledgers outside the JSON-row model reference them.
begin;

create or replace function public.admin_restore_json_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_table text;
  v_columns text;
  v_restored bigint := 0;
  v_index integer;
  v_legacy constant text[] := array[
    'transactions','withdrawals','tasks','projects','students','marketing',
    'concepts','audit','attendance','leave','updates','recycle','leads',
    'clients','quotations','planned','announcements','documents','knowledge',
    'chat','rewards','vault','portal_posts','notifications','invoices',
    'resignations','prompts','sheets','inhouse','payroll','teams','team_chat',
    'testing','class_students'
  ];
  v_normalized constant text[] := array[
    'support_ticket_messages','support_ticket_audit','support_tickets',
    'crm_activities','crm_audit','crm_files','crm_follow_ups','crm_reminders',
    'crm_lead_assignments','crm_project_milestones','crm_revenue_collections',
    'crm_quotation_versions','crm_projects','crm_quotations','crm_clients',
    'ai_insights','ai_predictions','ai_cache','ai_history','ai_recommendations','ai_reports','ai_settings',
    'apn_referral_snapshots','apn_referral_earnings','apn_referral_relationships',
    'apn_referral_codes','apn_referral_activities','apn_referral_analytics_monthly',
    'apn_referral_monthly_summary','apn_referral_timeline','apn_referral_wallets',
    'apn_referral_withdrawals','apn_referral_settings',
    'apn_withdrawal_finance_transactions','apn_withdrawal_audit','apn_wallet_transactions',
    'apn_withdrawal_status_history','apn_withdrawal_settlements','apn_withdrawal_requests',
    'apn_withdrawal_bank_accounts','apn_withdrawal_batches','apn_withdrawal_wallets',
    'apn_agreement_acceptances','apn_agreements','apn_hierarchy_assignments','apn_agreement_company',
    'apn_target_client_prescription_items','apn_target_client_prescriptions',
    'apn_target_client_loyalty_rewards','apn_target_client_loyalty',
    'apn_target_client_products','apn_target_client_levels','apn_action_badge_reads'
  ];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an administrator can restore a JSON backup.' using errcode = '42501';
  end if;
  if p_backup is null or jsonb_typeof(p_backup) <> 'object' then
    raise exception 'Invalid backup: expected a JSON object.' using errcode = '22023';
  end if;
  if not (p_backup ? 'transactions') then
    raise exception 'Invalid ALLBEE backup: required transactions collection is missing.' using errcode = '22023';
  end if;

  -- Validate supplied collections before touching live data.
  foreach v_table in array v_legacy loop
    if p_backup ? v_table and jsonb_typeof(p_backup -> v_table) <> 'array' then
      raise exception 'Invalid backup: collection % must be an array.', v_table using errcode = '22023';
    end if;
  end loop;
  foreach v_table in array v_normalized loop
    if p_backup ? v_table and jsonb_typeof(p_backup -> v_table) <> 'array' then
      raise exception 'Invalid backup: normalized collection % must be an array.', v_table using errcode = '22023';
    end if;
  end loop;

  -- Legacy rows use the stable id/data/updated_at envelope.
  foreach v_table in array v_legacy loop
    execute format('delete from public.%I', v_table);
    if p_backup ? v_table then
      execute format(
        'insert into public.%I (id,data,updated_at)
         select value->>''id'',value,clock_timestamp()
         from jsonb_array_elements($1) x(value)', v_table
      ) using p_backup -> v_table;
    end if;
    execute format('select count(*) from public.%I', v_table) into v_restored;
  end loop;

  -- Break the APN agreement self-reference before replacing its versions.
  if p_backup ? 'apn_agreements' then
    update public.apn_agreements set supersedes_id = null;
  end if;

  -- Normalized child tables are cleared before their parents, then reinserted
  -- in the reverse dependency order. Tables absent from a backup are preserved.
  foreach v_table in array v_normalized loop
    if p_backup ? v_table then
      execute format('delete from public.%I', v_table);
    end if;
  end loop;
  -- The ordered insert list is defined below by reversing the dependency-safe
  -- delete sequence; each table is inserted only when present in the payload.
  for v_index in reverse 1..coalesce(array_length(v_normalized, 1), 0) loop
    v_table := v_normalized[v_index];
    if p_backup ? v_table then
      select string_agg(format('%I', column_name), ', ' order by ordinal_position)
        into v_columns
      from information_schema.columns
      where table_schema='public' and table_name=v_table
        and is_identity='NO' and is_generated='NEVER';
      if v_columns is null then
        raise exception 'Backup restore cannot determine writable columns for %.', v_table;
      end if;
      execute format(
        'insert into public.%I (%s)
         select %s from jsonb_populate_recordset(NULL::public.%I,$1)',
        v_table, v_columns, v_columns, v_table
      ) using p_backup -> v_table;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'legacy_tables',cardinality(v_legacy),
    'normalized_tables',cardinality(v_normalized));
end;
$$;

revoke all on function public.admin_restore_json_backup(jsonb) from public;
grant execute on function public.admin_restore_json_backup(jsonb) to authenticated;

commit;

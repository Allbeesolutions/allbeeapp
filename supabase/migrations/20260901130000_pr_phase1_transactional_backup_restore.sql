-- Phase 1 / P0: make JSON backup restore atomic.
-- The client used to DELETE + INSERT each table one at a time. A failure in
-- the middle could leave production partially restored. PostgreSQL functions
-- execute inside one transaction, so any exception rolls the whole restore back.
begin;

create or replace function public.admin_restore_json_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_table text;
  v_bad bigint;
  v_duplicate bigint;
  v_tables constant text[] := array[
    'transactions','withdrawals','tasks','projects','students','marketing',
    'concepts','attendance','leave','updates','recycle',
    'leads','clients','quotations','planned','announcements','documents',
    'knowledge','chat','rewards','vault','portal_posts','notifications',
    'invoices','resignations','prompts','sheets','inhouse','payroll','teams',
    'team_chat','testing','class_students',
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_commission_projects',
    'apn_revenue_collections','apn_achievements','apn_notifications',
    'apn_documents','apn_timeline','apn_warnings','apn_notes','apn_activity',
    'apn_transfer_history','apn_communications','apn_admin_notes',
    'apn_admin_consoles','apn_zone_requests'
  ];
  v_restored bigint := 0;
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

  -- Validate every collection before deleting anything. This catches malformed
  -- rows and duplicate IDs while the live database is still untouched.
  foreach v_table in array v_tables loop
    if p_backup ? v_table then
      if jsonb_typeof(p_backup -> v_table) <> 'array' then
        raise exception 'Invalid backup: collection % must be an array.', v_table using errcode = '22023';
      end if;
      select count(*) into v_bad
      from jsonb_array_elements(p_backup -> v_table) as x(value)
      where jsonb_typeof(value) <> 'object'
         or not (value ? 'id')
         or jsonb_typeof(value -> 'id') <> 'string'
         or btrim(value ->> 'id') = '';
      if v_bad > 0 then
        raise exception 'Invalid backup: collection % contains % row(s) without a valid string id.', v_table, v_bad using errcode = '22023';
      end if;
      select count(*) into v_duplicate
      from (
        select value ->> 'id'
        from jsonb_array_elements(p_backup -> v_table) as x(value)
        group by value ->> 'id'
        having count(*) > 1
      ) duplicates;
      if v_duplicate > 0 then
        raise exception 'Invalid backup: collection % contains duplicate IDs.', v_table using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Every operation below is part of the same PostgreSQL transaction as the
  -- function call. Any delete/insert failure aborts the complete restore.
  foreach v_table in array v_tables loop
    execute format('delete from public.%I', v_table);
    execute format(
      'insert into public.%I (id, data, updated_at)
       select value ->> ''id'', value, $2
       from jsonb_array_elements($1) as x(value)',
      v_table
    ) using coalesce(p_backup -> v_table, '[]'::jsonb), clock_timestamp();
    execute format('select count(*) from public.%I', v_table) into v_bad;
    v_restored := v_restored + v_bad;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'tables', cardinality(v_tables),
    'rows', v_restored
  );
end;
$$;

revoke all on function public.admin_restore_json_backup(jsonb) from public;
grant execute on function public.admin_restore_json_backup(jsonb) to authenticated;

commit;

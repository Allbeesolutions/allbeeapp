-- #26 hardening: never delete a commission source before its immutable
-- ledger entries are reversed. Failure is fail-closed if funds may have paid.
begin;

create or replace function public.apn_delete_cancelled_commission_project(p_project_id text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  p public.apn_commission_projects%rowtype;
  v_id uuid;
  v_earning record;
  v_collection record;
  deleted_collections integer := 0;
  deleted_transactions integer := 0;
  deleted_notifications integer := 0;
  deleted_timeline integer := 0;
  deleted_project integer := 0;
  audit_id text := 'apn-audit:cancelled-project-purged:' || gen_random_uuid()::text;
begin
  if not public.is_superadmin() then
    raise exception 'Only a Super Admin can delete cancelled commission projects.' using errcode = 'insufficient_privilege';
  end if;
  select * into p from public.apn_commission_projects where id = p_project_id for update;
  if not found then raise exception 'Commission project not found.' using errcode = 'no_data_found'; end if;
  if p.status <> 'Cancelled' then
    raise exception 'Only Cancelled commission projects can use this cleanup path.' using errcode = 'invalid_parameter_value';
  end if;

  -- Reverse referral ledger entries before their source earnings disappear.
  for v_earning in
    select e.id from public.apn_referral_earnings e
    where e.project_id = p_project_id
       or e.source_collection_id in (select id from public.apn_revenue_collections where project_id = p_project_id)
  loop
    for v_id in select l.id from public.apn_commission_ledger l
      where l.source_id = v_earning.id::text and l.source_type = 'referral'
        and l.amount > 0 and l.reversed_by is null
    loop
      perform public.apn_create_reversal(v_id, 'Cancelled APN commission project cleanup');
    end loop;
  end loop;

  -- Reverse collection commission entries before collections are deleted.
  for v_collection in
    select c.id from public.apn_revenue_collections c where c.project_id = p_project_id
  loop
    for v_id in select l.id from public.apn_commission_ledger l
      where l.source_id = v_collection.id::text and l.source_type = 'revenue_collection'
        and l.amount > 0 and l.reversed_by is null
    loop
      perform public.apn_create_reversal(v_id, 'Cancelled APN commission project cleanup');
    end loop;
  end loop;

  delete from public.apn_referral_snapshots s using public.apn_referral_earnings e
  where s.earning_id = e.id and (e.project_id = p_project_id or e.source_collection_id in
    (select id from public.apn_revenue_collections where project_id = p_project_id));
  delete from public.apn_referral_earnings e
  where e.project_id = p_project_id or e.source_collection_id in
    (select id from public.apn_revenue_collections where project_id = p_project_id);
  if to_regclass('public.crm_projects') is not null then
    update public.crm_projects set apn_project_id = null, updated_at = now() where apn_project_id = p_project_id;
  end if;
  delete from public.apn_revenue_collections where project_id = p_project_id;
  get diagnostics deleted_collections = row_count;
  delete from public.apn_commissions where data->>'projectId' = p_project_id;
  delete from public.transactions where data->>'apnProjectId' = p_project_id;
  get diagnostics deleted_transactions = row_count;
  delete from public.apn_timeline where data->>'relatedId' = p_project_id
    or id like '%:commission-project:' || p_project_id
    or id like '%:commission-project-completed:' || p_project_id;
  get diagnostics deleted_timeline = row_count;
  delete from public.apn_notifications where data->'metadata'->>'projectId' = p_project_id;
  get diagnostics deleted_notifications = row_count;
  delete from public.notifications where data->'metadata'->>'projectId' = p_project_id;
  delete from public.apn_commission_projects where id = p_project_id;
  get diagnostics deleted_project = row_count;
  perform public.apn_consolidated_wallet_refresh(p.partner_id);
  insert into public.audit(id, data, updated_at)
  values (audit_id, jsonb_build_object('id', audit_id, 'ts', (extract(epoch from now()) * 1000)::bigint,
    'user', coalesce(public.current_name(), 'Super Admin'), 'userId', auth.uid()::text,
    'action', 'purged cancelled APN commission project', 'module', 'APN',
    'entity', 'APN Commission Project', 'entityId', p_project_id,
    'metadata', jsonb_build_object('projectName', p.project_name, 'clientName', p.client_name,
      'partnerId', p.partner_id, 'projectValue', p.project_value,
      'reason', 'User-requested removal of cancelled commission project')),
    now());
  return jsonb_build_object('deleted', deleted_project = 1, 'projectId', p_project_id,
    'collectionsDeleted', deleted_collections, 'transactionsDeleted', deleted_transactions,
    'timelineDeleted', deleted_timeline, 'notificationsDeleted', deleted_notifications);
end;
$$;

revoke all on function public.apn_delete_cancelled_commission_project(text) from public, anon;
grant execute on function public.apn_delete_cancelled_commission_project(text) to authenticated;

commit;

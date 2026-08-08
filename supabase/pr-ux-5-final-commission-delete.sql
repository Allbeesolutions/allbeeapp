-- PR-UX-5 — canonical APN commission deletion.
-- Atomic, Super Admin only, finance-safe, and safe to rerun. The migration
-- changes functions only; it does not remove or rewrite production records.

begin;

create or replace function public.apn_delete_commission_project(
  p_project_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.apn_commission_projects%rowtype;
  collection_ids text[] := array[]::text[];
  referrer_ids text[] := array[]::text[];
  audit_id text := 'apn-audit:commission-project-deleted:' || gen_random_uuid()::text;
  timeline_id text := 'apn-timeline:commission-project-deleted:' || gen_random_uuid()::text;
  v_id text;
begin
  if not public.is_superadmin() then
    raise exception 'Only a Super Admin can delete commission projects.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_project_id), '') is null then
    raise exception 'A commission project id is required.' using errcode = 'invalid_parameter_value';
  end if;

  select * into project_row
  from public.apn_commission_projects
  where id = p_project_id
  for update;
  if not found then
    raise exception 'Commission project not found.' using errcode = 'no_data_found';
  end if;

  select coalesce(array_agg(c.id), array[]::text[])
  into collection_ids
  from public.apn_revenue_collections c
  where c.project_id = p_project_id;

  -- A posted accounting transaction is not an operational child row. It is a
  -- protected financial dependency and must be reversed/archived separately.
  if exists (
    select 1 from public.transactions t
    where t.data->>'apnProjectId' = p_project_id
  ) then
    raise exception 'This commission project has a protected financial transaction. Reverse or archive the finance entry before deleting the project.' using errcode = 'dependent_objects_still_exist';
  end if;
  if to_regclass('public.crm_revenue_collections') is not null
     and to_regclass('public.crm_projects') is not null
     and exists (
    select 1
    from public.crm_revenue_collections c
    join public.crm_projects p on p.id = c.project_id
    where p.apn_project_id = p_project_id
  ) then
    raise exception 'This commission project has protected CRM revenue records. Reverse or archive the CRM revenue before deleting the project.' using errcode = 'dependent_objects_still_exist';
  end if;
  if exists (
    select 1 from public.apn_referral_earnings e
    where e.project_id = p_project_id
      and e.status in ('approved', 'withdrawable', 'paid')
  ) then
    raise exception 'This commission project has approved or paid referral earnings. Reverse the referral settlement before deleting the project.' using errcode = 'dependent_objects_still_exist';
  end if;

  select coalesce(array_agg(distinct e.referrer_id), array[]::text[])
  into referrer_ids
  from public.apn_referral_earnings e
  where e.project_id = p_project_id;

  -- Remove only removable operational dependencies. Audit history is never
  -- deleted, and the deletion timeline event is written after cleanup.
  delete from public.apn_referral_snapshots s
  using public.apn_referral_earnings e
  where s.earning_id = e.id
    and (e.project_id = p_project_id or e.source_collection_id = any(collection_ids));
  delete from public.apn_referral_earnings e
  where e.project_id = p_project_id or e.source_collection_id = any(collection_ids);

  if to_regclass('public.crm_projects') is not null then
    update public.crm_projects
    set apn_project_id = null, updated_at = now()
    where apn_project_id = p_project_id;
  end if;

  delete from public.apn_revenue_collections where project_id = p_project_id;
  delete from public.apn_commissions where data->>'projectId' = p_project_id;
  delete from public.apn_timeline
  where data->>'relatedId' = p_project_id
     or id like '%:commission-project:' || p_project_id
     or id like '%:commission-project-completed:' || p_project_id;
  delete from public.apn_notifications where data->'metadata'->>'projectId' = p_project_id;
  delete from public.notifications where data->'metadata'->>'projectId' = p_project_id;
  delete from public.apn_commission_projects where id = p_project_id;

  foreach v_id in array referrer_ids loop
    perform public.apn_referral_refresh_wallet(v_id);
  end loop;

  insert into public.apn_timeline (id, data, updated_at)
  values (
    timeline_id,
    jsonb_build_object(
      'id', timeline_id,
      'partnerId', project_row.partner_id,
      'eventType', 'commission-project-deleted',
      'title', 'Commission Project Deleted',
      'description', format('%s · %s · %s was deleted by %s.', project_row.project_name, project_row.client_name, to_char(coalesce(nullif(project_row.data->>'commissionEarned', '')::numeric, 0), 'FM999G999G990D00'), coalesce(public.current_name(), 'Super Admin')),
      'relatedId', p_project_id,
      'performedBy', coalesce(public.current_name(), 'Super Admin'),
      'createdAt', (extract(epoch from now()) * 1000)::bigint
    ), now()
  );
  insert into public.audit (id, data, updated_at)
  values (
    audit_id,
    jsonb_build_object(
      'id', audit_id,
      'ts', (extract(epoch from now()) * 1000)::bigint,
      'user', coalesce(public.current_name(), 'Super Admin'),
      'userId', auth.uid()::text,
      'action', 'deleted APN commission project',
      'module', 'APN',
      'entity', 'APN Commission Project',
      'entityId', p_project_id,
      'metadata', jsonb_build_object(
        'projectName', project_row.project_name,
        'clientName', project_row.client_name,
        'partnerId', project_row.partner_id,
        'projectValue', project_row.project_value,
        'receivedAmount', project_row.total_received,
        'commissionAmount', coalesce(nullif(project_row.data->>'commissionEarned', '')::numeric, 0),
        'status', project_row.status,
        'reason', nullif(trim(coalesce(p_reason, '')), ''),
        'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0)
      )
    ), now()
  );
  return jsonb_build_object('deleted', true, 'projectId', p_project_id, 'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0));
end;
$$;

-- Keep the previous name working for existing clients, but route it through
-- the one canonical implementation so there is no second deletion path.
create or replace function public.delete_apn_commission_project(p_project_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.apn_delete_commission_project(p_project_id, null);
$$;

revoke all on function public.apn_delete_commission_project(text, text) from public;
grant execute on function public.apn_delete_commission_project(text, text) to authenticated;
revoke all on function public.delete_apn_commission_project(text) from public;
grant execute on function public.delete_apn_commission_project(text) to authenticated;

notify pgrst, 'reload schema';
commit;

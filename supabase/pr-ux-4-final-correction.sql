-- PR-UX-4 — final correction for APN deletion and durable admin badge read state.
-- Additive and safe to rerun. No operational or audit data is removed by this
-- migration; the delete RPC only runs when explicitly called by a Super Admin.

begin;

create table if not exists public.apn_action_badge_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'partner_pending', 'commission_pending', 'withdrawal_pending',
    'referral_pending', 'target_action', 'training_action',
    'material_action', 'notification_unread'
  )),
  seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_type)
);

create index if not exists apn_action_badge_reads_user_idx
  on public.apn_action_badge_reads (user_id, seen_at desc);

alter table public.apn_action_badge_reads enable row level security;
drop policy if exists apn_action_badge_reads_select on public.apn_action_badge_reads;
create policy apn_action_badge_reads_select
  on public.apn_action_badge_reads for select to authenticated
  using (user_id = auth.uid() and public.is_admin());
drop policy if exists apn_action_badge_reads_insert on public.apn_action_badge_reads;
create policy apn_action_badge_reads_insert
  on public.apn_action_badge_reads for insert to authenticated
  with check (user_id = auth.uid() and public.is_admin());
drop policy if exists apn_action_badge_reads_update on public.apn_action_badge_reads;
create policy apn_action_badge_reads_update
  on public.apn_action_badge_reads for update to authenticated
  using (user_id = auth.uid() and public.is_admin())
  with check (user_id = auth.uid() and public.is_admin());

create or replace function public.mark_apn_action_badge_seen(p_action_type text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_action text := lower(trim(coalesce(p_action_type, '')));
  v_seen_at timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'Only administrators can mark APN action badges as seen.' using errcode = 'insufficient_privilege';
  end if;
  if v_action not in (
    'partner_pending', 'commission_pending', 'withdrawal_pending',
    'referral_pending', 'target_action', 'training_action',
    'material_action', 'notification_unread'
  ) then
    raise exception 'Invalid APN action badge type.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.apn_action_badge_reads (user_id, action_type, seen_at, updated_at)
  values (auth.uid(), v_action, v_seen_at, v_seen_at)
  on conflict (user_id, action_type) do update
    set seen_at = excluded.seen_at, updated_at = excluded.updated_at;
  return jsonb_build_object('actionType', v_action, 'seenAt', v_seen_at);
end;
$$;

revoke all on table public.apn_action_badge_reads from anon;
grant select, insert, update on table public.apn_action_badge_reads to authenticated;
revoke all on function public.mark_apn_action_badge_seen(text) from public;
grant execute on function public.mark_apn_action_badge_seen(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'apn_action_badge_reads'
  ) then
    alter publication supabase_realtime add table public.apn_action_badge_reads;
  end if;
end;
$$;

create or replace function public.delete_apn_commission_project(p_project_id text)
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
  select * into project_row from public.apn_commission_projects where id = p_project_id for update;
  if not found then raise exception 'Commission project not found.' using errcode = 'no_data_found'; end if;
  select coalesce(array_agg(c.id), array[]::text[]) into collection_ids
  from public.apn_revenue_collections c where c.project_id = p_project_id;
  select coalesce(array_agg(distinct e.referrer_id), array[]::text[]) into referrer_ids
  from public.apn_referral_earnings e where e.project_id = p_project_id;

  delete from public.apn_referral_snapshots s
  using public.apn_referral_earnings e
  where s.earning_id = e.id and (e.project_id = p_project_id or e.source_collection_id = any(collection_ids));
  delete from public.apn_referral_earnings e
  where e.project_id = p_project_id or e.source_collection_id = any(collection_ids);

  if to_regclass('public.crm_revenue_collections') is not null then
    delete from public.crm_revenue_collections c
    where c.project_id in (select p.id from public.crm_projects p where p.apn_project_id = p_project_id);
  end if;
  if to_regclass('public.crm_projects') is not null then
    update public.crm_projects set apn_project_id = null, updated_at = now() where apn_project_id = p_project_id;
  end if;

  delete from public.transactions where data->>'apnProjectId' = p_project_id;
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

  -- Operational records are removed, but the immutable audit event and a
  -- durable timeline event remain so the deletion is traceable in the UI.
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
      'metadata', jsonb_build_object('projectName', project_row.project_name, 'partnerId', project_row.partner_id, 'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0))
    ), now()
  );
  return jsonb_build_object('deleted', true, 'projectId', p_project_id, 'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0));
end;
$$;

revoke all on function public.delete_apn_commission_project(text) from public;
grant execute on function public.delete_apn_commission_project(text) to authenticated;

notify pgrst, 'reload schema';
commit;

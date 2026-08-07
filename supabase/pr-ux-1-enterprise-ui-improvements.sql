-- PR-UX-1 — APN commission deletion, Finance/APN atomic income, and identity repair
--
-- This migration is intentionally not applied by the PR-UX-1 QA pass. It is
-- additive and data-preserving until an authorised production migration is
-- run. Operational writes happen only when the two audited RPCs are called.

begin;

create index if not exists transactions_apn_project_idx
  on public.transactions ((data->>'apnProjectId'))
  where data->>'apnProjectId' is not null;

-- Keep APN username login backed by the same identity used by the APN portal.
-- Existing APN profile usernames are repaired only when the canonical APN
-- username is unambiguous; no account is deleted or renamed by this pass.
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles p
set username = lower(trim(u.data->>'username'))
from public.apn_users u
where u.id = p.id::text
  and nullif(trim(u.data->>'username'), '') is not null
  and lower(trim(coalesce(p.username, ''))) <> lower(trim(u.data->>'username'))
  and not exists (
    select 1
    from public.profiles other
    where other.id <> p.id
      and lower(trim(coalesce(other.username, ''))) = lower(trim(u.data->>'username'))
  );

create or replace function public.username_to_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(p.email))
  from public.profiles p
  left join public.apn_users au on au.id = p.id::text
  where lower(trim(coalesce(p.username, au.data->>'username', ''))) = lower(trim(coalesce(p_username, '')))
    and nullif(trim(coalesce(p.email, '')), '') is not null
  order by p.created_at asc
  limit 1;
$$;

revoke all on function public.username_to_email(text) from public;
grant execute on function public.username_to_email(text) to anon, authenticated;

-- Finance-created APN commission projects are created as one transaction. The
-- project and collection rows use the normalized V4 columns through their
-- existing sync triggers; referral, wallet, timeline, notification, and audit
-- triggers therefore observe the canonical values.
create or replace function public.create_apn_income_transaction(
  p_transaction jsonb,
  p_project jsonb,
  p_collections jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id text := nullif(p_transaction->>'id', '');
  v_project_id text := nullif(p_project->>'id', '');
  v_partner_id text := nullif(p_project->>'partnerId', '');
  v_project_value numeric := greatest(0, coalesce(nullif(p_project->>'projectValue', '')::numeric, 0));
  v_rate numeric := coalesce(nullif(p_project->>'commissionRate', '')::numeric, 0);
  v_max numeric := round(v_project_value * v_rate / 100, 2);
  v_received numeric := 0;
  v_earned numeric := 0;
  v_status text;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_ids text[] := array[]::text[];
  v_normalized jsonb := '[]'::jsonb;
  v_project_payload jsonb;
  v_transaction_payload jsonb;
  item jsonb;
  normalized_item jsonb;
  v_id text;
  v_amount numeric;
  v_incentive numeric;
  v_commission numeric;
begin
  if not public.can_finance() then
    raise exception 'Only Finance users can create APN income entries.' using errcode = 'insufficient_privilege';
  end if;
  if v_transaction_id is null or v_project_id is null or v_partner_id is null then
    raise exception 'Finance transaction, APN project, and partner ids are required.' using errcode = 'check_violation';
  end if;
  if coalesce(p_transaction->>'kind', 'income') <> 'income' then
    raise exception 'An APN commission entry must be an income transaction.' using errcode = 'check_violation';
  end if;
  if nullif(trim(p_project->>'projectName'), '') is null or nullif(trim(p_project->>'clientName'), '') is null then
    raise exception 'Partner, project name, and client name are required.' using errcode = 'check_violation';
  end if;
  if v_project_value <= 0 or v_rate < 0 or v_rate > 100 then
    raise exception 'Project value must be positive and commission rate must be between 0 and 100.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(coalesce(p_collections, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_collections, '[]'::jsonb)) = 0 then
    raise exception 'At least one APN collection is required.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.transactions where id = v_transaction_id)
     or exists (select 1 from public.apn_commission_projects where id = v_project_id) then
    raise exception 'This finance or APN entry already exists.' using errcode = 'unique_violation';
  end if;
  if not exists (
    select 1 from public.apn_users u
    where u.id = v_partner_id
      and coalesce(u.data->>'status', 'pending') = 'active'
  ) then
    raise exception 'APN income requires an active partner.' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.apn_commission_projects p
    where coalesce(p.partner_id, p.data->>'partnerId') = v_partner_id
      and lower(trim(coalesce(p.project_name, p.data->>'projectName', p.data->>'project', ''))) = lower(trim(p_project->>'projectName'))
      and lower(trim(coalesce(p.client_name, p.data->>'clientName', ''))) = lower(trim(p_project->>'clientName'))
  ) then
    raise exception 'This partner already has a commission project with that name and client.' using errcode = 'unique_violation';
  end if;

  for item in select value from jsonb_array_elements(p_collections) loop
    v_id := nullif(item->>'id', '');
    if v_id is null or v_id = any(v_ids) then
      raise exception 'Each APN collection must have a unique id.' using errcode = 'unique_violation';
    end if;
    v_ids := array_append(v_ids, v_id);
    v_amount := coalesce(nullif(item->>'receivedAmount', '')::numeric, 0);
    if v_amount <= 0 then
      raise exception 'Collection amounts must be greater than zero.' using errcode = 'check_violation';
    end if;
    v_incentive := coalesce(nullif(item->>'incentive', '')::numeric, 0);
    if v_incentive < 0 then
      raise exception 'Incentives cannot be negative.' using errcode = 'check_violation';
    end if;
    if v_received + v_amount > v_project_value then
      raise exception 'Collections cannot exceed the project value.' using errcode = 'check_violation';
    end if;
    v_commission := least(greatest(0, v_max - v_earned), round(v_amount * v_rate / 100, 2));
    v_normalized := v_normalized || jsonb_build_array(
      item || jsonb_build_object(
        'projectId', v_project_id,
        'partnerId', v_partner_id,
        'receivedAmount', v_amount,
        'commissionGenerated', v_commission,
        'incentive', v_incentive,
        -- Collection status is canonicalised to the V4 constraint vocabulary;
        -- the UI may submit the project-level "Processing" label.
        'commissionStatus', case lower(trim(coalesce(item->>'commissionStatus', 'pending')))
          when 'approved' then 'Approved'
          when 'payable' then 'Payable'
          when 'paid' then 'Paid'
          else 'Pending'
        end,
        'createdBy', coalesce(item->>'createdBy', public.current_name()),
        'createdAt', coalesce(item->>'createdAt', v_now_ms::text),
        'receivedDate', coalesce(nullif(item->>'receivedDate', ''), current_date::text)
      )
    );
    v_received := v_received + v_amount;
    v_earned := v_earned + v_commission;
  end loop;

  v_status := case when v_received >= v_project_value then 'Completed' else 'Processing' end;
  v_project_payload := p_project || jsonb_build_object(
    'partnerId', v_partner_id,
    'projectValue', v_project_value,
    'commissionRate', v_rate,
    'maximumCommission', v_max,
    'totalReceived', round(v_received, 2),
    'remainingAmount', greatest(0, round(v_project_value - v_received, 2)),
    'remainingCommission', greatest(0, round(v_max - v_earned, 2)),
    'status', v_status,
    'createdAt', coalesce(p_project->>'createdAt', v_now_ms::text),
    'updatedAt', v_now_ms
  );

  -- This function is the single transaction boundary. Any trigger/RPC error
  -- aborts the whole call, including the finance entry.
  perform set_config('row_security', 'off', true);
  insert into public.apn_commission_projects (id, data, updated_at)
  values (v_project_id, v_project_payload, now());
  for normalized_item in select value from jsonb_array_elements(v_normalized) loop
    insert into public.apn_revenue_collections (id, data, updated_at)
    values (normalized_item->>'id', normalized_item, now());
  end loop;

  v_transaction_payload := p_transaction || jsonb_build_object(
    'kind', 'income',
    'amount', round(v_received, 2),
    'apnProjectId', v_project_id,
    'apnCollectionIds', to_jsonb(v_ids),
    'apnCollectionId', case when array_length(v_ids, 1) = 1 then v_ids[1] else null end,
    'createdAt', coalesce(p_transaction->>'createdAt', v_now_ms::text)
  );
  insert into public.transactions (id, data, updated_at)
  values (v_transaction_id, v_transaction_payload, now());

  insert into public.apn_timeline (id, data, updated_at)
  values (
    'apn-timeline:' || v_partner_id || ':finance-commission:' || v_project_id,
    jsonb_build_object('id', 'apn-timeline:' || v_partner_id || ':finance-commission:' || v_project_id,
      'partnerId', v_partner_id, 'eventType', 'finance-commission-created',
      'title', 'APN commission income recorded',
      'description', format('%s received for %s; commission %s.', to_char(v_received, 'FM999G999G990D00'), p_project->>'projectName', to_char(v_earned, 'FM999G999G990D00')),
      'relatedId', v_project_id, 'performedBy', coalesce(public.current_name(), 'Finance'), 'createdAt', v_now_ms), now()
  );
  insert into public.apn_notifications (id, data, updated_at)
  values (
    'apn-notification:commission-project:' || v_project_id,
    jsonb_build_object('id', 'apn-notification:commission-project:' || v_project_id,
      'title', 'Income recorded', 'body', format('%s received for %s. Commission credited: %s.', to_char(v_received, 'FM999G999G990D00'), p_project->>'projectName', to_char(v_earned, 'FM999G999G990D00')),
      'audience', 'partner:' || v_partner_id, 'partnerId', v_partner_id, 'level', 'Important', 'priority', 'Normal',
      'metadata', jsonb_build_object('projectId', v_project_id, 'transactionId', v_transaction_id),
      'senderName', coalesce(public.current_name(), 'ALLBEE'), 'senderDesignation', 'Finance', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
      'createdAt', v_now_ms, 'reads', '[]'::jsonb), now()
  );
  insert into public.notifications (id, data, updated_at)
  values (
    'apn-notification:commission-project:' || v_project_id,
    jsonb_build_object('id', 'apn-notification:commission-project:' || v_project_id,
      'title', 'Income recorded', 'body', format('%s received for %s.', to_char(v_received, 'FM999G999G990D00'), p_project->>'projectName'),
      'audience', 'partner:' || v_partner_id, 'partnerId', v_partner_id, 'module', 'APN', 'priority', 'Normal',
      'metadata', jsonb_build_object('projectId', v_project_id, 'transactionId', v_transaction_id),
      'senderName', coalesce(public.current_name(), 'ALLBEE'), 'senderDesignation', 'Finance', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
      'createdAt', v_now_ms, 'reads', '[]'::jsonb), now()
  );
  insert into public.audit (id, data, updated_at)
  values (
    'apn-audit:commission-project:' || v_project_id,
    jsonb_build_object('id', 'apn-audit:commission-project:' || v_project_id, 'ts', v_now_ms,
      'user', coalesce(public.current_name(), 'Finance'), 'userId', auth.uid()::text, 'action', 'recorded APN commission income',
      'module', 'Finance', 'entity', 'APN Commission Project', 'entityId', v_project_id,
      'metadata', jsonb_build_object('transactionId', v_transaction_id, 'partnerId', v_partner_id, 'amount', v_received, 'commission', v_earned)), now()
  );

  return jsonb_build_object('transactionId', v_transaction_id, 'projectId', v_project_id,
    'collectionIds', to_jsonb(v_ids), 'totalReceived', round(v_received, 2),
    'commissionEarned', round(v_earned, 2), 'status', v_status);
end;
$$;

revoke all on function public.create_apn_income_transaction(jsonb, jsonb, jsonb) from public;
grant execute on function public.create_apn_income_transaction(jsonb, jsonb, jsonb) to authenticated;

-- Secure deletion is Super Admin only. Finance links and normalized collection
-- history are removed atomically with the project. Global audit rows are not
-- deleted: the existing audit-hardening contract makes them immutable, so the
-- deletion itself is retained as the auditable final event.
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
  v_id text;
begin
  if not public.is_superadmin() then
    raise exception 'Only a Super Admin can delete commission projects.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_project_id), '') is null then
    raise exception 'A commission project id is required.' using errcode = 'invalid_parameter_value';
  end if;
  perform set_config('row_security', 'off', true);
  select * into project_row from public.apn_commission_projects where id = p_project_id for update;
  if not found then raise exception 'Commission project not found.' using errcode = 'no_data_found'; end if;
  select coalesce(array_agg(c.id), array[]::text[]) into collection_ids
  from public.apn_revenue_collections c where c.project_id = p_project_id;
  select coalesce(array_agg(distinct e.referrer_id), array[]::text[]) into referrer_ids
  from public.apn_referral_earnings e where e.project_id = p_project_id;

  -- Remove dependent referral snapshots before earnings because the snapshot
  -- foreign key is deliberately restrictive.
  delete from public.apn_referral_snapshots s
  using public.apn_referral_earnings e
  where s.earning_id = e.id and (e.project_id = p_project_id or e.source_collection_id = any(collection_ids));
  delete from public.apn_referral_earnings e
  where e.project_id = p_project_id or e.source_collection_id = any(collection_ids);

  -- CRM revenue rows are finance links to the APN project. Preserve the CRM
  -- project itself, but remove the stale APN link after its revenue rows go.
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

  insert into public.audit (id, data, updated_at)
  values (
    audit_id,
    jsonb_build_object('id', audit_id,
      'ts', (extract(epoch from now()) * 1000)::bigint, 'user', coalesce(public.current_name(), 'Super Admin'),
      'userId', auth.uid()::text, 'action', 'deleted APN commission project', 'module', 'APN',
      'entity', 'APN Commission Project', 'entityId', p_project_id,
      'metadata', jsonb_build_object('projectName', project_row.project_name, 'partnerId', project_row.partner_id,
        'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0))), now()
  );
  return jsonb_build_object('deleted', true, 'projectId', p_project_id,
    'collectionsDeleted', coalesce(array_length(collection_ids, 1), 0));
end;
$$;

revoke all on function public.delete_apn_commission_project(text) from public;
grant execute on function public.delete_apn_commission_project(text) to authenticated;

notify pgrst, 'reload schema';

commit;

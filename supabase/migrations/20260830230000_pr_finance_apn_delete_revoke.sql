-- Finance APN deletion must revoke the APN-side commission posting first.
-- The finance row is soft-deleted by the UI; this RPC performs the canonical
-- APN reversal, then notifies the partner that the income entry was revoked.

create or replace function public.apn_revoke_finance_income(p_transaction_id text, p_reason text default 'Finance income entry deleted')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_tx public.transactions%rowtype;
  v_project public.apn_commission_projects%rowtype;
  v_partner_id text;
  v_project_name text;
  v_client_name text;
  v_amount numeric := 0;
  v_commission numeric := 0;
  v_result jsonb;
  v_notification_id text := 'apn-notification:commission-revoked:' || gen_random_uuid()::text;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if not (public.is_admin() or public.can_finance()) then
    raise exception 'Only Finance users or administrators can revoke APN finance income entries.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(coalesce(p_transaction_id, '')), '') is null then
    raise exception 'Finance transaction id is required.' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_tx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Finance income entry not found.' using errcode = 'no_data_found';
  end if;
  if coalesce(v_tx.data->>'kind', '') <> 'income' or coalesce(v_tx.data->>'incomeSource', '') <> 'apn' then
    raise exception 'This finance entry is not an APN income entry.' using errcode = 'check_violation';
  end if;

  v_partner_id := nullif(v_tx.data->>'apnPartnerId', '');
  if v_partner_id is null then
    v_partner_id := nullif((select data->>'partnerId' from public.apn_commission_projects where id = v_tx.data->>'apnProjectId'), '');
  end if;
  if nullif(v_tx.data->>'apnProjectId', '') is null or v_partner_id is null then
    raise exception 'APN income entry is missing its project or partner.' using errcode = 'check_violation';
  end if;

  select * into v_project
  from public.apn_commission_projects
  where id = v_tx.data->>'apnProjectId'
  for update;

  if not found then
    raise exception 'The APN commission project for this finance entry was not found.' using errcode = 'no_data_found';
  end if;
  if v_project.status = 'Cancelled' then
    raise exception 'The APN commission project is already cancelled.' using errcode = 'duplicate_object';
  end if;

  v_project_name := coalesce(v_project.project_name, v_project.data->>'projectName', v_tx.data->>'project');
  v_client_name := coalesce(v_project.client_name, v_project.data->>'clientName', v_tx.data->>'client');
  v_amount := coalesce(nullif(v_tx.data->>'amount', '')::numeric, 0);
  select coalesce(nullif(data->>'amount', '')::numeric, 0) into v_commission
  from public.transactions
  where id = 'apn-expense:' || p_transaction_id;

  v_result := public.apn_commission_cancel_project(
    v_tx.data->>'apnProjectId',
    coalesce(nullif(trim(p_reason), ''), 'Finance income entry deleted')
  );

  insert into public.apn_notifications (id, data, updated_at)
  values (
    v_notification_id,
    jsonb_build_object(
      'id', v_notification_id,
      'title', 'Income entry revoked',
      'body', format('%s finance income for %s was deleted. APN commission %s has been reversed.',
        to_char(v_amount, 'FM999G999G990D00'), coalesce(v_project_name, 'the project'),
        to_char(abs(v_commission), 'FM999G999G990D00')),
      'audience', 'partner:' || v_partner_id,
      'partnerId', v_partner_id,
      'level', 'Important',
      'priority', 'High',
      'metadata', jsonb_build_object(
        'projectId', v_tx.data->>'apnProjectId',
        'transactionId', p_transaction_id,
        'status', 'Revoked',
        'reason', coalesce(nullif(trim(p_reason), ''), 'Finance income entry deleted'),
        'amount', v_amount,
        'commissionReversed', abs(v_commission)
      ),
      'senderName', coalesce(public.current_name(), 'ALLBEE'),
      'senderDesignation', 'Finance',
      'senderRole', 'System',
      'senderAvatar', '/allbee-icon.png',
      'createdAt', v_now_ms,
      'reads', '[]'::jsonb
    ),
    now()
  );

  insert into public.notifications (id, data, updated_at)
  values (
    v_notification_id,
    jsonb_build_object(
      'id', v_notification_id,
      'title', 'Income entry revoked',
      'body', format('%s finance income for %s was deleted and the APN commission was reversed.',
        to_char(v_amount, 'FM999G999G990D00'), coalesce(v_project_name, 'the project')),
      'audience', 'partner:' || v_partner_id,
      'partnerId', v_partner_id,
      'module', 'APN',
      'priority', 'High',
      'metadata', jsonb_build_object(
        'projectId', v_tx.data->>'apnProjectId',
        'transactionId', p_transaction_id,
        'status', 'Revoked',
        'reason', coalesce(nullif(trim(p_reason), ''), 'Finance income entry deleted')
      ),
      'senderName', coalesce(public.current_name(), 'ALLBEE'),
      'senderDesignation', 'Finance',
      'senderRole', 'System',
      'senderAvatar', '/allbee-icon.png',
      'createdAt', v_now_ms,
      'reads', '[]'::jsonb
    ),
    now()
  );

  return v_result || jsonb_build_object(
    'transactionId', p_transaction_id,
    'notificationId', v_notification_id,
    'status', 'Revoked'
  );
end;
$$;

revoke all on function public.apn_revoke_finance_income(text, text) from public, anon;
grant execute on function public.apn_revoke_finance_income(text, text) to authenticated;

select pg_notify('pgrst', 'reload schema');

-- Ensure collection distribution uses the owner-role ledger recorder.
-- The authenticated/admin-gated compatibility wrapper must never be used by
-- engine triggers, otherwise head distributions silently defer.
begin;

create or replace function public.apn_record_ledger_and_expense(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz,
  p_snapshot jsonb,
  p_eligible_from date default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.apn_ledger_record_owner(
    p_idempotency_key, p_source_id, p_source_type, p_partner_id,
    p_commission_type, p_base_amount, p_percent, p_amount, p_event_at,
    p_snapshot, p_eligible_from
  );
  v_id := nullif(v_result->>'id','')::uuid;
  if v_id is not null then
    begin
      perform public.apn_ensure_finance_expense(v_id);
    exception when others then
      perform public.apn_rule_audit(
        'finance deduction deferred', 'apn_commission_ledger', v_id::text,
        jsonb_build_object('error',SQLERRM,'commissionType',p_commission_type,'amount',p_amount)
      );
    end;
  end if;
  return v_result;
exception when others then
  begin
    perform public.apn_rule_audit(
      'ledger record deferred', 'apn_commission_ledger', p_idempotency_key,
      jsonb_build_object('error',SQLERRM,'sourceId',p_source_id,
        'commissionType',p_commission_type,'amount',p_amount,'partnerId',p_partner_id)
    );
  exception when others then null;
  end;
  return jsonb_build_object('id',null,'duplicate',false,'deferred',true,'error',SQLERRM);
end;
$$;

revoke all on function public.apn_record_ledger_and_expense(
  text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date
) from public, anon, authenticated;

-- Replay every qualifying historical collection. Idempotency prevents any
-- duplicate commission or finance expense for rows already reconciled.
do $$
declare
  c record;
  v_head text;
  v_rate numeric;
  v_amt numeric;
  v_eligible date;
  v_event timestamptz;
  v_name text;
  v_client text;
  v_project text;
  v_dist text;
  v_state text;
  v_result jsonb;
begin
  for c in select * from public.apn_revenue_collections
    where coalesce(received_amount,0) > 0 and coalesce(commission_generated,0) > 0
  loop
    v_head := public.apn_resolve_distribution_head(c.partner_id,'state_head');
    if v_head is null then continue; end if;
    if exists (select 1 from public.apn_commission_ledger l
      where l.idempotency_key='col:'||c.id||':state') then continue; end if;

    v_rate := coalesce(public.apn_commission_rate_for('state'),1);
    v_amt := round(c.received_amount*v_rate/100,2);
    if v_amt <= 0 then continue; end if;
    select p.project_name,p.client_name into v_project,v_client
      from public.apn_commission_projects p where p.id=c.project_id;
    select coalesce(u.data->>'name','APN Partner'),coalesce(u.data->>'district',''),coalesce(u.data->>'state','')
      into v_name,v_dist,v_state from public.apn_users u where u.id=c.partner_id;
    v_eligible := public.apn_commission_eligibility_date(c.received_date);
    v_event := coalesce(c.created_at,c.received_date::timestamptz,now());
    v_result := public.apn_record_ledger_and_expense(
      'col:'||c.id||':state',c.id,'revenue_collection',v_head,'state',
      c.received_amount,v_rate,v_amt,v_event,
      jsonb_build_object('projectId',c.project_id,'receivedDate',c.received_date::text,
        'sourcePartnerId',c.partner_id,'sourcePartnerName',v_name,'clientName',v_client,
        'projectName',v_project,'district',v_dist,'state',v_state,
        'recipientRole','state_head','recipientId',v_head,
        'scope','all-state-collections','source','commission-distribution-v4'),v_eligible);
  end loop;
end $$;

-- Recompute the affected head wallet from the authoritative ledger.
do $$
declare r record;
begin
  for r in select distinct partner_id from public.apn_commission_ledger
    where commission_type='state' and source_type='revenue_collection'
  loop
    perform public.apn_consolidated_wallet_refresh(r.partner_id);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;

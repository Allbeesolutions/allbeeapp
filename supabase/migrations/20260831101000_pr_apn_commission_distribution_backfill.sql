-- Backfill the distribution/finance guarantees for collections already in production.
-- Idempotent keys prevent duplicate credits and duplicate finance expenses.
begin;

do $$
declare
  c record;
  h record;
  v_rate numeric;
  v_amount numeric;
  v_partner_name text;
  v_client_name text;
  v_project_name text;
  v_district text;
  v_state text;
  v_event timestamptz;
  v_eligible date;
  l record;
begin
  -- Repair finance visibility for every positive engine credit first.
  for l in select id from public.apn_commission_ledger where amount > 0 loop
    begin perform public.apn_ensure_finance_expense(l.id); exception when others then null; end;
  end loop;

  -- Add any missing district/state 1% credits for historical collections.
  for c in select * from public.apn_revenue_collections where coalesce(received_amount,0) > 0 loop
    select p.commission_rate, p.project_name, p.client_name into v_rate, v_project_name, v_client_name
      from public.apn_commission_projects p where p.id = c.project_id;
    select coalesce(u.data->>'name','APN Partner'), coalesce(u.data->>'district',''), coalesce(u.data->>'state','')
      into v_partner_name, v_district, v_state from public.apn_users u where u.id = c.partner_id;
    v_event := coalesce(c.created_at, c.received_date::timestamptz, now());
    v_eligible := public.apn_commission_eligibility_date(c.received_date);
    select district_head_id, state_head_id into h from public.apn_hierarchy_assignments
      where partner_id = c.partner_id and status = 'active' limit 1;

    if h.district_head_id is not null and not exists (
      select 1 from public.apn_commission_ledger x where x.idempotency_key = 'col:'||c.id||':district'
    ) then
      v_amount := round(c.received_amount * coalesce(public.apn_commission_rate_for('district'),1) / 100,2);
      if v_amount > 0 then perform public.apn_record_ledger_and_expense(
        'col:'||c.id||':district', c.id, 'revenue_collection', h.district_head_id, 'district', c.received_amount,
        coalesce(public.apn_commission_rate_for('district'),1), v_amount, v_event,
        jsonb_build_object('projectId',c.project_id,'sourcePartnerId',c.partner_id,'sourcePartnerName',v_partner_name,
          'clientName',v_client_name,'projectName',v_project_name,'district',v_district,'state',v_state,
          'recipientRole','district_head','recipientId',h.district_head_id,'source','commission-distribution-v1-backfill'), v_eligible);
      end if;
    end if;

    if h.state_head_id is not null and not exists (
      select 1 from public.apn_commission_ledger x where x.idempotency_key = 'col:'||c.id||':state'
    ) then
      v_amount := round(c.received_amount * coalesce(public.apn_commission_rate_for('state'),1) / 100,2);
      if v_amount > 0 then perform public.apn_record_ledger_and_expense(
        'col:'||c.id||':state', c.id, 'revenue_collection', h.state_head_id, 'state', c.received_amount,
        coalesce(public.apn_commission_rate_for('state'),1), v_amount, v_event,
        jsonb_build_object('projectId',c.project_id,'sourcePartnerId',c.partner_id,'sourcePartnerName',v_partner_name,
          'clientName',v_client_name,'projectName',v_project_name,'district',v_district,'state',v_state,
          'recipientRole','state_head','recipientId',h.state_head_id,'scope','all-state-collections','source','commission-distribution-v1-backfill'), v_eligible);
      end if;
    end if;

    perform public.apn_consolidated_wallet_refresh(c.partner_id);
    if h.district_head_id is not null then perform public.apn_consolidated_wallet_refresh(h.district_head_id); end if;
    if h.state_head_id is not null then perform public.apn_consolidated_wallet_refresh(h.state_head_id); end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

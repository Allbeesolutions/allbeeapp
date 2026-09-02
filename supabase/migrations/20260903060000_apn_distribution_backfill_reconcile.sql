-- Reconcile missing 1% head distributions and refresh all affected wallets.
begin;
do $$
declare
 c record; h record; v_rate numeric; v_amt numeric; v_eligible date; v_event timestamptz; v_name text; v_client text; v_project text; v_dist text; v_state text;
begin
 for c in select * from public.apn_revenue_collections where coalesce(received_amount,0)>0 and coalesce(commission_generated,0)>0 loop
   select district_head_id,state_head_id into h from public.apn_hierarchy_assignments where partner_id=c.partner_id and status='active' limit 1;
   select coalesce(u.data->>'name','APN Partner'),coalesce(u.data->>'district',''),coalesce(u.data->>'state','') into v_name,v_dist,v_state from public.apn_users u where u.id=c.partner_id;
   select p.project_name,p.client_name into v_project,v_client from public.apn_commission_projects p where p.id=c.project_id;
   v_eligible:=public.apn_commission_eligibility_date(c.received_date); v_event:=coalesce(c.created_at,c.received_date::timestamptz,now());
   if h.district_head_id is not null and public.apn_valid_head_recipient(h.district_head_id,'district_head') and not exists(select 1 from public.apn_commission_ledger l where l.idempotency_key='col:'||c.id||':district') then
     v_rate:=coalesce(public.apn_commission_rate_for('district'),1); v_amt:=round(c.received_amount*v_rate/100,2);
     if v_amt>0 then perform public.apn_record_ledger_and_expense('col:'||c.id||':district',c.id,'revenue_collection',h.district_head_id,'district',c.received_amount,v_rate,v_amt,v_event,jsonb_build_object('projectId',c.project_id,'receivedDate',c.received_date::text,'sourcePartnerId',c.partner_id,'sourcePartnerName',v_name,'clientName',v_client,'projectName',v_project,'district',v_dist,'state',v_state,'recipientRole','district_head','recipientId',h.district_head_id,'scope','district-collections','source','commission-distribution-v2-backfill'),v_eligible); end if;
   end if;
   if h.state_head_id is not null and public.apn_valid_head_recipient(h.state_head_id,'state_head') and not exists(select 1 from public.apn_commission_ledger l where l.idempotency_key='col:'||c.id||':state') then
     v_rate:=coalesce(public.apn_commission_rate_for('state'),1); v_amt:=round(c.received_amount*v_rate/100,2);
     if v_amt>0 then perform public.apn_record_ledger_and_expense('col:'||c.id||':state',c.id,'revenue_collection',h.state_head_id,'state',c.received_amount,v_rate,v_amt,v_event,jsonb_build_object('projectId',c.project_id,'receivedDate',c.received_date::text,'sourcePartnerId',c.partner_id,'sourcePartnerName',v_name,'clientName',v_client,'projectName',v_project,'district',v_dist,'state',v_state,'recipientRole','state_head','recipientId',h.state_head_id,'scope','all-state-collections','source','commission-distribution-v2-backfill'),v_eligible); end if;
   end if;
 end loop;
end $$;

do $$ declare r record; begin
 for r in select distinct partner_id from public.apn_withdrawal_requests where partner_id is not null loop perform public.apn_consolidated_wallet_refresh(r.partner_id); end loop;
 for r in select distinct partner_id from public.apn_referral_withdrawals where partner_id is not null loop perform public.apn_consolidated_wallet_refresh(r.partner_id); end loop;
end $$;
notify pgrst,'reload schema';
commit;

-- Fix head-distribution recipient resolution for APN namespaces that predate
-- explicit hierarchy rows. Exact-role validation remains mandatory.
begin;

create or replace function public.apn_resolve_distribution_head(p_partner_id text, p_role text)
returns text
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_head text;
  v_count integer;
  v_district text;
  v_state text;
  v_namespace text;
begin
  if p_role not in ('district_head','state_head') then return null; end if;

  -- Explicit active hierarchy assignment is authoritative when present.
  if p_role = 'district_head' then
    select h.district_head_id into v_head
    from public.apn_hierarchy_assignments h
    where h.partner_id = p_partner_id and h.status = 'active'
      and h.district_head_id is not null
    limit 1;
  else
    select h.state_head_id into v_head
    from public.apn_hierarchy_assignments h
    where h.partner_id = p_partner_id and h.status = 'active'
      and h.state_head_id is not null
    limit 1;
  end if;

  if v_head is not null and public.apn_valid_head_recipient(v_head, p_role) then
    return v_head;
  end if;

  -- Legacy APN rows may not have an explicit hierarchy assignment. Resolve
  -- the sole valid head from the same geographic/APN namespace, then retain
  -- the exact-role DB guard before any money is booked.
  select coalesce(u.data->>'district',''), coalesce(u.data->>'state',''),
         split_part(upper(trim(coalesce(u.data->>'apnId',''))), '-', 2)
    into v_district, v_state, v_namespace
  from public.apn_users u where u.id = p_partner_id;

  if p_role = 'district_head' then
    select count(*), min(u.id) into v_count, v_head
    from public.apn_users u
    where coalesce(u.data->>'role','') = 'district_head'
      and coalesce(u.data->>'status','active') not in ('inactive','suspended','deleted','rejected','banned')
      and nullif(trim(v_district),'') is not null
      and lower(trim(coalesce(u.data->>'district',''))) = lower(trim(v_district));
  else
    if nullif(trim(v_state),'') is not null then
      select count(*), min(u.id) into v_count, v_head
      from public.apn_users u
      where coalesce(u.data->>'role','') = 'state_head'
        and coalesce(u.data->>'status','active') not in ('inactive','suspended','deleted','rejected','banned')
        and lower(trim(coalesce(u.data->>'state',''))) = lower(trim(v_state));
    else
      select count(*), min(u.id) into v_count, v_head
      from public.apn_users u
      where coalesce(u.data->>'role','') = 'state_head'
        and coalesce(u.data->>'status','active') not in ('inactive','suspended','deleted','rejected','banned')
        and nullif(trim(v_namespace),'') is not null
        and split_part(upper(trim(coalesce(u.data->>'apnId',''))), '-', 2) = v_namespace;
    end if;
  end if;

  if v_count = 1 and v_head is not null and public.apn_valid_head_recipient(v_head, p_role) then
    return v_head;
  end if;
  return null;
end;
$$;

revoke all on function public.apn_resolve_distribution_head(text,text) from public, anon;
grant execute on function public.apn_resolve_distribution_head(text,text) to authenticated;

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
begin
  for c in select * from public.apn_revenue_collections
    where coalesce(received_amount,0) > 0 and coalesce(commission_generated,0) > 0
  loop
    select p.project_name, p.client_name into v_project, v_client
    from public.apn_commission_projects p where p.id = c.project_id;
    select coalesce(u.data->>'name','APN Partner'), coalesce(u.data->>'district',''), coalesce(u.data->>'state','')
      into v_name, v_dist, v_state from public.apn_users u where u.id = c.partner_id;
    v_eligible := public.apn_commission_eligibility_date(c.received_date);
    v_event := coalesce(c.created_at, c.received_date::timestamptz, now());

    v_head := public.apn_resolve_distribution_head(c.partner_id, 'state_head');
    if v_head is not null and not exists (
      select 1 from public.apn_commission_ledger l
      where l.idempotency_key = 'col:' || c.id || ':state'
    ) then
      v_rate := coalesce(public.apn_commission_rate_for('state'), 1);
      v_amt := round(c.received_amount * v_rate / 100, 2);
      if v_amt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || c.id || ':state', c.id, 'revenue_collection', v_head, 'state',
          c.received_amount, v_rate, v_amt, v_event,
          jsonb_build_object('projectId',c.project_id,'receivedDate',c.received_date::text,
            'sourcePartnerId',c.partner_id,'sourcePartnerName',v_name,'clientName',v_client,
            'projectName',v_project,'district',v_dist,'state',v_state,'recipientRole','state_head',
            'recipientId',v_head,'scope','all-state-collections','source','commission-distribution-v3'),
          v_eligible);
      end if;
    end if;
  end loop;
end $$;

-- Refresh every wallet touched by the reconciliation.
do $$
declare r record;
begin
  for r in select distinct partner_id from public.apn_commission_ledger
    where commission_type='state' and source_type='revenue_collection' loop
    perform public.apn_consolidated_wallet_refresh(r.partner_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

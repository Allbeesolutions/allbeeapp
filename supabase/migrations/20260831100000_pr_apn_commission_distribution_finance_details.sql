-- APN commission distribution + automatic finance deduction + rich source snapshots
-- Partner earns their configured rate. Direct referral, district head and state head
-- each receive 1% of the same cash collection when their relationship applies.
-- Every positive engine credit also creates a deterministic APN expense in Finance.

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
  v_result := public.apn_ledger_record_safe(
    p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
    p_base_amount, p_percent, p_amount, p_event_at, p_snapshot, p_eligible_from);
  v_id := nullif(v_result->>'id', '')::uuid;
  if v_id is not null then
    begin
      perform public.apn_ensure_finance_expense(v_id);
    exception when others then
      perform public.apn_rule_audit('finance deduction deferred', 'apn_commission_ledger', v_id::text,
        jsonb_build_object('error', SQLERRM, 'commissionType', p_commission_type, 'amount', p_amount));
    end;
  end if;
  return v_result;
end;
$$;

revoke all on function public.apn_record_ledger_and_expense(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date) from public, anon, authenticated;

create or replace function public.apn_ledger_collection_after_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_rate numeric;
  v_dhead text;
  v_shead text;
  v_drate numeric;
  v_srate numeric;
  v_damt numeric;
  v_samt numeric;
  v_eligible date;
  v_event timestamptz;
  v_partner_name text;
  v_client_name text;
  v_project_name text;
  v_district text;
  v_state text;
begin
  if tg_op = 'DELETE' then
    if old.partner_id is not null then perform public.apn_consolidated_wallet_refresh(old.partner_id); end if;
    return old;
  end if;
  if new.partner_id is null or coalesce(new.received_amount, 0) <= 0 then return new; end if;
  v_eligible := public.apn_commission_eligibility_date(new.received_date);
  v_event := coalesce(new.created_at, new.received_date::timestamptz, now());
  select coalesce(u.data->>'name','APN Partner'), coalesce(u.data->>'district',''), coalesce(u.data->>'state','')
    into v_partner_name, v_district, v_state from public.apn_users u where u.id = new.partner_id;
  select p.project_name, p.client_name into v_project_name, v_client_name
    from public.apn_commission_projects p where p.id = new.project_id;

  if coalesce(new.commission_generated, 0) > 0 then
    select commission_rate into v_rate from public.apn_commission_projects where id = new.project_id;
    perform public.apn_record_ledger_and_expense(
      'col:' || new.id || ':partner', new.id, 'revenue_collection', new.partner_id, 'partner',
      new.received_amount, coalesce(v_rate, 0), new.commission_generated, v_event,
      jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
        'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
        'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
        'recipientRole', 'partner', 'source', 'commission-distribution-v1'), v_eligible);

    select district_head_id, state_head_id into v_dhead, v_shead
      from public.apn_hierarchy_assignments where partner_id = new.partner_id and status = 'active' limit 1;

    if v_dhead is not null then
      v_drate := coalesce(public.apn_commission_rate_for('district'), 1);
      v_damt := round(new.received_amount * v_drate / 100, 2);
      if v_damt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':district', new.id, 'revenue_collection', v_dhead, 'district',
          new.received_amount, v_drate, v_damt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'district_head', 'recipientId', v_dhead, 'source', 'commission-distribution-v1'), v_eligible);
      end if;
    end if;

    if v_shead is not null then
      v_srate := coalesce(public.apn_commission_rate_for('state'), 1);
      v_samt := round(new.received_amount * v_srate / 100, 2);
      if v_samt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':state', new.id, 'revenue_collection', v_shead, 'state',
          new.received_amount, v_srate, v_samt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'state_head', 'recipientId', v_shead, 'scope', 'all-state-collections',
            'source', 'commission-distribution-v1'), v_eligible);
      end if;
    end if;
  end if;

  perform public.apn_consolidated_wallet_refresh(new.partner_id);
  if v_dhead is not null then perform public.apn_consolidated_wallet_refresh(v_dhead); end if;
  if v_shead is not null then perform public.apn_consolidated_wallet_refresh(v_shead); end if;
  return new;
end;
$$;

drop trigger if exists apn_ledger_collection_trg on public.apn_revenue_collections;
create trigger apn_ledger_collection_trg
  after insert or update or delete on public.apn_revenue_collections
  for each row execute function public.apn_ledger_collection_after_change();

create or replace function public.apn_ledger_referral_after_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_eligible date;
  v_event timestamptz;
  v_referrer_name text;
  v_referred_name text;
  v_project_name text;
  v_client_name text;
begin
  if tg_op = 'DELETE' then
    if old.referrer_id is not null then perform public.apn_consolidated_wallet_refresh(old.referrer_id); end if;
    return old;
  end if;
  if new.status = 'void' or coalesce(new.referral_amount, 0) <= 0 then return new; end if;
  v_eligible := public.apn_commission_eligibility_date(new.collection_at::date);
  v_event := coalesce(new.created_at, new.collection_at, now());
  select coalesce(u.data->>'name','APN Partner') into v_referrer_name from public.apn_users u where u.id = new.referrer_id;
  select coalesce(u.data->>'name','APN Partner') into v_referred_name from public.apn_users u where u.id = new.referred_id;
  select p.project_name, p.client_name into v_project_name, v_client_name
    from public.apn_commission_projects p
    join public.apn_revenue_collections c on c.project_id = p.id
    where c.id = new.source_collection_id limit 1;
  perform public.apn_record_ledger_and_expense(
    'earn:' || new.id::text, new.id::text, 'referral', new.referrer_id, 'referral',
    new.revenue_amount, new.referral_percent, new.referral_amount, v_event,
    jsonb_build_object('collectionId', new.source_collection_id, 'relationshipId', new.relationship_id,
      'selfEarning', coalesce((new.snapshot->>'selfEarning')::boolean, false),
      'referrerId', new.referrer_id, 'referrerName', v_referrer_name,
      'referredId', new.referred_id, 'referredName', v_referred_name,
      'projectName', v_project_name, 'clientName', v_client_name,
      'recipientRole', 'referral_partner', 'source', 'commission-distribution-v1'), v_eligible);
  perform public.apn_consolidated_wallet_refresh(new.referrer_id);
  return new;
end;
$$;

drop trigger if exists apn_ledger_referral_trg on public.apn_referral_earnings;
create trigger apn_ledger_referral_trg
  after insert or update or delete on public.apn_referral_earnings
  for each row execute function public.apn_ledger_referral_after_change();

notify pgrst, 'reload schema';
commit;

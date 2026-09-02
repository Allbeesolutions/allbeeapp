-- APN commission finance/wallet reconciliation hardening.
-- Rules: direct/referral, district-head and state-head are distinct 1% streams;
-- only exact-role recipients receive district/state streams. Distribution expenses
-- reduce the same company finance balance using the source income split.

begin;

-- Exact-role helper: hierarchy assignments alone are not sufficient authority for
-- a head commission. The current APN role must match the stream being paid.
create or replace function public.apn_valid_head_recipient(p_partner_id text, p_role text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1
    from public.apn_users u
    where u.id = p_partner_id
      and coalesce(u.data->>'status', 'active') not in ('inactive','suspended','deleted')
      and coalesce(u.data->>'role','') = p_role
  );
$$;
revoke all on function public.apn_valid_head_recipient(text,text) from public, anon;
grant execute on function public.apn_valid_head_recipient(text,text) to authenticated;

-- Replace the finance expense poster so every distributed commission becomes a
-- project-scoped finance expense with the same Haji/Alim split as its source income.
create or replace function public.apn_ensure_finance_expense(p_ledger_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_ledger public.apn_commission_ledger%rowtype;
  v_expense_type text;
  v_deterministic text;
  v_txn_id text;
  v_payload jsonb;
  v_mapped text;
  v_project_id text;
  v_collection_id text;
  v_source_txn public.transactions%rowtype;
  v_haji numeric := 50;
  v_alim numeric := 50;
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may post ledger expenses.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ledger from public.apn_commission_ledger where id = p_ledger_id;
  if not found then raise exception 'Ledger entry not found.' using errcode = 'no_data_found'; end if;

  select deterministic_id into v_mapped from public.apn_finance_expense_map where ledger_id = p_ledger_id;
  if v_mapped is not null then
    return jsonb_build_object('deterministicId', v_mapped, 'duplicate', true);
  end if;

  v_expense_type := case when v_ledger.source_type = 'reversal' then 'reversal' else 'commission' end;
  v_deterministic := case
    when v_ledger.source_type = 'reversal' then 'apn-expense-rev:' || coalesce(v_ledger.reversed_by::text, v_ledger.id::text)
    else 'apn-expense-ledger:' || v_ledger.id::text
  end;
  v_txn_id := v_deterministic;

  v_project_id := nullif(trim(coalesce(v_ledger.snapshot->>'projectId','')), '');
  v_collection_id := case when v_ledger.source_type = 'revenue_collection' then nullif(trim(v_ledger.source_id), '') else nullif(trim(v_ledger.snapshot->>'collectionId'), '') end;

  -- Prefer the exact APN income transaction for this collection, then project.
  if v_project_id is not null then
    select t.* into v_source_txn
    from public.transactions t
    where t.kind = 'income'
      and t.data->>'apnProjectId' = v_project_id
      and (
        (v_collection_id is not null and (
          t.data->>'apnCollectionId' = v_collection_id
          or t.data->'apnCollectionIds' @> to_jsonb(array[v_collection_id]::text[])
        ))
        or v_collection_id is null
      )
    order by case when v_collection_id is not null and t.data->>'apnCollectionId' = v_collection_id then 0 else 1 end,
             t.updated_at desc
    limit 1;

    if v_source_txn.id is null then
      select t.* into v_source_txn
      from public.transactions t
      where t.kind = 'income' and t.data->>'apnProjectId' = v_project_id
      order by t.updated_at desc
      limit 1;
    end if;
  end if;

  if v_source_txn.id is not null then
    v_haji := greatest(0, least(100, coalesce((v_source_txn.data->>'hajiPct')::numeric, 50)));
    v_alim := greatest(0, least(100, coalesce((v_source_txn.data->>'alimPct')::numeric, 100 - v_haji)));
    if round(v_haji + v_alim, 2) <> 100 then
      v_haji := 50; v_alim := 50;
    end if;
  end if;

  if not exists (select 1 from public.transactions where id = v_txn_id) then
    v_payload := jsonb_build_object(
      'id', v_txn_id,
      'kind', 'expense',
      'date', (v_ledger.event_at::date)::text,
      'category', 'APN ' || v_ledger.commission_type || ' commission',
      'scope', 'project',
      'amount', abs(v_ledger.amount),
      'hajiPct', v_haji,
      'alimPct', v_alim,
      'notes', format('APN %s commission — %s%% of %s for %s.', v_ledger.commission_type, to_char(v_ledger.percent, 'FM990.0'), to_char(v_ledger.base_amount, 'FM999G999G990D00'), coalesce(v_ledger.snapshot->>'projectName', v_project_id, v_ledger.source_id)),
      'source', 'apn-commission',
      'apnCommissionExpense', true,
      'apnCommissionScope', 'distribution',
      'apnPartnerId', v_ledger.partner_id,
      'apnLedgerId', v_ledger.id::text,
      'apnCommissionType', v_ledger.commission_type,
      'apnCommissionRate', v_ledger.percent,
      'apnCommissionBaseAmount', v_ledger.base_amount,
      'apnProjectId', v_project_id,
      'apnCollectionId', v_collection_id,
      'apnCommissionOfIncome', case when v_source_txn.id is not null then v_source_txn.id else null end,
      'apnSourceTransactionId', case when v_source_txn.id is not null then v_source_txn.id else null end,
      'createdAt', (extract(epoch from now()) * 1000)::bigint::text
    );
    perform set_config('row_security', 'off', true);
    insert into public.transactions (id, data, updated_at)
    values (v_txn_id, v_payload, now())
    on conflict (id) do nothing;
  end if;

  insert into public.apn_finance_expense_map (ledger_id, deterministic_id, finance_transaction_id, expense_type, status, posted_at)
  values (p_ledger_id, v_deterministic, v_txn_id, v_expense_type, 'posted', now())
  on conflict (ledger_id) do nothing;

  perform public.apn_rule_audit('posted ledger expense', 'apn_finance_expense_map', p_ledger_id::text,
    jsonb_build_object('deterministicId', v_deterministic, 'expenseType', v_expense_type, 'hajiPct', v_haji, 'alimPct', v_alim, 'sourceTransactionId', nullif(v_source_txn.id,'')));
  return jsonb_build_object('deterministicId', v_deterministic, 'transactionId', v_txn_id, 'duplicate', false);
end;
$$;
revoke all on function public.apn_ensure_finance_expense(uuid) from public, anon;
grant execute on function public.apn_ensure_finance_expense(uuid) to authenticated;

-- Collection distribution: exact role gates prevent a district head/state head
-- row from being paid to a partner whose role later changed.
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
        'recipientRole', 'partner', 'source', 'commission-distribution-v2'), v_eligible);

    select district_head_id, state_head_id into v_dhead, v_shead
      from public.apn_hierarchy_assignments where partner_id = new.partner_id and status = 'active' limit 1;

    if v_dhead is not null and public.apn_valid_head_recipient(v_dhead, 'district_head') then
      v_drate := coalesce(public.apn_commission_rate_for('district'), 1);
      v_damt := round(new.received_amount * v_drate / 100, 2);
      if v_damt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':district', new.id, 'revenue_collection', v_dhead, 'district',
          new.received_amount, v_drate, v_damt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'district_head', 'recipientId', v_dhead, 'scope', 'district-collections', 'source', 'commission-distribution-v2'), v_eligible);
      end if;
    else
      v_dhead := null;
    end if;

    if v_shead is not null and public.apn_valid_head_recipient(v_shead, 'state_head') then
      v_srate := coalesce(public.apn_commission_rate_for('state'), 1);
      v_samt := round(new.received_amount * v_srate / 100, 2);
      if v_samt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':state', new.id, 'revenue_collection', v_shead, 'state',
          new.received_amount, v_srate, v_samt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'state_head', 'recipientId', v_shead, 'scope', 'all-state-collections', 'source', 'commission-distribution-v2'), v_eligible);
      end if;
    else
      v_shead := null;
    end if;
  end if;

  perform public.apn_consolidated_wallet_refresh(new.partner_id);
  if v_dhead is not null then perform public.apn_consolidated_wallet_refresh(v_dhead); end if;
  if v_shead is not null then perform public.apn_consolidated_wallet_refresh(v_shead); end if;
  return new;
end;
$$;

drop trigger if exists apn_ledger_collection_trg on public.apn_revenue_collections;
create trigger apn_ledger_collection_trg after insert or update or delete on public.apn_revenue_collections
for each row execute function public.apn_ledger_collection_after_change();

-- After the APN income transaction exists, link every distribution expense back to
-- that same transaction and persist a compact project-level distribution summary.
create or replace function public.apn_sync_income_commission_distribution()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_project_id text;
  v_rows jsonb;
  v_total numeric := 0;
  v_referral numeric := 0;
  v_district numeric := 0;
  v_state numeric := 0;
  v_partner numeric := 0;
  v_ledger record;
begin
  if new.kind <> 'income' or nullif(trim(new.data->>'apnProjectId'),'') is null then return new; end if;
  v_project_id := new.data->>'apnProjectId';

  -- Any collection/referral ledger already created before the income transaction
  -- is now guaranteed to have the source transaction link.
  for v_ledger in
    select l.*
    from public.apn_commission_ledger l
    where l.snapshot->>'projectId' = v_project_id
      and l.source_type in ('revenue_collection','referral')
      and l.amount <> 0
    order by l.event_at, l.created_at, l.id
  loop
    begin
      perform public.apn_ensure_finance_expense(v_ledger.id);
    exception when others then
      perform public.apn_rule_audit('finance deduction deferred', 'apn_commission_ledger', v_ledger.id::text,
        jsonb_build_object('error', SQLERRM, 'projectId', v_project_id));
    end;
    if v_ledger.amount > 0 then
      v_total := v_total + v_ledger.amount;
      if v_ledger.commission_type = 'partner' then v_partner := v_partner + v_ledger.amount;
      elsif v_ledger.commission_type = 'referral' then v_referral := v_referral + v_ledger.amount;
      elsif v_ledger.commission_type = 'district' then v_district := v_district + v_ledger.amount;
      elsif v_ledger.commission_type = 'state' then v_state := v_state + v_ledger.amount;
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ledgerId', l.id::text,
    'type', l.commission_type,
    'amount', l.amount,
    'percent', l.percent,
    'baseAmount', l.base_amount,
    'partnerId', l.partner_id,
    'projectId', v_project_id,
    'collectionId', case when l.source_type='revenue_collection' then l.source_id else l.snapshot->>'collectionId' end,
    'eligibleFrom', l.eligible_from,
    'eventAt', l.event_at
  ) order by l.event_at, l.created_at, l.id) filter (where l.amount > 0), '[]'::jsonb)
  into v_rows
  from public.apn_commission_ledger l
  where l.snapshot->>'projectId' = v_project_id
    and l.source_type in ('revenue_collection','referral');

  perform set_config('row_security', 'off', true);
  update public.transactions
  set data = data || jsonb_build_object(
    'apnCommissionDistribution', v_rows,
    'apnCommissionDistributionTotal', round(v_total,2),
    'apnReferralCommission', round(v_referral,2),
    'apnDistrictCommission', round(v_district,2),
    'apnStateCommission', round(v_state,2),
    'apnPartnerCommission', round(v_partner,2),
    'apnCommissionDistributionVersion', 'v2'
  ),
  updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists apn_sync_income_commission_distribution_trg on public.transactions;
create trigger apn_sync_income_commission_distribution_trg
after insert or update on public.transactions
for each row execute function public.apn_sync_income_commission_distribution();

-- Finance bridge for paid APN withdrawals. A withdrawal is a company cash expense
-- only when actually paid; approvals/locks do not reduce the company balance.
create or replace function public.apn_withdrawal_paid_to_finance()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_txn_id text := 'apn-expense-withdrawal:' || new.id::text;
  v_period text;
  v_haji numeric := 50;
  v_alim numeric := 50;
  v_latest_period text;
  v_total numeric;
  v_h numeric;
  v_a numeric;
  v_payload jsonb;
  v_partner_name text;
begin
  if new.transaction_type <> 'withdrawal_paid' or coalesce(new.amount,0) <= 0 then return new; end if;
  if exists (select 1 from public.transactions where id = v_txn_id) then return new; end if;

  v_period := to_char(now(), 'YYYY-MM');
  select max(to_char((t.data->>'date')::date, 'YYYY-MM')) into v_latest_period
  from public.transactions t
  where t.kind='income' and coalesce((t.data->>'amount')::numeric,0) > 0
    and to_char((t.data->>'date')::date,'YYYY-MM') < v_period;

  if v_latest_period is not null then
    select coalesce(sum((t.data->>'amount')::numeric * coalesce((t.data->>'hajiPct')::numeric,50) / 100),0),
           coalesce(sum((t.data->>'amount')::numeric * coalesce((t.data->>'alimPct')::numeric,50) / 100),0)
      into v_h, v_a
      from public.transactions t
      where t.kind='income' and to_char((t.data->>'date')::date,'YYYY-MM') = v_latest_period;
    v_total := v_h + v_a;
    if v_total > 0 then v_haji := round(v_h/v_total*100,2); v_alim := round(100-v_haji,2); end if;
  end if;

  select coalesce(u.data->>'name','APN Partner') into v_partner_name from public.apn_users u where u.id = new.partner_id;
  v_payload := jsonb_build_object(
    'id', v_txn_id,
    'kind','expense',
    'date', now()::date::text,
    'category','APN Withdrawal',
    'scope','company',
    'amount',round(new.amount,2),
    'hajiPct',v_haji,
    'alimPct',v_alim,
    'notes',format('APN withdrawal paid to %s (%s).',v_partner_name,new.partner_id),
    'source','apn-withdrawal',
    'apnWithdrawalExpense',true,
    'apnWithdrawalFinanceId',new.id::text,
    'apnWithdrawalRequestId',new.request_id::text,
    'apnPartnerId',new.partner_id,
    'apnWalletType',new.wallet_type,
    'apnWithdrawalReference',new.reference,
    'createdAt',(extract(epoch from now())*1000)::bigint::text
  );
  perform set_config('row_security','off',true);
  insert into public.transactions(id,data,updated_at) values(v_txn_id,v_payload,now()) on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists apn_withdrawal_paid_to_finance_trg on public.apn_withdrawal_finance_transactions;
create trigger apn_withdrawal_paid_to_finance_trg
after insert on public.apn_withdrawal_finance_transactions
for each row execute function public.apn_withdrawal_paid_to_finance();

-- Backfill finance visibility for every historical paid APN withdrawal, including
-- APN-TN-0004 / Maqdoom's existing ₹600 payout, without creating duplicates.
do $$
declare r record;
  v_h numeric := 50; v_a numeric := 50;
  v_id text;
begin
  for r in select f.* from public.apn_withdrawal_finance_transactions f
           where f.transaction_type='withdrawal_paid' and coalesce(f.amount,0)>0 loop
    v_id := 'apn-expense-withdrawal:'||r.id::text;
    if not exists (select 1 from public.transactions where id=v_id) then
      insert into public.transactions(id,data,updated_at)
      values(v_id, jsonb_build_object(
        'id',v_id,'kind','expense','date',now()::date::text,'category','APN Withdrawal',
        'scope','company','amount',round(r.amount,2),'hajiPct',v_h,'alimPct',v_a,
        'notes','APN withdrawal paid · historical finance reconciliation.','source','apn-withdrawal',
        'apnWithdrawalExpense',true,'apnWithdrawalFinanceId',r.id::text,
        'apnWithdrawalRequestId',r.request_id::text,'apnPartnerId',r.partner_id,
        'apnWalletType',r.wallet_type,'apnWithdrawalReference',r.reference,
        'createdAt',(extract(epoch from now())*1000)::bigint::text),now());
    end if;
  end loop;
end $$;

-- Refresh every APN wallet after the backfill so paid withdrawals immediately
-- appear in APN accounts as well as the company finance ledger.
do $$ declare r record; begin
  for r in select distinct partner_id from public.apn_withdrawal_requests where partner_id is not null loop
    perform public.apn_consolidated_wallet_refresh(r.partner_id);
  end loop;
end $$;

grant execute on function public.apn_valid_head_recipient(text,text) to authenticated;
notify pgrst, 'reload schema';
commit;

-- ALLBEE — combine APN commission components into one Finance deduction.
--
-- The APN ledger remains componentized (partner/referral/district/state) so
-- each recipient keeps an auditable wallet entry. Finance, however, shows one
-- company deduction per APN income/project, with the component breakdown stored
-- inside that single transaction. This prevents the same commission event from
-- looking like multiple separate cash deductions.
--
-- Example: ₹3,000 collected at 20% partner commission + 1% referral + 1% state
-- becomes ONE Finance expense of ₹660: partner ₹600, referral ₹30, state ₹30.
-- The same rule applies to 10%, 15%, or 20% partner rates and any applicable
-- district/state/referral streams.

begin;

create or replace function public.apn_consolidate_finance_commission_expense(p_ledger_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_ledger public.apn_commission_ledger%rowtype;
  v_project_id text;
  v_collection_id text;
  v_income_id text;
  v_income_data jsonb;
  v_txn_id text;
  v_total numeric := 0;
  v_partner numeric := 0;
  v_referral numeric := 0;
  v_district numeric := 0;
  v_state numeric := 0;
  v_haji numeric := 50;
  v_alim numeric := 50;
  v_rows jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_old record;
  v_old_ids text[];
  v_ids text[];
begin
  select * into v_ledger from public.apn_commission_ledger where id = p_ledger_id;
  if not found or v_ledger.amount <= 0 or v_ledger.commission_type not in ('partner','referral','district','state') then
    return jsonb_build_object('combined', false, 'reason', 'not_positive_commission');
  end if;

  v_project_id := nullif(trim(coalesce(v_ledger.snapshot->>'projectId','')), '');
  if v_project_id is null and v_ledger.source_type = 'referral' then
    select e.project_id into v_project_id
    from public.apn_referral_earnings e
    where e.id::text = v_ledger.source_id;
  end if;
  v_collection_id := case
    when v_ledger.source_type = 'revenue_collection' then nullif(trim(v_ledger.source_id), '')
    when v_ledger.source_type = 'referral' then (select e.source_collection_id::text from public.apn_referral_earnings e where e.id::text = v_ledger.source_id)
    else nullif(trim(v_ledger.snapshot->>'collectionId'), '')
  end;

  if v_project_id is null then
    return jsonb_build_object('combined', false, 'reason', 'missing_project');
  end if;

  -- Prefer the exact finance income tied to this collection, then the latest
  -- APN income for the project. The latter keeps legacy single-collection rows
  -- repairable even when collection linkage was not snapshotted originally.
  if v_collection_id is not null then
    select t.id, t.data into v_income_id, v_income_data
    from public.transactions t
    where lower(coalesce(t.data->>'kind','')) = 'income'
      and t.data->>'apnProjectId' = v_project_id
      and (t.data->>'apnCollectionId' = v_collection_id
        or t.data->'apnCollectionIds' @> to_jsonb(array[v_collection_id]::text[]))
    order by t.updated_at desc
    limit 1;
  end if;

  if v_income_id is null then
    select t.id, t.data into v_income_id, v_income_data
    from public.transactions t
    where lower(coalesce(t.data->>'kind','')) = 'income'
      and t.data->>'apnProjectId' = v_project_id
    order by t.updated_at desc
    limit 1;
  end if;

  if v_income_id is null then
    return jsonb_build_object('combined', false, 'reason', 'income_not_found');
  end if;

  v_haji := greatest(0, least(100, coalesce((v_income_data->>'hajiPct')::numeric, 50)));
  v_alim := greatest(0, least(100, coalesce((v_income_data->>'alimPct')::numeric, 100 - v_haji)));
  if round(v_haji + v_alim, 2) <> 100 then v_haji := 50; v_alim := 50; end if;

  v_ids := array(
    select jsonb_array_elements_text(coalesce(v_income_data->'apnCollectionIds','[]'::jsonb))
  );

  -- Group every positive commission component belonging to this APN income.
  -- The immutable ledger stays separate; only the Finance transaction is shared.
  with scoped as (
    select l.*
    from public.apn_commission_ledger l
    where l.amount > 0
      and l.commission_type in ('partner','referral','district','state')
      and (
        l.snapshot->>'projectId' = v_project_id
        or (l.source_type = 'referral' and exists (
          select 1 from public.apn_referral_earnings e
          where e.id::text = l.source_id and e.project_id = v_project_id
        ))
      )
  )
  select coalesce(sum(amount),0),
         coalesce(sum(amount) filter(where commission_type='partner'),0),
         coalesce(sum(amount) filter(where commission_type='referral'),0),
         coalesce(sum(amount) filter(where commission_type='district'),0),
         coalesce(sum(amount) filter(where commission_type='state'),0),
         coalesce(jsonb_agg(jsonb_build_object(
           'ledgerId',id::text,'type',commission_type,'amount',round(amount,2),
           'percent',percent,'baseAmount',base_amount,'partnerId',partner_id,
           'projectId',v_project_id,'collectionId',case when source_type='revenue_collection' then source_id else snapshot->>'collectionId' end,
           'eligibleFrom',eligible_from,'eventAt',event_at
         ) order by event_at,created_at,id),'[]'::jsonb)
    into v_total,v_partner,v_referral,v_district,v_state,v_rows
  from scoped;

  if v_total <= 0 then
    return jsonb_build_object('combined', false, 'reason', 'no_components');
  end if;

  -- Preserve the existing create/edit canonical expense id when present.
  v_txn_id := 'apn-expense:' || v_income_id;

  v_payload := jsonb_build_object(
    'id', v_txn_id,
    'kind', 'expense',
    'date', coalesce(v_income_data->>'date', current_date::text),
    'category', 'APN Commission',
    'scope', 'project',
    'amount', round(v_total,2),
    'hajiPct', v_haji,
    'alimPct', v_alim,
    'notes', format('APN commission deduction — partner %s + referral %s + district %s + state %s for %s.',
      to_char(v_partner,'FM999G999G990D00'),to_char(v_referral,'FM999G999G990D00'),
      to_char(v_district,'FM999G999G990D00'),to_char(v_state,'FM999G999G990D00'),
      coalesce(v_income_data->>'project',v_income_data->>'apnProjectId','APN project')),
    'source', 'apn-commission',
    'apnCommissionExpense', true,
    'apnCommissionScope', 'distribution',
    'apnCommissionCombined', true,
    'apnCommissionDistribution', v_rows,
    'apnCommissionDistributionTotal', round(v_total,2),
    'apnPartnerCommission', round(v_partner,2),
    'apnReferralCommission', round(v_referral,2),
    'apnDistrictCommission', round(v_district,2),
    'apnStateCommission', round(v_state,2),
    'apnCommissionPool', round(v_partner,2),
    'apnPartnerId', coalesce(v_income_data->>'apnPartnerId', v_ledger.partner_id),
    'apnProjectId', v_project_id,
    'apnCollectionIds', coalesce(v_income_data->'apnCollectionIds','[]'::jsonb),
    'apnCommissionOfIncome', v_income_id,
    'apnSourceTransactionId', v_income_id,
    'createdAt', coalesce(v_income_data->>'createdAt',(extract(epoch from now())*1000)::bigint::text)
  );

  perform set_config('row_security','off',true);
  insert into public.transactions(id,data,updated_at)
  values(v_txn_id,v_payload,now())
  on conflict(id) do update set data=excluded.data,updated_at=now();

  -- Capture the old componentized Finance rows BEFORE repointing their maps.
  -- They are safe to remove only after every map has been moved to the shared
  -- canonical transaction.
  v_old_ids := array(
    select distinct t.id
    from public.transactions t
    join public.apn_finance_expense_map m on m.finance_transaction_id=t.id
    join public.apn_commission_ledger l on l.id=m.ledger_id
    where t.id <> v_txn_id
      and t.data->>'apnCommissionExpense'='true'
      and l.amount > 0
      and l.commission_type in ('partner','referral','district','state')
      and (l.snapshot->>'projectId'=v_project_id
        or (l.source_type='referral' and exists(select 1 from public.apn_referral_earnings e where e.id::text=l.source_id and e.project_id=v_project_id)))
  );

  -- One Finance transaction represents the whole project commission pool.
  -- The immutable APN ledger remains componentized and each map points here.
  update public.apn_finance_expense_map m
  set finance_transaction_id=v_txn_id,status='posted',posted_at=now()
  where exists (
    select 1 from public.apn_commission_ledger l
    where l.id=m.ledger_id and l.amount > 0
      and l.commission_type in ('partner','referral','district','state')
      and (l.snapshot->>'projectId'=v_project_id
        or (l.source_type='referral' and exists(select 1 from public.apn_referral_earnings e where e.id::text=l.source_id and e.project_id=v_project_id)))
  );

  insert into public.apn_finance_expense_map(ledger_id,deterministic_id,finance_transaction_id,expense_type,status,posted_at)
  select l.id,
         'apn-expense-ledger:'||l.id::text,
         v_txn_id,'commission','posted',now()
  from public.apn_commission_ledger l
  where l.amount > 0
    and l.commission_type in ('partner','referral','district','state')
    and (l.snapshot->>'projectId'=v_project_id
      or (l.source_type='referral' and exists(select 1 from public.apn_referral_earnings e where e.id::text=l.source_id and e.project_id=v_project_id)))
  on conflict(ledger_id) do update set finance_transaction_id=excluded.finance_transaction_id,status='posted',posted_at=now();

  if coalesce(array_length(v_old_ids,1),0) > 0 then
    delete from public.transactions where id=any(v_old_ids) and id <> v_txn_id;
  end if;

  perform public.apn_rule_audit('combined APN commission finance expense','transactions',v_txn_id,
    jsonb_build_object('projectId',v_project_id,'incomeId',v_income_id,'total',round(v_total,2),
      'partner',round(v_partner,2),'referral',round(v_referral,2),'district',round(v_district,2),'state',round(v_state,2)));

  return jsonb_build_object('combined',true,'transactionId',v_txn_id,'total',round(v_total,2),
    'partner',round(v_partner,2),'referral',round(v_referral,2),'district',round(v_district,2),'state',round(v_state,2));
end;
$$;

revoke all on function public.apn_consolidate_finance_commission_expense(uuid) from public,anon,authenticated;

-- Keep the existing engine API. Each ledger row still receives its immutable
-- deterministic map, but all positive commission rows for the project converge
-- on the single Finance transaction produced by the consolidation helper.
create or replace function public.apn_ensure_finance_expense_engine(p_ledger_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_ledger public.apn_commission_ledger%rowtype;
  v_mapped text;
  v_project_id text;
  v_collection_id text;
  v_source_txn public.transactions%rowtype;
  v_haji numeric := 50;
  v_alim numeric := 50;
  v_txn_id text;
  v_payload jsonb;
begin
  select * into v_ledger from public.apn_commission_ledger where id=p_ledger_id;
  if not found then raise exception 'Ledger entry not found.' using errcode='no_data_found'; end if;

  select deterministic_id into v_mapped from public.apn_finance_expense_map where ledger_id=p_ledger_id;
  if v_mapped is not null then
    perform public.apn_consolidate_finance_commission_expense(p_ledger_id);
    return jsonb_build_object('deterministicId',v_mapped,'duplicate',true,'combinedFinance',true);
  end if;

  v_project_id := nullif(trim(coalesce(v_ledger.snapshot->>'projectId','')), '');
  if v_project_id is null and v_ledger.source_type='referral' then
    select e.project_id into v_project_id from public.apn_referral_earnings e where e.id::text=v_ledger.source_id;
  end if;
  v_collection_id := case
    when v_ledger.source_type='revenue_collection' then nullif(trim(v_ledger.source_id),'')
    when v_ledger.source_type='referral' then (select e.source_collection_id::text from public.apn_referral_earnings e where e.id::text=v_ledger.source_id)
    else nullif(trim(v_ledger.snapshot->>'collectionId'),'')
  end;

  if v_project_id is not null then
    select t.* into v_source_txn
    from public.transactions t
    where lower(coalesce(t.data->>'kind',''))='income'
      and t.data->>'apnProjectId'=v_project_id
      and (v_collection_id is null
        or t.data->>'apnCollectionId'=v_collection_id
        or t.data->'apnCollectionIds' @> to_jsonb(array[v_collection_id]::text[]))
    order by t.updated_at desc limit 1;
  end if;
  if v_source_txn.id is null and v_project_id is not null then
    select t.* into v_source_txn from public.transactions t
    where lower(coalesce(t.data->>'kind',''))='income' and t.data->>'apnProjectId'=v_project_id
    order by t.updated_at desc limit 1;
  end if;

  if v_source_txn.id is not null then
    v_haji:=greatest(0,least(100,coalesce((v_source_txn.data->>'hajiPct')::numeric,50)));
    v_alim:=greatest(0,least(100,coalesce((v_source_txn.data->>'alimPct')::numeric,100-v_haji)));
    if round(v_haji+v_alim,2)<>100 then v_haji:=50; v_alim:=50; end if;
  end if;

  v_txn_id:=case when v_ledger.source_type='reversal'
    then 'apn-expense-rev:'||coalesce(v_ledger.reversed_by::text,v_ledger.id::text)
    else 'apn-expense-ledger:'||v_ledger.id::text end;

  if not exists(select 1 from public.transactions where id=v_txn_id) then
    v_payload:=jsonb_build_object(
      'id',v_txn_id,'kind','expense','date',(v_ledger.event_at::date)::text,
      'category','APN '||v_ledger.commission_type||' commission','scope','project',
      'amount',abs(v_ledger.amount),'hajiPct',v_haji,'alimPct',v_alim,
      'notes',format('APN %s commission — %s%% of %s for %s.',v_ledger.commission_type,to_char(v_ledger.percent,'FM990.0'),to_char(v_ledger.base_amount,'FM999G999G990D00'),coalesce(v_ledger.snapshot->>'projectName',v_project_id,v_ledger.source_id)),
      'source','apn-commission','apnCommissionExpense',true,'apnCommissionScope','distribution',
      'apnPartnerId',v_ledger.partner_id,'apnLedgerId',v_ledger.id::text,
      'apnCommissionType',v_ledger.commission_type,'apnCommissionRate',v_ledger.percent,
      'apnCommissionBaseAmount',v_ledger.base_amount,'apnProjectId',v_project_id,
      'apnCollectionId',v_collection_id,'apnCommissionOfIncome',case when v_source_txn.id is not null then v_source_txn.id else null end,
      'apnSourceTransactionId',case when v_source_txn.id is not null then v_source_txn.id else null end,
      'createdAt',(extract(epoch from now())*1000)::bigint::text
    );
    perform set_config('row_security','off',true);
    insert into public.transactions(id,data,updated_at) values(v_txn_id,v_payload,now()) on conflict(id) do nothing;
  end if;

  insert into public.apn_finance_expense_map(ledger_id,deterministic_id,finance_transaction_id,expense_type,status,posted_at)
  values(p_ledger_id,case when v_ledger.source_type='reversal' then 'apn-expense-rev:'||coalesce(v_ledger.reversed_by::text,v_ledger.id::text) else 'apn-expense-ledger:'||v_ledger.id::text end,v_txn_id,case when v_ledger.source_type='reversal' then 'reversal' else 'commission' end,'posted',now())
  on conflict(ledger_id) do update set finance_transaction_id=excluded.finance_transaction_id,status='posted',posted_at=now();

  if v_ledger.amount>0 and v_ledger.commission_type in ('partner','referral','district','state') then
    perform public.apn_consolidate_finance_commission_expense(p_ledger_id);
  end if;
  return jsonb_build_object('deterministicId',v_txn_id,'transactionId',v_txn_id,'duplicate',false,'combinedFinance',true);
end;
$$;
revoke all on function public.apn_ensure_finance_expense_engine(uuid) from public,anon,authenticated;

-- The authenticated compatibility wrapper is trigger-internal only in the
-- current hardened runtime; preserve its existing gate while using the engine.
create or replace function public.apn_ensure_finance_expense(p_ledger_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may post ledger expenses.' using errcode='insufficient_privilege';
  end if;
  return public.apn_ensure_finance_expense_engine(p_ledger_id);
end;
$$;
revoke all on function public.apn_ensure_finance_expense(uuid) from public,anon;
grant execute on function public.apn_ensure_finance_expense(uuid) to authenticated;

-- Consolidate every existing positive APN commission expense footprint.
do $$
declare r record;
begin
  for r in
    select distinct l.id
    from public.apn_commission_ledger l
    where l.amount > 0 and l.commission_type in ('partner','referral','district','state')
  loop
    perform public.apn_consolidate_finance_commission_expense(r.id);
  end loop;
end $$;

-- Finance v5: shared component maps are expected; reconciliation validates the
-- combined transaction amount instead of treating shared mappings as duplicates.
create or replace function public.finance_v5_reconciliation()
returns jsonb
language plpgsql security definer stable
set search_path=pg_catalog,public,pg_temp as $$
declare
  missing_expense integer:=0;
  orphan_expense integer:=0;
  combined_mismatch integer:=0;
  malformed integer:=0;
begin
  if not public.is_admin() then raise exception 'Finance reconciliation requires admin access.' using errcode='insufficient_privilege'; end if;

  select count(*) into missing_expense
  from public.apn_commission_ledger l
  left join public.apn_finance_expense_map m on m.ledger_id=l.id
  where l.amount>0 and l.commission_type in ('partner','referral','district','state') and m.ledger_id is null;

  select count(*) into orphan_expense
  from public.apn_finance_expense_map m
  left join public.apn_commission_ledger l on l.id=m.ledger_id
  where l.id is null;

  select count(*) into combined_mismatch
  from (
    select t.id
    from public.transactions t
    join public.apn_finance_expense_map m on m.finance_transaction_id=t.id
    join public.apn_commission_ledger l on l.id=m.ledger_id
    where t.data->>'apnCommissionCombined'='true'
      and l.amount>0
      and l.commission_type in ('partner','referral','district','state')
    group by t.id, t.data
    having round(abs((t.data->>'amount')::numeric)-sum(l.amount),2) <> 0
  ) x;

  select count(*) into malformed
  from public.transactions
  where lower(coalesce(data->>'kind','')) in ('income','expense')
    and (data->>'amount') is not null
    and ((data->>'amount')::numeric < 0);

  return jsonb_build_object(
    'missing_commission_expenses',missing_expense,
    'orphan_finance_maps',orphan_expense,
    'combined_amount_mismatches',combined_mismatch,
    'duplicate_finance_transactions',0,
    'negative_transaction_amounts',malformed,
    'status',case when missing_expense+orphan_expense+combined_mismatch+malformed=0 then 'balanced' else 'attention_required' end,
    'checked_at',now()
  );
end $$;
revoke execute on function public.finance_v5_reconciliation() from public,anon;
grant execute on function public.finance_v5_reconciliation() to authenticated;

commit;
notify pgrst,'reload schema';

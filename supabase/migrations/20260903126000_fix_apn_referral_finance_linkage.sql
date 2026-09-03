-- Complete APN project-income reconciliation for referral ledger entries.
-- Referral ledger rows identify their collection through apn_referral_earnings;
-- resolve that collection's project before posting finance and project totals.
begin;

-- Extend the private finance engine's project lookup for referral rows.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_ensure_finance_expense_engine(uuid)'::regprocedure) into v_sql;
  v_sql := replace(v_sql,
    'v_project_id := nullif(trim(coalesce(v_ledger.snapshot->>''projectId'','''')), '''');',
    'v_project_id := nullif(trim(coalesce(v_ledger.snapshot->>''projectId'','''')), '''');
  if v_project_id is null and v_ledger.source_type = ''referral'' then
    select e.project_id into v_project_id from public.apn_referral_earnings e where e.id = v_ledger.source_id::uuid;
  end if;');
  execute v_sql;
end $$;

-- Extend the project-income distribution trigger so referral ledger rows are
-- included even when their immutable snapshot predates the projectId field.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_sync_income_commission_distribution()'::regprocedure) into v_sql;
  v_sql := replace(v_sql,
    'where l.snapshot->>''projectId'' = v_project_id',
    'where (l.snapshot->>''projectId'' = v_project_id or (l.source_type = ''referral'' and exists (select 1 from public.apn_referral_earnings e where e.id = l.source_id::uuid and e.project_id = v_project_id)))');
  execute v_sql;
end $$;

-- Repair the existing referral expense for the current ₹3,000 collection.
do $$
declare
  v_income text := 'msm44yyu-ss8cg';
  v_ledger uuid := 'e3fff792-6c3d-44c0-8830-f9c6b42b65d7';
  v_expense text := 'apn-expense-ledger:e3fff792-6c3d-44c0-8830-f9c6b42b65d7';
  v_data jsonb;
begin
  select data into v_data from public.transactions where id=v_income;
  if v_data is null then raise exception 'Source APN income transaction not found: %',v_income; end if;
  update public.transactions
  set data = data || jsonb_build_object(
    'amount',30,
    'hajiPct',coalesce((v_data->>'hajiPct')::numeric,50),
    'alimPct',coalesce((v_data->>'alimPct')::numeric,50),
    'apnCommissionExpense',true,
    'apnCommissionScope','distribution',
    'apnPartnerId',(select partner_id from public.apn_commission_ledger where id=v_ledger),
    'apnLedgerId',v_ledger::text,
    'apnCommissionType','referral',
    'apnCommissionRate',(select percent from public.apn_commission_ledger where id=v_ledger),
    'apnCommissionBaseAmount',(select base_amount from public.apn_commission_ledger where id=v_ledger),
    'apnProjectId',(select project_id from public.apn_referral_earnings where id=(select source_id::uuid from public.apn_commission_ledger where id=v_ledger)),
    'apnCollectionId',(select source_collection_id from public.apn_referral_earnings where id=(select source_id::uuid from public.apn_commission_ledger where id=v_ledger)),
    'apnCommissionOfIncome',v_income,
    'apnSourceTransactionId',v_income
  ), updated_at=now()
  where id=v_expense;

  perform public.apn_rule_audit('reconciled referral finance expense','transactions',v_expense,
    jsonb_build_object('ledgerId',v_ledger,'sourceIncome',v_income,'hajiPct',v_data->>'hajiPct','alimPct',v_data->>'alimPct'));

  -- Touch the source income so the repaired sync trigger writes its complete
  -- referral + state + partner distribution summary.
  update public.transactions set updated_at=now() where id=v_income;
end $$;

notify pgrst,'reload schema';
commit;

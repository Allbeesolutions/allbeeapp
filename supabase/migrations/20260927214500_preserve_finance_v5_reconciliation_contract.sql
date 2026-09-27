-- Preserve the Finance v5 UI response contract while keeping the corrected APN
-- collection source. The reconciliation RPC exposes detailed counters, while the
-- Accounts UI also requires the aggregate `exceptions` field.
create or replace function public.finance_v5_dashboard()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,pg_temp as $$
declare
  income numeric:=0; expense numeric:=0; apn_income numeric:=0;
  apn_ledger numeric:=0; apn_expense numeric:=0; paid_withdrawals numeric:=0;
  forecast_income numeric:=0; forecast_expense numeric:=0;
  recon jsonb; exceptions integer:=0;
  txn_income_count integer:=0; txn_expense_count integer:=0;
begin
  if not public.is_admin() then
    raise exception 'Finance dashboard requires admin access.' using errcode='insufficient_privilege';
  end if;

  select count(*) filter(where lower(coalesce(data->>'kind',''))='income'),
         count(*) filter(where lower(coalesce(data->>'kind',''))='expense'),
         coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='income'),0),
         coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='expense'),0)
    into txn_income_count,txn_expense_count,income,expense
    from public.transactions;

  select coalesce(sum(c.received_amount),0)
    into apn_income
    from public.apn_revenue_collections c
    join public.apn_commission_projects p on p.id=c.project_id
   where coalesce(p.status,'') <> 'Cancelled';

  select coalesce(sum(amount) filter(where amount>0 and commission_type in ('partner','referral','district','state')),0)
    into apn_ledger from public.apn_commission_ledger;

  select coalesce(sum((data->>'amount')::numeric),0)
    into apn_expense
    from public.transactions
   where lower(coalesce(data->>'kind',''))='expense'
     and coalesce(data->'apnCommissionExpense','false'::jsonb)='true'::jsonb;

  select coalesce(sum(amount),0)
    into paid_withdrawals
    from public.apn_withdrawal_finance_transactions
   where transaction_type='withdrawal_paid';

  select coalesce(sum(forecast_revenue),0),coalesce(sum(forecast_expenses),0)
    into forecast_income,forecast_expense
    from public.ai_forecast_v3 where period_type='forward';

  recon := public.finance_v5_reconciliation();
  exceptions :=
      coalesce((recon->>'missing_commission_expenses')::integer,0)
    + coalesce((recon->>'orphan_finance_maps')::integer,0)
    + coalesce((recon->>'duplicate_finance_transactions')::integer,0)
    + coalesce((recon->>'negative_transaction_amounts')::integer,0);
  recon := recon || jsonb_build_object(
    'exceptions', exceptions,
    'commission_ledger_to_expense_gap', round(apn_ledger-apn_expense,2)
  );

  return jsonb_build_object(
    'generated_at',now(),
    'transactions',jsonb_build_object(
      'income_count',txn_income_count,'expense_count',txn_expense_count,
      'income',round(income,2),'expenses',round(expense,2),'net',round(income-expense,2)),
    'apn',jsonb_build_object(
      'collections',round(apn_income,2),
      'positive_commission_ledger',round(apn_ledger,2),
      'commission_expenses',round(apn_expense,2),
      'paid_withdrawals',round(paid_withdrawals,2)),
    'forecast',jsonb_build_object(
      'revenue',round(forecast_income,2),'expenses',round(forecast_expense,2),
      'net',round(forecast_income-forecast_expense,2)),
    'reconciliation',recon);
end $$;

revoke execute on function public.finance_v5_dashboard() from public,anon;
grant execute on function public.finance_v5_dashboard() to authenticated;

notify pgrst,'reload schema';

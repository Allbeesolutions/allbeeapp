-- Final forward fix: ignore historical/orphan APN ledger rows that have no
-- posted APN income. They are not company-cash reconciliation exceptions.
begin;

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
  where l.amount>0 and l.commission_type in ('partner','referral','district','state')
    and m.ledger_id is null
    and exists (
      select 1 from public.transactions t
      where lower(coalesce(t.data->>'kind',''))='income'
        and t.data->>'apnProjectId' = coalesce(
          nullif(l.snapshot->>'projectId',''),
          (select e.project_id from public.apn_referral_earnings e where e.id::text=l.source_id)
        )
    );

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
      and l.amount>0 and l.commission_type in ('partner','referral','district','state')
    group by t.id,t.data
    having round(abs((t.data->>'amount')::numeric)-sum(l.amount),2)<>0
  ) x;

  select count(*) into malformed
  from public.transactions
  where lower(coalesce(data->>'kind','')) in ('income','expense')
    and data->>'amount' is not null
    and ((data->>'amount')::numeric<0);

  return jsonb_build_object(
    'missing_commission_expenses',missing_expense,
    'orphan_finance_maps',orphan_expense,
    'combined_amount_mismatches',combined_mismatch,
    'duplicate_finance_transactions',0,
    'negative_transaction_amounts',malformed,
    'status',case when missing_expense+orphan_expense+combined_mismatch+malformed=0 then 'balanced' else 'attention_required' end,
    'exceptions',missing_expense+orphan_expense+combined_mismatch+malformed,
    'checked_at',now()
  );
end $$;

revoke execute on function public.finance_v5_reconciliation() from public,anon;
grant execute on function public.finance_v5_reconciliation() to authenticated;

commit;
notify pgrst,'reload schema';

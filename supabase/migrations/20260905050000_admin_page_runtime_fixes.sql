-- Admin page runtime/data fixes discovered during production route smoke.
-- 1) Finance dashboard must not UNION uuid transaction ids with text ids.
-- 2) CRM dashboard CTEs are statement-scoped; each query gets its own calc CTE.

create or replace function public.finance_v5_dashboard()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,pg_temp as $$
declare
  income numeric:=0; expense numeric:=0; apn_income numeric:=0;
  apn_ledger numeric:=0; apn_expense numeric:=0; paid_withdrawals numeric:=0;
  forecast_income numeric:=0; forecast_expense numeric:=0;
  missing_commission integer:=0; orphan_expense integer:=0; duplicate_expense integer:=0;
  exceptions integer:=0; txn_income_count integer:=0; txn_expense_count integer:=0;
begin
  if not public.is_admin() then
    raise exception 'Finance dashboard requires admin access.' using errcode='insufficient_privilege';
  end if;
  select count(*) filter(where lower(coalesce(data->>'kind',''))='income'),
         count(*) filter(where lower(coalesce(data->>'kind',''))='expense'),
         coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='income'),0),
         coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='expense'),0)
    into txn_income_count,txn_expense_count,income,expense from public.transactions;
  select coalesce(sum(received_amount),0) into apn_income
    from public.crm_revenue_collections where status<>'Cancelled';
  select coalesce(sum(amount) filter(where amount>0 and commission_type in ('partner','referral','district','state')),0)
    into apn_ledger from public.apn_commission_ledger;
  select coalesce(sum((data->>'amount')::numeric),0) into apn_expense
    from public.transactions where lower(coalesce(data->>'kind',''))='expense'
      and coalesce(data->'apnCommissionExpense','false'::jsonb)='true'::jsonb;
  select coalesce(sum(amount),0) into paid_withdrawals
    from public.apn_withdrawal_finance_transactions where transaction_type='withdrawal_paid';
  select coalesce(sum(forecast_revenue),0),coalesce(sum(forecast_expenses),0)
    into forecast_income,forecast_expense from public.ai_forecast_v3 where period_type='forward';
  select count(*) into missing_commission from public.apn_commission_ledger l
    left join public.apn_finance_expense_map m on m.ledger_id=l.id
    where l.amount>0 and l.commission_type in ('partner','referral','district','state') and m.ledger_id is null;
  select count(*) into orphan_expense from public.apn_finance_expense_map m
    left join public.apn_commission_ledger l on l.id=m.ledger_id where l.id is null;
  select count(*) into duplicate_expense from (
    select finance_transaction_id from public.apn_finance_expense_map
    where finance_transaction_id is not null group by finance_transaction_id having count(*)>1
  ) x;
  exceptions:=missing_commission+orphan_expense+duplicate_expense;
  return jsonb_build_object('generated_at',now(),
    'transactions',jsonb_build_object('income_count',txn_income_count,'expense_count',txn_expense_count,'income',round(income,2),'expenses',round(expense,2),'net',round(income-expense,2)),
    'apn',jsonb_build_object('collections',round(apn_income,2),'positive_commission_ledger',round(apn_ledger,2),'commission_expenses',round(apn_expense,2),'paid_withdrawals',round(paid_withdrawals,2)),
    'forecast',jsonb_build_object('revenue',round(forecast_income,2),'expenses',round(forecast_expense,2),'net',round(forecast_income-forecast_expense,2)),
    'reconciliation',jsonb_build_object('exceptions',exceptions,'commission_ledger_to_expense_gap',round(apn_ledger-apn_expense,2),'status',case when exceptions=0 then 'balanced' else 'attention_required' end));
end $$;

revoke execute on function public.finance_v5_dashboard() from public,anon;
grant execute on function public.finance_v5_dashboard() to authenticated;

create or replace function public.crm_v5_dashboard()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,pg_temp as $$
declare stages jsonb; top_leads jsonb; open_value numeric:=0; weighted numeric:=0; won_value numeric:=0;
  active_count integer:=0; total_count integer:=0; customer_count integer:=0;
begin
  if not public.crm_can_manage() and not public.is_admin() then
    raise exception 'CRM dashboard access denied.' using errcode='insufficient_privilege';
  end if;
  with calc as (
    select l.*, (public.crm_v5_score_lead(l.id)->>'win_probability')::numeric as win_probability
    from public.crm_leads l where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)
  )
  select coalesce(jsonb_agg(jsonb_build_object('stage',x.status,'count',x.n,'value',x.value,'weighted_value',x.weighted)
    order by array_position(array['New','Assigned','Contacted','Follow-up','Interested','Quotation Sent','Negotiation','Won','Lost','On Hold','Cancelled','Converted','Closed'],x.status)),'[]'::jsonb)
    into stages from (select status,count(*) n,coalesce(sum(expected_budget),0) value,
      coalesce(sum(case when status not in ('Won','Lost','Cancelled','Converted','Closed') then expected_budget*win_probability/100 else expected_budget end),0) weighted
      from calc group by status) x;
  with calc as (
    select l.*, (public.crm_v5_score_lead(l.id)->>'win_probability')::numeric as win_probability
    from public.crm_leads l where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)
  )
  select coalesce(sum(expected_budget),0),coalesce(sum(case when status not in ('Won','Lost','Cancelled','Converted','Closed') then expected_budget*win_probability/100 else 0 end),0),
    coalesce(sum(case when status in ('Won','Converted','Closed') then expected_budget else 0 end),0),
    count(*) filter(where status not in ('Won','Lost','Cancelled','Converted','Closed')),count(*)
    into open_value,weighted,won_value,active_count,total_count from calc;
  with scoped as (
    select l.* from public.crm_leads l
    where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)
  )
  select count(*) into customer_count from (
    select distinct coalesce(nullif(lower(trim(email)),''),nullif(regexp_replace(mobile,'[^0-9]','','g'),''),nullif(lower(trim(company)),''),id::text) key
    from scoped
  ) c;
  with scored as (
    select s.id,s.lead_number,s.customer_name,s.company,s.status,s.priority,s.expected_budget,s.expected_closing_date,
      public.crm_v5_score_lead(s.id) intel from public.crm_leads s
    where public.crm_can_read(s.assigned_employee_id,s.assigned_partner_id,s.district,s.state)
      and s.status not in ('Won','Lost','Cancelled','Converted','Closed')
    order by s.expected_budget desc limit 25
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'lead_number',lead_number,'customer_name',customer_name,'company',company,'status',status,
    'priority',priority,'expected_budget',expected_budget,'expected_closing_date',expected_closing_date,'score',(intel->>'score')::integer,
    'win_probability',(intel->>'win_probability')::integer,'lost_risk',(intel->>'lost_risk')::integer,'next_action',intel->>'next_action'
    ) order by (intel->>'win_probability')::integer desc,expected_budget desc),'[]'::jsonb) into top_leads from scored;
  return jsonb_build_object('generated_at',now(),'stages',stages,
    'forecast',jsonb_build_object('open_pipeline',round(open_value,2),'weighted_pipeline',round(weighted,2),'won_value',round(won_value,2),
      'active_leads',active_count,'total_leads',total_count,'customers',customer_count),'top_leads',top_leads);
end $$;

revoke execute on function public.crm_v5_dashboard() from public,anon;
grant execute on function public.crm_v5_dashboard() to authenticated;

notify pgrst,'reload schema';

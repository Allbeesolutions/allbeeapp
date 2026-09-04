begin;
create or replace function public.ai_intelligence_v5_dashboard()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare
 nextf record; actual numeric:=0; expense numeric:=0; pipe numeric:=0; win numeric:=0; comm numeric:=0; overdue bigint:=0; data_quality text; next_rev numeric:=0; next_exp numeric:=0; next_cash numeric:=0; recs jsonb;
begin
 if not public.ai_can_read() then raise exception 'AI intelligence access denied.' using errcode='insufficient_privilege'; end if;
 select * into nextf from public.ai_forecast_v3 where period_type='forward' order by month_start limit 1;
 select coalesce(sum((data->>'amount')::numeric),0) into actual from public.transactions where lower(coalesce(data->>'kind',''))='income';
 select coalesce(sum((data->>'amount')::numeric),0) into expense from public.transactions where lower(coalesce(data->>'kind',''))='expense';
 select coalesce(sum(pipeline_value),0),coalesce(avg(nullif(conversion_pct,0)),0) into pipe,win from public.ai_partner_scores;
 select coalesce(sum(amount),0) into comm from public.apn_commission_ledger where event_at>=now()-interval '30 days' and commission_type in ('partner','referral','district','state') and amount>0;
 select count(*) into overdue from public.crm_leads where lower(coalesce(status,'')) not in ('won','lost','cancelled','converted','closed') and coalesce(updated_at,created_at)<now()-interval '14 days';
 next_rev:=coalesce(nextf.forecast_revenue,0); next_exp:=coalesce(nextf.forecast_expenses,0); next_cash:=next_rev-next_exp-comm;
 data_quality:=case when (select count(*) from public.ai_finance_forecast where revenue<>0 or expenses<>0)>=3 then 'usable_finance_history' else 'low_finance_history' end;
 recs:=jsonb_build_array(
  jsonb_build_object('priority',case when overdue>0 then 'High' else 'Low' end,'title','Protect conversion','detail',case when overdue>0 then format('%s leads are stale; prioritize follow-up and owner reassignment.',overdue) else 'No stale active leads require escalation.' end),
  jsonb_build_object('priority',case when pipe>0 then 'Medium' else 'Low' end,'title','Convert pipeline','detail',case when pipe>0 then format('Partner pipeline is %s; improve follow-up coverage before increasing acquisition spend.',round(pipe,2)) else 'No measurable partner pipeline is currently available; avoid unsupported acquisition conclusions.' end),
  jsonb_build_object('priority',case when data_quality='low_finance_history' then 'Low' else 'Medium' end,'title','Protect cash','detail',case when data_quality='low_finance_history' then 'Cash forecast is provisional because finance history is limited.' else format('Next-period cash contribution is projected at %s after forecast expenses and recent positive commissions.',round(next_cash,2)) end)
 );
 return jsonb_build_object('generated_at',now(),'data_quality',data_quality,'actual_revenue_to_date',actual,'actual_expenses_to_date',expense,'predictive_revenue',next_rev,'cash_flow_forecast',next_cash,'commission_forecast',round(comm*1.08,2),'pipeline',pipe,'win_rate',round(win,2),'overdue_leads',overdue,'lead_predictions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.win_probability desc),'[]'::jsonb) from (select id,lead_number,customer_name,ai_lead_score,win_probability,lost_risk,next_action from public.ai_lead_scores where lower(coalesce(status,'')) not in ('won','lost','cancelled','converted','closed') limit 50)x),'partner_predictions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.performance_score desc),'[]'::jsonb) from (select partner_id,partner_name,performance_score,growth_score,health_score,risk_score,revenue,pipeline_value,conversion_pct,trend_summary from public.ai_partner_scores limit 50)x),'finance_forecast',(select coalesce(jsonb_agg(to_jsonb(x) order by x.month_start),'[]'::jsonb) from (select month_start,revenue,expenses,profit,forecast_revenue,forecast_expenses,forecast_profit,collections,pending_revenue from public.ai_forecast_v3 limit 12)x),'recommendations',recs);
end $$;
revoke execute on function public.ai_intelligence_v5_dashboard() from public,anon; grant execute on function public.ai_intelligence_v5_dashboard() to authenticated;

create or replace function public.ai_intelligence_v5_validation()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare h jsonb; periods integer; past integer; lead_count integer; partner_count integer; commission numeric; income numeric; expense numeric; collection numeric;
begin
 if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
 select public.ai_intelligence_v5_dashboard() into h;
 select count(*),count(*) filter(where month_start<date_trunc('month',current_date)::date) into periods,past from public.ai_finance_forecast where forecast_revenue is not null;
 select count(*) into lead_count from public.ai_lead_scores where lower(coalesce(status,'')) not in ('won','lost','cancelled','converted','closed');
 select count(*) into partner_count from public.ai_partner_scores;
 select coalesce(sum(amount),0) into commission from public.apn_commission_ledger where commission_type in ('partner','referral','district','state') and amount>0;
 select coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='income'),0),coalesce(sum((data->>'amount')::numeric) filter(where lower(coalesce(data->>'kind',''))='expense'),0) into income,expense from public.transactions;
 select coalesce(sum(received_amount),0) into collection from public.crm_revenue_collections where status<>'Cancelled';
 return jsonb_build_object('status','certification_snapshot','dashboard',h,'forecast_periods',periods,'historical_periods',past,'active_leads',lead_count,'partners',partner_count,'positive_commissions',commission,'transaction_income',income,'transaction_expense',expense,'crm_collections',collection,'insufficient_lead_data',lead_count=0,'insufficient_collection_data',collection=0,'measured_at',now());
end $$;
revoke execute on function public.ai_intelligence_v5_validation() from public,anon; grant execute on function public.ai_intelligence_v5_validation() to authenticated;
commit;
notify pgrst,'reload schema';

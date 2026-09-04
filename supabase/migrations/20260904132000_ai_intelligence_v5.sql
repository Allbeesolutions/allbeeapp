begin;
create or replace function public.ai_intelligence_v5_dashboard() returns jsonb language plpgsql security definer stable set search_path=public as $$
declare rev numeric; exp numeric; pipe numeric; win numeric; next_rev numeric; next_cash numeric; comm numeric; overdue bigint; recs jsonb;
begin
 if not public.ai_can_read() then raise exception 'AI intelligence access denied.' using errcode='insufficient_privilege'; end if;
 select coalesce(sum(revenue),0),coalesce(sum(expenses),0) into rev,exp from public.ai_finance_forecast where month_start>=date_trunc('month',current_date)-interval '2 months' and month_start<=date_trunc('month',current_date);
 select coalesce(sum(pipeline_value),0),coalesce(avg(conversion_pct),0) into pipe,win from public.ai_partner_scores;
 select coalesce(sum(amount),0) into comm from public.apn_commission_ledger where event_at>=now()-interval '30 days' and commission_type in ('partner','referral','district','state') and amount>0;
 select count(*) into overdue from public.crm_leads where status not in ('won','lost','closed') and coalesce(updated_at,created_at)<now()-interval '14 days';
 next_rev:=round(greatest(0,rev/3)*1.08+pipe*greatest(0,win)/100,2); next_cash:=round(next_rev-exp/3-comm,2);
 recs:=jsonb_build_array(
  jsonb_build_object('priority',case when overdue>0 then 'High' else 'Medium' end,'title','Protect conversion','detail',format('%s leads are stale; prioritize follow-up and owner reassignment.',overdue)),
  jsonb_build_object('priority',case when pipe>0 then 'Medium' else 'Low' end,'title','Convert pipeline','detail',format('Partner pipeline is %s; improve follow-up coverage before increasing acquisition spend.',round(pipe,2))),
  jsonb_build_object('priority','Medium','title','Protect cash','detail',format('Projected next-period cash contribution is %s after recent expenses and commissions.',round(next_cash,2)))
 );
 return jsonb_build_object('generated_at',now(),'predictive_revenue',next_rev,'cash_flow_forecast',next_cash,'commission_forecast',round(comm*1.08,2),'pipeline',pipe,'win_rate',round(win,2),'overdue_leads',overdue,'lead_predictions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.win_probability desc),'[]') from (select id,lead_number,customer_name,ai_lead_score,win_probability,lost_risk,next_action from public.ai_lead_scores where status not in ('won','lost') limit 50)x),'partner_predictions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.performance_score desc),'[]') from (select partner_id,partner_name,performance_score,growth_score,health_score,risk_score,revenue,pipeline_value,conversion_pct,trend_summary from public.ai_partner_scores limit 50)x),'finance_forecast',(select coalesce(jsonb_agg(to_jsonb(x) order by x.month_start),'[]') from (select month_start,revenue,expenses,profit,forecast_revenue,forecast_expenses,forecast_profit,collections,pending_revenue from public.ai_forecast_v3 limit 12)x),'recommendations',recs);
end $$;
revoke execute on function public.ai_intelligence_v5_dashboard() from public,anon; grant execute on function public.ai_intelligence_v5_dashboard() to authenticated;

create or replace function public.ai_intelligence_v5_accuracy() returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object('periods',(select count(*) from public.ai_finance_forecast where forecast_revenue is not null),'revenue_mae',(select round(avg(abs(coalesce(forecast_revenue,0)-coalesce(revenue,0))),2) from public.ai_finance_forecast where month_start<date_trunc('month',current_date)::date),'expense_mae',(select round(avg(abs(coalesce(forecast_expenses,0)-coalesce(expenses,0))),2) from public.ai_finance_forecast where month_start<date_trunc('month',current_date)::date),'measured_at',now()) where public.ai_can_read()
$$;
revoke execute on function public.ai_intelligence_v5_accuracy() from public,anon; grant execute on function public.ai_intelligence_v5_accuracy() to authenticated;
commit;
notify pgrst,'reload schema';

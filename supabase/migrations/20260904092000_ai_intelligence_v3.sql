-- AI Intelligence Center v3: deeper forecast horizon, anomaly signals, and CEO summary.
begin;

create or replace view public.ai_forecast_v3 as
with history as (select * from public.ai_finance_forecast),
future_months as (
  select generate_series((date_trunc('month',current_date)+interval '1 month')::date,(date_trunc('month',current_date)+interval '3 months')::date,interval '1 month')::date month_start
), recent as (
  select avg(revenue)::numeric avg_revenue, avg(expenses)::numeric avg_expenses,
         stddev_pop(revenue)::numeric revenue_volatility, count(*)::integer samples
  from public.ai_finance_forecast where month_start >= (date_trunc('month',current_date)-interval '2 months')::date
), future as (
  select f.month_start,0::numeric revenue,0::numeric expenses,0::numeric profit,
    round(r.avg_revenue,2) forecast_revenue,round(r.avg_expenses,2) forecast_expenses,round(r.avg_revenue-r.avg_expenses,2) forecast_profit,
    0::numeric collections,0::numeric pending_revenue,
    greatest(25,least(95,(85 - least(50,coalesce(r.revenue_volatility/nullif(r.avg_revenue,0),0)*100))::integer)) forecast_confidence,
    'forward'::text period_type
  from future_months f cross join recent r
)
select h.month_start,h.revenue,h.expenses,h.profit,h.forecast_revenue,h.forecast_expenses,h.forecast_profit,h.collections,h.pending_revenue,
  80::integer forecast_confidence,
  'historical'::text period_type
from history h
union all
select * from future;

create or replace function public.ai_detect_anomalies()
returns integer language plpgsql security definer set search_path=public as $$
declare added integer:=0; cur record; prev record; cur_leads integer:=0; prev_leads integer:=0; cur_won integer:=0; prev_won integer:=0;
begin
  if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
  select * into cur from public.ai_finance_forecast where month_start=date_trunc('month',current_date)::date;
  select * into prev from public.ai_finance_forecast where month_start=(date_trunc('month',current_date)-interval '1 month')::date;
  select count(*) filter(where created_at>=date_trunc('month',current_date)),count(*) filter(where status in ('Won','Converted','Closed') and coalesce(updated_at,created_at)>=date_trunc('month',current_date)) into cur_leads,cur_won from public.crm_leads;
  select count(*) filter(where created_at>=date_trunc('month',current_date)-interval '1 month' and created_at<date_trunc('month',current_date)),count(*) filter(where status in ('Won','Converted','Closed') and coalesce(updated_at,created_at)>=date_trunc('month',current_date)-interval '1 month' and coalesce(updated_at,created_at)<date_trunc('month',current_date)) into prev_leads,prev_won from public.crm_leads;
  if coalesce(cur.expenses,0)>coalesce(prev.expenses,0)*1.25 and coalesce(prev.expenses,0)>0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at) values('expense-spike-'||to_char(current_date,'YYYY-MM'),'Finance','High','Expense spike detected',format('Current-month expenses are %s%% above the previous month.',round((cur.expenses/nullif(prev.expenses,0)-1)*100,1)),'Review unusual or discretionary expenses before the next payout cycle.',least(100,round((cur.expenses/nullif(prev.expenses,0)-1)*100)),jsonb_build_object('current',cur.expenses,'previous',prev.expenses),now(),now()) on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; added:=added+1;
  end if;
  if prev_leads>=3 and cur_leads*100 < prev_leads*70 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at) values('lead-volume-drop-'||to_char(current_date,'YYYY-MM'),'CRM','Medium','Lead volume is slowing',format('New lead volume is %s%% below the prior month.',round((1-cur_leads/nullif(prev_leads,0))*100,1)),'Review acquisition sources and partner referral activity before pipeline coverage falls further.',least(100,round((1-cur_leads/nullif(prev_leads,0))*100)),jsonb_build_object('current',cur_leads,'previous',prev_leads),now(),now()) on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; added:=added+1;
  end if;
  if prev_won>=1 and cur_leads>=3 and cur_won*100 < prev_won*70 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at) values('conversion-drop-'||to_char(current_date,'YYYY-MM'),'CRM','High','Conversion signal weakened','Recent wins are trailing the prior month pace.','Review high-value open leads, overdue follow-ups and quotation decisions first.',70,jsonb_build_object('current_won',cur_won,'previous_won',prev_won),now(),now()) on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; added:=added+1;
  end if;
  return added;
end $$;

create or replace function public.ai_executive_summary()
returns text language plpgsql security definer stable set search_path=public as $$
declare h record; f record; risk integer; open_leads integer; overdue integer; pending numeric;
begin
  if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
  select * into h from public.ai_company_health limit 1;
  select * into f from public.ai_forecast_v3 where period_type='forward' order by month_start limit 1;
  select count(*) into open_leads from public.crm_leads where status not in ('Won','Lost','Cancelled','Converted','Closed');
  select count(*) into overdue from public.crm_follow_ups where status='Open' and follow_up_date<current_date;
  select coalesce(sum(requested_amount),0) into pending from public.apn_withdrawal_requests where status in ('pending','under_review','approved','processing');
  risk:=coalesce(h.risk_score,0);
  return format('CEO snapshot: company health %s/100, growth %s/100 and risk %s/100. Current-month revenue is %s with forecast profit %s. The next-month revenue run-rate is approximately %s at %s%% confidence. There are %s active CRM leads, %s overdue follow-ups and %s pending APN withdrawal requests by value. Priority: protect conversion by clearing overdue follow-ups and reviewing high-severity anomalies before adding discretionary spend.',coalesce(h.company_health,0),coalesce(h.growth_score,0),risk,to_char(coalesce(h.revenue,0),'FM999G999G990D00'),to_char(coalesce(h.forecast_profit,0),'FM999G999G990D00'),to_char(coalesce(f.forecast_revenue,0),'FM999G999G990D00'),coalesce(f.forecast_confidence,0),open_leads,overdue,to_char(pending,'FM999G999G990D00'));
end $$;

create or replace function public.ai_get_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; settings_row jsonb;
begin
  if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
  perform public.ai_refresh_insights(); perform public.ai_detect_anomalies();
  select to_jsonb(s) into settings_row from public.ai_settings s where s.id='default';
  select jsonb_build_object('settings',coalesce(settings_row,'{}'::jsonb),'executive_summary',public.ai_executive_summary(),'health',coalesce((select to_jsonb(h) from public.ai_company_health h limit 1),'{}'::jsonb),'lead_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.ai_lead_score desc) from public.ai_lead_scores x),'[]'::jsonb),'partner_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.performance_score desc) from public.ai_partner_scores x),'[]'::jsonb),'employee_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.performance_score desc) from public.ai_employee_scores x),'[]'::jsonb),'forecasts',coalesce((select jsonb_agg(to_jsonb(x) order by x.month_start) from public.ai_forecast_v3 x),'[]'::jsonb),'insights',coalesce((select jsonb_agg(to_jsonb(x) order by case x.severity when 'Urgent' then 1 when 'High' then 2 when 'Medium' then 3 when 'Low' then 4 else 5 end,x.updated_at desc) from public.ai_insights x where x.status='active'),'[]'::jsonb),'recommendations',coalesce((select jsonb_agg(to_jsonb(x) order by case x.priority when 'Urgent' then 1 when 'High' then 2 when 'Medium' then 3 else 4 end,x.updated_at desc) from public.ai_recommendations x where x.status='active'),'[]'::jsonb),'reports',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.ai_reports x where x.generated_by=auth.uid()::text or public.is_admin()),'[]'::jsonb)) into result;
  return result;
end $$;
revoke execute on function public.ai_detect_anomalies(),public.ai_executive_summary() from public,anon; grant execute on function public.ai_detect_anomalies(),public.ai_executive_summary() to authenticated;
commit;
select pg_notify('pgrst','reload schema');

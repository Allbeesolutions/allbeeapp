-- ALLBEE PR5 — Deterministic AI Intelligence Engine
-- Infrastructure-first business intelligence. No external AI provider calls.
-- Additive, admin-only, transaction-safe, and backed by existing ERP modules.

begin;

create table if not exists public.ai_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  sensitivity text not null default 'balanced',
  forecast_period integer not null default 90,
  prediction_model text not null default 'deterministic-v1',
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint ai_settings_sensitivity_check check (sensitivity in ('conservative','balanced','sensitive')),
  constraint ai_settings_forecast_check check (forecast_period in (30,60,90,180,365))
);

create table if not exists public.ai_insights (
  id text primary key,
  category text not null,
  severity text not null default 'Info',
  title text not null,
  message text not null,
  recommendation text,
  entity_type text,
  entity_id text,
  score numeric(8,2),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  generated_by text not null default 'deterministic-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint ai_insights_severity_check check (severity in ('Info','Low','Medium','High','Urgent')),
  constraint ai_insights_status_check check (status in ('active','resolved','dismissed'))
);

create table if not exists public.ai_predictions (
  id text primary key,
  prediction_type text not null,
  entity_id text not null,
  value numeric(12,2) not null default 0,
  confidence numeric(5,2) not null default 0,
  explanation text not null default '',
  factors jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists public.ai_cache (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.ai_history (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_recommendations (
  id text primary key,
  category text not null,
  title text not null,
  description text not null,
  impact text,
  priority text not null default 'Medium',
  entity_type text,
  entity_id text,
  action_route text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_recommendations_priority_check check (priority in ('Low','Medium','High','Urgent')),
  constraint ai_recommendations_status_check check (status in ('active','completed','dismissed'))
);

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  format text not null default 'json',
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  generated_by text,
  created_at timestamptz not null default now(),
  constraint ai_reports_format_check check (format in ('json','pdf','xlsx'))
);

create index if not exists ai_insights_status_idx on public.ai_insights(status, severity, updated_at desc);
create index if not exists ai_insights_entity_idx on public.ai_insights(entity_type, entity_id);
create index if not exists ai_predictions_type_idx on public.ai_predictions(prediction_type, entity_id);
create index if not exists ai_history_period_idx on public.ai_history(period, created_at desc);
create index if not exists ai_recommendations_status_idx on public.ai_recommendations(status, priority, updated_at desc);
create index if not exists ai_reports_type_idx on public.ai_reports(report_type, created_at desc);

insert into public.ai_settings(id, enabled, sensitivity, forecast_period, prediction_model)
values ('default', true, 'balanced', 90, 'deterministic-v1')
on conflict (id) do nothing;

create or replace function public.ai_can_read()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin();
$$;

create or replace view public.ai_lead_scores as
with base as (
  select
    l.id, l.lead_number, l.customer_name, l.company, l.source, l.project_category,
    l.expected_budget, l.expected_closing_date, l.priority, l.status, l.lead_score,
    l.assigned_employee_id, l.assigned_partner_id, l.district, l.state, l.email, l.mobile,
    l.created_at, l.updated_at,
    coalesce((select count(*) from public.crm_follow_ups f where f.lead_id=l.id and f.status='Open'),0)::integer as open_follow_ups,
    coalesce((select count(*) from public.crm_follow_ups f where f.lead_id=l.id and f.status='Completed'),0)::integer as completed_follow_ups,
    coalesce((select count(*) from public.crm_quotations q where q.lead_id=l.id),0)::integer as quotation_count,
    coalesce((select count(*) from public.crm_quotations q where q.lead_id=l.id and q.status in ('Sent','Viewed','Accepted','Converted')),0)::integer as active_quotation_count,
    case when exists (select 1 from public.crm_leads prior where prior.id<>l.id and lower(coalesce(prior.email,''))=lower(coalesce(l.email,'')) and nullif(l.email,'') is not null and prior.status in ('Converted','Closed','Won')) then 1 else 0 end as previous_customer,
    case when l.assigned_partner_id is not null and exists (select 1 from public.apn_commission_projects p where p.partner_id=l.assigned_partner_id and coalesce(p.total_received,0)>0) then 1 else 0 end as partner_history,
    greatest(0, (current_date - coalesce(l.updated_at::date,l.created_at::date))::integer) as stale_days
  from public.crm_leads l
), scored as (
  select b.*,
    least(100, greatest(0,
      case when b.expected_budget > 0 then least(20, round((b.expected_budget / 100000.0) * 20)::integer) else 0 end
      + case when b.expected_closing_date is not null and b.expected_closing_date between current_date and current_date + 90 then 15 when b.expected_closing_date is not null then 8 else 0 end
      + case when b.completed_follow_ups >= 2 then 20 when b.completed_follow_ups = 1 then 12 when b.open_follow_ups > 0 then 8 else 0 end
      + case when nullif(b.project_category,'') is not null then 10 else 0 end
      + case when b.source in ('Website','APN Referral','Referral','Existing Client') then 15 when b.source in ('WhatsApp','Instagram','Facebook') then 10 when b.source is not null then 5 else 0 end
      + case when b.previous_customer=1 then 10 else 0 end
      + case when b.partner_history=1 then 10 else 0 end
    ))::integer as computed_score
  from base b
)
select
  s.id, s.lead_number, s.customer_name, s.company, s.source, s.project_category,
  s.expected_budget, s.expected_closing_date, s.priority, s.status, s.assigned_employee_id, s.assigned_partner_id,
  s.district, s.state, s.email, s.mobile, s.created_at, s.updated_at,
  s.computed_score as ai_lead_score,
  least(99, greatest(1, s.computed_score + case when s.status in ('Interested','Quotation Sent','Negotiation') then 5 else 0 end - least(20,s.stale_days)))::integer as win_probability,
  greatest(1, 100 - least(99, greatest(1, s.computed_score + case when s.status in ('Interested','Quotation Sent','Negotiation') then 5 else 0 end - least(20,s.stale_days))))::integer as lost_risk,
  s.open_follow_ups, s.completed_follow_ups, s.quotation_count, s.active_quotation_count, s.stale_days,
  array_to_string(array_remove(array[
    case when s.expected_budget > 0 then 'Budget captured' end,
    case when s.expected_closing_date between current_date and current_date + 90 then 'Timeline is actionable' end,
    case when s.completed_follow_ups > 0 then 'Follow-up activity recorded' end,
    case when s.previous_customer=1 then 'Previous customer history' end,
    case when s.partner_history=1 then 'Partner has prior revenue' end,
    case when s.stale_days >= 7 then 'No recent activity' end,
    case when s.open_follow_ups=0 and s.status not in ('Lost','Converted','Closed','Cancelled') then 'No open follow-up' end
  ]::text[], null), ' · ') as reasons,
  case
    when s.status in ('Lost','Converted','Closed','Cancelled') then 'No action required'
    when s.open_follow_ups=0 or s.stale_days>=5 then 'Schedule a follow-up today'
    when s.quotation_count=0 then 'Prepare and send a quotation'
    when s.active_quotation_count>0 then 'Confirm quotation decision'
    else 'Keep the conversation active'
  end as next_action
from scored s;

create or replace view public.ai_partner_scores as
with partners as (
  select u.id::text as partner_id, coalesce(nullif(u.data->>'name',''),u.id::text) as partner_name,
    coalesce(nullif(u.data->>'district',''),'Unknown') as district,
    coalesce(nullif(u.data->>'status',''),'active') as partner_status
  from public.apn_users u
  where lower(coalesce(u.data->>'status','active')) not in ('deleted','rejected')
), lead_stats as (
  select p.partner_id,
    count(l.id)::integer as lead_count,
    count(l.id) filter (where lower(coalesce(l.data->>'status','')) in ('won','converted','closed'))::integer as won_count,
    count(l.id) filter (where nullif(l.data->>'nextFollowUp','') is not null or nullif(l.data->>'next_follow_up','') is not null)::integer as followup_count
  from partners p left join public.apn_leads l on coalesce(l.data->>'partnerId',l.data->>'partner_id')=p.partner_id
  group by p.partner_id
), revenue_stats as (
  select p.partner_id,
    coalesce(sum(x.total_received),0)::numeric as revenue,
    coalesce(sum(x.project_value),0)::numeric as pipeline_value,
    count(x.id)::integer as project_count
  from partners p left join public.apn_commission_projects x on x.partner_id=p.partner_id and coalesce(x.status,'')<>'Cancelled'
  group by p.partner_id
), referral_stats as (
  select p.partner_id,
    count(r.id)::integer as referral_count,
    coalesce(sum(r.referral_amount),0)::numeric as referral_earnings,
    count(r.id) filter (where r.created_at >= date_trunc('month',current_date))::integer as current_referrals
  from partners p left join public.apn_referral_earnings r on r.referrer_id=p.partner_id and r.status<>'rejected'
  group by p.partner_id
), withdrawal_stats as (
  select p.partner_id,
    count(w.id) filter (where w.status in ('pending','under_review','approved','processing'))::integer as pending_withdrawals,
    coalesce(sum(w.requested_amount) filter (where w.status in ('pending','under_review','approved','processing')),0)::numeric as pending_amount
  from partners p left join public.apn_withdrawal_requests w on w.partner_id=p.partner_id
  group by p.partner_id
), scored as (
  select p.*, ls.lead_count, ls.won_count, ls.followup_count, rs.revenue, rs.pipeline_value, rs.project_count,
    fs.referral_count, fs.referral_earnings, fs.current_referrals, ws.pending_withdrawals, ws.pending_amount,
    case when ls.lead_count=0 then 0 else round(ls.won_count*100.0/ls.lead_count,2) end as conversion_pct,
    case when ls.lead_count=0 then 0 else round(ls.followup_count*100.0/ls.lead_count,2) end as followup_pct
  from partners p
  join lead_stats ls on ls.partner_id=p.partner_id
  join revenue_stats rs on rs.partner_id=p.partner_id
  join referral_stats fs on fs.partner_id=p.partner_id
  join withdrawal_stats ws on ws.partner_id=p.partner_id
)
select s.partner_id, s.partner_name, s.district, s.partner_status, s.lead_count, s.won_count, s.project_count,
  s.revenue, s.pipeline_value, s.referral_count, s.referral_earnings, s.current_referrals, s.pending_withdrawals, s.pending_amount,
  s.conversion_pct, s.followup_pct,
  least(100, greatest(0, round(25 + least(35,s.conversion_pct*0.45) + least(30,s.revenue/100000.0*30) + least(10,s.referral_count*2))::integer))::integer as performance_score,
  least(100, greatest(0, round(20 + least(35,s.current_referrals*12) + least(30,s.referral_earnings/10000.0*30) + least(15,s.project_count*3))::integer))::integer as growth_score,
  least(100, greatest(0, round(100 - least(45,case when s.lead_count=0 then 25 else 0 end + case when s.revenue=0 then 20 else 0 end) - least(25,s.pending_withdrawals*5))::integer))::integer as health_score,
  least(100, greatest(0, round(case when s.lead_count=0 then 35 else 0 end + case when s.revenue=0 then 30 else 0 end + least(25,s.pending_withdrawals*5) + case when s.conversion_pct<10 and s.lead_count>3 then 15 else 0 end)::integer))::integer as risk_score,
  case when s.revenue=0 then 'No recorded APN revenue yet' when s.current_referrals>0 then 'Revenue and referral activity are growing' else 'Maintain consistent lead follow-up' end as trend_summary
from scored s;

create or replace view public.ai_employee_scores as
with staff as (
  select p.id, p.name, p.role, p.designation
  from public.profiles p
  where p.active is distinct from false and p.role in ('superadmin','admin','accountant','staff','intern')
), task_stats as (
  select s.id,
    count(t.id)::integer as task_count,
    count(t.id) filter (where lower(coalesce(t.data->>'status',''))='completed')::integer as completed_tasks
  from staff s left join public.tasks t on (t.data->>'assignedToId'=s.id::text or coalesce(t.data->'assigneeIds','[]'::jsonb) ? s.id::text)
  group by s.id
), lead_stats as (
  select s.id, count(l.id)::integer as assigned_leads,
    count(l.id) filter (where l.status in ('Converted','Closed','Won'))::integer as converted_leads
  from staff s left join public.crm_leads l on l.assigned_employee_id=s.id::text
  group by s.id
), revenue_stats as (
  select s.id, coalesce(sum(r.received_amount),0)::numeric as revenue
  from staff s left join public.crm_projects p on p.assigned_employee_id=s.id::text left join public.crm_revenue_collections r on r.project_id=p.id and r.status<>'Cancelled'
  group by s.id
), attendance_stats as (
  select s.id, count(a.id)::integer as attendance_days
  from staff s left join public.attendance a on a.data->>'userId'=s.id::text and lower(coalesce(a.data->>'status','present')) in ('present','completed')
  group by s.id
)
select s.id employee_id,s.name,s.role,s.designation,ts.task_count,ts.completed_tasks,ls.assigned_leads,ls.converted_leads,rs.revenue,asx.attendance_days,
  case when ts.task_count=0 then 0 else round(ts.completed_tasks*100.0/ts.task_count,2) end as task_completion_pct,
  case when ls.assigned_leads=0 then 0 else round(ls.converted_leads*100.0/ls.assigned_leads,2) end as lead_conversion_pct,
  least(100,greatest(0,round(case when ts.task_count=0 then 20 else ts.completed_tasks*45.0/ts.task_count end + least(25,ls.converted_leads*8) + least(20,rs.revenue/100000.0*20) + least(10,asx.attendance_days)::numeric)::integer))::integer as performance_score,
  case when ts.task_count=0 and ls.assigned_leads=0 then 'No assigned work recorded' when ls.converted_leads>0 then 'Converting assigned work' else 'Focus on closing assigned work' end as performance_summary
from staff s join task_stats ts on ts.id=s.id join lead_stats ls on ls.id=s.id join revenue_stats rs on rs.id=s.id join attendance_stats asx on asx.id=s.id;

create or replace view public.ai_finance_forecast as
with months as (
  select generate_series(date_trunc('month',current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month')::date as month_start
), actuals as (
  select date_trunc('month',case when t.data->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (t.data->>'date')::date else t.updated_at::date end)::date as month_start,
    coalesce(sum(case when lower(coalesce(t.data->>'kind',''))='income' then nullif(t.data->>'amount','')::numeric else 0 end),0) as revenue,
    coalesce(sum(case when lower(coalesce(t.data->>'kind',''))='expense' then nullif(t.data->>'amount','')::numeric else 0 end),0) as expenses
  from public.transactions t group by 1
), joined as (
  select m.month_start,coalesce(a.revenue,0)::numeric as revenue,coalesce(a.expenses,0)::numeric as expenses
  from months m left join actuals a on a.month_start=m.month_start
), averages as (
  select *,avg(revenue) over (order by month_start rows between 2 preceding and current row) as forecast_revenue,
    avg(expenses) over (order by month_start rows between 2 preceding and current row) as forecast_expenses
  from joined
)
select month_start,revenue,expenses,revenue-expenses as profit,round(forecast_revenue,2) as forecast_revenue,round(forecast_expenses,2) as forecast_expenses,round(forecast_revenue-forecast_expenses,2) as forecast_profit,
  coalesce((select sum(r.received_amount) from public.crm_revenue_collections r where r.status<>'Cancelled' and date_trunc('month',r.received_at)::date=averages.month_start),0)::numeric as collections,
  coalesce((select sum(p.project_value)-sum(coalesce(x.received,0)) from public.crm_projects p left join lateral (select sum(r.received_amount) received from public.crm_revenue_collections r where r.project_id=p.id and r.status<>'Cancelled') x on true where p.status not in ('Cancelled','Completed')),0)::numeric as pending_revenue
from averages;

create or replace view public.ai_company_health as
with f as (select * from public.ai_finance_forecast where month_start=date_trunc('month',current_date)::date),
crm as (select * from public.crm_lead_dashboard),
partner as (select coalesce(round(avg(health_score),2),0) health from public.ai_partner_scores),
employee as (select coalesce(round(avg(performance_score),2),0) performance from public.ai_employee_scores),
risks as (select count(*) filter(where status='active' and severity in ('High','Urgent'))::integer high_risks from public.ai_insights)
select coalesce(f.revenue,0) revenue,coalesce(f.expenses,0) expenses,coalesce(f.profit,0) profit,coalesce(f.forecast_revenue,0) forecast_revenue,coalesce(f.forecast_profit,0) forecast_profit,
  least(100,greatest(0,round((case when coalesce(f.revenue,0)>0 then 30 else 0 end)+(case when coalesce(f.profit,0)>=0 then 25 else 8 end)+(case when crm.conversion_rate>=20 then 25 else crm.conversion_rate end)+(case when crm.active_leads>0 then 20 else 0 end))::integer))::integer as company_health,
  least(100,greatest(0,round((case when crm.conversion_rate>=25 then 45 else crm.conversion_rate*1.5 end)+case when crm.active_leads>0 then 25 else 0 end+least(30,crm.won_leads*5))::integer))::integer as sales_health,
  least(100,greatest(0,round((case when coalesce(f.revenue,0)>0 then 45 else 0 end)+(case when coalesce(f.profit,0)>=0 then 35 else 10 end)+least(20,coalesce(f.forecast_revenue,0)/100000.0*20))::integer))::integer as finance_health,
  employee.performance::integer as employee_health,partner.health::integer as apn_health,
  least(100,greatest(0,round((case when crm.active_leads>0 then 35 else 0 end)+(case when crm.won_leads>0 then 30 else 0 end)+(case when crm.revenue>0 then 35 else 0 end))::integer))::integer as crm_health,
  case when coalesce(f.revenue,0)=0 then 0 else round(f.profit*100.0/nullif(f.revenue,0),2) end as profitability,
  least(100,risks.high_risks*15 + crm.lost_leads*3)::integer as risk_score,
  least(100,greatest(0,round((case when coalesce(f.forecast_revenue,0)>coalesce(f.revenue,0) then 55 else 25 end)+least(25,crm.won_leads*5)+least(20,partner.health/5))::integer))::integer as growth_score
from f cross join crm cross join partner cross join employee cross join risks;

create or replace function public.ai_refresh_insights()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_current numeric:=0; v_previous numeric:=0; v_missed integer:=0; v_pending integer:=0; v_low_partners integer:=0; v_inactive integer:=0; v_added integer:=0; v_actor text:=auth.uid()::text; v_name text:=coalesce(public.current_name(),'System');
begin
  if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
  select coalesce(revenue,0) into v_current from public.ai_finance_forecast where month_start=date_trunc('month',current_date)::date;
  select coalesce(revenue,0) into v_previous from public.ai_finance_forecast where month_start=(date_trunc('month',current_date)-interval '1 month')::date;
  select count(*) into v_missed from public.crm_follow_ups where status='Open' and follow_up_date<current_date;
  select count(*) into v_pending from public.apn_withdrawal_requests where status in ('pending','under_review','approved','processing');
  select count(*) into v_low_partners from public.ai_partner_scores where health_score<50;
  select count(*) into v_inactive from public.profiles where active is distinct from false and role in ('superadmin','admin','accountant','staff','intern') and (last_active is null or last_active<now()-interval '7 days');

  if v_previous>0 and v_current < v_previous*0.90 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at)
    values('revenue-down-'||to_char(current_date,'YYYY-MM'),'Finance','High','Revenue is trending down',format('Current-month revenue is %s%% below the previous month.',round((1-v_current/nullif(v_previous,0))*100,1)),'Review source mix, follow up open opportunities, and increase the best-performing campaign.',least(100,round((1-v_current/nullif(v_previous,0))*100)),jsonb_build_object('current',v_current,'previous',v_previous),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=v_added+1;
  end if;
  if v_missed>0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at)
    values('missed-followups-'||to_char(current_date,'YYYY-MM'),'CRM','High','Leads need attention',format('%s follow-up%s are overdue.',v_missed,case when v_missed=1 then '' else 's' end),'Open the CRM pipeline and contact overdue leads today.',least(100,v_missed*12),jsonb_build_object('missed',v_missed),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=v_added+1;
  end if;
  if v_pending>0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at)
    values('pending-withdrawals-'||to_char(current_date,'YYYY-MM'),'Finance','Medium','Withdrawals are pending',format('%s withdrawal request%s are in the settlement queue.',v_pending,case when v_pending=1 then '' else 's' end),'Review the Withdrawal Center and keep partners informed of settlement timing.',least(100,v_pending*10),jsonb_build_object('pending',v_pending),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=v_added+1;
  end if;
  if v_low_partners>0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at)
    values('partner-health-'||to_char(current_date,'YYYY-MM'),'APN','Medium','Partner health needs review',format('%s partner%s have a health score below 50.',v_low_partners,case when v_low_partners=1 then '' else 's' end),'Coach partners with low conversion or no recent revenue and review their follow-up activity.',least(100,v_low_partners*15),jsonb_build_object('low_health_partners',v_low_partners),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=v_added+1;
  end if;
  if v_inactive>0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,score,metadata,updated_at,last_seen_at)
    values('employee-inactivity-'||to_char(current_date,'YYYY-MM'),'Employee','Low','Employee activity is uneven',format('%s team member%s have not been active for seven days.',v_inactive,case when v_inactive=1 then '' else 's' end),'Review assignments and check in with inactive team members.',least(100,v_inactive*10),jsonb_build_object('inactive',v_inactive),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,score=excluded.score,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=v_added+1;
  end if;
  if v_added=0 then
    insert into public.ai_insights(id,category,severity,title,message,recommendation,metadata,updated_at,last_seen_at)
    values('operations-stable-'||to_char(current_date,'YYYY-MM'),'Company','Info','Operations are stable','No high-priority deterministic risk signals were detected in the latest refresh.','Keep monitoring the CRM pipeline, collections, and partner activity.',jsonb_build_object('revenue',v_current,'previous_revenue',v_previous),now(),now())
    on conflict(id) do update set message=excluded.message,recommendation=excluded.recommendation,metadata=excluded.metadata,updated_at=now(),last_seen_at=now(),status='active'; v_added:=1;
  end if;

  insert into public.ai_recommendations(id,category,title,description,impact,priority,action_route,metadata,updated_at)
  values
    ('follow-up-discipline-'||to_char(current_date,'YYYY-MM'),'CRM','Improve follow-up discipline','Prioritize overdue and high-probability leads before adding new pipeline volume.','Higher conversion','High','leads',jsonb_build_object('missed_followups',v_missed),now()),
    ('cash-visibility-'||to_char(current_date,'YYYY-MM'),'Finance','Keep cash visibility current','Review pending collections and withdrawals together before making payout commitments.','Lower cash-flow risk','Medium','accounts',jsonb_build_object('pending_withdrawals',v_pending),now())
  on conflict(id) do update set description=excluded.description,impact=excluded.impact,priority=excluded.priority,metadata=excluded.metadata,updated_at=now(),status='active';

  insert into public.ai_predictions(id,prediction_type,entity_id,value,confidence,explanation,factors,generated_at)
  select 'lead:'||id,'lead_score',id,ai_lead_score,least(99,greatest(25,60+least(35,completed_follow_ups*10))),coalesce(reasons,'Deterministic CRM score'),jsonb_build_object('win_probability',win_probability,'lost_risk',lost_risk,'next_action',next_action),now() from public.ai_lead_scores
  on conflict(id) do update set value=excluded.value,confidence=excluded.confidence,explanation=excluded.explanation,factors=excluded.factors,generated_at=now();
  insert into public.ai_predictions(id,prediction_type,entity_id,value,confidence,explanation,factors,generated_at)
  select 'partner:'||partner_id,'partner_health',partner_id,health_score,75,trend_summary,jsonb_build_object('performance_score',performance_score,'growth_score',growth_score,'risk_score',risk_score),now() from public.ai_partner_scores
  on conflict(id) do update set value=excluded.value,confidence=excluded.confidence,explanation=excluded.explanation,factors=excluded.factors,generated_at=now();

  insert into public.ai_cache(key,payload,generated_at,expires_at)
  values('insights',jsonb_build_object('refreshedAt',now(),'insightCount',v_added),now(),now()+interval '15 minutes')
  on conflict(key) do update set payload=excluded.payload,generated_at=excluded.generated_at,expires_at=excluded.expires_at;

  return v_added;
end $$;

create or replace function public.ai_get_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; settings_row jsonb;
begin
  if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
  perform public.ai_refresh_insights();
  select to_jsonb(s) into settings_row from public.ai_settings s where s.id='default';
  select jsonb_build_object(
    'settings',coalesce(settings_row,'{}'::jsonb),
    'health',coalesce((select to_jsonb(h) from public.ai_company_health h limit 1),'{}'::jsonb),
    'lead_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.ai_lead_score desc) from public.ai_lead_scores x),'[]'::jsonb),
    'partner_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.performance_score desc) from public.ai_partner_scores x),'[]'::jsonb),
    'employee_scores',coalesce((select jsonb_agg(to_jsonb(x) order by x.performance_score desc) from public.ai_employee_scores x),'[]'::jsonb),
    'forecasts',coalesce((select jsonb_agg(to_jsonb(x) order by x.month_start) from public.ai_finance_forecast x),'[]'::jsonb),
    'insights',coalesce((select jsonb_agg(to_jsonb(x) order by case x.severity when 'Urgent' then 1 when 'High' then 2 when 'Medium' then 3 when 'Low' then 4 else 5 end,x.updated_at desc) from public.ai_insights x where x.status='active'),'[]'::jsonb),
    'recommendations',coalesce((select jsonb_agg(to_jsonb(x) order by case x.priority when 'Urgent' then 1 when 'High' then 2 when 'Medium' then 3 else 4 end,x.updated_at desc) from public.ai_recommendations x where x.status='active'),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.ai_reports x where x.generated_by=auth.uid()::text or public.is_admin()),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.ai_save_settings(p_enabled boolean,p_sensitivity text,p_forecast_period integer,p_prediction_model text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.ai_can_read() then raise exception 'AI settings access denied.' using errcode='insufficient_privilege'; end if;
  if p_sensitivity not in ('conservative','balanced','sensitive') or p_forecast_period not in (30,60,90,180,365) then raise exception 'Invalid AI settings.' using errcode='check_violation'; end if;
  update public.ai_settings set enabled=coalesce(p_enabled,true),sensitivity=p_sensitivity,forecast_period=p_forecast_period,prediction_model=coalesce(nullif(trim(p_prediction_model),''),'deterministic-v1'),updated_by=auth.uid()::text,updated_at=now() where id='default' returning to_jsonb(ai_settings.*) into result;
  perform public.crm_log_event('ai_settings_updated','AI settings updated','Deterministic intelligence settings were updated.');
  return result;
end $$;

create or replace function public.ai_natural_language_search(p_query text)
returns table(result_type text,result_id text,title text,subtitle text,value text,route text,metadata jsonb)
language plpgsql security definer set search_path = public as $$
declare q text:=lower(trim(coalesce(p_query,''))); r record; total numeric;
begin
  if not public.ai_can_read() then raise exception 'AI search access denied.' using errcode='insufficient_privilege'; end if;
  if q='' then return; end if;
  if q like '%today%revenue%' or q like '%revenue%today%' then
    select coalesce(revenue,0) into total from public.ai_finance_forecast where month_start=date_trunc('month',current_date)::date;
    return query select 'metric','today-revenue','Today''s revenue','Deterministic finance view',to_char(total,'FM999G999G990D00'),'accounts',jsonb_build_object('amount',total);
  elsif q like '%pending%withdraw%' then
    return query select 'metric','pending-withdrawals','Pending withdrawals','Withdrawal Center',count(*)::text,'withdrawals',jsonb_build_object('count',count(*)) from public.apn_withdrawal_requests where status in ('pending','under_review','approved','processing');
  elsif q like '%apn%earning%' or q like '%referral%earning%' then
    return query select 'metric','apn-earnings','APN referral earnings','Referral Engine',to_char(coalesce(sum(referral_amount),0),'FM999G999G990D00'),'apn',jsonb_build_object('amount',coalesce(sum(referral_amount),0)) from public.apn_referral_earnings where status<>'rejected';
  elsif q like '%top%partner%' then
    return query select 'partner',p.partner_id,p.partner_name,format('%s conversion · %s revenue',p.conversion_pct,to_char(p.revenue,'FM999G999G990D00')),p.performance_score::text,'apn',to_jsonb(p) from public.ai_partner_scores p order by p.performance_score desc,p.revenue desc limit 5;
  elsif q like '%highest%commission%' then
    return query select 'project',p.id::text,p.project_name,coalesce(p.partner_id,'Direct'),to_char(p.maximum_commission,'FM999G999G990D00'),'apn',to_jsonb(p) from public.apn_commission_projects p order by p.maximum_commission desc limit 10;
  elsif q like '%lost%lead%' then
    return query select 'lead',l.id::text,l.customer_name,coalesce(l.company,''),l.ai_lead_score::text,'leads',to_jsonb(l) from public.ai_lead_scores l where l.status='Lost' order by l.updated_at desc limit 25;
  else
    return query select 'lead',l.id::text,l.customer_name,coalesce(l.company,'')||' · '||l.status,l.ai_lead_score::text,'leads',to_jsonb(l) from public.ai_lead_scores l where (l.customer_name||' '||coalesce(l.company,'')||' '||coalesce(l.email,'')||' '||coalesce(l.mobile,'')||' '||coalesce(l.district,'')||' '||coalesce(l.state,'')) ilike '%'||q||'%' order by l.updated_at desc limit 25;
    return query select 'client',c.id::text,c.customer_name,coalesce(c.company,'')||' · '||coalesce(c.city,c.district,''),'','clients',to_jsonb(c) from public.crm_clients c where (c.customer_name||' '||coalesce(c.company,'')||' '||coalesce(c.city,'')||' '||coalesce(c.district,'')||' '||coalesce(c.state,'')) ilike '%'||q||'%' order by c.updated_at desc limit 25;
    return query select 'employee',e.id::text,e.name,coalesce(e.designation,e.role),'','team',to_jsonb(e) from public.profiles e where (e.name||' '||coalesce(e.email,'')||' '||coalesce(e.designation,'')) ilike '%'||q||'%' and e.role not in ('client','partner') limit 25;
  end if;
end $$;

create or replace function public.ai_generate_report(p_report_type text,p_format text default 'json')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; payload jsonb; title_text text;
begin
  if not public.ai_can_read() then raise exception 'AI report access denied.' using errcode='insufficient_privilege'; end if;
  if p_format not in ('json','pdf','xlsx') then raise exception 'Unsupported report format.' using errcode='invalid_parameter_value'; end if;
  perform public.ai_refresh_insights();
  title_text:=initcap(replace(coalesce(p_report_type,'business'),'_',' '))||' report';
  payload:=jsonb_build_object('generatedAt',now(),'reportType',p_report_type,'health',(select to_jsonb(h) from public.ai_company_health h limit 1),'forecasts',(select coalesce(jsonb_agg(to_jsonb(f) order by f.month_start),'[]'::jsonb) from public.ai_finance_forecast f),'leadScores',(select coalesce(jsonb_agg(to_jsonb(l) order by l.ai_lead_score desc),'[]'::jsonb) from public.ai_lead_scores l),'partnerScores',(select coalesce(jsonb_agg(to_jsonb(p) order by p.performance_score desc),'[]'::jsonb) from public.ai_partner_scores p),'recommendations',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.ai_recommendations r where r.status='active'));
  insert into public.ai_reports(report_type,format,title,payload,generated_by) values(coalesce(nullif(p_report_type,''),'business'),p_format,title_text,payload,auth.uid()::text) returning id into v_id;
  insert into public.ai_history(period,summary,metrics,created_by) values('report',title_text,payload,auth.uid()::text);
  return jsonb_build_object('id',v_id,'title',title_text,'format',p_format,'payload',payload);
end $$;

create or replace function public.ai_generate_timeline(p_period text default 'daily')
returns jsonb language plpgsql security definer set search_path = public as $$
declare summary_text text; metrics jsonb; result_id uuid;
begin
  if not public.ai_can_read() then raise exception 'AI timeline access denied.' using errcode='insufficient_privilege'; end if;
  if p_period not in ('daily','weekly','monthly') then raise exception 'Invalid AI timeline period.' using errcode='invalid_parameter_value'; end if;
  select jsonb_build_object('revenue',coalesce(sum(revenue),0),'expenses',coalesce(sum(expenses),0),'profit',coalesce(sum(profit),0),'lead_count',(select count(*) from public.crm_leads),'won_leads',(select count(*) from public.crm_leads where status in ('Won','Converted','Closed')),'active_insights',(select count(*) from public.ai_insights where status='active')) into metrics from public.ai_finance_forecast where month_start>=date_trunc(case when p_period='daily' then 'day' when p_period='weekly' then 'week' else 'month' end,current_date)::date;
  summary_text:=format('%s intelligence summary: revenue %s, profit %s, %s active insight(s).',initcap(p_period),to_char((metrics->>'revenue')::numeric,'FM999G999G990D00'),to_char((metrics->>'profit')::numeric,'FM999G999G990D00'),metrics->>'active_insights');
  insert into public.ai_history(period,summary,metrics,created_by) values(p_period,summary_text,metrics,auth.uid()::text) returning id into result_id;
  return jsonb_build_object('id',result_id,'period',p_period,'summary',summary_text,'metrics',metrics);
end $$;

alter table public.ai_settings enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_predictions enable row level security;
alter table public.ai_cache enable row level security;
alter table public.ai_history enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.ai_reports enable row level security;

drop policy if exists ai_settings_select on public.ai_settings;
create policy ai_settings_select on public.ai_settings for select to authenticated using (public.ai_can_read());
drop policy if exists ai_insights_select on public.ai_insights;
create policy ai_insights_select on public.ai_insights for select to authenticated using (public.ai_can_read());
drop policy if exists ai_predictions_select on public.ai_predictions;
create policy ai_predictions_select on public.ai_predictions for select to authenticated using (public.ai_can_read());
drop policy if exists ai_cache_select on public.ai_cache;
create policy ai_cache_select on public.ai_cache for select to authenticated using (public.ai_can_read());
drop policy if exists ai_history_select on public.ai_history;
create policy ai_history_select on public.ai_history for select to authenticated using (public.ai_can_read());
drop policy if exists ai_recommendations_select on public.ai_recommendations;
create policy ai_recommendations_select on public.ai_recommendations for select to authenticated using (public.ai_can_read());
drop policy if exists ai_reports_select on public.ai_reports;
create policy ai_reports_select on public.ai_reports for select to authenticated using (public.ai_can_read());

grant select on public.ai_settings,public.ai_insights,public.ai_predictions,public.ai_cache,public.ai_history,public.ai_recommendations,public.ai_reports to authenticated;
grant execute on function public.ai_get_dashboard(),public.ai_refresh_insights(),public.ai_save_settings(boolean,text,integer,text),public.ai_natural_language_search(text),public.ai_generate_report(text,text),public.ai_generate_timeline(text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['ai_settings','ai_insights','ai_predictions','ai_cache','ai_history','ai_recommendations','ai_reports'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; when others then null; end;
  end loop;
end $$;

commit;
select pg_notify('pgrst','reload schema');

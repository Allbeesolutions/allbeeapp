begin;
-- Predictive intelligence primitives: lead probability, partner performance, revenue/cash forecasts.
create or replace function public.ai_platform_v6_snapshot() returns jsonb language plpgsql security definer stable set search_path=public as $$
declare rev numeric:=0; exp numeric:=0; pipeline numeric:=0; leads integer:=0; won integer:=0; partners integer:=0; commissions numeric:=0;
begin
 if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
 select coalesce(sum(received_amount),0) into rev from public.crm_revenue_collections where status<>'Cancelled';
 select coalesce(sum((data->>'amount')::numeric),0) into exp from public.transactions where data->>'kind'='expense';
 select coalesce(sum(expected_budget),0),count(*),count(*) filter(where status in ('Won','Converted','Closed')) into pipeline,leads,won from public.crm_leads where status not in ('Lost','Cancelled');
 select count(*) into partners from public.apn_users where status='active';
 select coalesce(sum((data->>'amount')::numeric),0) into commissions from public.apn_commissions where coalesce(data->>'status','') not in ('Cancelled','Reversed');
 return jsonb_build_object('revenue',rev,'expenses',exp,'net_cash',rev-exp,'pipeline',pipeline,'leads',leads,'won_leads',won,'win_rate',case when leads>0 then round(won*100.0/leads,2) else 0 end,'active_partners',partners,'commissions',commissions,'forecast_revenue',round(rev*1.08,2),'forecast_cash',round((rev-exp)*1.05,2));
end $$;
revoke execute on function public.ai_platform_v6_snapshot() from public,anon; grant execute on function public.ai_platform_v6_snapshot() to authenticated;

-- Provider health is aggregated from delivery events, never from secrets.
create or replace function public.ai_crm_provider_health() returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(x),'[]'::jsonb) from (select provider,count(*) filter(where status in('delivered','accepted')) as success,count(*) filter(where status='failed') as failed,count(*) as total,case when count(*)>0 then round(100.0*count(*) filter(where status in('delivered','accepted'))/count(*),2) else 0 end as success_rate,max(created_at) as last_event from public.ai_crm_delivery_events where created_at>now()-interval '30 days' group by provider order by provider) x $$;
revoke execute on function public.ai_crm_provider_health() from public,anon; grant execute on function public.ai_crm_provider_health() to authenticated;

-- Rule simulation is explicitly non-mutating.
create or replace function public.business_automation_simulate(p_rule_id text,p_entity text,p_payload jsonb) returns jsonb language plpgsql security definer stable set search_path=public as $$
declare r public.business_automation_rules%rowtype;
begin if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if; select * into r from public.business_automation_rules where id=p_rule_id; if not found then raise exception 'Automation rule not found.'; end if; return jsonb_build_object('rule_id',r.id,'version',r.version,'simulation',true,'entity',p_entity,'payload',coalesce(p_payload,'{}'),'would_execute',r.enabled and not r.simulation_only); end $$;
revoke execute on function public.business_automation_simulate(text,text,jsonb) from public,anon; grant execute on function public.business_automation_simulate(text,text,jsonb) to authenticated;

-- Search analytics helper.
create or replace function public.global_search_log(p_query text,p_result_count integer,p_selected_result text default null) returns uuid language plpgsql security definer set search_path=public as $$ declare x uuid; begin insert into public.global_search_analytics(user_id,query,result_count,selected_result) values(auth.uid(),trim(p_query),greatest(0,p_result_count),p_selected_result) returning id into x; return x; end $$;
revoke execute on function public.global_search_log(text,integer,text) from public,anon; grant execute on function public.global_search_log(text,integer,text) to authenticated;
commit;
notify pgrst,'reload schema';

begin;
create or replace function public.ai_memory_admin_explorer(p_query text default null,p_limit integer default 50) returns jsonb language sql security definer stable set search_path=public as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) from (select id,source_type,source_id,title,content_hash,active,embedding is not null as embedded,version_no,conflict_state,expires_at,updated_at from public.ai_memory_documents where public.is_admin() and (nullif(trim(p_query),'') is null or title ilike '%'||trim(p_query)||'%' or content ilike '%'||trim(p_query)||'%') order by updated_at desc limit greatest(1,least(p_limit,200))) x $$;
revoke execute on function public.ai_memory_admin_explorer(text,integer) from public,anon; grant execute on function public.ai_memory_admin_explorer(text,integer) to authenticated;
create or replace function public.finance_v5_dashboard() returns jsonb language plpgsql security definer stable set search_path=public as $$
declare r numeric:=0;e numeric:=0;c numeric:=0;w numeric:=0;ex integer:=0;begin if not public.is_admin() then raise exception 'Finance dashboard requires admin access.' using errcode='insufficient_privilege';end if; select coalesce(sum(received_amount),0) into r from public.crm_revenue_collections where status<>'Cancelled'; select coalesce(sum((data->>'amount')::numeric),0) into e from public.transactions where data->>'kind'='expense'; select coalesce(sum((data->>'amount')::numeric),0) into c from public.apn_commissions where coalesce(data->>'status','') not in ('Cancelled','Reversed'); select coalesce(sum(amount),0) into w from public.apn_withdrawal_finance_transactions; return jsonb_build_object('revenue',r,'expenses',e,'commissions',c,'settlements',w,'net',r-e,'exceptions',ex);end $$;
revoke execute on function public.finance_v5_dashboard() from public,anon; grant execute on function public.finance_v5_dashboard() to authenticated;
commit;

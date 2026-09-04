begin;

-- CRM v5: deterministic stage automation, scoped lead intelligence, and sales forecast.
create table if not exists public.crm_stage_automation_rules (
  id text primary key,
  stage text not null unique,
  enabled boolean not null default true,
  follow_up_days integer,
  follow_up_priority text not null default 'Medium',
  activity_title text not null,
  activity_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_stage_rule_days_check check (follow_up_days is null or follow_up_days between 0 and 90),
  constraint crm_stage_rule_priority_check check (follow_up_priority in ('Low','Medium','High','Urgent'))
);

insert into public.crm_stage_automation_rules(id,stage,follow_up_days,follow_up_priority,activity_title,activity_description) values
('contacted','Contacted',2,'Medium','Stage entered: Contacted','CRM automatically prepared the next follow-up window.'),
('interested','Interested',1,'High','Stage entered: Interested','CRM automatically prepared a priority follow-up window.'),
('quotation-sent','Quotation Sent',2,'High','Stage entered: Quotation Sent','CRM automatically prepared a quotation decision follow-up.'),
('negotiation','Negotiation',1,'Urgent','Stage entered: Negotiation','CRM automatically prepared a negotiation follow-up.'),
('won','Won',null,'Medium','Opportunity won','CRM recorded the successful pipeline stage.'),
('lost','Lost',null,'Medium','Opportunity lost','CRM recorded the closed-lost pipeline stage.')
on conflict(id) do update set stage=excluded.stage,follow_up_days=excluded.follow_up_days,follow_up_priority=excluded.follow_up_priority,activity_title=excluded.activity_title,activity_description=excluded.activity_description,updated_at=now();

alter table public.crm_stage_automation_rules enable row level security;
revoke all on public.crm_stage_automation_rules from public,anon,authenticated;
grant select on public.crm_stage_automation_rules to authenticated;
drop policy if exists crm_stage_rules_select on public.crm_stage_automation_rules;
create policy crm_stage_rules_select on public.crm_stage_automation_rules for select to authenticated using (public.is_admin());

create or replace function public.crm_v5_score_lead(p_lead_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare l public.crm_leads%rowtype; score integer:=0; win integer:=0; lost integer:=0; open_fu integer:=0; done_fu integer:=0; quotes integer:=0; active_quotes integer:=0; stale integer:=0; reasons text:='';
begin
  select * into l from public.crm_leads where id=p_lead_id;
  if not found or not public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  select count(*) filter(where status='Open'),count(*) filter(where status='Completed') into open_fu,done_fu from public.crm_follow_ups where lead_id=l.id;
  select count(*),count(*) filter(where status in ('Sent','Viewed','Accepted','Converted')) into quotes,active_quotes from public.crm_quotations where lead_id=l.id;
  stale:=greatest(0,(current_date-coalesce(l.updated_at::date,l.created_at::date))::integer);
  score:=least(100,greatest(0,
    case when l.expected_budget>0 then least(20,round((l.expected_budget/100000.0)*20)::integer) else 0 end
    +case when l.expected_closing_date between current_date and current_date+90 then 15 when l.expected_closing_date is not null then 8 else 0 end
    +case when done_fu>=2 then 20 when done_fu=1 then 12 when open_fu>0 then 8 else 0 end
    +case when nullif(l.project_category,'') is not null then 10 else 0 end
    +case when l.source in ('Website','APN Referral','Referral','Existing Client') then 15 when l.source in ('WhatsApp','Instagram','Facebook') then 10 when l.source is not null then 5 else 0 end
    +case when exists(select 1 from public.crm_leads prior where prior.id<>l.id and nullif(l.email,'') is not null and lower(prior.email)=lower(l.email) and prior.status in ('Won','Converted','Closed')) then 10 else 0 end
  ));
  win:=least(99,greatest(1,score+case when l.status in ('Interested','Quotation Sent','Negotiation') then 5 else 0 end-least(20,stale)));
  lost:=greatest(1,100-win);
  reasons:=array_to_string(array_remove(array[case when l.expected_budget>0 then 'Budget captured' end,case when l.expected_closing_date between current_date and current_date+90 then 'Timeline is actionable' end,case when done_fu>0 then 'Follow-up activity recorded' end,case when quotes>0 then 'Quotation history' end,case when stale>=7 then 'No recent activity' end,case when open_fu=0 and l.status not in ('Won','Lost','Converted','Closed','Cancelled') then 'No open follow-up' end]::text[],null),' · ');
  return jsonb_build_object('lead_id',l.id,'score',score,'win_probability',win,'lost_risk',lost,'open_follow_ups',open_fu,'completed_follow_ups',done_fu,'quotation_count',quotes,'active_quotation_count',active_quotes,'stale_days',stale,'reasons',coalesce(reasons,'No additional evidence'),'next_action',case when l.status in ('Lost','Converted','Closed','Cancelled') then 'No action required' when open_fu=0 or stale>=5 then 'Schedule a follow-up today' when quotes=0 then 'Prepare and send a quotation' when active_quotes>0 then 'Confirm quotation decision' else 'Keep the conversation active' end);
end $$;

create or replace function public.crm_v5_stage_automation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.crm_stage_automation_rules%rowtype; due date; existing_id uuid;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  select * into r from public.crm_stage_automation_rules where stage=new.status and enabled;
  if not found then return new; end if;
  insert into public.crm_activities(lead_id,event_type,title,description,actor_id,actor_name,metadata)
  values(new.id,'stage_automation',r.activity_title,r.activity_description,null,'CRM Automation',jsonb_build_object('stage',new.status,'rule_id',r.id,'automated',true));
  if r.follow_up_days is not null then
    due:=current_date+r.follow_up_days;
    select f.id into existing_id from public.crm_follow_ups f where f.lead_id=new.id and f.status='Open' and f.follow_up_date>=current_date order by f.follow_up_date limit 1;
    if existing_id is null then
      insert into public.crm_follow_ups(lead_id,follow_up_date,follow_up_time,priority,notes,created_by)
      values(new.id,due,'10:00',r.follow_up_priority,format('Automated %s-stage follow-up.',new.status),'CRM Automation');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists crm_v5_stage_automation_trg on public.crm_leads;
create trigger crm_v5_stage_automation_trg after update of status on public.crm_leads for each row execute function public.crm_v5_stage_automation();
revoke execute on function public.crm_v5_score_lead(uuid),public.crm_v5_stage_automation() from public,anon,authenticated;

create or replace function public.crm_v5_dashboard()
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare stages jsonb; top_leads jsonb; open_value numeric:=0; weighted numeric:=0; won_value numeric:=0; active_count integer:=0; total_count integer:=0; customer_count integer:=0;
begin
  if not public.crm_can_manage() and not public.is_admin() then raise exception 'CRM dashboard access denied.' using errcode='insufficient_privilege'; end if;
  with scoped as (
    select l.* from public.crm_leads l where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)
  ), calc as (
    select s.*, (public.crm_v5_score_lead(s.id)->>'win_probability')::numeric as win_probability from scoped s
  )
  select coalesce(jsonb_agg(jsonb_build_object('stage',x.status,'count',x.n,'value',x.value,'weighted_value',x.weighted) order by array_position(array['New','Assigned','Contacted','Follow-up','Interested','Quotation Sent','Negotiation','Won','Lost','On Hold','Cancelled','Converted','Closed'],x.status)),'[]'::jsonb)
  into stages from (select status,count(*) n,coalesce(sum(expected_budget),0) value,coalesce(sum(case when status not in ('Won','Lost','Cancelled','Converted','Closed') then expected_budget*win_probability/100 else expected_budget end),0) weighted from calc group by status) x;
  select coalesce(sum(expected_budget),0),coalesce(sum(case when status not in ('Won','Lost','Cancelled','Converted','Closed') then expected_budget*win_probability/100 else 0 end),0),coalesce(sum(case when status in ('Won','Converted','Closed') then expected_budget else 0 end),0),count(*) filter(where status not in ('Won','Lost','Cancelled','Converted','Closed')),count(*) into open_value,weighted,won_value,active_count,total_count from calc;
  select count(*) into customer_count from (select distinct coalesce(nullif(lower(trim(email)),''),nullif(regexp_replace(mobile,'[^0-9]','','g'),''),nullif(lower(trim(company)),''),id::text) key from calc) c;
  with scored as (
    select s.id,s.lead_number,s.customer_name,s.company,s.status,s.priority,s.expected_budget,s.expected_closing_date,public.crm_v5_score_lead(s.id) intel from public.crm_leads s where public.crm_can_read(s.assigned_employee_id,s.assigned_partner_id,s.district,s.state) and s.status not in ('Won','Lost','Cancelled','Converted','Closed') order by s.expected_budget desc limit 25
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'lead_number',lead_number,'customer_name',customer_name,'company',company,'status',status,'priority',priority,'expected_budget',expected_budget,'expected_closing_date',expected_closing_date,'score',(intel->>'score')::integer,'win_probability',(intel->>'win_probability')::integer,'lost_risk',(intel->>'lost_risk')::integer,'next_action',intel->>'next_action') order by (intel->>'win_probability')::integer desc,expected_budget desc),'[]'::jsonb) into top_leads from scored;
  return jsonb_build_object('generated_at',now(),'stages',stages,'forecast',jsonb_build_object('open_pipeline',round(open_value,2),'weighted_pipeline',round(weighted,2),'won_value',round(won_value,2),'active_leads',active_count,'total_leads',total_count,'customers',customer_count),'top_leads',top_leads);
end $$;


create index if not exists crm_stage_automation_rules_enabled_idx on public.crm_stage_automation_rules(enabled,stage);
revoke execute on function public.crm_v5_dashboard() from public,anon;
grant execute on function public.crm_v5_dashboard() to authenticated;
revoke execute on function public.crm_v5_score_lead(uuid) from public,anon;
grant execute on function public.crm_v5_score_lead(uuid) to authenticated;

commit;
notify pgrst,'reload schema';

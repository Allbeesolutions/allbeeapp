-- Business Automation Engine v2: scheduled + event-driven detection, with explicit approval queue.
begin;
create table if not exists public.business_automation_rules (
  id text primary key,
  title text not null,
  trigger_type text not null check(trigger_type in ('scheduled','event')),
  entity text not null,
  condition_key text not null,
  action_type text not null check(action_type in ('notify','schedule_follow_up','send_email','send_whatsapp')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.business_automation_queue (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null references public.business_automation_rules(id) on delete cascade,
  entity text not null,
  entity_id uuid,
  status text not null default 'pending_approval' check(status in ('pending_approval','approved','rejected','executing','executed','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(), requested_by uuid,
  reviewed_at timestamptz, reviewed_by uuid, executed_at timestamptz, failure_reason text,
  unique(rule_id,entity_id)
);
create index if not exists business_automation_queue_status_idx on public.business_automation_queue(status,requested_at desc);
alter table public.business_automation_rules enable row level security;
alter table public.business_automation_queue enable row level security;
revoke all on public.business_automation_rules,public.business_automation_queue from public,anon,authenticated;
grant select on public.business_automation_rules,public.business_automation_queue to authenticated;
drop policy if exists business_automation_rules_select on public.business_automation_rules;
create policy business_automation_rules_select on public.business_automation_rules for select to authenticated using(public.is_admin());
drop policy if exists business_automation_queue_select on public.business_automation_queue;
create policy business_automation_queue_select on public.business_automation_queue for select to authenticated using(public.is_admin() or requested_by=auth.uid() or reviewed_by=auth.uid());

insert into public.business_automation_rules(id,title,trigger_type,entity,condition_key,action_type,config) values
('stale-lead-review','Stale lead review','scheduled','crm_leads','stale_7d','notify','{"days":7,"priority":"Important"}'),
('overdue-followup-review','Overdue follow-up review','scheduled','crm_follow_ups','overdue','notify','{"priority":"Urgent"}'),
('quote-expiry-review','Quotation expiry review','scheduled','crm_quotations','expired_active','notify','{"priority":"Important"}')
on conflict(id) do update set title=excluded.title,trigger_type=excluded.trigger_type,entity=excluded.entity,condition_key=excluded.condition_key,action_type=excluded.action_type,config=excluded.config,updated_at=now();

create or replace function public.business_automation_queue_one(p_rule_id text,p_entity text,p_entity_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_id uuid;
begin
  insert into public.business_automation_queue(rule_id,entity,entity_id,payload,requested_by) values(p_rule_id,p_entity,p_entity_id,coalesce(p_payload,'{}'::jsonb),auth.uid()) on conflict(rule_id,entity_id) do nothing returning id into v_id;
  return v_id;
end $$;

create or replace function public.business_automation_tick()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n integer:=0; l record; f record; q record; v_id uuid;
begin
  -- Scheduler context is trusted database execution; clients cannot call this function.
  for l in select id,customer_name from public.crm_leads where status not in ('Won','Lost','Cancelled','Converted','Closed') and coalesce(updated_at,created_at)<now()-interval '7 days' loop
    insert into public.business_automation_queue(rule_id,entity,entity_id,payload) values('stale-lead-review','crm_leads',l.id,jsonb_build_object('title','Stale lead review','customer_name',l.customer_name,'reason','No meaningful CRM update for 7+ days')) on conflict(rule_id,entity_id) do nothing; if found then n:=n+1; end if;
  end loop;
  for f in select id,lead_id,follow_up_date from public.crm_follow_ups where status='Open' and follow_up_date<current_date loop
    insert into public.business_automation_queue(rule_id,entity,entity_id,payload) values('overdue-followup-review','crm_follow_ups',f.id,jsonb_build_object('lead_id',f.lead_id,'follow_up_date',f.follow_up_date,'reason','Open follow-up is overdue')) on conflict(rule_id,entity_id) do nothing; if found then n:=n+1; end if;
  end loop;
  for q in select id,lead_id,quote_number,validity_until from public.crm_quotations where status not in ('Accepted','Converted','Rejected','Expired') and validity_until<current_date loop
    insert into public.business_automation_queue(rule_id,entity,entity_id,payload) values('quote-expiry-review','crm_quotations',q.id,jsonb_build_object('lead_id',q.lead_id,'quote_number',q.quote_number,'validity_until',q.validity_until,'reason','Active quotation is past validity')) on conflict(rule_id,entity_id) do nothing; if found then n:=n+1; end if;
  end loop;
  return jsonb_build_object('queued',n,'ran_at',now());
end $$;

create or replace function public.business_automation_event(p_entity text,p_entity_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if p_entity='crm_leads' and exists(select 1 from public.crm_leads where id=p_entity_id and status not in ('Won','Lost','Cancelled','Converted','Closed') and coalesce(updated_at,created_at)<now()-interval '7 days') then perform public.business_automation_queue_one('stale-lead-review',p_entity,p_entity_id,jsonb_build_object('reason','Lead crossed the stale threshold.')); end if;
  if p_entity='crm_follow_ups' and exists(select 1 from public.crm_follow_ups where id=p_entity_id and status='Open' and follow_up_date<current_date) then perform public.business_automation_queue_one('overdue-followup-review',p_entity,p_entity_id,jsonb_build_object('reason','Follow-up became overdue.')); end if;
  if p_entity='crm_quotations' and exists(select 1 from public.crm_quotations where id=p_entity_id and status not in ('Accepted','Converted','Rejected','Expired') and validity_until<current_date) then perform public.business_automation_queue_one('quote-expiry-review',p_entity,p_entity_id,jsonb_build_object('reason','Quotation crossed validity.')); end if;
end $$;
create or replace function public.business_automation_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.business_automation_event(TG_TABLE_NAME,NEW.id); return NEW; end $$;

drop trigger if exists business_automation_lead_event on public.crm_leads;
create trigger business_automation_lead_event after insert or update of status,updated_at on public.crm_leads for each row execute function public.business_automation_trigger();
drop trigger if exists business_automation_followup_event on public.crm_follow_ups;
create trigger business_automation_followup_event after insert or update of status,follow_up_date on public.crm_follow_ups for each row execute function public.business_automation_trigger();
drop trigger if exists business_automation_quote_event on public.crm_quotations;
create trigger business_automation_quote_event after insert or update of status,validity_until on public.crm_quotations for each row execute function public.business_automation_trigger();

create or replace function public.business_automation_approve(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.business_automation_queue%rowtype;
begin
  if not public.is_admin() then raise exception 'Automation approval requires admin access.' using errcode='insufficient_privilege'; end if;
  select * into v from public.business_automation_queue where id=p_id for update; if not found then raise exception 'Automation item not found.' using errcode='no_data_found'; end if;
  if v.status<>'pending_approval' then raise exception 'Only pending automation items can be approved.' using errcode='check_violation'; end if;
  update public.business_automation_queue set status='approved',reviewed_at=now(),reviewed_by=auth.uid() where id=p_id returning * into v;
  return to_jsonb(v);
end $$;
create or replace function public.business_automation_reject(p_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.business_automation_queue%rowtype;
begin
  if not public.is_admin() then raise exception 'Automation rejection requires admin access.' using errcode='insufficient_privilege'; end if;
  update public.business_automation_queue set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),failure_reason=nullif(trim(coalesce(p_reason,'')),'') where id=p_id and status='pending_approval' returning * into v;
  if not found then raise exception 'Only pending automation items can be rejected.' using errcode='check_violation'; end if;
  return to_jsonb(v);
end $$;

revoke execute on function public.business_automation_tick(),public.business_automation_event(text,uuid),public.business_automation_trigger(),public.business_automation_queue_one(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.business_automation_approve(uuid),public.business_automation_reject(uuid,text) to authenticated;
-- Run every hour where pg_cron is available. The app remains functional if the extension is unavailable.
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then begin perform cron.unschedule('allbee_business_automation'); exception when others then null; end; perform cron.schedule('allbee_business_automation','7 * * * *','select public.business_automation_tick();'); end if; end $$;
commit;
notify pgrst,'reload schema';

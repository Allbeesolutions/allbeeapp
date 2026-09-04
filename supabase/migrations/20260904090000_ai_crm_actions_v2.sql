-- ALLBEE AI CRM Actions v2: approval-gated, auditable real actions.
create table if not exists public.ai_crm_actions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  action_type text not null check (action_type in ('send_email','send_whatsapp','schedule_follow_up')),
  status text not null default 'suggested' check (status in ('suggested','approved','executing','executed','rejected','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid not null default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_crm_actions_lead_created_idx on public.ai_crm_actions(lead_id, created_at desc);
create index if not exists ai_crm_actions_status_idx on public.ai_crm_actions(status, created_at desc);
alter table public.ai_crm_actions enable row level security;
drop policy if exists ai_crm_actions_select on public.ai_crm_actions;
create policy ai_crm_actions_select on public.ai_crm_actions for select to authenticated using (public.is_admin() or requested_by = auth.uid() or exists (select 1 from public.crm_leads l where l.id = lead_id and public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)));
revoke all on public.ai_crm_actions from anon, public, authenticated;
grant select on public.ai_crm_actions to authenticated;

create or replace function public.ai_crm_action_create(p_lead_id uuid,p_action_type text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_lead public.crm_leads%rowtype;
begin
  if p_action_type not in ('send_email','send_whatsapp','schedule_follow_up') then raise exception 'Unsupported AI CRM action.' using errcode='invalid_parameter_value'; end if;
  select * into v_lead from public.crm_leads where id=p_lead_id;
  if not found or not public.crm_can_read(v_lead.assigned_employee_id,v_lead.assigned_partner_id,v_lead.district,v_lead.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  if p_action_type='send_email' and nullif(trim(coalesce(p_payload->>'to','')),'') is null then raise exception 'Email recipient is required.' using errcode='check_violation'; end if;
  if p_action_type='send_whatsapp' and nullif(regexp_replace(coalesce(p_payload->>'to',''),'[^0-9+]','','g'),'') is null then raise exception 'WhatsApp recipient is required.' using errcode='check_violation'; end if;
  if p_action_type='schedule_follow_up' and nullif(trim(coalesce(p_payload->>'follow_up_date','')),'') is null then raise exception 'Follow-up date is required.' using errcode='check_violation'; end if;
  insert into public.ai_crm_actions(lead_id,action_type,payload,requested_by) values(p_lead_id,p_action_type,coalesce(p_payload,'{}'::jsonb),auth.uid()) returning id into v_id;
  perform public.crm_log_event('ai_action_suggested','AI CRM action prepared',format('Approval requested for %s.',replace(p_action_type,'_',' ')),p_lead_id,null,null,jsonb_build_object('actionId',v_id,'actionType',p_action_type));
  return jsonb_build_object('id',v_id,'status','suggested','actionType',p_action_type);
end $$;

create or replace function public.ai_crm_action_approve(p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype; l public.crm_leads%rowtype;
begin
  select * into v from public.ai_crm_actions where id=p_action_id for update;
  if not found then raise exception 'AI CRM action not found.' using errcode='no_data_found'; end if;
  select * into l from public.crm_leads where id=v.lead_id;
  if not found or not public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  if v.status <> 'suggested' then raise exception 'Only a suggested action can be approved.' using errcode='check_violation'; end if;
  update public.ai_crm_actions set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=v.id returning * into v;
  perform public.crm_log_event('ai_action_approved','AI CRM action approved',format('%s approved; execution is now authorized.',replace(v.action_type,'_',' ')),v.lead_id,null,null,jsonb_build_object('actionId',v.id,'actionType',v.action_type,'approvedBy',auth.uid()));
  return to_jsonb(v);
end $$;

create or replace function public.ai_crm_action_reject(p_action_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype;
begin
  select * into v from public.ai_crm_actions where id=p_action_id for update;
  if not found then raise exception 'AI CRM action not found.' using errcode='no_data_found'; end if;
  if not public.crm_can_read((select assigned_employee_id from public.crm_leads where id=v.lead_id),(select assigned_partner_id from public.crm_leads where id=v.lead_id),(select district from public.crm_leads where id=v.lead_id),(select state from public.crm_leads where id=v.lead_id)) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  if v.status <> 'suggested' then raise exception 'Only a suggested action can be rejected.' using errcode='check_violation'; end if;
  update public.ai_crm_actions set status='rejected',failure_reason=nullif(trim(coalesce(p_reason,'')),''),updated_at=now() where id=v.id returning * into v;
  perform public.crm_log_event('ai_action_rejected','AI CRM action rejected',coalesce(nullif(trim(p_reason),''),'Human reviewer rejected the proposed action.'),v.lead_id,null,null,jsonb_build_object('actionId',v.id,'actionType',v.action_type));
  return to_jsonb(v);
end $$;

-- Claims an approved send action exactly once. The provider function completes it later.
create or replace function public.ai_crm_action_claim(p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype; l public.crm_leads%rowtype;
begin
  select * into v from public.ai_crm_actions where id=p_action_id for update;
  if not found then raise exception 'AI CRM action not found.' using errcode='no_data_found'; end if;
  if v.status <> 'approved' then raise exception 'Action is not approved or has already been claimed.' using errcode='check_violation'; end if;
  select * into l from public.crm_leads where id=v.lead_id;
  if not found or not public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  update public.ai_crm_actions set status='executing',updated_at=now() where id=v.id returning * into v;
  return jsonb_build_object('id',v.id,'leadId',v.lead_id,'actionType',v.action_type,'payload',v.payload,'approvedBy',v.approved_by);
end $$;

create or replace function public.ai_crm_action_complete(p_action_id uuid,p_ok boolean,p_failure_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype;
begin
  select * into v from public.ai_crm_actions where id=p_action_id for update;
  if not found then raise exception 'AI CRM action not found.' using errcode='no_data_found'; end if;
  if v.status <> 'executing' then raise exception 'Action is not executing.' using errcode='check_violation'; end if;
  update public.ai_crm_actions set status=case when p_ok then 'executed' else 'failed' end,executed_at=case when p_ok then now() else null end,failure_reason=case when p_ok then null else nullif(trim(coalesce(p_failure_reason,'')),'') end,updated_at=now() where id=v.id returning * into v;
  perform public.crm_log_event(case when p_ok then 'ai_action_executed' else 'ai_action_failed' end,case when p_ok then 'AI CRM action executed' else 'AI CRM action failed' end,case when p_ok then format('%s was executed after human approval.',replace(v.action_type,'_',' ')) else coalesce(v.failure_reason,'Provider execution failed.') end,v.lead_id,null,null,jsonb_build_object('actionId',v.id,'actionType',v.action_type));
  return to_jsonb(v);
end $$;

create or replace function public.ai_crm_action_execute_schedule(p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_crm_actions%rowtype; l public.crm_leads%rowtype; f public.crm_follow_ups%rowtype;
begin
  select * into v from public.ai_crm_actions where id=p_action_id for update;
  if not found or v.action_type <> 'schedule_follow_up' then raise exception 'Schedule action not found.' using errcode='no_data_found'; end if;
  if v.status <> 'approved' then raise exception 'Action is not approved or has already been executed.' using errcode='check_violation'; end if;
  select * into l from public.crm_leads where id=v.lead_id;
  if not found or not public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) then raise exception 'CRM lead access denied.' using errcode='insufficient_privilege'; end if;
  insert into public.crm_follow_ups(lead_id,follow_up_date,follow_up_time,reminder_at,priority,notes,next_follow_up,created_by)
  values(v.lead_id,(v.payload->>'follow_up_date')::date,nullif(v.payload->>'follow_up_time','')::time,nullif(v.payload->>'reminder_at','')::timestamptz,coalesce(nullif(v.payload->>'priority',''),'Medium'),coalesce(v.payload->>'notes',''),nullif(v.payload->>'next_follow_up','')::date,auth.uid()::text) returning * into f;
  update public.crm_leads set status=case when status in ('New','Assigned','Contacted') then 'Follow-up' else status end,updated_at=now() where id=v.lead_id;
  update public.ai_crm_actions set status='executed',executed_at=now(),updated_at=now() where id=v.id returning * into v;
  perform public.crm_log_event('ai_action_executed','AI follow-up scheduled','Follow-up was scheduled after human approval.',v.lead_id,null,null,jsonb_build_object('actionId',v.id,'followUpId',f.id,'actionType',v.action_type));
  perform public.crm_notify('AI follow-up scheduled','An AI-prepared CRM follow-up was scheduled after human approval.','Normal',v.lead_id);
  return jsonb_build_object('action',to_jsonb(v),'followUp',to_jsonb(f));
end $$;

revoke all on function public.ai_crm_action_create(uuid,text,jsonb),public.ai_crm_action_approve(uuid),public.ai_crm_action_reject(uuid,text),public.ai_crm_action_claim(uuid),public.ai_crm_action_complete(uuid,boolean,text),public.ai_crm_action_execute_schedule(uuid) from anon,public;
grant execute on function public.ai_crm_action_create(uuid,text,jsonb),public.ai_crm_action_approve(uuid),public.ai_crm_action_reject(uuid,text),public.ai_crm_action_claim(uuid),public.ai_crm_action_complete(uuid,boolean,text),public.ai_crm_action_execute_schedule(uuid) to authenticated;

-- PR-UX-3 — canonical APN progression for database-created projects.
-- Additive and safe to rerun. The progression is centralized here and does
-- not allow legacy partner-level defaults to override the canonical rules.

begin;

create or replace function public.apn_commission_rate_for_project(
  p_partner_id text,
  p_project_number integer default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_completed integer := 0;
  v_project_number integer;
begin
  if p_project_number is null then
    select count(*)::integer
    into v_completed
    from public.apn_commission_projects p
    where coalesce(p.partner_id, p.data->>'partnerId') = p_partner_id
      and lower(coalesce(p.status, p.data->>'status', '')) = 'completed';

    select v_completed + count(*)::integer
    into v_completed
    from public.apn_commissions c
    where c.data->>'partnerId' = p_partner_id
      and coalesce(c.data->>'kind', 'partner') <> 'district';
    v_project_number := v_completed + 1;
  else
    v_project_number := greatest(1, p_project_number);
  end if;

  return case
    when v_project_number = 1 then 10
    when v_project_number between 2 and 9 then 15
    else 20
  end;
end;
$$;

revoke all on function public.apn_commission_rate_for_project(text, integer) from public;
grant execute on function public.apn_commission_rate_for_project(text, integer) to authenticated;

create or replace function public.crm_convert_quotation(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.crm_quotations%rowtype; l public.crm_leads%rowtype; p public.crm_projects%rowtype; apn_id text; apn_rate numeric; apn_data jsonb; v_apn_project_id text;
begin
  if not public.is_admin() then raise exception 'Only CRM administrators may convert quotations.' using errcode='insufficient_privilege'; end if;
  select * into q from public.crm_quotations where id=p_quote_id for update; if not found then raise exception 'Quotation not found.' using errcode='no_data_found'; end if;
  select * into l from public.crm_leads where id=q.lead_id for update;
  if q.status not in ('Accepted','Converted') then raise exception 'Only accepted quotations can create projects.' using errcode='check_violation'; end if;
  select * into p from public.crm_projects where quotation_id=q.id limit 1;
  if p.id is null then
    insert into public.crm_projects(project_number,lead_id,quotation_id,client_id,name,service_type,project_value,assigned_employee_id,assigned_partner_id,created_by)
    values('PRJ-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,q.id,q.client_id,q.title,q.service_type,q.grand_total,l.assigned_employee_id,l.assigned_partner_id,auth.uid()::text) returning * into p;
  end if;
  apn_id := nullif(l.assigned_partner_id,'');
  if apn_id is not null and to_regclass('public.apn_commission_projects') is not null and p.apn_project_id is null then
    apn_rate := public.apn_commission_rate_for_project(apn_id);
    v_apn_project_id := 'crm-'||p.id::text;
    apn_data := jsonb_build_object('id',v_apn_project_id,'partnerId',apn_id,'projectName',p.name,'clientName',l.customer_name,'category',p.service_type,'projectValue',p.project_value,'commissionRate',apn_rate,'maximumCommission',round(p.project_value*apn_rate/100,2),'totalReceived',0,'remainingAmount',p.project_value,'remainingCommission',round(p.project_value*apn_rate/100,2),'status','Pending','createdBy',auth.uid()::text,'createdAt',(extract(epoch from now())*1000)::bigint);
    insert into public.apn_commission_projects(id,data,updated_at) values(v_apn_project_id,apn_data,now()) on conflict(id) do nothing;
    update public.crm_projects set apn_project_id=v_apn_project_id,updated_at=now() where id=p.id returning * into p;
  end if;
  update public.crm_quotations set status='Converted',updated_at=now() where id=q.id;
  update public.crm_leads set status='Converted',converted_at=coalesce(converted_at,now()),project_id=p.id,updated_at=now() where id=l.id;
  perform public.crm_log_event('project_created','Project created',format('%s was created from %s.',p.name,q.quote_number),l.id,p.id,q.id);
  perform public.crm_notify('Project created',format('%s is now in the delivery pipeline.',p.name),'Important',l.id);
  return to_jsonb(p);
end $$;

create or replace function public.proposal_finalize_approval(p_proposal_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals%rowtype; l public.crm_leads%rowtype; q public.crm_quotations%rowtype; pr public.crm_projects%rowtype; snap jsonb; schedule jsonb; item jsonb; apn_key text; apn_rate numeric; i integer:=0;
begin
  select * into p from public.proposals where id=p_proposal_id for update; if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  snap:=coalesce((select snapshot from public.proposal_versions where proposal_id=p.id and version=p.current_version),'{}'::jsonb);
  if p.crm_lead_id is not null then select * into l from public.crm_leads where id=p.crm_lead_id for update; end if;
  select * into q from public.crm_quotations where proposal_id=p.id limit 1;
  if q.id is null and l.id is not null then
    insert into public.crm_quotations(quote_number,lead_id,client_id,service_type,title,items,subtotal,discount,tax,gst,grand_total,validity_until,status,approval_status,created_by,proposal_id)
    values('QT-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,l.client_id,coalesce((select name from public.services where slug=p.service_slug),initcap(replace(p.service_slug,'-',' '))),p.proposal_title,coalesce(snap->'pricing'->'optional_addons','[]'::jsonb),p.subtotal,p.discount_amount,p.tax_amount,p.tax_amount,p.grand_total,p.expires_at::date,'Accepted','Approved',coalesce(auth.uid()::text,'proposal-engine'),p.id) returning * into q;
    update public.crm_leads set quotation_id=q.id,status='Converted',updated_at=now() where id=l.id;
  end if;
  select * into pr from public.crm_projects where quotation_id=q.id limit 1;
  if pr.id is null and q.id is not null and l.id is not null then
    insert into public.crm_projects(project_number,lead_id,quotation_id,client_id,name,service_type,project_value,status,assigned_employee_id,assigned_partner_id,created_by)
    values('PRJ-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.crm_lead_number_seq')::text,5,'0'),l.id,q.id,q.client_id,p.proposal_title,p.service_slug,p.grand_total,'Open',l.assigned_employee_id,l.assigned_partner_id,coalesce(auth.uid()::text,'proposal-engine')) returning * into pr;
    update public.crm_leads set project_id=pr.id,status='Converted',converted_at=coalesce(converted_at,now()),updated_at=now() where id=l.id;
  end if;
  schedule:=coalesce(snap->'knowledge'->'payment_terms','[]'::jsonb);
  for item in select value from jsonb_array_elements(schedule) loop
    i:=i+1; insert into public.crm_project_milestones(project_id,proposal_id,name,sort_order,percentage,status) values(pr.id,p.id,coalesce(item->>'label','Payment milestone '||i),i,coalesce(nullif(item->>'percent','')::numeric,0),'Pending');
  end loop;
  if l.assigned_partner_id is not null and to_regclass('public.apn_commission_projects') is not null and pr.id is not null then
    apn_key:='proposal-'||pr.id::text; apn_rate:=public.apn_commission_rate_for_project(l.assigned_partner_id);
    insert into public.apn_commission_projects(id,data,updated_at) values(apn_key,jsonb_build_object('id',apn_key,'partnerId',l.assigned_partner_id,'projectName',pr.name,'clientName',p.customer_name,'category',p.service_slug,'projectValue',p.grand_total,'commissionRate',apn_rate,'maximumCommission',round(p.grand_total*apn_rate/100,2),'totalReceived',0,'remainingAmount',p.grand_total,'remainingCommission',round(p.grand_total*apn_rate/100,2),'status','Pending','createdBy','proposal-engine','createdAt',(extract(epoch from now())*1000)::bigint),now()) on conflict(id) do nothing;
    update public.crm_projects set apn_project_id=apn_key,updated_at=now() where id=pr.id;
  end if;
  update public.proposals set status='converted',updated_at=now() where id=p.id;
  perform public.proposal_log(p.id,'converted',jsonb_build_object('description','Customer-approved proposal converted to CRM project.','crm_quotation_id',q.id,'crm_project_id',pr.id),'system');
  return jsonb_build_object('proposal_id',p.id,'quotation_id',q.id,'project_id',pr.id,'apn_project_id',apn_key);
end $$;

notify pgrst, 'reload schema';
commit;

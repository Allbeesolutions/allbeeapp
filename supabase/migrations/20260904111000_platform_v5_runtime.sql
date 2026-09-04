-- Runtime completion: CRM/APN memory ingestion, fuzzy search primitives, APN/finance intelligence.
begin;
create extension if not exists pg_trgm;

create or replace function public.ai_memory_sync_business()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0; r record;
begin
 if not public.ai_can_read() then raise exception 'AI memory access denied.' using errcode='insufficient_privilege'; end if;
 for r in select id::text source_id,customer_name,title,status,priority,expected_budget,remarks from public.crm_leads loop
  insert into public.ai_memory_documents(source_type,source_id,title,content,metadata,content_hash,active,updated_at)
  values('crm_lead',r.source_id,coalesce(r.customer_name,'CRM lead'),format('Lead %s status %s priority %s budget %s. %s',coalesce(r.customer_name,''),coalesce(r.status,''),coalesce(r.priority,''),coalesce(r.expected_budget,0),coalesce(r.remarks,'')),jsonb_build_object('entity','crm_leads','status',r.status),encode(extensions.digest(coalesce(r.customer_name,'')||coalesce(r.status,'')||coalesce(r.remarks,''),'sha256'),'hex'),true,now())
  on conflict(source_type,source_id) do update set title=excluded.title,content=excluded.content,metadata=excluded.metadata,content_hash=excluded.content_hash,active=true,updated_at=now(); n:=n+1;
 end loop;
 for r in select id::text source_id,name,status,district,state from public.apn_users where status='active' loop
  insert into public.ai_memory_documents(source_type,source_id,title,content,metadata,content_hash,active,updated_at)
  values('apn_partner',r.source_id,coalesce(r.name,'APN partner'),format('APN partner %s is active in %s, %s.',coalesce(r.name,''),coalesce(r.district,''),coalesce(r.state,'')),jsonb_build_object('entity','apn_users','district',r.district,'state',r.state),encode(extensions.digest(coalesce(r.name,'')||coalesce(r.district,'')||coalesce(r.state,''),'sha256'),'hex'),true,now())
  on conflict(source_type,source_id) do update set title=excluded.title,content=excluded.content,metadata=excluded.metadata,content_hash=excluded.content_hash,active=true,updated_at=now(); n:=n+1;
 end loop;
 return n;
end $$;
revoke execute on function public.ai_memory_sync_business() from public,anon; grant execute on function public.ai_memory_sync_business() to authenticated;

create or replace function public.apn_network_intelligence()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare partners integer; districts integer; states integer; revenue numeric; commissions numeric;
begin
 if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
 select count(*),count(distinct district),count(distinct state) into partners,districts,states from public.apn_users where status='active';
 select coalesce(sum(received_amount),0) into revenue from public.apn_revenue_collections where coalesce(status,'')<>'Cancelled';
 select coalesce(sum((data->>'amount')::numeric),0) into commissions from public.apn_commissions where coalesce(data->>'status','') not in ('Cancelled','Reversed');
 return jsonb_build_object('active_partners',partners,'districts',districts,'states',states,'revenue',revenue,'commissions',commissions,'commission_rate',case when revenue>0 then round(commissions*100/revenue,2) else 0 end);
end $$;
revoke execute on function public.apn_network_intelligence() from public,anon; grant execute on function public.apn_network_intelligence() to authenticated;

create or replace function public.ai_cash_flow_signals()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare collected numeric; pending numeric; expense numeric; margin numeric;
begin
 if not public.ai_can_read() then raise exception 'AI access denied.' using errcode='insufficient_privilege'; end if;
 select coalesce(sum(received_amount),0) into collected from public.crm_revenue_collections where status<>'Cancelled';
 select coalesce(sum(expected_budget),0) into pending from public.crm_leads where status not in ('Won','Lost','Cancelled','Converted','Closed');
 select coalesce(sum((data->>'amount')::numeric),0) into expense from public.transactions where data->>'kind'='expense';
 margin:=collected-expense;
 return jsonb_build_object('collected',collected,'open_pipeline',pending,'expenses',expense,'net_cash',margin,'signal',case when margin<0 then 'critical' when pending>collected*2 then 'watch' else 'healthy' end);
end $$;
revoke execute on function public.ai_cash_flow_signals() from public,anon; grant execute on function public.ai_cash_flow_signals() to authenticated;

create table if not exists public.security_permission_matrix(
 role text not null, resource text not null, can_read boolean not null default false, can_create boolean not null default false,
 can_update boolean not null default false, can_delete boolean not null default false, updated_at timestamptz not null default now(), primary key(role,resource)
);
alter table public.security_permission_matrix enable row level security;
revoke all on public.security_permission_matrix from public,anon,authenticated; grant select on public.security_permission_matrix to authenticated;
create policy security_permission_matrix_admin on public.security_permission_matrix for select to authenticated using(public.is_admin());
insert into public.security_permission_matrix(role,resource,can_read,can_create,can_update,can_delete) values
('superadmin','all',true,true,true,true),('admin','business',true,true,true,true),('accountant','finance',true,true,true,false),('staff','crm',true,true,true,false),('partner','apn_scoped',true,true,true,false),('district_head','apn_district',true,true,true,false),('state_head','apn_state',true,true,true,false)
on conflict(role,resource) do update set can_read=excluded.can_read,can_create=excluded.can_create,can_update=excluded.can_update,can_delete=excluded.can_delete,updated_at=now();

commit;
notify pgrst,'reload schema';

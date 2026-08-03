-- ALLBEE APN Commission Engine V4
-- Run after schema.sql and the existing APN migrations.
-- Additive, backward-compatible, and safe to re-run.

create table if not exists public.apn_commission_projects (
  id text primary key,
  partner_id text,
  project_name text,
  client_name text,
  category text,
  project_value numeric not null default 0,
  commission_rate numeric not null default 0,
  maximum_commission numeric not null default 0,
  total_received numeric not null default 0,
  total_commission_paid numeric not null default 0,
  remaining_amount numeric not null default 0,
  remaining_commission numeric not null default 0,
  status text not null default 'Pending',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.apn_revenue_collections (
  id text primary key,
  project_id text not null,
  partner_id text,
  received_amount numeric not null default 0,
  commission_generated numeric not null default 0,
  incentive numeric not null default 0,
  remarks text,
  received_date date not null default current_date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  commission_status text not null default 'Pending',
  data jsonb not null default '{}'::jsonb
);

alter table public.apn_commission_projects add column if not exists partner_id text;
alter table public.apn_commission_projects add column if not exists project_name text;
alter table public.apn_commission_projects add column if not exists client_name text;
alter table public.apn_commission_projects add column if not exists category text;
alter table public.apn_commission_projects add column if not exists project_value numeric not null default 0;
alter table public.apn_commission_projects add column if not exists commission_rate numeric not null default 0;
alter table public.apn_commission_projects add column if not exists maximum_commission numeric not null default 0;
alter table public.apn_commission_projects add column if not exists total_received numeric not null default 0;
alter table public.apn_commission_projects add column if not exists total_commission_paid numeric not null default 0;
alter table public.apn_commission_projects add column if not exists remaining_amount numeric not null default 0;
alter table public.apn_commission_projects add column if not exists remaining_commission numeric not null default 0;
alter table public.apn_commission_projects add column if not exists status text not null default 'Pending';
alter table public.apn_commission_projects add column if not exists created_by text;
alter table public.apn_commission_projects add column if not exists created_at timestamptz not null default now();
alter table public.apn_commission_projects add column if not exists updated_at timestamptz not null default now();
alter table public.apn_commission_projects add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.apn_revenue_collections add column if not exists project_id text;
alter table public.apn_revenue_collections add column if not exists partner_id text;
alter table public.apn_revenue_collections add column if not exists received_amount numeric not null default 0;
alter table public.apn_revenue_collections add column if not exists commission_generated numeric not null default 0;
alter table public.apn_revenue_collections add column if not exists incentive numeric not null default 0;
alter table public.apn_revenue_collections add column if not exists remarks text;
alter table public.apn_revenue_collections add column if not exists received_date date not null default current_date;
alter table public.apn_revenue_collections add column if not exists created_by text;
alter table public.apn_revenue_collections add column if not exists created_at timestamptz not null default now();
alter table public.apn_revenue_collections add column if not exists updated_at timestamptz not null default now();
alter table public.apn_revenue_collections add column if not exists commission_status text not null default 'Pending';
alter table public.apn_revenue_collections add column if not exists data jsonb not null default '{}'::jsonb;

alter table public.apn_commission_projects drop constraint if exists apn_commission_projects_status_check;
alter table public.apn_commission_projects add constraint apn_commission_projects_status_check check (status in ('Pending','Processing','Completed','Cancelled')) not valid;
alter table public.apn_commission_projects drop constraint if exists apn_commission_projects_values_check;
alter table public.apn_commission_projects add constraint apn_commission_projects_values_check check (project_value >= 0 and commission_rate between 0 and 100 and maximum_commission >= 0 and total_received >= 0 and total_commission_paid >= 0 and remaining_amount >= 0 and remaining_commission >= 0) not valid;
alter table public.apn_revenue_collections drop constraint if exists apn_revenue_collections_values_check;
alter table public.apn_revenue_collections add constraint apn_revenue_collections_values_check check (received_amount > 0 and commission_generated >= 0 and incentive >= 0) not valid;
alter table public.apn_revenue_collections drop constraint if exists apn_revenue_collections_status_check;
alter table public.apn_revenue_collections add constraint apn_revenue_collections_status_check check (commission_status in ('Pending','Approved','Payable','Paid')) not valid;

-- Trigger functions may already exist from an earlier commission-engine pass.
-- Drop only their owning triggers first so a future return-type change cannot
-- leave CREATE OR REPLACE blocked by a dependency.
drop trigger if exists apn_commission_project_sync_trg on public.apn_commission_projects;
drop trigger if exists apn_revenue_collection_sync_trg on public.apn_revenue_collections;
drop function if exists public.apn_commission_project_sync();
drop function if exists public.apn_revenue_collection_sync();
create or replace function public.apn_commission_project_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.partner_id := nullif(new.data->>'partnerId', '');
  new.project_name := coalesce(new.data->>'projectName', new.data->>'project', new.project_name);
  new.client_name := coalesce(new.data->>'clientName', new.client_name);
  new.category := coalesce(new.data->>'category', new.data->>'service', new.category);
  new.project_value := coalesce(nullif(new.data->>'projectValue','')::numeric, new.project_value, 0);
  new.commission_rate := coalesce(nullif(new.data->>'commissionRate','')::numeric, nullif(new.data->>'rate','')::numeric, new.commission_rate, 0);
  new.maximum_commission := coalesce(nullif(new.data->>'maximumCommission','')::numeric, round(new.project_value * new.commission_rate / 100, 2));
  new.total_received := coalesce(nullif(new.data->>'totalReceived','')::numeric, new.total_received, 0);
  new.total_commission_paid := coalesce(nullif(new.data->>'totalCommissionPaid','')::numeric, new.total_commission_paid, 0);
  new.remaining_amount := coalesce(nullif(new.data->>'remainingAmount','')::numeric, greatest(0, new.project_value - new.total_received));
  new.remaining_commission := coalesce(nullif(new.data->>'remainingCommission','')::numeric, greatest(0, new.maximum_commission - least(new.maximum_commission, new.total_received * new.commission_rate / 100)));
  new.status := coalesce(new.data->>'status', new.status, 'Pending');
  new.created_by := coalesce(new.data->>'createdBy', new.created_by, public.current_name());
  if new.data ? 'createdAt' then new.created_at := to_timestamp((new.data->>'createdAt')::numeric / 1000); end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.apn_revenue_collection_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.project_id := coalesce(nullif(new.data->>'projectId',''), new.project_id);
  new.partner_id := coalesce(nullif(new.data->>'partnerId',''), new.partner_id);
  new.received_amount := coalesce(nullif(new.data->>'receivedAmount','')::numeric, new.received_amount, 0);
  new.commission_generated := coalesce(nullif(new.data->>'commissionGenerated','')::numeric, new.commission_generated, 0);
  new.incentive := coalesce(nullif(new.data->>'incentive','')::numeric, new.incentive, 0);
  new.remarks := coalesce(new.data->>'remarks', new.remarks);
  if nullif(new.data->>'receivedDate','') is not null then new.received_date := (new.data->>'receivedDate')::date; end if;
  new.created_by := coalesce(new.data->>'createdBy', new.created_by, public.current_name());
  if new.data ? 'createdAt' then new.created_at := to_timestamp((new.data->>'createdAt')::numeric / 1000); end if;
  new.commission_status := coalesce(new.data->>'commissionStatus', new.commission_status, 'Pending');
  return new;
end $$;

create trigger apn_commission_project_sync_trg before insert or update on public.apn_commission_projects for each row execute function public.apn_commission_project_sync();
create trigger apn_revenue_collection_sync_trg before insert or update on public.apn_revenue_collections for each row execute function public.apn_revenue_collection_sync();

drop function if exists public.upsert_apn_commission_project(jsonb, jsonb);
create or replace function public.upsert_apn_commission_project(p_project jsonb, p_collections jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_project_id text := nullif(p_project->>'id','');
  v_partner_id text := nullif(p_project->>'partnerId','');
  v_project_value numeric := greatest(0, coalesce(nullif(p_project->>'projectValue','')::numeric, 0));
  v_rate numeric := coalesce(nullif(p_project->>'commissionRate','')::numeric, 0);
  v_max numeric := round(v_project_value * v_rate / 100, 2);
  v_received numeric := 0;
  v_earned numeric := 0;
  v_status text;
  item jsonb;
  v_id text;
  v_amount numeric;
  v_incentive numeric;
  v_commission numeric;
begin
  if not public.is_admin() then raise exception 'Only APN administrators may manage commission projects.' using errcode = 'insufficient_privilege'; end if;
  if v_project_id is null or v_partner_id is null or nullif(trim(p_project->>'projectName'),'') is null or nullif(trim(p_project->>'clientName'),'') is null then raise exception 'Partner, project name, client name, and project id are required.' using errcode = 'check_violation'; end if;
  if v_project_value <= 0 or v_rate < 0 or v_rate > 100 then raise exception 'Project value must be positive and commission rate must be between 0 and 100.' using errcode = 'check_violation'; end if;
  insert into public.apn_commission_projects (id, data, updated_at) values (v_project_id, p_project, now()) on conflict (id) do update set data = excluded.data, updated_at = now();
  select coalesce(sum(received_amount), 0), coalesce(sum(commission_generated), 0) into v_received, v_earned from public.apn_revenue_collections where project_id = v_project_id;
  if v_received > v_project_value then raise exception 'Existing collections exceed the project value.' using errcode = 'check_violation'; end if;
  if v_earned > v_max then raise exception 'Existing collections exceed the maximum commission.' using errcode = 'check_violation'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_collections, '[]'::jsonb)) loop
    v_id := nullif(item->>'id','');
    if v_id is null then raise exception 'Each collection requires an id.' using errcode = 'check_violation'; end if;
    if exists (select 1 from public.apn_revenue_collections where id = v_id) then
      if exists (select 1 from public.apn_revenue_collections where id = v_id and project_id <> v_project_id) then raise exception 'Collection id is already assigned to another project.' using errcode = 'unique_violation'; end if;
      continue;
    end if;
    v_amount := coalesce(nullif(item->>'receivedAmount','')::numeric, 0);
    v_incentive := greatest(0, coalesce(nullif(item->>'incentive','')::numeric, 0));
    if v_amount <= 0 then raise exception 'Received amount must be greater than zero.' using errcode = 'check_violation'; end if;
    if v_received + v_amount > v_project_value then raise exception 'A collection cannot exceed the remaining project value.' using errcode = 'check_violation'; end if;
    v_commission := least(greatest(0, v_max - v_earned), round(v_amount * v_rate / 100, 2));
    item := item || jsonb_build_object('projectId', v_project_id, 'partnerId', v_partner_id, 'receivedAmount', v_amount, 'commissionGenerated', v_commission, 'incentive', v_incentive, 'commissionStatus', coalesce(item->>'commissionStatus','Pending'), 'createdBy', coalesce(item->>'createdBy', public.current_name()), 'createdAt', coalesce(item->>'createdAt', (extract(epoch from now()) * 1000)::bigint::text));
    insert into public.apn_revenue_collections (id, data, updated_at) values (v_id, item, now());
    v_received := v_received + v_amount;
    v_earned := v_earned + v_commission;
  end loop;
  v_status := case when p_project->>'status' = 'Cancelled' then 'Cancelled' when v_received = 0 then 'Pending' when v_received >= v_project_value then 'Completed' else 'Processing' end;
  update public.apn_commission_projects set data = p_project || jsonb_build_object('partnerId', v_partner_id, 'projectValue', v_project_value, 'commissionRate', v_rate, 'maximumCommission', v_max, 'totalReceived', round(v_received,2), 'remainingAmount', greatest(0, round(v_project_value-v_received,2)), 'remainingCommission', greatest(0, round(v_max-v_earned,2)), 'status', v_status, 'updatedAt', (extract(epoch from now()) * 1000)::bigint) where id = v_project_id;
  return jsonb_build_object('projectId', v_project_id, 'totalReceived', round(v_received,2), 'commissionEarned', round(v_earned,2), 'status', v_status);
end $$;
grant execute on function public.upsert_apn_commission_project(jsonb, jsonb) to authenticated;

alter table public.apn_commission_projects enable row level security;
alter table public.apn_revenue_collections enable row level security;
grant select, insert, update, delete on public.apn_commission_projects to authenticated;
grant select, insert, update, delete on public.apn_revenue_collections to authenticated;
drop policy if exists apn_commission_projects_select on public.apn_commission_projects;
drop policy if exists apn_commission_projects_write on public.apn_commission_projects;
drop policy if exists apn_commission_projects_delete on public.apn_commission_projects;
create policy apn_commission_projects_select on public.apn_commission_projects for select to authenticated using (public.is_admin() or partner_id = auth.uid()::text);
create policy apn_commission_projects_write on public.apn_commission_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy apn_commission_projects_delete on public.apn_commission_projects for delete to authenticated using (public.is_superadmin());
drop policy if exists apn_revenue_collections_select on public.apn_revenue_collections;
drop policy if exists apn_revenue_collections_write on public.apn_revenue_collections;
drop policy if exists apn_revenue_collections_delete on public.apn_revenue_collections;
create policy apn_revenue_collections_select on public.apn_revenue_collections for select to authenticated using (public.is_admin() or partner_id = auth.uid()::text);
create policy apn_revenue_collections_write on public.apn_revenue_collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy apn_revenue_collections_delete on public.apn_revenue_collections for delete to authenticated using (public.is_superadmin());

create index if not exists apn_commission_projects_partner_status_idx on public.apn_commission_projects (partner_id, status, updated_at desc);
create index if not exists apn_commission_projects_client_idx on public.apn_commission_projects (lower(client_name));
create index if not exists apn_revenue_collections_project_date_idx on public.apn_revenue_collections (project_id, received_date desc);
create index if not exists apn_revenue_collections_partner_date_idx on public.apn_revenue_collections (partner_id, received_date desc);

do $$ begin
  begin alter publication supabase_realtime add table public.apn_commission_projects; exception when duplicate_object then null; when others then null; end;
  begin alter publication supabase_realtime add table public.apn_revenue_collections; exception when duplicate_object then null; when others then null; end;
end $$;

select pg_notify('pgrst', 'reload schema');

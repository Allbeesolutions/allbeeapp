-- ALLBEE global activity feed
-- Run after the existing audit table setup. Safe to re-run.

alter table public.audit enable row level security;

-- Activity is append-only. The application also avoids changing or deleting
-- audit rows during backup restore, but the database must enforce this rule.
revoke update, delete on public.audit from authenticated, anon;
drop policy if exists audit_del on public.audit;
drop policy if exists audit_delete on public.audit;
drop policy if exists audit_update on public.audit;
drop policy if exists audit_admin_all on public.audit;
drop policy if exists audit_insert on public.audit;
drop policy if exists audit_select on public.audit;
drop policy if exists audit_ins on public.audit;
drop policy if exists audit_sel on public.audit;

create policy audit_insert on public.audit
  for insert to authenticated with check (true);
create policy audit_select on public.audit
  for select to authenticated using (public.is_admin());

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Audit activity is immutable';
end;
$$;

drop trigger if exists audit_immutable on public.audit;
create trigger audit_immutable
  before update or delete on public.audit
  for each row execute function public.prevent_audit_mutation();

grant select, insert on public.audit to authenticated;

-- The existing client subscribes to this table for cross-user updates.
do $$
begin
  begin
    alter publication supabase_realtime add table public.audit;
  exception when duplicate_object then
    null;
  end;
end
$$;

-- Keep filtered audit queries bounded as the history grows.
create index if not exists audit_ts_idx
  on public.audit ((case when data->>'ts' ~ '^[0-9]+$' then (data->>'ts')::bigint else null end) desc);
create index if not exists audit_module_idx
  on public.audit ((data->>'module'));
create index if not exists audit_user_idx
  on public.audit ((data->>'user'));

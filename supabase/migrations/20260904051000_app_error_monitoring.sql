-- Internal production render-error telemetry. No client writes are allowed to
-- the table; the authenticated RPC resolves the actor from auth.uid().
begin;
create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  component_stack text,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_error_events enable row level security;
revoke all on table public.app_error_events from public, anon, authenticated;

drop policy if exists app_error_events_admin_select on public.app_error_events;
create policy app_error_events_admin_select on public.app_error_events
  for select to authenticated using (public.is_admin());

create or replace function public.app_record_error(
  p_message text, p_stack text default null, p_component_stack text default null,
  p_path text default null, p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='insufficient_privilege'; end if;
  insert into public.app_error_events(user_id,message,stack,component_stack,path,metadata)
  values (auth.uid(), left(coalesce(p_message,'Unknown error'),2000), left(p_stack,12000),
          left(p_component_stack,12000), left(p_path,1000),
          case when jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))='object' then p_metadata else '{}'::jsonb end)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.app_record_error(text,text,text,text,jsonb) from public, anon;
grant execute on function public.app_record_error(text,text,text,text,jsonb) to authenticated;
commit;

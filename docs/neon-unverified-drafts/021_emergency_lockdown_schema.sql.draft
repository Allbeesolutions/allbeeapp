-- =============================================================================
-- Founder Emergency Lockdown Schema (Neon Port)
-- File: database/neon/021_emergency_lockdown_schema.sql
--
-- Ported from: supabase/migrations/20260817120000_pr_emergency_lockdown.sql
-- =============================================================================

begin;

create table if not exists public.emergency_lockdown (
  id          text primary key default 'founder' check (id = 'founder'),
  locked      boolean not null default false,
  locked_at   timestamptz,
  locked_by   text,
  unlocked_at timestamptz,
  recovered_by text,
  note        text not null default '',
  updated_at  timestamptz not null default now()
);

insert into public.emergency_lockdown (id, locked)
values ('founder', false)
on conflict (id) do nothing;

create table if not exists public.emergency_lockdown_audit (
  id         bigint generated always as identity primary key,
  action     text not null check (action in ('activate', 'recover')),
  actor      text not null default current_user,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists emergency_lockdown_audit_created_idx
  on public.emergency_lockdown_audit (created_at desc);

-- Added for rate-limiting as required by the lockdown function.
create table if not exists public.emergency_lockdown_attempts (
  client_key text primary key,
  window_start timestamptz not null,
  attempts integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.emergency_lockdown      enable row level security;
alter table public.emergency_lockdown_audit enable row level security;
alter table public.emergency_lockdown_attempts enable row level security;

revoke all on table public.emergency_lockdown       from anon, authenticated;
revoke all on table public.emergency_lockdown_audit from anon, authenticated;
revoke all on table public.emergency_lockdown_attempts from anon, authenticated;

commit;
notify pgrst, 'reload schema';

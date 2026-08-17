-- ============================================================================
-- Founder Emergency Lockdown — control plane (availability lock, NOT data lock)
-- ============================================================================
-- ADDITIVE and ISOLATED: creates two dedicated tables. No business, financial,
-- commission, wallet, withdrawal, quotation, ticket, user or profile table is
-- touched — no updates, no deletes, no truncation, no schema changes.
--
-- AUTHORITATIVE STATE
--   Table:  public.emergency_lockdown  (single row, id = 'founder')
--   Locked: locked = true   |  Unlocked: locked = false
--   RLS: enabled with ZERO policies and explicit REVOKEs, so anon and
--   authenticated app roles can neither read nor write it. Only the
--   service-role key (edge function) or the postgres owner (SQL console,
--   "infrastructure/database administrator") can see or change the state.
--
-- RECOVERY (authorized infrastructure owner — Supabase SQL Editor / psql):
--   update public.emergency_lockdown
--      set locked      = false,
--          unlocked_at = now(),
--          recovered_by = current_user,
--          note        = 'manual recovery',
--          updated_at  = now()
--    where id = 'founder';
--   insert into public.emergency_lockdown_audit (action, actor, note)
--   values ('recover', current_user, 'manual recovery via SQL console');
--
-- The application detects recovery on its next lockdown status poll / page
-- load (edge function founder-lockdown action=status) and renders normally.
-- No other database action is required to restore the application.
-- ============================================================================

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

-- Seed the single control row (never duplicated).
insert into public.emergency_lockdown (id, locked)
values ('founder', false)
on conflict (id) do nothing;

-- Audit trail of activation and recovery events. Never contains the code.
create table if not exists public.emergency_lockdown_audit (
  id         bigint generated always as identity primary key,
  action     text not null check (action in ('activate', 'recover')),
  actor      text not null default current_user,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists emergency_lockdown_audit_created_idx
  on public.emergency_lockdown_audit (created_at desc);

-- Deny every application role: service-role / postgres-owner flows bypass RLS
-- and are the only access paths (edge function + SQL console).
alter table public.emergency_lockdown      enable row level security;
alter table public.emergency_lockdown_audit enable row level security;

revoke all on table public.emergency_lockdown       from anon, authenticated;
revoke all on table public.emergency_lockdown_audit from anon, authenticated;

-- No policies are created on purpose: RLS with zero policies = deny all for
-- anon/authenticated. Re-running this file is safe (all statements are
-- idempotent — no destructive operations anywhere).
-- ============================================================================
-- Founder Emergency Lockdown — persistent rate-limit ledger (follow-up)
-- ============================================================================
-- Per-client failed-attempt ledger used by the edge function for server-side
-- rate limiting. Deno isolates are ephemeral, so the counter lives in the
-- database (service-role writes only; deny-all for anon/authenticated).
-- Window: 10 minutes, 5 verify attempts per client key. The ledger records
-- attempt counts only — never the submitted codes, never the secret.
-- Idempotent: create-if-not-exists + default-deny; safe to re-run.
-- ============================================================================

create table if not exists public.emergency_lockdown_attempts (
  client_key   text primary key,
  window_start timestamptz not null default now(),
  attempts     integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.emergency_lockdown_attempts enable row level security;

revoke all on table public.emergency_lockdown_attempts from anon, authenticated;

-- Cleanup of stale windows (optional, non-destructive).
create index if not exists emergency_lockdown_attempts_window_idx
  on public.emergency_lockdown_attempts (window_start);
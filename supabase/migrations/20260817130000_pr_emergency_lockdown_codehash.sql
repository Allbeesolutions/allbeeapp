-- ============================================================================
-- Founder Emergency Lockdown — authorization code hash (follow-up)
-- ============================================================================
-- Stores ONLY a SHA-256 hash of the founder authorization code in the same
-- deny-all control table (RLS: anon/authenticated have no access at all).
-- The plaintext code is never stored anywhere; the edge function hashes the
-- submitted candidate and compares hashes server-side (service role).
-- If an environment secret FOUNDER_LOCKDOWN_CODE is ever deployed, the edge
-- function prefers it over this hash; otherwise the hash is authoritative.
-- Idempotent: an existing hash is preserved, never overwritten.
-- ============================================================================

alter table public.emergency_lockdown
  add column if not exists code_hash text
  check (code_hash is null or length(code_hash) = 64);

-- Seed only when no hash exists yet (idempotent — never overwrites).
update public.emergency_lockdown
   set code_hash = coalesce(code_hash, '09c69cec566c4e318f06a18b91711216493fb644df127b4be938ee85403844fc')
 where id = 'founder';
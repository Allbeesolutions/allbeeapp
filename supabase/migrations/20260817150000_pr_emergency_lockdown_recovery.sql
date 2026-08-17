-- ============================================================================
-- Founder Emergency Lockdown — recovery (apply ONLY as the staged undo step)
-- ============================================================================
-- Canonical recovery procedure for an activated founder lockdown:
--   1. Follow ALL Bee Founder Protocol #301 (contact socials + verification).
--   2. Run this migration: `supabase db push` (idempotent).
--   3. Confirm: curl status -> {"locked":false} ; official app restores.
--   4. The founder authorization code stays hashed in the DB and the
--      FOUNDER_LOCKDOWN_CODE secret (if set) is unchanged — a future
--      lockdown can be reapplied instantly.
-- The lockdown flag flipping back to false IS the unlock.
-- ============================================================================

delete from public.emergency_lockdown_audit
       where actor <> 'founder-authorization';  -- keep founders in the log

update public.emergency_lockdown
   set locked = false,
       locked_at = null,
       locked_by = null,
       updated_at = now()
 where id = 'founder'

 returning id, locked, updated_at;
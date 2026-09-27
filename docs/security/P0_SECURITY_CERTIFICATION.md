# P0 Security Certification

## Certified controls
- All exposed `public` tables have RLS enabled.
- Internal trigger functions are not directly executable by browser roles.
- Internal helper/maintenance RPCs are service-role only.
- Future postgres-owned public functions default to no browser EXECUTE grant.
- Ten server-only queue/audit/control tables intentionally have no RLS policies and no anon/authenticated table grants.
- Every table in the `supabase_realtime` publication is required by regression contract to have RLS.
- Anonymous SECURITY DEFINER surface is pinned to exactly three reviewed functions: proposal token read/action and the owner-name/avatar projection.

## Reviewed public RPC behavior
- `proposal_public_get(token)` requires a live opaque proposal token and returns the public projection.
- `proposal_public_action(token, ...)` requires the same live token before delegating to the proposal action workflow.
- `public_owner_profiles()` exposes only active owner display name + avatar URL for Haji/Alim; no email/mobile/role payload is returned.

## Open P0 work
- `attachments` is a legacy public bucket with 21 objects and existing records store public URLs. It must be migrated to signed URLs atomically; changing the bucket flag alone would break live attachments.
- Continue role-negative tests for client-facing finance/APN/admin RPCs.
- Continue Edge Function abuse/JWT/rate-limit audit.

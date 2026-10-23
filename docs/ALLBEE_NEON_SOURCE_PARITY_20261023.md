# AllBee → Neon: legacy source parity inventory
Verified: 23 October 2026 · Objective: full backend replacement without changing legacy production data.

## 24 October correction: unverified SQL is not parity

Commits on `haor/allbee-neon-backend-20261023` had added `database/neon/011`–`021`
and described them as ports. A fresh read-only query of the **isolated staging**
branch `br-long-cloud-azs3rmmb` confirmed **10** migration records through
`010_role_audit_service_maintenance`, five public app tables, zero Auth users,
zero roles/notifications and six private role-audit rows. None of `011`–`021`
was applied. The files contained missing dependencies and Supabase-only APIs;
`019` also contained malformed SQL. They have been moved to
`docs/neon-unverified-drafts/` with a non-executable `.draft` suffix. The
uncommitted founder-lockdown server experiment is quarantined there too. The
root Vercel link accidentally pointing at a newly created, unrelated project
was removed; `neon-pilot/.vercel` still points at the intended SSO-protected
staging project. This correction does **not** establish any APN/finance parity.

CI now checks numbered migration order and Supabase-only references, and the
disposable PostgreSQL RLS test replays **every** executable Neon migration
twice instead of stopping at `010`. Legacy ports must be written and verified
against the actual Neon schema/identity model before staging application.

## 24 October verified APN dependency slice

`database/neon/011_apn_partner_read_boundary.sql` is a **new, deliberately
limited** replacement for the first APN partner-directory dependency. The
`public.apn_users` row is linked to a live Neon Auth UUID, keeps the legacy
`id`/`data` read shape, and permits SELECT only to active admin/superadmin
members or a partner/district-head/state-head reading their own row. Browser
INSERT/UPDATE/DELETE is not granted; client-authored JSON is not an access
claim. No old customer records were copied and no account was created.

Disposable PostgreSQL replay passed twice and the nine-role matrix, forged
identity, anonymous, suspended, deleted-identity, cross-partner and browser
write-denial checks passed. The isolated Neon staging branch now has **11**
recorded migrations; readback confirmed one APN RLS policy, zero APN rows,
authenticated SELECT only, no anonymous SELECT or browser writes. The Data
API schema cache was refreshed. The separate Neon `main` branch remains at
**one** migration with no APN table. This is **not** APN registration,
approval, commissions, finance, UI or Edge Function parity; no production
cutover is implied.

The protected `allbee-neon-pilot` Vercel project was redeployed after its
quota reset and confirmed READY. An anonymous request still redirects to
Vercel SSO; an authenticated request returned the pilot HTML and current JS
asset. The legacy production AllBee frontend was not redeployed.

The isolated pilot's beta Neon SDK pinned vulnerable Zod copies. A pilot-only
override to patched Zod 4.6.7 passed clean install, 32/32 adapter tests,
build and a zero-finding high-severity production audit. The protected pilot
was redeployed as `dpl_9zA47QdiFZHUtYQUNff4L4jvZeQe`, confirmed READY,
SSO-protected and serving its new JS asset. This is dependency hardening,
not new migrated business functionality.

`database/neon/012_apn_partner_application.sql` adds only an authenticated,
validated, idempotent **pending** APN self-application RPC and a private
creation audit. It does not issue an APN number, assign a member role, approve
an account or accept finance input. Disposable PostgreSQL replay and nine-role
tests passed: only client/partner roles can invoke it; malformed, anonymous,
suspended, deleted-identity and administrative-account calls are denied;
replays cannot rewrite an application or duplicate its audit. Isolated Neon
staging now has **12** migration records, zero APN rows and zero APN application
audit rows, authenticated-only RPC execution, and a refreshed Data API cache.
No real users/data were inserted, and Neon `main`/legacy production were not
changed. Live signed-in application acceptance remains unverified.

`database/neon/013_apn_identity_detach_archive.sql` corrects an identity
lifecycle mismatch before any APN records exist: the legacy permanent-delete
path retains business history after Auth deletion. Neon now detaches the
Auth foreign key instead of blocking deletion, stamps the retained row as
deleted/archived, and limits deleted-row reads to active superadmins. Local
replay, Auth-deletion retention and negative role tests passed. Staging
readback confirmed **13** migrations, zero APN rows, the `ON DELETE SET NULL`
foreign key, one archive trigger and one APN RLS policy; Neon `main` remains
at one migration without an APN table. No real identity was deleted.

## Counted scope

- **219** original Supabase SQL migration files under \`supabase/migrations/\`.
- **11** Edge Function directories in \`supabase/functions/\`.
- **10** Neon-only staging migrations (`database/neon/001`–`010`). These are **not** 10 of the 219 legacy migrations converted: they establish fresh, separate Auth, private direct chat, role lifecycle/audit, task and notification foundations.
- Classified filename groups (approximate, non-exclusive by business purpose): APN 78, AI 25, finance 12, chat 12, security 13, auth 5, client 3, CRM 3, storage 2, analytics 1, other 65.

## File-level dependency markers

| Marker found in legacy SQL files | Files |
|---|---:|
| \`SECURITY DEFINER\` | 157 |
| SQL function definitions | 149 |
| Supabase Auth \`auth.uid/auth.users/auth.jwt/auth.role\` | 108 |
| Finance/wallet/commission references | 104 |
| Chat/message/conversation references | 73 |
| APN partner/hierarchy references | 60 |
| RLS/policy definitions | 42 |
| Realtime/publication references | 6 |
| Storage references | 4 |
| External URL/HTTP references | 3 |

Counts refer to **files containing a matched marker**, not numbers of unique functions, tables, bugs or completed migrations. Categories overlap. Full per-migration flags and names of environment-variable keys (never values) are preserved in \`docs/ALLBEE_NEON_MIGRATION_INVENTORY.json\`.

## Edge functions requiring replacement

\`admin-users\`, \`ai-chat\`, \`ai-chat-v2\`, \`ai-crm-action\`, \`ai-crm-webhook\`, \`ai-crm-worker\`, \`ai-memory-runtime\`, \`apn-ai\`, \`founder-lockdown\`, \`notification-push-worker\`, \`username-login\`.

## Migration controls

1. Port authentication/identity and role management with strong ID-to-UUID mapping, server-verified privileges, suspension and audit.
2. Build APN/finance ledgers, reconciliation and irreversible payment boundaries. Preserve idempotency, immutable journal/history and arithmetic invariants; **do not fabricate missing source records**.
3. Map legacy JSON tables and SQL RPC signatures to explicit, tested Neon contracts; keep all dangerous \`SECURITY DEFINER\` or admin helpers out of public grants.
4. Replace 11 Edge Functions with private server execution (never expose server tokens via \`VITE_\` variables) and verify callers and rate limits.
5. Recreate private storage, notifications and realtime/polling with per-recipient access.
6. Test all nine user roles using real sessions, all frontend screens, mobile and desktop, finance and APN workflows. Use genuine data only when owner-approved source access/backup is available.
7. Promote production only after signed-in full-parity tests, error/rollback validation and data reconciliation. The existing AllBee Supabase-backed site and main company database remain unchanged.

## Verified staging proof

- 10 Neon migrations applied to `allbee-migration-lab-20261023`, never company Neon `main`.
- 442/442 root tests and 32/32 pilot adapter tests; local RLS includes all nine roles for scoped tasks/admin alerts, plus Auth, chat consent, suspension and lifecycle controls.
- Two synthetic users completed real Auth signup/login, invitation/acceptance, message delivery and recipient-side deletion confirmation. The original message body was independently verified scrubbed in SQL.
- Synthetic QA users and test records are removed. Real browser: superadmin assigned staff, sent recipient-only alert, staff read it, suspension locked workspace, restoration reopened it. Staging retains 10 migrations and 6 private audit events.
- Last observed GitHub CI for `f11df7e` passed; this new migration batch will be checked after push. Vercel Free deployment cap blocks the updated SSO-protected pilot release; local pilot runs at `http://127.0.0.1:5181/`.
- No production cutover; do not use the older hosted pilot as proof that this newer work is deployed.

## Finite completion

This is a **source-surface inventory**, not a claim of migrated legacy parity. Final acceptance requires feature-level coverage and verification for every necessary server contract, followed by production release and owner testing. No artificial 100% score or unsupported source-data reconstruction.

# AllBee → Neon: legacy source parity inventory
Verified: 23 October 2026 · Objective: full backend replacement without changing legacy production data.

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

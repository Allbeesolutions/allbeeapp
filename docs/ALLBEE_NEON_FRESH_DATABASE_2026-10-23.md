# AllBee fresh Neon database — 23 October 2026

Created under **Allbee** (not Hajihaz) organization `org-wispy-tooth-01070087`.
Project: `allbee-core`, ID `icy-mud-74621536`.
Database: `allbee`, PostgreSQL 17, Singapore `aws-ap-southeast-1`.
Old Supabase data is intentionally **not transferred** on owner instruction. Old database is not deleted or changed.

The private `allbee_platform` schema tracks migrations and readiness of seven backend capabilities. Only the PostgreSQL database connection is marked ready. No real customer data is stored in this foundation.

**Secrets:** AllBee-specific Neon CLI login is in a restricted folder outside Git:
`~/Documents/AllBee-Emergency-Rescue-2026-10-22/auth-neon-company-v3/`.
Never commit database passwords, access tokens or connection strings.

**Warning:** The existing AllBee React app uses Supabase Auth, Storage, Realtime, RPCs and Edge Functions. It cannot be redirected to Neon just by changing a URL. Required new work: secure application API and sessions; new-user signup (legacy users excluded), authorization/RLS; file storage; chat/realtime; background/edge functions; deliberate port of existing domain schemas and finance protections; full browser and production acceptance. Do not attempt blanket replay of hundreds of Supabase-specific migrations on Neon.

This foundation makes no production Vercel change. **Do not integrate HajiPay with AllBee.**

Test: `bash scripts/test-neon-foundation.sh` against an isolated private PostgreSQL cluster and run the migration against the new AllBee Neon project only after verifying its organization and database.

## Isolated staging backend pilot (23 October 2026)

Only the branch `allbee-migration-lab-20261023` (`br-long-cloud-azs3rmmb`) was used for these experiments. **Nothing from this pilot is wired into the production browser app.**

- Managed Neon Auth successfully enabled for database `allbee` on staging. Auth data is isolated in `neon_auth`; IDs in this instance are UUID (not text).
- Neon Data API provisioned and reported `active`, with default broad table grants explicitly disabled. Authenticated requests use the Neon-specific `authenticated` database role; unauthenticated requests use `anonymous`, not Supabase's `anon`.
- Created a **private-only** staging object bucket `allbee-private-staging`. This has no migrated files or app integration.
- Added `database/neon/002_neon_auth_core.sql`: fresh profiles without self-editable roles, private administrator-assigned roles, two-party conversation/messages tables, 8 per-user RLS policies, restricted column grants, and a one-hour owner-only message-edit window. Verified against the *actual* Neon Auth `neon_auth."user"` ID type and `auth.user_id()` result. Never substitute app user metadata for authorization.
- Applied both migrations only to staging. Read-back confirmed **3 public app tables, 1 private roles table, 8 active RLS policies, 2 recorded migrations**, with direct role assignment denied to `authenticated`.
- `scripts/test-neon-identity-rls.sh` runs in disposable local PostgreSQL with fake JWT identity functions. Checks cross-user profile visibility and mutation, role escalation denial, third-party chat denial, sender spoofing denial, owner-only edits, hard-delete denial and idempotent reruns. This test is in CI.
- Neon Realtime **could not be enabled** because the database is PostgreSQL 17 and the service requires PostgreSQL 18. Neon's October 2026 Realtime beta also lacks RLS, so private chats must not be streamed through an unsealed broad realtime query. An authenticated, recipient-scoped realtime solution or safe polling alternative must be verified before releasing replacement chat.

**Still pending for AllBee production:** auth UI sessions and signups, Data API adapter for old JSON/RPC business data, admin/API/RLS parity across all roles, storage upload/download signed ACLs, realtime/polling chat, all 11 Edge Function replacements, finance consistency, staged browser flow testing, full deployment and owner acceptance. Do not point live `VITE_SUPABASE_URL` to Neon or deploy a half-compatible backend.

**No old Supabase data was copied**, and the old production database has not been deleted or modified. New accounts would not inherit prior sessions or records.

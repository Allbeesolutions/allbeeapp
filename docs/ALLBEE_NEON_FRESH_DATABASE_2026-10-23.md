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

## Staging chat hardening (23 October 2026, continuation)

Migration `003_chat_acceptance.sql` has been applied **only** to isolated Neon staging `br-long-cloud-azs3rmmb`. Read-back confirmed migration count **3**, invitation-acceptance RLS policy installed, and `authenticated` has neither `INSERT` permission on message `id` nor `created_at` columns. The user's consent is required before messages can be sent; only the invited party (not inviter) can approve. Legacy production stays untouched.

The disposable PostgreSQL integration test now verifies replay safety, recipient approval, timestamp/identifier-forgery denial, third-party access denial, sender spoof denial, role escalation denial and owner-only edits. CI executes this test alongside the foundation check. AllBee's existing UI full verification completed **504/504**; role-based SPA memory soak completed **240/240**, all passing. Existing frontend is still tied to Supabase—these browser checks are mock-role regressions, not a certified live Neon release.

**SDK dependency gate:** initial attempt to fetch `@neondatabase/neon-js` from the Mac npm registry timed out twice; the repository dependency manifest remains unchanged. Do not invent a custom unverified authentication protocol or expose privileged Neon SQL URLs in client bundles. Resume with official SDK once package registry network is functioning, then build a separately gated Neon client pilot.

## 23 October HAOR continuation — migrations 004–005 (staging only)

- **004_chat_mutation_role_guard.sql:** The recipient's one-time acceptance is stamped by the database and cannot be revoked/re-dated. Changes to messages use server-side edit timestamps. Soft-delete irreversibly scrubs original text to `[Deleted message]` and cannot be undone. `public.my_member_access()` reports only the authenticated member's role and account state through a carefully permissioned, no-argument RPC; the underlying `allbee_private.member_roles` table remains inaccessible to browser database roles.
- **005_member_suspension_audit.sql:** A `RESTRICTIVE` RLS gate applies to profile, conversation and message tables. Members marked `suspended` or `terminated` cannot read or change app records even if their Neon Auth session token is otherwise valid. A private owner-writable, client-inaccessible audit table records role/status insert/update/delete.
- Applied to isolated Neon lab branch `br-long-cloud-azs3rmmb`. Verified **5 migrations, 3 restrictive active-account policies, 2 chat-guard triggers, private role-audit trigger, no anonymous role RPC permission and no authenticated access to private audit tables**. Neon production/main branch and old Supabase remain untouched.
- Local PostgreSQL regression covers cross-user isolation, timestamp tampering, deletion content scrubbing, no self-promotion, role/status self-read, suspended account revocation and private audit denial. The isolated pilot calls `my_member_access()` only after validating the Neon Auth session and disables all workspace controls on unavailable/non-active status; its adapter suite now has **20 tests**.
- **Not yet accepted:** Authenticated browser sessions on SSO-protected staging and real role-by-role workflows; business, APN/finance, 11 Edge Functions, storage and full cutover remain.

## Staging task workspace migration 006 — verified

The legacy AllBee task API used JSON user names for assignment; names are user-editable and unsafe as RLS authorization data. `database/neon/006_task_workspace.sql` preserves `tasks.id` (text) and `tasks.data` (jsonb), but adds immutable, Neon Auth-linked `owner_user_id` and `assignee_user_id` UUID columns for server-enforced authorization, plus validated task states. Clients/partners cannot create internal tasks. Only active internal roles may access tasks; participants can update content/state but may not change ownership, assignees, creation dates or server timestamps. Owners/administrators have role-specific delete rights. The task adapter and pilot UI now support create, list, status update and refresh for verified internal test accounts.

Disposable local database integration: **PASS** for forged owners, client creation denial, suspended assignees, unrelated users, authorized assignee updates, replay and immutable assignments. Isolated Neon staging branch: **6 migration records, 5 task policies, 1 restrictive guard, no authenticated owner-column update grant**, verified. **Existing AllBee production frontend and Supabase DB remain unchanged.** This pilot is not the full task system, team directory, finance, CRM or APN migration.

## Real staging browser acceptance — 23 October 2026

Two synthetic isolated Neon Auth users signed in successfully through local Vite. The app's verified role RPC returned `client/active`; invitation creation and recipient acceptance succeeded. Both authenticated browser contexts observed the same sent message, followed by the server-backed soft-deletion marker. No JS exceptions or Data API errors in the completed message/deliver/delete run. Previously discovered stale selected-conversation state is addressed with 5-second scoped refresh + selected-row reconciliation. Local public entry smoke at 320,390,768,1440 all returned 200 without JS errors/overflow. These checks prove *only* a subset of the full user flows.

GitHub CI passed for `8af1da0`, but the protected Vercel Neon pilot redeployment failed due to Free-tier quota `api-deployments-free-per-day` (100 per day). Its previous SSO-protected deployment remains available; latest code is pushed and runs on the Mac's local pilot. Do not disable SSO, bypass quota using new billing/account, or claim the hosted pilot has been updated. The original AllBee site stays on Supabase and was not changed.

## 23 October 2026 — migration 007: recipient-only notifications (staging)

The fresh Neon staging backend now has `public.member_notifications` with authenticated recipient UUID, sender UUID, vetted category, title/body length limits, server-owned timestamps, and an immutable one-way read acknowledgement. Only active `superadmin`/`admin` members can insert notices; `sender_user_id` must match the verified session. The authenticated sender does **not** get SELECT rights on the recipient's inbox. Clients and suspended accounts cannot issue administrative notices. Only the recipient can read/acknowledge their own record, including when the sender is an administrator. No hard-delete/browser updates to title/body/sender/recipient exist.

Local disposable PostgreSQL replay and negative RLS checks: PASS. Live isolated Neon staging readback: **7 recorded migrations, 4 notification RLS policies (including 1 restrictive active-account guard), no anonymous SELECT, no client body/ID mutation grants**. The browser pilot now exposes recipient inbox/mark-read and an administrator-only send form; 29 adapter tests and 4-width unsigned-in Chromium startup checks passed.

This module does **not** replace the production `public.notifications` JSON collection, push worker or APN notifications. The existing live AllBee UI, Supabase database and Vercel production project remain unchanged. Full-feature migration, admin real-session tests and protected Vercel redeploy remain pending.

## HAOR batch: notification, role-management and identity lifecycle (23 October)

Migrations `007_member_notifications`, `008_role_management`, `009_deleted_identity_guard`, and `010_role_audit_service_maintenance` have been applied and read-back verified on the isolated Allbee-owned staging branch `br-long-cloud-azs3rmmb`. The schema migration count is **10**. The production AllBee app and the original Supabase database remain unchanged.

- `007`: Separate `public.member_notifications` with recipient-only SELECT/acknowledgement, restricted admin-only sender, one-way server-timestamped read acknowledgements, and no browser-writeable ID or body. **The sender cannot read the recipient's inbox.**
- `008`: `public.manage_member_role` accepts only the acting session of an **active superadmin**. No self-change, unknown target, invalid role or invalid lifecycle status; audit rows record the verified acting UUID. An initial company superadmin must be explicitly bootstrapped under a trusted owner identity; **no production owner was auto-promoted**.
- `009`: Deny an Auth account no longer present in `neon_auth."user"`, even if a stale JWT presents its old UUID. The `is_active_member`, `is_internal_member`, `is_task_admin` and self-role helper functions fail closed. A disposable SQL test covering an absent Auth identity and replays passed.
- `010`: A real QA cleanup revealed an Auth service deletion could fail because the private role-audit trigger was `SECURITY INVOKER` and could not insert an audit row during FK cascade. Limited `SECURITY DEFINER` was given **only** to the non-exposed trigger function, with fixed audit SQL and public/browser execute grants revoked. Verified the Neon Auth CLI subsequently removed both synthetic QA users with assigned roles, preserving six private audit records.

**Real browser E2E:** Two synthetic test accounts signed in to Neon staging. Only the superadmin saw role administration. A superadmin granted another user a staff role; the staff task workspace appeared. Admin sent a private notification; staff received and acknowledged it; sender could not read recipient alert. Suspension locked staff workspace; reactivation restored it. The completed run reported zero JS exceptions and zero Data API errors. QA accounts and their notification were cleaned afterward. Verified final counts: 0 Auth users, 0 member roles, 0 notifications, 0 messages, 0 tasks; **10 migrations and 6 private audit rows retained**.

**Data API freshness:** SQL-created `member_notifications` initially returned `PGRST205` until the Neon Data API schema cache was explicitly refreshed. The branch-scoped `scripts/refresh-neon-staging-schema.sh` checks the project/branch identity and rejects missing company CLI credentials before calling `neon data-api refresh-schema`. It passed the absence-of-credentials negative check and a real staging refresh.

**Automated verification:** Root app 442/442; isolated Neon adapter 32/32; nine-role local RLS policy matrix for task reads/admin notifications; local migration replay; four-width unsigned browser startup; pilot build. These verify only the stated scope. Legacy 219 SQL migrations, 11 Edge Functions, finance/APN workflows, full storage/push/chat features, nine-role app E2E, production cutover and owner acceptance remain.

**Release blocker:** Vercel's protected Neon staging pilot redeploy encountered `api-deployments-free-per-day`; the URL continues serving its earlier SSO-protected version. Do not disable SSO, pay for an upgrade, switch account or claim the latest code is hosted until Vercel confirms READY. Keep production `app.allbeesolutions.com` on its existing working Supabase build.

# AllBee — Neon replacement-backend staging pilot

This is a **separate, non-production Vite application**. It does not replace the existing `src/AllbeeApp.jsx` or the live Supabase configuration.

## Security and readiness

The pilot uses the official, version-pinned `@neondatabase/neon-js` SDK with the Supabase-style auth adapter against the **Allbee-owned Neon staging branch** `br-long-cloud-azs3rmmb`, not the company's Neon `main` branch and not the production legacy Supabase project.

Features implemented here: staging email/password auth, own-profile editing, private consented two-party chat with scoped polling and soft deletion, an internal task panel, recipient-only notifications, and superadmin-only role/status management. The database enforces these narrow permissions through migrations `002`–`010`; no client-side self-assigned roles are honored. Migration `011` adds an Auth-linked APN directory read boundary, but the pilot has **no APN registration, approval, finance or workflow UI**.

**Integration not yet production certified:** Real local two-account Neon Auth sign-in, consented chat, role assignment, notification and suspension/restoration flows passed with temporary staging identities that were then removed. The protected hosted pilot was verified at the HTML/SSO level, not with all nine signed-in roles or APN workflows. Neon Realtime on PostgreSQL 17 is unavailable; chat uses recipient-scoped polling instead.

## Run locally

```sh
cd neon-pilot
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
cp .env.example .env.local
# Add the publicly safe staging-only Auth and Data API URLs from Neon Console.
npm test
npm run build
npm run dev
```

Required variables:

- `VITE_NEON_STAGING_ONLY=true` — mandatory fail-closed gate.
- `VITE_NEON_AUTH_URL` — public Neon Auth endpoint ending in `/auth`.
- `VITE_NEON_DATA_API_URL` — public Neon Data API endpoint ending in `/rest/v1`.

**Never set these to a production database, Supabase URLs, private SQL URLs, service-role keys or admin secrets.** The pilot rejects non-Neon HTTPS URL hosts and refuses launch unless its staging flag is enabled. `.env.local` is ignored by Git.

The pilot does not auto-grant admin access. Only a previously trusted, active superadmin can use the audited role-management RPC; the initial company owner identity must be explicitly bootstrapped. No production users, credentials or customer records are migrated.

The pilot is independent of AllBee production's main npm lockfile and Vercel root build. Its isolated lockfile and CI job use `--legacy-peer-deps` for the beta SDK's current UI-peer graph. On 24 October 2026, the SDK's exact Zod pins resolved vulnerable 4.1.12/4.5.4 copies ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). A pilot-only npm override pins Zod 4.6.7; clean install, 32 tests, build and production-dependency audit passed with **zero high/critical findings**. Remove the override only after the upstream SDK pins a patched release and the same checks pass.

## Verification

- `npm ci --legacy-peer-deps` reproducible install: PASS.
- `npm test` 32/32: PASS.
- `npm run build`: PASS.
- `npm audit --omit=dev --audit-level=high`: PASS.
- Chromium at width 390px, unauthenticated staging page: HTTP 200, zero JS errors, no horizontal overflow.
- Actual local Neon browser signup, role-management/notification and two-account chat acceptance: PASS with temporary isolated users; all nine roles and APN workflows are **not** live-accepted.
- Server-side migrations `001`–`011` staging: PASS for their limited stated scope; no legacy APN/finance parity.
- Main AllBee app remains fully separate from staging pilot.

Do not deploy this pilot to a public production domain or imply all modules have migrated. Continue the API/backend role-parity migration and authenticated smoke tests first.

## Protected test deployment

- Vercel project: `allbee-neon-pilot` (separate from production AllBee).
- URL: `https://allbee-neon-pilot.vercel.app`.
- Vercel Authentication / SSO protection: **enabled for all targets**. Unauthenticated browsers redirect to Vercel login. No custom domain or production AllBee routing changed.
- Neon branch: isolated staging `br-long-cloud-azs3rmmb`, with only `https://allbee-neon-pilot.vercel.app` and the local QA loopback explicitly added to its Auth origin allowlist.
- Vercel staging build `dpl_9zA47QdiFZHUtYQUNff4L4jvZeQe` (with patched Zod) reported **READY** on 24 October. An anonymous request redirected to Vercel login; an authenticated fetch returned the pilot HTML. No real-company-user or all-role hosted feature acceptance has been certified.
- Staging deployment uses separate Vercel environment variables with only public Neon API endpoints; local `.env.local`, `.vercel` metadata, service credentials and test account passwords are excluded from source and deployment uploads.

### Backend role status verification

The protected pilot calls the no-argument, server-owned `my_member_access()` RPC after verifying the login session. The RPC reads only that account's role and lifecycle status; it does **not** accept a caller-supplied role, member ID, or user metadata for authorization. A failed role check or suspended/terminated status locks the pilot workspace. See Neon migrations `004`–`010` and the RLS/adapter tests. This is still a staging pilot, not a production admin or APN migration.

### Internal task workspace (isolated test accounts only)

The pilot displays a task panel only to active server-verified internal roles (`superadmin`, `admin`, `accountant`, `staff`, `intern`). New task records use UUID owner/assignee foreign keys with immutable membership, rather than trusting name fields in JSON. Create/list/status update are supported and independently checked by Neon PostgreSQL RLS; unsigned-in, client and suspended sessions are denied. The original production task module is not yet switched over.

### Real two-account staging E2E

Using temporary synthetic staging accounts through the local Vite pilot, verified real Neon Auth sign-up and sign-in, client-only role resolution, a consented two-party invitation, server-backed message sending/polling, and redacted soft-deletion visible to the recipient. No browser exceptions or Data API errors occurred on the successful delivery/deletion pass. An initial sender-side stale-invitation state was repaired: `refreshConversations` now reconciles the selected chat against its latest server row and polls while logged in. A regression test covers a pending invitation becoming accepted. **32/32 isolated pilot tests pass.** No production AllBee users or records were involved. This is not nine-role or complete business parity.

### Private notification pilot (migration 007)

The isolated pilot includes an authenticated recipient-scoped inbox, one-way read acknowledgement, and administrator-only sender form. PostgreSQL RLS requires the authenticated recipient to read a notification and an active internal admin to send it. A sender receives a success acknowledgement but **no recipient row data** (no `.select()` after sending); timestamps, sender identity, read status and record IDs cannot be forged by clients. This is staging-only. The original AllBee notifications and push/worker flows remain untouched and not yet ported.

### Staging owner, notifications and role lifecycle

The staging pilot now has a recipient-only notification inbox and mark-read control, an active-admin-only sender form, and an active-superadmin-only member role/status form. Account role/status is always read from the server-owned RPC; no client metadata can self-assign privileges. Sender form uses PostgREST `INSERT` **without `.select()`**, because a sender is not authorized to read a recipient-owned notification. The role-management form never accepts changes to the current superadmin's own access. Changing a user's status takes effect at the database access layer.

Nine-role local SQL authorization tests and real two-account browser E2E passed. The initial synthetic superadmin existed **only** in the isolated QA branch; real company-owner access still requires verified owner identity and explicit bootstrap. Both QA users were cleaned.

**Schema-refresh runbook:** When a staging SQL migration adds a public table, column, function or policy, run `scripts/refresh-neon-staging-schema.sh` with `NEON_CLI_BIN` and `NEON_CONFIG_DIR` set to the authorized Allbee-owned Neon profile. The script rejects any other branch. This resolves PostgREST `PGRST205` errors caused by a stale Data API schema cache. No secret is committed.

The hosted `allbee-neon-pilot.vercel.app` remains SSO-protected. Its quota reset and the patched-dependency staging deployment succeeded on 24 October; the protected HTML and current JS asset were fetched with Vercel authentication. The live production AllBee site has not been migrated.

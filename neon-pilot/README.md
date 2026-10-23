# AllBee — Neon replacement-backend staging pilot

This is a **separate, non-production Vite application**. It does not replace the existing `src/AllbeeApp.jsx` or the live Supabase configuration.

## Security and readiness

The pilot uses the official, version-pinned `@neondatabase/neon-js` SDK with the Supabase-style auth adapter against the **Allbee-owned Neon staging branch** `br-long-cloud-azs3rmmb`, not the company's Neon `main` branch and not the production legacy Supabase project.

Features implemented here: staging email/password auth form, own-profile create/update, private two-party chat invitations, recipient acceptance before messaging, authenticated messages, polling (five seconds while selected), and owner-only soft deletion within one hour. The database enforces ownership and permission checks via migrations `002` and `003`; no client-side self-assigned roles are honored. No admin or APN role features have been ported.

**Integration not yet production certified:** The first local Auth signup from `http://127.0.0.1:5181` was rejected as `Invalid origin`. The exact loopback origin and the SSO-protected staging URL were subsequently added to the **staging-only** Neon Auth allowlist. Both now return HTTP 204 CORS preflight with the correct allowed origin and POST method. Real signed-in browser sessions, two-account chat behavior and full AllBee role parity remain unverified. Do not treat CORS or mocked tests as authentication acceptance. Neon Realtime on PostgreSQL 17 is unavailable; chat uses recipient-scoped polling instead.

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

The local test app doesn't grant any user an admin role. Roles must be assigned via a separate, authenticated, audited company management flow. No production users, credentials or customer records are migrated.

The pilot is intentionally independent of AllBee production's main npm lockfile and Vercel root build. Its isolated npm lockfile and CI job use `--legacy-peer-deps` to isolate the beta SDK's current UI-peer graph. There were **0 high or critical audit findings** for the isolated production dependency tree as of 23 October 2026.

## Verification

- `npm ci --legacy-peer-deps` reproducible install: PASS.
- `npm test` 17/17: PASS.
- `npm run build`: PASS.
- `npm audit --omit=dev --audit-level=high`: PASS.
- Chromium at width 390px, unauthenticated staging page: HTTP 200, zero JS errors, no horizontal overflow.
- Actual Neon browser signup: **NOT YET VERIFIED**. The earlier `Invalid origin` was followed by exact staging-domain allowlisting and successful HTTP 204 preflight; complete actual signed-in account/session tests before user acceptance.
- Server-side migration 003 staging: PASS, includes recipient consent, no custom message timestamp/ID privilege.
- Main AllBee app remains fully separate from staging pilot.

Do not deploy this pilot to a public production domain or imply all modules have migrated. Continue the API/backend role-parity migration and authenticated smoke tests first.

## Protected test deployment

- Vercel project: `allbee-neon-pilot` (separate from production AllBee).
- URL: `https://allbee-neon-pilot.vercel.app`.
- Vercel Authentication / SSO protection: **enabled for all targets**. Unauthenticated browsers redirect to Vercel login. No custom domain or production AllBee routing changed.
- Neon branch: isolated staging `br-long-cloud-azs3rmmb`, with only `https://allbee-neon-pilot.vercel.app` and the local QA loopback explicitly added to its Auth origin allowlist.
- Vercel staging build reported **READY**. No real-user login or all-role feature acceptance has been certified.
- Staging deployment uses separate Vercel environment variables with only public Neon API endpoints; local `.env.local`, `.vercel` metadata, service credentials and test account passwords are excluded from source and deployment uploads.

### Backend role status verification

The protected pilot now calls the no-argument, server-owned `my_member_access()` RPC after verifying the login session. The RPC reads only that account's role and lifecycle status; it does **not** accept a caller-supplied role, member ID, or user metadata for authorization. A failed role check or suspended/terminated status locks the pilot workspace. See Neon migrations `004` and `005` and the RLS/adapter tests. This is still a staging pilot, not a production admin or APN migration.

# AGENTS.md

ALLBEE — company management SPA (React + Vite + Supabase) for ALLBEE SOLUTIONS. Everything lives at the repo root; the `allbee-app/` folder is a stale README-only skeleton — ignore it.

## Commands

- `npm run dev` — Vite dev server on port 5173.
- `npm run build` — main verification. **There is no lint or typecheck setup; do not invent one.** Run this after changes.
- `npm run test` — vitest (jsdom) for the founder lockdown gate; `npm run test:e2e` — Playwright (Chromium) end-to-end for the same gate (builds paused + live variants, exercises the real lockdown status endpoint). `npx playwright install chromium` once per machine.
- App code is plain JSX; the `.ts` files (`src/ai-chat-groq.ts`, `supabase/*.ts`) are Supabase edge-function drafts, not part of the Vite build.

## Single-file app

`src/AllbeeApp.jsx` (~12,600 lines) is the **entire application** — every screen, form, and the data layer. `src/main.jsx` just mounts it. Navigation is hash-based (`#/route`, `go()`, `parseHash`); deep links like `#/accounts/haji`, `#/tasks/<id>`, `#/proposal/<token>` must keep working.

## Database (shared Supabase Postgres, NOT local)

- Env: copy `.env.example` → `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; restart the dev server after editing. Missing keys degrade gracefully (warns, doesn't crash).
- There is **no migration runner**. SQL is applied by pasting files into the Supabase SQL Editor. `supabase/schema.sql` is the canonical base; `supabase/{pr-*,apn-*,pr-web-*,pr-ux-*}.sql` are patch files applied on top. Keep any new SQL **idempotent** (`create table if not exists`, `add column if not exists`, drop-then-create policies) so re-runs never destroy data.
- The app must tolerate a table that doesn't exist yet — `fetchAll()` swallows "does not exist" errors per table, so a partial schema deploy degrades instead of white-screening.
- Roles/access (`superadmin`, `admin`, `accountant`, `staff`, `intern`, `client`, plus APN `partner`/`district_head`/`state_head`) are enforced by DB RLS and SECURITY DEFINER helpers (`is_admin()`, `is_superadmin()`, `can_finance()`, `can_module()`). Keep role strings consistent with the `profiles_role_check` in schema.sql and never rely on UI hiding alone.

## Data layer (read this before adding writes)

- Most tables are JSON-blob: `(id text pk, data jsonb, updated_at)` with the whole dataset loaded into one in-memory `db` object (shape defined by `emptyDB()` at src/AllbeeApp.jsx:842) via `fetchAll()`.
- **All writes go through the central `mutate(updater, audit)`** (src/AllbeeApp.jsx:11861): optimistic local update + diff-persist of only the changed rows + audit event. `persistWithRetry` handles expired-JWT retry. Do not write to these JSON tables directly or bypass `mutate`.
- Normalized PR2–PR5 tables (referral, withdrawal, CRM, AI — the `*_READS` maps at src/AllbeeApp.jsx:~346) are read-only page state; writes go through audited RPCs / edge functions instead.

## Edge functions (Deno)

- Deployed: `supabase/functions/{admin-users,username-login,ai-chat,apn-ai,founder-lockdown}/index.ts`. That's the source of truth; root-level `supabase/edge-*.ts` and `supabase/ai-chat-groq.ts` are drafts/copies.
- Deploy commands: `supabase functions deploy admin-users`, and `username-login`/`ai-chat`/`founder-lockdown` with `--no-verify-jwt`. `ai-chat` needs a `GROQ_API_KEY` secret; `admin-users`/`username-login`/`founder-lockdown` use injected `SUPABASE_SERVICE_ROLE_KEY`. The phase-7 guide (`ALLBEE_phase7_apply_guide (1).md`) documents deploy ordering.

## Founder Emergency Lockdown (PR-13)

- The `RemoteLockGate` component (src/AllbeeApp.jsx, above `App()`) replaces the ENTIRE app surface while the company is locked; the founder-lockdown edge function polls status every 30s, verifies the founder's code server-side (DB-backed rate limit: 5 attempts / 10 min per client IP), and holds the `locked` flag in `emergency_lockdown` (single `id='founder'` row).
- The code itself is NEVER stored: only a SHA-256 hash in `emergency_lockdown.code_hash` (seeded by `supabase/migrations/20260817130000_pr_emergency_lockdown_codehash.sql`) — unless the `FOUNDER_LOCKDOWN_CODE` edge-function secret is set, which then takes precedence.
- Go-live switch: the gate is LIVE by default. Set Vercel env `VITE_FOUNDER_LOCKDOWN_QUIET="true"` to keep a hosted domain passing through (used while a launch PR is under review). `VITE_PAUSE_TEST=1` builds render the lockdown UI with zero network (used by tests only).
- Recovery is the staged undo: apply `supabase/migrations/20260817150000_pr_emergency_lockdown_recovery.sql` (documented in-file, mirrors Founder Protocol #301 — contact the listed socials + verify identity first). `supabase db push` will detect and apply it. Once unlocked the app restores automatically within one poll cycle.
- Deploy a NEW code via SQL: `update emergency_lockdown set code_hash = '<sha256hex>' where id='founder'` (put the sha256 of the chosen code, not the code itself) — or set the `FOUNDER_LOCKDOWN_CODE` secret and redeploy the function.

## Release flow

- Vercel deploy: `vercel.json` sets build to `npm run build`, output `dist`, with SPA rewrites; set the two `VITE_*` vars in the Vercel dashboard. No CI, tags, or release process in this repo. Commit style is Conventional Commits (`feat(apn)…`, `fix(pr-ux)…`) on `main`.
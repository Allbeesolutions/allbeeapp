# AGENTS.md

ALLBEE — company management SPA (React + Vite + Supabase) for ALLBEE SOLUTIONS. Everything lives at the repo root; the `allbee-app/` folder is a stale README-only skeleton — ignore it.

## Commands

- `npm run dev` — Vite dev server on port 5173.
- `npm run build` — the ONLY verification available. **There is no lint, typecheck, or test setup; do not invent one.** Run this after changes.
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

- Deployed: `supabase/functions/{admin-users,username-login,ai-chat,apn-ai}/index.ts`. That's the source of truth; root-level `supabase/edge-*.ts` and `supabase/ai-chat-groq.ts` are drafts/copies.
- Deploy commands: `supabase functions deploy admin-users`, and `username-login`/`ai-chat` with `--no-verify-jwt`. `ai-chat` needs a `GROQ_API_KEY` secret; `admin-users`/`username-login` use injected `SUPABASE_SERVICE_ROLE_KEY`. The phase-7 guide (`ALLBEE_phase7_apply_guide (1).md`) documents deploy ordering.

## Release flow

- Vercel deploy: `vercel.json` sets build to `npm run build`, output `dist`, with SPA rewrites; set the two `VITE_*` vars in the Vercel dashboard. No CI, tags, or release process in this repo. Commit style is Conventional Commits (`feat(apn)…`, `fix(pr-ux)…`) on `main`.
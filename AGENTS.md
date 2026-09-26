# AGENTS.md

ALLBEE — company management SPA (React + Vite + Supabase) for ALLBEE SOLUTIONS. Everything lives at the repo root; the `allbee-app/` folder is a stale README-only skeleton — ignore it.

## Commands

- `npm run dev` — Vite dev server on port 5173.
- `npm run build` — main verification. **There is no lint or typecheck setup; do not invent one.** Run this after changes.
- `npm run test` — vitest (jsdom) for the founder lockdown gate; `npm run test:e2e` — Playwright (Chromium) end-to-end for the same gate (builds paused + live variants, exercises the real lockdown status endpoint). `npx playwright install chromium` once per machine.
- App code is plain JSX; the `.ts` files (`src/ai-chat-groq.ts`, `supabase/*.ts`) are Supabase edge-function drafts, not part of the Vite build.

## Single-file app

`src/AllbeeApp.jsx` remains the central app coordinator, but screens, forms, readers, authentication, APN modules, and finance modules are extracted across `src/`. `src/main.jsx` mounts the app. Navigation is hash-based (`#/route`, `go()`, `parseHash`); deep links like `#/accounts/haji`, `#/tasks/<id>`, `#/proposal/<token>` must keep working.

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

- Vercel deploy: `vercel.json` sets build to `npm run build`, output `dist`, with SPA rewrites; set the two `VITE_*` vars in the Vercel dashboard. `.github/workflows/ci.yml` runs npm test, build, and production dependency audit on pushes and PRs; there is no evidence of a complete release or signed-in browser verification process in this repo. Commit style is Conventional Commits (`feat(apn)…`, `fix(pr-ux)…`) on `main`.

<!-- HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V1 -->
## HajiHaz Autonomous Work Protocol

This project follows the HajiHaz low-credit autonomous execution protocol.

### Core operating rule
Use high-capability models only for work that genuinely needs high-level reasoning: architecture, difficult debugging, security analysis, ambiguous decisions, planning, and final review. Use the lowest sufficient model/effort for everything else.

Maximize execution through HajiHaz Commander (HHC) and Remote Desktop Commander (RDC) for deterministic or repetitive work such as terminal commands, file edits, searches, builds, tests, Git operations, deployment inspection, browser verification, screenshots, and routine fixes.

### Required project state
Before substantial work, read:
1. `AGENTS.md`
2. `.ai/MASTER_PLAN.md`
3. `.ai/CURRENT_STATE.md`
4. `.ai/NEXT_ACTION.md`
5. `.ai/WORK_QUEUE.md`
6. `.ai/BLOCKERS.md`
7. `.ai/HANDOFF.md`
8. `.ai/state.json`

After every meaningful operation or verified task, update project state before continuing.

### Continuation loop
UNDERSTAND -> INSPECT -> EXECUTE THROUGH HHC/RDC -> READ OUTPUT -> VERIFY -> CHECKPOINT -> DECIDE NEXT ACTION -> REPEAT.

Do not stop merely because one task, build, commit, push, or deployment step completed. Continue while the next action is objectively determinable.

### Usage conservation
- Do not spend premium/high-reasoning model capacity on keyboard/terminal work.
- Batch mechanical work through HHC/RDC.
- Avoid re-analyzing completed work; rely on checkpoint files.
- Prefer concise tool outputs and targeted reads over broad repeated scans.
- Escalate to a stronger model only when the current step cannot be reliably resolved with lower-cost reasoning plus tools.

### Hard-limit continuity
If a Work model becomes unavailable, any available fallback model should resume from `.ai/*` state. If all Work models are unavailable, the local deterministic orchestrator may execute only preplanned, explicitly queued, non-destructive tasks. It must stop for genuine reasoning, credentials/permissions, destructive actions, security-sensitive ambiguity, or owner decisions.

### Stop conditions
Stop only when:
- the objective is completed and verified;
- a genuine owner decision is required;
- required credentials/permissions are unavailable;
- the next action is destructive/high-risk and needs explicit approval;
- high-level reasoning is required and no suitable model is available;
- there is no objectively executable next action.

<!-- /HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V1 -->

<!-- HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V2 -->
## HajiHaz Autonomy v2 Addendum

This project uses HHC-first, low-credit autonomous execution.

### Execution routing
- HHC is the primary executor for filesystem, terminal, Git, builds, tests, deployment checks, and deterministic browser/system work.
- RDC is fallback only when a GUI interaction is genuinely required or HHC cannot perform the operation.
- Use the lowest-sufficient model/effort. Escalate to high-capability reasoning only for architecture, ambiguous decisions, difficult debugging, security-sensitive analysis, or final review.

### Queue safety
`.ai/WORK_QUEUE.json` tasks may declare: `id`, `title`, `command`, `approved`, `priority`, `depends_on`, `class`, `verify_command`, `requires_model`, `requires_owner`, `timeout_seconds`.
Task classes: `safe_local`, `network`, `deploy`, `owner_required`, `high_reasoning`.
The local orchestrator executes only explicit approved deterministic commands. Destructive or ambiguous work must not be inferred.

### Reliability gates
- Per-project locking prevents simultaneous autonomous edits to one project.
- Running tasks use leases; expired leases are recovered after crashes/reboots.
- A Git rollback snapshot (HEAD/status/binary diff) is captured before execution.
- Failed tasks retry with backoff; after the failure threshold they become `needs_reasoning` rather than looping forever.
- Dependencies must be completed before dependent tasks start.
- Network/deploy tasks pause when offline.
- Verification is required when a task supplies `verify_command`; changing code alone is not completion.
- Never place secrets in queue commands, state files, logs, prompts, or commits.

### Control and continuity
The project registry is maintained by the HajiHaz orchestrator. `PAUSE_ALL` is the emergency stop. Compact `.ai/HANDOFF.md` summaries are rewritten after material task completion/failure so future models read compressed state instead of full historical logs.

<!-- /HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V2 -->

<!-- HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V3 -->
## HajiHaz Autonomy v3 Status Indicator

When HAO (HajiHaz Autonomous Orchestrator) is active for the current project/session, every user-facing model reply related to project execution must end with a subtle standalone status footer:

`HAO • ACTIVE`

Rules:
- Place it at the very bottom of the response after the substantive answer.
- Keep it visually lightweight; do not make it a heading or large banner.
- Do not repeat or explain the footer unless the user asks.
- Show it only when HAO is actually active/applicable to the project or work session.
- If HAO is paused, blocked, unavailable, or intentionally not being used, do not falsely show ACTIVE; use the truthful state when useful, e.g. `HAO • PAUSED` or `HAO • BLOCKED`.
- This status rule applies across normal ChatGPT project chats, ChatGPT Work sessions, and other model/agent sessions that read this project's `AGENTS.md`.

<!-- /HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V3 -->

<!-- HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V4 -->
## HajiHaz Autonomy v4 Routing, Telemetry, and Handoff

### Model-use rule
Use the lowest sufficient reasoning tier. High-capability models are for genuine architecture, security-sensitive analysis, difficult debugging, ambiguity, or final review only. Mechanical execution stays with HHC, with RDC used only when GUI work is necessary.

### Usage ledger
When a model performs a material reasoning step in an HAO-managed project and HHC is available, record only a coarse local tier (`low`, `standard`, or `high`) in HAO's local usage ledger. This is a conservation heuristic, not an exact ChatGPT credit meter. Never claim exact remaining ChatGPT Work allowance from this ledger.

### Reasoning escalation
When deterministic execution reaches `needs_reasoning` or a genuine owner decision is required, prefer `.ai/MODEL_HANDOFF.md` as the compressed handoff. Resolve only the reasoning gap, then return deterministic execution to HHC/RDC rather than keeping the premium model active for routine commands.

### Notifications
HAO may issue local Mac notifications for major completion, repeated failure/escalation, or owner approval requirements. Do not notify for every routine task.

### Project metadata
HAO may auto-discover local project stack, test/build/lint/deploy commands, Git remote, deployment provider, and candidate deployment URLs. A candidate URL must not be presented as verified production unless verification has actually occurred.

<!-- /HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V4 -->

<!-- HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V5 -->
## HajiHaz Autonomy v5 Distributed Control and Analytics

### Adaptive routing
For each task, prefer deterministic HHC execution. Use RDC only when GUI interaction is genuinely required. Use a model only for a real reasoning gap, and use the lowest sufficient reasoning tier. When usage-conservation mode is elevated, avoid high reasoning unless security, architecture, cryptography, or similarly high-stakes analysis truly requires it.

### Project-specific policy
Read `.ai/HAO_POLICY.json` when present. It may override the global HAO defaults for executor preference, auto-deploy permission, parallelism, notification behavior, and model policy. Project-specific policy must never weaken destructive-action, secret, or owner-approval safety gates.

### Multi-machine continuity
HAO maintains a machine registry and heartbeat. Work may be delegated only to a machine explicitly registered as online and capable. A missing second machine is not an error; the primary Mac remains authoritative until another authorized HAO node is connected.

### Analytics
HAO records task outcomes, retries, reasoning escalations, and deterministic completions. Any model-savings metric is heuristic only and must not be presented as exact token or credit savings.

### Remote access
HAO remote/mobile control must use an authenticated transport. Never expose the local dashboard publicly without authentication. The OpenAI Secure MCP tunnel may be used for ChatGPT/HHC access; browser/mobile remote access requires an authenticated HTTP/VPN/tunnel transport.

### Notifications
Local macOS notifications are active. External notification providers may be enabled only through explicitly configured credentials/connectors; absence of credentials must be reported as inactive rather than simulated.

### Exact ChatGPT allowance
Exact ChatGPT Work/Astra/Luna remaining allowance must only be shown if OpenAI exposes a supported source. Otherwise HAO must explicitly report it as unavailable and use local conservation heuristics.

<!-- /HAJIHAZ_AUTONOMOUS_WORK_PROTOCOL_V5 -->

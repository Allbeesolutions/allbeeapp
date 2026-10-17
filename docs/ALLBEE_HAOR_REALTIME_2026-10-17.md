# AllBee HAOR — realtime resilience and dependency hardening (17 October 2026)

## Approved scope and release boundaries

Resumed the owner-independent work queue from `e7f7827`. Reconnected to the authorized Mac via HajiHaz Commander. Maintained `.ai/HAO_POLICY.json` with `allow_auto_deploy: false`. No production deployment, database schema, production customer records, finance ledger, credentials, RLS grants or auth settings were modified. Unrelated modified files under `.ai/` and `AGENTS.md` remain preserved.

## Actual fixes

1. **Stale realtime callbacks:** `src/realtimeReconnect.js` uses a monotonically increasing channel generation, ignoring delayed `SUBSCRIBED` and `CLOSED` statuses from obsolete channels after reconnect, route transition or stop.
2. **Reconnect race and retry burst:** Active channel recovery cancels the queued retry. Duplicate `SUBSCRIBED` events no longer cause duplicate `onReconnect` reloads. Exponential backoff remains capped; a failed initial `createChannel` attempt can retry rather than crash the page. `stop()` is idempotent and performs best-effort cleanup.
3. **Scoped realtime effect teardown:** In `AllbeeApp.jsx`, disposed route instances no longer schedule reloads, update audit state, or chain another fetch after unmount. Pending timers are still cleared on cleanup.
4. **Vulnerable transitive dependency:** Refreshed the lockfile's jsPDF→DOMPurify dependency from `3.4.13` to `3.4.17`, without altering application-level dependency ranges or unrelated package versions.

## Verified evidence

| Gate | Result |
| --- | --- |
| Realtime reconnect and refresh unit tests | **7/7 pass**, including three added stale/recovery/create-error cases |
| Clean dependency reinstall | `npm ci` pass |
| Full certification after updated dependency | **75 files / 381 tests pass** |
| Full route/viewport browser sweep | **504/504 pass**, zero reported JS crash/overflow |
| APN interface browser sweep | **492/492 pass** |
| Admin/Client/APN chat interaction browser checks | **18/18 pass** |
| AI/admin/client crash smoke | **5/5 pass** after updated dependency |
| RPC security surface | **167 referenced; 12 protected internal; 0 reported violations** |
| Bundles | Main **508.3 KiB/525 KiB limit**, total **2511.2 KiB/2560 KiB limit** |
| Production dependency audit at LOW threshold | **0 vulnerabilities** |

The logs and snapshots are kept as local uncommitted evidence under `.ai/haor-20261017-realtime/`. `npm ci` reported warnings about unapproved install-scripts hooks for existing packages, but exited successfully and the full build/tests passed. These are mocked/session-fixture browser checks, not authenticated live production checks.

## Remaining independently-actionable or owner-gated items

- **Next without owner input:** measured main-bundle route decomposition, telemetry ingestion/rate analysis in safe test fixtures, offline PWA upgrade regressions, and continued network/realtime stress testing. Do not claim bundle headroom means the page is already optimally fast.
- **Requires production access:** authenticated Admin/APN/Client realtime reconnect across devices, live Supabase RLS, finance RPC schema and real AI provider behaviour.
- **Requires explicit release approval:** production Vercel deployment. The public production version is separately verified before release; GitHub commit and CI passing do not mean these changes are live.

## Release acceptance

The only staged candidates are `src/realtimeReconnect.js`, `src/realtimeReconnect.test.jsx`, `src/AllbeeApp.jsx`, the `package-lock.json` DOMPurify patch update, and this report. Preserve other worktree files.

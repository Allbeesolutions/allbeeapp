# AllBee HAOR — NPWWMI #1–#15 reliability and performance batch

Date: 17 October 2026. Baseline: `891ddc0` deployed on `https://app.allbeesolutions.com` and `allbeeapp-six.vercel.app`.

## Guardrails
- Authorized local code, deterministic tests, read-only diagnostics and verified GitHub commits only.
- `.ai/HAO_POLICY.json` has `allow_auto_deploy:false`. No production deployment was initiated.
- No database migrations, production records, finance balances, user sessions, credentials or permission grants were modified.
- Preserve unrelated local changes including `AGENTS.md`, `.ai/state.json` and screenshot/evidence directories.

## Changes delivered
1. **On-demand Concepts & Ideas page (#1–#2):** moved into `src/Concepts.jsx` and lazy-loaded with the existing design and action callbacks preserved. Removed from the always-loaded `AllbeeApp.jsx`; malformed concepts, tags and notes are guarded. Added focused interaction and empty/malformed collection tests.
2. **PWA update/draft safety tests (#5):** exported the existing `editingNow` predicate and added active input, assistant conversation, and unsent AI draft regressions. The service worker is now exercised in isolated tests for offline app-shell fallback, hashed JS cache fallback, cache generation cleanup without forced navigation, and noninterception of modifying/foreign requests.
3. **Realtime stress tests (#4):** new deterministic 200-cycle disconnect/reconnect test checks obsolete callbacks and exactly-once subscription cleanup. A second test isolates simultaneous controllers representing browser tabs.
4. **Browser navigation and degraded-load suite (#8, #11, #13):** `scripts/ui/navigation-stress-verify.mjs` uses mocked role sessions, delayed JS module loads and repeated navigation across superadmin, APN and client routes. Full local suite passed 40/40 scenarios across 320/390/768/1440 px.
5. **Stable APN browser testing:** periodic Chromium page recycling and a separate navigation timeout prevent slow warm Vite module loading from producing false failures after hundreds of navigations. Added `--focus=` to reproduce individual APN UX cases. All three initial late failures passed individually; the complete suite passed in a fresh rerun.
6. **CI coverage (#14):** `npm run test:navigation-smoke` exercises superadmin Concepts, APN AI and Client AI in Chromium. The GitHub CI workflow runs this alongside the existing crash-smoke, auth, RPC, build, budget and audit gates.

## Full verification
| Gate | Verified result |
| --- | --- |
| Unit and build certification | **80 test files / 395 tests passed** |
| Full roles and viewport sweep | **504/504 passed**, zero page errors/crashes/overflow |
| APN UI, including empty/error/mobile/dark cases | **492/492 passed on the final rerun** |
| Deeper Admin/APN/Client AI mock flows | **18/18 passed** |
| Admin/APN/Client chat interactions | **18/18 passed** |
| Delayed-module navigation stress | **40/40 passed** |
| CI navigation smoke | **3/3 passed** |
| Realtime and PWA regression cases | New 200-cycle and offline tests passed in Vitest |
| Lockdown E2E | Passed |
| Finance transactional RPC, disposable PostgreSQL | Passed rollback/locks/role grants/idempotency/concurrency/replay |
| RPC security surface | 167 RPCs, 12 protected helpers, 0 reported violations |
| Production dependency audit | **0 vulnerabilities** |
| JS bundle performance | Main entry **503.1 → 501.0 KiB** (within 525 KiB limit); total JS 2512.1 / 2560 KiB |

Local evidence is stored under `.ai/haor-20261017-batch3/` and need not be committed. The long APN browser run initially reported three late timeouts. The two navigation-timeout cases and the AI retry case all passed in isolated reproductions; the improved runner's full fresh 492/492 run passed with no failures. Do not hide this history when diagnosing future browser flakes.

## Status across NPWWMI #1–#15
- **New code/tests:** #1–#2 scoped on-demand Concepts route; #4 reconnect stress; #5 offline/draft checks; #11 navigation stress; #13 delayed module loads; #14 GitHub CI guardrail; #15 tested release handoff.
- **Recertified existing protections:** #3 AI timeout/retry/cancellation; #7 chat flow; #8 role fixture isolation; #9 finance transactional tests; #10 mobile/accessibility checks; #12 crash telemetry.
- **Partially addressed, not finished:** #6 broad API query/rerender optimization (not safe to claim completed based on a small bundle reduction alone). Additional measured component splitting under #1–#2 can continue in later releases.
- **Still requires access:** real authenticated cross-role and cross-device realtime and data-isolation tests, production Supabase schema/RLS/finance RPC migration work and real provider AI verification.
- **Future deployment:** requires explicit owner approval; GitHub push does not constitute a production release.

## Release evidence / owner gate
The tested GitHub commit should be deployed only after separate approval. After deployment, verify both public build IDs, login navigation, and authenticated role flows where authorized.

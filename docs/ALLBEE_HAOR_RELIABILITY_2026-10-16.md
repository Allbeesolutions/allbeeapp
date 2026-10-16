# AllBee HAOR — autonomous reliability batch (16 October 2026)

## Release envelope and baseline
- Starting Git revision: `328a6a0`, confirmed active on `https://app.allbeesolutions.com`.
- Local engineering, tests, read-only audits and GitHub push are authorized. Production deployment is **not** automatically authorized: `.ai/HAO_POLICY.json` includes `allow_auto_deploy:false`.
- No production database migrations, role changes, finance records, payments or credentials were modified. Existing unrelated `.ai/` and `AGENTS.md` changes were preserved.

## Implemented improvements
1. **Actual cancellation on AI Stop/navigation** — `AllbeeAI` owns a per-request `AbortController`, forwards its signal to the gateway and aborts on Stop/unmount. Stale responses remain excluded from the transcript.
2. **Bounded optional retrieval** — staff AI memory indexing is limited to 700 ms and query retrieval to 1,800 ms. Hung calls are aborted and skipped; the main assistant proceeds. Client AI never retrieves internal workspace memory.
3. **Bounded primary gateway** — `callAI` enforces a 60-second total deadline by default, forwards abort signals to Supabase Edge Function invocation, retries transient failures once with cancellable backoff, and never retries cancellations.
4. **Lower AI render cost** — memoized company configuration rather than rebuilding the company object on every composer keystroke; recalculated context only when meaningful dependencies change.
5. **Safer crash reports** — root, app and individual page error boundaries send a deterministic fingerprint, build ID, source and redacted/truncated error text; common email/UUID/long token identifiers are masked from telemetry.
6. **No forced PWA reload during active work** — service-worker activation no longer navigates every open tab. The app's update guard defers stale-build reloads while an AI conversation/draft is open or a form is being edited.
7. **Repeatable browser CI** — `npm run test:crash-smoke` exercises Admin AI, APN AI, Client AI and a malformed-data AI case. CI installs Chromium and runs the smoke suite plus the RPC surface security audit.
8. **More stable test execution** — Vitest uses two workers and a 15-second per-test timeout, reducing false failures from expensive integrated UI tests.
9. **Regression tests** — added timeout/cancellation/retry/memory resilience tests and safe crash telemetry tests; expanded existing AI component and PWA service-worker contracts.

## Evidence (all from isolated test fixtures/local build)
| Test / gate | Verified result | Local evidence |
| --- | --- | --- |
| Unit + build certification | 75 files / **378 tests PASS** | `.ai/haor-20261016-batch2/postfix-certify.log` |
| Static runtime lexical integrity | PASS | Focused test and full certification |
| AI CI smoke | **5/5 PASS** | `.ai/haor-20261016-batch2/crash-smoke.log` |
| Full route/mobile sweep | **504/504 PASS** | `.ai/haor-20261016-batch2/final-ui-routes.log` |
| Deep AI browser scenarios | **18/18 PASS** | `.ai/haor-20261016-batch2/final-ai-deep.log` |
| APN UI / empty/error/dark/mobile | **492/492 PASS** | `.ai/haor-20261016-batch2/final-apn-ux.log` |
| Chat interactions | **18/18 PASS** | `.ai/haor-20261016-batch2/final-chat.log` |
| Lockdown end-to-end recovery | PASS | `.ai/haor-20261016-batch2/final-e2e.log` |
| Finance transactional RPC in disposable PostgreSQL | PASS rollback/idempotency/roles/migration replay | `.ai/haor-20261016-batch2/final-finance.log` |
| RPC-surface security audit | **167 referenced; 0 violations** | `.ai/haor-20261016-batch2/final-rpc.log` |
| Bundle size | **507.9 KiB main / 525 KiB limit; 2509.6 KiB total / 2560 KiB limit** | `.ai/haor-20261016-batch2/postfix-certify.log` |
| Production dependency audit | 0 high/critical; **1 low-severity transitive DOMPurify advisory remains** | `.ai/haor-20261016-batch2/audit.log` |

## Status of the 15-item NPWWMI envelope
- **Implemented/strengthened in this batch:** #2 API fault/timeout/cancellation, #3 client-side error telemetry, #4 hung AI loading, #6 rapid stop/unmount behavior, #8 AI render/network efficiency, #9 AI response controls, #10 PWA update/draft preservation, #14 automated browser CI, #15 certification/evidence and Git release handoff.
- **Expanded/recertified with prior implementation:** #1 cross-role AI route crash coverage, #11 profile/chat isolation tests, #12 finance transactional testing, #13 mobile responsiveness and accessibility.
- **Still pending optimization:** #7 larger targeted module split; despite staying within budget, the main bundle is relatively close to its cap. No unmeasured refactor was introduced in this reliability patch.
- **Still gated:** #5 live realtime network/egress behaviour and authenticated Admin/APN/Client cross-device production checks require verified sessions and database permissions. Unit-level realtime cleanup tests already exist.

## Release safeguards and next owner gates
- Do not call this production-complete until the new Git revision is deployed by explicit owner approval and its build ID checked on both public domains.
- Real authenticated production sessions and correct AllBee Supabase project access are required for live RLS, AI provider, finance and realtime verification. Mocks do not prove those outcomes.
- Preserve current unrelated working tree files and do not run blanket staging/reset.

# ALLBEE HAOR — APN bundle optimization and SPA memory regression (22 October 2026)

## Authorization / scope

Owner requested "start next" after consented analytics integration. This safely continues **autonomous engineering** from independently verified GitHub `main` **`2d9dff7`**. Production deployment, customer-analytics SQL migration, cron retention scheduling, and live data changes still require explicit release authorization and were **not** performed.

Isolated worktree: `/Users/hajihaz/projects/allbeeapp-haor-next-20261022`.
Original AllBee main worktree, its unpublished HajiPay sandbox commit `a1277b3`, local safety branch, the analytics worktree and unrelated `.ai` files remain untouched.

## Improvements made

1. **Route-specific APN component chunks.** Replaced four eagerly imported APN components with `React.lazy`: `APNInactive`, `APNCheckIn`, `APNBankDetails`, and `APNHeadPartnerCard`. Existing APN route-level Suspense boundaries cover the latter three; added an explicit inactive-account fallback to avoid suspending before the APN shell is mounted. No role permission, financial calculation, database, or contract changed.
2. **Measured entry bundle reduction.** Prior `2d9dff7` entry was **503.2 KiB**. Updated entry is **493.1 KiB**, a measured **10.1 KiB reduction** (~2.0%). Aggregate JS is **2529.0 KiB / 2560 KiB budget**—higher than the prior 2527.6 KiB because deferred chunks have some overhead. Initial bundle size has improved; total bundle size has **not**.
3. **Garbage-collected SPA heap trending.** New `npm run test:spa-memory` runs 20 repeated four-route passes per role (**240 total** navigation checks, mobile 390px), with explicit `HeapProfiler.collectGarbage` checkpoints after rounds 4, 12 and 20. All three role trends passed a conservative guard: from the first warmed checkpoint to the last GC checkpoint, growth must stay within max(7 MiB, 35% of warm heap).
4. **Unit and behavior contracts.** Added pure memory-trend evaluator tests and a source contract for the four lazy APN imports, matching fallback behavior. Updated the District Head navigation test to wait for asynchronous partner rendering.
5. **CI regression gate.** GitHub Actions now runs the new fixture-based memory test after the existing SPA smoke gate. It is intentionally scoped to mock users, not production accounts.

## Verified local evidence

| Gate | Result |
| --- | --- |
| Unit and production-build certification | **93 test files / 439 tests PASS**, including the inactive-account Suspense fallback |
| Full route/viewport checks | **504/504** PASS |
| Dedicated APN browser tests | **492/492** PASS |
| Deep Admin/APN/Client AI browser tests | **18/18** PASS |
| Chat browser checks | **18/18** PASS |
| Repeated memory-mode route navigation | **240/240** PASS, **0 heap trend threshold failures** |
| Superadmin garbage-collected checkpoints | **11.36 → 11.57 → 11.99 MiB** |
| Partner garbage-collected checkpoints | **10.78 → 10.96 → 11.16 MiB** |
| Client garbage-collected checkpoints | **9.41 → 9.58 → 9.65 MiB** |
| RPC surface security | **169 referenced / 12 protected / 0 violations** |
| Isolated analytics SQL migration / RLS / rates | PASS, including concurrent caps |
| Lockdown recovery and dependency audit | PASS / 0 vulnerabilities |
| Main JS | **493.1 KiB / 525 KiB** |
| Total JS | **2529.0 KiB / 2560 KiB** |

Evidence in `/tmp/allbee-oct22-next-memory.log`, `/tmp/allbee-haor-next-20261022/`, and generated worktree-local `.ai` folders is excluded from commits.

**Limitations:** Three forced-GC checkpoint samples over 240 navigation events are a repeatable memory-regression signal, **not** a proof of no memory leaks over hours/days. Testing uses isolated fixture roles; actual authenticated iOS/Android, realtime performance and live request traces remain separately gated.

## Next release gates

- GitHub push and independent GitHub Actions certification of the exact release SHA.
- Owner approval for any production Vercel deployment.
- Separate explicit owner review for `20261021221500_customer_usage_analytics.sql`, disclosure and a retention scheduler. Committing the SQL migration does not execute it.
- Authorized authenticated real-account and hardware testing before calling production analytics fully accepted.

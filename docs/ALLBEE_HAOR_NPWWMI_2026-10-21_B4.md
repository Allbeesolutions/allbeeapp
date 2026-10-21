# AllBee HAOR — Autonomous NPWWMI #7–#9 and #11–#14 (21 October 2026)

## Scope and release restrictions

This batch began from verified remote `main` at `1b3dfe5` in a **new isolated Git worktree**: `/Users/hajihaz/projects/allbeeapp-npwwmi-20261021-b4`. Owner authorized audit, deterministic implementation, tests, commit and push, but **no production deployment**. The original AllBee worktree's unpushed HajiPay helper commit `a1277b3`, its changed files, and unrelated generated `.ai/` and `AGENTS.md` files were protected. No production Supabase migrations, records, financial balances, payments, role grants or credentials were changed.

## Implemented and verified

1. **#8 — APN financial refresh efficiency.** APN wallet/withdrawal/profile/district/home finance snapshots previously used a naked five-minute timer, including hidden tabs and overlapping in-flight requests. Added `src/data/visiblePolling.js`: initial fetch, coalesced overlapping refreshes, hidden-tab suspension, immediate visible-tab refresh, error containment, and late-response suppression on unmount. This retains the calendar-derived financial eligibility refresh cadence. Four new lifecycle tests cover all paths, including true zero balances.
2. **#9 — Optional owner profile failure isolation.** APN `public_owner_profiles` read now catches rejected promises and ignores completions after unmount, preventing an optional public-directory outage from generating an unhandled rejection or disabling the portal.
3. **#13 — Crash recovery and privacy.** APN tab recovery previously rendered raw exception text (which could expose account data) and logged raw error objects. It now displays a generic recovery message and sends the same redacted, build-versioned fingerprint diagnostics used by Root, App and Page boundaries. All four boundaries avoid printing raw error content to the console.
4. **#13 — Crash telemetry storm control.** Added an in-memory 60-second per-fingerprint reporting throttle (max 256 entries). Duplicate render errors cannot bombard the `app_record_error` RPC, but unrelated failures still report. Route boundary now uses the canonical `CURRENT_BUILD_ID`.
5. **#12 — Longer-running navigation and heap evidence.** New `scripts/ui/spa-soak-verify.mjs` tests repeated *single-page* hash navigation with independent fixture-based Admin, APN and Client sessions. Full run: 192/192 navigation checks at 390/1440px, zero recorded page errors/overflow. Captured Chromium JS heap start/end as diagnostic context, **not** a claim of zero memory leaks.
6. **#14 — CI gate.** Added `npm run test:spa-soak-smoke` (24/24 local cases, mobile 390px) to GitHub CI alongside existing crash/navigation/bundle/security checks.
7. **#11 — Mobile and keyboard regression coverage.** The entire route/viewport suite, 320–1440px, and 390px SPA smoke regression were recertified without layout failures. Existing keyboard focus, minimum touch target and reduced-motion contracts remained green. No unverified visual redesign introduced.

## Evidence-based acceptance

| Check | Result |
| --- | --- |
| Full unit and build certification | **86 test files / 415 tests PASS** |
| Full roles + viewport sweep | **504/504 PASS** |
| APN error/empty/mobile/dark UX suite | **492/492 PASS** |
| Deep AI mocked browser checks | **18/18 PASS** |
| Client, team, and APN chat browser checks | **18/18 PASS** |
| Long SPA navigation and heap-measurement soak | **192/192 PASS**, plus 24/24 CI smoke locally |
| Lockdown end-to-end recovery | PASS |
| Disposable PostgreSQL finance harness | PASS: rollback, concurrency, migration replay, locks, retries, and role restrictions |
| RPC-surface audit | 167 references, 12 protected helpers, **0 violations** |
| Production dependency audit (low threshold) | **0 vulnerabilities** |
| Main entry JS bundle | **503.0 KiB of 525 KiB budget** |
| Total JS | **2514.7 KiB of 2560 KiB budget** |

Logs (not committed): `/tmp/allbee-haor-b4/`, `/tmp/allbee-b4-spa-soak.log`. Browser role tests use local fixtures and do not verify live real-account behaviour.

## Remaining or only partially improved

- **#7 larger bundle reduction is not complete**: the main JS grew from baseline 501.9 KiB to 503.0 KiB due to new reliability logic, although it is within budget. Future measured route extraction should target actual large Admin/APN modules with separate verification, rather than risky whole-app refactors.
- **#8 live performance profiling** still requires authorized production metrics; isolated tests establish fewer hidden/overlapping APN reads but not universal latency.
- **#9 real token expiry / live cross-device reconnection** remains access-gated.
- **#11 accessible mobile keyboard and focus use on actual iOS/Android hardware** requires real-device validation.
- **#12 long-term memory leak certification** would require repeated heap checkpoints, forced GC / heap snapshots under sustained use. The present heap measurements alone cannot prove no leak.
- **#13 actual production telemetry ingress visibility** requires correct Supabase access.
- **#14 CI smoke is expanded** but does not replace authenticated end-to-end role tests.

## Release gate

Commit and push only the verified source, tests, CI changes, and this report from the isolated worktree. `.ai/HAO_POLICY.json` still specifies `allow_auto_deploy: false`. Do not deploy to Vercel or modify production data without explicit new owner authorization.

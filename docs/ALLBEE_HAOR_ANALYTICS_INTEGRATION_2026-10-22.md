# ALLBEE HAOR — Customer analytics integration and pending engineering (22 October 2026)

## Scope and immutable gates

Owner authorized isolated development, local/fixture security audits, tests, commits and GitHub push for NPWWMI #8–#10, #14, #16–#20 and #23–#25. **No production deployment, production SQL, live user data, payment changes, or unattended retention job are authorized.**

Source: latest verified `origin/main` **`613ae1a`**. Integration worktree: `/Users/hajihaz/projects/allbeeapp-haor-analytics-20261022`. Three staged analytics commits from the existing `feat/customer-usage-analytics-20261021` worktree were cherry-picked into the clean worktree, then independently hardened. The original analytics worktree/branch and the original main's private unpushed HajiPay helper `a1277b3` are not modified or included.

## Implemented

1. **Consent-first event capture (#16–#18).** Signed-in, account-isolated visitor/session identifiers, explicit opt-in, opt-out that removes local/session identifiers, DNT/GPC honoring, 30-minute inactivity visit boundaries, 800-ms duplicate-view suppression, foreground active-time counts, and no private text/URLs/IDs or sensitive event values. Client home and seven safe APN sections receive separate coarse route categories; chat, AI conversations, wallet, profile, support and vault paths are excluded. Runtime event targets are only `nav` or `button`.
2. **Admin dashboard (#20).** Protected `app_customer_usage_report` RPC with 24-hour/7-day visits, signed-in unique and returning users, page views, generic navigation taps, active minutes, 30-day daily history, top screens and anonymized actor prefixes. `PlatformV6Operations` can open this Admin-only tab independently of the unrelated operations RPC, and the usage module is lazy-loaded. Incomplete/invalid responses produce an error rather than fake zero activity; actual empty days become zero only after a valid backend report.
3. **Staged database migration (#19).** Event table with tightly restricted kind/screen/target values, actor inferred only from authenticated `auth.uid()`, RLS admin-only raw SELECT, secured ingestion/report RPCs, actor advisory transaction lock and limits of 240/session/hour and 1200/account/hour. All report day grouping is explicitly UTC. Data is not exported to outside analytics processors.
4. **Retention protection (#19/#25).** Privileged function can prune at most a bounded batch of events older than 90 days; no call, cron, production deletion or other side effect was executed.
5. **Performance (#8/#9).** App-level telemetry and the Admin customer report are loaded on demand. Existing APN and notification read-coalescing protections from `613ae1a` remain intact. Additional profiling beyond local fixtures and SQL index checks still requires actual authorized request traces.
6. **Long-running/navigation regression (#10/#14).** Existing 192-case SPA soak plus 24-case CI smoke and full role/device browser sweeps were run. This is evidence of resilience under the tested navigation scenarios, not proof of zero long-term memory leaks.
7. **Repository hygiene (#23/#24).** All five historical GitHub AI/CRM/integration feature branches were confirmed ancestors of remote `main`; no unnecessary merge needed. The original `main` worktree stays untouched. A local-only safety branch `owner-safety/hajipay-sandbox-20261022` preserves HajiPay commit `a1277b3` without pushing it.

## Verification performed

- **Full-site route/browser:** 504/504 PASS, zero layout errors/overflow.
- **APN dedicated UI:** 492/492 PASS.
- **Deep AI:** 18/18 PASS; **chat:** 18/18 PASS.
- **SPA navigation smoke:** 24/24 PASS; new legacy smoke suites (AI crash 5/5, navigation 3/3) PASS after analytics integration.
- **Full unit and build certification:** **91 test files / 430 tests PASS**, including consent, account switching, DNT/GPC, route privacy, Admin availability and incomplete-report handling. GitHub CI will independently verify the final commit.
- **SQL integration:** Disposable private PostgreSQL cluster passes migration, authenticated intake, anonymous/non-admin denial, RLS, admin report counts, categorical input validation, **240/session/hour**, **1,200/account/hour** across sessions, and concurrent two-connection pressure test (300 writes attempted, 240 accepted).
- **RPC audit:** 169 calls referenced, 12 protected helpers, 0 violations; lockdown E2E PASS; production dependency audit at low threshold: 0 vulnerabilities.
- **Main JS:** ~503.2 KiB of 525 KiB budget; total JS ~2527.5 KiB of 2560 KiB budget. No claim of net total bundle reduction; analytics is additional functionality.
- Security/fixture logs are local under `/tmp/allbee-oct22-analytics-release/` and `/tmp/allbee-oct22-usage-concurrent.log`, not committed.

**Automated CI hardening:** The GitHub runner is pinned to Ubuntu 24.04 and now executes `npm run test:customer-usage-sql` against a fresh disposable PostgreSQL cluster. This is strictly a local-to-CI scratch migration/RLS/rate-limit/concurrency check, never a production Supabase migration.

## Pending owner-only release gates

- **Production SQL**: Requires review/approval, then apply only to the verified AllBee Supabase project. Local test DB validation is not production RLS verification.
- **Privacy/retention**: Final 90-day notice, disclosure, explicit approval for cleanup scheduling and any retrospective deletion procedure.
- **Application deployment**: Requires separate owner approval; GitHub code alone does not enable live collection.
- **Real users**: Use opted-in test accounts to validate real Admin dashboards and visitor logs; no fabricated totals or unconsented activity.
- **Cross-device**: Authenticate Admin, APN, Employee and Client on actual iOS/Android and verify session history, consent withdrawal and offline-PWA behavior.
- **Performance**: Investigate bundle headroom and memory trends, API latency, CPU and heap-retention using authorized real-world traces; no unsupported universal improvement claim.

## Owner safety summary

**Not deployed. Not migrated. Not scheduled.** The existing live production build and HajiPay work are preserved. The GitHub commit is intended to be verified in GitHub Actions before the release is considered merge-ready.

# ALLBEE HAOR — NPWWMI #2–#15, 21 October 2026

## Guardrails and baseline
- Owner approved autonomous code/test/commit/push for #2–#15, but **not production deployment**.
- Started from `76d1d5d`, the independently certified GitHub `main` revision.
- Worked solely in the isolated worktree `/Users/hajihaz/projects/allbeeapp-npwwmi-20261018`; staged only named AllBee source, tests and this report. The original local `main` has an **unrelated, unpushed HajiPay helper commit `a1277b3`** and other files; do not reset, rebase, stage, or incorporate them.
- The live AllBee domains continue serving `891ddc0` pending owner deployment approval.
- No live Supabase migrations, RBAC changes, production records, payments, customer uploads, or API credential changes.

## Concrete defects fixed
1. **Client visibility on missing identity (#2, #8, #11):** Client portal records previously used `row.clientId === profile?.id`, which could match unowned records when both IDs were missing. Now require a nonempty profile ID and structured rows before displaying client updates, documents, quotations, invoices, or tickets. This is a frontend defense in depth, not a substitute for backend RLS.
2. **Malformed client data (#2, #9):** Null/non-object rows, nested quotation items of the wrong type, and invalid document dates no longer break the client overview.
3. **Support message safety (#4, #7, #8):** Client UI refuses ticket messages unless the ticket appears in that client's scoped list; rejects empty/malformed content; catches rejected RPC/network promises and reports an error instead of creating unhandled rejections. Live ticket authorization must still be enforced by the server.
4. **Profile-photo failure recovery and lazy loading (#6, #9):** Photo editor loads on demand instead of with the base Client Portal module. Remove-photo action safely catches rejected saves, does not falsely report success, and provides busy-state behavior. Original 500x500 cropper contract preserved.
5. **Partial AI knowledge resilience (#3):** Staff AI knowledge/pricing reads are independently settled. A single unavailable pricing RPC no longer discards successful other catalog results; malformed search rows are ignored. Client AI still does not fetch internal workspace catalog.
6. **Notification unread background resilience (#5, #7, #13):** Extracted an independently tested polling lifecycle that coalesces overlapping unread-count requests, catches offline RPC failures, skips hidden-tab intervals, refreshes on return, and drops late responses after logout/unmount.

## #2–#15 status reconciliation
- **Newly implemented and proven:** targeted #2, #3, #4, #5, #6, #7, #8, #9, #11, #13 and test coverage for #14–#15 (see specific fixes). These items are **partially advanced**, not certified fully complete across every authenticated workflow.
- **Recertified existing protection:** #4 chat browser regression; #7 rapid reconnect/navigation; #8 role-view fixture checks; #10 offline/PWA and viewport checks; #11 access control/edge-auth/RPC audits; #12 disposable finance transaction tests; #13 crash/error-boundary and malformed data scenarios; #14 CI unit/browser gates.
- **Pending further work:** measured latency and oversized-module refactors (#5–#6), authenticated production Client/Admin/APN role flows and media synchronization (#2–#4,#8–#9), real provider responses (#3), cross-device authenticated realtime and token expiry (#4,#7), production Supabase RLS validation (#11), real production telemetry review (#13). No claim of 100% completion is appropriate.

## Verification on this commit candidate
- **83 test files / 407 tests passed** (focused new suites plus full certification).
- **504/504** route/viewport browser cases passed.
- **492/492** APN UX browser cases passed.
- **18/18** deep Admin/APN/Client AI browser cases passed, including malformed responses.
- **18/18** chat browser scenarios passed.
- **40/40** delayed-module navigation stress cases passed.
- Lockdown E2E passed; Supabase edge-auth checks passed; RPC audit: 167 referenced, 12 protected helpers, **0 violations**.
- Disposable PostgreSQL finance migration replay, rollback, locks, retries and concurrent request tests passed.
- **0 production dependency vulnerabilities** at low severity threshold.
- Build/budget: entry JS **501.9 KiB / 525 KiB**, aggregate JS **2513.6 KiB / 2560 KiB**. The client photo editor was split on demand; the total bundle limit is close enough to warrant future measured optimization.
- Local evidence is saved under `/tmp/allbee-haor-20261021/`, not pushed to the repository. Mock/sandbox tests do not constitute live authenticated feature validation.

## Release gate
Push this tested candidate to GitHub `main` from the isolated worktree, then verify GitHub Actions. Production deployment is **not authorized**. Once owner approves, release the exact verified SHA through the existing Vercel project, confirm both public build IDs, and perform authenticated role testing where access is available.

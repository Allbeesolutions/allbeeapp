# UI verification — 2026-09-27

Local UI package; no production deployment or database migration in this batch.

## Verified changes

- Shared fields associate labels with wrapped controls and feedback; selects return keyboard focus; dialog rerenders retain typing focus.
- Native navigation/account controls, named icon buttons, mobile filter scrolling, keyboard-accessible table containers, reduced-motion-aware press/haptic feedback.
- Accountant mobile navigation opens Accounts. Escape closes the internal menu and restores its trigger.
- ALLBEE AI shared brand mark, responsive conversation, duplicate-send guard, recoverable failed drafts, retry and copy feedback.
- Fixed runtime defects: missing finance lazy-route boundary; missing planned-expense icon/status bindings; missing APN bank-details dependencies; missing client-helpdesk runtime.
- Existing business save/RPC paths and role checks retained.

## Evidence

232 tests in 43 files pass. Production build passes; main JS 483.23 kB / 139.14 kB gzip (prior 480.93 / 138.40). No new dependency. No configured lint/typecheck exists.
504 Chromium mocked role/route/viewport cases pass: zero observed render crashes, page errors, document overflow, clipped controls or unnamed visible buttons.
Shell widths: 320, 360, 375, 390, 430, 768, 1024, 1366, 1440, 1920. Allowed internal routes and APN tabs also run at 320 and 1440.
Two populated planned-expense cases pass at 320 and 1440 after wiring status options.
Seven interaction checks pass: accountant menu/Accounts navigation; AI failure/retry/new chat; client support creation/refresh; partner payout mismatch/save; client support dialog/Escape at 320/768/1440.

| Role | Cases | Distinct routes | Result |
|---|---:|---:|---|
| superadmin | 106 | 49 | Pass |
| admin | 96 | 44 | Pass |
| accountant | 40 | 16 | Pass |
| staff | 70 | 31 | Pass |
| intern | 42 | 17 | Pass |
| client | 10 | 1 | Pass |
| partner | 42 | 17 | Pass |
| district_head | 44 | 18 | Pass |
| state_head | 44 | 18 | Pass |
| anonymous | 10 | 1 | Pass |

## Reproduction and limitations

Run npm test, npm run build, npm run test:ui. The browser harness injects a mock only into its loopback Vite server and blocks external requests; production Supabase configuration is unchanged.
Machine-readable inventory: .ai/UI_COVERAGE_RESULTS.json.
Full logs/screenshots: /tmp/allbee-ui-evidence/ on the Mac. Reviewed dashboard, APN home and AI mobile captures.
These are render/navigation and selected interaction checks with synthetic records. They are not exhaustive button/data-state coverage, live RLS verification, real service/AI delivery certification or physical-device haptics testing. Module-grant fixtures are explicit in scripts/ui/mockSupabase.js.
HHC executed primary work; repeated plugin HTTP 502/stalls required RDC terminal fallback to finish verification.
Pre-existing AGENTS.md and .ai/state.json edits are excluded from this UI commit.

## Release gates

Review this local UI commit before separately authorized deployment. After release, verify signed-in internal/client/partner flows with real sessions. Live Supabase migration/RLS/grants checks remain gated on authorized AllBee project access; the ordinary finance RPC migration remains unapplied.

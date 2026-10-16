# AllBee Admin/APN/Client crash repair — 16 October 2026

## Scope
Investigated reports of crashes and unusable AI and other pages across Admin, APN, and Client. Reviewed the current production commit `ff2fc5d` and audited the existing Vite/React code. The fixes in this patch are frontend/local only: no production database migration, credential change, finance mutation, customer record changes, or automatic deployment.

## Causes and fixes
1. **UI render exception propagation:** Admin/staff routes previously evaluated `renderPage()` before a page-specific error boundary, meaning a render exception could bubble to the root and replace the entire workspace with a fatal screen. The new `PageErrorBoundary` and `SafePageRenderer` keep navigation alive, offer Retry/Overview, handle stale chunks, and record bounded best-effort error telemetry. The APN page renderer now executes its `section()` inside its existing boundary.
2. **Client portal route isolation:** Chat, AI, Support, Overview and Profile are now isolated by per-route recovery boundaries. Portal collection inputs are normalized when a database response has a missing/malformed collection.
3. **AI data-shape crashes:** AI Intelligence Center dashboard/scores/forecast/search/error-group collections and the AI Memory, CRM Delivery, Executive V5 and Automation submodules now validate unexpected response shapes before rendering list views. Invalid stored AI section names reset to Overview.
4. **Loading and async race failures:** Pricing & Knowledge Center rejects responses received after unmount or after a newer query; its catalog results are normalized to a stable object/list structure. AI Intelligence Center similarly prevents stale/unmounted async refreshes from mutating the page. The Intelligence Center now displays an actionable Retry state instead of indefinite skeletons when its initial fetch fails.

## Evidence
- Full mocked route/viewport sweep: **504/504 PASS**, no reported JS errors, rendering crashes, clipped content or horizontal overflow (`.ai/crash-audit-20261016/routes-final.log`).
- Deep browser interactions (Admin AI Center, Admin Assistant, APN AI, Client AI, malformed responses at 320/390/768/1440 px): **18/18 PASS** (`.ai/crash-audit-20261016/deep-browser-final.log`).
- Unit regression suite: **73 files / 368 tests PASS** (`.ai/crash-audit-20261016/final-unit.log`), including new page recovery, stale request, malformed AI and client data tests.
- Edge function auth checks: PASS; RPC surface: 167 functions referenced, 12 protected internal helpers, 0 reported violations.
- Bundle limits: main 506.5/525 KiB, total JS 2507.5/2560 KiB — PASS.
- Full APN UX suite: **492/492 PASS**, including mobile/dark/error-state coverage (`.ai/crash-audit-20261016/apn-ux-final.log`).
- Chat interaction regression: **18/18 PASS** (`.ai/crash-audit-20261016/chat-final.log`).
- Controlled tests use mocked/isolated role fixtures, not authenticated production accounts.

## Not yet verified / owner gates
- Authentic Admin, APN, Client, and other live sessions with current production database rows. A mocked test passing does not prove that every live page is fixed.
- Live Supabase migrations, live RLS grants, real AI provider responses and production messaging side-effects cannot be certified from the available access. No permission to alter those systems is inferred.
- New production deploy is **not automatic** because `.ai/HAO_POLICY.json` has `allow_auto_deploy=false`. Commit and push verified code; release requires owner authorization.

## Future follow-ups
Once released, verify the live build ID and perform signed-in cross-role navigation, AI load/send/error/retry, chat delivery, page transition and error-report health checks. Any live issue should be reproduced from a route + timestamp + safe telemetry fingerprint, without printing private customer data.

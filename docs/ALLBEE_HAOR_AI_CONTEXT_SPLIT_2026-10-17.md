# AllBee HAOR — AI context code splitting (17 October 2026)

## Goal and boundary
Continue owner-independent performance work following commit `365826d`. Reduce initial JavaScript download without changing data access rules, AI provider settings, UI routes, finance operations, or database records. `.ai/HAO_POLICY.json` has `allow_auto_deploy:false`; no Vercel production deployment is authorized as part of this work.

## Implementation
- Extracted `buildAIContext` from the always-loaded `src/AllbeeApp.jsx` into `src/ai/workspaceContext.js`.
- Both lazy-loaded `AllbeeAI` and `EnterpriseCRM` now own snapshot formatting; Admin AI, Client AI and CRM route runtimes forward the existing task assignment-label function without pulling the formatter back into the entry bundle.
- Imported the original money formatting and phone/email scrubbers rather than duplicating them. The formatter still masks contacts, caps the snapshot at 12,000 characters, and excludes malformed DB collections/nested arrays that could otherwise throw at render time.
- Updated the permanent AI safety test to check that contact masking is present in the extracted source and referenced from the assistant rather than insisting it remain in the large app file.
- Added three isolated module tests for contact masking and task assignment, malformed payloads, and snapshot size.

## Verified evidence
- Targeted AI/Client/static-integrity tests: 15/15 PASS before full suite.
- Full certification: **76 files / 384 tests PASS**, edge-auth PASS, Vite production build PASS, JS bundle limits PASS.
- Main entry bundle: **508.3 KiB before → 503.1 KiB after** (5.2 KiB or approximately 1.0% smaller).
- Total JS: **2511.7 KiB / 2560 KiB budget**; the new lazily loaded formatter is not removed from the entire app, only the initial route.
- 504/504 route/viewport checks PASS with zero reported page errors or layout crashes.
- 18/18 deeper AI browser checks PASS, including role-specific AI routes and malformed responses.
- 18/18 Admin/Client/APN chat browser checks PASS.
- Local evidence: `.ai/haor-20261017-realtime/context-release/{certify-final,routes,deep-ai,chat}.log` and `src/ai/workspaceContext.test.js`.

## Remaining
- No authenticated production session testing has been performed on this source revision. Live Supabase permissions, cross-device realtime, and provider latency need authorized sessions.
- Main bundle is still comparatively large; future route-level extraction should be separately measured and certified.
- `allow_auto_deploy:false`; GitHub changes alone do not mean this improvement is live.
- Unrelated user changes under `.ai/` and `AGENTS.md` remain preserved.

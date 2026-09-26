# Work Queue

- [x] AB-001 Explicit route datasets for all navigation routes; local tests/build passed (`83104b3`).
- [x] AB-005 Ordinary finance save waits for persistence and refreshes affected rows after failure (`83104b3`); failure/retry UI regressions added this session. Cross-table atomicity remains the RPC design gate.
- [x] Partner home scoped hydration and route cancellation regression (`6bde213`).
- [x] APN partner/admin tab-specific data scopes, navigation, refresh and mocked realtime checks; generic 80-table APN route removed from active use.
- [x] Mocked-role local responsive sweep at eight widths, zero document overflow/page errors.
- [x] Local bundle/request profile and measured first-load improvement; see `APN_SCOPE_PROFILE.md`.
- [x] AB-008 Project guidance and handoff refreshed; release checklist prepared.
- [ ] AB-002 Live Supabase migration/RLS/grant verification (AllBee access blocker).
- [ ] AB-003 Custom-domain ownership identification; divergent bundle resolved after GitHub push (current live bundle matches local build).
- [ ] AB-006 Real signed-in role/mobile verification (authorized sessions needed; local mocks completed).
- [ ] AB-004/007 Real APN network/egress profile and live realtime validation (authorized sessions needed; local scope profile completed).
- [x] Prepare and test ordinary finance transactional RPC in disposable PostgreSQL 17 (rollback, retry, concurrent same-key, grants); migration is local and not applied live.
- [x] Extend mocked role data scopes, client navigation and APN lazy-tab deep-link tests; 224 tests pass.
- [x] Reduce main chunk to 480.93 kB and coalesce simultaneous same-scope reads, with measured build and request tests.
- [x] Read-only custom domain trace: registered under current team but absent from all 19 accessible project-domain lists; owning project still unknown.
- [ ] Apply and certify transactional finance RPC after authorized AllBee DB access and live schema review, then switch ordinary save client path atomically.

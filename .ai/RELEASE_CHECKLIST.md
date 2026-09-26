# AllBee release record and remaining verification

## Local code gates
- [x] Review local commits `83104b3` (explicit route scope and ordinary finance persistence feedback) and `6bde213` (partner home hydration race). Both build/test clean; neither was pushed in this session.
- [x] APN partner/admin tab-specific datasets, scoped navigation, manual refresh and mocked realtime regression tests.
- [x] Ordinary income/expense failure feedback, partial multi-table save/rebase and retry regressions; transactional follow-up specified in `FINANCE_RPC_DESIGN.md`.
- [x] Mocked-role responsive sweep: admin, staff, client and partner at eight widths; no document overflow/page errors.
- [x] Full local test suite 217/217, Vite build, `git diff --check`.

## External release gates
- [ ] Confirm AllBee Supabase project management access and inspect migration order, live grants/RLS, RPC definitions and financial constraints. CLI currently returns 403; connector lists unrelated projects.
- [ ] Apply/test the proposed ordinary cross-table finance RPC only after local disposable-DB tests and management review. Current client multi-table path can partially persist despite retry/reload feedback.
- [ ] Obtain authorized role test sessions and verify real admin, employee, accountant, client and partner flows, mobile interactions, APN realtime and measured production egress. Local mocks do not certify this.
- [x] Custom domain now serves the verified local build byte for byte after the GitHub push. Its owning Vercel project is still not visible in the current project listing; inspect ownership before changing domain mappings.
- [x] User explicitly authorized deployment. Four commits through `844b23f` pushed to `origin/main`; Vercel deployment `dpl_Fe9WwC3i3vfUnfe2tZJE1LE4jiVz` is Ready at `allbeeapp-six.vercel.app`. Both that alias and `app.allbeesolutions.com` return HTTP 200 and show sign-in at 320/390/768/1440 px without overflow or page errors.
- [ ] Verify authenticated production roles, DB behavior and rollback path before declaring the application fully production-certified.

## Local six-task continuation (not deployed)
- [x] Disposable PostgreSQL 17 RPC migration replay, rollback, role/grant, idempotency and concurrent same-key verification.
- [x] Mocked client/partner/internal role data scopes, client support navigation and partner lazy-tab direct link; 224/224 tests.
- [x] Main JS reduced to 480.93 kB / 138.40 kB gzip; keyed in-flight reads tested for A/B/A bursts and failed request retries.
- [x] Custom domain read-only trace across 19 accessible projects; owning assignment remains unidentified.
- [ ] Review/apply RPC migration on authorized AllBee Supabase, verify live permission/triggers, then wire ordinary finance save and test production rollback/retry.
- [ ] Deploy this new code package only with fresh release authorization under HAO policy.

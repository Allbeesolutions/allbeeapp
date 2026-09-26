# AllBee release checklist — prepared, not approved for release

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
- [ ] Resolve ownership of `app.allbeesolutions.com`; it serves a different bundle from accessible `allbeeapp-six.vercel.app` and is not assigned to that Vercel project.
- [ ] Decide release target and approve push/deployment under `HAO_POLICY.json` (`allow_auto_deploy=false`); then verify commit, deployment, custom domain, auth and rollback path. No push/deploy performed in this session.

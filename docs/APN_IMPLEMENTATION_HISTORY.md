# ALLBEE APN — Implementation History (WP1–WP10)

Production-verified work-package history for the APN commission engine. Commit hashes are
taken from the repository history (`git log` on `main`) — nothing is invented. Final release:
**`435b00c`** — **APN READINESS = GREEN**.

Canonical deploy order (applied in the Supabase SQL editor, idempotent files):
`schema.sql` → `apn-commission-engine-v4.sql` → `apn-referral-engine-pr2.sql` →
`apn-withdrawal-settlement-engine-pr3.sql` → WP1 (foundation) → WP2 → WP3 → WP4 → WP5 → WP6 →
WP7 → WP8 → WP9 → WP10.

---

## WP1 — Rule Engine Foundation

- **File:** `supabase/pr-apn-rule-engine-foundation.sql`
- **Commit:** `1665fe9` — "feat(apn): rule engine foundation (rules, hierarchy, ledger, reversals, freeze)"
- **Objective:** build the rails of the production rule engine without changing any working
  behavior: emergency freeze, versioned rules, hierarchy, immutable idempotency-keyed ledger,
  additive reversals, finance-expense map, migration framework, rule audit.
- **Major changes:** `apn_system_controls` + `apn_guard_operational` (FZ001);
  `apn_rule_sets`/`apn_commission_rules` + `apn_rule_set_publish` + `apn_resolve_commission_rate`
  (legacy fallback 10/15/20 + 1%); `apn_hierarchy_assignments` + role-validating guard;
  `apn_commission_ledger` (append-only, unique idempotency_key); `apn_reversals`;
  `apn_finance_expense_map` + `apn_ensure_finance_expense`; `apn_migrations` +
  `apn_migration_mark`; `apn_rule_audit`; select-only RLS everywhere; no DML on existing data.
- **Production verification:** `pr-apn-rule-engine-foundation-verify.sql` (T1-T9: freeze gates
  ledger/reversal/publish/hierarchy, rule resolution, ledger idempotency).
- **Bugs found / fixes:** Supabase default-grants drift — re-asserted in
  `migrations/20260813145000_pr_apn_rule_engine_foundation_grants_fix.sql` (body identical to
  the foundation file's revoke/grant statements).
- **Final status:** ✅ live (foundation of everything that followed).

## WP2 — Referral Pipeline (Option 1)

- **File:** `supabase/pr-apn-rule-engine-wp2.sql`
- **Commit:** `f18f23a` — "feat(apn): rule engine WP2 referral pipeline (self-earnings, wallet impact)"
- **Objective:** referral earnings from the engine's collection data — "the partner is their
  own referrer" earning a flat referral % per collection; no chains, no multi-level split.
- **Major changes:** `apn_engine_record_partner_earning` (audited, freeze-guarded,
  linked-partner skip, default_percent fallback, `relationship_id=NULL` on self-earnings,
  idempotent insert); leaderboard fixed to exclude self-earnings from the "referred" count;
  wallet impact via existing triggers (no direct wallet writes).
- **Production verification:** `pr-apn-rule-engine-wp2-verify.sql` (self-earning, wallet,
  idempotency, linked-partner skip, missing-collection rejection).
- **Final status:** ✅ live.

## WP3 — Authoritative Wallet and Ledger

- **File:** `supabase/pr-apn-rule-engine-wp3.sql`
- **Commit:** `117a706` — "feat(apn): rule engine WP3 authoritative wallet and ledger"
- **Objective:** wire the WP1-designed ledger to the working sources and add the authoritative
  derived wallet — without redesigning the existing derived withdrawal/referral wallets.
- **Major changes:** ledger extended (`adjustment`/`reversal`/`recovery` types, `eligible_from`,
  `original_event_id`); triggers `apn_ledger_collection_trg`/`apn_ledger_referral_trg`
  (partner/district/state/referral events, keys `col:<id>:*` / `earn:<id>`);
  `apn_commission_eligibility_date` (5th of the following month); `apn_consolidated_wallets`
  (derived-only, refresh function, guard trigger, select-only RLS);
  `apn_commission_reverse_project`/`apn_commission_cancel_project` (additive reversal,
  recovery vs paid pool, collection `Reversed`, project `Cancelled`, earnings `void`);
  `apn_mark_withdrawal_failed`; withdrawal requests extended with `failed` status.
- **Production verification:** `pr-apn-rule-engine-wp3-verify.sql` (ledger events, eligibility
  buckets, reversal + recovery, wallets, failed-payment release).
- **Bugs found / fixes:** ledger 35% total-cap check was nested inside the secondary branch
  (an over-permissive cap) — fixed in
  `migrations/20260813146000_pr_apn_rule_engine_ledger_cap_fix.sql` (current bodies have the
  total check outside the secondary branch, foundation:536-540 / wp9:119-125); reversal marker
  fix in `migrations/20260813147000_*.sql`.
- **Final status:** ✅ live.

## WP4 — Partner Lifecycle & Admin Hub

- **File:** `supabase/pr-apn-partner-lifecycle-wp4.sql`
- **Commit:** `d8b6e48` — "feat(apn): WP4 partner lifecycle and admin hub (zones, bans, governed targets, tie-ups)"
- **Objective:** partner status lifecycle, zone requests, admin hub (consoles/notes), governed
  targets (client-level / prescription / loyalty).
- **Major changes:** `apn_users_guard` redefinition (superadmin bypass; self-registration
  forced pending/partner with financial fields stripped; admin lifecycle; `banned` =
  superadmin-only); `apn_profile_name_sync_trg`; district-head write scope via
  `apn_users_head_update` + `apn_is_district_head_of`; `apn_zone_requests` RPCs (send/approve/
  reject) with hub-note + notifications; `apn_admin_consoles`/`apn_admin_notes`;
  normalized target/loyalty tables + RPCs.
- **Production verification:** `pr-apn-partner-lifecycle-wp4-verify.sql` (guards, banned
  superadmin-only, zone flow).
- **Bugs found / fixes:** `04f00ea` — "fix(apn): WP4 verify — PG15 compat fixes and close-out note".
- **Final status:** ✅ live.

## WP5 — ALLBEE AI + Support Tickets

- **File:** `supabase/pr-apn-ai-support-wp5.sql`
- **Commit:** `31f110d` — "feat(apn): WP5 ALLBEE AI and support tickets (scoped chat, audited ticket lifecycle)"
- **Objective:** server-side, APN-scoped AI plus an audited partner support-ticket system.
- **Major changes:** `apn_ai_partner_scope` (identity from `auth.uid()` only, no target-user
  parameter); `apn_ai_build_context` (own-data-only financial context); `apn_ai_usage_tick`
  (60/hr cap, RL001); `apn_support_tickets` + create/list/respond/status RPCs
  (idempotent `client_key`, role-segregated responses, superadmin-only resolve/close,
  mutation-guard trigger, rule-audit trail); `apn-ai` edge function (double JWT verification,
  strict uncertainty block). Deployment note: `17337c5` — "docs: note apn-ai edge function is
  deployed (verified on project)".
- **Production verification:** `pr-apn-ai-support-wp5-verify.sql`.
- **Final status:** ✅ live.

## WP6 — Commission Integrity (Legacy Surface)

- **File:** `supabase/pr-apn-commission-integrity-wp6.sql`
- **Commit:** `e952e0c` — "feat(apn): WP6 commission integrity — legacy reversal + district de-dupe"
- **Objective:** close `engine.district-client` and `engine.finance-reversal`; fix withdrawal
  wallet buckets.
- **Major changes:** removed the client-side `kind='district'` double-count (engine pays heads
  server-side); `apn_commission_reverse_legacy` (audited, role-gated, superadmin unlock for
  paid, double-reversal refusal, immediate wallet refresh); `apn_withdrawal_source_totals`
  redefined to exclude `Reversed` from lifetime/monthly/today in both v4 and legacy branches.
- **Production verification:** `pr-apn-commission-integrity-wp6-verify.sql` (T9: reversed rows
  drop out of every bucket).
- **Final status:** ✅ live; markers `engine.district-client` + `engine.finance-reversal`
  completed (`resolved_by 'wp6'`).

## WP7 — Portal Financial Snapshot (Read-Only Convergence)

- **File:** `supabase/pr-apn-app-ui-wp7.sql`
- **Commit:** `675b08b` — "feat(apn): WP7 portal wallet shows authoritative engine snapshot"
- **Objective:** make the partner portal display agree with ALLBEE AI — display-only
  convergence, no writes.
- **Major changes:** `apn_partner_financial_snapshot()` — one IDOR-proof read RPC scoped via
  `auth.uid()` returning the exact shapes of `apn_ai_build_context` (freeze, ruleKnowledge,
  wallet, ledger, reversals, withdrawalWallets, withdrawalRequests, nextEligibleDate);
  portal reads it on mount/tab-switch (`src/AllbeeApp.jsx:498-502, 10933-10943`) with graceful
  degradation.
- **Production verification:** `pr-apn-app-ui-wp7-verify.sql`.
- **Final status:** ✅ live. (Marker `engine.app-ui` left open — convergence is frontend +
  snapshot RPC.)

## WP8 — Legacy Commission Convergence

- **File:** `supabase/pr-apn-legacy-backfill-wp8.sql`
- **Commit:** `30091b5` — "feat(apn): complete legacy commission convergence"
- **Objective:** close `engine.legacy-commissions` — backfill `apn_commissions` into the ledger.
- **Major changes:** `apn_backfill_legacy_commissions(dry_run=true)` — deterministic
  `legacy:<id>` keys, `source_type='adjustment'`, `commission_type='partner'`, clamped rate,
  eligible_from from payoutDate for pending rows, skips district/Reversed, defers (never
  aborts) with per-row audit, blob stamped `migratedLedgerId`, wallet refresh per partner.
- **Production verification:** `pr-apn-legacy-backfill-wp8-verify.sql`. Discovery proved the
  production legacy dataset is **empty** (0 rows, 2026-08-14) — the migration ran as a
  provable no-op and ships the mechanism.
- **Final status:** ✅ live; marker `engine.legacy-commissions` completed (`resolved_by 'wp8'`).

## WP9 — Ledger Wiring Integrity (Owner Path)

- **File:** `supabase/pr-apn-rule-engine-wp9.sql`
- **Commit:** `4b4be6f` — "feat(apn): converge ledger trigger ownership paths"
- **Objective:** fix the discovered divergence where the ledger linkage silently deferred
  events written by non-admin users (e.g. partner-recorded revenue), splitting the ledger
  truth from the claims-center wallet.
- **Major changes:** `apn_ledger_entry` split into the gated wrapper +
  `apn_ledger_entry_owner` (guard first, caps, idempotency, insert, audit — all preserved);
  `apn_ledger_record_owner` deferral wrapper for the trigger path (audits `ledger record
  deferred` with SQLERRM); `apn_ledger_collection_after_change` / `apn_ledger_referral_after_change`
  redefined to record through the owner path (keys `col:<id>:partner|district|state`,
  `earn:<id>`); explicit decision NOT to mirror CRM lead heads into the hierarchy and NOT to
  auto-post finance expenses; markers `engine.referral-trigger` and `engine.withdrawal-wallets`
  completed.
- **Production verification:** `pr-apn-rule-engine-wp9-verify.sql` (owner path FZ001, caps,
  deferrals, restoration).
- **Bugs found / fixes:** the WP9 discovery itself (trigger path gated on the writing user's
  identity) — fixed by routing triggers through the owner path.
- **Final status:** ✅ live.

## WP10 — CRM ↔ APN Assignment Governance

- **File:** `supabase/pr-apn-crm-assignments-wp10.sql`
- **Commit:** `435b00c` — "feat(apn): WP10 APN-CRM assignment governance — conversion snapshot, partner reassignment locks, freeze-aware revenue chain, verify suite green (T1-T12)" (current HEAD).
- **Objective:** close the proven governance gap — `upsert_apn_commission_project` silently
  overwrote `partnerId` on existing projects (an ungoverned future-entitlement redirect).
- **Major changes:** partner-change guard on `upsert_apn_commission_project` (revenue →
  `check_violation`; pre-revenue → audited reassignment; race-safe upsert backstop);
  marker `engine.crm-assignments` completed with WP10 rationale. Explicitly NOT changed:
  assignment gates, referral/hierarchy, ledger immutability, reversals, freeze, finance
  locks, RLS, grants, AI isolation.
- **Production verification:** `pr-apn-crm-assignments-wp10-verify.sql` (T1-T12: access
  surface, non-admin isolation, conversion snapshot, revenue chain, historical immutability,
  reassignment governance, freeze-aware chain with FZ001 deferral, race protection, marker,
  zero residue).
- **Bugs found / fixes:** verify T9 initially failed because `now()` is the transaction-start
  timestamp — `order by created_at desc limit 1` tied across same-transaction inserts and
  resolved to an earlier collection. Fixed by capturing the collection id from the RPC return
  value (`->> 'id'`). Freeze mechanics were proven correct (deferral + audit, no mint).
- **Final status:** ✅ live — **APN READINESS = GREEN**.

---

## Summary table

| WP | Commit | Objective | Status |
|---|---|---|---|
| WP1 Foundation | `1665fe9` | rules, hierarchy, ledger, reversals, freeze, audit | ✅ |
| WP2 Referral | `f18f23a` | self-earning referral pipeline | ✅ |
| WP3 Wallet+Ledger | `117a706` | authoritative ledger + consolidated wallet, reversals | ✅ |
| WP4 Lifecycle | `d8b6e48` | partner lifecycle, zones, admin hub | ✅ |
| WP5 AI+Tickets | `31f110d` | scoped AI + support tickets | ✅ |
| WP6 Integrity | `e952e0c` | legacy reversal, district de-dupe, reversed buckets | ✅ |
| WP7 Portal | `675b08b` | authoritative portal snapshot RPC | ✅ |
| WP8 Backfill | `30091b5` | legacy commission convergence (no-op on empty prod) | ✅ |
| WP9 Wiring | `4b4be6f` | owner-path ledger wiring, deferral integrity | ✅ |
| WP10 Governance | `435b00c` | CRM↔APN reassignment locks + freeze-aware chain | ✅ |

Supporting fixes in history: `04f00ea` (WP4 verify PG15 compat), `17337c5` (apn-ai deploy
note), `42c2feb` (phase-2 security hardening: definer search_path, crm_record_revenue authz,
finance locks), `241cca7` (APN finance reconcile), `68f0aa3` (unify APN income creation/editing).

## Open markers (by design, not defects)

- `engine.settings-rule` — open: legacy `apn_referral_settings` remains the default-percent
  source.
- `engine.rate-function` — open: legacy `apn_commission_rate_for_project` stays as the
  resolver fallback.
- `engine.app-ui` — open: portal convergence is frontend + snapshot RPC (WP7), no further SQL
  closure needed.

## Closed markers

`engine.referral-trigger` (wp9), `engine.district-client` (wp6), `engine.finance-reversal`
(wp6), `engine.legacy-commissions` (wp8), `engine.withdrawal-wallets` (wp9),
`engine.crm-assignments` (wp10).

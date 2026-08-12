# ALLBEE — APN Rule Engine & Partner Platform (Foundation)

Phase 0 inspection + implementation architecture. This document maps the existing
APN surface to the target design, defines the foundation (this work package), and
lists every integration point that is flagged `MIGRATION_REVIEW_REQUIRED` instead
of being silently rewritten.

## 1. Existing surface (Phase 0 findings)

| Area | Where it lives today | Notes |
|---|---|---|
| Partner commission ladder (10/15/20) | `apn_commission_rate_for_project(text, integer)` in `pr-ux-3-production.sql` | Hardcoded: project #1 → 10%, #2–9 → 15%, #10+ → 20%. Counts completed projects in `apn_commission_projects` + `apn_commissions` (`kind <> 'district'`). Rate is **snapshot per project** at creation (`commissionRate` on the project row) — good, but the ladder itself is not versioned data. |
| District head 1% | Client-side only — `AllbeeApp.jsx` writes `apn_commissions` rows with `kind: 'district'`, `rate: 1`, `amount = revenue * 0.01` | No DB enforcement, no caps, no versioning, no ledger, no state head, no finance expense. |
| Referral (one-level) | `apn-referral-engine-pr2.sql`: `apn_referral_settings` (default_percent 1), `apn_referral_codes`, `apn_referral_relationships` (one-level, `referred_id` unique, `linked_at`), `apn_referral_earnings` (unique per `source_collection_id`, status lifecycle, per-row snapshot), `apn_referral_snapshots`, wallets, timeline, analytics | **Already effective-dated**: `apn_referral_collection_after_insert` matches relationships with `linked_at <= collection_time`, so a link created after a collection is not retroactive. `source_collection_id` unique = built-in idempotency. |
| Withdrawal engine | `apn-withdrawal-settlement-engine-pr3.sql`: `apn_withdrawal_wallets` per (partner, wallet_type ∈ commission/referral/incentive), requests, batches, settlements, finance transactions, audit, status history, bank accounts, `apn_wallet_transactions` ledger (`balance_effect`) | Settlements on the 5th (next Sunday rule). Working system — do not rewrite. |
| Finance recognition | `pr-finance-apn-edit-convert.sql` (`create_apn_income_transaction` 4-arg, hardened) + `pr-finance-apn-commission-reconcile.sql` | Commission expense rows are already **deterministic**: `apn-expense:<txn_id>` on `transactions` with `apnCommissionExpense=true`. This is the deterministic-ID convention the ledger reuses. |
| Hierarchy seed | `profiles.role` allows `partner/district_head/state_head`; `crm_leads` carries `assigned_partner_id/assigned_district_head_id/assigned_state_head_id`; `apn_users.data->>'district'/'state'` | No normalized, effective-dated partner→district→state assignment table exists. |
| Security conventions | `schema.sql` helpers (`is_admin`, `is_superadmin`, `can_finance`, `can_module`), `audit` (immutable JSON), `fin_locks` + `fin_lock_guard`, RLS everywhere | New code must follow the hardened pattern: SECURITY DEFINER, `set search_path = pg_catalog, public, pg_temp`, explicit revoke/grant, no dynamic SQL in definers. |
| Global audit pattern | `apn_withdrawal_audit_event`, `apn_referral_audit` write both module audit + global `audit` | Foundation follows the same pattern. |

## 2. Target design (12 foundation items)

### 2.1 Rule sets + versioning — NEW
- `apn_rule_sets(id uuid pk, code text unique, name, effective_from, effective_to, status, created_by, created_at, reason, superseded_by)`.
- `apn_commission_rules(id uuid pk, rule_set_id fk, commission_type, tier_min, tier_max, percent, max_percent, cap_class, priority, active)`.
- Active set = latest `effective_from <= p_at` with `status='active'` and no later supersession. Rules never mutated after activation (immutable by RLS + definer-only writes via `apn_rule_set_publish`).
- Seed (idempotent, on conflict do nothing): `v1` active — partner 10/15/20 tiers, referral 1% (max 5), district 1% (max 5), state 1% (max 5), secondary cap 15%, total cap 35%.
- `apn_resolve_commission_rate(p_partner_id, p_project_number, p_commission_type, p_at)` — stable definer resolver. Consults rules first; **falls back to legacy behavior** when no rule set is active (partner → `apn_commission_rate_for_project`, referral/district/state → 1). This guarantees zero behavior change until a rule set is published.

### 2.2 Commission types — NEW (enum-like)
`commission_type ∈ ('partner','district','state','referral')`, used identically in rules, ledger, and finance mapping.

### 2.3 Hierarchy model — NEW
- `apn_hierarchy_assignments(partner_id pk fk apn_users, district_head_id, state_head_id, effective_from, assigned_by, assigned_at, status)` with `apn_hierarchy_guard` (head roles must be `district_head`/`state_head` in `apn_users`, no self-assignment, partner not a head).
- `apn_hierarchy_resolve(p_partner_id)` returns effective assignment at `now()`, mapping 1:1 to the `crm_leads` assignment fields (documented mapping, `apn_migrations` row `crm-assignments`).

### 2.4 Referral effective dating — EXISTS, kept as-is
`linked_at <= collection_time` already prevents retroactivity. No schema change; cap 5% enforced at engine level (see 2.10). `apn_migrations` row `referral-effective` = completed (audited finding).

### 2.5 Immutable commission ledger — NEW
- `apn_commission_ledger(id uuid pk, idempotency_key text unique, source_id, source_type ∈ ('revenue_collection','project_event','referral','hierarchy','reversal','adjustment'), partner_id fk apn_users, commission_type, base_amount, percent, amount, event_at, snapshot, created_at, created_by, reversed_by)`.
- Writes ONLY through `apn_ledger_entry(...)` (SECURITY DEFINER, hardened): deterministic `idempotency_key` (`coll:<id>`, `proj:<id>:<event>`, `rev:<ledger_id>` …), `on conflict` returns the existing row — replay-safe.
- Immutable at the DB level: RLS `for all` denied to every role except nothing — the definer bypasses RLS; direct `insert/update/delete` on the table is revoked from `authenticated`/`anon`/`public` and no policy grants it.

### 2.6 Idempotency keys / deterministic IDs — NEW
`idempotency_key unique` on ledger + reversals; `apn_finance_expense_map(ledger_id unique, deterministic_id text unique, finance_transaction_id, status)` with deterministic ids following the live convention: `apn-expense:<txn>` (existing) and `apn-expense-rev:<original_ledger_id>` (new). `apn_ensure_finance_expense(p_ledger_id)` posts/returns the matching `transactions` row (kind=expense, `apnCommissionExpense=true`, `apnLedgerId`) exactly once.

### 2.7 Reversal model — NEW (additive)
- `apn_reversals(id uuid pk, original_ledger_id uuid unique fk apn_commission_ledger, reversal_ledger_id uuid, amount, reason, initiated_by, status ∈ ('pending','applied','rejected'), created_at, applied_at)`.
- `apn_create_reversal(p_original_ledger_id, p_reason)` — hardened definer: original must exist, must not already be reversed, must not be a reversal itself, must not have reached a paid/withdrawable withdrawal (checked against `apn_wallet_transactions`/withdrawal finance rows). Reversal is **additive**: original row untouched; a negative `amount` ledger entry (`source_type='reversal'`, `reversed_by=original`) is created; finance expense posted deterministically via the map.

### 2.8 Migration mapping framework — NEW
- `apn_migrations(id text pk, phase, mapping_key, description, status ∈ ('pending','review_required','completed'), created_at, resolved_at, resolved_by, notes)`.
- Seed rows flag every existing surface that must converge onto the engine — never silently rewritten:
  `referral-trigger` (wire `apn_referral_collection_after_insert` → ledger + finance), `district-client` (replace client-side 1% rows with engine entries), `settings-rule` (`apn_referral_settings` → rule set), `rate-function` (`apn_commission_rate_for_project` → resolver), `legacy-apn_commissions` (kind=district legacy rows → ledger), `withdrawal-wallets` (wallet recompute from ledger), `app-ui` (partner portal reads rules/ledger), `finance-expense-reversal` (reversal expense posting when reversal UI ships), `crm-assignments` (crm_leads fields ↔ hierarchy assignments).

### 2.9 Emergency freeze — NEW
- `apn_system_controls(id=1 only, frozen boolean, frozen_at, frozen_by, reason, rule_engine_enabled)` + `apn_guard_operational()` raising `frozen_operations` when frozen.
- Every engine write path (`apn_ledger_entry`, `apn_create_reversal`, `apn_hierarchy_assign`, `apn_rule_set_publish`) calls it. Freeze/unfreeze gated to `is_superadmin()` by a trigger guard.

### 2.10 Caps enforcement — NEW
`apn_validate_caps(...)` inside `apn_ledger_entry` for secondary types: percent ≤ rule `max_percent` (5/5/5), secondary sum on the same base event ≤ 15% of base, total (incl. partner) ≤ 35%.

### 2.11 Audit integration — NEW (same pattern as existing)
`apn_rule_audit(action, entity, entity_id, actor_id, metadata)` + helper writing global `audit` too. Every engine mutation logs.

### 2.12 RLS / SECURITY DEFINER gates — NEW (applied to every object above)
Hardened search_path, explicit role gates (`is_admin`/`can_finance`/`can_module('apn')`), revoke-from-`public`/`anon` then grant only `authenticated` where read is legitimate. Rule/ledger reads: admins full; partners only own rows.

## 3. Behaviour compatibility rules
1. Zero DML on existing data; every DDL idempotent (`create table if not exists`, `add column if not exists`, drop-then-create policies).
2. All new functions fail closed: without an active rule set they resolve to today's behavior.
3. Working engines (referral trigger, withdrawal settlement, finance income) are untouched; convergence is tracked in `apn_migrations`, not performed silently.
4. No UI changes in this work package.

## 4. Deliverables
- `supabase/pr-apn-rule-engine-foundation.sql` + identical `supabase/migrations/<ts>_pr_apn_rule_engine_foundation.sql` (SQL-Editor / `supabase db push`).
- `supabase/pr-apn-rule-engine-foundation-verify.sql` + migration copy — savepoint/rollback verification, zero residue.
- Verification: `npm run build` (no app change), `git diff --check`, then live `supabase db push` + verification query.

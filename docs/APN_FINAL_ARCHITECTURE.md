# ALLBEE APN — Final Production Architecture (WP1–WP10)

Status: **APN READINESS = GREEN** — verified on production through WP10 (release `435b00c`).

This document describes the deployed APN (AllBee Partner Network) commission engine as it
actually exists at release `435b00c`. For every concept it names the **authoritative system**
(table/function/trigger) and the read/write surfaces. It is a documentation artifact only:
no production code was changed to produce it.

Canonical deploy order (from `supabase/pr-apn-rule-engine-wp3.sql:54-57` and file headers):

```
schema.sql                              (base app: profiles, roles, RLS helpers)
apn-commission-engine-v4.sql            (legacy APN commission projects/collections)
apn-referral-engine-pr2.sql             (referral engine: codes, relationships, earnings, wallets)
apn-withdrawal-settlement-engine-pr3.sql (withdrawal engine: requests, settlements, wallets)
pr-apn-rule-engine-foundation.sql       (WP1  — rule engine foundation)
pr-apn-rule-engine-wp2.sql              (WP2  — referral pipeline, option 1)
pr-apn-rule-engine-wp3.sql              (WP3  — authoritative ledger + consolidated wallet)
pr-apn-partner-lifecycle-wp4.sql        (WP4  — partner lifecycle & admin hub)
pr-apn-ai-support-wp5.sql               (WP5  — ALLBEE AI + support tickets)
pr-apn-commission-integrity-wp6.sql     (WP6  — legacy reversal + district de-dupe)
pr-apn-app-ui-wp7.sql                   (WP7  — portal financial snapshot RPC)
pr-apn-legacy-backfill-wp8.sql          (WP8  — legacy commission convergence)
pr-apn-rule-engine-wp9.sql              (WP9  — ledger wiring integrity / owner path)
pr-apn-crm-assignments-wp10.sql         (WP10 — CRM↔APN assignment governance)
```

Later files supersede earlier definitions of the same objects. The canonical definition of every
live function/trigger/policy is the **last** definition in this order. Where a file contains a
superseded definition, this document points at the canonical one.

---

## A. Partner lifecycle

- **Authoritative:** `apn_users` (`id text pk, data jsonb, updated_at`) — created in
  `supabase/apn-partner-management.sql:40-49`; lifecycle rules in
  `supabase/pr-apn-partner-lifecycle-wp4.sql`.
- **Identity** lives in the blob: `id, apnId, name, username, email, mobile, gender, dob,
  country, state, district, taluk, city, pincode, address, level, commissionPct, role, status`.
- **Roles** (`role` blob field and `profiles.role`): `partner`, `district_head`, `state_head`
  plus app roles `superadmin`, `admin`, `accountant`, `staff`, `intern`, `client`
  (enforced by `profiles_role_check`, `supabase/schema.sql:65-66`, `apn-partner-management.sql:7-9`).
  Self-registration always forces `role = 'partner'` (wp4:221).
- **Write governance:** `apn_users_guard_trg` (BEFORE INSERT/UPDATE,
  `supabase/pr-apn-partner-lifecycle-wp4.sql:257-259`) → `apn_users_guard()` (wp4:205-256):
  - `is_superadmin()` bypasses everything (wp4:209).
  - Non-admin inserts may only create their own row; status forced `'pending'` unless the
    matching `profiles` row is approved+active; financial/rank fields stripped (wp4:210-225).
  - Admins can run the lifecycle but cannot rewrite identity/rank/financial keys (wp4:226-232).
  - Partners can never mutate identity, rank, financial, or approval/lifecycle keys (wp4:233-239).
  - Status transitions: admin → `pending/active/inactive/rejected`; **`banned` is
    superadmin-only** (wp4:245-254, verified in `pr-apn-partner-lifecycle-wp4-verify.sql:103-106`).
- **Name sync:** `apn_profile_name_sync_trg` on `profiles` → `apn_users` (wp4:302-314).
- **Zones:** rolling month-based zones (`zone1…zone6`) are **computed in the app**
  (`src/AllbeeApp.jsx:9127-9168`); the partner's zone is stored on the blob (`zone`);
  join requests flow through `apn_zone_requests` + RPCs `apn_zone_requests_send/approve/reject`
  (wp4:122-194; approval writes `zone` onto the partner row, wp4:170-172).
- **Tie-ups:** an app-only concept (`tieUp`/`tieUpReciprocal` on `apn_leads`/`apn_quotations`,
  `src/AllbeeApp.jsx:9204-9206, 10024, 10186`) — no SQL table exists for it. **Do not infer
  commission behavior from it.**

## B. APN hierarchy

- **Authoritative:** `apn_hierarchy_assignments`
  (`supabase/pr-apn-rule-engine-foundation.sql:343-353`):
  `partner_id` (PK), `district_head_id`, `state_head_id`, `effective_from`, `assigned_by`,
  `status in ('active','reassigned')`, no self-head checks.
- **Role validation:** `apn_hierarchy_guard_trg` (foundation:415-418) →
  `apn_hierarchy_guard()` (foundation:377-414) enforces that heads hold the right role
  (`district_head`/`state_head`), no head can be a regular partner, no self-heading.
- **Writes:** INSERT/UPDATE via RLS `is_admin()` (foundation:368-375) plus the trigger's
  `is_admin() or can_module('apn')` re-check (foundation:381-383).
- **Relationship to CRM:** hierarchy is per-*partner*, never derived from per-*lead* assignment
  columns. WP9 explicitly decided NOT to mirror `crm_leads.assigned_district_head_id` into it
  (`pr-apn-rule-engine-wp9.sql:28-33`; marker `engine.crm-assignments` was closed by WP10 with
  the non-implementation rationale, wp10:141-147).

## C. State Head

- A `state_head` role partner who appears in `apn_hierarchy_assignments.state_head_id`.
- Paid through the same ledger path as district heads: the revenue-collection trigger records a
  `state` commission event (`col:<collectionId>:state`) only when a state head is assigned
  (`pr-apn-rule-engine-wp9.sql:266-270`).
- RLS read access to a partner's ledger rows is granted to the partner's own district/state
  heads (`apn_commission_ledger_read`, foundation:463-473).

## D. District Head

- A `district_head` role partner in `apn_hierarchy_assignments.district_head_id`.
- Paid **server-side** on every revenue collection via the ledger trigger with idempotency key
  `col:<collectionId>:district` (wp9:253-258). The percent comes from the active rule set via
  `apn_commission_rate_for(text)` (`pr-apn-rule-engine-wp3.sql:95-108`).
- The client-side legacy rows of `kind='district'` were **removed** in WP6 because they
  double-counted heads (`pr-apn-commission-integrity-wp6.sql:9-20`; marker `engine.district-client`).

## E. APN Partner

- The `partner` role in `apn_users`; the money-owning entity of every commission event.
- **Commission authority for a project** = `apn_commission_projects.partner_id` — never the CRM
  columns (WP10 discovery, `pr-apn-crm-assignments-wp10.sql:5-17`).
- Partners are read-only on the financial engine: RLS grants are select-only on
  `apn_commission_ledger`, wallet tables, rule sets, and rules; every write path is a
  role-gated SECURITY DEFINER function (see Security Model).

## F. Referral relationships

- **Authoritative:** `apn_referral_relationships` (`supabase/apn-referral-engine-pr2.sql:27-38`):
  `referrer_id`, `referred_id` (unique), `status in ('active','disabled')`, `apn_referral_no_self`.
- Codes: `apn_referral_codes` (pr2:18-25); auto-generated on partner insert by
  `apn_referral_identity_after_insert` → `apn_referral_ensure_code` (pr2:372-380, 157-184).
- **Earnings model (WP2, definitive):** "Option 1 — the partner is their own referrer".
  `apn_engine_record_partner_earning()` records a self-earning row in
  `apn_referral_earnings` with `relationship_id = NULL` (`pr-apn-rule-engine-wp2.sql:58-138`),
  **skipping partners who already have an active linked referrer** (the "linked partner skip",
  wp2:91-98) to avoid double payout. The PR2 collection trigger
  (`apn_referral_collection_after_insert`, pr2:317-345) still books linked-referrer earnings at
  `apn_referral_settings.default_percent` (default 1), idempotent via
  `on conflict (source_collection_id) do nothing` (pr2:340).
- **Idempotency:** `apn_referral_earnings.source_collection_id` is UNIQUE (pr2:45).

## G. Commission rules

- **Authoritative:** `apn_rule_sets` (foundation:143-155) + `apn_commission_rules`
  (foundation:157-169).
- Rule-set lifecycle: `draft → active → superseded`; effective-dated (`effective_from`/
  `effective_to`); publishing is the SECURITY DEFINER RPC `apn_rule_set_publish()`
  (foundation:265-341), which validates that at least one rule exists and supersedes the
  previous active set.
- Rule fields: `commission_type in ('partner','district','state','referral')`,
  `tier_min/tier_max`, `percent`, `max_percent`, `cap_class in ('primary','secondary')`,
  `priority`, `active`.
- **Legacy fallback:** when no rule set (or no active partner rule) matches, the resolver falls
  back to the pre-engine ladder `10/15/20` via `apn_commission_rate_for_project`
  (`pr-ux-3-production.sql:7-44`); non-partner types fall back to 1%
  (`apn_resolve_commission_rate`, foundation:210-263). The markers `engine.rate-function` and
  `engine.settings-rule` remain **open** by design (the fallback stays live).

## H. Rule resolver

- **Authoritative:** `apn_resolve_commission_rate(commission_type, project_value, partner_id,
  at)` (foundation:210-263): picks the newest active rule set effective at the event time,
  matches the tier by `value between tier_min and tier_max`, ordered `priority asc,
  tier_max asc nulls last`.
- Percent lookups for the collection trigger use `apn_commission_rate_for(commission_type)`
  (wp3:95-108) against rules effective at `current_date`.
- The ledger **validates** the percent it is given against the active rule-set maximum
  (`max_percent` check in `apn_ledger_entry_owner`, wp9:97-108) — the resolver and the
  validator are two halves of the same rule.

## I. Commission caps

All enforced in `apn_ledger_entry_owner` (`pr-apn-rule-engine-wp9.sql:64-140`) before any
insert:

1. **Rule max:** `percent > max_percent` of the active rule for that commission type →
   `check_violation` (wp9:97-108).
2. **15% secondary cap:** sum of positive `referral/district/state` amounts on the same event
   must not exceed `round(base * 15/100, 2)` (wp9:109-118).
3. **35% total cap:** sum of all positive amounts on the same event must not exceed
   `round(base * 35/100, 2)` (wp9:119-125). (A historical bug where this check sat inside the
   secondary branch was fixed by migration `20260813146000_pr_apn_rule_engine_ledger_cap_fix.sql`;
   the current bodies are correct.)

## J. Revenue collection

- **Authoritative entry:** `crm_record_revenue(project_id, amount, received_at, incentive,
  remarks)` — live body in `supabase/pr-security-phase2-hardening.sql:247-261` (authz:
  `crm_can_manage()`, line 255; amount checks; project cap vs `project_value`; inserts into
  `crm_revenue_collections`).
- **Sync to APN:** the AFTER INSERT trigger on `crm_revenue_collections` →
  `crm_sync_revenue_to_apn()` (`supabase/pr4-enterprise-crm.sql:403-425`):
  1. Only when `crm_projects.apn_project_id` is set and the APN table exists.
  2. `commission_generated = least(greatest(0, maximum_commission − total_commission_paid −
     prior CRM commissions on the project), round(amount × rate / 100, 2))` (pr4:411).
  3. APN collection row with id `'crm-revenue-'||crm_collection_id`, `partner_id` taken from
     **the APN project** (`apn.partner_id`), `commission_status='Payable'`, written with
     `on conflict(id) do nothing` (pr4:413-414).
  4. APN project totals recomputed; status `Completed`/`Processing` (pr4:415).
  5. Finance **income** transaction `'crm-finance-'||crm_collection_id` written
     (kind `income`, category `Project`) with `on conflict(id) do nothing` (pr4:418-419).
  6. CRM project status, `crm_log_event`, `crm_notify` (pr4:421-423).
- The APN collection insert fires the ledger trigger
  (`apn_ledger_collection_after_change`, wp9:211-281) which records partner + district +
  state ledger events through the **owner path** (idempotency keys `col:<id>:partner|district|state`).
- **Freeze behavior:** the sync chain itself has no freeze call; the ledger trigger defers via
  `apn_ledger_record_owner` — under `frozen=true` the collection still lands, the ledger does
  not mint, and the deferral is audited (verified: `pr-apn-crm-assignments-wp10-verify.sql:356-379`).

## K. Ledger

- **Authoritative:** `apn_commission_ledger`
  (`supabase/pr-apn-rule-engine-foundation.sql:442-457`, extended
  `pr-apn-rule-engine-wp3.sql:73-79`): append-only, `idempotency_key` UNIQUE, `source_type`,
  `partner_id`, `commission_type in ('partner','district','state','referral','adjustment',
  'reversal','recovery')`, `base_amount`, `percent`, `amount` (`<> 0`; negative = reversal/
  recovery), `event_at`, `snapshot`, `reversed_by`, `eligible_from`, `original_event_id`.
- **Write path (WP9 canonical):**
  - `apn_ledger_entry` (role-gated wrapper, `is_admin() or can_module('apn')`, wp9:143-167)
    → `apn_ledger_entry_owner` (wp9:64-140: freeze guard, key/source validation, partner check,
    duplicate detection by key, caps, insert, audit).
  - Triggers call `apn_ledger_record_owner` (wp9:170-208) — the same owner path wrapped in a
    deferral handler that audits `'ledger record deferred'` with the SQLERRM and returns
    `{deferred:true}` instead of aborting.
  - `apn_ledger_record_safe` (wp3:112-149) is the WP3-era gated deferral wrapper still used by
    the WP8 backfill (wp8:162).
- **Idempotency key formats:** `col:<collectionId>:partner|district|state` (wp9:237,253,267),
  `earn:<earningId>` (wp9:299), `rev:*` (foundation:710,716), `rev:led:<ledgerId>`
  (wp3:606,665), `rec:led:<ledgerId>` recovery (wp3:623,682), `legacy:<legacyRowId>` backfill
  (wp8:151), deterministic finance ids `apn-expense-ledger:<ledgerId>` / `apn-expense-rev:*`.
- **No client role can write the ledger** (foundation:460-461); only SECURITY DEFINER engine
  functions can.

## L. Consolidated wallet

- **Authoritative:** `apn_consolidated_wallets` (`supabase/pr-apn-rule-engine-wp3.sql:154-169`) —
  **derived only**, written exclusively by `apn_consolidated_wallet_refresh(partner_id)`
  (wp3:195-298), which recomputes from the immutable ledger: `earned`, `pending` (eligible date
  in the future), `eligible`, `total_balance`, `reserved`, `withdrawable`, `withdrawn`,
  `reversed`, `recovery_outstanding`, `recovery_recovered`, `recovery_remaining`,
  `commission_breakdown` (wp3:213-289).
- **Writes are impossible from the app:** no INSERT/UPDATE/DELETE grants (wp3:172-173), RLS is
  select-only (wp3:175-178), and `apn_consolidated_wallet_mutation_trg` (wp3:190-193) rejects
  direct mutations unless the refresh function opened the path with
  `set_config('apn.consolidated.refresh','on',true)`.
- **Eligibility:** `eligible_from` on ledger rows is stamped by the record_owner wrappers
  (`apn_ledger_record_safe` wp3:135-138 / `apn_ledger_record_owner` wp9:193-196); the wallet
  uses `coalesce(eligible_from, event_at::date)` (wp3:219,225).
- **Portals read it** via `apn_partner_financial_snapshot()` (WP7) and `apn_ai_build_context()`
  (WP5) — both read the same derived row.

## M. Withdrawal wallet

- **Authoritative:** `apn_withdrawal_wallets` (`supabase/apn-withdrawal-settlement-engine-pr3.sql:24-43`),
  PK `(partner_id, wallet_type)`, `wallet_type in ('commission','referral','incentive')`,
  buckets `pending, approved, withdrawable, locked, paid, lifetime, monthly, today` plus
  `total_requested/approved/rejected/processing`, `last_paid_at`, `next_settlement_date`.
- **Derived only:** written by `apn_withdrawal_refresh_wallet(partner_id)` (pr3:311-351) from
  `apn_withdrawal_source_totals` (canonical version: `pr-apn-commission-integrity-wp6.sql:114-175`,
  which excludes `Reversed` rows from lifetime/monthly/today) minus in-flight reservations
  (pending/under_review/approved/processing/paid requests; pr3:318-320) and legacy referral
  reservations (pr3:327-333). Refresh triggers on requests, collections, and referral earnings
  (pr3:391-399). WP9 confirmed this wallet is intentionally source-derived, NOT ledger-derived
  (`pr-apn-rule-engine-wp9.sql:6-21`).
- **Never manually incremented** — a manual write is overwritten by the next refresh.

## N. Withdrawal lifecycle

- **Authoritative:** `apn_withdrawal_requests`
  (`supabase/apn-withdrawal-settlement-engine-pr3.sql:57-80`, extended by
  `pr-apn-rule-engine-wp3.sql:86-92`):
  statuses `('pending','under_review','approved','rejected','processing','paid','failed',
  'cancelled','expired')`, `requested_amount > 0`, `approved_amount <= requested_amount`,
  `preferred_method in ('upi','bank_transfer')`, bank snapshot keeps only the last-4 digits,
  `expires_at = now() + 30 days`.
- **Partner actions:** `apn_upsert_withdrawal_bank_account` (pr3:414-442),
  `apn_request_withdrawal` (pr3:444-476 — active partner only, identical-duplicate guard,
  wallet row-lock, lock transaction, 30-day expiry), `apn_cancel_withdrawal` (pr3:555-565).
- **Admin/finance actions** (gate `apn_withdrawal_can_manage = is_admin() or can_finance()`,
  pr3:166-169): `apn_withdrawal_review` (pr3:492-544 — full state machine: approve/partial
  approve/reject/paid/failed; settlement + finance transactions on `paid`; release on
  reject/cancel/expire), wrappers (pr3:546-553), `apn_set_withdrawal_bank_verification`
  (pr3:478-490), `apn_create_withdrawal_batch` (pr3:596-609), `apn_log_withdrawal_export`
  (pr3:624-634), and marking a failed payment via `apn_mark_withdrawal_failed` (wp3:830-871,
  same `apn_withdrawal_can_manage()` gate at wp3:839-841; writes a `release` wallet-transaction
  journal entry so the amount returns to `withdrawable`).
- **Superadmin only:** `apn_unlock_withdrawal_wallet` (pr3:567-573), `apn_reopen_withdrawal`
  (pr3:575-594).
- **Immutable history:** `apn_withdrawal_status_history`, `apn_withdrawal_settlements`
  (`request_id` unique), `apn_wallet_transactions`, `apn_withdrawal_finance_transactions`,
  `apn_withdrawal_audit` — all protected by `apn_withdrawal_prevent_mutation` (pr3:401-412).
- **Timing:** `next_settlement_date` = the next Monday — `current_date + (8 − isodow(date))`
  (`apn_withdrawal_next_settlement_date`, pr3:181-184); eligibility date for commissions = 5th
  of the following month (`apn_commission_eligibility_date`, wp3:63-67).

## O. Reversals

- **Engine-side (WP3, canonical):** `apn_commission_reverse_project(project_id, reason)`
  (`pr-apn-rule-engine-wp3.sql:522-758`):
  - Books additive reversal ledger events `rev:led:<ledgerId>` per original event
    (originals never edited/deleted); wires `original_event_id`.
  - Books `rec:led:<ledgerId>` recovery events only against the partner's paid pool
    (FIFO; no double-count, wp3:592-633).
  - Marks the collection `'Reversed'` and the project `'Cancelled'`; voids referral earnings
    (existing engine pattern).
  - Creates finance reversal rows only when the project already has finance posted.
  - `apn_commission_cancel_project` is an alias (wp3:760-768) — the canonical cancellation is
    the reversal, not the legacy delete surface.
  - `apn_reversal_history(project_id)` (wp3:770-820) is the read surface.
- **Legacy surface (WP6):** `apn_commission_reverse_legacy(commission_id, reason, unlock_paid)`
  (`pr-apn-commission-integrity-wp6.sql:32-104`): marks the legacy `apn_commissions` blob
  `Reversed` with actor/reason/epoch-ms stamp, refuses double reversal, refuses paid reversal
  without a **superadmin** unlock, audits, then refreshes the withdrawal wallet so reversed
  money leaves `withdrawable` immediately.
- **Wallet effect:** reversed money drops out of every derived surface —
  `apn_withdrawal_source_totals` excludes `Reversed` (wp6:137-139,149-151,165-167), and the
  consolidated wallet derives `reversed`/`recovery_*` fields from ledger reversal/recovery
  events (wp3:231-239,269-270). Future earnings offset `recovery_remaining` automatically.

## P. Finance integration

- **Income side:** CRM collections post income `'crm-finance-'||crm_collection_id`
  (kind `income`, category `Project`) at sync time (pr4:418-419).
- **Expense side (deliberately NOT automatic):** `apn_finance_expense_map`
  (foundation:561-569) maps a ledger row to a finance expense. Populated only by
  `apn_ensure_finance_expense(ledger_id)` (foundation:582-639, wp3:461-519 canonical) — a
  **finance-role action** (`is_admin() or can_finance() or can_module('apn')`, wp3:473).
  WP9 documented that auto-posting would double-book expenses the finance team controls
  (`pr-apn-rule-engine-wp9.sql:24-27,320`).
- **Accounting RPC (finance-posted APN business):** `create_apn_income_transaction`
  — live 4-arg version with `p_mode in ('create','edit','convert')`
  (`supabase/pr-finance-apn-edit-convert.sql:49-56`, superseding
  `pr-finance-apn-commission-reconcile.sql:56-328`): atomic project + collections + income +
  deterministic commission expense `'apn-expense:'||transaction_id` (category
  `APN Commission`, source `apn-commission`, split mirrored from income hajiPct/alimPct);
  attach mode when the project already exists without finance; edit mode refuses partner
  change on the anchored project; convert mode turns normal income into APN commission.
- **Supporting read:** `get_apn_commission_state(...)` (reconcile:405-475) exposes
  project/collections/financeIncome/financeExpense/orphanFinance for reconciliation.
- **Locks:** finance mutation is governed by the finance-lock triggers
  (`fin_lock_txn`/`trg_lock_tx` BEFORE INSERT/UPDATE/DELETE on `transactions`/`withdrawals`,
  `pr-security-phase2-hardening.sql:386-397`) and the `can_finance()` RLS on `transactions`.

## Q. CRM assignment

- **Authoritative:** `crm_leads` assignment columns + append-only history
  `crm_lead_assignments` (`supabase/pr4-enterprise-crm.sql:74-83`).
- **`crm_assign_lead`** (pr4:304-315): `is_admin()`-only gate; updates the lead's four
  assignment columns; every call appends a history row (duplicates are history-only, never
  money — WP10 verify T4); audited via `crm_audit` (`'lead_assigned'`).
- **Conversion snapshot:** `crm_convert_quotation` (pr4:349-375) creates `crm_projects`,
  **snapshotting `assigned_partner_id`**, and — only when a partner is assigned — creates the
  APN project `'crm-'||project_id` (`on conflict do nothing`), rate from
  `apn_users.data->>'commissionPct'` (default 10), linking `crm_projects.apn_project_id`.
  The proposal path builds `'proposal-'||project_id` (`pr-web-3-proposal-engine.sql:146-176`).
- **Reassignment governance (WP10):** `upsert_apn_commission_project`
  (`supabase/pr-apn-crm-assignments-wp10.sql:66-136`, SECURITY DEFINER, `can_finance() or
  is_admin()`):
  - Duplicate partner+name+client on another non-Cancelled project → `unique_violation`.
  - Existing project + different partner + **any recorded collections** → `check_violation`
    (revenue locks entitlement forever, wp10:100-107).
  - Pre-revenue partner change allowed but audited as `'commission project partner reassigned
    (pre-revenue)'` (wp10:105-106).
  - Race backstop: `on conflict (id) do update … where partner_id unchanged or no collections`
    (wp10:109-112).
- **Post-money reassignment of the lead** changes only work-routing; ledger, wallets, and
  referral earnings stay put (WP10 verify T7).

## R. Legacy convergence

- **Authoritative:** `apn_backfill_legacy_commissions(dry_run default true)`
  (`supabase/pr-apn-legacy-backfill-wp8.sql:54-219`), SECURITY DEFINER,
  gate `is_admin() or can_finance() or is_superadmin()`, freeze-guarded.
- Per eligible legacy `apn_commissions` row: one ledger entry, idempotency key `legacy:<id>`,
  `source_type='adjustment'`, `commission_type='partner'`, rate clamped 0–100, event_at from
  `createdAt`, `eligible_from = payoutDate` only for pending rows; `kind='district'` and
  `Reversed` rows skipped; failure defers (never aborts the batch) and is audited.
- **Production reality:** the legacy dataset is **empty** (0 rows verified 2026-08-14) — the
  migration is a provable no-op that ships the mechanism (wp8:7-19). Marker
  `engine.legacy-commissions` closed by WP8 (wp8:229-235).

## S. ALLBEE AI

- **Authoritative context builder:** `apn_ai_build_context(p_question)`
  (`supabase/pr-apn-ai-support-wp5.sql:146-374`) — scoped to `auth.uid()` via
  `apn_ai_partner_scope()` (wp5:72-96; requires active partner/district_head/state_head).
  **No function accepts a target user id** (wp5:4-7). It feeds the AI only the caller's own
  wallet, ledger (30), reversals (15), withdrawal wallets/requests (15), referrals (10),
  referral earnings (10), projects (15), collections (15), leads (15), quotations (10),
  targets (10), zone requests (5), tickets (10), notifications (10), plus shared
  rule knowledge and the freeze flag. Never secrets/service-role material/other partners'
  data/admin data (wp5:141-145).
- **Usage cap:** `apn_ai_usage_tick` (wp5:102-135, errcode RL001, 60/hour per user).
- **Edge function:** `supabase/functions/apn-ai/index.ts` — JWT verified twice (platform
  `verify_jwt=true` plus in-function JWKS check; `role='authenticated'` required, index.ts:8-12,
  67-69); identity from the verified JWT only; the **only** DB calls are the two RPCs above
  (index.ts:167,180); strict `<ALLBEE_UNCERTAIN>` escalation block (index.ts:116-142).
- **General assistant:** `supabase/functions/ai-chat/index.ts` — no service-role key; PII is
  masked in the browser before the snapshot is sent (`src/AllbeeApp.jsx:703-719`).

## T. Support tickets

- **Authoritative:** `apn_support_tickets` (wp5:13-35): `ticket_no` unique
  (`APN-TK-XXXXXXXX`), `priority in ('low','normal','high','urgent')`,
  `status in ('open','under_review','waiting_for_partner','answered','resolved','closed')`,
  separate `admin_response` and `superadmin_response` fields, idempotency key `client_key`
  (partial unique index, wp5:40-42), RLS own-rows-or-admin (wp5:49-52).
- **Writes** only through RPCs: `apn_support_tickets_create` (wp5:385-453),
  `apn_support_tickets_list` (wp5:459-481), `apn_support_tickets_respond` (wp5:489-549 —
  **superadmin only may set `resolved`/`closed`**, guard wp5:521-524), `apn_support_tickets_status`
  (wp5:556-594, same guard at wp5:571-574). A mutation-guard trigger forbids direct writes
  unless `apn.support.write` is set (wp5:603-617).
- All ticket actions are audited in `apn_rule_audit` (wp5:448,544,589).

## U. Partner portal

- **Authoritative read RPC (WP7):** `apn_partner_financial_snapshot()`
  (`supabase/pr-apn-app-ui-wp7.sql:33-150`) — **IDOR-proof by construction**: identity comes
  from `auth.uid()` only, no `p_partner_id` parameter. Returns `freeze`, `ruleKnowledge`,
  `wallet` (consolidated), `ledger` (30), `reversals` (15), `withdrawalWallets`,
  `withdrawalRequests` (15), `nextEligibleDate` — the same shapes as `apn_ai_build_context`,
  so UI and AI display provably identical data (wp7:12-15).
- Consumed at `src/AllbeeApp.jsx:498-502` (`fetchPartnerFinancialSnapshot`), rendered in the
  APN portal (`src/AllbeeApp.jsx:10933-10943`), refetched on mount and tab switch; degrades
  to legacy figures if the RPC is absent (src:496-497).
- Other portal RPCs: `apn_referral_dashboard` (pr2:462-477), `apn_withdrawal_dashboard`
  (pr3:611-622).

## V. Admin portal

- Admin surfaces read normalized tables directly (`WITHDRAWAL_READS`/`REFERRAL_READS`,
  `src/AllbeeApp.jsx:349-388`) plus JSON-blob tables (`apn_users`, `apn_admin_notes`,
  `apn_admin_consoles`, `apn_zone_requests`, src:340-345).
- Admin financial actions go through the role-gated RPCs: `apn_withdrawal_review`,
  `apn_create_withdrawal_batch`, `apn_log_withdrawal_export` (src:12126-12147),
  `apn_commission_reverse_legacy` (src:12483), `upsert_apn_commission_project`,
  `create_apn_income_transaction`.
- Admin hub tables: `apn_admin_consoles` / `apn_admin_notes` (JSON-blob, admin-only RLS,
  wp4:12-41); `apn_zone_requests` hub-note + notification triggers (wp4:69-119).

## W. Superadmin governance

- RLS helper `is_superadmin()` (`schema.sql:109-112`); the only role that can:
  - toggle the emergency freeze (`apn_system_controls`, policy foundation:59-60 + guard
    foundation:62-79),
  - set a partner status to `banned` (wp4:251-253),
  - unlock paid legacy reversals (`apn_commission_reverse_legacy(p_unlock_paid=true)`,
    wp6:58-63),
  - unlock/reopen withdrawals (`apn_unlock_withdrawal_wallet` pr3:567-573,
    `apn_reopen_withdrawal` pr3:575-594),
  - mark `resolved`/`closed` on support tickets (wp5:521-524,571-574),
  - resolve migration markers (`apn_migration_mark`, foundation:782-813).
  (Marking a failed payment is **not** superadmin-only — it uses the admin/finance
  `apn_withdrawal_can_manage()` gate, wp3:839-841.)
- `apn_migrations` (foundation:741-752) is the governance ledger for engine convergence;
  marker states at closeout: `engine.referral-trigger` ✅ (wp9), `engine.district-client` ✅
  (wp6), `engine.finance-reversal` ✅ (wp6), `engine.legacy-commissions` ✅ (wp8),
  `engine.withdrawal-wallets` ✅ (wp9), `engine.crm-assignments` ✅ (wp10);
  **open by design**: `engine.settings-rule`, `engine.rate-function`, `engine.app-ui`.

## X. Emergency freeze

- **Authoritative:** `apn_system_controls` row `id=1` (foundation:37-47), `frozen` boolean.
- Toggle: superadmin only (RLS foundation:59-60 + `apn_system_controls_guard` foundation:62-79,
  which also stamps `frozen_at`/`frozen_by`).
- Enforcement: `apn_guard_operational()` (foundation:86-99) raises `FZ001`
  (`APN operations are temporarily frozen.`) at the top of every engine write path:
  `apn_ledger_entry_owner` (wp9:86), `apn_rule_set_publish` (foundation:284),
  `apn_hierarchy_guard` (foundation:380), `apn_create_reversal` (foundation:680),
  `apn_backfill_legacy_commissions` (wp8:85), `apn_engine_record_partner_earning` (wp2:74-77).
- **Deferral model:** the trigger recorders (`apn_ledger_record_owner` wp9:198-205,
  `apn_ledger_record_safe` wp3:140-147) catch the exception, audit
  `'ledger record deferred'` with the FZ001 message, and return `{deferred:true}` — so a
  frozen system still records collections/earnings but mints **no ledger money**.
- Partners see the freeze flag via `apn_partner_financial_snapshot()` (wp7:56-62) and the AI
  context (wp5) — freeze is not hidden from the UI.

## Y. Finance locks

- `can_finance()` = `superadmin` or `accountant` active (`schema.sql:121-124`).
- Finance surfaces (`transactions`, `withdrawals`) are locked at the table level by
  BEFORE INSERT/UPDATE/DELETE triggers `fin_lock_txn`/`trg_lock_tx`
  (`pr-security-phase2-hardening.sql:386-397`) and RLS `can_finance()`-only policies
  (hardened `_allbee_table` shape, hardening:162-179).
- Expense posting for ledger money is a finance-role action (`apn_ensure_finance_expense`,
  wp3:473); the accounting RPC is finance-gated (`create_apn_income_transaction`,
  reconcile:97-99).

## Z. Audit system

- **Engine audit:** `apn_rule_audit` (foundation:103-111) + SECURITY DEFINER
  `apn_rule_audit(action, entity, entity_id, metadata)` (foundation:115-138), which also
  mirrors into the global `audit` JSON table. **No grants** (foundation:113) — engine
  functions only. Key actions: `recorded ledger entry`, `ledger record deferred`,
  `posted ledger expense`, `commission project partner reassigned (pre-revenue)`,
  `reversed legacy commission`, `backfilled legacy commission`, ticket lifecycle actions.
- **Withdrawal audit:** `apn_withdrawal_audit` (pr3:138-146), `apn_withdrawal_status_history`
  (pr3:82-94), `apn_wallet_transactions` (pr3:110-122), `apn_withdrawal_settlements`
  (pr3:96-108) — all immutable.
- **Referral audit:** `apn_referral_audit` (pr2:209-221), snapshots (pr2:58-65), timeline
  (pr2:90-99), activities (pr2:101-110).
- **CRM audit:** `crm_audit` (pr4:214-224) + `crm_activities` (pr4:177-188) + `crm_log_event`
  (pr4:253-264).
- **App audit:** the global `audit` JSON table with `is_admin() or (data->>'userId') =
  auth.uid()` INSERT policy (hardening:206-212).

---

### Supersession map (canonical = last definition in deploy order)

| Object | Canonical definition | Superseded by |
|---|---|---|
| `apn_ledger_entry` / `apn_ledger_entry_owner` | `pr-apn-rule-engine-wp9.sql:64-140,143-167` | foundation:476-554 |
| `apn_ledger_record_owner` (trigger path) | wp9:170-208 | — (wp3 `apn_ledger_record_safe` still used by WP8 backfill) |
| `apn_ledger_collection_after_change` / `apn_ledger_referral_after_change` | wp9:211-307 | wp3:349-450 |
| `upsert_apn_commission_project` | `pr-apn-crm-assignments-wp10.sql:66-136` | v4:128-191, hardening:303-351, reconcile:339-396 |
| `crm_record_revenue` | `pr-security-phase2-hardening.sql:247-261` | pr4:391-401 |
| `apn_withdrawal_source_totals` | `pr-apn-commission-integrity-wp6.sql:114-175` | pr3:248-309 |
| `apn_referral_refresh_wallet` | `apn-withdrawal-settlement-engine-pr3.sql:638-658` | pr2:223-262 |
| `apn_referral_leaderboard` | `pr-apn-rule-engine-wp2.sql:145-161` | pr2:492-506 |
| `apn_users_guard` | `pr-apn-partner-lifecycle-wp4.sql:205-256` | apn-partner-management.sql:89-126 |
| `create_apn_income_transaction` (4-arg) | `pr-finance-apn-edit-convert.sql:49+` | reconcile:56-328 (3-arg dropped) |
| `apn_ensure_finance_expense` | `pr-apn-rule-engine-wp3.sql:461-519` | foundation:582-639 |
| `apn_commission_ledger` column checks | wp3:73-79 | foundation:442-457 |

### Explicit non-implementations (verified, not changed)

- `engine.crm-assignments` mirroring lead heads into `apn_hierarchy_assignments` — **not
  implemented by design** (wp9:28-33; closed with rationale by wp10).
- Auto-posting commission expenses from ledger events — **not implemented by design**
  (finance-role action only, wp9:24-27).
- `engine.rate-function` / `engine.settings-rule` / `engine.app-ui` markers — **open by
  design** (legacy fallback stays live; portal convergence was frontend+snapshot-RPC).

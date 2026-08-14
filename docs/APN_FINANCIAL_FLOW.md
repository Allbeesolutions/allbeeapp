# ALLBEE APN — Authoritative Financial Flow

The money path from CRM revenue to finance, with every percentage, cap, eligibility rule,
reversal behavior, idempotency mechanism, freeze behavior, and lock documented. This is the
single description of how money flows in the deployed engine (release `435b00c`).

```
CRM revenue (crm_record_revenue)
        │  hardening:247-261  (authz crm_can_manage; project cap)
        ▼
crm_revenue_collections  ── AFTER INSERT ──►  crm_sync_revenue_to_apn (pr4:403-425)
        │                                          │  commission_generated formula (pr4:411)
        │                                          │  id 'crm-revenue-'||id, on conflict(id) do nothing
        │                                          ▼
        │                              apn_revenue_collections (commission_status='Payable')
        │                                          │  AFTER INSERT triggers:
        │                                          │   • apn_ledger_collection_trg → apn_ledger_collection_after_change (wp9:211-281)
        │                                          │   • apn_referral_collection_trg → referrer earnings (pr2:317-345)
        │                                          │   • apn_withdrawal_collection_wallet_trg → withdrawal wallet refresh (pr3:394-396)
        │                                          ▼
        │                              apn_commission_ledger (append-only, idempotency-keyed)
        │                                          │  partner col:<id>:partner        (wp9:237)
        │                                          │  district col:<id>:district      (wp9:253)
        │                                          │  state    col:<id>:state         (wp9:267)
        │                                          │  referral earn:<earningId>       (wp9:299)
        │                                          ▼
        │                              apn_consolidated_wallet_refresh (wp3:195-298)
        │                                          ▼
        │                              apn_consolidated_wallets (derived; portal + AI truth)
        │
        ▼
transactions  'crm-finance-'||id  (income only — pr4:418-419)
        │
        ▼
apn_withdrawal_wallets (derived from source totals − reservations; wp6 canonical totals)
        │
        ▼
apn_withdrawal_requests → review → settlement → paid
        │
        ▼
Finance: apn_ensure_finance_expense (finance-role, manual/reversal-only) or
         create_apn_income_transaction (atomic project+collections+income+expense)
```

## 1. Percentages

- **Partner commission** on a collection: the APN project's `commission_rate`
  (`apn_commission_projects`, set at conversion from `apn_users.data->>'commissionPct'`,
  default 10 — pr4:362-369). The ledger entry's `percent` is validated against the active
  rule set's `max_percent` for `commission_type='partner'` (wp9:97-108).
- **Resolver** (`apn_resolve_commission_rate`, foundation:210-263): newest active rule set at
  the event time, tier match, `priority asc, tier_max asc nulls last`; fallback to the legacy
  ladder **10 / 15 / 20** (`apn_commission_rate_for_project`, pr-ux-3-production.sql:7-44)
  when no active rule exists; referral/district/state fallback = **1%** (foundation:255-259).
- **District / state**: percent from the active rule set via `apn_commission_rate_for`
  (wp3:95-108) at the collection trigger; paid server-side only (never client-computed —
  WP6 removed the client `kind='district'` rows, wp6:9-20).
- **Referral**: linked referrer earns `apn_referral_settings.default_percent` (default **1%**,
  pr2:7-16) of the collection via the PR2 trigger; the WP2 self-earning path pays the partner
  the configured percent for the collection with `relationship_id=NULL` (wp2:58-138). A partner
  with an active linked relationship is skipped by the self-earning path (wp2:91-98).

## 2. Commission cap formula (per collection)

`crm_sync_revenue_to_apn` (pr4:411):

```
commission_generated =
  least(
    greatest(0,
      maximum_commission − total_commission_paid − Σ prior commission_generated on project),
    round(received_amount × commission_rate / 100, 2))
```

Ledger-level caps in `apn_ledger_entry_owner` (wp9:97-125):

- `percent` must not exceed the active rule's `max_percent` for that type.
- **15% secondary cap**: Σ positive `referral+district+state` on the same event
  ≤ `round(base × 15 / 100, 2)` (wp9:109-118).
- **35% total cap**: Σ all positive amounts on the same event ≤ `round(base × 35 / 100, 2)`
  (wp9:119-125).

## 3. Eligibility

- `apn_commission_eligibility_date(received_at)` (wp3:63-67):
  `(date_trunc('month', received_at) + interval '1 month 4 days')::date` — **the 5th of the
  following month**. Revenue on the 31st → next month's 5th; revenue on the 1st → the following
  cycle's 5th. No day-of-month exceptions.
- The ledger row's `eligible_from` is stamped once at record time by the record_owner wrappers
  (wp3:135-138, wp9:193-196: `update … set eligible_from = p_eligible_from where eligible_from
  is null`).
- The consolidated wallet buckets: `pending` = eligible date > today, `eligible` = eligible
  date ≤ today (wp3:219-229). `nextEligibleDate` is surfaced to the portal/AI
  (wp7:130-133, wp5:347-350).

## 4. Ledger write path and idempotency

- All money enters `apn_commission_ledger` through `apn_ledger_entry_owner` (wp9:64-140),
  reached either directly via the gated `apn_ledger_entry` (wp9:143-167) or from triggers via
  the deferral wrappers `apn_ledger_record_owner` (wp9:170-208) / `apn_ledger_record_safe`
  (wp3:112-149).
- Order of checks in the owner path: freeze guard → key/source validation → partner existence →
  **duplicate check by `idempotency_key`** → max_percent → 15% cap → 35% cap → insert → audit
  `'recorded ledger entry'`.
- `idempotency_key` is UNIQUE (foundation:444); keys: `col:<collectionId>:partner|district|state`,
  `earn:<earningId>`, `rev:<ledgerId>`, `rev:led:<ledgerId>`, `rec:led:<ledgerId>`,
  `legacy:<legacyRowId>`, deterministic finance ids `apn-expense-ledger:<ledgerId>` /
  `apn-expense-rev:*`. Replays return `{duplicate:true}` and change nothing.

## 5. Wallets — derived, never incremented

> **Derived wallet values must never be manually incremented.** Every wallet table is a
> projection recomputed by a refresh function; a manual write is either rejected (guard
> triggers / no grants) or silently overwritten by the next refresh.

- `apn_consolidated_wallets` ← `apn_consolidated_wallet_refresh` (wp3:195-298) from the
  ledger: `earned`, `pending`, `eligible`, `total_balance`, `reserved`, `withdrawable`,
  `withdrawn`, `reversed`, `recovery_outstanding`, `recovery_recovered`, `recovery_remaining`,
  `commission_breakdown`. Guard trigger rejects direct mutations (wp3:190-193); no write
  grants (wp3:172-173).
- `apn_withdrawal_wallets` ← `apn_withdrawal_refresh_wallet` (pr3:311-351) from
  `apn_withdrawal_source_totals` (wp6 canonical, excludes `Reversed` from lifetime/monthly/
  today) minus reservations (pending/under_review/approved/processing/paid requests +
  legacy referral reservations). `withdrawable = greatest(0, source.withdrawable − reserved)`
  (pr3:338). Explicitly **source-derived, not ledger-derived** (wp9:6-21) so the claims center
  and the ledger stay symmetric.
- `apn_referral_wallets` ← `apn_referral_refresh_wallet` (pr3:638-658 canonical) from
  `apn_referral_earnings` plus PR3 referral-withdrawal reservations.

## 6. Withdrawals

- **Request**: `apn_request_withdrawal` (pr3:444-476) — active partner only, identical-duplicate
  guard, wallet row-lock, `lock` wallet transaction, 30-day `expires_at`, `preferred_method`
  `upi|bank_transfer`, bank snapshot stores last-4 only.
- **Review**: `apn_withdrawal_review` (pr3:492-544) — the full state machine
  `pending → under_review → approved → processing → paid` (plus `rejected`, `cancelled`,
  `expired`, `failed`): partial approval releases the unapproved part; `paid` writes the
  settlement row + finance transaction; rejected/cancelled/expired release the reservation;
  `failed` — `apn_mark_withdrawal_failed` (wp3:830-871, gate `apn_withdrawal_can_manage()`,
  admin/finance, wp3:839-841) — writes a `release` journal entry so the amount returns to
  `withdrawable` (wp3:44-49).
- **Timing**: `next_settlement_date` = the next Monday (`apn_withdrawal_next_settlement_date`,
  pr3:181-184: `current_date + (8 − isodow)`). Commission eligibility = the 5th of the
  following month (section 3).
- **History** is immutable: status history, settlements (`request_id` unique), wallet
  transactions, finance transactions, audit (pr3:82-155, guard pr3:401-412).

## 7. Reversals

- **Engine reversal** = additive counter-entry, never deletion:
  `apn_commission_reverse_project` (wp3:522-758):
  - `rev:led:<ledgerId>` events for each original (negative amounts, `original_event_id`
    wired); originals untouched.
  - `rec:led:<ledgerId>` recovery events only against the partner's **paid pool**
    (FIFO, no double-count; wp3:592-633).
  - Collection → `commission_status='Reversed'`; project → `status='Cancelled'`;
    referral earnings → `status='void'`.
  - Finance reversal rows only when the project already has finance posted (no orphans).
  - `apn_commission_cancel_project` is an alias (wp3:760-768).
- **Legacy reversal**: `apn_commission_reverse_legacy` (wp6:32-104) — blob `status='Reversed'`
  + stamps; double reversal refused; paid rows need a superadmin `p_unlock_paid`; then the
  withdrawal wallet refreshes so reversed money leaves `withdrawable` immediately (wp6:90-94).
- **Wallet effect**: `apn_withdrawal_source_totals` excludes `Reversed` (wp6:137-139,
  149-151, 165-167) in every bucket; the consolidated wallet derives `reversed` and
  `recovery_*` from the ledger (wp3:231-239, 269-270); future eligible earnings automatically
  offset `recovery_remaining`.

## 8. Freeze behavior

- `apn_system_controls.frozen` (superadmin toggle, foundation:59-79) → `apn_guard_operational`
  raises `FZ001` (foundation:86-99) in every engine write path.
- **Hard-abort paths**: ledger owner path (wp9:86), rule-set publish (foundation:284),
  hierarchy writes (foundation:380), `apn_create_reversal` (foundation:680), backfill
  (wp8:85), self-earning engine RPC (wp2:74-77).
- **Deferral paths** (trigger recorders): `apn_ledger_record_owner` / `apn_ledger_record_safe`
  catch the exception, audit `'ledger record deferred'` with the FZ001 message, and return
  `{deferred:true}`. A frozen system therefore still records the CRM collection and the
  finance income transaction, but mints **no ledger money** — no ledger row, no wallet
  increment (verified: wp10-verify T9).
- The freeze state is visible to partners through the portal snapshot and AI context
  (wp7:56-62) — it is not hidden.

## 9. Finance locks

- `can_finance()` = active `superadmin` or `accountant` (schema.sql:121-124).
- `transactions` / `withdrawals` are guarded by BEFORE INSERT/UPDATE/DELETE finance-lock
  triggers (`fin_lock_txn`, `trg_lock_tx`; hardening:386-397) and `can_finance()` RLS
  (hardening:162-179).
- Commission expenses are **never auto-posted** from ledger events (wp9:24-27):
  - `apn_ensure_finance_expense(ledger_id)` (wp3:461-519) — manual/finance-role action with
    deterministic ids, guarded by `is_admin() or can_finance() or can_module('apn')` (wp3:473).
  - `create_apn_income_transaction(p_mode 'create'|'edit'|'convert')` (edit-convert:49-101) —
    the atomic accounting path: project + collections + income + deterministic expense
    `'apn-expense:'||transaction_id` (category `APN Commission`, split mirrored from the
    income's hajiPct/alimPct). Edit mode refuses a partner change on an anchored project
    (edit-convert:167-176).

## 10. Historical ownership

- **Commission authority is frozen at first money**: `apn_commission_projects.partner_id`
  cannot change once any collection exists (WP10 guard, wp10:100-107; race-safe upsert
  WHERE, wp10:109-112). Pre-revenue changes are audited (`'commission project partner
  reassigned (pre-revenue)'`, wp10:105-106).
- Reassigning the CRM lead after revenue changes **only** work-routing; the ledger, wallets,
  referral earnings, and finance rows stay put (WP10 verify T7).
- Ledger rows are never edited or deleted; reversal and recovery are additive
  (foundation:455, wp3:78-79).

## 11. Legacy convergence

- `apn_backfill_legacy_commissions(dry_run=true)` (wp8:54-219): one ledger entry per legacy
  row with key `legacy:<id>`, `source_type='adjustment'`, `commission_type='partner'`, rate
  clamped 0-100, eligible_from from `payoutDate` for pending rows; `kind='district'` and
  `Reversed` rows skipped; failures defer and are audited, never aborting the batch; the blob
  is stamped `migratedLedgerId` so the legacy projection drops migrated rows.
- Production reality: **0 legacy rows** (verified 2026-08-14) — the migration is a provable
  no-op shipping the mechanism (wp8:7-19).

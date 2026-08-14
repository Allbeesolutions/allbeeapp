# ALLBEE APN — Permanent Development Rules

Binding rules for any future work on the APN module. These are consequences of the deployed
architecture (release `435b00c`), not suggestions. See `APN_SOURCE_OF_TRUTH.md` for the
ownership matrix these rules protect.

---

### 1. Never bypass the rule engine

All commission rates, tiers, and caps resolve through `apn_resolve_commission_rate`
(`pr-apn-rule-engine-foundation.sql:210-263`) / `apn_commission_rate_for` (wp3:95-108), and
every ledger write passes through `apn_ledger_entry_owner` (wp9:64-140). A new code path that
computes or inserts a commission outside these functions creates a parallel truth and will be
reversed by the next audit.

### 2. Never manually increment wallets

`apn_consolidated_wallets`, `apn_withdrawal_wallets`, and `apn_referral_wallets` are
**derived projections**. They are recomputed by their refresh functions
(`apn_consolidated_wallet_refresh` wp3:195-298, `apn_withdrawal_refresh_wallet` pr3:311-351,
`apn_referral_refresh_wallet` pr3:638-658) from source rows. Manual `UPDATE wallet SET x = x+1`
is rejected by guard triggers / missing grants, and if it slips through it is overwritten on
the next refresh. To change a balance, change the source (ledger events, referral earnings,
withdrawal requests).

### 3. Never duplicate commission calculation

The commission cap formula lives in exactly one place:
`crm_sync_revenue_to_apn` (`pr4-enterprise-crm.sql:411`). Client-side computation
(`src/AllbeeApp.jsx` `apnBuildCommissions`) already caused the WP6 district double-count
(`pr-apn-commission-integrity-wp6.sql:9-20`) — that surface was removed. Do not reintroduce
commission math in the frontend or in new triggers.

### 4. Never create a second source of truth

Every concept has one authoritative owner (see `APN_SOURCE_OF_TRUTH.md`). In particular:
`apn_commission_projects.partner_id` owns commission authority (never CRM columns); the
ledger owns all money events; rule sets own rates. Derived tables (wallets, AI context,
portal snapshots) must be read-only projections or refresh functions — never independent
stores that accept writes.

### 5. Never trust client-side partner IDs

No engine write path accepts a target user id. Identity comes from `auth.uid()` only
(`apn_ai_partner_scope` wp5:72-96, `apn_partner_financial_snapshot` wp7:12-15). New RPCs must
follow this pattern; parameters that could widen scope are a security defect.

### 6. Never use UI-only authorization

Database authorization is authoritative (RLS + definer gates + triggers). Hiding a button is
not access control. New tables must have RLS with explicit select/write policies; new write
functions must have an explicit role gate as the first statement.

### 7. Never silently rewrite historical financial ownership

Once revenue exists on a project, `apn_commission_projects.partner_id` is immutable
(WP10 guard, `pr-apn-crm-assignments-wp10.sql:100-112`). Ledger originals are never edited or
deleted; corrections are additive reversal events. Reassignment of CRM leads after money
exists changes routing only — never the entitlement.

### 8. Never bypass reversal mechanisms

Reversals go through `apn_commission_reverse_project` (engine, wp3:522-758) or
`apn_commission_reverse_legacy` (legacy blob, wp6:32-104). Deleting a collection, project, or
ledger row instead of reversing it breaks the immutable-history contract, the `Reversed`
exclusions in wallet totals (wp6:114-175), and the recovery machinery (wp3:592-633).

### 9. Never bypass freeze

`apn_guard_operational()` (foundation:86-99) must be the first line of any new financial write
path. Freeze must mean: no new ledger money (hard-abort for direct calls, audited deferral for
trigger paths). A write path that skips the guard silently mints money during an emergency
freeze.

### 10. Never bypass finance locks

`transactions`/`withdrawals` are protected by finance-lock triggers and `can_finance()` RLS
(hardening:162-179, 386-397). Commission expenses are a finance-role action
(`apn_ensure_finance_expense`, wp3:461-519) and are deliberately **never auto-posted** from
ledger events (wp9:24-27). New code must not auto-create finance rows on engine events, and
must not weaken the `can_finance()` gate.

### 11. Never weaken RLS

The engine's grant/policy matrix (Security Model §2) is the deployed security boundary.
Changes that add write grants to engine tables, relax policies to `using (true)` for writes,
or grant EXECUTE to `anon`/`public` are release-blocking defects.

### 12. Never expose cross-partner AI data

`apn_ai_build_context` (wp5:141-374) may only return the caller's own rows plus shared rule
knowledge and the freeze flag. No function may accept a user id for AI context; the edge
function (`functions/apn-ai/index.ts`) may only call `apn_ai_usage_tick` and
`apn_ai_build_context`.

### 13. Never add a new commission path without idempotency

Every ledger write needs a deterministic `idempotency_key` backed by a UNIQUE constraint or
`on conflict` (patterns: `col:<id>:<type>`, `earn:<id>`, `rev:<id>`, `rec:led:<id>`,
`legacy:<id>`). A replayable write is a correctness requirement, not an optimization.

### 14. Never modify production financial functions without regression verification

Changes to ledger, wallet, reversal, withdrawal, referral, or finance functions require the
savepoint-based zero-residue verify pattern (`*-verify.sql`): `begin` + savepoint, fixture
work, rollback to savepoint, post-rollback residue proof, then commit. Run the affected WP
verify suites before and after the change.

### 15. Always add zero-residue verification for financial changes

The verification must prove: (a) the new behavior, (b) zero residue after rollback,
(c) restoration of any temporary auth helpers, (d) no impact on existing assertions (the
previous WP suites still pass). See `pr-apn-crm-assignments-wp10-verify.sql:404-461` for the
canonical proof block.

### 16. Always inspect existing triggers before adding new ones

`apn_revenue_collections` alone fires four AFTER triggers (ledger, referral, withdrawal wallet,
consolidated wallet refresh). A new trigger on a source table runs inside every write path and
can double-book or double-defer. Before adding one, map the existing trigger set (Security
Model §8 / Source-of-Truth matrix) and confirm the new logic is idempotent.

---

### Checklist before merging any APN change

- [ ] Touches only one authoritative owner (no second source of truth)?
- [ ] All new writes are role-gated SECURITY DEFINER with `set search_path = pg_catalog, public, pg_temp`?
- [ ] RLS enabled with explicit policies; grants revoked from anon/public?
- [ ] Freeze guard present on financial write paths?
- [ ] Idempotency key + unique constraint or `on conflict`?
- [ ] No manual wallet/ledger/transaction writes anywhere (including verification fixtures, which must be savepoint-rolled-back)?
- [ ] Reversal used for corrections, never deletion?
- [ ] Verify suite follows the zero-residue pattern and passes?
- [ ] Auth identity from `auth.uid()`, never a caller-supplied id?

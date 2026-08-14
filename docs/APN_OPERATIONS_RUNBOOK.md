# ALLBEE APN — Operations & Incident Runbook

Operational procedures for the deployed APN engine (release `435b00c`). Each procedure lists
what to inspect, the authoritative tables/functions, what **never** to edit manually, and when
admin vs superadmin intervention is required.

> **Do not "fix" derived numbers.** Wallets and portals are projections of the ledger/source
> rows. When a number is wrong, find the source row; never write the wallet, ledger, or
> `transactions` tables by hand.

Conventions: all SQL in this document is **read-only** unless explicitly marked as a fix
procedure. Destructive SQL is never provided except where a designed superadmin action exists.

---

## 1. Emergency freeze

**What it does:** stops all engine money movement immediately (collections still land; ledger
money is not minted; deferrals are audited).

**Inspect**
- `select frozen, frozen_at, frozen_by, reason from public.apn_system_controls where id = 1;`
- Deferrals during the freeze:
  `select entity_id, metadata->>'error', created_at from public.apn_rule_audit where action = 'ledger record deferred' order by created_at desc limit 20;`

**Action (superadmin only)**
```sql
update public.apn_system_controls
   set frozen = true, frozen_by = current_user, reason = '<incident reference>'
 where id = 1;
```

**Do NOT edit manually:** `apn_commission_ledger`, wallet tables, `transactions`. Freeze
**does not roll back** anything already committed.

**When superadmin:** any toggle (RLS + `apn_system_controls_guard` enforce this; a non-superadmin
attempt raises `Only Super Admin may change APN system controls.`).

---

## 2. Investigating incorrect commission (amount or percent wrong)

**Inspect**
- `select * from public.apn_commission_ledger where idempotency_key like 'col:%' and partner_id = '<id>' order by event_at desc;`
- The owning project: `select * from public.apn_commission_projects where id = '<project_id>';`
  → check `commission_rate`, `maximum_commission`, `total_received`, `total_commission_paid`.
- The collection: `select * from public.apn_revenue_collections where id = '<collection_id>';`
  → `commission_generated` (capped by pr4:411).
- The rule that applied: `select * from public.apn_rule_sets rs join public.apn_commission_rules r on r.rule_set_id = rs.id where rs.status='active' and r.commission_type = 'partner';` and the legacy fallback rate (`apn_commission_rate_for_project`, `pr-ux-3-production.sql:7-44`) when no rule set exists.
- Snapshot on the ledger row: `snapshot` jsonb (carries project/client/legacy facts).

**Authoritative:** `apn_commission_ledger` (events), `apn_commission_projects` (rate/authority),
`apn_revenue_collections.commission_generated` (cap), `apn_rule_sets`/`apn_commission_rules`.

**Do NOT edit manually:** ledger, collections, projects, wallets.

**Fix paths (designed):** correct the *source* (rule set via `apn_rule_set_publish`, or project
rate via `upsert_apn_commission_project`) then, if money was mis-minted, use the designed
reversal (`apn_commission_reverse_project` for engine rows — see section 4) and re-record the
corrected collection through the normal chain.

**Admin intervention:** yes (reversal/publish are admin-gated). **Superadmin:** only if the
incident needs a freeze first.

---

## 3. Investigating missing commission

**Inspect**
- Collection exists? `select * from public.apn_revenue_collections where id like 'crm-revenue-%' order by created_at desc limit 10;`
- Deferral audits (freeze or other exception):
  `select entity_id, metadata->>'error', metadata->>'sourceId' from public.apn_rule_audit where action = 'ledger record deferred' order by created_at desc limit 20;`
- Ledger rows for the collection: `select * from public.apn_commission_ledger where source_id like 'crm-revenue-%' order by event_at desc limit 20;`
- Wallet consistency: `select * from public.apn_consolidated_wallets where partner_id = '<id>';`

**Common causes**
- Project has no partner (conversion without assignment) → no APN project, no commission
  (by design, pr4:362-363).
- `crm_revenue_collections` exists but the sync skipped it (`apn_project_id` null).
- Freeze was on at collection time → deferred (section 1).
- Rate exceeded `max_percent` → the event never minted (defers only in trigger path;
  direct calls raise `check_violation`).
- Cap exceeded (15%/35%, or `maximum_commission`).

**Do NOT edit manually:** do not insert ledger or wallet rows. Re-run the source change
(record revenue again) or fix the rule set.

**Admin intervention:** yes. **Superadmin:** only for freeze-related incidents.

---

## 4. Investigating reversed commission

**Inspect**
- `select * from public.apn_commission_ledger where source_id = '<collection_id>' or original_event_id is not null and partner_id = '<id>';` — look for `rev:*`/`rec:*` counter-entries and `reversed_by` markers.
- `select * from public.apn_commission_ledger where commission_type in ('reversal','recovery') and partner_id = '<id>' order by event_at desc;`
- Reversal history: `select * from public.apn_reversal_history('<project_id>');`
- Legacy surface: `select id, data->>'status', data->>'reversedBy', data->>'reversalReason' from public.apn_commissions where data->>'status' = 'Reversed';`
- Collection/project status: `select id, commission_status from public.apn_revenue_collections where id='<id>'; select id, status from public.apn_commission_projects where id='<id>';`

**Behavior contract:** originals are never deleted; reversal is additive (`rev:led:*`,
`original_event_id`); recovery `rec:led:*` books only against the paid pool (FIFO); wallets
exclude `Reversed` from every bucket (wp6).

**Do NOT edit manually:** never flip a collection back to `Payable`/`Paid` by hand, never
delete `rev:*` rows.

**Admin intervention:** reversals are admin/finance actions. **Superadmin:** paid legacy
reversals require the unlock (`apn_commission_reverse_legacy('<id>','reason', true)`).

---

## 5. Investigating wallet mismatch (consolidated vs source)

**Inspect**
- Ledger truth: `select commission_type, sum(amount) from public.apn_commission_ledger where partner_id='<id>' and amount > 0 group by 1;`
- The derived row: `select * from public.apn_consolidated_wallets where partner_id = '<id>';`
- Outstanding/recovery: `select partner_id, recovery_outstanding, recovery_recovered, recovery_remaining from public.apn_consolidated_wallets where partner_id='<id>';`
- Reservations (in-flight requests): `select sum(requested_amount) from public.apn_withdrawal_requests where partner_id='<id>' and status in ('pending','under_review','approved','processing','paid');`

**The fix that is allowed (engine path, not a manual write):**
```sql
select public.apn_consolidated_wallet_refresh('<partner_id>');
```

**Do NOT edit manually:** `UPDATE apn_consolidated_wallets SET ...` is rejected by the guard
trigger and forbidden by design. If refresh does not converge, the mismatch is in the source
(ledger rows, referral earnings, withdrawal requests) — investigate those.

**Admin intervention:** yes. **Superadmin:** only if a freeze is needed during triage.

---

## 6. Investigating withdrawal mismatch

**Inspect**
- `select * from public.apn_withdrawal_wallets where partner_id='<id>';`
- Source totals: `select * from public.apn_withdrawal_source_totals('<id>', 'commission');` (and `'referral'`, `'incentive'`).
- Requests & history: `select * from public.apn_withdrawal_requests where partner_id='<id>' order by created_at desc;`
  `select * from public.apn_withdrawal_status_history where ... order by created_at;`
- Wallet transactions journal: `select * from public.apn_wallet_transactions where ... order by created_at;`
- Failed-payment releases: look for `entry_type='release'` after `status='failed'`
  (`apn_mark_withdrawal_failed`, wp3:830-871) — a failed payment returns the amount to
  `withdrawable` automatically.

**The fix that is allowed:**
```sql
select public.apn_withdrawal_refresh_wallet('<partner_id>');
```

**Do NOT edit manually:** `apn_withdrawal_wallets`, `apn_withdrawal_requests` state, or the
immutable history tables (guard triggers reject mutations; pr3:401-412).

**Admin intervention:** review actions. **Superadmin:** unlock/reopen only (pr3:567-594);
`failed` marking is an admin/finance action (`apn_withdrawal_can_manage`, wp3:839-841).

---

## 7. Investigating referral mismatch

**Inspect**
- Relationship: `select * from public.apn_referral_relationships where referred_id='<id>' or referrer_id='<id>';`
- Earnings: `select * from public.apn_referral_earnings where referrer_id='<id>' order by created_at desc;` (check `status`, `referral_amount`, `snapshot`)
- Settings: `select * from public.apn_referral_settings where id = 1;`
- Self-earning path: `apn_engine_record_partner_earning` applies `default_percent` when none
  given and **skips partners with an active linked referrer** (wp2:91-98) — that skip is by design.
- Referral wallet: `select * from public.apn_referral_wallets where partner_id='<id>';` then refresh: `select public.apn_referral_refresh_wallet('<id>');`
- Ledger linkage: `select * from public.apn_commission_ledger where idempotency_key like 'earn:%';`

**Do NOT edit manually:** referral earnings, wallets, relationships.

**Admin intervention:** to disable a relationship (`status='disabled'`). **Superadmin:** not normally required.

---

## 8. Investigating district/state commission

**Inspect**
- Hierarchy: `select * from public.apn_hierarchy_assignments where partner_id='<id>';`
- Ledger events: `select * from public.apn_commission_ledger where commission_type in ('district','state') and partner_id='<head-id>' order by event_at desc;`
- Rate applied: `apn_commission_rate_for('district')` / `('state')` (wp3:95-108).
- The client-side `kind='district'` rows were removed in WP6 — if `apn_commissions` contains
  district rows today, they are stale legacy and the engine does not read them for heads.

**Do NOT edit manually:** hierarchy rows outside the admin path (RLS+guard enforce roles);
never hand-mint district/state ledger entries.

**Admin intervention:** hierarchy maintenance (admin-only inserts/updates). **Superadmin:** role
fixes on `apn_users`.

---

## 9. Investigating CRM assignment dispute

**Inspect**
- Lead: `select * from public.crm_leads where id='<lead-id>';` (assignment columns)
- History: `select * from public.crm_lead_assignments where lead_id='<lead-id>' order by created_at;`
- Audit: `select * from public.crm_audit where lead_id='<lead-id>' and action='lead_assigned' order by created_at;`
- APN ownership: `select id, partner_id, status, total_received from public.apn_commission_projects where id like 'crm-%' or id like 'proposal-%';`
- WP10 guard evidence: `select * from public.apn_rule_audit where action = 'commission project partner reassigned (pre-revenue)';`

**Behavior contract:** revenue locks entitlement; post-revenue lead reassignment changes
routing only; the APN project partner is the single authority (wp10:5-17).

**Do NOT edit manually:** `apn_commission_projects.partner_id` (guard enforces: `check_violation`
once collections exist), `crm_leads` assignment columns.

**Admin intervention:** reassignment via `crm_assign_lead` / `upsert_apn_commission_project`
(pre-revenue). **Superadmin:** not normally required.

---

## 10. Investigating support ticket

**Inspect**
- `select * from public.apn_support_tickets where ticket_no='APN-TK-...' or partner_id='<id>' order by created_at desc;`
- Audit trail: `select * from public.apn_rule_audit where entity='apn_support_tickets' and entity_id='<ticket-id>' order by created_at;`
- AI context used for the answer (read-only): the ticket's `ai_summary`, `relevant_ids`, `rule_version`.

**Action:** respond via `apn_support_tickets_respond` (admin) or `apn_support_tickets_status`.
Only superadmin can set `resolved`/`closed` (wp5:521-524,571-574).

**Do NOT edit manually:** direct UPDATEs are blocked by the `apn.support.write` guard trigger
(wp5:603-617).

**Admin intervention:** responses/status. **Superadmin:** resolve/close, or reopening.

---

## 11. ALLBEE AI uncertainty / escalation

**Inspect**
- The response envelope: `{ text, uncertain, ruleVersion, relevantIds }` from `apn-ai`
  (functions/apn-ai/index.ts:216-221). `uncertain:true` means the model hit the
  `<ALLBEE_UNCERTAIN>` block — the answer must not be treated as fact.
- Usage/abuse: `select * from public.apn_ai_usage where user_id='<id>' order by window_start desc;` (RL001 cap, 60/hr).
- The context the AI saw: re-run `select * from public.apn_ai_build_context('<question>')` — scoped to the caller.

**Do NOT edit manually:** AI context tables (read-only projections); do not inject answers into
tickets/ledger.

**Admin intervention:** none required for AI itself. **Superadmin:** only for abuse (nothing to
unblock server-side — the cap is enforced in SQL).

---

## 12. Finance reconciliation

**Inspect (read-only RPC, designed for this):**
```sql
select * from public.get_apn_commission_state('<partner_id>', '<project_name>', '<client_name>', '<project_id>');
```
- Compares project, collections, finance income, finance expense, and flags **orphan finance**
  rows (`apnProjectId` no longer existing) — `pr-finance-apn-commission-reconcile.sql:405-475`.
- Income rows: `select id, data from public.transactions where data->>'apnProjectId' = '<project_id>' or id like 'crm-finance-%';`
- Expense map: `select * from public.apn_finance_expense_map where ledger_id in (select id from public.apn_commission_ledger where source_id like '%...');`
- The reconcile marker query (reconcile:502-506) expects **no orphan finance rows**.

**Fix path (designed):** `create_apn_income_transaction(..., 'edit')` for existing income
(edit-convert:146-177), `'convert'` for normal→APN, `'create'` for new. Never hand-edit
`transactions` (finance-lock triggers reject it).

**Admin intervention:** finance role (accountant/admin). **Superadmin:** only for freeze.

---

## 13. Legacy backfill

**Inspect (dry run is the safe default):**
```sql
select * from public.apn_backfill_legacy_commissions(true);  -- dry-run, returns candidates + defers
```
- Checks: legacy dataset is currently empty (0 rows verified); expect `{dryRun:true, scanned:0,
  candidates:0, ...}`.
- Real run: `select * from public.apn_backfill_legacy_commissions(false);` — idempotent
  (`legacy:<id>` keys), stamps `migratedLedgerId`, defers instead of aborting (wp8:54-219).

**Do NOT edit manually:** never insert `legacy:` ledger rows by hand; never set
`migratedLedgerId` manually.

**Admin/finance intervention:** the RPC is gated to admin/finance/superadmin. **Superadmin:**
only if a freeze-first is required.

---

## 14. Safe production verification

**Pattern used by every WP verify suite (`*-verify.sql`):**
1. `begin;` + `savepoint` — everything inside is rolled back at the end; **no fixture ever
   commits**.
2. Temporary auth stubs mirror production gates only for the verify session, then the savepoint
   rollback restores the real helpers; final `commit` persists **zero** fixture residue.
3. Assertions via `vf_assert`; any failure aborts the transaction (nothing commits).
4. Post-rollback proof block checks zero residue + helper restoration (e.g.
   `pr-apn-crm-assignments-wp10-verify.sql:404-461`).

**Run the current suites (read-only semantics, rollback-safe):**
- `supabase/pr-apn-rule-engine-foundation-verify.sql`
- `supabase/pr-apn-rule-engine-wp2-verify.sql` / `wp3-verify` / `wp6-verify` / `wp9-verify` /
  `pr-apn-commission-integrity-wp6-verify.sql`
- `supabase/pr-apn-legacy-backfill-wp8-verify.sql`
- `supabase/pr-apn-crm-assignments-wp10-verify.sql`

**Do NOT:** run ad-hoc UPDATEs "to test"; never point a verify at a non-sandbox environment
without the savepoint structure.

---

## 15. Rollback / incident handling

**Because the engine is append-only and idempotency-keyed, "rollback" means:**
1. **Freeze first** (superadmin, section 1) to stop further money movement.
2. **Identify the erroneous rows** by idempotency key / source id (read-only queries above).
3. **Reverse, don't delete:** engine rows → `apn_commission_reverse_project('<project_id>', '<reason>')`; legacy blob rows → `apn_commission_reverse_legacy('<id>', '<reason>', <unlock_paid>?)`; withdrawal rows → designed state machine only.
4. **Re-record** the corrected event through the normal chain so the ledger history shows the
   truth: original event + reversal + corrected event.
5. **Verify convergence:** refresh the affected wallets (sections 5-7) and re-run the read-only
   reconciliation (section 12).

**Do NOT:** delete ledger/wallet/transaction rows; do not `UPDATE` statuses by hand; do not
create "adjustment" ledger rows manually — the only designed adjustment path is the WP8
backfill RPC.

**Superadmin intervention:** freeze, paid reversals, wallet unlock/reopen, ticket resolve/close.
Everything else is admin/finance.

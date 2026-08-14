# ALLBEE APN — Security Model

The APN engine's security model as deployed (release `435b00c`).

**Foundational rule:**

> **UI restrictions are not security boundaries. Database authorization is authoritative.**
> The SPA only renders what the DB lets the caller read; every financial write is enforced
> server-side by RLS, SECURITY DEFINER function gates, triggers, and checks — never by
> hiding a button.

## 1. Role helpers (schema.sql)

| Helper | Body | Meaning |
|---|---|---|
| `is_superadmin()` | schema.sql:109-112 | active profile role `superadmin` |
| `is_admin()` | schema.sql:115-118 | active role in (`superadmin`,`admin`) — "management level" |
| `can_finance()` | schema.sql:121-124 | active role in (`superadmin`,`accountant`) — "may touch money" |
| `can_module(text)` | schema.sql:128-136 | admin roles, or `staff` with the module key in `perms->'modules'` |
| `current_name()` | schema.sql:138-141 | display name |

All `security definer stable`, `set search_path = public`. `profiles_role_check`
(schema.sql:65-66) constrains role strings; `profiles_status_check` (schema.sql:68-69)
constrains status.

APN-specific helper: `apn_withdrawal_can_manage() = is_admin() or can_finance()`
(`apn-withdrawal-settlement-engine-pr3.sql:166-169`); `crm_can_manage()` (pr4:237-240) =
`is_admin()` or active **staff/accountant/intern/district_head/state_head** — the `partner`
role is explicitly **excluded** (wp10:18).

## 2. RLS posture on engine tables

| Table | RLS | Select policy | Write path | Writes by |
|---|---|---|---|---|
| `apn_commission_ledger` | foundation:459 | self / own heads / admin / superadmin (foundation:463-473) | none via grants | SECURITY DEFINER engine functions only (foundation:460-461) |
| `apn_rule_sets` / `apn_commission_rules` | foundation:171-172 | `using (true)` read-only | none via grants | `apn_rule_set_publish` (foundation:265-341) |
| `apn_hierarchy_assignments` | foundation:355 | admin or self (foundation:360-366) | insert/update RLS `with check (is_admin())` + trigger re-check (foundation:368-383) | admins (+ trigger role/self-head validation) |
| `apn_rule_audit` | foundation:112 | **no grants** | **no grants** | `apn_rule_audit()` definer only (foundation:115-138) |
| `apn_system_controls` | foundation:49 (enable RLS) | `using (true)` (foundation:54-56) | update `with check (is_superadmin())` + guard trigger (foundation:59-79) | superadmin |
| `apn_consolidated_wallets` | wp3:171 | read own or `apn_withdrawal_can_manage` (wp3:175-178) | none + guard trigger (wp3:172-173,190-193) | `apn_consolidated_wallet_refresh` only |
| `apn_withdrawal_wallets` | pr3:673-677 | own or `apn_withdrawal_can_manage` (pr3:681-682) | select-only, anon revoked (pr3:700-701) | `apn_withdrawal_refresh_wallet` only |
| `apn_referral_wallets` | pr2:510-514 | own or admin (pr2:526-527) | select-only (pr2:539-540) | `apn_referral_refresh_wallet` only |
| `apn_finance_expense_map` | foundation:571 | superadmin/admin/can_finance (foundation:575-578) | select-only | `apn_ensure_finance_expense` only |
| `apn_reversals` | foundation:644-654 | admin or owner of original (foundation:660-667) | select-only | reversal engine functions |
| `apn_migrations` | foundation:754 | `using (true)` | select-only | `apn_migration_mark` (foundation:782-813) |
| `apn_support_tickets` | wp5:49-52 | own rows or admin/superadmin | RPC-only; guard trigger (wp5:603-617) | ticket RPCs |
| `apn_commission_projects` / `apn_revenue_collections` | v4:195-210 | admin or `partner_id = auth.uid()` | write = admin, delete = superadmin (v4 policies) | RPCs / engine triggers |
| `transactions` / `withdrawals` (finance blob) | hardened `_allbee_table` | `can_finance()` (hardening:162-179) | finance-lock triggers (hardening:386-397) | finance RPCs |
| `apn_users` (JSON blob) | apn-partner-management/wp4 policies | admin; heads on district members (wp4:278-282); partner self | guard triggers (wp4:257-259, 283-299) | guarded lifecycle writes |

## 3. SECURITY DEFINER usage

Every write surface is a SECURITY DEFINER function with:

- **Role gate first** (e.g. `apn_ledger_entry`: `is_admin() or can_module('apn')`, wp9:158-160;
  `upsert_apn_commission_project`: `can_finance() or is_admin()`, wp10:88; reversal legacy:
  admin/finance with superadmin unlock for paid, wp6:47-63; ticket `resolved/closed`:
  superadmin only, wp5:521-524,571-574).
- **Hardened `search_path`**: `set search_path = pg_catalog, public, pg_temp` — applied to all
  144 definers by phase-2 hardening M1 (hardening:275-289) and baked into every later engine
  function.
- **Freeze guard** where money moves: `apn_guard_operational()` first line of the owner path
  (wp9:86), publish (foundation:284), hierarchy (foundation:380), reversal (foundation:680),
  backfill (wp8:85), self-earning (wp2:74-77).
- **No dynamic SQL**, no `EXECUTE` of user input, no `set role` toggling
  (explicitly part of the WP1 contract, foundation header; M2 hardening note).
- **Grants hygiene**: `revoke all … from public, anon, authenticated` then
  `grant … to authenticated` on engine functions — hardening:94-140 shows the revoke side;
  the paired grants live in the defining files (e.g. foundation:555-556, wp9:167,
  reconcile:331, 399, 478); `revoke truncate, trigger on all tables from anon, authenticated`
  (hardening:147-148); `_allbee_table`/`_allbee_realtime` EXECUTE revoked from authenticated
  (hardening:159-160, C2).

## 4. auth.uid() ownership

- **No engine write path accepts a target user id.** Identity comes from `auth.uid()`:
  - `apn_request_withdrawal` (pr3:444-476), `apn_cancel_withdrawal`, bank-account upsert
    (pr3:414-442), zone requests (wp4:122-194), support tickets (wp5:385-594).
  - Read RPCs are scoped by construction: `apn_partner_financial_snapshot()` has **no
    partner parameter** (wp7:12-15), `apn_ai_build_context()` never accepts a user id
    (wp5:4-7), `apn_ai_partner_scope()` derives identity from `auth.uid()` only (wp5:72-96).
- Ledger rows record `created_by = auth.uid()::text` (wp9:132); audit rows carry `actor_id`.
- The verify suites prove non-admin denial end-to-end (e.g. WP10 verify T2: a non-admin cannot
  assign leads, create leads, or post revenue — `insufficient_privilege`).

## 5. Partner isolation

- Partners read only their own financial rows: ledger RLS self-predicate (foundation:463-473),
  wallet RLS self-predicate (wp3:175-178, pr3:681-682, pr2:526-527), support tickets own-rows
  (wp5:49-52), AI context own-data-only (wp5:141-145).
- Partners can never write money state: no write grants on ledger/wallets/rule tables; the
  only partner-initiated writes are withdrawal requests, bank accounts, zone requests, and
  support tickets — all RPCs that auth.uid()-scope and validate.
- `crm_can_manage()` excludes `partner` (wp10:18) so a partner cannot record CRM revenue
  (H3 hardening, hardening:236-261).
- `apn_users_guard` (wp4:205-256): partners cannot modify their own identity/rank/financial
  keys; self-registration is forced to `role='partner'`, `status='pending'`, and financial
  fields are stripped (wp4:217-225).

## 6. Admin privileges

- `is_admin()` (superadmin or admin): CRM assignment/conversion (pr4:308,353), rule-set
  publish (foundation gate), hierarchy writes (foundation:368-383), partner lifecycle except
  `banned` (wp4:245-254), ledger direct entry via `apn_ledger_entry` (wp9:158-160),
  withdrawal review pipeline + marking payments failed (`apn_withdrawal_can_manage`; pr3:166-169,
  wp3:839-841), legacy reversal (wp6:47-49), backfill (wp8:81-84), finance expense
  (`apn_ensure_finance_expense`, wp3:473).
- Admins **cannot** toggle freeze, ban partners, unlock paid reversals, reopen withdrawals,
  or resolve/close tickets — those are superadmin-only.

## 7. Superadmin privileges

- Emergency freeze toggle (foundation:59-79).
- `banned` partner status (wp4:251-253).
- Paid legacy reversal unlock (`apn_commission_reverse_legacy(p_unlock_paid=true)`, wp6:58-63).
- `apn_unlock_withdrawal_wallet` / `apn_reopen_withdrawal` (pr3:567-594).
- Ticket `resolved`/`closed` (wp5:521-524,571-574).
- Migration marker resolution (`apn_migration_mark`, foundation:782-813).
- Unrestricted writes to `apn_users` (guard bypass, wp4:209).

## 8. District / state boundaries

- A district/state head reads the ledger rows of **partners underneath them** via
  `apn_commission_ledger_read` (foundation:463-473) and can manage the lifecycle of
  same-district members via `apn_users_head_update` + `apn_is_district_head_of()`
  (wp4:268-299) — but a head can never write ledger, wallets, or rules, and heads cannot
  be assigned as regular partners (`apn_hierarchy_guard`, foundation:377-414).
- CRM read scope (`crm_can_read`, pr4:242-249) is assignment-based; CRM **write** scope is
  `crm_can_manage()` (admin/staff/...) — heads may read their territory, never mint money
  unless they also hold a management role.

## 9. AI isolation

- `apn-ai` edge function: platform `verify_jwt=true` **plus** in-function JWKS verification;
  `role='authenticated'` required (rejects anon keys); partner identity from the verified JWT
  only; the function may call exactly two RPCs — `apn_ai_usage_tick` and
  `apn_ai_build_context` (functions/apn-ai/index.ts:8-21,167,180). No arbitrary queries.
- `apn_ai_build_context` builds context exclusively from the caller's own rows
  (wp5:141-374) — never other partners' financial data, never service-role material, never
  admin data; the question text is capped (500 chars) and never used in WHERE clauses
  (wp5:169).
- Server-side rate cap: `apn_ai_usage_tick` (wp5:102-135), 60/hour per user, errcode RL001.
- `ai-chat` (general assistant): no service-role key; PII masked in the browser before the
  snapshot is sent (`src/AllbeeApp.jsx:703-719`).

## 10. Support-ticket isolation

- RLS: partner sees own tickets; admin/superadmin see all (wp5:49-52).
- Direct writes blocked by the `apn.support.write` GUC guard trigger (wp5:603-617) — only the
  RPCs write. `client_key` partial-unique idempotency prevents duplicate submissions
  (wp5:40-42). Responses are role-segregated (`admin_response` vs `superadmin_response`);
  `resolved`/`closed` transitions are superadmin-only (wp5:521-524,571-574). All actions audited
  in `apn_rule_audit`.

## 11. CRM assignment protection

- `crm_assign_lead` is `is_admin()` only (pr4:308); `crm_convert_quotation` is `is_admin()`
  only (pr4:353). No partner can self-assign or cross-assign (WP10 verify T2).
- Ownership of commission flows from `apn_commission_projects.partner_id`, never from
  client-supplied values: the revenue sync stamps `partner_id` from the APN project
  (pr4:414); WP10 refuses partner changes on projects with revenue (wp10:100-107) with a
  race-safe upsert backstop (wp10:109-112).
- Assignment history (`crm_lead_assignments`) is append-only; duplicates never create money
  (WP10 verify T4).

## 12. Financial mutation boundaries

| Kind of mutation | Legal path | Boundary |
|---|---|---|
| Ledger insert | `apn_ledger_entry_owner` (wp9:64-140) | definer; freeze; caps; idempotency; admin gate on the wrapper |
| Ledger edit/delete | **impossible** | no grants (foundation:460-461) |
| Consolidated wallet | `apn_consolidated_wallet_refresh` | definer; guard trigger; no grants |
| Withdrawal wallet | `apn_withdrawal_refresh_wallet` | definer; select-only RLS |
| Referral wallet | `apn_referral_refresh_wallet` | definer; select-only RLS |
| Withdrawal state machine | `apn_withdrawal_review` and wrappers | `apn_withdrawal_can_manage`; immutable history tables |
| Reversal (engine) | `apn_commission_reverse_project` | admin/finance; freeze; paid pool recovery |
| Reversal (legacy) | `apn_commission_reverse_legacy` | admin/finance; superadmin unlock for paid |
| Freeze toggle | `UPDATE apn_system_controls` | superadmin RLS + guard trigger |
| Finance income/expense | CRM sync (income), `apn_ensure_finance_expense`, `create_apn_income_transaction` | `can_finance()` RLS + finance-lock triggers; deterministic ids |
| Commission rules | `apn_rule_set_publish` | admin; freeze; active-set supersede-only |
| Project partner | `upsert_apn_commission_project` | `can_finance() or is_admin()`; revenue-lock |
| Partner status | `apn_users` guarded write | guard trigger; `banned` superadmin |

## 13. Defense-in-depth notes (verified, not assumed)

- The phase-2 hardening batch (commit `42c2feb`) verified the EXECUTE surface — anon = 39,
  authenticated = 153 (155 minus the two C2 targets), service_role = 155 — and executed the
  listed fixes (hardening:401-438): `_allbee_table` injection surface, audit INSERT policy,
  `purge_recycle` authz, `class_students` RLS, finance-lock triggers on UPDATE/DELETE.
- WP10 verify T1 asserts the defenser+search_path+grant surface of
  `upsert_apn_commission_project` from the catalog (pr-apn-crm-assignments-wp10-verify.sql:
  150-162).
- Post-closeout production checks confirm zero residue and the committed state (functions
  present, marker `engine.crm-assignments = completed/wp10`, `frozen=false`).
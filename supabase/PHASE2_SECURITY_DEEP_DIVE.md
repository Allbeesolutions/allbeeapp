# Phase 2-C — PostgreSQL RBAC / Trigger / Security-Definer Deep Dive

**Status:** READ-ONLY audit complete. No production changes were made during this deep dive. Every claim below was verified live against production (`ogacjpwlbhmonycjevml`) with read-only queries.

**Scope inspected**
- 155 public-schema functions (144 SECURITY DEFINER / 11 SECURITY INVOKER) + platform schemas (realtime, cron, vault, extensions, pgbouncer, graphql_public) = 239 total
- 165 public-schema relations (all RLS enabled; 0 forced)
- 275 RLS policies across 168 tables
- 35 triggers (29 app-owned, 6 platform-owned)
- 15 roles + full role-membership graph
- Function/table ACLs, owners, search_path (`proconfig`), language, volatility
- All function bodies (dynamic SQL, DDL, row_security toggles, audit writes, auth writes)
- 6 event triggers (all platform-internal: pgrst, pg_graphql, pg_cron, pg_net)

---

## 1. Executive summary

The application's authorization model is unusually strong for a Supabase JSON-blob app: write paths are almost exclusively funneled through audited, internally-gated SECURITY DEFINER RPCs, RLS policies are carefully role-scoped, financial tables are protected by period locks and immutable-ledger triggers, and Phase 2-B already removed 110 functions from the anonymous surface.

The remaining issues are latent rather than actively exploitable through the deployed PostgREST surface, with two exceptions that matter now:

1. **TRUNCATE + TRIGGER privileges are granted to `anon` (143 tables) and `authenticated` (165 tables).** RLS does **not** cover TRUNCATE or trigger DDL. No client code uses either privilege. This removes the last line of defense against full-database destruction and trigger planting if any SQL-capable path (webhook, edge function, future PostgREST capability, leaked connection string) ever appears.
2. **`audit` INSERT policy allows any authenticated user to forge audit records** (`with check (true)`). The audit trail — the compliance record everything else writes to — can be polluted by any signed-in user.

Plus a batch of hardening items (schema-helper SQL-fragment injection surface, `purge_recycle` with no authorization, read-scope CRM authorization that can enter the finance chain, `search_path=public` on all definers, an INVOKER commission writer, and a legacy table with unrestricted CRUD).

**Recommendation:** apply one controlled SQL batch (Section 14) after owner review (Section 16), then leave the application code unchanged (Section 15 contains no required changes).

---

## 2. SECURITY DEFINER findings

Inventory: **144 of 155 public functions are SECURITY DEFINER**; owners all `postgres`. Search path: all 144 use `SET search_path=public` (verified in `proconfig`); none use the hardened `SET search_path=''`. No definer function writes to `auth.*`, creates/deletes users, or uses `auth.admin.*`.

| Class | Count | Notes |
|---|---|---|
| A. SAFE | 126 | internal gates verified per-family (below) |
| B. SAFE BUT SHOULD BE HARDENED | 15 | search_path hardening, helper EXECUTE scope, audit insert policy |
| C. SECURITY ISSUE | 2 | `_allbee_table` gate interpolation + authenticated EXECUTE; `purge_recycle` no gate |
| D. INTENTIONALLY SPECIAL | 1 | `create_apn_income_transaction` (RLS-off, finance-gated, single transaction) |

### 2.1 `_allbee_table(tbl text, gate text)` — SECURITY INVOKER — C → HIGH (latent)
- Current behavior: invoker-executes `create table if not exists public.%I`, enables RLS, drops two policy names, then creates `create policy <tbl>_all ... using (<gate>) with check (<gate>)` — the `gate` parameter is interpolated **as raw SQL** into the policy expression. `%I` quoting protects `tbl`; `gate` is unvalidated.
- Exploit/impact: if any role able to execute it also has `CREATE` on schema `public` (only `postgres` does today — verified), this is a full DDL primitive plus SQL injection into policy definitions (e.g. `using (true)`). Currently dead-ended: `authenticated` holds EXECUTE but fails on the first DDL statement (verified `has_schema_privilege('authenticated','public','CREATE') = false`). Not exploitable today, but it is an authenticated-reachable schema-modification primitive and a foot-gun for future migrations.
- Evidence: body dump; ACL `{postgres=X, authenticated=X, service_role=X}`.
- Fix: revoke EXECUTE from `authenticated` (anon already revoked in 2-B); restrict to owner + `service_role`; optionally replace the `gate` parameter with a fixed expression or allowlist.
- Production change required: yes (SQL, safe).

### 2.2 `_allbee_realtime(tbl text)` — SECURITY INVOKER — C → HIGH (latent)
- Current behavior: `alter publication supabase_realtime add table public.%I` when absent from the publication. Authenticated-executable.
- Exploit/impact: publication membership is broadcast-plane only; direct harm is limited, but it is DDL the app never needs. Same hardening as `_allbee_table`.
- Fix: revoke EXECUTE from `authenticated`; keep owner/`service_role`.
- Production change required: yes (SQL, safe).

### 2.3 `purge_recycle()` — SECURITY DEFINER — C → HIGH
- Current behavior: `delete from recycle where data->>'deletedAt' < now-60d`. **No internal authorization check.** Phase 2-B removed anon EXECUTE, so today any authenticated user can call it.
- Exploit/impact: any signed-in user (staff, partner, client…) can permanently destroy recycle-bin rows older than 60 days — a soft-delete bypass causing irreversible data loss. The recycle bin is the app's only recovery mechanism.
- Evidence: body dump; ACL after 2-B `{postgres=X, authenticated=X, service_role=X}`.
- Fix: `if not public.is_admin() then raise` — or revoke authenticated EXECUTE and run under a scheduled/service context only.
- Production change required: yes (SQL, safe).

### 2.4 Finance chain (verified SAFE with documented gates)
- `create_apn_income_transaction(jsonb,jsonb,jsonb)` — **D. INTENTIONALLY SPECIAL**: `can_finance()` gate first, full validation of amounts/rates/duplicates, then `perform set_config('row_security','off',true)` — RLS-off persists only within this single transaction (it performs its own inserts in definer context). Writes commission project + collections + finance transaction + timeline + notifications + audit as one atomic unit; any trigger error aborts everything. **Do not change.**
- `apn_commission_project_sync`, `apn_revenue_collection_sync` — BEFORE-INSERT row normalizers invoked by triggers; data fields taken from the row being written; safe.
- `crm_sync_revenue_to_apn` (trigger on `crm_revenue_collections`): computes commission, writes APN collection + finance transaction + project totals + log + notify. All values derived server-side; safe — **but see H3** for the entry-point authorization.
- Withdrawal RPCs (`apn_request_withdrawal`, `apn_approve_withdrawal`, `apn_mark_withdrawal_paid`, `apn_reject_withdrawal`, `apn_reopen_withdrawal`, `apn_unlock_withdrawal_wallet`) all funnel into `apn_withdrawal_review`, which enforces `apn_withdrawal_can_manage()` (superadmin for unlock/reopen). SAFE.
- Referral chain (`apn_referral_collection_after_insert`, `apn_referral_earning_after_change`, `apn_referral_refresh_wallet`, `apn_withdrawal_refresh_from_*`): trigger-driven, amounts derived from already-guarded records, snapshot on change. SAFE.

### 2.5 Profile / identity guards (SAFE)
- `handle_new_user` (trigger on `auth.users` insert): definer, `search_path=public`, qualifies `public.` objects, delegates to `apn_registration_guard`, `on conflict do nothing`. The `admin_signup_code` mechanism (anyone registering with the matching code becomes `superadmin`) is a **business decision item** — the code sits in `app_config` and the comparison is a plain equality in the trigger body. See Section 16 (D1).
- `profiles_guard` (BEFORE UPDATE): prevents self role escalation, protects partner/district/state roles from admin edits, superadmin self-protection. SAFE.
- `apn_users_guard` (BEFORE INSERT/UPDATE): non-admin self-registration forced to `status='pending', role='partner'`, sensitive fields stripped. SAFE.
- `apn_users_apnid_immutable`, `apn_percent_limits`: integrity constraints. SAFE.

### 2.6 Trigger-function definers
- `apn_withdrawal_prevent_mutation` / `prevent_audit_mutation` — raise always; attached as BEFORE DELETE on ledger/audit tables. Append-only enforcement is trigger-based (not RLS-based) — correct for the RLS-bypass context. SAFE (also fires for `service_role`, which is fine).
- `fin_lock_guard` / `guard_fin_lock` — BEFORE INSERT (and DELETE where applicable) on `transactions` / `withdrawals`: non-superadmin blocked when the row's period exists in `fin_locks`. Period extracted from `data->>'date'` (first 7 chars = YYYY-MM). SAFE. **Caveat:** the lock applies on INSERT only — no trigger blocks in-place UPDATE of a transaction row within a locked period. RLS allows no UPDATE for non-finance roles, so the gap is finance-role only. See M4.

---

## 3. SECURITY INVOKER findings

Inventory: **11 public functions are SECURITY INVOKER**.

| Function | Gate | Verdict |
|---|---|---|
| `_allbee_table(tbl, gate)` | none (DDL) | **HIGH (latent)** — see 2.1 |
| `_allbee_realtime(tbl)` | none (DDL) | **HIGH (latent)** — see 2.2 |
| `upsert_apn_commission_project(jsonb,jsonb)` | `is_admin()` internal check; writes subject to RLS policies | **MEDIUM (M2)** |
| `web_ai_question/score/service_key/temperature` | public-by-design, read-only over knowledge tables via anon policies | SAFE (LOW) |
| `guid_tsv` | pure | SAFE |
| `username_to_email` | public login resolver | SAFE (LOW) |
| `grant_pg_graphql_access`, `grant_pg_net_access` | platform DDL-watch helpers, owned by postgres | SAFE (platform) |

Note: `web_ai_question`, `web_ai_score`, `web_ai_service_key`, `web_ai_temperature` are INVOKER and public — verified they reference **no** revoked function, and their table reads pass through anon SELECT policies on the `knowledge_*` catalog. SAFE.

### M2 — `upsert_apn_commission_project` (SECURITY INVOKER)
- Current behavior: `is_admin()` gate, then JSONB-driven inserts/updates into `apn_commission_projects` and `apn_revenue_collections` under the caller's RLS context. Works today because those tables' write policies are `is_admin()`-scoped.
- Exploit/impact: correctness depends on two RLS policies staying in sync with the RPC. If a policy drifts (e.g. a partner write policy is added for the partner portal), JSONB rows bypass the RPC's validation logic and the chain operates on raw caller data.
- Fix: convert to SECURITY DEFINER with an explicit `can_finance() OR is_admin()` gate, mirroring `create_apn_income_transaction`. Owner decision (D2) — touches stable APN behavior.
- Production change required: yes, but **deferred to owner decision** (no-op today).

---

## 4. RLS findings

Inventory: **165/165 public relations have RLS enabled; 0 forced** (`relforcerowsecurity = false` everywhere; `service_role`/`postgres`/`supabase_admin` bypass by design). 275 policies; **0 policies reference the PUBLIC role group**; 34 policies reference `anon` (all SELECT-only on `knowledge_*` catalog tables — intentional public website surface).

### Sensitive-table coverage (all verified)
- `transactions` — single policy `cmd=*` `can_finance()`. No other write path. SAFE.
- `withdrawals` — single policy `cmd=*` `can_finance()`. SAFE.
- `audit` — INSERT `with check (true)` (authenticated) + SELECT `is_admin()`. **H1.**
- `fin_locks` — SELECT `not is_client()`; ALL `is_superadmin()`. SAFE.
- `profiles` — select/self-insert/update-with-guard/admin-delete; `profiles_guard` trigger enforces role immutability. SAFE.
- `apn_*` financial tables (`apn_commission_projects`, `apn_revenue_collections`, `apn_withdrawal_*`, `apn_referral_*`) — SELECT scoped to `partner_id = auth.uid()` or admin; **write policies exist only for admin/superadmin**; requests/wallets are SELECT-only (all mutation via RPCs). SAFE.
- `apn_referral_earnings`, `apn_referral_withdrawals`, `apn_referral_codes` — SELECT-only for partner-or-admin; writes via audited RPCs/triggers. SAFE.
- `crm_*` — SELECT-only policies (owner/assignee/admin); writes only via RPCs. SAFE — **but see H3** for the RPC authorization level.
- `proposals`, `web_ai_sessions` — admin/creator/lead SELECT; writes via RPCs. SAFE.
- `recycle` — admin-or-deleter. SAFE.
- `notifications` — `is_internal()` read/update; `notif_insert` has a **self-referential with-check** (`id IN (select id from notifications)`). LOW (L3).

### M3 — `class_students` (legacy data table with unrestricted CRUD)
- Current behavior: policies `select/insert/update/delete` all `true` for `authenticated`. **108 rows** of real data. No finance/identity fields, but any signed-in user can read or modify any row.
- Impact: integrity of a legacy data set; no privilege escalation. Should be admin-scoped or removed. Owner decision (D3).

### H1 — `audit` INSERT policy
- Current behavior: `audit_insert` — `to authenticated with check (true)`.
- Exploit/impact: any authenticated user (including partners/clients) can inject arbitrary rows into the audit trail through PostgREST inserts. The audit table is the compliance record for APN/finance/CRM actions; forged rows corrupt investigations. SELECT is admin-only, so the forgery is not directly visible to the attacker, but the data is permanently in the record.
- Fix: change to `with check (is_admin())`, or drop the policy and write audit only from SECURITY DEFINER RPCs (already the case for all app flows; this policy is the only non-definer audit path).
- Production change required: yes (SQL, safe — no app flow depends on non-admin audit inserts).

### No-RLS findings
- No table has RLS off. No policy references the `public` pseudo-role. No anon policy grants writes anywhere.

---

## 5. Trigger findings

29 app-owned triggers (plus 6 platform-owned). Full inventory (timing/event/function):

| Table | Trigger | Timing/Event | Function | Verdict |
|---|---|---|---|---|
| `apn_commission_projects` | `apn_commission_project_sync_trg` | BEFORE INSERT | `apn_commission_project_sync` (DEF) | SAFE — normalizer |
| `apn_commissions` | `apn_commissions_guard_trg` | BEFORE INSERT | `apn_commissions_guard` (DEF) | SAFE — blocks suspended partners |
| `apn_referral_earnings` | `apn_referral_earning_trg` | AFTER INSERT | `apn_referral_earning_after_change` (DEF) | SAFE — snapshot+timeline+wallet |
| `apn_referral_earnings` | `apn_withdrawal_referral_wallet_trg` | AFTER INSERT | `apn_withdrawal_refresh_from_referral_earning` (DEF) | SAFE — wallet refresh |
| `apn_referral_withdrawals` | `apn_referral_withdrawal_trg` | AFTER INSERT | `apn_referral_withdrawal_after_change` (DEF) | SAFE |
| `apn_revenue_collections` | `apn_referral_collection_trg` | AFTER INSERT | `apn_referral_collection_after_insert` (DEF) | SAFE — computes referral earnings |
| `apn_revenue_collections` | `apn_revenue_collection_sync_trg` | BEFORE INSERT | `apn_revenue_collection_sync` (DEF) | SAFE — normalizer |
| `apn_revenue_collections` | `apn_withdrawal_collection_wallet_trg` | AFTER INSERT | `apn_withdrawal_refresh_from_collection` (DEF) | SAFE — wallet refresh |
| `apn_users` | `apn_referral_identity_trg` | AFTER INSERT | `apn_referral_identity_after_insert` (DEF) | SAFE |
| `apn_users` | `apn_users_apnid_immutable_trg` | BEFORE INSERT | `apn_users_apnid_immutable` (DEF) | SAFE |
| `apn_users` | `apn_users_guard_trg` | BEFORE INSERT | `apn_users_guard` (DEF) | SAFE — self-registration hardening |
| `apn_users` | `apn_users_percent_limits_trg` | BEFORE INSERT | `apn_percent_limits` (DEF) | SAFE |
| `apn_wallet_transactions` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable ledger |
| `apn_withdrawal_audit` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable |
| `apn_withdrawal_exports` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable |
| `apn_withdrawal_finance_transactions` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable |
| `apn_withdrawal_requests` | `apn_withdrawal_request_wallet_trg` | AFTER INSERT | `apn_withdrawal_refresh_from_request` (DEF) | SAFE |
| `apn_withdrawal_settlements` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable |
| `apn_withdrawal_status_history` | `apn_withdrawal_immutable_trg` | BEFORE DELETE | `apn_withdrawal_prevent_mutation` (DEF) | SAFE — immutable |
| `audit` | `audit_immutable` | BEFORE DELETE | `prevent_audit_mutation` (DEF) | SAFE — append-only (no UPDATE path exists) |
| `crm_revenue_collections` | `crm_revenue_sync_trg` | AFTER INSERT | `crm_sync_revenue_to_apn` (DEF) | SAFE — the CRM→APN→finance junction |
| `profiles` | `profiles_guard_trg` | BEFORE UPDATE | `profiles_guard` (DEF) | SAFE |
| `profiles` | `profiles_identity_guard_trg` | BEFORE INSERT | `profiles_identity_guard` (DEF) | SAFE |
| `transactions` | `fin_lock_txn` | BEFORE INSERT | `fin_lock_guard` (DEF) | SAFE — period lock |
| `transactions` | `trg_lock_tx` | BEFORE INSERT | `guard_fin_lock` (DEF) | SAFE — period lock (parallel trigger, same effect) |
| `users` (auth) | `on_auth_user_created` | AFTER INSERT | `handle_new_user` (DEF) | SAFE — profile bootstrap; see D1 |
| `web_requirement_sessions` | `proposal_requirement_completed_trg` | AFTER UPDATE | `proposal_after_requirement_completed` (DEF) | SAFE — proposal generation |
| `withdrawals` | `fin_lock_wd` / `trg_lock_wd` | BEFORE INSERT | `fin_lock_guard` / `guard_fin_lock` (DEF) | SAFE |

Platform-owned (6): `storage` (buckets/objects × 3), `cron.job_cache_invalidate`, `realtime.subscription_check_filters`, `realtime` internals — untouched by the app; SAFE.

### 5.1 Recursion analysis
- `apn_referral_earning_after_change` fires `apn_referral_refresh_wallet` which only writes `apn_referral_wallets` — a table with no trigger. No loop.
- `apn_withdrawal_refresh_from_*` write `apn_withdrawal_wallets` (no trigger). No loop.
- `crm_sync_revenue_to_apn` writes `apn_revenue_collections`, `apn_commission_projects`, `transactions`, `crm_projects`, and does one UPDATE on `crm_revenue_collections` itself (`commission_generated`, `status`) — but `crm_revenue_collections` has no BEFORE/AFTER UPDATE trigger (only AFTER INSERT). No loop. Verified.
- No trigger writes back into its own table via an INSERT path. No recursion.

### 5.2 CRM → APN → Finance chain integrity
Entry points into the chain:
1. `crm_record_revenue` (RPC, definer) — **H3**: authz is `is_admin() OR crm_can_read(...)`.
2. `upsert_apn_commission_project` (RPC, invoker) — admin-gated. M2.
3. `create_apn_income_transaction` (RPC, definer) — `can_finance()`. SAFE.
4. Direct table writes — blocked by RLS (SELECT-only policies on `crm_*`; write policies admin-only on `apn_*`). SAFE.

The chain itself (collection → commission → referral → finance transaction) computes every value server-side and writes atomically; no unauthorized lower-level entry point exists at the table layer. Only the CRM entry-point authorization (H3) is below the intended "manage" level.

---

## 6. Finance security

Verified controls:
- `transactions`/`withdrawals` RLS: `can_finance()` only. Non-finance, non-admin roles cannot read or write financial rows via tables.
- Financial RPCs: `can_finance()` (income), `apn_withdrawal_can_manage()` (review), `is_superadmin()` (unlock/reopen/delete).
- Period locks: `fin_locks` (superadmin-only writes) + BEFORE-INSERT triggers on `transactions`/`withdrawals` for non-superadmin. Lock flow verified.
- Append-only: ledger tables have BEFORE-DELETE rejection triggers; `audit` DELETE blocked; RLS provides no UPDATE/DELETE policies for non-admin roles on financial tables.
- Commission deletion (`apn_delete_commission_project`, superadmin-only) refuses to delete when a protected finance transaction, CRM revenue, or approved/paid referral earning exists (`dependent_objects_still_exist`). Verified in body.
- anon: zero write reachability into any financial path (no anon policies; RPC EXECUTE revoked in 2-B).

Gaps:
- **H1** audit forgery (Section 4) — affects financial evidence integrity.
- **H3** CRM read-scope → revenue write (Section 4) — a read-only CRM user can enter the finance chain.
- **M4** finance-period lock does not cover UPDATE/DELETE of `transactions` rows (only INSERT is trigger-guarded). `can_finance()` RLS still applies, so this is a finance-role-only gap; flagged for owner decision (D4).

## 7. APN findings (Phase 2-B regression check)

Phase 2-B revoked anon/public EXECUTE on 110 functions. **No regression found.** All APN/finance RPCs retain `authenticated` EXECUTE (verified: 0 functions lost authenticated EXECUTE). Verified per capability:

| Capability | Path | Status |
|---|---|---|
| Commission creation | `create_apn_income_transaction` (finance), `upsert_apn_commission_project` (admin) | OK |
| Revenue collection | `crm_record_revenue` → trigger chain | OK |
| Commission calculation | server-side in `crm_sync_revenue_to_apn` / `create_apn_income_transaction` | OK |
| Referral earnings | `apn_referral_collection_after_insert` (trigger) | OK |
| Withdrawal request | `apn_request_withdrawal` / `apn_referral_request_withdrawal` (partner-self-or-admin) | OK |
| Withdrawal approval/rejection | `apn_withdrawal_review` (manager/finance; superadmin for unlock/reopen) | OK |
| Wallet calculation | `apn_withdrawal_refresh_wallet` / `apn_referral_refresh_wallet` (triggers) | OK |
| CRM → APN sync | `crm_sync_revenue_to_apn` trigger | OK |
| Finance sync | `transactions` insert in same trigger + `create_apn_income_transaction` | OK |
| Commission deletion | `apn_delete_commission_project` + dependency guards | OK |
| Delete dependency protection | `dependent_objects_still_exist` on finance/CRM/referral deps | OK |

## 8. Dynamic SQL / schema-helper review

Dynamic SQL in the public schema: 5 functions.
- `_allbee_table` — `format()`-based DDL; `tbl` properly `%I`-quoted; `gate` **raw SQL interpolation** (H, Section 2.1).
- `_allbee_realtime` — `format()`-based publication ALTER; `%I`-quoted; H, Section 2.2.
- `knowledge_log_change` — EXECUTE-based logging of knowledge change events; authenticated-only, caller-gated; LOW (L4).
- `grant_pg_graphql_access`, `grant_pg_net_access` — platform event-trigger helpers (pg_graphql/pg_net); `format('%I')`-quoted; owned by postgres; SAFE (platform).
- `realtime.*` dynamic SQL functions are the realtime extension internals; SAFE.

Recommended privilege model for `_allbee_*`: **migration/bootstrap helpers only** — executable by `postgres` and `service_role` (deploy-time), NOT by `authenticated` and never by `anon`. See Section 14, fix F2.

## 9. Critical findings

| ID | Object | Severity | Summary |
|---|---|---|---|
| C1 | TRUNCATE/TRIGGER ACLs on public tables | CRITICAL (latent) | `anon` (143) / `authenticated` (165) hold TRUNCATE + TRIGGER on almost every table; RLS covers neither |
| C2 | `_allbee_table` / `_allbee_realtime` | CRITICAL (latent) | authenticated-callable DDL helpers; `_allbee_table` interpolates raw SQL `gate` into policy DDL |

**C1 details**
- Current behavior: every public table ACL is `arwdDxtm` (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) granted explicitly to `anon` and `authenticated` — except 22 APN/referral tables that omit `anon` entirely. Verified `has_table_privilege('anon', oid, 'TRUNCATE')` = true on 143 tables and `'authenticated'` = true on 165; same for `TRIGGER`.
- Exploit/impact: RLS is row-level only. `TRUNCATE` empties whole tables regardless of policies; `TRIGGER` lets a grantee attach triggers to any table. Neither is exposed by PostgREST today and the app (SPA + service-role edge functions) never performs them, so this is not currently reachable through the deployed API — but any SQL-capable path (misconfigured webhook, leaked DB password, new data-api capability, an admin running app-tier SQL) turns it into **full-database destruction and arbitrary trigger planting** with no RLS backstop.
- Recommended fix: `revoke truncate, trigger on all tables in schema public from anon; revoke truncate, trigger on all tables in schema public from authenticated;` (Section 14, F1). Zero functional impact.
- Production change required: yes (SQL, safe, no app dependency).

**C2 details**
- Current behavior: see Sections 2.1/2.2. `_allbee_table(tbl, gate)` creates tables, enables RLS, installs policies with `gate` embedded verbatim; `_allbee_realtime` alters the realtime publication. Both remain `authenticated`-executable after 2-B.
- Exploit/impact: today dead-ended because no non-owner role has `CREATE` on schema `public`; the moment any deployment grants CREATE (or the functions are invoked from a definer chain), `_allbee_table` becomes a schema-manipulation + policy-SQL-injection primitive reachable by any authenticated user.
- Recommended fix: Section 14, F2 — revoke EXECUTE from `authenticated` on both; keep owner + `service_role`.
- Production change required: yes (SQL, safe).

## 10. High findings

| ID | Object | Severity | Summary |
|---|---|---|---|
| H1 | `audit` INSERT policy | HIGH | any authenticated user can forge audit rows (`with check (true)`) |
| H2 | `purge_recycle()` | HIGH | any authenticated user can permanently delete 60-day-old recycle rows; no internal gate |
| H3 | `crm_record_revenue` authz | HIGH | read-scope (`crm_can_read`) users can create revenue that flows into APN commissions + finance transactions |
| H4 | `notifications` insert with-check | MEDIUM-LOW | self-referential with-check permits odd upserts (see L3) |

H1/H2 details: Sections 4 / 2.3. H3 details:
- Current behavior: `if not is_admin() and not (crm_can_read on project)` → raise. Any user with read visibility on a CRM project (owner/assignee/staff/partner per policy) can call `crm_record_revenue`.
- Exploit/impact: a CRM read-only actor can inject revenue collections into the CRM → APN → finance chain (commissions credited, finance transactions created). Business rule intends this for managers/finance only.
- Recommended fix: change gate to `crm_can_manage()` (or `can_finance()`), matching `crm_update_*` / `crm_convert_quotation` semantics. **Owner decision (D5)** — it changes an authorization level, not an algorithm.
- Production change required: yes (SQL) after decision.

## 11. Medium findings

| ID | Object | Severity | Summary |
|---|---|---|---|
| M1 | 144 definer functions | MEDIUM | `search_path=public` instead of hardened `SET search_path=''` + qualified refs |
| M2 | `upsert_apn_commission_project` | MEDIUM | SECURITY INVOKER writer relies on RLS policy alignment; convert to definer |
| M3 | `class_students` policies | MEDIUM | `using true`/`wc true` CRUD for all authenticated on a legacy 108-row table |
| M4 | finance period-lock UPDATE gap | MEDIUM (finance-role only) | lock triggers guard INSERT only; `can_finance` can UPDATE a locked-month transaction row |

**M1 details**
- Current behavior: every definer sets `search_path=public`; bodies reference objects via the `public.` prefix consistently (verified on the audited families).
- Impact: safe today because (a) no untrusted role can `CREATE` in `public`, (b) owners are all `postgres`, (c) inspected bodies qualify `public.`. An attack would require a schema earlier in search_path — none exists. Hardening is defense-in-depth.
- Recommended fix: set `search_path=''` on definers (Section 14, F3) after confirming all body references are schema-qualified (grep sweep first — **do not blind-apply**).

**M2 details**: see Section 3. **M3 details**: see Section 4 — owner decision (D3). **M4 details**: see Section 6 — owner decision (D4).

---

## 12. Low findings

| ID | Object | Severity | Summary |
|---|---|---|---|
| L1 | `username_to_email`, `username_available`, `email_available` | LOW | public identity enumeration helpers (required for login UX); return controlled bits of info |
| L2 | `current_name`, `crm_actor_name`, `proposal_actor_name`, `apn_withdrawal_actor_role`, `app_role`, `my_role` | LOW | anon-executable read-only identity lookups; reveal display names/roles only |
| L3 | `notifications` insert with-check | LOW | `wc = is_admin() OR id IN (select id from notifications)` — self-referential; id must pre-exist, so no spoofing vector; clean up to `is_admin()` |
| L4 | `knowledge_log_change` dynamic SQL | LOW | authenticated-only, gated caller; keep an eye on the EXECUTE source string |
| L5 | `web_ai_*` INVOKER publics | LOW | documented public surface; read-only over catalog tables |
| L6 | `handle_new_user` admin signup code | LOW (design) | see D1 |
| L7 | `recycle`/`notifications` activity traces visible to non-admin | LOW | minimal information-disclosure surface |

## 13. Safe / no-action findings

- All withdrawal/referral/commission/CRM RPCs: gates verified (partner-self-or-manager, finance, superadmin for destructive).
- Append-only enforcement (triggers + RLS) on ledger/audit tables.
- Period locks on finance inserts.
- Profile/APN user role-escalation guards.
- `create_apn_income_transaction` (RLS-off, finance-gated, atomic) — intentional; do not change.
- Trigger chain (CRM → APN → finance) — atomic, server-computed, no recursion.
- 22 APN/referral tables already omit `anon` ACL entirely.
- Edge functions use `service_role` (bypasses RLS; retains EXECUTE on all functions).
- 0 functions write `auth.*`; 0 functions create/delete users; the only schema-altering functions are `_allbee_*`.
- Event triggers are platform-owned (pg_graphql/pg_cron/pg_net/pgrst).
- Phase 2-B regression check: APN capability matrix green (Section 7).

## 14. Recommended SQL fixes (proposed batch — NOT yet applied)

All statements are idempotent and safe. Apply after owner review (Section 16).

```sql
-- F1 (C1): remove TRUNCATE + TRIGGER from anon/authenticated on all public tables.
-- RLS does not govern these; the app never uses them.
revoke truncate, trigger on all tables in schema public from anon;
revoke truncate, trigger on all tables in schema public from authenticated;

-- F2 (C2): schema/bootstrap helpers are migration-time only.
revoke execute on function public._allbee_table(text, text) from authenticated;
revoke execute on function public._allbee_realtime(text) from authenticated;
-- (anon was already revoked in Phase 2-B; postgres/service_role keep EXECUTE.)

-- F3 (H1): audit writes must be admin-only (all app flows already go through
-- definer RPCs / admin-scoped mutate; no non-admin insert path depends on this).
alter policy audit_insert on public.audit
  to authenticated
  with check (public.is_admin());
-- Alternative: drop policy audit_insert on public.audit;

-- F4 (H2): recycle purge must be admin-only.
create or replace function public.purge_recycle()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Purge requires admin.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.recycle
   where coalesce((data->>'deletedAt')::bigint, 0)
         < (extract(epoch from now()) * 1000)::bigint - (60::bigint * 86400000);
end $$;

-- F5 (M1, optional): harden definer search paths to '' after a qualification
-- sweep. Example (per function):
-- alter function public.<name>(<args>) set search_path = '';
```

**Deferred to owner decision (not in the auto-applied batch):**
- H3 / D5: `crm_record_revenue` gate → `crm_can_manage()` / `can_finance()`.
- M2 / D2: convert `upsert_apn_commission_project` to SECURITY DEFINER.
- M3 / D3: `class_students` policy scope.
- M4 / D4: extend period-lock triggers to UPDATE/DELETE.
- D6: whether `handle_new_user` admin-code flow should be hardened (rotation, audit, or removal).

## 15. Recommended code fixes

- **No required application changes.** Phase 2-C is a database-layer audit; the SPA (`src/AllbeeApp.jsx`) is not part of any finding's root cause.
- Optional hardening (if desired in a future phase):
  - Route every audit write through `mutate()`/definer RPCs only (already the practice for admin-facing actions); remove any client-side non-admin audit insert once F3 is applied.
  - Add a deploy-time smoke test that asserts the anon-EXECUTE surface stays at 39 functions (guards against drift like the one found in Phase 2-B).

## 16. Items requiring owner decision

| ID | Item | Options | Risk if ignored |
|---|---|---|---|
| D1 | `handle_new_user` admin signup code (`app_config.admin_signup_code`) grants `superadmin` on matching signup | rotate + audit log; hash compare; remove feature; keep as-is | admin take-over if code leaks/guessed |
| D2 | `upsert_apn_commission_project` → SECURITY DEFINER + `can_finance() OR is_admin()` | apply / keep | latent bypass if RLS policies drift |
| D3 | `class_students` (108 rows) unrestricted authenticated CRUD | admin-scope / decommission / keep | data integrity of legacy table |
| D4 | Period-lock triggers only guard INSERT | extend to UPDATE/DELETE / keep | finance role can alter locked-month rows |
| D5 | `crm_record_revenue` authz level (read vs manage) | switch to `crm_can_manage()` / keep | read-scope users can enter finance chain |
| D6 | `admin_users` edge function pattern (service-role only, already correct) | n/a — confirm | — |

## Appendix A — verification evidence (all read-only, production)

- 155 public functions; 144 definer / 11 invoker; all definers `search_path=public`; owners all `postgres`.
- 165 public relations; RLS enabled on 100%; forced 0%; anon `arwdDxtm` ACL on 143, `authenticated` on all 165 (TRUNCATE/TRIGGER verified via `has_table_privilege`).
- 275 policies; 0 PUBLIC-role policies; 34 anon policies (SELECT-only, knowledge catalog).
- 29 app triggers + 6 platform triggers; no recursion paths (verified per trigger function body).
- 10 dynamic-SQL functions; only `_allbee_table` interpolates an unvalidated SQL parameter.
- 3 functions touch `row_security` (`apn_referral_audit`, `apn_withdrawal_audit_event`, `create_apn_income_transaction`); only the last disables RLS, gated `can_finance()`.
- 5 functions write `audit` (all definer RPCs, admin/finance-gated) + the public INSERT policy (H1).
- 0 functions write `auth.*`; 0 user create/delete functions; 0 schema-altering functions besides `_allbee_*`.
- Role model is stock Supabase: `authenticator` → {anon, authenticated, service_role}; `postgres` member of anon/authenticated/service_role (management channel only).
- Phase 2-B state re-verified: 39 anon-executable functions (exact match); authenticated EXECUTE on 155/155; `service_role` on 155/155.

## Appendix B — audit stats

- Objects inspected: 239 functions, 165 relations, 275 policies, 35 triggers, 6 event triggers, 15 roles, full ACL/body review.
- Critical findings: 2 (both latent, SQL-batch fixable)
- High findings: 3 (H1–H3)
- Medium findings: 4 (M1–M4)
- Low findings: 7 (L1–L7)
- Safe/no-action: 13 categories
- Proposed SQL patches: 5 (F1–F5); 4 require no owner decision; 1 (F5) requires a qualification sweep
- Proposed code changes: none required

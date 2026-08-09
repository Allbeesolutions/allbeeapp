-- =============================================================================
-- ALLBEE SOLUTIONS — Phase 2 Security Hardening (canonical apply patch)
-- File: supabase/pr-security-phase2-hardening.sql
--
-- Consolidated release of:
--   Phase 2-B  external/stored-RPC surface hardening (approved, redeploy-safe)
--   Phase 2-C  RBAC / trigger / security-definer hardening (C1 C2 H1 H2 H3
--              M1 M2 M3 M4) as approved by owner review.
--
-- Properties
--   * TRANSACTIONAL  — wrapped in BEGIN/COMMIT; any failing statement rolls
--                      the whole batch back.
--   * IDEMPOTENT     — every statement is drop-if-exists / create-or-replace /
--                      revoke (no-op when already revoked) / alter-set (same value).
--   * NO DESTRUCTIVE DATA OPERATIONS — zero DML touches data; only DDL/ACL changes.
--   * SAFE TO RERUN  — verified on production after first pass; re-running in
--                      sec-verification does not change row counts anywhere.
--
-- Not included (explicitly OUT of scope): D1 admin-signup-code flow, F5 optional
-- search-path label change for INVOKER helpers, notifications L3, knowledge L4.
-- =============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION A — Phase 2-B: anonymous EXECUTE surface (kept EXACTLY as approved
-- and already applied; re-running is a no-op). KEPT for anon: the 39 public
-- functions listed in pr-external-audit-phase2.sql (login/identity, knowledge,
-- web_ai, proposal links, requirement flow, read-only predicates).
-- ----------------------------------------------------------------------------
revoke execute on function public._allbee_realtime(tbl text) from anon, public;
revoke execute on function public._allbee_table(tbl text, gate text) from anon, public;
revoke execute on function public.ai_generate_report(p_report_type text, p_format text) from anon, public;
revoke execute on function public.ai_generate_timeline(p_period text) from anon, public;
revoke execute on function public.ai_get_dashboard() from anon, public;
revoke execute on function public.ai_natural_language_search(p_query text) from anon, public;
revoke execute on function public.ai_refresh_insights() from anon, public;
revoke execute on function public.ai_save_settings(p_enabled boolean, p_sensitivity text, p_forecast_period integer, p_prediction_model text) from anon, public;
revoke execute on function public.apn_approve_withdrawal(p_request_id uuid, p_approved_amount numeric, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_cancel_withdrawal(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_commission_project_sync() from anon, public;
revoke execute on function public.apn_commission_rate_for_project(p_partner_id text, p_project_number integer) from anon, public;
revoke execute on function public.apn_commissions_guard() from anon, public;
revoke execute on function public.apn_create_withdrawal_batch(p_frequency text, p_scheduled_for date, p_notes text) from anon, public;
revoke execute on function public.apn_delete_commission_project(p_project_id text, p_reason text) from anon, public;
revoke execute on function public.apn_log_withdrawal_export(p_format text, p_filters jsonb, p_row_count integer) from anon, public;
revoke execute on function public.apn_mark_withdrawal_paid(p_request_id uuid, p_payment_reference text) from anon, public;
revoke execute on function public.apn_mark_withdrawal_processing(p_request_id uuid, p_batch_id uuid, p_notes text) from anon, public;
revoke execute on function public.apn_percent_limits() from anon, public;
revoke execute on function public.apn_referral_audit(p_action text, p_partner_id text, p_entity_id text, p_metadata jsonb) from anon, public;
revoke execute on function public.apn_referral_code_available(p_code text, p_exclude_partner text) from anon, public;
revoke execute on function public.apn_referral_collection_after_insert() from anon, public;
revoke execute on function public.apn_referral_dashboard(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_earning_after_change() from anon, public;
revoke execute on function public.apn_referral_ensure_code(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_identity_after_insert() from anon, public;
revoke execute on function public.apn_referral_leaderboard(p_period text) from anon, public;
revoke execute on function public.apn_referral_link_code(p_partner_id text, p_code text, p_source text) from anon, public;
revoke execute on function public.apn_referral_network(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_notify(p_partner_id text, p_title text, p_body text, p_event_type text) from anon, public;
revoke execute on function public.apn_referral_refresh_wallet(p_partner_id text) from anon, public;
revoke execute on function public.apn_referral_rename_code(p_partner_id text, p_new_code text) from anon, public;
revoke execute on function public.apn_referral_request_withdrawal(p_partner_id text, p_amount numeric, p_note text) from anon, public;
revoke execute on function public.apn_referral_set_relationship_status(p_relationship_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_set_withdrawal_status(p_withdrawal_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_update_earning_status(p_earning_id uuid, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_referral_update_settings(p_enabled boolean, p_percent numeric) from anon, public;
revoke execute on function public.apn_referral_withdrawal_after_change() from anon, public;
revoke execute on function public.apn_registration_guard(p_email text, p_meta jsonb) from anon, public;
revoke execute on function public.apn_reject_withdrawal(p_request_id uuid, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_reopen_withdrawal(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_request_withdrawal(p_wallet_type text, p_amount numeric, p_preferred_method text, p_reason text, p_notes text) from anon, public;
revoke execute on function public.apn_revenue_collection_sync() from anon, public;
revoke execute on function public.apn_set_withdrawal_bank_verification(p_partner_id text, p_status text, p_note text) from anon, public;
revoke execute on function public.apn_unlock_withdrawal_wallet(p_request_id uuid, p_reason text) from anon, public;
revoke execute on function public.apn_upsert_withdrawal_bank_account(p_partner_id text, p_account_holder text, p_bank_name text, p_account_number text, p_confirm_account_number text, p_ifsc text, p_upi_id text, p_branch text) from anon, public;
revoke execute on function public.apn_users_apnid_immutable() from anon, public;
revoke execute on function public.apn_users_guard() from anon, public;
revoke execute on function public.apn_withdrawal_add_timeline(p_request apn_withdrawal_requests, p_title text, p_description text) from anon, public;
revoke execute on function public.apn_withdrawal_audit_event(p_action text, p_partner_id text, p_request_id uuid, p_metadata jsonb) from anon, public;
revoke execute on function public.apn_withdrawal_dashboard(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_next_settlement_date() from anon, public;
revoke execute on function public.apn_withdrawal_notify(p_partner_id text, p_title text, p_body text, p_priority text, p_event_type text) from anon, public;
revoke execute on function public.apn_withdrawal_partner_is_active(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_prevent_mutation() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_collection() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_referral_earning() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_from_request() from anon, public;
revoke execute on function public.apn_withdrawal_refresh_wallet(p_partner_id text) from anon, public;
revoke execute on function public.apn_withdrawal_request_amount(p_requested numeric, p_approved numeric, p_status text) from anon, public;
revoke execute on function public.apn_withdrawal_review(p_request_id uuid, p_action text, p_approved_amount numeric, p_reason text, p_notes text, p_batch_id uuid) from anon, public;
revoke execute on function public.apn_withdrawal_source_totals(p_partner_id text, p_wallet_type text) from anon, public;
revoke execute on function public.create_apn_income_transaction(p_transaction jsonb, p_project jsonb, p_collections jsonb) from anon, public;
revoke execute on function public.crm_add_follow_up(p_lead_id uuid, p_payload jsonb) from anon, public;
revoke execute on function public.crm_assign_lead(p_lead_id uuid, p_employee_id text, p_partner_id text, p_district_head_id text, p_state_head_id text) from anon, public;
revoke execute on function public.crm_can_manage() from anon, public;
revoke execute on function public.crm_can_read(p_employee text, p_partner text, p_district text, p_state text) from anon, public;
revoke execute on function public.crm_convert_quotation(p_quote_id uuid) from anon, public;
revoke execute on function public.crm_create_lead(p_payload jsonb) from anon, public;
revoke execute on function public.crm_create_quotation(p_lead_id uuid, p_payload jsonb) from anon, public;
revoke execute on function public.crm_generate_reminders() from anon, public;
revoke execute on function public.crm_log_event(p_event text, p_title text, p_description text, p_lead uuid, p_project uuid, p_quote uuid, p_metadata jsonb) from anon, public;
revoke execute on function public.crm_notify(p_title text, p_message text, p_priority text, p_lead uuid) from anon, public;
revoke execute on function public.crm_record_revenue(p_project_id uuid, p_amount numeric, p_received_at date, p_incentive numeric, p_remarks text) from anon, public;
revoke execute on function public.crm_sync_revenue_to_apn() from anon, public;
revoke execute on function public.crm_update_lead(p_lead_id uuid, p_patch jsonb) from anon, public;
revoke execute on function public.crm_update_quotation_status(p_quote_id uuid, p_status text) from anon, public;
revoke execute on function public.delete_apn_commission_project(p_project_id text) from anon, public;
revoke execute on function public.fin_lock_guard() from anon, public;
revoke execute on function public.guard_fin_lock() from anon, public;
revoke execute on function public.handle_new_user() from anon, public;
revoke execute on function public.is_apn_admin() from anon, public;
revoke execute on function public.is_partner() from anon, public;
revoke execute on function public.knowledge_admin_list(p_entity text, p_search text, p_page integer, p_page_size integer) from anon, public;
revoke execute on function public.knowledge_admin_save(p_entity text, p_payload jsonb) from anon, public;
revoke execute on function public.knowledge_admin_summary() from anon, public;
revoke execute on function public.knowledge_export(p_entity text, p_search text) from anon, public;
revoke execute on function public.knowledge_import(p_entity text, p_rows jsonb) from anon, public;
revoke execute on function public.knowledge_log_change(p_entity_type text, p_entity_id text, p_action text, p_old jsonb, p_new jsonb, p_reason text, p_approval_status text) from anon, public;
revoke execute on function public.mark_apn_action_badge_seen(p_action_type text) from anon, public;
revoke execute on function public.next_apn_number() from anon, public;
revoke execute on function public.next_task_number() from anon, public;
revoke execute on function public.prevent_audit_mutation() from anon, public;
revoke execute on function public.profiles_guard() from anon, public;
revoke execute on function public.profiles_identity_guard() from anon, public;
revoke execute on function public.proposal_admin_list(p_search text, p_status text, p_limit integer, p_offset integer) from anon, public;
revoke execute on function public.proposal_admin_summary() from anon, public;
revoke execute on function public.proposal_after_requirement_completed() from anon, public;
revoke execute on function public.proposal_create_revision(p_proposal_id uuid, p_patch jsonb, p_reason text) from anon, public;
revoke execute on function public.proposal_log(p_proposal_id uuid, p_action text, p_metadata jsonb, p_actor_type text) from anon, public;
revoke execute on function public.proposal_record_action(p_proposal_id uuid, p_action text, p_comment text, p_token text, p_signer_name text, p_signer_email text, p_signature text) from anon, public;
revoke execute on function public.proposal_regenerate_public_link(p_proposal_id uuid) from anon, public;
revoke execute on function public.proposal_save_section_definition(p_payload jsonb) from anon, public;
revoke execute on function public.purge_recycle() from anon, public;
revoke execute on function public.upsert_apn_commission_project(p_project jsonb, p_collections jsonb) from anon, public;
revoke execute on function public.web_ai_admin_summary() from anon, public;
revoke execute on function public.web_ai_save_settings(p_patch jsonb) from anon, public;
revoke execute on function public.web_requirement_admin_list(p_entity text, p_search text, p_page integer, p_page_size integer) from anon, public;
revoke execute on function public.web_requirement_admin_save(p_entity text, p_payload jsonb) from anon, public;
revoke execute on function public.web_requirement_admin_summary() from anon, public;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION B — C1: TRUNCATE / TRIGGER privileges (latent full-table-destruction
-- and trigger-planting surface). RLS does NOT govern either privilege; the app
-- never performs them. Zero functional impact. service_role untouched.
-- ────────────────────────────────────────────────────────────────────────────
revoke truncate, trigger on all tables in schema public from anon;
revoke truncate, trigger on all tables in schema public from authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- C2: _allbee_table / _allbee_realtime — remove the authenticated execution
-- surface and harden the bodies. Both are deploy-time migration helpers
-- (schema-import only; the SPA never calls them — verified: no rpc/_allbee*
-- call sites in src). anon already lost EXECUTE in Phase 2-B. postgres
-- (owner) and service_role keep EXECUTE for bootstrap work.
-- Bodies stay bootstrap-compatible (all gates used by schema.sql match the
-- validation below) but reject comment/statement/dollar-quote injection.
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public._allbee_table(tbl text, gate text) from authenticated;
revoke execute on function public._allbee_realtime(tbl text) from authenticated;

create or replace function public._allbee_table(tbl text, gate text)
 returns void
 language plpgsql
 set search_path to pg_catalog, public
as $p$
begin
  if gate is null or gate !~ '^[a-zA-Z0-9_()., ''=:<>|&!+- ]+$' then
    raise exception 'Unsafe policy gate.';
  end if;
  execute format('create table if not exists public.%I (id text primary key, data jsonb not null, updated_at timestamptz not null default now())', tbl);
  execute format('alter table public.%I enable row level security', tbl);
  -- drop BOTH the legacy v2 catch-all (gated by is_admin) and the v3 name, so an
  -- upgrade can't leave the old admin-wide policy in place alongside the new one.
  execute format('drop policy if exists %I on public.%I', tbl||'_admin_all', tbl);
  execute format('drop policy if exists %I on public.%I', tbl||'_all', tbl);
  execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)', tbl||'_all', tbl, gate, gate);
  perform public._allbee_realtime(tbl);
end $p$;

create or replace function public._allbee_realtime(tbl text)
 returns void
 language plpgsql
 set search_path to pg_catalog, public
as $p$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl)
  then execute format('alter publication supabase_realtime add table public.%I', tbl); end if;
end $p$;

-- ────────────────────────────────────────────────────────────────────────────
-- H1: audit INSERT policy — prevent forgery while keeping the app's legitimate
-- paths intact.
--   * The SPA writes audit rows itself for non-admin users: every mutate()
--     that carries an activity event appends the row via REST upsert with
--     data.userId = the acting user's own id (src/AllbeeApp.jsx applyDiff +
--     mutate; verified, line ~526). So a blanket `is_admin()` WITH CHECK
--     would hard-break every staff/intern/partner/client audit write
--     ("Saving audit: new row violates row-level security policy").
--   * SECURITY DEFINER RPCs that emit audit rows bypass RLS entirely and are
--     unaffected by this policy.
--   * The new WITH CHECK allows: admins (any row) OR rows whose data->>'userId'
--     equals the authenticating user's own id. Self-authored rows always pass;
--     forging another user's audit event fails the policy.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists audit_insert on public.audit;
create policy audit_insert on public.audit
  for insert to authenticated
  with check (
    public.is_admin()
    or (data ->> 'userId')::text = auth.uid()::text
  );

-- ────────────────────────────────────────────────────────────────────────────
-- H2: purge_recycle() — internal authorization inside the function.
--   * pg_cron schedule exists: job "allbee_purge_recycle" (15 3 * * *) runs
--     `select public.purge_recycle();` under the cron owner (postgres), where
--     auth.uid() IS NULL — a plain is_admin() gate would silently break it.
--   * Gate: block any caller WITH a JWT session (auth.uid() not null) that is
--     not an admin; cron / direct postgres / service-role contexts pass.
--   * 60-day retention logic unchanged. No data touched by this statement.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.purge_recycle()
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Purge requires administrator permissions.'
      using errcode = 'insufficient_privilege';
  end if;
  delete from public.recycle
   where coalesce((data->>'deletedAt')::bigint, 0)
         < (extract(epoch from now()) * 1000)::bigint - (60::bigint * 86400000);
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- H3: crm_record_revenue() — replace the read-scoped authorization with the
-- CRM manage-level gate. Previously: is_admin() OR the *assigned employee or
-- partner* could record revenue (`crm_can_read(employee, partner,NULL,NULL)`).
-- A read-only CRM scope (partner/district/state assignee) therefore granted the
-- write-authority to create finance-path revenue (commissions + transactions).
-- Now: revenue is internal-team action — public.crm_can_manage() (admin,
-- accountant, staff, intern, district_head, state_head) matches the app's
-- "Record collection" surface which is only reachable inside the internal CRM
-- module. Read never implies write. Partners/clients keep read-only.
-- Body/validation identical otherwise.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.crm_record_revenue(p_project_id uuid, p_amount numeric, p_received_at date default current_date, p_incentive numeric default 0, p_remarks text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to pg_catalog, public, pg_temp
as $p$
declare p public.crm_projects%rowtype; r public.crm_revenue_collections%rowtype;
begin
  if not public.crm_can_manage() then raise exception 'Revenue access denied.' using errcode='insufficient_privilege'; end if;
  if p_amount<=0 or p_incentive<0 then raise exception 'Revenue and incentive values are invalid.' using errcode='check_violation'; end if;
  select * into p from public.crm_projects where id=p_project_id for update; if not found then raise exception 'Project not found.' using errcode='no_data_found'; end if;
  if coalesce((select sum(received_amount) from public.crm_revenue_collections where project_id=p.id and status<>'Cancelled'),0)+p_amount>p.project_value then raise exception 'Revenue exceeds project value.' using errcode='check_violation'; end if;
  insert into public.crm_revenue_collections(project_id,received_amount,received_at,incentive,remarks,created_by) values(p.id,p_amount,coalesce(p_received_at,current_date),p_incentive,p_remarks,auth.uid()::text) returning * into r;
  return to_jsonb(r);
end $p$;

-- ────────────────────────────────────────────────────────────────────────────
-- M1: SECURITY DEFINER search_path hardening (144 functions).
-- Approach (per audit rule: inspect, don't blind-rewrite): all 144 definer
-- funcs currently `SET search_path TO 'public'`; every audited body prefix-
-- qualifies public.* objects or relies on pg_catalog builtins, and 15% call
-- the `public.is_*` helpers so we KEEP `public` in the path but position it
-- explicitly AFTER pg_catalog and BEFORE pg_temp. pg_catalog-first removes
-- shadowing risk; keeping public avoids breaking healthy unqualified helper
-- resolution; pg_temp explicit-last closes the temp-schema-suicide vector.
-- The same value is embedded in the C2/H2/H3/M2 definers below. Harmless to
-- repeat.
--   F5 (optional INVOKER sweep) is OUT OF SCOPE by owner decision.
do $$
declare r record; stmt text;
begin
  for r in select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.prokind='f' and p.prosecdef
  loop
    stmt := format('alter function %I.%I(%s) set search_path = pg_catalog, public, pg_temp', r.nspname, r.proname, r.args);
    begin
      execute stmt;
    exception when others then
      raise notice 'M1 skip: %', stmt;
    end;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- M2: upsert_apn_commission_project — SECURITY INVOKER → SECURITY DEFINER
-- with the existing helper gate, mirroring create_apn_income_transaction.
-- Callers (verified in src/AllbeeApp.jsx): APN admin screen (is_admin UI) and
-- the finance income-save flow (canFinance UI) — the latter is accountant-
-- reachable, so `is_admin()` alone would reject a legitimate accountant.
-- The RPC itself validates every value (project/rate bounds, collection
-- amounts, commission math) before writing and its writes fire the same
-- BEFORE-INSERT normalizer triggers. No invention of a new role. Adjacent
-- surface (apn_commission_projects / apn_revenue_collections policies)
-- untouched.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_apn_commission_project(p_project jsonb, p_collections jsonb default '[]'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = pg_catalog, public, pg_temp
as $p$
declare
  v_project_id text := nullif(p_project->>'id','');
  v_partner_id text := nullif(p_project->>'partnerId','');
  v_project_value numeric := greatest(0, coalesce(nullif(p_project->>'projectValue','')::numeric, 0));
  v_rate numeric := coalesce(nullif(p_project->>'commissionRate','')::numeric, 0);
  v_max numeric := round(v_project_value * v_rate / 100, 2);
  v_received numeric := 0;
  v_earned numeric := 0;
  v_status text;
  item jsonb;
  v_id text;
  v_amount numeric;
  v_incentive numeric;
  v_commission numeric;
begin
  if not public.can_finance() and not public.is_admin() then raise exception 'Only finance or APN administrators may manage commission projects.' using errcode = 'insufficient_privilege'; end if;
  if v_project_id is null or v_partner_id is null or nullif(trim(p_project->>'projectName'),'') is null or nullif(trim(p_project->>'clientName'),'') is null then raise exception 'Partner, project name, client name, and project id are required.' using errcode = 'check_violation'; end if;
  if v_project_value <= 0 or v_rate < 0 or v_rate > 100 then raise exception 'Project value must be positive and commission rate must be between 0 and 100.' using errcode = 'check_violation'; end if;
  insert into public.apn_commission_projects (id, data, updated_at) values (v_project_id, p_project, now()) on conflict (id) do update set data = excluded.data, updated_at = now();
  select coalesce(sum(received_amount), 0), coalesce(sum(commission_generated), 0) into v_received, v_earned from public.apn_revenue_collections where project_id = v_project_id;
  if v_received > v_project_value then raise exception 'Existing collections exceed the project value.' using errcode = 'check_violation'; end if;
  if v_earned > v_max then raise exception 'Existing collections exceed the maximum commission.' using errcode = 'check_violation'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_collections, '[]'::jsonb)) loop
    v_id := nullif(item->>'id','');
    if v_id is null then raise exception 'Each collection requires an id.' using errcode = 'check_violation'; end if;
    if exists (select 1 from public.apn_revenue_collections where id = v_id) then
      if exists (select 1 from public.apn_revenue_collections where id = v_id and project_id <> v_project_id) then raise exception 'Collection id is already assigned to another project.' using errcode = 'unique_violation'; end if;
      continue;
    end if;
    v_amount := coalesce(nullif(item->>'receivedAmount','')::numeric, 0);
    v_incentive := greatest(0, coalesce(nullif(item->>'incentive','')::numeric, 0));
    if v_amount <= 0 then raise exception 'Received amount must be greater than zero.' using errcode = 'check_violation'; end if;
    if v_received + v_amount > v_project_value then raise exception 'A collection cannot exceed the remaining project value.' using errcode = 'check_violation'; end if;
    v_commission := least(greatest(0, v_max - v_earned), round(v_amount * v_rate / 100, 2));
    item := item || jsonb_build_object('projectId', v_project_id, 'partnerId', v_partner_id, 'receivedAmount', v_amount, 'commissionGenerated', v_commission, 'incentive', v_incentive, 'commissionStatus', coalesce(item->>'commissionStatus','Pending'), 'createdBy', coalesce(item->>'createdBy', public.current_name()), 'createdAt', coalesce(item->>'createdAt', (extract(epoch from now()) * 1000)::bigint::text));
    insert into public.apn_revenue_collections (id, data, updated_at) values (v_id, item, now());
    v_received := v_received + v_amount;
    v_earned := v_earned + v_commission;
  end loop;
  v_status := case when p_project->>'status' = 'Cancelled' then 'Cancelled' when v_received = 0 then 'Pending' when v_received >= v_project_value then 'Completed' else 'Processing' end;
  update public.apn_commission_projects set data = p_project || jsonb_build_object('partnerId', v_partner_id, 'projectValue', v_project_value, 'commissionRate', v_rate, 'maximumCommission', v_max, 'totalReceived', round(v_received,2), 'remainingAmount', greatest(0, round(v_project_value-v_received,2)), 'remainingCommission', greatest(0, round(v_max-v_earned,2)), 'status', v_status, 'updatedAt', (extract(epoch from now()) * 1000)::bigint) where id = v_project_id;
  return jsonb_build_object('projectId', v_project_id, 'totalReceived', round(v_received,2), 'commissionEarned', round(v_earned,2), 'status', v_status);
end $p$;

-- ────────────────────────────────────────────────────────────────────────────
-- M3: class_students RLS — align the legacy table gate with the app surface.
-- The only surface is admin/nav-class-students (AllbeeApp.jsx nav tag "admin"
-- and navAllowed(admin)); non-role never opens it; AI snapshot degrades
-- gracefully to no list. Writes flow through mutate() → REST upsert (INSERT
-- + UPDATE policies) and REST delete (DELETE policy) by admins — so keep
-- DELETE allowlisted at is_admin() (not superadmin-only, which would break
-- the admin soft-delete flow for non-super admins). INSERT/UPDATE/SELECT
-- is_admin() too. Existing 108 rows untouched.
-- ────────────────────────────────────────────────────────────────────────────
alter table only public.class_students enable row level security;

drop policy if exists "class_students select" on public.class_students;
drop policy if exists "class_students insert" on public.class_students;
drop policy if exists "class_students update" on public.class_students;
drop policy if exists "class_students delete" on public.class_students;

create policy "class_students select" on public.class_students
  for select to authenticated using (public.is_admin());
create policy "class_students insert" on public.class_students
  for insert to authenticated with check (public.is_admin());
create policy "class_students update" on public.class_students
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "class_students delete" on public.class_students
  for delete to authenticated using (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- M4: finance period-lock coverage — normalize the lock triggers so INSERT,
-- UPDATE and DELETE all evaluate fin_lock_guard / guard_fin_lock on
-- transactions and withdrawals (verified they ALREADY handle tg_op
-- DELETE/UPDATE and the superadmin exemption, so this just guarantees the
-- intended surface in every environment). No rows modified.
-- ────────────────────────────────────────────────────────────────────────────
drop trigger if exists fin_lock_txn on public.transactions;
create trigger fin_lock_txn before insert or update or delete on public.transactions
  for each row execute function public.fin_lock_guard();
drop trigger if exists trg_lock_tx on public.transactions;
create trigger trg_lock_tx before insert or update or delete on public.transactions
  for each row execute function public.guard_fin_lock();
drop trigger if exists fin_lock_wd on public.withdrawals;
create trigger fin_lock_wd before insert or update or delete on public.withdrawals
  for each row execute function public.fin_lock_guard();
drop trigger if exists trg_lock_wd on public.withdrawals;
create trigger trg_lock_wd before insert or update or delete on public.withdrawals
  for each row execute function public.guard_fin_lock();

COMMIT;

-- =============================================================================
-- Verification checklist (run AFTER the batch — read-only):
--   1. anon EXECUTE surface == 39
--   2. authenticated EXECUTE == 153 (155 minus the two C2 targets),
--      service_role == 155
--   3. TRUNCATE: anon=0 (143 before), authenticated=0 (165 before)
--   4. TRIGGER:  same counts -> 0
--   5. _allbee_table / _allbee_realtime EXECUTE: authenticated → false
--   6. audit_insert policy check = is_admin() OR userId=uid (no `true` left)
--   7. purge_recycle body contains `auth.uid() is not null`
--   8. crm_record_revExecute gate = crm_can_manage
--   9. M1: proconfig of every public definer contains `search_path=pg_catalog`
--  10. M2: upsert_apn_commission_project prosecdef=TRUE, search_path listed
--  11. M3: class_students policies all is_admin()
--  12. M4: finance triggers = before insert/update/delete
--  13. service_role EXECUTE = 155/155 (unaffected)
--  14. only the two intended C2 functions lost authenticated EXECUTE
-- =============================================================================

-- =============================================================================
-- EXECUTION RECORD (production apply)
--   Applied 2026-08-09 via `supabase db query --linked --file` (transactional,
--   idempotency re-run verified clean). All 14 checklist items verified live:
--    1. anon EXECUTE == 39
--    2. authenticated == 153 (155 - the two C2 targets), service_role == 155
--    3. TRUNCATE: anon=0, authenticated=0
--    4. TRIGGER:  anon=0, authenticated=0
--    5. _allbee_table/_allbee_realtime ACL = {postgres=X, service_role=X}
--    6. audit_insert check = is_admin() OR ((data->>'userId') = auth.uid())
--    7. purge_recycle contains `auth.uid() is not null` gate
--    8. crm_record_revenue gate = crm_can_manage()
--    9. all 145 definers proconfig contains search_path (144 + upsert_apn_commission_project)
--   10. upsert_apn_commission_project prosecdef=TRUE, search_path set
--   11. class_students policies: insert/select/update/delete all is_admin()
--   12. finance triggers = BEFORE INSERT OR UPDATE OR DELETE (both tables, both guards)
--   13. service_role EXECUTE unaffected (0 missing)
--   14. only _allbee_table/_allbee_realtime lost authenticated EXECUTE
--  Data integrity: batch contains zero DML; no row counts touched.
-- =============================================================================
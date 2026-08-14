-- =============================================================================
-- ALLBEE — APN WORK PACKAGE 10: CRM ↔ APN ASSIGNMENT CONVERGENCE
-- File: supabase/pr-apn-crm-assignments-wp10.sql
--
-- DISCOVERY (read-only audit, 2026-08-14, repository + production):
--   * Assignment lifecycle is admin-gated end to end: crm_assign_lead is
--     is_admin() only and writes crm_lead_assignments history + crm_audit;
--     conversion (crm_convert_quotation / proposal_finalize_approval) copies
--     the lead's partner once into crm_projects + creates the APN commission
--     project (on conflict do nothing); revenue sync stamps collections with
--     the APN project's partner (apn.partner_id), never the CRM column; the
--     WP9 owner path records the immutable ledger; referral + hierarchy are
--     separate tables never read from CRM. Commission ownership therefore has
--     a single authority: apn_commission_projects.partner_id.
--   * Historical entitlement is immutable: re-running crm_assign_lead after
--     revenue changes only the CRM work-routing column; ledger/wallets stay put.
--   * No partner can self-assign, cross-assign, post revenue, or name another
--     partner_id (crm_can_manage excludes the 'partner' profile role; partner
--     RLS grants are read-only). Races are guarded by unique constraints
--     (ledger idempotency_key, earnings source_collection_id, transaction ids)
--     plus conflict-guarded writes.
--   * One financial-governance gap was proven: upsert_apn_commission_project
--     (finance/admin surface) silently overwrites partnerId on an EXISTING
--     project — redirecting FUTURE commission entitlement (partner + referral +
--     district/state chains for subsequent collections) with no block and no
--     audit. The finance posting RPC (create_apn_income_transaction) already
--     refuses project reassignment; the APN surface did not match, and the
--     status-quo path is therefore an ungoverned future-entitlement redirect.
--
-- DESIGN (the single WP10 scope — assignment-change governance):
--   1. upsert_apn_commission_project gains the partner-change guard:
--      * existing project + different partner + ANY recorded collections
--        (money entered the engine) -> check_violation, mirroring the
--        established finance RPC rule. Historical + future entitlement can
--        only change via the audited deletion/recreation surfaces.
--      * existing project + different partner + zero collections -> allowed
--        (no money yet), but apn_rule_audit records the reassignment
--        (from/to partner, actor) so the ownership change is provable.
--      * race-safe: the existing row is locked (for update) before the guard
--        and the ON CONFLICT DO UPDATE has a backstop WHERE clause so a
--        concurrent writer can never flip partner on a project that has
--        collections.
--      * the finance-reconcile duplicate check (same partner+name+client on
--        another active project -> unique_violation) is preserved verbatim.
--   2. Marker closure: engine.crm-assignments -> completed with the WP10
--      rationale (admin-only assignment, conversion-time snapshot into the
--      single-money-authority APN project, immutable ledger history, history
--      + audit retained, and now explicit reassignment governance). The CRM
--      lead/project assignment columns remain work-routing only — the APN
--      engine derives commission identity solely from the APN project + APN
--      hierarchy + APN referral tables (no mirrored mutable ownership).
--
-- Everything else investigated in the WP10 discovery is ALREADY governed and
-- is explicitly NOT changed: assignment gates, referral interaction, hierarchy
-- routing, ledger immutability, reversals, freeze, finance locks, RLS,
-- grants, AI partner isolation.
--
-- Idempotent: create or replace + guarded marker update. Safe to re-run.
-- =============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. upsert_apn_commission_project — partner-reassignment governance
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
  v_existing text;
  item jsonb;
  v_id text;
  v_amount numeric;
  v_incentive numeric;
  v_commission numeric;
begin
  if not public.can_finance() and not public.is_admin() then raise exception 'Only finance or APN administrators may manage commission projects.' using errcode = 'insufficient_privilege'; end if;
  if v_project_id is null or v_partner_id is null or nullif(trim(p_project->>'projectName'),'') is null or nullif(trim(p_project->>'clientName'),'') is null then raise exception 'Partner, project name, client name, and project id are required.' using errcode = 'check_violation'; end if;
  if v_project_value <= 0 or v_rate < 0 or v_rate > 100 then raise exception 'Project value must be positive and commission rate must be between 0 and 100.' using errcode = 'check_violation'; end if;
  if exists (
    select 1 from public.apn_commission_projects p
    where p.id <> v_project_id
      and coalesce(p.partner_id, p.data->>'partnerId') = v_partner_id
      and lower(trim(coalesce(p.project_name, p.data->>'projectName', p.data->>'project', ''))) = lower(trim(p_project->>'projectName'))
      and lower(trim(coalesce(p.client_name, p.data->>'clientName', ''))) = lower(trim(p_project->>'clientName'))
      and coalesce(p.status, p.data->>'status', '') <> 'Cancelled'
  ) then raise exception 'This partner already has a commission project with that name and client.' using errcode = 'unique_violation'; end if;

  select partner_id into v_existing from public.apn_commission_projects where id = v_project_id for update;
  if found and v_existing is distinct from v_partner_id then
    if exists (select 1 from public.apn_revenue_collections where project_id = v_project_id) then
      raise exception 'A commission project with recorded revenue cannot be reassigned to another partner.' using errcode = 'check_violation';
    end if;
    perform public.apn_rule_audit('commission project partner reassigned (pre-revenue)', 'apn_commission_projects', v_project_id,
      jsonb_build_object('fromPartner', v_existing, 'toPartner', v_partner_id));
  end if;

  insert into public.apn_commission_projects (id, data, updated_at) values (v_project_id, p_project, now())
  on conflict (id) do update set data = excluded.data, updated_at = now()
    where public.apn_commission_projects.partner_id = v_partner_id
       or not exists (select 1 from public.apn_revenue_collections c where c.project_id = public.apn_commission_projects.id);
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
-- 2. Markers — engine.crm-assignments closed by this package
-- ────────────────────────────────────────────────────────────────────────────
update public.apn_migrations
set status = 'completed',
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, 'wp10'),
    notes = 'WP10: CRM lead assignment is the admin-gated work-routing authority (crm_assign_lead, is_admin-only, crm_lead_assignments history + crm_audit). Commission ownership has a single money authority: apn_commission_projects.partner_id, snapshotted once at quotation conversion (crm_convert_quotation / proposal_finalize_approval, on conflict do nothing) and never read from CRM after conversion; revenue sync stamps collections from the APN project row (apn.partner_id) and the WP9 owner path records the immutable ledger; referral + hierarchy stay separate APN tables. Reassignment governance added in WP10: partner changes on a project with recorded revenue are refused (check_violation, mirroring the finance RPC); pre-revenue changes are allowed but audited (apn_rule_audit). No partner can self-assign/cross-assign/post revenue/name another partner_id (server-side gates + read-only RLS).'
where id = 'engine.crm-assignments'
  and status <> 'completed';

commit;
notify pgrst, 'reload schema';
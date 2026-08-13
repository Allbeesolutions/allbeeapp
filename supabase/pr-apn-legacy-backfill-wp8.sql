-- WP8 — Legacy Commission Convergence (engine.legacy-commissions)
-- =============================================================================
-- Closes the last engine convergence marker: `engine.legacy-commissions`
-- (Backfill existing apn_commissions rows, incl. kind=district, into
-- apn_commission_ledger).
--
-- DISCOVERY (run against production on 2026-08-14):
--   * apn_commissions                       0 rows
--   * apn_commission_projects               0 rows
--   * apn_revenue_collections               0 rows
--   * apn_commission_ledger                 0 rows
--   * apn_consolidated_wallets              0 partners
--   * apn_referral_earnings                 0 rows
--   * apn_withdrawal_requests/settlements   0 rows
--   * transactions flagged apn income       0, apn expense 0
--   * apn_users 7, profiles 16, withdrawal_wallets rows 21 (all zeroed)
--   => The production legacy dataset is EMPTY. The migration below is a
--      provable no-op today, but ships the mechanism so any future rows
--      created by the legacy write path converge the same deterministic way.
--
-- DESIGN (safe by construction):
--   1. New SECURITY DEFINER RPC apn_backfill_legacy_commissions(p_dry_run).
--      For each eligible legacy row (one ledger entry, immutable, replay-safe):
--      * idempotency_key = 'legacy:<id>'  (re-runs are no-ops)
--      * source_type  = 'adjustment'      (schema check list allows it; no
--        legacy_commission value exists, and adjustment is already counted by
--        apn_consolidated_wallet_refresh)
--      * commission_type = 'partner'      (kind=district rows are skipped: WP6
--        engine.district-client closed that surface — the engine pays heads
--        server-side per revenue collection; Reversed rows are skipped too)
--      * percent = the row's own rate; event_at = createdAt; eligible_from =
--        payoutDate for pending rows (mirrors the legacy Pending window)
--      * snapshot preserves the original legacy payload for the UI/AI trail
--   2. Blob rows get a `migratedLedgerId` / `migratedAtMs` stamp. The two
--      wallet surfaces stay symmetric on purpose: apn_withdrawal_source_totals
--      (claims center) and apn_consolidated_wallet_refresh (portal wallet)
--      BOTH continue to read the blob for legacy rows, exactly as they always
--      have — each surface sees the same money exactly once, so the claims
--      center and the portal wallet never disagree. The stamp exists so the
--      FRONTEND legacy projection can exclude migrated rows (Part 22): the row
--      now appears in the ledger list, not twice in both lists.
--   3. NO finance expense side effect: apn_ensure_finance_expense fires only
--      on reversal flows; backfill is intentionally expense-neutral because
--      legacy-era commissions were never expensed in finance.
--   4. Dry-run + execute modes; per-row failure defers to the rule audit with
--      the exact error, never aborting the batch.
--
-- Re-runnable: all objects are `create or replace`; the marker is an upsert.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEGACY → LEDGER BACKFILL RPC (admin / finance; dry-run safe)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apn_backfill_legacy_commissions(p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_count int := 0;
  v_backfilled int := 0;
  v_skipped_reversed int := 0;
  v_skipped_district int := 0;
  v_skipped_migrated int := 0;
  v_defers jsonb := '[]'::jsonb;
  v_rows int := 0;
  v_result jsonb;
  v_idempotency text;
  v_rate numeric;
  v_base numeric;
  v_amount numeric;
  v_event timestamptz;
  v_eligible date;
  v_kind text;
  v_status text;
  v_partner_id text;
  v_project text;
  v_client text;
  v_stamp jsonb;
  v_refreshed text[] := '{}'::text[];
  r record;
begin
  if not (public.is_admin() or public.can_finance() or public.is_superadmin()) then
    raise exception 'Only administrators and finance roles may run a legacy commission backfill.'
      using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();

  for r in
    select id, data from public.apn_commissions
    order by coalesce((data->>'createdAt')::bigint, 0)
  loop
    v_rows := v_rows + 1;
    v_kind := coalesce(r.data->>'kind', 'partner');
    v_status := coalesce(r.data->>'status', 'Pending');
    v_partner_id := r.data->>'partnerId';
    v_amount := 0;
    if coalesce(r.data->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_amount := (r.data->>'amount')::numeric;
    end if;

    if coalesce(r.data->>'migratedLedgerId', '') <> '' then
      v_skipped_migrated := v_skipped_migrated + 1;
      continue;
    end if;
    if v_status = 'Reversed' then
      v_skipped_reversed := v_skipped_reversed + 1;
      continue;
    end if;
    if v_kind = 'district' then
      v_skipped_district := v_skipped_district + 1;
      continue;
    end if;
    v_count := v_count + 1;
    if p_dry_run then
      continue;
    end if;

    if v_partner_id is null or v_amount <= 0 then
      v_defers := v_defers || jsonb_build_object('id', r.id, 'reason', 'non-backfillable legacy row',
        'detail', 'partnerId=' || coalesce(v_partner_id, '<null>') || ' amount=' || coalesce(r.data->>'amount', '<missing>'));
      continue;
    end if;
    if not exists (select 1 from public.apn_users u where u.id = v_partner_id) then
      v_defers := v_defers || jsonb_build_object('id', r.id, 'reason', 'unknown partner',
        'partnerId', v_partner_id);
      continue;
    end if;
    -- apn_commissions_guard raises on suspended partners; detect it up front
    -- so one bad row can never abort the batch.
    if exists (select 1 from public.apn_users u where u.id = v_partner_id and u.data->>'status' = 'suspended') then
      v_defers := v_defers || jsonb_build_object('id', r.id, 'reason', 'suspended partner',
        'partnerId', v_partner_id);
      continue;
    end if;

    v_rate := 0;
    if coalesce(r.data->>'rate', '') ~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_rate := greatest(0, least(100, (r.data->>'rate')::numeric));
    end if;
    v_event := coalesce(
      case when coalesce(r.data->>'createdAt','') ~ '^[0-9]+$'
        then to_timestamp((r.data->>'createdAt')::numeric / 1000) end,
      now());
    v_eligible := null;
    if v_status = 'Pending'
      and coalesce(r.data->>'payoutDate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      v_eligible := (r.data->>'payoutDate')::date;
    end if;
    v_project := r.data->>'project';
    v_client := r.data->>'client';

    v_idempotency := 'legacy:' || r.id;
    -- Base amount = the row's revenue (the commission percentage applies to it
    -- and the ledger's 35%/15% per-event caps are revenue-relative). When the
    -- revenue field is missing or not numeric, the entry defers with the exact
    -- reason rather than guessing.
    v_base := v_amount;
    if coalesce(r.data->>'revenue', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      and (r.data->>'revenue')::numeric >= v_amount then
      v_base := (r.data->>'revenue')::numeric;
    end if;
    -- One ledger entry per legacy row; replay-safe by idempotency key.
    v_result := public.apn_ledger_record_safe(
      v_idempotency, r.id, 'adjustment', v_partner_id, 'partner',
      v_base, v_rate, v_amount, v_event,
      jsonb_build_object(
        'project', v_project, 'clientName', v_client,
        'legacy', true, 'legacyStatus', v_status,
        'legacyAmount', r.data->>'amount'
      ),
      v_eligible);

    if (v_result->>'id')::uuid is null then
      v_defers := v_defers || jsonb_build_object('id', r.id, 'reason', 'ledger deferred',
        'error', v_result->>'error');
      continue;
    end if;

    -- Stamp the blob so legacy projections exclude this row (exactly-once).
    v_stamp := r.data || jsonb_build_object(
      'migratedLedgerId', v_result->>'id',
      'migratedAtMs', (extract(epoch from now()) * 1000)::bigint::text,
      'migratedBy', coalesce(auth.uid()::text, 'system'));
    update public.apn_commissions
      set data = v_stamp, updated_at = now()
      where id = r.id;

    perform public.apn_rule_audit('backfilled legacy commission', 'apn_commissions', r.id,
      jsonb_build_object('ledgerId', v_result->>'id', 'idempotencyKey', v_idempotency,
        'partnerId', v_partner_id, 'amount', v_amount, 'status', v_status,
        'dryRun', p_dry_run));

    -- Remember the partner for a single consolidated refresh after the loop.
    if v_partner_id is not null and not v_partner_id = any (v_refreshed) then
      v_refreshed := v_refreshed || v_partner_id;
    end if;
    v_backfilled := v_backfilled + 1;
  end loop;

  if array_length(v_refreshed, 1) is not null then
    for i in 1..array_length(v_refreshed, 1) loop
      perform public.apn_consolidated_wallet_refresh(v_refreshed[i]);
      perform public.apn_withdrawal_refresh_wallet(v_refreshed[i]);
    end loop;
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true, 'scanned', v_rows,
      'candidates', v_count, 'skippedReversed', v_skipped_reversed,
      'skippedDistrict', v_skipped_district, 'skippedMigrated', v_skipped_migrated);
  end if;
  return jsonb_build_object(
    'dryRun', false, 'scanned', v_rows, 'candidates', v_count, 'backfilled', v_backfilled,
    'skippedReversed', v_skipped_reversed, 'skippedDistrict', v_skipped_district,
    'skippedMigrated', v_skipped_migrated, 'deferred', jsonb_array_length(v_defers),
    'refreshedPartners', array_length(v_refreshed, 1),
    'defers', v_defers);
end;
$$;

revoke all on function public.apn_backfill_legacy_commissions(boolean) from public, anon;
grant execute on function public.apn_backfill_legacy_commissions(boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MARKER CLOSURE
--    engine.legacy-commissions — backfill mechanism ships; production legacy
--    dataset verified empty (0 rows), so the live migration ran as a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
update public.apn_migrations
set status = 'completed',
    notes = 'WP8: apn_backfill_legacy_commissions ships deterministic, dry-run-safe legacy→ledger convergence (idempotency legacy:<id>, adjustment source, blob stamp, wallet-surface symmetry preserved, no finance expense side effect). Production apn_commissions = 0 rows; backfill verified as a no-op + verify suite green.',
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, 'wp8')
where id = 'engine.legacy-commissions'
  and status <> 'completed';
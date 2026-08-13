-- =============================================================================
-- WP7 — APP-UI SOURCE-OF-TRUTH CONVERGENCE (READ-ONLY)
-- Partner portal financial display must agree with ALLBEE AI. Today the AI
-- tab reads authoritative engine truth (apn_consolidated_wallets,
-- apn_commission_ledger, apn_commission_rules) while the home/wallet/profile
-- screens derive their figures from the legacy APN JSON blobs. This patch
-- adds ONE read-only, auth.uid()-scoped snapshot RPC so the portal reads the
-- exact same shapes the AI builder serves (pr-apn-ai-support-wp5.sql
-- apn_ai_build_context). No writes, no new financial engine, no backfill:
-- display-only convergence.
--
-- DESIGN (matches the WP7 requirements):
--   * identity NEVER comes from a parameter — callers are scoped via
--     auth.uid() through apn_ai_partner_scope(), so the RPC is IDOR-proof
--     by construction (no p_partner_id exists).
--   * security definer with hardened search_path (pg_catalog, public,
--     pg_temp) — exactly the WP3/WP5 helper pattern.
--   * "stable", deterministic, no dynamic SQL, no row_security toggles.
--   * returns NULL-shaped blocks (jsonb_agg coalesce '[]') and jsonb nulls
--     stripped — a partner with no ledger/wallet gets empty arrays, never
--     an error; UI degrades to legacy figures when the function is absent.
--   * grants: authenticated only; anon/public execute revoked.
--   * legacy writes stay untouched (no mutate()/RPC surface changes here).
--   * idempotent: create or replace.
-- =============================================================================

-- ── 1. PARTNER PORTAL FINANCIAL SNAPSHOT (read-only) ────────────────────────
-- Serves the portal's authoritative wallet + ledger + reversal + rule-set +
-- withdrawal + freeze facts for the CALLER ONLY. Key names mirror
-- apn_ai_build_context() exactly (wallet, ledger, reversals, withdrawalWallets,
-- withdrawalRequests, nextEligibleDate, ruleKnowledge) so UI and AI display
-- provably identical data with identical semantics.
create or replace function public.apn_partner_financial_snapshot()
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_scope jsonb;
  v_pid text;
  v_set jsonb;
  v_wallet jsonb;
  v_ledger jsonb;
  v_reversals jsonb;
  v_wallets jsonb;
  v_withdrawals jsonb;
  v_next_eligible date;
  v_frozen jsonb;
begin
  v_scope := public.apn_ai_partner_scope();
  if v_scope is null then
    raise exception 'This snapshot is available to active APN partners only.'
      using errcode = 'insufficient_privilege';
  end if;
  v_pid := v_scope->>'partnerId';

  -- Emergency freeze state (read-only projection; writes are guarded).
  select jsonb_build_object(
      'frozen', coalesce(frozen, false),
      'reason', reason,
      'frozenAt', frozen_at
    ) into v_frozen
  from public.apn_system_controls
  where id = 1;

  -- Current effective rule version + ladder (identical query to WP5 §5).
  v_set := (
    select jsonb_build_object(
      'ruleSet', jsonb_build_object('code', rs.code, 'name', rs.name, 'effectiveFrom', rs.effective_from, 'effectiveTo', rs.effective_to),
      'ladder', coalesce(jsonb_agg(jsonb_build_object(
        'commissionType', r.commission_type, 'tierMin', r.tier_min, 'tierMax', r.tier_max,
        'percent', r.percent, 'maxPercent', r.max_percent, 'capClass', r.cap_class) order by r.commission_type, r.tier_min), '[]'::jsonb)
    )
    from public.apn_rule_sets rs
    left join public.apn_commission_rules r on r.rule_set_id = rs.id and r.active
    where rs.status = 'active'
      and rs.effective_from <= now()
      and (rs.effective_to is null or rs.effective_to >= now())
    group by rs.id, rs.code, rs.name, rs.effective_from, rs.effective_to
    order by rs.effective_from desc
    limit 1
  );

  -- Authoritative wallet (derived surface; read-only here — same as WP5 §5).
  select to_jsonb(w) into v_wallet from public.apn_consolidated_wallets w where w.partner_id = v_pid;

  -- Ledger trail: the authority for commission/eligibility display.
  -- Row shape identical to the AI builder so UI cards and AI answers agree.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'commissionType', l.commission_type, 'sourceType', l.source_type,
      'baseAmount', l.base_amount, 'percent', l.percent, 'amount', l.amount,
      'eventAt', l.event_at, 'eligibleFrom', l.eligible_from,
      'snapshot', jsonb_build_object(
        'project', l.snapshot->>'project', 'projectNumber', l.snapshot->>'projectNumber',
        'clientName', l.snapshot->>'clientName', 'note', l.snapshot->>'note',
        'reason', l.snapshot->>'reason', 'reversalReason', l.snapshot->>'reversalReason'
      ))
    order by l.event_at desc), '[]'::jsonb) into v_ledger
  from (
    select * from public.apn_commission_ledger where partner_id = v_pid
    order by event_at desc limit 30
  ) l;

  -- Reversal trail (same shape as the AI builder).
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'amount', r.amount, 'reason', r.reason, 'status', r.status,
      'createdAt', r.created_at, 'appliedAt', r.applied_at,
      'originalLedger', l.id, 'originalAmount', l.amount, 'commissionType', l.commission_type)
    order by r.created_at desc), '[]'::jsonb) into v_reversals
  from public.apn_reversals r
  join public.apn_commission_ledger l on l.id = r.original_ledger_id
  where l.partner_id = v_pid
  limit 15;

  -- Withdrawal wallets (normalized; same shape as AI builder).
  select coalesce(jsonb_agg(to_jsonb(x) - 'partner_id' order by x.wallet_type), '[]'::jsonb) into v_wallets
  from public.apn_withdrawal_wallets x where x.partner_id = v_pid;

  -- Recent withdrawal requests (same shape as AI builder).
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'walletType', w.wallet_type, 'requestedAmount', w.requested_amount,
      'approvedAmount', w.approved_amount, 'status', w.status, 'preferredMethod', w.preferred_method,
      'reason', w.reason, 'reviewReason', w.review_reason, 'requestedAt', w.requested_at,
      'paidAt', w.paid_at, 'cancelledAt', w.cancelled_at)
    order by w.requested_at desc), '[]'::jsonb) into v_withdrawals
  from (
    select * from public.apn_withdrawal_requests where partner_id = v_pid
    order by requested_at desc limit 15
  ) w;

  -- Next date a pending commission becomes eligible (same as AI builder).
  select min(coalesce(eligible_from, event_at::date)) into v_next_eligible
  from public.apn_commission_ledger
  where partner_id = v_pid and amount > 0
    and coalesce(eligible_from, event_at::date) > current_date;

  return jsonb_strip_nulls(jsonb_build_object(
    'partnerId', v_pid,
    'freeze', v_frozen,
    'ruleKnowledge', v_set,
    'wallet', v_wallet,
    'ledger', v_ledger,
    'reversals', v_reversals,
    'withdrawalWallets', v_wallets,
    'withdrawalRequests', v_withdrawals,
    'nextEligibleDate', v_next_eligible
  ));
end;
$$;

revoke all on function public.apn_partner_financial_snapshot() from public, anon;
grant execute on function public.apn_partner_financial_snapshot() to authenticated;
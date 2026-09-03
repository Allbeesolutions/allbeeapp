-- APN wallet ledger detail identity convergence.
-- The partner financial snapshot is the authoritative wallet read path. Its
-- previous ledger projection omitted source_id and source-partner identity,
-- forcing the browser to resolve a referral through the legacy JSON cache.
-- That cache is intentionally RLS-scoped and therefore is not a safe/source-of-
-- truth dependency for authoritative ledger details. Return the source linkage
-- and immutable identity facts directly from the server-side snapshot.
begin;

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
    raise exception 'This snapshot is available to active APN partners only.' using errcode = 'insufficient_privilege';
  end if;
  v_pid := v_scope->>'partnerId';

  select jsonb_build_object('frozen', coalesce(frozen, false), 'reason', reason, 'frozenAt', frozen_at)
    into v_frozen from public.apn_system_controls where id = 1;

  v_set := (
    select jsonb_build_object(
      'ruleSet', jsonb_build_object('code', rs.code, 'name', rs.name, 'effectiveFrom', rs.effective_from, 'effectiveTo', rs.effective_to),
      'ladder', coalesce(jsonb_agg(jsonb_build_object(
        'commissionType', r.commission_type, 'tierMin', r.tier_min, 'tierMax', r.tier_max,
        'percent', r.percent, 'maxPercent', r.max_percent, 'capClass', r.cap_class) order by r.commission_type, r.tier_min), '[]'::jsonb)
    )
    from public.apn_rule_sets rs
    left join public.apn_commission_rules r on r.rule_set_id = rs.id and r.active
    where rs.status = 'active' and rs.effective_from <= now() and (rs.effective_to is null or rs.effective_to >= now())
    group by rs.id, rs.code, rs.name, rs.effective_from, rs.effective_to
    order by rs.effective_from desc limit 1
  );

  select to_jsonb(w) into v_wallet from public.apn_consolidated_wallets w where w.partner_id = v_pid;

  -- Source identity is resolved server-side from the authoritative referral
  -- earning + APN profile rows. This is especially important for referral
  -- entries because the browser may not be allowed to select the referred APN
  -- directly under state-scoped RLS.
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', l.id,
      'commissionType', l.commission_type,
      'sourceType', l.source_type,
      'sourceId', l.source_id,
      'baseAmount', l.base_amount,
      'percent', l.percent,
      'amount', l.amount,
      'eventAt', l.event_at,
      'eligibleFrom', l.eligible_from,
      'snapshot', jsonb_strip_nulls(coalesce(l.snapshot, '{}'::jsonb) ||
        case when l.commission_type = 'referral' then jsonb_build_object(
          'sourcePartnerId', e.referred_id,
          'sourcePartnerName', coalesce(referred_u.data->>'name', l.snapshot->>'referredName', 'APN Partner'),
          'sourcePartnerApnId', coalesce(referred_u.data->>'apnId', l.snapshot->>'referredApnId', '—'),
          'sourcePartnerRole', coalesce(referred_u.data->>'role', 'partner'),
          'sourceReferrerId', e.referrer_id,
          'sourceReferrerName', coalesce(referrer_u.data->>'name', l.snapshot->>'referrerName', 'APN Partner'),
          'sourceReferrerApnId', coalesce(referrer_u.data->>'apnId', l.snapshot->>'referrerApnId', '—'),
          'projectId', e.project_id,
          'collectionId', e.source_collection_id
        ) else '{}'::jsonb end
      )
    )) order by l.event_at desc), '[]'::jsonb)
    into v_ledger
  from (
    select * from public.apn_commission_ledger where partner_id = v_pid order by event_at desc limit 30
  ) l
  left join public.apn_referral_earnings e on l.commission_type = 'referral' and e.id::text = l.source_id
  left join public.apn_users referred_u on referred_u.id = e.referred_id
  left join public.apn_users referrer_u on referrer_u.id = e.referrer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'amount', r.amount, 'reason', r.reason, 'status', r.status,
      'createdAt', r.created_at, 'appliedAt', r.applied_at,
      'originalLedger', l.id, 'originalAmount', l.amount, 'commissionType', l.commission_type)
    order by r.created_at desc), '[]'::jsonb)
    into v_reversals
  from public.apn_reversals r join public.apn_commission_ledger l on l.id = r.original_ledger_id
  where l.partner_id = v_pid limit 15;

  select coalesce(jsonb_agg(to_jsonb(x) - 'partner_id' order by x.wallet_type), '[]'::jsonb)
    into v_wallets from public.apn_withdrawal_wallets x where x.partner_id = v_pid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'walletType', w.wallet_type, 'requestedAmount', w.requested_amount,
      'approvedAmount', w.approved_amount, 'status', w.status, 'preferredMethod', w.preferred_method,
      'reason', w.reason, 'reviewReason', w.review_reason, 'requestedAt', w.requested_at,
      'paidAt', w.paid_at, 'cancelledAt', w.cancelled_at)
    order by w.requested_at desc), '[]'::jsonb)
    into v_withdrawals
  from (select * from public.apn_withdrawal_requests where partner_id = v_pid order by requested_at desc limit 15) w;

  select min(coalesce(eligible_from, event_at::date)) into v_next_eligible
  from public.apn_commission_ledger where partner_id = v_pid and amount > 0
    and coalesce(eligible_from, event_at::date) > current_date;

  return jsonb_strip_nulls(jsonb_build_object(
    'partnerId', v_pid, 'freeze', v_frozen, 'ruleKnowledge', v_set, 'wallet', v_wallet,
    'ledger', v_ledger, 'reversals', v_reversals, 'withdrawalWallets', v_wallets,
    'withdrawalRequests', v_withdrawals, 'nextEligibleDate', v_next_eligible));
end;
$$;

revoke all on function public.apn_partner_financial_snapshot() from public, anon;
grant execute on function public.apn_partner_financial_snapshot() to authenticated;

notify pgrst, 'reload schema';
commit;

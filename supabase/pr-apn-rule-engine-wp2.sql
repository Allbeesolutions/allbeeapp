-- =============================================================================
-- ALLBEE — APN RULE ENGINE — WORK PACKAGE 2 (referral pipeline, option 1)
--
-- Derives referral earnings from the commission engine's collection data.
-- Option 1 only: the partner is their OWN referrer and earns a flat referral %
-- of every collection. No deep chains, no multi-level split.
--
-- HOW THE WALLET IMPACT WORKS (do not write wallet tables directly):
--   * apn_withdrawal_wallets and apn_referral_wallets are DERIVED. They are
--     recomputed by apn_withdrawal_refresh_wallet() / apn_referral_refresh_wallet()
--     from the source rows (apn_revenue_collections.commission_generated for
--     commission+incentive wallets; apn_referral_earnings.referral_amount for
--     the referral wallet).
--   * Two triggers already refresh wallets automatically, in the same
--     transaction, on every source change:
--       - apn_withdrawal_refresh_from_collection  on apn_revenue_collections
--       - apn_referral_earning_after_change       on apn_referral_earnings
--   * Therefore WP2 only has to INSERT the right apn_referral_earnings row;
--     the wallet impact follows automatically. Direct writes to the wallet
--     tables would be overwritten by the next refresh and must never happen.
--
-- WHY SELF-EARNINGS CARRY relationship_id = NULL:
--   A self-earning is NOT a referral relationship (apn_referral_relationships
--   even forbids referrer_id = referred_id via the apn_referral_no_self check),
--   so relationship_id is dropped to nullable and left NULL on self-earnings.
--   All downstream consumers read by referrer_id and are unaffected:
--     - apn_withdrawal_source_totals(p, 'referral')  -> wallet balances
--     - apn_referral_earning_after_change trigger    -> wallet refresh + timeline
--     - apn_referral_leaderboard                     -> amounts (fixed to not
--                                                        count self as "referred")
--   Relationship-scoped views (apn_referral_network, apn_referral_monthly_summary,
--   dashboard) intentionally stay relationship-only: they report actual
--   referrals, and self-earnings are not referrals.
--
-- CALL CONTRACT (used by WP3, the commission-engine pipeline):
--   After inserting an apn_revenue_collections row, call
--       select public.apn_engine_record_partner_earning(p_partner_id, p_collection_id, p_percent);
--   p_percent is optional; when NULL the snapshot rule apn_referral_settings.default_percent
--   applies (the same rate the existing code-link trigger uses). The call is
--   idempotent: re-running for the same collection returns inserted=false.
--   When the partner already belongs to an ACTIVE real referrer the call skips
--   (inserted=false, reason 'linked'): the existing apn_referral_collection_trg
--   trigger already books the referrer's earnings, and paying the partner too
--   would double the payout.
--
-- Idempotent: safe to re-run (drop NOT NULL is a no-op when already nullable;
-- functions are create-or-replace; grants are re-applied). Applies on top of
-- pr-apn-rule-engine-foundation.sql (WP1), apn-commission-engine-v4.sql and
-- apn-referral-engine-pr2.sql.
-- =============================================================================

begin;

-- ── 01 Self-earnings have no relationship row → drop NOT NULL ─────────────────
alter table public.apn_referral_earnings alter column relationship_id drop not null;

-- ── 02 Audited pipeline entry point ───────────────────────────────────────────
create or replace function public.apn_engine_record_partner_earning(p_partner_id text, p_collection_id text, p_percent numeric default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_collection public.apn_revenue_collections%rowtype;
  v_settings record;
  v_percent numeric;
  v_amount numeric;
  v_earning_id uuid;
  v_has_referrer boolean;
begin
  if p_partner_id is null or trim(p_partner_id) = '' or p_collection_id is null or trim(p_collection_id) = '' then
    return jsonb_build_object('inserted', false, 'reason', 'invalid-input');
  end if;

  -- Respect the WP1 operations freeze when it is deployed.
  if to_regclass('public.apn_system_controls') is not null
     and exists (select 1 from public.apn_system_controls where frozen = true) then
    raise exception 'APN operations are temporarily frozen.' using errcode = 'FZ001';
  end if;

  select * into v_collection from public.apn_revenue_collections where id = p_collection_id;
  if not found then
    raise exception 'Collection % not found in apn_revenue_collections.', p_collection_id
      using errcode = 'foreign_key_violation';
  end if;
  if coalesce(v_collection.received_amount, 0) <= 0 then
    return jsonb_build_object('inserted', false, 'reason', 'no-revenue');
  end if;

  -- Skip when the partner already belongs to a real referrer: their earnings
  -- are booked by apn_referral_collection_after_insert; self-earning on top
  -- would pay both the referrer and the partner for the same collection.
  select exists(
    select 1 from public.apn_referral_relationships
    where referred_id = p_partner_id and status = 'active'
  ) into v_has_referrer;
  if v_has_referrer then
    return jsonb_build_object('inserted', false, 'reason', 'linked',
      'partnerId', p_partner_id, 'collectionId', p_collection_id);
  end if;

  select * into v_settings from public.apn_referral_settings where id = 1;
  if not coalesce(v_settings.enabled, true) then
    return jsonb_build_object('inserted', false, 'reason', 'disabled');
  end if;

  v_percent := coalesce(p_percent, v_settings.default_percent);
  if v_percent < 0 or v_percent > 100 then
    raise exception 'Referral percent % out of range 0..100.', v_percent
      using errcode = 'check_violation';
  end if;
  v_amount := round(coalesce(v_collection.received_amount, 0) * v_percent / 100, 2);
  if v_amount <= 0 then
    return jsonb_build_object('inserted', false, 'reason', 'no-amount');
  end if;

  insert into public.apn_referral_earnings
    (relationship_id, referrer_id, referred_id, source_collection_id, project_id,
     revenue_amount, referral_percent, referral_amount, collection_at, snapshot)
  values
    (null, p_partner_id, p_partner_id, p_collection_id, v_collection.project_id,
     v_collection.received_amount, v_percent, v_amount,
     coalesce(v_collection.received_date::timestamptz, v_collection.created_at, now()),
     jsonb_build_object('source', 'rule-engine', 'selfEarning', true,
       'defaultPercent', v_settings.default_percent, 'enabled', coalesce(v_settings.enabled, true),
       'capturedAt', now(), 'collectionId', p_collection_id))
  on conflict (source_collection_id) do nothing
  returning id into v_earning_id;

  if v_earning_id is not null then
    perform public.apn_referral_audit('generated self referral earnings', p_partner_id, p_collection_id,
      jsonb_build_object('earningId', v_earning_id, 'amount', v_amount, 'percent', v_percent,
        'selfEarning', true, 'source', 'rule-engine'));
  end if;

  return jsonb_build_object('inserted', v_earning_id is not null, 'earningId', v_earning_id,
    'amount', v_amount, 'percent', v_percent,
    'reason', case when v_earning_id is not null then 'recorded' else 'duplicate' end);
end;
$$;

revoke all on function public.apn_engine_record_partner_earning(text, text, numeric) from public, anon;
grant execute on function public.apn_engine_record_partner_earning(text, text, numeric) to authenticated;

-- ── 03 Leaderboard: self-earnings must not inflate the "referred" count ───────
-- (their amounts still rank the partner; the partner is just not "referred".)
create or replace function public.apn_referral_leaderboard(p_period text default 'lifetime')
returns table (partner_id text, partner_name text, referral_count bigint, earnings numeric)
language sql security definer set search_path = public as $$
  select e.referrer_id, coalesce(u.data->>'name', 'APN Partner'),
    count(distinct case when e.referrer_id <> e.referred_id then e.referred_id end),
    round(sum(e.referral_amount), 2)
  from public.apn_referral_earnings e
  join public.apn_users u on u.id = e.referrer_id
  where e.status <> 'void'
    and (lower(coalesce(p_period, 'lifetime')) = 'lifetime'
      or (lower(p_period) = 'monthly' and e.created_at >= date_trunc('month', now()))
      or (lower(p_period) = 'yearly' and e.created_at >= date_trunc('year', now())))
    and (public.is_admin() or auth.uid() is not null)
  group by e.referrer_id, u.data
  order by sum(e.referral_amount) desc, count(distinct case when e.referrer_id <> e.referred_id then e.referred_id end) desc
  limit 50;
$$;

revoke all on function public.apn_referral_leaderboard(text) from public, anon;
grant execute on function public.apn_referral_leaderboard(text) to authenticated;

commit;

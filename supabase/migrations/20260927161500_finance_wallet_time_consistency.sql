-- Financial consistency hardening.
-- 1) APN wallet eligibility is time-derived, so reads must refresh after dates roll over.
-- 2) Consolidated wallet fields represent CURRENT balances, not lifetime eligible totals.
-- 3) Company Account balance refreshes all active APN derived wallets before aggregating.
begin;

create or replace function public.apn_consolidated_wallet_refresh(p_partner_id text)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_earned numeric := 0;
  v_pending numeric := 0;
  v_gross_eligible numeric := 0;
  v_reversed numeric := 0;
  v_recovery_total numeric := 0;
  v_withdrawn numeric := 0;
  v_reserved numeric := 0;
  v_current_eligible numeric := 0;
  v_total_balance numeric := 0;
  v_recovered numeric := 0;
  v_remaining numeric := 0;
  v_breakdown jsonb;
begin
  if p_partner_id is null or trim(p_partner_id) = '' then return; end if;

  -- Lifetime net earned after applying reversals to each original positive row.
  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    join public.apn_reversals rv on rv.reversal_ledger_id = r.id
    where rv.original_ledger_id = l.id
  ), 0))), 0)
  into v_earned
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id
    and l.source_type <> 'reversal'
    and l.amount > 0;

  -- Future-dated earnings are part of the partner's current account balance, but
  -- are not yet payable/withdrawable.
  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    join public.apn_reversals rv on rv.reversal_ledger_id = r.id
    where rv.original_ledger_id = l.id
  ), 0))) filter (where coalesce(l.eligible_from, l.event_at::date) > current_date), 0)
  into v_pending
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id and l.source_type <> 'reversal' and l.amount > 0;

  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    join public.apn_reversals rv on rv.reversal_ledger_id = r.id
    where rv.original_ledger_id = l.id
  ), 0))) filter (where coalesce(l.eligible_from, l.event_at::date) <= current_date), 0)
  into v_gross_eligible
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id and l.source_type <> 'reversal' and l.amount > 0;

  select coalesce(sum(abs(r.amount)), 0) into v_reversed
  from public.apn_commission_ledger r
  join public.apn_reversals rv on rv.reversal_ledger_id = r.id
  where r.partner_id = p_partner_id and r.source_type = 'reversal' and r.amount < 0;

  v_recovery_total := 0;
  v_recovered := 0;
  v_remaining := 0;

  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0)
  into v_withdrawn
  from public.apn_withdrawal_requests where partner_id = p_partner_id;
  v_withdrawn := v_withdrawn
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status = 'paid'), 0);

  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing')), 0)
  into v_reserved
  from public.apn_withdrawal_requests where partner_id = p_partner_id;
  v_reserved := v_reserved
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0);

  -- Current balances (not lifetime figures): paid withdrawals reduce eligible and
  -- total balance; open requests only reserve funds and therefore reduce the
  -- withdrawable amount, not ownership of the balance itself.
  v_current_eligible := greatest(0, v_gross_eligible - v_withdrawn);
  v_total_balance := greatest(0, v_earned - v_withdrawn);

  v_breakdown := jsonb_build_object(
    'partner', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='partner' and l.source_type <> 'reversal' and l.amount>0),0),
    'referral', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='referral' and l.source_type <> 'reversal' and l.amount>0),0),
    'district', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='district' and l.source_type <> 'reversal' and l.amount>0),0),
    'state', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='state' and l.source_type <> 'reversal' and l.amount>0),0),
    'adjustment', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='adjustment' and l.source_type <> 'reversal' and l.amount>0),0),
    'reversal', v_reversed, 'recovery', v_recovery_total
  );

  perform set_config('apn.consolidated.refresh', 'on', true);
  insert into public.apn_consolidated_wallets
    (partner_id, earned, pending, eligible, total_balance, reserved, withdrawable, withdrawn,
     reversed, recovery_outstanding, recovery_recovered, recovery_remaining, commission_breakdown, updated_at)
  values
    (p_partner_id, v_earned, v_pending, v_current_eligible, v_total_balance, v_reserved,
     greatest(0, v_current_eligible - v_reserved), v_withdrawn,
     v_reversed, v_recovery_total, v_recovered, v_remaining, v_breakdown, now())
  on conflict (partner_id) do update set
    earned=excluded.earned, pending=excluded.pending, eligible=excluded.eligible,
    total_balance=excluded.total_balance, reserved=excluded.reserved,
    withdrawable=excluded.withdrawable, withdrawn=excluded.withdrawn,
    reversed=excluded.reversed, recovery_outstanding=excluded.recovery_outstanding,
    recovery_recovered=excluded.recovery_recovered, recovery_remaining=excluded.recovery_remaining,
    commission_breakdown=excluded.commission_breakdown, updated_at=now();
end;
$$;

-- Snapshot reads are intentionally VOLATILE: current_date changes eligibility even
-- when no database row changes. Refreshing here prevents yesterday's pending state
-- from surviving indefinitely in Wallet or ALLBEE AI.
create or replace function public.apn_partner_financial_snapshot()
returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp as $$
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

  perform public.apn_consolidated_wallet_refresh(v_pid);
  perform public.apn_withdrawal_refresh_wallet(v_pid);
  perform public.apn_referral_refresh_wallet(v_pid);

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
          'collectionId', e.source_collection_id,
          'projectName', coalesce(project_u.data->>'projectName', l.snapshot->>'projectName', 'Project — not specified'),
          'clientName', coalesce(project_u.data->>'clientName', l.snapshot->>'clientName', '—'),
          'projectValue', coalesce(project_u.data->>'projectValue', '0'),
          'collectionAmount', coalesce(collection_u.received_amount::text, '0'),
          'collectionDate', coalesce(collection_u.received_date::text, '')
        ) else '{}'::jsonb end
      )
    )) order by l.event_at desc), '[]'::jsonb)
    into v_ledger
  from (
    select * from public.apn_commission_ledger where partner_id = v_pid order by event_at desc limit 30
  ) l
  left join public.apn_referral_earnings e on l.commission_type = 'referral' and e.id::text = l.source_id
  left join public.apn_users referred_u on referred_u.id = e.referred_id
  left join public.apn_users referrer_u on referrer_u.id = e.referrer_id
  left join public.apn_commission_projects project_u on project_u.id = e.project_id
  left join public.apn_revenue_collections collection_u on collection_u.id = e.source_collection_id;

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

-- Finance-side balance reads also refresh derived APN wallets first. This makes
-- the dashboard/account totals independent of which partner last opened Wallet.
create or replace function public.finance_account_balances()
returns jsonb
language plpgsql
security definer
volatile
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_haji numeric := 0;
  v_alim numeric := 0;
  v_company numeric := 0;
  v_apn_unwithdrawn numeric := 0;
  v_partners jsonb := '[]'::jsonb;
  r record;
begin
  if not public.can_finance() then
    raise exception 'Finance balance access denied.' using errcode='insufficient_privilege';
  end if;

  for r in
    select u.id from public.apn_users u
    where lower(coalesce(u.data->>'status','active')) not in ('inactive','suspended','deleted')
  loop
    perform public.apn_consolidated_wallet_refresh(r.id);
  end loop;

  select
    coalesce(sum(case
      when lower(coalesce(t.data->>'kind',''))='income' then coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'hajiPct')::numeric,0) / 100
      when lower(coalesce(t.data->>'kind',''))='expense' then -coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'hajiPct')::numeric,0) / 100
      else 0 end),0),
    coalesce(sum(case
      when lower(coalesce(t.data->>'kind',''))='income' then coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'alimPct')::numeric,0) / 100
      when lower(coalesce(t.data->>'kind',''))='expense' then -coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'alimPct')::numeric,0) / 100
      else 0 end),0)
  into v_haji, v_alim
  from public.transactions t;

  v_haji := v_haji - coalesce((select sum(coalesce((w.data->>'amount')::numeric,0)) from public.withdrawals w where w.data->>'user'='Haji' and lower(coalesce(w.data->>'status','approved')) not in ('pending','rejected')),0);
  v_alim := v_alim - coalesce((select sum(coalesce((w.data->>'amount')::numeric,0)) from public.withdrawals w where w.data->>'user'='Alim' and lower(coalesce(w.data->>'status','approved')) not in ('pending','rejected')),0);
  v_company := round(v_haji + v_alim,2);

  with active_wallets as (
    select
      w.partner_id,
      coalesce(u.data->>'name',u.data->>'username','APN Partner') as name,
      coalesce(u.data->>'apn_id',u.data->>'apnId','') as apn_id,
      coalesce(u.data->>'status','active') as status,
      coalesce(u.data->>'role','partner') as role,
      coalesce(w.earned,0) as earned,
      coalesce(w.pending,0) as pending,
      coalesce(w.eligible,0) as eligible,
      coalesce(w.total_balance,0) as total_balance,
      coalesce(w.reserved,0) as reserved,
      coalesce(w.withdrawable,0) as withdrawable,
      coalesce(w.withdrawn,0) as withdrawn,
      coalesce(w.reversed,0) as reversed,
      greatest(0,coalesce(w.earned,0)-coalesce(w.withdrawn,0)) as unwithdrawn
    from public.apn_consolidated_wallets w
    join public.apn_users u on u.id=w.partner_id
    where lower(coalesce(u.data->>'status','active')) not in ('inactive','suspended','deleted')
  )
  select
    coalesce(sum(unwithdrawn),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'partner_id',partner_id,'name',name,'apn_id',apn_id,'status',status,'role',role,
      'earned',round(earned,2),'pending',round(pending,2),'eligible',round(eligible,2),
      'total_balance',round(total_balance,2),'reserved',round(reserved,2),
      'withdrawable',round(withdrawable,2),'withdrawn',round(withdrawn,2),
      'reversed',round(reversed,2),'unwithdrawn',round(unwithdrawn,2)
    ) order by unwithdrawn desc,name),'[]'::jsonb)
  into v_apn_unwithdrawn,v_partners
  from active_wallets;

  return jsonb_build_object(
    'generated_at',now(),'haji',round(v_haji,2),'alim',round(v_alim,2),
    'company',v_company,'apn_unwithdrawn',round(v_apn_unwithdrawn,2),
    'account',round(v_company+v_apn_unwithdrawn,2),'partner_balances',v_partners
  );
end $$;

revoke all on function public.finance_account_balances() from public,anon;
grant execute on function public.finance_account_balances() to authenticated;

-- Repair all derived caches immediately. This does not alter immutable ledger
-- history; it only recomputes current wallet projections from that history.
do $$
declare r record;
begin
  for r in
    select u.id from public.apn_users u
    where lower(coalesce(u.data->>'status','active')) not in ('inactive','suspended','deleted')
  loop
    perform public.apn_consolidated_wallet_refresh(r.id);
    perform public.apn_withdrawal_refresh_wallet(r.id);
    perform public.apn_referral_refresh_wallet(r.id);
  end loop;
end $$;

commit;
notify pgrst,'reload schema';

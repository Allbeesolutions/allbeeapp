-- =============================================================================
-- ALLBEE — Financial Wallet Consistency Hardening (Neon Port)
-- File: database/neon/019_apn_wallet_consistency.sql
--
-- Ported from: supabase/migrations/20260927161500_finance_wallet_time_consistency.sql
-- =============================================================================

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

  v_current_eligible := greatest(0, v_gross_eligible - v_withdrawn);
  v_total_balance := greatest(0, v_earned - v_withdrawn);

  v_breakdown := jsonb_build_object(
    'partner', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='partner' and l.source_type <> 'reversal' and l.amount>0),0),
    'referral', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='referral' and l.source_type <> 'reversal' and l.amount>0),0),
    'district', coalesce((select sum(greatest(0,l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r join public.apn_reversals rv on rv.reversal_ledger_id=r.id where rv.original_ledger_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_// la l.commission_type='district' and l.source_type <> 'reversal' and l.amount>0),0),
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
      greatest(0,w.earned-w.withdrawn) as unwithdrawn
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

commit;
notify pgrst, 'reload schema';

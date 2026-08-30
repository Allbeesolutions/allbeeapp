-- APN wallet: earned/pending/eligible must reflect valid earnings after reversals.
-- Reversal ledger rows remain immutable history, but a fully reversed earning
-- must no longer appear as earned or pending in the partner wallet.

create or replace function public.apn_consolidated_wallet_refresh(p_partner_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_earned numeric := 0;
  v_pending numeric := 0;
  v_gross_eligible numeric := 0;
  v_reversed numeric := 0;
  v_recovery_total numeric := 0;
  v_withdrawn numeric := 0;
  v_reserved numeric := 0;
  v_net_eligible numeric := 0;
  v_recovered numeric := 0;
  v_remaining numeric := 0;
  v_eligible numeric := 0;
  v_breakdown jsonb;
begin
  if p_partner_id is null or trim(p_partner_id) = '' then return; end if;

  -- Net each original earning against its reversal events. This preserves
  -- the original ledger rows while removing revoked earnings from balances.
  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    where r.commission_type = 'reversal' and r.original_event_id = l.id
  ), 0))), 0)
  into v_earned
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id
    and l.commission_type in ('partner','referral','district','state','adjustment')
    and l.amount > 0;

  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    where r.commission_type = 'reversal' and r.original_event_id = l.id
  ), 0))) filter (where coalesce(l.eligible_from, l.event_at::date) > current_date), 0)
  into v_pending
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id
    and l.commission_type in ('partner','referral','district','state','adjustment')
    and l.amount > 0;

  select coalesce(sum(greatest(0, l.amount + coalesce((
    select sum(r.amount) from public.apn_commission_ledger r
    where r.commission_type = 'reversal' and r.original_event_id = l.id
  ), 0))) filter (where coalesce(l.eligible_from, l.event_at::date) <= current_date), 0)
  into v_gross_eligible
  from public.apn_commission_ledger l
  where l.partner_id = p_partner_id
    and l.commission_type in ('partner','referral','district','state','adjustment')
    and l.amount > 0;

  select coalesce(sum(-amount) filter (where commission_type = 'reversal'), 0)
  into v_reversed
  from public.apn_commission_ledger
  where partner_id = p_partner_id and amount < 0;

  select coalesce(sum(-amount) filter (where commission_type = 'recovery'), 0)
  into v_recovery_total
  from public.apn_commission_ledger
  where partner_id = p_partner_id and amount < 0;

  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0)
  into v_withdrawn
  from public.apn_withdrawal_requests where partner_id = p_partner_id;

  v_withdrawn := v_withdrawn
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status = 'paid'), 0)
    + coalesce((select sum(commission_generated) from public.apn_revenue_collections where partner_id = p_partner_id and commission_status = 'Paid'), 0)
    + coalesce((select sum(case when coalesce(c.data->>'amount','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (c.data->>'amount')::numeric else 0 end)
                from public.apn_commissions c
                where c.data->>'partnerId' = p_partner_id and coalesce(c.data->>'kind','partner') <> 'district'
                  and coalesce(c.data->>'status','Pending') = 'Paid'), 0);

  select coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing')), 0)
  into v_reserved
  from public.apn_withdrawal_requests where partner_id = p_partner_id;

  v_reserved := v_reserved
    + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0);

  v_net_eligible := greatest(0, v_gross_eligible);
  v_eligible := v_net_eligible;
  v_recovered := least(v_recovery_total, v_net_eligible);
  v_remaining := greatest(0, v_recovery_total - v_recovered);

  v_breakdown := jsonb_build_object(
    'partner', coalesce((select sum(greatest(0, l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r where r.commission_type='reversal' and r.original_event_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='partner' and l.amount>0),0),
    'referral', coalesce((select sum(greatest(0, l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r where r.commission_type='reversal' and r.original_event_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='referral' and l.amount>0),0),
    'district', coalesce((select sum(greatest(0, l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r where r.commission_type='reversal' and r.original_event_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='district' and l.amount>0),0),
    'state', coalesce((select sum(greatest(0, l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r where r.commission_type='reversal' and r.original_event_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='state' and l.amount>0),0),
    'adjustment', coalesce((select sum(greatest(0, l.amount + coalesce((select sum(r.amount) from public.apn_commission_ledger r where r.commission_type='reversal' and r.original_event_id=l.id),0))) from public.apn_commission_ledger l where l.partner_id=p_partner_id and l.commission_type='adjustment' and l.amount>0),0),
    'reversal', v_reversed,
    'recovery', v_recovery_total
  );

  perform set_config('apn.consolidated.refresh', 'on', true);
  insert into public.apn_consolidated_wallets
    (partner_id, earned, pending, eligible, total_balance, reserved, withdrawable, withdrawn,
     reversed, recovery_outstanding, recovery_recovered, recovery_remaining, commission_breakdown, updated_at)
  values
    (p_partner_id, v_earned, v_pending, v_eligible, v_net_eligible, v_reserved,
     greatest(0, v_net_eligible - v_withdrawn - v_reserved - v_remaining), v_withdrawn,
     v_reversed, v_recovery_total, v_recovered, v_remaining, v_breakdown, now())
  on conflict (partner_id) do update set
    earned = excluded.earned, pending = excluded.pending, eligible = excluded.eligible,
    total_balance = excluded.total_balance, reserved = excluded.reserved,
    withdrawable = excluded.withdrawable, withdrawn = excluded.withdrawn,
    reversed = excluded.reversed, recovery_outstanding = excluded.recovery_outstanding,
    recovery_recovered = excluded.recovery_recovered, recovery_remaining = excluded.recovery_remaining,
    commission_breakdown = excluded.commission_breakdown, updated_at = now();
end;
$$;

revoke all on function public.apn_consolidated_wallet_refresh(text) from public, anon;
grant execute on function public.apn_consolidated_wallet_refresh(text) to authenticated;

select pg_notify('pgrst', 'reload schema');

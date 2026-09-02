-- ALLBEE — Financial/Data Integrity hardening
-- Fixes reversal linkage to the actual additive reversal model.
-- Also makes ledger caps concurrency-safe and rejects invalid credits.
begin;

create or replace function public.apn_ledger_entry(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row public.apn_commission_ledger%rowtype;
  v_secondary numeric;
  v_total numeric;
  v_base numeric := greatest(0, coalesce(p_base_amount, 0));
  v_event timestamptz := coalesce(p_event_at, now());
  v_max_percent numeric;
begin
  if not (public.is_admin() or public.can_module('apn')) then
    raise exception 'Only APN administrators may record ledger entries.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();
  if nullif(trim(p_idempotency_key), '') is null or nullif(trim(p_source_id), '') is null then
    raise exception 'Ledger idempotency key and source id are required.' using errcode = 'check_violation';
  end if;
  if p_amount is null or p_amount <= 0 or p_base_amount is null or p_base_amount < 0 then
    raise exception 'Ledger credit amount must be positive and base amount cannot be negative.' using errcode = 'check_violation';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'Ledger commission rate must be between 0 and 100.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.apn_users u where u.id = p_partner_id) then
    raise exception 'Unknown APN partner.' using errcode = 'foreign_key_violation';
  end if;

  -- Serialize credits for one source event so the 15%/35% caps cannot be
  -- bypassed by concurrent transactions that both pass a pre-insert SUM.
  perform pg_advisory_xact_lock(hashtextextended(p_source_type || ':' || p_source_id, 0));

  select * into v_row from public.apn_commission_ledger where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_row.id, 'duplicate', true, 'amount', v_row.amount);
  end if;

  select max(r.max_percent) into v_max_percent
  from public.apn_rule_sets rs
  join public.apn_commission_rules r on r.rule_set_id = rs.id
  where rs.status = 'active'
    and rs.effective_from <= v_event
    and (rs.effective_to is null or rs.effective_to >= v_event)
    and r.commission_type = p_commission_type
    and r.active;
  if v_max_percent is not null and p_percent > v_max_percent then
    raise exception 'Rate % exceeds the active rule maximum (%) for %.', p_percent, v_max_percent, p_commission_type
      using errcode = 'check_violation';
  end if;

  if p_commission_type in ('referral','district','state') then
    select coalesce(sum(amount), 0) into v_secondary
    from public.apn_commission_ledger
    where source_id = p_source_id and source_type = p_source_type
      and commission_type in ('referral','district','state') and amount > 0;
    if v_secondary + p_amount > round(v_base * 15 / 100, 2) then
      raise exception 'Secondary commission cap exceeded (15%% max per event).' using errcode = 'check_violation';
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from public.apn_commission_ledger
  where source_id = p_source_id and source_type = p_source_type and amount > 0;
  if v_total + p_amount > round(v_base * 35 / 100, 2) then
    raise exception 'Total commission cap exceeded (35%% max per event).' using errcode = 'check_violation';
  end if;

  insert into public.apn_commission_ledger
    (idempotency_key, source_id, source_type, partner_id, commission_type,
     base_amount, percent, amount, event_at, snapshot, created_by)
  values
    (p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
     v_base, p_percent, p_amount, v_event, coalesce(p_snapshot, '{}'::jsonb), auth.uid()::text)
  returning * into v_row;

  perform public.apn_rule_audit('recorded ledger entry', 'apn_commission_ledger', v_row.id::text,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'commissionType', p_commission_type,
      'amount', p_amount, 'sourceType', p_source_type));
  return jsonb_build_object('id', v_row.id, 'duplicate', false, 'amount', v_row.amount,
    'commissionType', v_row.commission_type);
end;
$$;

revoke all on function public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb) from public, anon;
grant execute on function public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb) to authenticated;

create or replace function public.apn_consolidated_wallet_refresh(p_partner_id text)
returns void
language plpgsql security definer
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

  -- Reversals are linked through apn_reversals.reversal_ledger_id and the
  -- original row's reversed_by marker. They retain the original commission_type.
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

  -- There is no recovery commission type in the immutable ledger schema.
  -- Keep the wallet recovery fields deterministic at zero until a governed
  -- recovery transaction model is introduced.
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

  v_net_eligible := greatest(0, v_gross_eligible);
  v_eligible := v_net_eligible;

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
    (p_partner_id, v_earned, v_pending, v_eligible, v_net_eligible, v_reserved,
     greatest(0, v_net_eligible - v_withdrawn - v_reserved), v_withdrawn,
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

revoke all on function public.apn_consolidated_wallet_refresh(text) from public, anon;
grant execute on function public.apn_consolidated_wallet_refresh(text) to authenticated;

notify pgrst, 'reload schema';
commit;

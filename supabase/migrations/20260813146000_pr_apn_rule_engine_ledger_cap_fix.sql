-- =============================================================================
-- ALLBEE — APN Rule Engine Foundation: ledger total-cap fix (incremental)
--
-- The 35% total-cap check in apn_ledger_entry was nested inside the
-- secondary-type branch, so partner (primary) entries bypassed the total cap.
-- This migration redeploys the corrected function (verified live by the
-- foundation verify migration). Idempotent: create-or-replace.
-- =============================================================================

-- Record one immutable ledger entry (replay-safe via idempotency_key).
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
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
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
  if not exists (select 1 from public.apn_users u where u.id = p_partner_id) then
    raise exception 'Unknown APN partner.' using errcode = 'foreign_key_violation';
  end if;
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
      and commission_type in ('referral','district','state')
      and amount > 0;
    if v_secondary + p_amount > round(v_base * 15 / 100, 2) then
      raise exception 'Secondary commission cap exceeded (15%% max per event).' using errcode = 'check_violation';
    end if;
  end if;
  select coalesce(sum(amount), 0) into v_total
  from public.apn_commission_ledger
  where source_id = p_source_id and source_type = p_source_type
    and amount > 0;
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
    'commissionType', p_commission_type);
end;
$$;
revoke all on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) from public, anon;
grant execute on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) to authenticated;

-- =============================================================================
-- ALLBEE — APN Rule Engine Foundation: reversal marker fix (incremental)
--
-- apn_create_reversal now sets the additive reversed_by marker on the original
-- ledger entry (financial fields untouched) so the ledger itself shows the
-- reversal. Idempotent: create-or-replace.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REVERSAL MODEL (additive: original ledger entry is NEVER touched)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_reversals (
  id uuid primary key default gen_random_uuid(),
  original_ledger_id uuid not null unique references public.apn_commission_ledger(id) on delete restrict,
  reversal_ledger_id uuid unique references public.apn_commission_ledger(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  initiated_by text,
  status text not null default 'pending' check (status in ('pending','applied','rejected')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.apn_reversals enable row level security;
revoke all on public.apn_reversals from public, anon, authenticated;
grant select on public.apn_reversals to authenticated;

drop policy if exists apn_reversals_read on public.apn_reversals;
create policy apn_reversals_read on public.apn_reversals
  for select to authenticated
  using (public.is_superadmin() or public.is_admin()
    or exists (
      select 1 from public.apn_commission_ledger l
      where l.id = apn_reversals.original_ledger_id and l.partner_id = auth.uid()::text
    ));

create or replace function public.apn_create_reversal(p_original_ledger_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_orig public.apn_commission_ledger%rowtype;
  v_rev_id uuid;
  v_reversal_id uuid;
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may reverse ledger entries.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reversal reason is required.' using errcode = 'check_violation';
  end if;
  select * into v_orig from public.apn_commission_ledger where id = p_original_ledger_id;
  if not found then
    raise exception 'Ledger entry not found.' using errcode = 'no_data_found';
  end if;
  if v_orig.source_type = 'reversal' then
    raise exception 'A reversal entry cannot itself be reversed.' using errcode = 'check_violation';
  end if;
  if v_orig.reversed_by is not null then
    raise exception 'This ledger entry has already been reversed.' using errcode = 'duplicate_object';
  end if;
  if exists (select 1 from public.apn_reversals where original_ledger_id = p_original_ledger_id) then
    raise exception 'This ledger entry has already been reversed.' using errcode = 'duplicate_object';
  end if;
  -- Conservative guard: no reversal once a payout may have occurred for this
  -- partner after the original event (wallet-level linkage is not wired yet).
  if exists (
    select 1 from public.apn_wallet_transactions wt
    where wt.partner_id = v_orig.partner_id
      and wt.entry_type in ('payment','release')
      and wt.created_at >= v_orig.event_at
  ) then
    raise exception 'This entry cannot be reversed because funds may already have been paid out.' using errcode = 'check_violation';
  end if;
  insert into public.apn_reversals (original_ledger_id, amount, reason, initiated_by, status)
  values (p_original_ledger_id, v_orig.amount, p_reason, auth.uid()::text, 'applied')
  returning id into v_reversal_id;
  select id into v_rev_id from public.apn_commission_ledger where idempotency_key = 'rev:' || p_original_ledger_id::text;
  if v_rev_id is null then
    insert into public.apn_commission_ledger
      (idempotency_key, source_id, source_type, partner_id, commission_type,
       base_amount, percent, amount, event_at, snapshot, created_by, reversed_by)
    values
      ('rev:' || p_original_ledger_id::text, v_orig.id::text, 'reversal', v_orig.partner_id, v_orig.commission_type,
       v_orig.base_amount, v_orig.percent, -v_orig.amount, now(),
       jsonb_build_object('reversalId', v_reversal_id, 'reason', p_reason), auth.uid()::text, v_orig.id)
    returning id into v_rev_id;
  end if;
  -- Additive marker on the original (financial fields untouched): points at the
  -- counter-entry so the ledger itself shows the reversal without any rewrite.
  update public.apn_commission_ledger set reversed_by = v_rev_id where id = v_orig.id;
  update public.apn_reversals set reversal_ledger_id = v_rev_id, applied_at = now()
  where id = v_reversal_id;
  perform public.apn_ensure_finance_expense(v_rev_id);
  perform public.apn_rule_audit('applied reversal', 'apn_reversals', v_reversal_id::text,
    jsonb_build_object('originalLedgerId', p_original_ledger_id::text, 'amount', v_orig.amount));
  return jsonb_build_object('reversalId', v_reversal_id, 'reversalLedgerId', v_rev_id,
    'amount', v_orig.amount, 'additive', true);
end;
$$;
revoke all on function public.apn_create_reversal(uuid, text) from public, anon;
grant execute on function public.apn_create_reversal(uuid, text) to authenticated;

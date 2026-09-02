-- #24 Withdrawal lifecycle hardening: fail closed on replay, cross-partner,
-- invalid referral transitions, and settlement duplication.
begin;

create or replace function public.apn_referral_set_withdrawal_status(
  p_withdrawal_id uuid, p_status text, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_value public.apn_referral_withdrawals%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review referral withdrawals.' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('approved','rejected','paid') then
    raise exception 'Invalid withdrawal status.' using errcode = 'invalid_parameter_value';
  end if;
  select * into row_value from public.apn_referral_withdrawals
    where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Referral withdrawal not found.' using errcode = 'no_data_found';
  end if;
  if p_status = 'approved' and row_value.status <> 'pending' then
    raise exception 'Only pending referral withdrawals can be approved.' using errcode = 'check_violation';
  end if;
  if p_status = 'rejected' and row_value.status <> 'pending' then
    raise exception 'Only pending referral withdrawals can be rejected.' using errcode = 'check_violation';
  end if;
  if p_status = 'paid' and row_value.status <> 'approved' then
    raise exception 'Only approved referral withdrawals can be paid.' using errcode = 'check_violation';
  end if;
  update public.apn_referral_withdrawals
    set status = p_status,
        reviewed_at = coalesce(reviewed_at, now()),
        reviewed_by = auth.uid()::text,
        paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
        note = coalesce(p_note, note)
    where id = p_withdrawal_id
    returning * into row_value;
  insert into public.apn_referral_timeline
    (partner_id, event_type, title, description, related_id, created_by)
  values
    (row_value.partner_id, 'withdrawal-' || p_status,
     'Referral withdrawal ' || p_status,
     coalesce(p_note, 'Referral withdrawal is now ' || p_status || '.'),
     row_value.id::text, auth.uid()::text);
  perform public.apn_referral_notify(row_value.partner_id,
    'Referral withdrawal ' || p_status,
    coalesce(p_note, 'Your referral withdrawal is now ' || p_status || '.'),
    'referral-withdrawal');
  perform public.apn_referral_audit('updated referral withdrawal', row_value.partner_id,
    row_value.id::text, jsonb_build_object('status', row_value.status, 'amount', row_value.amount));
  return jsonb_build_object('id', row_value.id, 'status', row_value.status, 'amount', row_value.amount);
end;
$$;

-- The primary settlement record is one-to-one with a request, so a successful
-- payment can never create a second settlement row for the same request.
-- Keep all client roles out of direct settlement/ledger mutation.
revoke insert, update, delete, truncate, references, trigger on table public.apn_withdrawal_settlements from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.apn_wallet_transactions from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.apn_withdrawal_finance_transactions from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.apn_withdrawal_status_history from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.apn_withdrawal_audit from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.apn_referral_withdrawals from public, anon, authenticated;

-- Preserve the audited RPC surface after revoking direct table access.
grant execute on function public.apn_referral_set_withdrawal_status(uuid,text,text) to authenticated;

do $$
declare
  v_name text;
  v_def text;
  v_oid oid;
  v_required text[] := array[
    'apn_request_withdrawal','apn_withdrawal_review','apn_cancel_withdrawal',
    'apn_reopen_withdrawal','apn_unlock_withdrawal_wallet',
    'apn_create_withdrawal_batch','apn_upsert_withdrawal_bank_account',
    'apn_referral_request_withdrawal','apn_referral_set_withdrawal_status'
  ];
begin
  foreach v_name in array v_required loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
    ) then
      raise exception 'WITHDRAWAL BREAK TEST FAILED: missing RPC %', v_name;
    end if;
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
        and (has_function_privilege('public', p.oid, 'EXECUTE')
          or has_function_privilege('anon', p.oid, 'EXECUTE'))
    ) then
      raise exception 'WITHDRAWAL BREAK TEST FAILED: anonymous execution remains on %', v_name;
    end if;
  end loop;

  -- Every production withdrawal table remains protected from direct client writes.
  foreach v_name in array array[
    'apn_withdrawal_requests','apn_withdrawal_settlements','apn_wallet_transactions',
    'apn_withdrawal_finance_transactions','apn_withdrawal_status_history',
    'apn_withdrawal_audit','apn_referral_withdrawals'
  ] loop
    if not (select c.relrowsecurity from pg_class c
      where c.oid = to_regclass('public.' || v_name)) then
      raise exception 'WITHDRAWAL BREAK TEST FAILED: RLS disabled on %', v_name;
    end if;
  end loop;

  -- Settlement uniqueness is structural, not application-only.
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public' and t.relname='apn_withdrawal_settlements'
      and c.contype='u' and pg_get_constraintdef(c.oid) ilike '%request_id%'
  ) then
    raise exception 'WITHDRAWAL BREAK TEST FAILED: settlement request uniqueness missing';
  end if;

  -- Required ownership and lifecycle guards are present in live function source.
  foreach v_name in array array['apn_request_withdrawal','apn_cancel_withdrawal','apn_reopen_withdrawal'] loop
    select p.oid, pg_get_functiondef(p.oid) into v_oid, v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=v_name and p.prosecdef
    order by p.oid desc limit 1;
    if v_oid is null or v_def not ilike '%auth.uid()%' then
      raise exception 'WITHDRAWAL BREAK TEST FAILED: identity guard missing from %', v_name;
    end if;
  end loop;

  select p.oid, pg_get_functiondef(p.oid) into v_oid, v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_withdrawal_review' and p.prosecdef
  order by p.oid desc limit 1;
  if v_oid is null or v_def not ilike '%where id = p_request_id for update%'
     or v_def not ilike '%Only processing requests can be marked paid%'
     or v_def not ilike '%Only approved requests can be marked processing%' then
    raise exception 'WITHDRAWAL BREAK TEST FAILED: primary lifecycle locking/transition guards missing';
  end if;

  select p.oid, pg_get_functiondef(p.oid) into v_oid, v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_referral_request_withdrawal' and p.prosecdef
  order by p.oid desc limit 1;
  if v_oid is null or v_def not ilike '%auth.uid()%' or v_def not ilike '%for update%' then
    raise exception 'WITHDRAWAL BREAK TEST FAILED: referral ownership/wallet lock missing';
  end if;

  select p.oid, pg_get_functiondef(p.oid) into v_oid, v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_referral_set_withdrawal_status' and p.prosecdef
  order by p.oid desc limit 1;
  if v_oid is null or v_def not ilike '%for update%'
     or v_def not ilike '%Only pending referral withdrawals can be approved%'
     or v_def not ilike '%Only approved referral withdrawals can be paid%' then
    raise exception 'WITHDRAWAL BREAK TEST FAILED: referral replay/transition guards missing';
  end if;

  raise notice 'WITHDRAWAL LIFECYCLE BREAK TESTS PASSED';
end;
$$;

commit;
notify pgrst, 'reload schema';

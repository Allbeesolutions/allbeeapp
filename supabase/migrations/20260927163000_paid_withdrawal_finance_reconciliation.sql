-- Reconcile paid APN withdrawals into company accounting and harden the paid bridge.
-- A paid partner withdrawal is real company cash outflow. Every paid request must have:
-- request -> settlement -> withdrawal_paid finance journal -> deterministic company expense.
begin;

create or replace function public.apn_withdrawal_paid_to_finance()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_txn_id text := 'apn-expense-withdrawal:' || new.id::text;
  v_paid_at timestamptz := coalesce(new.created_at, now());
  v_period text;
  v_haji numeric := 50;
  v_alim numeric := 50;
  v_latest_period text;
  v_total numeric;
  v_h numeric;
  v_a numeric;
  v_payload jsonb;
  v_partner_name text;
begin
  if new.transaction_type <> 'withdrawal_paid' or coalesce(new.amount,0) <= 0 then return new; end if;
  if exists (select 1 from public.transactions where id = v_txn_id) then return new; end if;

  select coalesce(r.paid_at, s.paid_at, new.created_at, now())
  into v_paid_at
  from public.apn_withdrawal_requests r
  left join public.apn_withdrawal_settlements s on s.id = new.settlement_id
  where r.id = new.request_id;
  v_paid_at := coalesce(v_paid_at, new.created_at, now());
  v_period := to_char(v_paid_at, 'YYYY-MM');

  -- Company expense sharing follows the latest revenue-share period strictly
  -- before the payout month. Use JSON fields: transactions is a JSON-row table.
  select max(to_char((t.data->>'date')::date, 'YYYY-MM')) into v_latest_period
  from public.transactions t
  where lower(coalesce(t.data->>'kind',''))='income'
    and coalesce((t.data->>'amount')::numeric,0) > 0
    and to_char((t.data->>'date')::date,'YYYY-MM') < v_period;

  if v_latest_period is not null then
    select
      coalesce(sum((t.data->>'amount')::numeric * coalesce((t.data->>'hajiPct')::numeric,50) / 100),0),
      coalesce(sum((t.data->>'amount')::numeric * coalesce((t.data->>'alimPct')::numeric,50) / 100),0)
    into v_h, v_a
    from public.transactions t
    where lower(coalesce(t.data->>'kind',''))='income'
      and to_char((t.data->>'date')::date,'YYYY-MM') = v_latest_period;
    v_total := v_h + v_a;
    if v_total > 0 then
      v_haji := round(v_h/v_total*100,2);
      v_alim := round(100-v_haji,2);
    end if;
  end if;

  select coalesce(u.data->>'name','APN Partner') into v_partner_name
  from public.apn_users u where u.id = new.partner_id;

  v_payload := jsonb_build_object(
    'id',v_txn_id,
    'kind','expense',
    'date',v_paid_at::date::text,
    'category','APN Withdrawal',
    'scope','company',
    'amount',round(new.amount,2),
    'hajiPct',v_haji,
    'alimPct',v_alim,
    'notes',format('APN withdrawal paid to %s.',coalesce(v_partner_name,'APN Partner')),
    'source','apn-withdrawal',
    'apnWithdrawalExpense',true,
    'apnWithdrawalFinanceId',new.id::text,
    'apnWithdrawalRequestId',new.request_id::text,
    'apnPartnerId',new.partner_id,
    'apnWalletType',new.wallet_type,
    'apnWithdrawalReference',new.reference,
    'createdAt',(extract(epoch from v_paid_at)*1000)::bigint::text
  );

  perform set_config('row_security','off',true);
  insert into public.transactions(id,data,updated_at)
  values(v_txn_id,v_payload,now())
  on conflict(id) do nothing;
  return new;
end;
$$;

-- Repair historical paid requests that predate/escaped the settlement+finance journal.
do $$
declare
  r record;
  v_settlement_id uuid;
begin
  for r in
    select req.*
    from public.apn_withdrawal_requests req
    where req.status='paid'
      and coalesce(req.approved_amount,req.requested_amount) > 0
      and not exists (
        select 1 from public.apn_withdrawal_finance_transactions f
        where f.request_id=req.id and f.transaction_type='withdrawal_paid'
      )
    order by req.paid_at,req.id
  loop
    select s.id into v_settlement_id
    from public.apn_withdrawal_settlements s
    where s.request_id=r.id;

    if v_settlement_id is null then
      insert into public.apn_withdrawal_settlements
        (request_id,batch_id,partner_id,wallet_type,amount,payment_method,payment_reference,paid_at,paid_by,receipt_snapshot)
      values
        (r.id,r.batch_id,r.partner_id,r.wallet_type,round(coalesce(r.approved_amount,r.requested_amount),2),
         r.preferred_method,r.settlement_reference,coalesce(r.paid_at,r.updated_at,now()),r.reviewed_by,
         coalesce(r.bank_snapshot,'{}'::jsonb))
      returning id into v_settlement_id;
    end if;

    insert into public.apn_withdrawal_finance_transactions
      (request_id,settlement_id,partner_id,wallet_type,transaction_type,amount,reference,created_at,created_by,metadata)
    values
      (r.id,v_settlement_id,r.partner_id,r.wallet_type,'withdrawal_paid',
       round(coalesce(r.approved_amount,r.requested_amount),2),r.settlement_reference,
       coalesce(r.paid_at,r.updated_at,now()),r.reviewed_by,
       jsonb_build_object('historicalReconciliation',true,'source','paid-request-repair'));
  end loop;
end $$;

-- Recompute affected derived wallets after accounting repair.
do $$
declare r record;
begin
  for r in select distinct partner_id from public.apn_withdrawal_requests where status='paid' loop
    perform public.apn_consolidated_wallet_refresh(r.partner_id);
    perform public.apn_withdrawal_refresh_wallet(r.partner_id);
  end loop;
end $$;

commit;
notify pgrst,'reload schema';

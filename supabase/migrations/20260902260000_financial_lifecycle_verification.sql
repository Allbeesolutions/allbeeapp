-- #29: end-to-end financial lifecycle verification; read-only, fail-closed.
begin;

do $$
declare v_bad bigint; v_n bigint;
begin
  select count(*) into v_n from public.apn_commission_ledger;
  raise notice 'LIFECYCLE ledger rows=%', v_n;
  select count(*) into v_bad from public.apn_reversals r
  left join public.apn_commission_ledger o on o.id=r.original_ledger_id
  where o.id is null;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % reversals have missing originals', v_bad; end if;
  select count(*) into v_bad from public.apn_reversals r
  join public.apn_commission_ledger o on o.id=r.original_ledger_id
  join public.apn_commission_ledger x on x.id=r.reversal_ledger_id
  where x.amount >= 0 or x.partner_id <> o.partner_id;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % malformed reversal entries', v_bad; end if;
  select count(*) into v_bad from public.apn_withdrawal_requests w where w.requested_amount <= 0;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % non-positive withdrawal requests', v_bad; end if;
  select count(*) into v_bad from public.apn_withdrawal_settlements s
  left join public.apn_withdrawal_requests w on w.id=s.request_id where w.id is null;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % settlements lack requests', v_bad; end if;
  select count(*) into v_bad from (select request_id from public.apn_withdrawal_settlements group by request_id having count(*) > 1) d;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % withdrawal ids have duplicate settlements', v_bad; end if;
  select count(*) into v_bad from public.apn_commission_ledger l
  join public.apn_reversals r on r.original_ledger_id=l.id where l.reversed_by is null;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % originals have reversal rows but no marker', v_bad; end if;
  select count(*) into v_bad from public.apn_consolidated_wallets w
  where w.withdrawable < 0 or w.reserved < 0 or w.withdrawn < 0 or w.reversed < 0;
  if v_bad > 0 then raise exception 'LIFECYCLE BREAK: % wallets have negative balances', v_bad; end if;
  raise notice 'FINANCIAL LIFECYCLE VERIFICATION PASSED';
end $$;
commit;

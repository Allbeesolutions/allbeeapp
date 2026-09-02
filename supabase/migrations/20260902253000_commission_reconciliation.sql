-- #27: live commission reconciliation verification.
begin;

-- Immutable ledger rows must have coherent positive-entry math.
do $$
declare v_bad bigint;
begin
  select count(*) into v_bad from public.apn_commission_ledger
  where amount > 0 and commission_type in ('partner','district','state','referral')
    and amount <> round(base_amount * percent / 100, 2);
  if v_bad > 0 then raise exception 'RECON BREAK: % rate/amount mismatches', v_bad; end if;

  -- Referral ledger rows must retain source identity.
  select count(*) into v_bad from public.apn_commission_ledger l
  join public.apn_referral_earnings e on e.id::text=l.source_id
  where l.source_type='referral' and l.amount > 0
    and l.partner_id <> e.referrer_id;
  if v_bad > 0 then raise exception 'RECON BREAK: % referral recipient mismatches', v_bad; end if;

  -- One source event may not have duplicate positive ledger entries under the
  -- deterministic commission type/key used by the distribution engine.
  select count(*) into v_bad from (
    select source_id, source_type, commission_type, count(*) n
    from public.apn_commission_ledger
    where amount > 0 and idempotency_key like 'col:%'
    group by source_id, source_type, commission_type having count(*) > 1
  ) x;
  if v_bad > 0 then raise exception 'RECON BREAK: % duplicate collection commission groups', v_bad; end if;

  -- Every reversal must point to its exact additive reversal ledger entry.
  select count(*) into v_bad from public.apn_reversals r
  left join public.apn_commission_ledger o on o.id=r.original_ledger_id
  left join public.apn_commission_ledger x on x.id=r.reversal_ledger_id
  where o.id is null or x.id is null or x.original_event_id <> o.id;
  if v_bad > 0 then raise exception 'RECON BREAK: % broken reversal links', v_bad; end if;

  -- An original positive ledger event may only be marked reversed when the
  -- corresponding reversal exists.
  select count(*) into v_bad from public.apn_commission_ledger o
  left join public.apn_reversals r on r.original_ledger_id=o.id
  where o.reversed_by is not null and r.reversal_ledger_id <> o.reversed_by;
  if v_bad > 0 then raise exception 'RECON BREAK: % reversed markers lack matching reversal', v_bad; end if;

  raise notice 'COMMISSION RECONCILIATION TESTS PASSED';
end $$;

commit;

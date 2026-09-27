-- Correct APN payout accounting: commission is expensed when it is earned/accrued.
-- Paying that already-accrued liability is a cash/liability settlement, not a second expense.
-- Account balance reflects the cash movement because APN unwithdrawn holdings fall when paid.
begin;

-- Keep the historical finance journal/settlement chain, but never create a second
-- company expense from a withdrawal_paid journal row.
create or replace function public.apn_withdrawal_paid_to_finance()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
begin
  return new;
end;
$$;

-- Remove payout rows created by the old double-booking bridge. The immutable
-- withdrawal settlement + finance journal remains the authoritative payout history.
delete from public.transactions
where lower(coalesce(data->>'source',''))='apn-withdrawal'
  and coalesce((data->>'apnWithdrawalExpense')::boolean,false)=true;

commit;
notify pgrst,'reload schema';

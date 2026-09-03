-- APN withdrawals become eligible on the 5th of the month. The UI may show
-- this date as the next settlement/eligibility date; it must never drift to a
-- weekday heuristic because the contractual rule is calendar-day based.
create or replace function public.apn_withdrawal_next_settlement_date()
returns date
language sql stable
set search_path = pg_catalog, public, pg_temp
as $$
  select case
    when current_date <= make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5)
      then make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5)
    else (date_trunc('month', current_date) + interval '1 month' + interval '4 days')::date
  end;
$$;

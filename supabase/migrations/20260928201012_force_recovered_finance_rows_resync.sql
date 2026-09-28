-- Recovery rows keep their historical accounting date/createdAt, but must carry a fresh
-- physical updated_at so live clients and ordered bootstrap reads observe the recovery.
update public.transactions
set updated_at = clock_timestamp(),
    data = jsonb_set(data, '{recoveredAt}', to_jsonb(clock_timestamp()::text), true)
where id in ('recovery-historical-income-20260617', 'recovery-historical-expense-20260617');

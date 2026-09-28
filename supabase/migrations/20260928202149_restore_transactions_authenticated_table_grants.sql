-- Finance rows are authorized by transactions_all / can_finance(), but RLS policies
-- do not replace PostgreSQL table privileges. Keep anonymous users out and let
-- authenticated finance users reach the table so the existing RLS policy can decide rows.
revoke all on table public.transactions from anon;
grant select, insert, update, delete on table public.transactions to authenticated;

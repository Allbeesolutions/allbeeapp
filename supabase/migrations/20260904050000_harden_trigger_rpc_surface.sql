-- Harden trigger-only financial functions so they are never callable through
-- PostgREST as an RPC. PostgreSQL triggers invoke their functions internally;
-- no app role needs EXECUTE on these surfaces.
begin;
revoke execute on function public.apn_sync_income_commission_distribution() from public, anon, authenticated;
revoke execute on function public.apn_withdrawal_paid_to_finance() from public, anon, authenticated;
commit;

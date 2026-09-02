-- Security 2.0: remove stale execution grants and avoid false volatility claims.
begin;

revoke all on function public.apn_consolidated_wallet_refresh(text) from public, anon;
grant execute on function public.apn_consolidated_wallet_refresh(text) to authenticated;

-- web_ai_question has no one-argument overload in production; the advisor
-- warning applies to its actual signature, discovered from migration history.
-- Do not alter a non-existent overload and abort the whole security migration.

commit;

notify pgrst, 'reload schema';

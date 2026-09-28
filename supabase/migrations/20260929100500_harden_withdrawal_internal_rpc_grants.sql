-- Internal withdrawal helpers run as SECURITY DEFINER and accept arbitrary
-- partner ids. They are implementation details of the authorized withdrawal
-- RPCs and must not be directly callable through the Data API.
revoke execute on function public.apn_withdrawal_notify(text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.apn_withdrawal_refresh_wallet(text) from public, anon, authenticated;
revoke execute on function public.apn_withdrawal_source_totals(text,text) from public, anon, authenticated;

-- Future functions should not become client-callable merely because they are
-- created in the exposed public schema. Explicit grants remain required.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

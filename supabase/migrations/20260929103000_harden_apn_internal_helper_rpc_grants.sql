-- SECURITY DEFINER implementation helpers. These are called by authorized
-- workflow RPCs/triggers and must not be directly reachable through Data API.
revoke execute on function public.apn_consolidated_wallet_refresh(text) from public, anon, authenticated;
revoke execute on function public.apn_referral_audit(text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.apn_referral_notify(text,text,text,text) from public, anon, authenticated;
revoke execute on function public.apn_referral_refresh_wallet(text) from public, anon, authenticated;
revoke execute on function public.apn_rule_audit(text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.apn_withdrawal_add_timeline(public.apn_withdrawal_requests,text,text) from public, anon, authenticated;
revoke execute on function public.apn_withdrawal_audit_event(text,text,uuid,jsonb) from public, anon, authenticated;

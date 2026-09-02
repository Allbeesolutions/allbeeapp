-- #30: authorization matrix hardening and verification.
begin;

revoke all on function public.apn_referral_validate_earning() from public, anon;
revoke all on function public.apn_referral_guard_earning_status() from public, anon;
revoke all on function public.apn_referral_guard_withdrawal_status() from public, anon;

do $$
declare v_bad bigint; v_name text;
begin
  for v_name in select unnest(array['apn_ledger_entry','apn_create_reversal','apn_ensure_finance_expense','apn_consolidated_wallet_refresh','apn_referral_request_withdrawal','apn_referral_set_withdrawal_status','admin_restore_json_backup']) loop
    select count(*) into v_bad from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=v_name and p.prosecdef;
    if v_bad=0 then raise exception 'AUTH MATRIX BREAK: missing SECURITY DEFINER %',v_name; end if;
  end loop;
  select count(*) into v_bad from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (has_function_privilege('public',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'));
  if v_bad > 0 then raise exception 'AUTH MATRIX BREAK: % public/anon executable SECURITY DEFINER functions',v_bad; end if;
  select count(*) into v_bad from information_schema.role_table_grants
  where table_schema='public' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER')
    and table_name in ('apn_commission_ledger','apn_reversals','apn_finance_expense_map','emergency_lockdown_audit','emergency_lockdown_attempts');
  if v_bad > 0 then raise exception 'AUTH MATRIX BREAK: protected direct-write grants=%',v_bad; end if;
  select count(*) into v_bad from pg_tables where schemaname='public'
    and tablename in ('apn_commission_ledger','apn_reversals','apn_finance_expense_map','apn_withdrawal_requests','apn_withdrawal_settlements') and not rowsecurity;
  if v_bad > 0 then raise exception 'AUTH MATRIX BREAK: % sensitive tables without RLS',v_bad; end if;
  raise notice 'AUTHORIZATION MATRIX VERIFICATION PASSED';
end $$;
commit;

-- Security 2.2: production authorization break-test assertions.
-- This migration changes no application behavior; it fails closed if a critical
-- authorization invariant is ever weakened by a future migration.
begin;

do $$
declare
  r record;
  v_enabled boolean;
  v_count integer;
begin
  -- Critical protected tables must keep RLS enabled.
  for r in select unnest(array[
    'apn_rule_audit','apn_commission_ledger','apn_finance_expense_map',
    'apn_reversals','apn_hierarchy_assignments','apn_agreements',
    'apn_agreement_acceptances','apn_agreement_company','apn_friend_requests',
    'apn_chat_conversations','apn_chat_participants','apn_chat_messages',
    'apn_chat_read_states','apn_action_badge_reads','emergency_lockdown',
    'emergency_lockdown_audit','emergency_lockdown_attempts'
  ]) as table_name
  loop
    select c.relrowsecurity into v_enabled
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=r.table_name;
    if coalesce(v_enabled,false) is not true then
      raise exception 'AUTH BREAK: RLS disabled on public.%', r.table_name;
    end if;
  end loop;

  -- Immutable/security-sensitive tables must not be directly writable by clients.
  for r in select unnest(array[
    'apn_rule_audit','apn_commission_ledger','apn_finance_expense_map',
    'apn_reversals','emergency_lockdown','emergency_lockdown_audit',
    'emergency_lockdown_attempts'
  ]) as table_name
  loop
    if has_table_privilege('authenticated','public.'||r.table_name,'INSERT')
       or has_table_privilege('authenticated','public.'||r.table_name,'UPDATE')
       or has_table_privilege('authenticated','public.'||r.table_name,'DELETE')
       or has_table_privilege('authenticated','public.'||r.table_name,'TRUNCATE')
       or has_table_privilege('authenticated','public.'||r.table_name,'TRIGGER') then
      raise exception 'AUTH BREAK: authenticated has direct write privilege on public.%', r.table_name;
    end if;
  end loop;

  -- No SECURITY DEFINER function may be executable by anonymous/public roles.
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (has_function_privilege('public',p.oid,'EXECUTE')
         or has_function_privilege('anon',p.oid,'EXECUTE'));
  if v_count <> 0 then
    raise exception 'AUTH BREAK: % SECURITY DEFINER functions executable by public/anon', v_count;
  end if;

  -- The privileged finance/restore RPCs must retain explicit authenticated access.
  if not has_function_privilege('authenticated','public.admin_restore_json_backup(jsonb)','EXECUTE') then
    raise exception 'AUTH BREAK: authenticated lost admin_restore_json_backup execution';
  end if;
  if not has_function_privilege('authenticated','public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)','EXECUTE') then
    raise exception 'AUTH BREAK: authenticated lost apn_ledger_entry execution';
  end if;
  if not has_function_privilege('authenticated','public.apn_create_reversal(uuid,text)','EXECUTE') then
    raise exception 'AUTH BREAK: authenticated lost apn_create_reversal execution';
  end if;

  -- Audit tables remain inaccessible directly; writes happen through trusted RPCs.
  if has_table_privilege('authenticated','public.apn_rule_audit','SELECT') then
    raise exception 'AUTH BREAK: authenticated can directly read apn_rule_audit';
  end if;
  if has_table_privilege('authenticated','public.emergency_lockdown_audit','SELECT') then
    raise exception 'AUTH BREAK: authenticated can directly read emergency_lockdown_audit';
  end if;

  raise notice 'AUTHORIZATION BREAK TESTS PASSED';
end $$;

commit;

-- #23: non-destructive financial abuse-path verification.
-- Fail closed on live schema/privilege invariants; never mutates financial rows.
begin;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'apn_commission_ledger','apn_reversals','apn_finance_expense_map',
    'apn_consolidated_wallets','apn_withdrawal_requests',
    'apn_withdrawal_settlements','apn_withdrawal_status_history',
    'apn_referral_earnings','apn_referral_withdrawals'
  ];
  v_fn text;
  v_def text;
  v_oid oid;
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'FINANCIAL BREAK TEST FAILED: missing table public.%', v_table;
    end if;
  end loop;

  -- Client roles must not write immutable financial engine tables directly.
  foreach v_table in array array['apn_commission_ledger','apn_reversals','apn_finance_expense_map'] loop
    if has_table_privilege('authenticated','public.' || v_table,'INSERT')
       or has_table_privilege('authenticated','public.' || v_table,'UPDATE')
       or has_table_privilege('authenticated','public.' || v_table,'DELETE')
       or has_table_privilege('authenticated','public.' || v_table,'TRUNCATE') then
      raise exception 'FINANCIAL BREAK TEST FAILED: authenticated can directly mutate %', v_table;
    end if;
  end loop;

  -- All financial tables remain RLS protected where the application exposes rows.
  foreach v_table in array v_tables loop
    if not coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || v_table)), false) then
      raise exception 'FINANCIAL BREAK TEST FAILED: RLS disabled on %', v_table;
    end if;
  end loop;

  -- Critical write RPCs must not be callable by anonymous/public roles.
  foreach v_fn in array array[
    'apn_ledger_entry','apn_create_reversal','apn_ensure_finance_expense',
    'apn_revoke_finance_income','apn_delete_cancelled_commission_project',
    'apn_consolidated_wallet_refresh'
  ] loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_fn
        and has_function_privilege('public', p.oid, 'EXECUTE')
    ) then
      raise exception 'FINANCIAL BREAK TEST FAILED: PUBLIC can execute %', v_fn;
    end if;
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_fn
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      raise exception 'FINANCIAL BREAK TEST FAILED: anon can execute %', v_fn;
    end if;
  end loop;

  -- Ledger/reversal invariants must prevent forged values and duplicates.
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    and t.relname='apn_commission_ledger' and c.contype='c'
    and pg_get_constraintdef(c.oid) ~* 'amount[^\n]*<>[^\n]*0') then
    raise exception 'FINANCIAL BREAK TEST FAILED: ledger amount invariant missing';
  end if;
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    and t.relname='apn_commission_ledger' and c.contype='c'
    and pg_get_constraintdef(c.oid) ~* 'base_amount[^\n]*>=[^\n]*0') then
    raise exception 'FINANCIAL BREAK TEST FAILED: ledger base amount invariant missing';
  end if;
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    and t.relname='apn_commission_ledger' and c.contype='c'
    and pg_get_constraintdef(c.oid) ~* 'percent[^\n]*>=[^\n]*0') then
    raise exception 'FINANCIAL BREAK TEST FAILED: ledger percent invariant missing';
  end if;
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    and t.relname='apn_reversals' and c.contype='c'
    and pg_get_constraintdef(c.oid) ~* 'amount[^\n]*>[^\n]*0') then
    raise exception 'FINANCIAL BREAK TEST FAILED: reversal amount invariant missing';
  end if;
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    and t.relname='apn_reversals' and c.contype='u'
    and pg_get_constraintdef(c.oid) ilike '%original_ledger_id%') then
    raise exception 'FINANCIAL BREAK TEST FAILED: one-reversal-per-original constraint missing';
  end if;

  -- Inspect the live function bodies for the guards that close the main abuse paths.
  foreach v_fn in array array['apn_ledger_entry','apn_create_reversal'] loop
    select p.oid, pg_get_functiondef(p.oid) into v_oid, v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=v_fn and p.prosecdef
      and p.prokind='f'
    order by p.oid desc limit 1;
    if v_oid is null then raise exception 'FINANCIAL BREAK TEST FAILED: % SECURITY DEFINER function missing', v_fn; end if;
    if v_def not ilike '%auth.uid()%' then
      raise exception 'FINANCIAL BREAK TEST FAILED: % does not bind writes to authenticated execution context', v_fn;
    end if;
  end loop;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_ledger_entry'
    and p.prosecdef and p.prokind='f' order by p.oid desc limit 1;
  if v_def not ilike '%p_amount <= 0%' or v_def not ilike '%p_percent > 100%' then
    raise exception 'FINANCIAL BREAK TEST FAILED: ledger rejects/limits validation missing';
  end if;
  if v_def not ilike '%pg_advisory_xact_lock%' then
    raise exception 'FINANCIAL BREAK TEST FAILED: ledger source-event concurrency lock missing';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_create_reversal'
    and p.prosecdef and p.prokind='f' order by p.oid desc limit 1;
  if v_def not ilike '%already been reversed%' or v_def not ilike '%source_type = ''reversal''%' then
    raise exception 'FINANCIAL BREAK TEST FAILED: reversal replay/recursive guards missing';
  end if;
  if v_def not ilike '%reversal_ledger_id%' or v_def not ilike '%apn_ensure_finance_expense%' then
    raise exception 'FINANCIAL BREAK TEST FAILED: reversal ledger/expense linkage missing';
  end if;

  raise notice 'FINANCIAL ABUSE-PATH BREAK TESTS PASSED';
end;
$$;

notify pgrst, 'reload schema';
commit;

-- This verification migration intentionally contains no INSERT/UPDATE/DELETE
-- against application financial data. It is safe to apply to production.
-- Verification only; no production financial rows are created or modified.

-- End of live break-test migration.

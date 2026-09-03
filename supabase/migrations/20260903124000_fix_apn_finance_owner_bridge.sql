-- Engine-only finance bridge. Trigger functions must not call the
-- admin/finance-gated compatibility function directly.
begin;

-- transactions.kind is stored inside JSONB data, not as a table column.
-- The sync trigger also updates transactions, so nested execution must stop.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_sync_income_commission_distribution()'::regprocedure) into v_sql;
  v_sql := replace(v_sql, 'if new.kind <> ''income''', 'if pg_trigger_depth() > 1 or (new.data->>''kind'') <> ''income''');
  execute v_sql;
end $$;

-- Clone the existing finance poster into a private engine path. Its accounting
-- body remains intact, but the direct-caller gate is disabled and transactions
-- kind references are corrected to the JSONB storage shape.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_ensure_finance_expense(uuid)'::regprocedure) into v_sql;
  v_sql := replace(v_sql, 'public.apn_ensure_finance_expense(', 'public.apn_ensure_finance_expense_engine(');
  v_sql := replace(v_sql, 'if not (public.is_admin() or public.can_finance() or public.can_module(''apn'')) then', 'if false then');
  v_sql := replace(v_sql, 't.kind', '(t.data->>''kind'')');
  execute v_sql;
  revoke all on function public.apn_ensure_finance_expense_engine(uuid) from public, anon, authenticated;
end $$;

-- Internal ledger wrapper uses the private engine bridge.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_record_ledger_and_expense(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date)'::regprocedure) into v_sql;
  v_sql := replace(v_sql, 'public.apn_ensure_finance_expense(v_id)', 'public.apn_ensure_finance_expense_engine(v_id)');
  execute v_sql;
end $$;

-- Income reconciliation trigger uses the same private engine bridge.
do $$
declare v_sql text;
begin
  select pg_get_functiondef('public.apn_sync_income_commission_distribution()'::regprocedure) into v_sql;
  v_sql := replace(v_sql, 'public.apn_ensure_finance_expense(v_ledger.id)', 'public.apn_ensure_finance_expense_engine(v_ledger.id)');
  execute v_sql;
end $$;

-- Repair every positive referral/district/state ledger row that is missing
-- its deterministic company expense. Existing maps remain untouched.
do $$
declare r record;
begin
  for r in select l.id from public.apn_commission_ledger l
    where l.commission_type in ('referral','district','state')
      and l.amount > 0
      and not exists (select 1 from public.apn_finance_expense_map m where m.ledger_id=l.id)
  loop
    perform public.apn_ensure_finance_expense_engine(r.id);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;

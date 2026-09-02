-- ALLBEE #26 — Commission-engine abuse-path verification.
-- Fail-closed, verification-only: no financial/application rows are mutated.
begin;

do $$
declare
  v_bad bigint;
  v_def text;
  v_acl boolean;
begin
  -- Source-of-truth ledger must remain append-only to application roles.
  if has_table_privilege('authenticated','public.apn_commission_ledger','INSERT')
     or has_table_privilege('authenticated','public.apn_commission_ledger','UPDATE')
     or has_table_privilege('authenticated','public.apn_commission_ledger','DELETE')
     or has_table_privilege('authenticated','public.apn_commission_ledger','TRUNCATE') then
    raise exception 'COMMISSION BREAK: authenticated can mutate the ledger';
  end if;

  -- Idempotency must be database-enforced, not only application-enforced.
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    where t.relnamespace='public'::regnamespace and t.relname='apn_commission_ledger'
      and c.contype='u' and pg_get_constraintdef(c.oid) ilike '%idempotency_key%'
  ) then raise exception 'COMMISSION BREAK: ledger idempotency constraint missing'; end if;

  -- Every referral ledger source must point to the actual earning and recipient.
  select count(*) into v_bad
  from public.apn_commission_ledger l
  left join public.apn_referral_earnings e on e.id::text=l.source_id
  where l.source_type='referral'
    and (e.id is null or l.partner_id <> e.referrer_id);
  if v_bad > 0 then raise exception 'COMMISSION BREAK: % forged referral source rows', v_bad; end if;

  -- Normal positive commission entries must equal their rate calculation.
  select count(*) into v_bad
  from public.apn_commission_ledger
  where amount > 0
    and commission_type in ('partner','district','state','referral')
    and amount <> round(base_amount * percent / 100, 2);
  if v_bad > 0 then raise exception 'COMMISSION BREAK: % rate/amount mismatches', v_bad; end if;

  -- Revenue-collection ledger rows must reference a real collection.
  select count(*) into v_bad
  from public.apn_commission_ledger l
  left join public.apn_revenue_collections c on c.id::text=l.source_id
  where l.source_type='revenue_collection' and c.id is null;
  if v_bad > 0 then
    raise notice 'COMMISSION AUDIT: % orphan collection ledger rows (source rows may have been intentionally removed); details=%', v_bad,
      (select string_agg(l.idempotency_key || ':amount=' || l.amount || ':reversed=' || coalesce(l.reversed_by::text,'null'), '; ' order by l.idempotency_key)
       from public.apn_commission_ledger l
       left join public.apn_revenue_collections c on c.id::text=l.source_id
       where l.source_type='revenue_collection' and c.id is null);
  end if;

  -- Public/anonymous execution of the financial entry point is forbidden.
  v_acl := has_function_privilege(
    'public','public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)','EXECUTE');
  if v_acl then raise exception 'COMMISSION BREAK: PUBLIC can execute ledger entry'; end if;
  v_acl := has_function_privilege(
    'anon','public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)','EXECUTE');
  if v_acl then raise exception 'COMMISSION BREAK: ANON can execute ledger entry'; end if;

  -- Authenticated callers retain the guarded API, but not its owner-only writer.
  if not has_function_privilege('authenticated',
    'public.apn_ledger_entry(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)','EXECUTE') then
    raise exception 'COMMISSION BREAK: authenticated lost guarded ledger API';
  end if;
  if has_function_privilege('authenticated',
    'public.apn_ledger_entry_owner(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb)','EXECUTE') then
    raise exception 'COMMISSION BREAK: authenticated can execute ledger owner';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apn_ledger_entry'
    and pg_get_function_identity_arguments(p.oid) like 'p_idempotency_key text, p_source_id text%';
  if v_def is null or v_def not ilike '%p_amount is null or p_amount <= 0%'
     or v_def not ilike '%p_percent is null or p_percent < 0 or p_percent > 100%'
     or v_def not ilike '%pg_advisory_xact_lock%' then
    raise exception 'COMMISSION BREAK: guarded ledger validation/serialization missing';
  end if;

  raise notice 'COMMISSION ABUSE-PATH TESTS PASSED';
end $$;

commit;

begin;
-- P0 security: trigger functions are invoked by PostgreSQL, never directly by browser roles.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and exists (select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Delivery receipts are trusted server-to-server bookkeeping only.
revoke execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_crm_record_delivery(uuid,text,text,text,jsonb)
  to service_role;
commit;
notify pgrst, 'reload schema';

-- P0 security regression contract. Read-only assertions; safe against production schema snapshots.
do $$
declare v int;
begin
  select count(*) into v from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if v <> 0 then raise exception 'P0: % public tables have RLS disabled',v; end if;

  select count(*) into v from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and exists(select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal);
  if v <> 0 then raise exception 'P0: % trigger functions are directly executable by authenticated',v; end if;

  if has_function_privilege('authenticated','public.ai_crm_record_delivery(uuid,text,text,text,jsonb)','EXECUTE') then
    raise exception 'P0: AI CRM delivery recorder exposed to authenticated';
  end if;
end $$;

-- Internal helper RPCs must never be directly executable by browser roles.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.ai_memory_sync_entity(text,text,text,text,jsonb)',
    'public.crm_notify(text,text,text,uuid)',
    'public.proposal_write_sections(uuid,uuid,jsonb)',
    'public.crm_generate_reminders()',
    'public.security_v5_assert()'
  ] loop
    if has_function_privilege('authenticated',fn,'EXECUTE') or has_function_privilege('anon',fn,'EXECUTE') then
      raise exception 'P0: internal helper % exposed to a browser role',fn;
    end if;
  end loop;
end $$;

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

-- Server-only tables intentionally have RLS with no browser policies/grants.
do $$
declare t text;
begin
  foreach t in array array['ai_memory_documents','ai_memory_sync_queue','apn_ai_usage','apn_rule_audit','emergency_lockdown','emergency_lockdown_attempts','emergency_lockdown_audit','finance_save_requests','notification_push_queue','notification_user_state'] loop
    if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'P0: server-only table % has browser grants',t;
    end if;
  end loop;
end $$;

-- Every table streamed through Realtime must remain protected by RLS.
do $$
declare v int;
begin
  select count(*) into v from pg_publication_tables pt
  join pg_class c on c.relname=pt.tablename
  join pg_namespace n on n.oid=c.relnamespace and n.nspname=pt.schemaname
  where pt.pubname='supabase_realtime' and not c.relrowsecurity;
  if v <> 0 then raise exception 'P0: % realtime tables lack RLS',v; end if;
end $$;

-- Anonymous SECURITY DEFINER surface is intentionally tiny and reviewed.
do $$
declare v text[];
begin
  select array_agg(p.proname order by p.proname) into v
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');
  if v is distinct from array['proposal_public_action','proposal_public_get','public_owner_profiles']::text[] then
    raise exception 'P0: unexpected anonymous SECURITY DEFINER functions: %',v;
  end if;
end $$;

-- Pre-auth throttle state and mutator are server-only.
do $$ begin
 if has_table_privilege('authenticated','public.auth_preflight_rate_limits','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.auth_preflight_rate_limits','SELECT,INSERT,UPDATE,DELETE') then raise exception 'P0: auth throttle table exposed'; end if;
 if has_function_privilege('authenticated','public.auth_preflight_rate_limit(text,integer,integer)','EXECUTE') or has_function_privilege('anon','public.auth_preflight_rate_limit(text,integer,integer)','EXECUTE') then raise exception 'P0: auth throttle RPC exposed'; end if;
end $$;

-- APN attachment visibility must correlate membership to the attachment conversation.
do $$ declare q text; begin
 select qual into q from pg_policies where schemaname='public' and tablename='apn_chat_attachments' and policyname='apn_chat_attachments_select';
 if q is null or q not like '%apn_chat_attachments.conversation_id%' then raise exception 'P0: APN attachment select policy lost conversation correlation'; end if;
end $$;

-- Critical system mutations are RPC-only from the application and deny anonymous execution.
do $$ begin
 if has_function_privilege('anon','public.app_config_save_patch(jsonb)','EXECUTE') then raise exception 'P0: config mutation RPC exposed to anon'; end if;
 if has_function_privilege('anon','public.finance_period_set_lock(text,boolean)','EXECUTE') then raise exception 'P0: finance lock RPC exposed to anon'; end if;
end $$;

-- Sensitive profile/APN mutation guards must keep a pinned safe search_path.
do $$ declare n text; cfg text[]; begin
 foreach n in array array['profiles_guard','apn_users_guard','apn_users_head_guard'] loop
   select p.proconfig into cfg from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=n limit 1;
   if cfg is null or not exists(select 1 from unnest(cfg) x where x like 'search_path=%pg_catalog%public%pg_temp%') then raise exception 'P0: unsafe search_path for %',n; end if;
 end loop;
end $$;

-- AI memory bulk synchronization is an Edge/service operation, never a browser RPC.
do $$ begin
 if has_function_privilege('authenticated','public.ai_memory_sync_business()','EXECUTE') or has_function_privilege('authenticated','public.ai_memory_sync_knowledge()','EXECUTE') then raise exception 'P0: internal AI memory sync exposed to authenticated'; end if;
end $$;

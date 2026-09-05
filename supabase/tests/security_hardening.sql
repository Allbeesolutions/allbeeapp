begin;

do $$
declare v boolean;
begin
  select relrowsecurity into v from pg_class where oid='public.audit'::regclass;
  if not v then raise exception 'audit RLS is disabled'; end if;
  if has_table_privilege('authenticated','public.audit','insert') then raise exception 'authenticated can insert audit directly'; end if;
  if has_table_privilege('authenticated','public.audit','update') then raise exception 'authenticated can update audit directly'; end if;
  if has_table_privilege('authenticated','public.audit','delete') then raise exception 'authenticated can delete audit directly'; end if;
  if not has_function_privilege('authenticated','public.audit_record(jsonb)','execute') then raise exception 'audit_record RPC is not executable by authenticated'; end if;

  if has_table_privilege('authenticated','public.notifications','insert') then raise exception 'authenticated can insert notification content'; end if;
  if has_table_privilege('authenticated','public.notifications','update') then raise exception 'authenticated can update notification content'; end if;
  if has_table_privilege('authenticated','public.notifications','delete') then raise exception 'authenticated can delete notification content'; end if;
  if has_table_privilege('authenticated','public.chat','update') then raise exception 'authenticated can update legacy chat directly'; end if;
  if has_table_privilege('authenticated','public.team_chat','update') then raise exception 'authenticated can update team chat directly'; end if;
  if has_table_privilege('authenticated','public.notification_user_state','update') then raise exception 'authenticated can mutate notification state directly'; end if;
  if not has_function_privilege('authenticated','public.notification_snooze(text,integer)','execute') then raise exception 'notification_snooze RPC is not executable by authenticated'; end if;
end $$;

rollback;

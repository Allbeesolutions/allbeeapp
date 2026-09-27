begin;
-- Internal SECURITY DEFINER helpers are reachable only through guarded RPCs,
-- database triggers, scheduled workers, or service-role Edge Functions.
revoke execute on function public.ai_memory_sync_entity(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_memory_sync_entity(text,text,text,text,jsonb) to service_role;
revoke execute on function public.crm_notify(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_notify(text,text,text,uuid) to service_role;
revoke execute on function public.proposal_write_sections(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.proposal_write_sections(uuid,uuid,jsonb) to service_role;
revoke execute on function public.crm_generate_reminders() from public,anon,authenticated;
grant execute on function public.crm_generate_reminders() to service_role;
revoke execute on function public.security_v5_assert() from public,anon,authenticated;
grant execute on function public.security_v5_assert() to service_role;

-- Secure-by-default: future postgres-owned public functions must be explicitly granted.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
commit;
notify pgrst,'reload schema';

begin;
revoke execute on function public.ai_memory_sync_business() from public,anon,authenticated;
grant execute on function public.ai_memory_sync_business() to service_role;
revoke execute on function public.ai_memory_sync_knowledge() from public,anon,authenticated;
grant execute on function public.ai_memory_sync_knowledge() to service_role;
commit;

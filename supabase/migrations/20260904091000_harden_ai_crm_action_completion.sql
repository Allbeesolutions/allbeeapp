-- Completion is an internal provider callback; clients may claim/approve but never
-- directly mark a claimed action executed or failed.
revoke execute on function public.ai_crm_action_complete(uuid,boolean,text) from authenticated, anon, public;
grant execute on function public.ai_crm_action_complete(uuid,boolean,text) to service_role;

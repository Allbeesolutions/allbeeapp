-- Internal SECURITY DEFINER logging helpers. Workflow RPCs/triggers call these;
-- browsers must not be able to forge CRM/Knowledge activity, audit, or system notifications.
revoke execute on function public.crm_log_event(text,text,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.knowledge_log_change(text,text,text,jsonb,jsonb,text,text) from public, anon, authenticated;

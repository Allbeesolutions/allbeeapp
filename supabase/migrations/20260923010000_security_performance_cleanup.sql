-- Production security/performance cleanup.
-- Keep forecast view subject to invoker privileges and remove exact duplicate indexes.
alter view public.ai_forecast_v3 set (security_invoker = true);
drop index if exists public.crm_activities_lead_date_idx;
drop index if exists public.crm_leads_updated_status_idx;

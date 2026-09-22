-- Remove exact duplicate non-unique indexes; keep the established names used by the application.
drop index if exists public.crm_activities_lead_date_idx;
drop index if exists public.crm_leads_updated_status_idx;

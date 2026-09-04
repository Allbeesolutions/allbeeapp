-- Performance v3: indexes for the hottest CRM/search/automation paths.
create index if not exists crm_leads_email_idx on public.crm_leads(lower(email)) where email is not null;
create index if not exists crm_leads_mobile_idx on public.crm_leads(mobile) where mobile is not null;
create index if not exists crm_leads_company_idx on public.crm_leads(lower(company)) where company is not null;
create index if not exists crm_leads_updated_status_idx on public.crm_leads(status,updated_at desc);
create index if not exists crm_follow_ups_lead_due_idx on public.crm_follow_ups(lead_id,status,follow_up_date,follow_up_time);
create index if not exists crm_activities_lead_created_idx on public.crm_activities(lead_id,created_at desc);
create index if not exists crm_quotations_validity_idx on public.crm_quotations(status,validity_until,updated_at desc);
create index if not exists crm_projects_lead_idx on public.crm_projects(lead_id,updated_at desc);
create index if not exists notifications_updated_idx on public.notifications(updated_at desc);
create index if not exists notifications_data_gin_idx on public.notifications using gin(data);
create index if not exists apn_notifications_updated_idx on public.apn_notifications(updated_at desc);
create index if not exists business_automation_queue_rule_status_idx on public.business_automation_queue(rule_id,status,requested_at desc);

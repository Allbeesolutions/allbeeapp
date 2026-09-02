-- #32: close anonymous exposure of internal AI/finance/CRM views and tables.
begin;

-- Internal analytics are administrator-only. RLS is the database boundary;
-- SECURITY DEFINER views are also removed from anonymous/public access.
DO $$
declare t text;
begin
  foreach t in array array['ai_settings','ai_insights','ai_predictions','ai_cache','ai_history','ai_recommendations','ai_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
    execute format('drop policy if exists %I_admin_all on public.%I',t,t);
    execute format('create policy %I_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t,t);
  end loop;
end $$;

revoke all on public.ai_lead_scores,public.ai_partner_scores,public.ai_employee_scores,public.ai_finance_forecast,public.ai_company_health from public,anon;
grant select on public.ai_lead_scores,public.ai_partner_scores,public.ai_employee_scores,public.ai_finance_forecast,public.ai_company_health to authenticated;

revoke all on public.apn_withdrawal_admin_queue,public.apn_withdrawal_partner_summary,public.crm_revenue_summary,public.proposal_public_view from public,anon;
grant select on public.apn_withdrawal_admin_queue,public.apn_withdrawal_partner_summary,public.crm_revenue_summary,public.proposal_public_view to authenticated;

commit;

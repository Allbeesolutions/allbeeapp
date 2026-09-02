-- #32 final: eliminate SECURITY DEFINER views from the public attack surface.
begin;

do $$
declare v_name text;
begin
  foreach v_name in array array[
    'proposal_pipeline','web_ai_funnel','web_ai_popular_services','web_ai_conversion_summary',
    'web_requirement_question_dropoff','ai_lead_scores','ai_partner_scores','ai_employee_scores',
    'ai_finance_forecast','apn_withdrawal_partner_summary','apn_withdrawal_admin_queue',
    'crm_lead_pipeline','crm_lead_dashboard','crm_revenue_summary','proposal_analytics_summary',
    'proposal_public_view','web_requirement_funnel','web_requirement_service_summary',
    'knowledge_public_pricing_catalog','ai_company_health','knowledge_service_catalog',
    'knowledge_public_price_list','knowledge_admin_activity','knowledge_search_index'
  ] loop
    execute format('alter view public.%I set (security_invoker = true)',v_name);
    execute format('revoke all on public.%I from public, anon',v_name);
    execute format('grant select on public.%I to authenticated',v_name);
  end loop;
end $$;

-- Public pricing/search data is exposed only through governed application paths;
-- no anonymous direct table/view grants remain on these internal views.
commit;

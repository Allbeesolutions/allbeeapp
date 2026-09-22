-- Keep the forecast view subject to invoker privileges.
alter view public.ai_forecast_v3 set (security_invoker = true);

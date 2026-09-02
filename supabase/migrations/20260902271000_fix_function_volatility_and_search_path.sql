-- #32 final: align function volatility/search_path with actual behavior.
begin;

alter function public.apn_commission_eligibility_date(date)
  set search_path = pg_catalog, public, pg_temp;
alter function public.apn_withdrawal_next_settlement_date()
  set search_path = pg_catalog, public, pg_temp;
alter function public.apn_withdrawal_request_amount(numeric,numeric,text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.web_ai_service_key(text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.web_ai_service_label(text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.web_ai_question(text,integer)
  stable;
alter function public.web_ai_question(text,integer)
  set search_path = pg_catalog, public, pg_temp;
alter function public.web_ai_score(jsonb,integer)
  set search_path = pg_catalog, public, pg_temp;
alter function public.web_ai_temperature(integer)
  set search_path = pg_catalog, public, pg_temp;
alter function public.apn_ai_build_context(text)
  volatile;

commit;

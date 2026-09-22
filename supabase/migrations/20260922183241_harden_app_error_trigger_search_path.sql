-- Security hardening: pin the trigger function search_path to trusted schemas.
alter function public.app_error_events_normalize() set search_path = pg_catalog;

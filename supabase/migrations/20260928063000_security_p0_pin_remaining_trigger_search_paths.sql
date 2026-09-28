begin;
alter function public.profiles_guard() set search_path=pg_catalog,public,pg_temp;
alter function public.apn_users_guard() set search_path=pg_catalog,public,pg_temp;
alter function public.apn_users_head_guard() set search_path=pg_catalog,public,pg_temp;
commit;

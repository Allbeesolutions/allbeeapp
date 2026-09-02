-- #31 final: remove only indexes proven identical by live advisor.
begin;
drop index if exists public.apn_activity_partner_created_v3_idx;
drop index if exists public.apn_timeline_partner_created_v3_idx;
drop index if exists public.apn_users_district_v3_idx;
drop index if exists public.apn_users_status_v3_idx;
drop index if exists public.profiles_username_unique;
commit;

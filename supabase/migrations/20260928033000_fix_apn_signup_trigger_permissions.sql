begin;
-- handle_new_user() executes as its owner (postgres). Keep this validation helper
-- callable by postgres as well as service_role; revoking it from postgres breaks
-- every partner signup with "Database error saving new user".
grant execute on function public.apn_registration_guard(text,jsonb) to postgres,service_role;
grant execute on function public.apn_validate_adult_dob(text) to postgres,service_role,authenticated;
commit;
notify pgrst,'reload schema';

-- Security hygiene: invalidate the historical repository-committed admin signup code.
-- A real admin signup secret must be provisioned through a controlled deployment process.
update public.app_config
set value = ''
where key = 'admin_signup_code'
  and value = 'ALLBEE-ADMIN-2025';

-- Fix Auth signup regression: JSON metadata mobile fallback mixed jsonb/text in COALESCE.
create or replace function public.apn_registration_guard(p_email text,p_meta jsonb)
returns void language plpgsql security definer
set search_path='pg_catalog','public','pg_temp'
as $$
declare
  v_username text:=lower(trim(coalesce(p_meta->'apn'->>'username',p_meta->>'username','')));
  v_mobile text:=regexp_replace(coalesce(p_meta->'apn'->>'mobile',p_meta->>'mobile',''),'[^0-9]','','g');
  v_is_partner boolean:=p_meta->>'role_intent'='partner';
begin
  if exists(select 1 from public.profiles p where p.status='suspended' and
    (lower(coalesce(p.email,''))=lower(coalesce(p_email,''))
     or (v_username<>'' and lower(coalesce(p.username,''))=v_username)
     or (v_mobile<>'' and regexp_replace(coalesce(p.mobile,''),'[^0-9]','','g')=v_mobile)))
  then raise exception 'This APN identifier belongs to a suspended account.' using errcode='check_violation'; end if;
  if v_is_partner then perform public.apn_validate_adult_dob(p_meta->'apn'->>'dob'); end if;
end $$;

-- Email availability is intentionally callable before authentication.
revoke all on function public.email_available(text,uuid) from public;
grant execute on function public.email_available(text,uuid) to anon,authenticated,service_role;

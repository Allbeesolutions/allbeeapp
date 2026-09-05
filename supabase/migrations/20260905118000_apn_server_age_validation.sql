begin;

create or replace function public.apn_validate_adult_dob(p_dob text)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare d date; years integer;
begin
  if nullif(trim(p_dob),'') is null then raise exception 'Date of birth is required for APN registration.' using errcode='check_violation'; end if;
  begin d:=trim(p_dob)::date; exception when others then raise exception 'Invalid date of birth.' using errcode='check_violation'; end;
  if d>current_date then raise exception 'Date of birth cannot be in the future.' using errcode='check_violation'; end if;
  years:=extract(year from age(current_date,d));
  if years<18 then raise exception 'APN registration requires the applicant to be at least 18 years old.' using errcode='check_violation'; end if;
end $$;
revoke execute on function public.apn_validate_adult_dob(text) from public,anon; grant execute on function public.apn_validate_adult_dob(text) to authenticated,service_role;

create or replace function public.apn_registration_guard(p_email text,p_meta jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_username text:=lower(trim(coalesce(p_meta->'apn'->>'username',p_meta->>'username',''))); v_mobile text:=regexp_replace(coalesce(p_meta->'apn'->>'mobile',p_meta->'mobile',''),'[^0-9]','','g'); v_is_partner boolean:=p_meta->>'role_intent'='partner';
begin
  if exists(select 1 from public.profiles p where p.status='suspended' and (lower(coalesce(p.email,''))=lower(coalesce(p_email,'')) or (v_username<>'' and lower(coalesce(p.username,''))=v_username) or (v_mobile<>'' and regexp_replace(coalesce(p.mobile,''),'[^0-9]','','g')=v_mobile))) then raise exception 'This APN identifier belongs to a suspended account.' using errcode='check_violation'; end if;
  if v_is_partner then perform public.apn_validate_adult_dob(p_meta->'apn'->>'dob'); end if;
end $$;
revoke execute on function public.apn_registration_guard(text,jsonb) from public,anon; grant execute on function public.apn_registration_guard(text,jsonb) to service_role;

create or replace function public.apn_profile_age_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.role in ('partner','district_head','state_head') and new.dob is not null then perform public.apn_validate_adult_dob(new.dob::text); end if;
  return new;
end $$;
drop trigger if exists apn_profile_age_guard_trg on public.profiles;
create trigger apn_profile_age_guard_trg before insert or update of dob,role on public.profiles for each row execute function public.apn_profile_age_guard();
revoke execute on function public.apn_profile_age_guard() from public,anon,authenticated;

commit;
notify pgrst,'reload schema';

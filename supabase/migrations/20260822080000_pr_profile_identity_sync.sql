-- Keep the canonical employee profile and APN profile identity fields synchronized.
-- profiles is the canonical identity source for name/email/mobile/dob/photo/username.
create or replace function public.sync_profile_identity_to_apn()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.apn_users
  set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
    'name', coalesce(new.name, 'Member'),
    'email', coalesce(new.email, ''),
    'mobile', coalesce(new.mobile, ''),
    'dob', coalesce(new.dob::text, ''),
    'username', coalesce(new.username, ''),
    'profilePicture', coalesce(new.photo_url, ''),
    'photo_url', coalesce(new.photo_url, ''),
    'photoUrl', coalesce(new.photo_url, '')
  ),
  updated_at = now()
  where id = new.id::text;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_identity_to_apn on public.profiles;
create trigger trg_sync_profile_identity_to_apn
after insert or update of name, email, mobile, dob, username, photo_url
on public.profiles
for each row
execute function public.sync_profile_identity_to_apn();

-- One-time repair: bring every existing APN partner up to date with profiles.
update public.apn_users a
set data = coalesce(a.data, '{}'::jsonb) || jsonb_build_object(
  'name', coalesce(p.name, 'Member'),
  'email', coalesce(p.email, ''),
  'mobile', coalesce(p.mobile, ''),
  'dob', coalesce(p.dob::text, ''),
  'username', coalesce(p.username, ''),
  'profilePicture', coalesce(p.photo_url, ''),
  'photo_url', coalesce(p.photo_url, ''),
  'photoUrl', coalesce(p.photo_url, '')
),
updated_at = now()
from public.profiles p
where a.id = p.id::text;

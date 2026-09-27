begin;
create or replace function public.public_owner_profiles()
returns table(name text, photo_url text)
language sql security definer stable set search_path=pg_catalog,public,pg_temp as $$
  select p.name,p.photo_url
  from public.profiles p
  where p.role in ('admin','superadmin')
    and p.active is true
    and p.status='active'
    and lower(trim(p.name)) in ('haji','alim')
  order by p.name;
$$;
revoke all on function public.public_owner_profiles() from public;
grant execute on function public.public_owner_profiles() to anon,authenticated;
commit;
notify pgrst,'reload schema';

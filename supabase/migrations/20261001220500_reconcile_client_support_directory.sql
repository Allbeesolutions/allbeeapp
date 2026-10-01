create or replace function public.client_support_directory()
returns table(id uuid,name text,role text,photo_url text,support_label text,sort_order integer)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.role,p.photo_url,
 case when lower(trim(p.name))='saranya' then 'Chat with AllBee Admins' when lower(trim(p.name))='haji' then 'Chat with AllBee Co-founder and CFO' else 'Chat with AllBee Founder and CEO' end,
 case when lower(trim(p.name))='saranya' then 1 when lower(trim(p.name))='haji' then 2 else 3 end
 from public.profiles p where p.active=true and p.status='active' and (lower(trim(p.name)) in ('saranya','haji') or lower(trim(p.name)) ~ '^mohamed[[:space:]]+backer[[:space:]]+alim$') order by 6;
$$;
revoke all on function public.client_support_directory() from public,anon;
grant execute on function public.client_support_directory() to authenticated,service_role;

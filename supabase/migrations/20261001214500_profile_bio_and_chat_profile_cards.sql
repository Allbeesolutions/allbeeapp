alter table public.profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_length_check;
alter table public.profiles add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 150);
drop function if exists public.apn_list_chat_contacts();
create function public.apn_list_chat_contacts()
returns table(contact_id text,contact_type text,name text,apn_id text,district text,state text,photo_url text,bio text,availability text,last_seen timestamptz,relationship text)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 return query with contacts as (
  select u.id::text,'partner'::text,coalesce(u.data->>'name','Partner'),u.data->>'apnId',u.data->>'district',u.data->>'state',coalesce(p.photo_url,u.data->>'profilePicture',u.data->>'photo_url',u.data->>'photoUrl'),coalesce(p.bio,u.data->>'bio',''),case when coalesce(pr.online,false) and pr.updated_at>now()-interval '45 seconds' then 'online' else 'offline' end::text,pr.last_seen,case when exists(select 1 from public.apn_friend_requests r where r.status='accepted' and ((r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) or(r.requester_id=u.id::text and r.recipient_id=auth.uid()::text))) then 'friend' when exists(select 1 from public.apn_friend_requests r where r.status='pending' and r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) then 'outgoing' when exists(select 1 from public.apn_friend_requests r where r.status='pending' and r.recipient_id=auth.uid()::text and r.requester_id=u.id::text) then 'incoming' else 'none' end::text
  from public.apn_users u left join public.apn_chat_presence pr on pr.user_id=u.id::text left join public.profiles p on p.id::text=u.id::text where u.id::text<>auth.uid()::text and u.data->>'status'='active'
  union all select p.id::text,case when p.role='superadmin' then 'superadmin' else 'admin' end,coalesce(p.name,case when p.role='superadmin' then 'Super Admin' else 'Admin' end),null,null,null,p.photo_url,coalesce(p.bio,''),'always_available',null,'pre_enabled' from public.profiles p where p.id<>auth.uid() and p.active=true and p.status='active' and p.role in('admin','superadmin')
 ) select * from contacts order by case contact_type when 'superadmin' then 0 when 'admin' then 1 else 2 end,lower(name);
end $$;
revoke all on function public.apn_list_chat_contacts() from public,anon;
grant execute on function public.apn_list_chat_contacts() to authenticated;
notify pgrst,'reload schema';

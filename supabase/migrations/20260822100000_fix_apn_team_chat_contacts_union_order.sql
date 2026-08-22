drop function if exists public.apn_list_chat_contacts();
create or replace function public.apn_list_chat_contacts()
returns table(contact_id text, contact_type text, name text, apn_id text, district text, state text, photo_url text, availability text, last_seen timestamptz, relationship text)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select x.contact_id,x.contact_type,x.name,x.apn_id,x.district,x.state,x.photo_url,x.availability,x.last_seen,x.relationship
  from (
    select u.id::text contact_id,'partner'::text contact_type,coalesce(u.data->>'name','Partner') name,u.data->>'apnId' apn_id,u.data->>'district' district,u.data->>'state' state,
      coalesce(u.data->>'profilePicture',u.data->>'photo_url',u.data->>'photoUrl') photo_url,
      case when coalesce(pr.online,false) and pr.updated_at > now()-interval '45 seconds' then 'online' else 'offline' end availability,pr.last_seen,
      case when exists(select 1 from public.apn_friend_requests r where r.status='accepted' and ((r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) or (r.requester_id=u.id::text and r.recipient_id=auth.uid()::text))) then 'friend'
        when exists(select 1 from public.apn_friend_requests r where r.status='pending' and r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) then 'outgoing'
        when exists(select 1 from public.apn_friend_requests r where r.status='pending' and r.recipient_id=auth.uid()::text and r.requester_id=u.id::text) then 'incoming' else 'none' end relationship
    from public.apn_users u left join public.apn_chat_presence pr on pr.user_id=u.id::text
    where u.id::text<>auth.uid()::text and u.data->>'status'='active'
    union all
    select p.id::text,case when p.role='superadmin' then 'superadmin' else 'admin' end,coalesce(p.name,case when p.role='superadmin' then 'Super Admin' else 'Admin' end),null,null,null,p.photo_url,'always_available',null,'pre_enabled'
    from public.profiles p where p.id<>auth.uid() and p.active=true and p.status='active' and p.role in ('admin','superadmin')
  ) x
  order by case x.contact_type when 'superadmin' then 0 when 'admin' then 1 else 2 end,lower(x.name);
end; $$;
grant execute on function public.apn_list_chat_contacts() to authenticated;
notify pgrst,'reload schema';

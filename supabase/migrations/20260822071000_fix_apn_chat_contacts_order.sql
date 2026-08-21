-- PostgreSQL does not allow ORDER BY expressions on a UNION unless they are
-- part of the UNION output. Wrap the contact union so the public return shape
-- stays unchanged while ordering by contact type/name is valid.
create or replace function public.apn_list_chat_contacts()
returns table(
  contact_id text,
  contact_type text,
  name text,
  apn_id text,
  district text,
  state text,
  photo_url text,
  availability text,
  relationship text
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select x.contact_id, x.contact_type, x.name, x.apn_id, x.district, x.state,
         x.photo_url, x.availability, x.relationship
  from (
    select u.id::text as contact_id,
           'partner'::text as contact_type,
           coalesce(u.data->>'name','Partner') as name,
           u.data->>'apnId' as apn_id,
           u.data->>'district' as district,
           u.data->>'state' as state,
           coalesce(u.data->>'profilePicture', u.data->>'photo_url', u.data->>'photoUrl') as photo_url,
           case when u.data->>'status' = 'active' then 'available' else u.data->>'status' end as availability,
           case
             when exists (select 1 from public.apn_friend_requests r
               where r.status='accepted' and ((r.requester_id=auth.uid()::text and r.recipient_id=u.id::text)
                 or (r.requester_id=u.id::text and r.recipient_id=auth.uid()::text))) then 'friend'
             when exists (select 1 from public.apn_friend_requests r
               where r.status='pending' and r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) then 'outgoing'
             when exists (select 1 from public.apn_friend_requests r
               where r.status='pending' and r.recipient_id=auth.uid()::text and r.requester_id=u.id::text) then 'incoming'
             else 'none'
           end as relationship
    from public.apn_users u
    where u.id::text <> auth.uid()::text
      and u.data->>'status' = 'active'
    union all
    select p.id::text,
           case when p.role='superadmin' then 'superadmin' else 'admin' end,
           coalesce(p.name, case when p.role='superadmin' then 'Super Admin' else 'Admin' end),
           null::text, null::text, null::text, p.photo_url,
           'always_available'::text, 'pre_enabled'::text
    from public.profiles p
    where p.id <> auth.uid()
      and p.active = true
      and p.status = 'active'
      and p.role in ('admin','superadmin')
  ) x
  order by x.contact_type, x.name;
end;
$$;

grant execute on function public.apn_list_chat_contacts() to authenticated;

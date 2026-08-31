-- Fix runtime contact RPC. The previous implementation can surface
-- "missing FROM-clause entry for table p" on production Postgres when the
-- UNION/ORDER BY is planned through the function's return-column namespace.
-- Keep the UNION inside a CTE and order only in the outer query.
begin;

drop function if exists public.apn_list_chat_contacts();

create function public.apn_list_chat_contacts()
returns table(
  contact_id text,
  contact_type text,
  name text,
  apn_id text,
  district text,
  state text,
  photo_url text,
  availability text,
  last_seen timestamptz,
  relationship text
)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  with contacts as (
    select
      u.id::text as contact_id,
      'partner'::text as contact_type,
      coalesce(u.data->>'name', 'Partner') as name,
      u.data->>'apnId' as apn_id,
      u.data->>'district' as district,
      u.data->>'state' as state,
      coalesce(u.data->>'profilePicture', u.data->>'photo_url', u.data->>'photoUrl') as photo_url,
      case
        when coalesce(pr.online, false)
          and pr.updated_at > now() - interval '45 seconds' then 'online'
        else 'offline'
      end::text as availability,
      pr.last_seen as last_seen,
      case
        when exists (
          select 1 from public.apn_friend_requests r
          where r.status = 'accepted'
            and ((r.requester_id = auth.uid()::text and r.recipient_id = u.id::text)
              or (r.requester_id = u.id::text and r.recipient_id = auth.uid()::text))
        ) then 'friend'
        when exists (
          select 1 from public.apn_friend_requests r
          where r.status = 'pending'
            and r.requester_id = auth.uid()::text and r.recipient_id = u.id::text
        ) then 'outgoing'
        when exists (
          select 1 from public.apn_friend_requests r
          where r.status = 'pending'
            and r.recipient_id = auth.uid()::text and r.requester_id = u.id::text
        ) then 'incoming'
        else 'none'
      end::text as relationship
    from public.apn_users as u
    left join public.apn_chat_presence as pr on pr.user_id = u.id::text
    where u.id::text <> auth.uid()::text
      and u.data->>'status' = 'active'

    union all

    select
      prof.id::text as contact_id,
      case when prof.role = 'superadmin' then 'superadmin' else 'admin' end::text as contact_type,
      coalesce(prof.name, case when prof.role = 'superadmin' then 'Super Admin' else 'Admin' end) as name,
      null::text as apn_id,
      null::text as district,
      null::text as state,
      prof.photo_url as photo_url,
      'always_available'::text as availability,
      null::timestamptz as last_seen,
      'pre_enabled'::text as relationship
    from public.profiles as prof
    where prof.id <> auth.uid()
      and prof.active = true
      and prof.status = 'active'
      and prof.role in ('admin', 'superadmin')
  )
  select
    contacts.contact_id,
    contacts.contact_type,
    contacts.name,
    contacts.apn_id,
    contacts.district,
    contacts.state,
    contacts.photo_url,
    contacts.availability,
    contacts.last_seen,
    contacts.relationship
  from contacts
  order by
    case contacts.contact_type when 'superadmin' then 0 when 'admin' then 1 else 2 end,
    lower(contacts.name);
end;
$$;

grant execute on function public.apn_list_chat_contacts() to authenticated;
notify pgrst, 'reload schema';
commit;

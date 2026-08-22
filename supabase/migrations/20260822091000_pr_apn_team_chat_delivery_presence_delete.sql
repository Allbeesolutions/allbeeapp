-- APN Team Chat delivery/read/delete/presence hardening.
-- Server-side enforcement is authoritative; UI only reflects these states.

alter table public.apn_chat_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create table if not exists public.apn_chat_presence (
  user_id text primary key,
  online boolean not null default false,
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apn_chat_presence enable row level security;
revoke all on public.apn_chat_presence from public, anon, authenticated;
drop policy if exists apn_chat_presence_select on public.apn_chat_presence;
create policy apn_chat_presence_select on public.apn_chat_presence
  for select to authenticated using (true);

create or replace function public.apn_presence_heartbeat(p_online boolean default true)
returns table(ok boolean, last_seen timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.apn_chat_presence(user_id, online, last_seen, updated_at)
    values (auth.uid()::text, coalesce(p_online, true), now(), now())
  on conflict (user_id) do update set
    online = excluded.online,
    last_seen = now(),
    updated_at = now();
  return query select true, now();
end;
$$;

grant execute on function public.apn_presence_heartbeat(boolean) to authenticated;

drop function if exists public.apn_list_chat_contacts();

create or replace function public.apn_list_chat_contacts()
returns table(
  contact_id text, contact_type text, name text, apn_id text,
  district text, state text, photo_url text, availability text,
  last_seen timestamptz, relationship text
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select u.id::text, 'partner'::text,
    coalesce(u.data->>'name','Partner'), u.data->>'apnId',
    u.data->>'district', u.data->>'state',
    coalesce(u.data->>'profilePicture',u.data->>'photo_url',u.data->>'photoUrl'),
    case when coalesce(pr.online,false) and pr.updated_at > now() - interval '45 seconds'
      then 'online' else 'offline' end,
    coalesce(pr.last_seen, null),
    case
      when exists (select 1 from public.apn_friend_requests r where r.status='accepted'
        and ((r.requester_id=auth.uid()::text and r.recipient_id=u.id::text)
          or (r.requester_id=u.id::text and r.recipient_id=auth.uid()::text))) then 'friend'
      when exists (select 1 from public.apn_friend_requests r where r.status='pending'
        and r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) then 'outgoing'
      when exists (select 1 from public.apn_friend_requests r where r.status='pending'
        and r.recipient_id=auth.uid()::text and r.requester_id=u.id::text) then 'incoming'
      else 'none' end
  from public.apn_users u
  left join public.apn_chat_presence pr on pr.user_id=u.id::text
  where u.id::text <> auth.uid()::text and u.data->>'status'='active'
  union all
  select p.id::text,
    case when p.role='superadmin' then 'superadmin' else 'admin' end,
    coalesce(p.name, case when p.role='superadmin' then 'Super Admin' else 'Admin' end),
    null::text,null::text,null::text,p.photo_url,'always_available'::text,null::timestamptz,
    'pre_enabled'::text
  from public.profiles p
  where p.id<>auth.uid() and p.active=true and p.status='active'
    and p.role in ('admin','superadmin')
  order by contact_type, name;
end;
$$;

grant execute on function public.apn_list_chat_contacts() to authenticated;

create or replace function public.apn_mark_delivered(p_message_id uuid)
returns table(ok boolean)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.apn_chat_messages m
  set delivered_at=coalesce(m.delivered_at,now()), updated_at=now()
  where m.id=p_message_id
    and exists (select 1 from public.apn_chat_participants p
      where p.conversation_id=m.conversation_id and p.participant_id=auth.uid()::text)
    and m.sender_id<>auth.uid()::text;
  return query select true;
end;
$$;

grant execute on function public.apn_mark_delivered(uuid) to authenticated;

create or replace function public.apn_mark_read(p_conversation_id uuid, p_message_id uuid)
returns table(ok boolean)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (select 1 from public.apn_chat_participants p
    where p.conversation_id=p_conversation_id and p.participant_id=auth.uid()::text) then
    raise exception 'Not a participant.' using errcode='P0002';
  end if;
  update public.apn_chat_messages m
    set read_at=coalesce(m.read_at,now()), delivered_at=coalesce(m.delivered_at,now()), updated_at=now()
  where m.conversation_id=p_conversation_id
    and m.sender_id<>auth.uid()::text
    and m.created_at <= (select x.created_at from public.apn_chat_messages x where x.id=p_message_id);
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id)
    values(p_conversation_id,auth.uid()::text,p_message_id)
  on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  return query select true;
end;
$$;

grant execute on function public.apn_mark_read(uuid,uuid) to authenticated;

create or replace function public.apn_delete_message(p_message_id uuid)
returns table(ok boolean)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_rows integer;
begin
  delete from public.apn_chat_messages m
  where m.id=p_message_id and m.sender_id=auth.uid()::text
    and m.created_at > now() - interval '5 minutes';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Message can only be deleted by its sender within 5 minutes.' using errcode='P0002';
  end if;
  return query select true;
end;
$$;

grant execute on function public.apn_delete_message(uuid) to authenticated;

-- Return message metadata needed by the Info action.
create or replace function public.apn_message_info(p_message_id uuid)
returns table(message_id uuid,sender_id text,sender_name text,recipient_id text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select m.id,m.sender_id,m.sender_name,
    (select p.participant_id from public.apn_chat_participants p
      where p.conversation_id=m.conversation_id and p.participant_id<>m.sender_id limit 1),
    m.created_at,m.delivered_at,m.read_at
  from public.apn_chat_messages m
  where m.id=p_message_id and exists(select 1 from public.apn_chat_participants p
    where p.conversation_id=m.conversation_id and p.participant_id=auth.uid()::text);
end;
$$;

grant execute on function public.apn_message_info(uuid) to authenticated;

notify pgrst, 'reload schema';

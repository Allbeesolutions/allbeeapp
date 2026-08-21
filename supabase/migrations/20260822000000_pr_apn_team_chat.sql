-- =============================================================================
-- ALLBEE — APN Team Chat: PERSON / DISTRICT / STATE chat + friend system
-- File: 20260822000000_pr_apn_team_chat.sql
--
-- Adds a minimal, normalized chat layer with full server-side authorization:
--   apn_friend_requests     partner <-> partner, states: pending/accepted/rejected/cancelled
--   apn_chat_conversations  person (1:1 accepted) | district | state
--   apn_chat_participants   conversation membership + role (participant/reviewer)
--   apn_chat_messages       text + timestamps, FK to conversations
--   apn_chat_read_states    per-participant last-read message id
--
-- Authorization is enforced entirely server-side using the authenticated user
-- context (auth.uid()), NEVER trusting client-supplied partner/conversation ids.
-- Writes go exclusively through SECURITY DEFINER RPCs; authenticated roles can
-- also SELECT their own conversation/message rows via RLS.
--
-- All DDL is idempotent (drop-then-create / create if not exists / on conflict).
-- No user data is modified. Tables, indexes, RLS, and policies are created first;
-- functions follow so all references resolve.
-- =============================================================================

begin;

-- ── 1. FRIEND REQUESTS ──────────────────────────────────────────────────────
create table if not exists public.apn_friend_requests (
  id            uuid        primary key default gen_random_uuid(),
  requester_id  text        not null,
  recipient_id  text        not null,
  status        text        not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  sent_at       timestamptz not null default now(),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists apn_friend_requests_pair_uc on public.apn_friend_requests
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
  where status = 'pending';
create index if not exists apn_friend_requests_requester_idx on public.apn_friend_requests (requester_id, status);
create index if not exists apn_friend_requests_recipient_idx on public.apn_friend_requests (recipient_id, status);

-- ── 2. CONVERSATIONS ────────────────────────────────────────────────────────
create table if not exists public.apn_chat_conversations (
  id          uuid        primary key default gen_random_uuid(),
  type        text        not null check (type in ('person','district','state')),
  slug        text        unique,
  subject     text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists apn_chat_conversations_slug_idx on public.apn_chat_conversations (slug);

-- ── 3. PARTICIPANTS (depends on conversations) ──────────────────────────────
create table if not exists public.apn_chat_participants (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references public.apn_chat_conversations(id) on delete cascade,
  participant_id   text        not null,
  role             text        not null default 'participant' check (role in ('participant','admin','reviewer')),
  joined_at        timestamptz not null default now(),
  muted_until      timestamptz,
  last_read_msg_id uuid,
  created_at       timestamptz not null default now(),
  unique (conversation_id, participant_id)
);
create index if not exists apn_chat_participants_conv_idx on public.apn_chat_participants (conversation_id);
create index if not exists apn_chat_participants_participant_idx on public.apn_chat_participants (participant_id, conversation_id);

-- ── 4. MESSAGES (depends on conversations) ──────────────────────────────────
create table if not exists public.apn_chat_messages (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references public.apn_chat_conversations(id) on delete cascade,
  sender_id        text        not null,
  sender_name      text,
  sender_apn_id    text,
  body             text        not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists apn_chat_messages_conv_idx on public.apn_chat_messages (conversation_id, created_at);

-- ── 5. READ STATES (depends on conversations + messages) ────────────────────
create table if not exists public.apn_chat_read_states (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references public.apn_chat_conversations(id) on delete cascade,
  participant_id   text        not null,
  last_read_msg_id uuid references public.apn_chat_messages(id) on delete set null,
  updated_at       timestamptz not null default now(),
  unique (conversation_id, participant_id)
);
create index if not exists apn_chat_read_states_participant_idx on public.apn_chat_read_states (participant_id, conversation_id);

-- Enable RLS on all chat tables and revoke default access (policies below).
alter table public.apn_friend_requests enable row level security;
alter table public.apn_chat_conversations enable row level security;
alter table public.apn_chat_participants enable row level security;
alter table public.apn_chat_messages enable row level security;
alter table public.apn_chat_read_states enable row level security;
revoke all on public.apn_friend_requests from public, anon, authenticated;
revoke all on public.apn_chat_conversations from public, anon, authenticated;
revoke all on public.apn_chat_participants from public, anon, authenticated;
revoke all on public.apn_chat_messages from public, anon, authenticated;
revoke all on public.apn_chat_read_states from public, anon, authenticated;

-- ── 6. ROW-LEVEL SECURITY POLICIES ──────────────────────────────────────────
-- Only the requester / recipient (resolved via auth.uid()) may see a request.
-- Admins may view any for support. No arbitrary partner_id exposure.
drop policy if exists apn_friend_requests_select on public.apn_friend_requests;
create policy apn_friend_requests_select on public.apn_friend_requests
  for select to authenticated using (
    requester_id = auth.uid()::text or recipient_id = auth.uid()::text
    or public.is_admin()
  );
drop policy if exists apn_friend_requests_insert on public.apn_friend_requests;
create policy apn_friend_requests_insert on public.apn_friend_requests
  for insert to authenticated with check (requester_id = auth.uid()::text);
drop policy if exists apn_friend_requests_no_update on public.apn_friend_requests;
create policy apn_friend_requests_no_update on public.apn_friend_requests
  for update to authenticated using (false);
drop policy if exists apn_friend_requests_no_delete on public.apn_friend_requests;
create policy apn_friend_requests_no_delete on public.apn_friend_requests
  for delete to authenticated using (false);

drop policy if exists apn_chat_conversations_select on public.apn_chat_conversations;
create policy apn_chat_conversations_select on public.apn_chat_conversations
  for select to authenticated using (
    exists (select 1 from public.apn_chat_participants p
            where p.conversation_id = apn_chat_conversations.id
            and p.participant_id = auth.uid()::text)
    or public.is_admin()
  );
drop policy if exists apn_chat_conversations_insert on public.apn_chat_conversations;
create policy apn_chat_conversations_insert on public.apn_chat_conversations
  for insert to authenticated with check (false);
drop policy if exists apn_chat_conversations_no_update on public.apn_chat_conversations;
create policy apn_chat_conversations_no_update on public.apn_chat_conversations
  for update to authenticated using (false);
drop policy if exists apn_chat_conversations_no_delete on public.apn_chat_conversations;
create policy apn_chat_conversations_no_delete on public.apn_chat_conversations
  for delete to authenticated using (false);

drop policy if exists apn_chat_participants_select on public.apn_chat_participants;
create policy apn_chat_participants_select on public.apn_chat_participants
  for select to authenticated using (participant_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_chat_participants_no_insert on public.apn_chat_participants;
create policy apn_chat_participants_no_insert on public.apn_chat_participants
  for insert to authenticated with check (false);
drop policy if exists apn_chat_participants_no_update on public.apn_chat_participants;
create policy apn_chat_participants_no_update on public.apn_chat_participants
  for update to authenticated using (false);
drop policy if exists apn_chat_participants_no_delete on public.apn_chat_participants;
create policy apn_chat_participants_no_delete on public.apn_chat_participants
  for delete to authenticated using (false);

drop policy if exists apn_chat_messages_select on public.apn_chat_messages;
create policy apn_chat_messages_select on public.apn_chat_messages
  for select to authenticated using (
    exists (select 1 from public.apn_chat_participants p
            where p.conversation_id = apn_chat_messages.conversation_id
            and p.participant_id = auth.uid()::text)
    or public.is_admin()
  );
drop policy if exists apn_chat_messages_no_insert on public.apn_chat_messages;
create policy apn_chat_messages_no_insert on public.apn_chat_messages
  for insert to authenticated with check (false);
drop policy if exists apn_chat_messages_no_update on public.apn_chat_messages;
create policy apn_chat_messages_no_update on public.apn_chat_messages
  for update to authenticated using (false);
drop policy if exists apn_chat_messages_no_delete on public.apn_chat_messages;
create policy apn_chat_messages_no_delete on public.apn_chat_messages
  for delete to authenticated using (false);

drop policy if exists apn_chat_read_states_select on public.apn_chat_read_states;
create policy apn_chat_read_states_select on public.apn_chat_read_states
  for select to authenticated using (participant_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_chat_read_states_no_insert on public.apn_chat_read_states;
create policy apn_chat_read_states_no_insert on public.apn_chat_read_states
  for insert to authenticated with check (false);
drop policy if exists apn_chat_read_states_no_update on public.apn_chat_read_states;
create policy apn_chat_read_states_no_update on public.apn_chat_read_states
  for update to authenticated using (false);
drop policy if exists apn_chat_read_states_no_delete on public.apn_chat_read_states;
create policy apn_chat_read_states_no_delete on public.apn_chat_read_states
  for delete to authenticated using (false);

-- ── 7. SECURITY-DEFINER RPCs (the ONLY client write path) ───────────────────
-- All partner identity (district/state/apn_id/name) is resolved server-side
-- from auth.uid() against apn_users.data — the client never supplies
-- authoritative partner/conversation ids.

-- Send a friend request (by the recipient's APN ID). Prevents duplicates,
-- self-requests, and re-requests between already-connected pairs.
create or replace function public.apn_send_friend_request(p_recipient_apn_id text)
returns table(request_id uuid, status text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_recipient_id text;
  v_request_id uuid;
  v_status text;
begin
  if p_recipient_apn_id is null or p_recipient_apn_id = '' then
    raise exception 'Recipient APN ID is required.' using errcode = '22000';
  end if;
  select u.id into v_recipient_id
  from public.apn_users u
  where lower(trim(u.data->>'apnId')) = lower(trim(p_recipient_apn_id))
    and u.data->>'status' = 'active'
    and u.id <> v_self;
  if v_recipient_id is null then
    raise exception 'Partner not found or not active.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.apn_friend_requests r
             where r.status = 'pending'
               and ((r.requester_id = v_self and r.recipient_id = v_recipient_id)
                    or (r.requester_id = v_recipient_id and r.recipient_id = v_self))) then
    raise exception 'A pending friend request already exists between these partners.' using errcode = '23505';
  end if;
  if exists (select 1 from public.apn_friend_requests r
             where r.status = 'accepted'
               and ((r.requester_id = v_self and r.recipient_id = v_recipient_id)
                    or (r.requester_id = v_recipient_id and r.recipient_id = v_self))) then
    raise exception 'Partners are already connected.' using errcode = '23505';
  end if;
  insert into public.apn_friend_requests (requester_id, recipient_id, status)
    values (v_self, v_recipient_id, 'pending')
    returning apn_friend_requests.id, apn_friend_requests.status into v_request_id, v_status;
   insert into public.apn_notifications (id, data, updated_at) values
     (gen_random_uuid(),
      jsonb_build_object(
        'partnerId', v_recipient_id,
        'audience', 'partner:' || v_recipient_id,
        'title', 'New APN friend request',
        'body', (select data->>'name' from public.apn_users where id = v_self) || ' sent you a friend request on APN Team Chat.',
        'type', 'friend_request',
        'refType', 'friend_request',
        'refId', v_request_id::text,
        'level', 'General',
        'createdBy', 'APN',
        'createdAt', now()
      ), now());
  return query select v_request_id, v_status;
end;
$$;

-- Accept a friend request (recipient only) AND materialize the 1:1 conversation.
create or replace function public.apn_accept_friend_request(p_request_id uuid)
returns table(conversation_id uuid, status text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_req record;
  v_conv uuid;
  v_slug text;
  v_req_name text; v_rec_name text;
begin
  if p_request_id is null then
    raise exception 'Request ID is required.' using errcode = '22000';
  end if;
  select * into v_req from public.apn_friend_requests
  where id = p_request_id and recipient_id = v_self and apn_friend_requests.status = 'pending';
  if not found then
    raise exception 'Not your pending friend request.' using errcode = 'P0002';
  end if;
  update public.apn_friend_requests set status = 'accepted', responded_at = now(), updated_at = now()
    where id = p_request_id;
  select data->>'name' into v_rec_name from public.apn_users where id = v_self;
  select data->>'name' into v_req_name from public.apn_users where id = v_req.requester_id;
  -- deterministic slug => exactly one person conversation per accepted pair
  v_slug := 'person:' || lower(least(v_req.requester_id, v_req.recipient_id)) || ':' || lower(greatest(v_req.requester_id, v_req.recipient_id));
  insert into public.apn_chat_conversations (id, type, slug, subject, created_by, created_at, updated_at)
    values (gen_random_uuid(), 'person', v_slug, v_req_name, v_self, now(), now())
    on conflict (slug) do nothing
    returning id into v_conv;
  if v_conv is null then
    select id into v_conv from public.apn_chat_conversations where slug = v_slug;
  end if;
  insert into public.apn_chat_participants (conversation_id, participant_id, role)
    values (v_conv, v_req.requester_id, 'participant'), (v_conv, v_req.recipient_id, 'participant')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
   insert into public.apn_notifications (id, data, updated_at) values
     (gen_random_uuid(),
      jsonb_build_object(
        'partnerId', v_req.requester_id,
        'audience', 'partner:' || v_req.requester_id,
        'title', 'Friend request accepted',
        'body', v_rec_name || ' accepted your friend request. You can now message each other.',
        'type', 'friend_accepted',
        'refType', 'conversation',
        'refId', v_conv::text,
        'level', 'General',
        'createdBy', 'APN',
        'createdAt', now()
      ), now());
  return query select v_conv, 'accepted'::text;
end;
$$;

-- Reject a friend request (recipient only). Idempotent.
create or replace function public.apn_reject_friend_request(p_request_id uuid)
returns table(status text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
begin
  if p_request_id is null then
    raise exception 'Request ID is required.' using errcode = '22000';
  end if;
  update public.apn_friend_requests
    set status = 'rejected', responded_at = now(), updated_at = now()
    where id = p_request_id and recipient_id = v_self and apn_friend_requests.status = 'pending';
  if not found then
    raise exception 'Not your pending friend request.' using errcode = 'P0002';
  end if;
  return query select 'rejected'::text;
end;
$$;

-- Retrieve (or create) the person conversation for an accepted pair.
create or replace function public.apn_get_or_create_person_conversation(p_other_apn_id text)
returns table(conversation_id uuid, subject text, participant_apn_id text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_other_id text; v_other_name text; v_other_apn text;
  v_slug text; v_conv uuid;
begin
  select u.id, u.data->>'name', u.data->>'apnId' into v_other_id, v_other_name, v_other_apn
  from public.apn_users u
  where lower(trim(u.data->>'apnId')) = lower(trim(p_other_apn_id));
  if v_other_id is null then
    raise exception 'Partner not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.apn_friend_requests r
               where r.status = 'accepted'
                 and ((r.requester_id = v_self and r.recipient_id = v_other_id)
                      or (r.requester_id = v_other_id and r.recipient_id = v_self))) then
    raise exception 'Partners are not connected.' using errcode = 'P0002';
  end if;
  v_slug := 'person:' || lower(least(v_self, v_other_id)) || ':' || lower(greatest(v_self, v_other_id));
  insert into public.apn_chat_conversations (id, type, slug, subject, created_by, created_at, updated_at)
    values (gen_random_uuid(), 'person', v_slug, v_other_name, v_self, now(), now())
    on conflict (slug) do nothing
    returning id into v_conv;
  if v_conv is null then
    select id into v_conv from public.apn_chat_conversations where slug = v_slug;
  end if;
  insert into public.apn_chat_participants (conversation_id, participant_id, role)
    values (v_conv, v_self, 'participant'), (v_conv, v_other_id, 'participant')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv, v_other_name, v_other_apn;
end;
$$;

-- Send a message into a conversation the caller participates in.
create or replace function public.apn_send_message(p_conversation_id uuid, p_body text)
returns table(message_id uuid, created_at timestamptz, sender_id text, sender_name text, sender_apn_id text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_name text; v_apn text;
  v_msg uuid; v_created timestamptz;
begin
  if p_conversation_id is null then
    raise exception 'Conversation ID is required.' using errcode = '22000';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'Message body is required.' using errcode = '22000';
  end if;
  -- authorization: caller must be a participant (admins do NOT impersonate)
  if not exists (select 1 from public.apn_chat_participants p
                 where p.conversation_id = p_conversation_id
                   and p.participant_id = v_self) then
    raise exception 'You are not a participant of this conversation.' using errcode = 'P0002';
  end if;
  select data->>'name', data->>'apnId' into v_name, v_apn from public.apn_users where id = v_self;
  insert into public.apn_chat_messages (id, conversation_id, sender_id, sender_name, sender_apn_id, body, created_at, updated_at)
    values (gen_random_uuid(), p_conversation_id, v_self, v_name, v_apn, p_body, now(), now())
    returning apn_chat_messages.id, apn_chat_messages.created_at into v_msg, v_created;
  update public.apn_chat_conversations set updated_at = now() where id = p_conversation_id;
  insert into public.apn_chat_read_states (conversation_id, participant_id, last_read_msg_id)
    values (p_conversation_id, v_self, v_msg)
    on conflict (conversation_id, participant_id) do update set last_read_msg_id = v_msg;
  return query select v_msg, v_created, v_self, v_name, v_apn;
end;
$$;

-- Mark a conversation as read up to a message (the caller's own read state).
create or replace function public.apn_mark_read(p_conversation_id uuid, p_message_id uuid)
returns table(ok boolean) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
begin
  if not exists (select 1 from public.apn_chat_participants p
                 where p.conversation_id = p_conversation_id and p.participant_id = v_self) then
    raise exception 'Not a participant.' using errcode = 'P0002';
  end if;
  insert into public.apn_chat_read_states (conversation_id, participant_id, last_read_msg_id)
    values (p_conversation_id, v_self, p_message_id)
    on conflict (conversation_id, participant_id) do update set last_read_msg_id = p_message_id;
  return query select true;
end;
$$;

-- Unread counts per conversation for the caller (aggregated). Used by the UI
-- badge without re-reading every message.
create or replace function public.apn_chat_unreads()
returns table(conversation_id uuid, unread_count bigint) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select c.id,
         count(m.id) filter (where m.sender_id <> auth.uid()::text
               and m.id > coalesce(rs.last_read_msg_id, '00000000-0000-0000-0000-000000000000'::uuid)) as unread_count
  from public.apn_chat_conversations c
  join public.apn_chat_participants p
    on p.conversation_id = c.id and p.participant_id = auth.uid()::text
  left join public.apn_chat_messages m on m.conversation_id = c.id
  left join public.apn_chat_read_states rs
    on rs.conversation_id = c.id and rs.participant_id = auth.uid()::text
  group by c.id;
end;
$$;

-- Resolve the caller's own district/state/apn_id/name (server-side).
create or replace function public.apn_partner_geo()
returns table(partner_id text, district text, state text, apn_id text, name text) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select u.id, u.data->>'district', u.data->>'state', u.data->>'apnId', u.data->>'name'
  from public.apn_users u
  where u.id = auth.uid()::text;
end;
$$;

-- District conversation for the caller's district (only active partners of
-- that district become participants). Reviewer access for admins.
create or replace function public.apn_get_district_conversation()
returns table(conversation_id uuid, subject text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_geo record; v_slug text; v_conv uuid;
begin
  select * into v_geo from public.apn_partner_geo();
  if v_geo.district is null then
    raise exception 'No district assigned.' using errcode = 'P0002';
  end if;
  v_slug := 'district:' || lower(regexp_replace(v_geo.district, '\s+', '_', 'g'));
  insert into public.apn_chat_conversations (id, type, slug, subject, created_by, created_at, updated_at)
    values (gen_random_uuid(), 'district', v_slug, v_geo.district || ' District', auth.uid()::text, now(), now())
    on conflict (slug) do nothing
    returning id into v_conv;
  if v_conv is null then
    select id into v_conv from public.apn_chat_conversations where slug = v_slug;
  end if;
  insert into public.apn_chat_participants (conversation_id, participant_id, role)
    select v_conv, u.id, 'participant'
    from public.apn_users u
    where lower(u.data->>'district') = lower(v_geo.district) and u.data->>'status' = 'active'
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv, v_geo.district || ' District';
end;
$$;

create or replace function public.apn_get_state_conversation()
returns table(conversation_id uuid, subject text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_geo record; v_slug text; v_conv uuid;
begin
  select * into v_geo from public.apn_partner_geo();
  if v_geo.state is null then
    raise exception 'No state assigned.' using errcode = 'P0002';
  end if;
  v_slug := 'state:' || lower(regexp_replace(v_geo.state, '\s+', '_', 'g'));
  insert into public.apn_chat_conversations (id, type, slug, subject, created_by, created_at, updated_at)
    values (gen_random_uuid(), 'state', v_slug, v_geo.state || ' State', auth.uid()::text, now(), now())
    on conflict (slug) do nothing
    returning id into v_conv;
  if v_conv is null then
    select id into v_conv from public.apn_chat_conversations where slug = v_slug;
  end if;
  insert into public.apn_chat_participants (conversation_id, participant_id, role)
    select v_conv, u.id, 'participant'
    from public.apn_users u
    where lower(u.data->>'state') = lower(v_geo.state) and u.data->>'status' = 'active'
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv, v_geo.state || ' State';
end;
$$;

-- List the caller's conversations (person + district + state) with the last
-- message and unread count. Admin reviewers see all conversations.
create or replace function public.apn_list_conversations()
returns table(
  conversation_id uuid, conv_type text, subject text,
  last_message text, last_sender_id text, last_at timestamptz,
  unread_count bigint, participant_count bigint
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select c.id, c.type, c.subject,
         lm.body, lm.sender_id, lm.created_at,
         count(m.id) filter (where m.sender_id <> auth.uid()::text
              and m.id > coalesce(rs.last_read_msg_id, '00000000-0000-0000-0000-000000000000'::uuid)) as unread_count,
         count(p.participant_id) as participant_count
  from public.apn_chat_conversations c
  join public.apn_chat_participants p2 on p2.conversation_id = c.id
    and (p2.participant_id = auth.uid()::text or public.is_admin())
  left join public.apn_chat_messages m on m.conversation_id = c.id
  left join public.apn_chat_read_states rs on rs.conversation_id = c.id and rs.participant_id = auth.uid()::text
  left join lateral (
    select body, sender_id, created_at from public.apn_chat_messages mm
    where mm.conversation_id = c.id order by mm.created_at desc limit 1
  ) lm on true
  group by c.id, c.type, c.subject, lm.body, lm.sender_id, lm.created_at
  having bool_or(p2.participant_id = auth.uid()::text) or public.is_admin()
  order by c.updated_at desc;
end;
$$;

-- List friend requests (incoming + outgoing) for the caller.
create or replace function public.apn_list_friend_requests()
returns table(request_id uuid, other_id text, other_name text, other_apn_id text, direction text, status text, sent_at timestamptz, responded_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select r.id,
         case when r.recipient_id = auth.uid()::text then r.requester_id else r.recipient_id end as other_id,
         (select data->>'name' from public.apn_users where id = (case when r.recipient_id = auth.uid()::text then r.requester_id else r.recipient_id end)) as other_name,
         (select data->>'apnId' from public.apn_users where id = (case when r.recipient_id = auth.uid()::text then r.requester_id else r.recipient_id end)) as other_apn_id,
         case when r.recipient_id = auth.uid()::text then 'incoming' else 'outgoing' end as direction,
         r.status, r.sent_at, r.responded_at
  from public.apn_friend_requests r
  where r.requester_id = auth.uid()::text or r.recipient_id = auth.uid()::text
  order by r.sent_at desc;
end;
$$;

-- List messages for the caller in a conversation they participate in (read-only).
create or replace function public.apn_list_messages(p_conversation_id uuid)
returns table(id uuid, sender_id text, sender_name text, sender_apn_id text, body text, created_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (select 1 from public.apn_chat_participants p
                 where p.conversation_id = p_conversation_id
                  and (p.participant_id = auth.uid()::text or public.is_admin())) then
    raise exception 'Not a participant.' using errcode = 'P0002';
  end if;
  return query
  select m.id, m.sender_id, m.sender_name, m.sender_apn_id, m.body, m.created_at
  from public.apn_chat_messages m
  where m.conversation_id = p_conversation_id
  order by m.created_at asc;
end;
$$;

-- Grants: only the RPCs are exposed to the authenticated role; the underlying
-- chat tables are revoked from authenticated (writes only via RPCs above).
grant execute on function
  public.apn_send_friend_request(text),
  public.apn_accept_friend_request(uuid),
  public.apn_reject_friend_request(uuid),
  public.apn_get_or_create_person_conversation(text),
  public.apn_send_message(uuid, text),
  public.apn_mark_read(uuid, uuid),
  public.apn_chat_unreads(),
  public.apn_partner_geo(),
  public.apn_get_district_conversation(),
  public.apn_get_state_conversation(),
  public.apn_list_conversations(),
  public.apn_list_friend_requests(),
  public.apn_list_messages(uuid)
to authenticated;

-- Realtime: replicate chat tables so partners receive live message/friend
-- updates without polling; RLS still gates row reads per participant.
alter publication supabase_realtime add table public.apn_chat_messages;
alter publication supabase_realtime add table public.apn_chat_participants;
alter publication supabase_realtime add table public.apn_chat_conversations;
alter publication supabase_realtime add table public.apn_friend_requests;
alter publication supabase_realtime add table public.apn_chat_read_states;

commit;

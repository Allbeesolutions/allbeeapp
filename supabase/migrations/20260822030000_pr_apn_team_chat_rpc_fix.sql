-- PR-APN Team Chat — RPC runtime fix (patch 3).
-- Production-readiness regression caught via end-to-end verification: several RPCs
-- declare RETURNS TABLE columns (conversation_id, status, created_at) that collide
-- with same-named target-table columns inside ON CONFLICT / RETURNING clauses.
-- PL/pgSQL raises "column reference X is ambiguous" at runtime. This patch
-- qualifies the colliding column references with their table name so the RPCs
-- execute correctly. Idempotent (CREATE OR REPLACE).

-- Send a friend request: qualify RETURNING columns (status collides with out-var).
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
   insert into public.apn_notifications (id, data, created_at) values
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

-- Accept a friend request: qualify ON CONFLICT columns (conversation_id out-var).
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
  where id = p_request_id and recipient_id = v_self and status = 'pending';
  if not found then
    raise exception 'Not your pending friend request.' using errcode = 'P0002';
  end if;
  update public.apn_friend_requests set status = 'accepted', responded_at = now(), updated_at = now()
    where id = p_request_id;
  select data->>'name' into v_rec_name from public.apn_users where id = v_self;
  select data->>'name' into v_req_name from public.apn_users where id = v_req.requester_id;
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
   insert into public.apn_notifications (id, data, created_at) values
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

-- Person conversation: qualify ON CONFLICT columns.
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

-- Send a message: qualify RETURNING columns (created_at collides with out-var).
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

-- District conversation: qualify ON CONFLICT columns.
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

-- State conversation: qualify ON CONFLICT columns.
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

comment on function public.apn_get_district_conversation() is 'Fixed: ON CONFLICT columns qualified against RETURNS-TABLE out-var (patch 3).';
comment on function public.apn_get_state_conversation() is 'Fixed: ON CONFLICT columns qualified against RETURNS-TABLE out-var (patch 3).';
comment on function public.apn_send_friend_request(text) is 'Fixed: RETURNING columns qualified against RETURNS-TABLE out-var (patch 3).';
comment on function public.apn_accept_friend_request(uuid) is 'Fixed: ON CONFLICT columns qualified against RETURNS-TABLE out-var (patch 3).';
comment on function public.apn_get_or_create_person_conversation(text) is 'Fixed: ON CONFLICT columns qualified against RETURNS-TABLE out-var (patch 3).';
comment on function public.apn_send_message(uuid, text) is 'Fixed: RETURNING columns qualified against RETURNS-TABLE out-var (patch 3).';

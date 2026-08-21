-- PR-APN Team Chat — RPC notification column fix (patch 4).
-- Production-readiness regression caught via end-to-end verification: 
-- apn_notifications table does not have a "created_at" column (its schema is id, data, updated_at).
-- Inserting with "created_at" fails with 42703 at runtime. This patch re-creates 
-- apn_send_friend_request and apn_accept_friend_request to insert into updated_at 
-- instead of created_at. Idempotent (CREATE OR REPLACE).

-- Send a friend request: use updated_at for notifications.
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

-- Accept a friend request: use updated_at for notifications.
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

comment on function public.apn_send_friend_request(text) is 'Fixed: Use updated_at instead of non-existent created_at in notifications (patch 4).';
comment on function public.apn_accept_friend_request(uuid) is 'Fixed: Use updated_at instead of non-existent created_at in notifications (patch 4).';

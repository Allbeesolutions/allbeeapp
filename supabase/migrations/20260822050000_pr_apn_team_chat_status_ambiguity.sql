-- PR-APN Team Chat — RPC status column ambiguity fix (patch 5).
-- Production-readiness regression caught via end-to-end verification:
-- apn_accept_friend_request and apn_reject_friend_request return a column named "status",
-- which creates a local PL/pgSQL variable. This makes unqualified references to the
-- "status" table column inside WHERE clauses ambiguous.
-- This patch qualifies those column references as apn_friend_requests.status.
-- Idempotent (CREATE OR REPLACE).

-- Accept a friend request: qualify status inside queries, keep updated_at + constraint name fixes.
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

-- Reject a friend request: qualify status inside WHERE clause.
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

comment on function public.apn_accept_friend_request(uuid) is 'Fixed: Qualify apn_friend_requests.status in SELECT to avoid out-parameter collision (patch 5).';
comment on function public.apn_reject_friend_request(uuid) is 'Fixed: Qualify apn_friend_requests.status in UPDATE WHERE to avoid out-parameter collision (patch 5).';

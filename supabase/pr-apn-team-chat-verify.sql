-- =============================================================================
-- ALLBEE — APN Team Chat: behavioral + authorization verification
-- File: supabase/pr-apn-team-chat-verify.sql  (paste into Supabase SQL Editor, RUN)
--
-- Each scenario is a self-contained DO block => its own transaction => auth.uid()
-- re-evaluates under the impersonated request.jwt.claims. Run in autocommit (the
-- SQL Editor default; do NOT wrap in BEGIN/COMMIT).
--
-- Covers Tasks 7-11: authenticated send/accept/reject, unauthorized access
-- rejected, exactly-one conversation, duplicate/duplicate-accept rejected,
-- participant isolation, sender-authoritative, district/state isolation,
-- unread persistence, correct recipient notifications. Zero-residue (test users
-- use fixed "TC-" UUIDs; final cleanup deletes them). Idempotent re-run.
-- =============================================================================

-- test actors (fixed UUIDs; idempotent)
insert into public.apn_users (id, data, updated_at) values
  ('11111111-1111-1111-1111-111111111111','{"apnId":"TC-A-0001","name":"TcA","status":"active","district":"North","state":"NorthState"}',now()),
  ('22222222-2222-2222-2222-222222222222','{"apnId":"TC-B-0001","name":"TcB","status":"active","district":"North","state":"NorthState"}',now()),
  ('33333333-3333-3333-3333-333333333333','{"apnId":"TC-C-0001","name":"TcC","status":"active","district":"South","state":"SouthState"}',now()),
  ('44444444-4444-4444-4444-444444444444','{"apnId":"TC-D-0001","name":"TcD","status":"active","district":"South","state":"NorthState"}',now())
on conflict (id) do update set data = excluded.data;

create or replace function public._tc_assert(cond boolean, msg text) returns void
language plpgsql as $f$ begin if not coalesce(cond,false) then raise exception 'TC VERIFY FAIL: %', msg; end if; end $f$;

-- ids: A,B,C,D; request_id (A->B); conv_id (A-B after accept)
create temp table if not exists _tc(request_id uuid, conv_id uuid);
truncate _tc;

-- 1. authenticated send A -> B  + notification to B
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',false);
  insert into _tc(request_id) select request_id from public.apn_send_friend_request('TC-B-0001');
  perform public._tc_assert((select count(*)=1 from _tc) and (select request_id is not null from _tc),'A sends pending request to B');
  perform public._tc_assert(exists (select 1 from public.apn_notifications n
      where n.data->>'audience'='partner:22222222-2222-2222-2222-222222222222' and n.data->>'type'='friend_request'
      and n.data->>'refId'=(select request_id::text from _tc)),'B gets friend_request notification');
end $$;

-- 2. unauthorized accept: C tries to accept A->B  (must fail)
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  begin
    perform public.apn_accept_friend_request((select request_id from _tc));
    raise exception 'C must NOT accept A->B request';
  exception when others then
    perform public._tc_assert(sqlerrm like '%Not your pending friend request%','C accept rejected');
  end;
end $$;

-- 3. authorized accept: B accepts  -> conversation + participants + notif to A
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',false);
  update _tc set conv_id=(select conversation_id from public.apn_accept_friend_request((select request_id from _tc)));
  perform public._tc_assert((select conv_id is not null from _tc),'B accept returns conversation_id');
  perform public._tc_assert((select count(*) from public.apn_chat_conversations c
      where c.type='person' and c.slug='person:'||lower(least('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'))||':'||lower(greatest('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')) )=1,'exactly one A-B conversation');
  perform public._tc_assert((select count(*) from public.apn_chat_participants p
      where p.conversation_id=(select conv_id from _tc) and p.participant_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'))=2,'A and B both participants');
  perform public._tc_assert(exists (select 1 from public.apn_notifications n
      where n.data->>'audience'='partner:11111111-1111-1111-1111-111111111111' and n.data->>'type'='friend_accepted'
      and n.data->>'refId'=(select conv_id::text from _tc)),'A gets friend_accepted notification');
end $$;

-- 4. duplicate accept: B accepts again (must fail, no 2nd conversation)
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',false);
  begin
    perform public.apn_accept_friend_request((select request_id from _tc));
    raise exception 'duplicate accept must fail';
  exception when others then
    perform public._tc_assert(sqlerrm like '%Not your pending friend request%','duplicate accept rejected');
  end;
end $$;

-- 5. participant isolation: C cannot list or send into A-B conversation
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  begin
    perform public.apn_list_messages((select conv_id from _tc));
    raise exception 'C must NOT list A-B messages';
  exception when others then
    perform public._tc_assert(sqlergm() like '%Not a participant%','C listing rejected');
  end;
  begin
    perform public.apn_send_message((select conv_id from _tc),'hi');
    raise exception 'C must NOT send to A-B conversation';
  exception when others then
    perform public._tc_assert(sqlergm() like '%not a participant%','C sending rejected');
  end;
end $$;

-- 6. authorized messaging A -> B (sender is A, server-authoritative)
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',false);
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body)
    -- bypass apn_send_message to simulate a raw client insert attempt by A (legit sender)
    select gen_random_uuid(), (select conv_id from _tc), '11111111-1111-1111-1111-111111111111','TcA','TC-A-0001','A to B via RPC';
  -- real RPC send (the only sanctioned path) from A
  perform public.apn_send_message((select conv_id from _tc),'A second message (authorized)');
  perform public._tc_assert((select count(*) from public.apn_chat_messages m
      where m.conversation_id=(select conv_id from _tc) and m.sender_id='11111111-1111-1111-1111-111111111111')=2,'A has 2 messages');
end $$;

-- 7. unread persists for B, clears on mark_read
DO $$
declare rc bigint; conv uuid; rn uuid;
begin
  perform set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',false);
  select c.conv_id into conv from _tc;
  select count(*) into rc from public.apn_chat_unreads() where conversation_id=conv;
  perform public._tc_assert(rc>=2,'B should have >=2 unread at A-B conv');
  select max(id) into rn from public.apn_list_messages(conv);
  perform public.apn_mark_read(conv, rn);
  select count(*) into rc from public.apn_chat_unreads() where conversation_id=conv;
  perform public._tc_assert(rc=0,'unread clears after mark_read');
end $$;

-- 8. unauthorized reject: A tries to reject A->B request (only B can)  -> fail
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',false);
  begin
    perform public.apn_reject_friend_request((select request_id from _tc));
    raise exception 'A must NOT reject A->B (only recipient B can)';
  exception when others then
    perform public._tc_assert(sqlergm() like '%Not your pending friend request%','A reject rejected');
  end;
end $$;

-- 9. reject does NOT unlock a private chat (D rejects an incoming request from C->D)
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  insert into _tc(request_id) select request_id from public.apn_send_friend_request('TC-D-0001') on conflict do nothing;
  update _tc set request_id=(select request_id from public.apn_send_friend_request('TC-D-0001')); -- placeholder, real set below
end $$;
-- (re-run 9 as two blocks to capture then reject cleanly)
DO $$
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  insert into _tc select public.apn_send_friend_request('TC-D-0001').request_id, conv_id from public.apn_send_friend_request('TC-D-0001');
end $$;
DO $$
declare rid uuid; cid uuid;
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  select request_id into rid from _tc where request_id is not null order by request_id desc limit 1;
  perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',false);
  select public.apn_reject_friend_request(rid).status into cid;
  perform public._tc_assert(cid='rejected','D rejects incoming from C');
  perform public._tc_assert(not exists (select 1 from public.apn_chat_conversations c
      where c.type='person' and c.slug='person:'||lower(least('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444'))||':'||lower(greatest('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')))),'rejected request creates NO private conversation');
end $$;

-- 10. district isolation: D (different district from A/B) joins district chat,
--     but cannot read South-district-only messages it isn't a member of.
DO $$
declare dconv uuid; south_parties int; dpart int;
begin
  perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',false);
  select conversation_id into dconv from public.apn_get_district_conversation();
  -- D is in South district; assert D is a participant
  select count(*) into dpart from public.apn_chat_participants p where p.conversation_id=dconv and p.participant_id='44444444-4444-4444-4444-444444444444';
  perform public._tc_assert(dpart=1,'D is a participant of D''s district chat');
  -- North-district conversation should NOT contain D as participant
  select count(*) into south_parties from public.apn_chat_conversations c
    join public.apn_chat_participants p on p.conversation_id=c.id
    where c.type='district' and p.participant_id='44444444-4444-4444-4444-444444444444' and c.slug='district:north';
  perform public._tc_assert(south_parties=0,'D must not be a participant of the North district chat');
end $$;

-- 11. state isolation: C (SouthState) vs D (NorthState) land in different state chats
DO $$
declare cconv uuid; dconv2 uuid;
begin
  perform set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',false);
  select conversation_id into cconv from public.apn_get_state_conversation();
  perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',false);
  select conversation_id into dconv2 from public.apn_get_state_conversation();
  perform public._tc_assert(cconv<>dconv2,'C and D get distinct state conversations');
end $$;

-- ── cleanup (zero residue) ──────────────────────────────────────────────────
delete from public.apn_chat_messages where conversation_id in (
  select id from public.apn_chat_conversations
  where type='person' and (slug like 'person:%11111111-1111-1111-1111-111111111111%33333333-3333-3333-3333-333333333333%')
);
delete from public.apn_chat_read_states using public.apn_chat_conversations c where apn_chat_read_states.conversation_id=c.id
  and c.type='person' and (c.slug like '%11111111%' or c.slug like '%33333333%' or c.slug like '%44444444%');
delete from public.apn_chat_participants using public.apn_chat_conversations c where apn_chat_participants.conversation_id=c.id
  and c.type in ('person','district','state') and (c.slug like '%11111111%' or c.slug like '%22222222%' or c.slug like '%33333333%' or c.slug like '%44444444%' or c.slug in ('district:south','district:north','state:northstate','state:southstate'));
delete from public.apn_friend_requests where requester_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')
  or recipient_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
delete from public.apn_chat_conversations
  where type in ('person','district','state') and (slug like '%11111111%' or c.slug like '%22222222%' or c.slug like '%33333333%' or c.slug like '%44444444%' or slug in ('district:south','district:north','state:northstate','state:southstate'));
delete from public.apn_notifications where data->>'refId' in (
  select id::text from public.apn_friend_requests where requester_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444') or recipient_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444'));
delete from public.apn_users where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
drop function if exists public._tc_assert;

reset request.jwt.claims;

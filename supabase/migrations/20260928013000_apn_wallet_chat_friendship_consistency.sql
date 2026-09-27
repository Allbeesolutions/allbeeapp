-- APN wallet/chat consistency and friendship lifecycle
-- Refresh withdrawal wallets from authoritative commission sources on read, fix
-- ambiguous conversation timestamps, and add owner-scoped revoke/unfriend RPCs.

create or replace function public.apn_withdrawal_dashboard(p_partner_id text default null)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_pid text := coalesce(p_partner_id, auth.uid()::text); v_wallets jsonb; v_requests jsonb;
begin
  if v_pid is null then raise exception 'Sign in required.' using errcode='insufficient_privilege'; end if;
  if v_pid <> auth.uid()::text and not public.apn_withdrawal_can_manage() then raise exception 'Withdrawal access denied.' using errcode='insufficient_privilege'; end if;
  perform public.apn_withdrawal_refresh_wallet(v_pid);
  select coalesce(jsonb_agg(to_jsonb(w) order by w.wallet_type),'[]'::jsonb) into v_wallets from public.apn_withdrawal_wallets w where w.partner_id=v_pid;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.requested_at desc),'[]'::jsonb) into v_requests from public.apn_withdrawal_requests r where r.partner_id=v_pid;
  return jsonb_build_object('wallets',v_wallets,'requests',v_requests,'nextSettlementDate',public.apn_withdrawal_next_settlement_date());
end; $$;
revoke all on function public.apn_withdrawal_dashboard(text) from public,anon;
grant execute on function public.apn_withdrawal_dashboard(text) to authenticated;

create or replace function public.apn_list_conversations()
returns table(conversation_id uuid, conv_type text, subject text,last_message text,last_sender_id text,last_at timestamptz,unread_count bigint,participant_count bigint)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 return query
 select c.id,c.type,c.subject,lm.body,lm.sender_id,lm.message_created_at,
   count(distinct m.id) filter(where m.sender_id<>auth.uid()::text and m.id>coalesce(rs.last_read_msg_id,'00000000-0000-0000-0000-000000000000'::uuid)),
   count(distinct p2.participant_id)
 from public.apn_chat_conversations c
 join public.apn_chat_participants p2 on p2.conversation_id=c.id
 left join public.apn_chat_messages m on m.conversation_id=c.id
 left join public.apn_chat_read_states rs on rs.conversation_id=c.id and rs.participant_id=auth.uid()::text
 left join lateral(select mm.body,mm.sender_id,mm.created_at as message_created_at from public.apn_chat_messages mm where mm.conversation_id=c.id order by mm.created_at desc limit 1) lm on true
 where exists(select 1 from public.apn_chat_participants mine where mine.conversation_id=c.id and mine.participant_id=auth.uid()::text) or public.is_admin()
 group by c.id,c.type,c.subject,c.updated_at,lm.body,lm.sender_id,lm.message_created_at
 order by c.updated_at desc;
end; $$;
revoke all on function public.apn_list_conversations() from public,anon;
grant execute on function public.apn_list_conversations() to authenticated;

create or replace function public.apn_revoke_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 delete from public.apn_friend_requests r where r.id=p_request_id and r.requester_id=auth.uid()::text and r.status='pending';
 if not found then raise exception 'Pending outgoing friend request not found.' using errcode='P0002'; end if;
end; $$;
revoke all on function public.apn_revoke_friend_request(uuid) from public,anon;
grant execute on function public.apn_revoke_friend_request(uuid) to authenticated;

create or replace function public.apn_unfriend(p_other_id text)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text;
begin
 if v_self is null or nullif(trim(p_other_id),'') is null or p_other_id=v_self then raise exception 'Invalid friend.' using errcode='22000'; end if;
 delete from public.apn_friend_requests r where r.status='accepted' and ((r.requester_id=v_self and r.recipient_id=p_other_id) or (r.requester_id=p_other_id and r.recipient_id=v_self));
 if not found then raise exception 'Friendship not found.' using errcode='P0002'; end if;
end; $$;
revoke all on function public.apn_unfriend(text) from public,anon;
grant execute on function public.apn_unfriend(text) to authenticated;
notify pgrst,'reload schema';

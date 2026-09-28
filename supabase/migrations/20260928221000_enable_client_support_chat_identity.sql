-- Client support chats reuse the participant-scoped APN chat transport. Clients do
-- not have an apn_users row, so fall back to their canonical profile name.
create or replace function public.apn_send_message_v3(p_conversation_id uuid,p_body text,p_reply_to_id uuid default null,p_mentions jsonb default '[]'::jsonb) returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text,reply_to_id uuid) language plpgsql security definer set search_path='pg_catalog','public','pg_temp' as $$
declare v_self text:=auth.uid()::text; v_name text; v_apn text; v_msg uuid; v_created timestamptz;
begin
 if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
 if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
 if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then raise exception 'You are not a participant of this conversation.' using errcode='P0002'; end if;
 if p_reply_to_id is not null and not exists(select 1 from public.apn_chat_messages m where m.id=p_reply_to_id and m.conversation_id=p_conversation_id) then raise exception 'Reply target is not in this conversation.' using errcode='P0002'; end if;
 select coalesce(u.data->>'name',p.name,'User'),u.data->>'apnId' into v_name,v_apn from public.profiles p left join public.apn_users u on u.id=v_self where p.id::text=v_self;
 insert into public.apn_chat_messages as msg(id,conversation_id,sender_id,sender_name,sender_apn_id,body,reply_to_id,mentions,created_at,updated_at) values(gen_random_uuid(),p_conversation_id,v_self,v_name,v_apn,trim(p_body),p_reply_to_id,case when jsonb_typeof(coalesce(p_mentions,'[]'::jsonb))='array' then p_mentions else '[]'::jsonb end,now(),now()) returning msg.id,msg.created_at into v_msg,v_created;
 update public.apn_chat_conversations c set updated_at=now() where c.id=p_conversation_id;
 insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg) on conflict(conversation_id,participant_id) do update set last_read_msg_id=v_msg,updated_at=now();
 return query select v_msg,v_created,v_self,v_name,v_apn,p_reply_to_id;
end; $$;

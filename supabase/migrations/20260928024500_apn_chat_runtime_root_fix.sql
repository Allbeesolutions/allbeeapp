-- Chat runtime root fix. RETURNS TABLE names are PL/pgSQL variables, so unqualified
-- created_at/id references can collide with real columns. Use SQL for read paths
-- and qualified RETURNING expressions for write paths.
begin;

drop function if exists public.apn_list_messages(uuid);
create function public.apn_list_messages(p_conversation_id uuid)
returns table(id uuid,sender_id text,sender_name text,sender_apn_id text,body text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz,reply_to_id uuid,edited_at timestamptz,reactions jsonb,mentions jsonb,attachments jsonb)
language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select m.id,m.sender_id,m.sender_name,m.sender_apn_id,m.body,m.created_at,m.delivered_at,m.read_at,m.reply_to_id,m.edited_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',rx.emoji,'count',rx.cnt,'mine',rx.mine) order by rx.emoji) from (
      select r.emoji,count(*)::bigint cnt,bool_or(r.reactor_id=auth.uid()::text) mine
      from public.apn_chat_reactions r where r.message_id=m.id group by r.emoji
    ) rx),'[]'::jsonb),
    coalesce(m.mentions,'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_path',a.storage_path) order by a.created_at)
      from public.apn_chat_attachments a where a.message_id=m.id),'[]'::jsonb)
  from public.apn_chat_messages m
  where m.conversation_id=$1
    and (public.is_admin() or exists(select 1 from public.apn_chat_participants p where p.conversation_id=$1 and p.participant_id=auth.uid()::text))
  order by m.created_at asc;
$$;
revoke all on function public.apn_list_messages(uuid) from public,anon;
grant execute on function public.apn_list_messages(uuid) to authenticated;

create or replace function public.apn_send_message_v3(p_conversation_id uuid,p_body text,p_reply_to_id uuid default null,p_mentions jsonb default '[]'::jsonb)
returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text,reply_to_id uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_apn text; v_msg uuid; v_created timestamptz;
begin
  if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
  if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then raise exception 'You are not a participant of this conversation.' using errcode='P0002'; end if;
  if p_reply_to_id is not null and not exists(select 1 from public.apn_chat_messages m where m.id=p_reply_to_id and m.conversation_id=p_conversation_id) then raise exception 'Reply target is not in this conversation.' using errcode='P0002'; end if;
  select u.data->>'name',u.data->>'apnId' into v_name,v_apn from public.apn_users u where u.id=v_self;
  insert into public.apn_chat_messages as msg(id,conversation_id,sender_id,sender_name,sender_apn_id,body,reply_to_id,mentions,created_at,updated_at)
    values(gen_random_uuid(),p_conversation_id,v_self,v_name,v_apn,trim(p_body),p_reply_to_id,case when jsonb_typeof(coalesce(p_mentions,'[]'::jsonb))='array' then p_mentions else '[]'::jsonb end,now(),now())
    returning msg.id,msg.created_at into v_msg,v_created;
  update public.apn_chat_conversations c set updated_at=now() where c.id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=v_msg,updated_at=now();
  return query select v_msg,v_created,v_self,v_name,v_apn,p_reply_to_id;
end; $$;
revoke all on function public.apn_send_message_v3(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.apn_send_message_v3(uuid,text,uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;

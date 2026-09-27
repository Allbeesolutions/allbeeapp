begin;

-- Remove admin participants accidentally attached to another admin's 1:1 support
-- conversation by the old global-admin read path. The canonical admin support slug
-- contains only the intended admin auth id and partner id.
delete from public.apn_chat_participants p
using public.apn_chat_conversations c
where p.conversation_id=c.id
  and c.type='person'
  and c.slug like 'admin:%'
  and p.role='admin'
  and position(lower(p.participant_id) in lower(c.slug))=0;

-- Admins must only see their own person/support conversations. District/state
-- rooms remain administratively visible by design.
drop function if exists public.apn_list_conversations();
create function public.apn_list_conversations()
returns table(conversation_id uuid,conv_type text,subject text,last_message text,last_sender_id text,last_at timestamptz,unread_count bigint,participant_count bigint)
language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select c.id,c.type,c.subject,lm.body,lm.sender_id,lm.message_created_at,
         coalesce(uc.unread_count,0)::bigint,coalesce(pc.participant_count,0)::bigint
  from public.apn_chat_conversations c
  left join lateral (
    select m.body,m.sender_id,m.created_at as message_created_at
    from public.apn_chat_messages m where m.conversation_id=c.id
    order by m.created_at desc limit 1
  ) lm on true
  left join lateral (
    select count(*) unread_count from public.apn_chat_messages um
    where um.conversation_id=c.id and um.sender_id<>auth.uid()::text
      and um.created_at>coalesce((select max(rs.updated_at) from public.apn_chat_read_states rs where rs.conversation_id=c.id and rs.participant_id=auth.uid()::text),'epoch'::timestamptz)
  ) uc on true
  left join lateral (select count(*) participant_count from public.apn_chat_participants cp where cp.conversation_id=c.id) pc on true
  where exists(select 1 from public.apn_chat_participants mine where mine.conversation_id=c.id and mine.participant_id=auth.uid()::text)
     or (public.is_admin() and c.type in ('district','state'))
  order by c.updated_at desc;
$$;
revoke all on function public.apn_list_conversations() from public,anon;
grant execute on function public.apn_list_conversations() to authenticated;

-- A person conversation is private to its explicit participants, including admins.
drop function if exists public.apn_list_messages(uuid);
create function public.apn_list_messages(p_conversation_id uuid)
returns table(id uuid,sender_id text,sender_name text,sender_apn_id text,body text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz,reply_to_id uuid,edited_at timestamptz,reactions jsonb,mentions jsonb,attachments jsonb)
language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select m.id,m.sender_id,m.sender_name,m.sender_apn_id,m.body,m.created_at,m.delivered_at,m.read_at,m.reply_to_id,m.edited_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',rx.emoji,'count',rx.cnt,'mine',rx.mine) order by rx.emoji) from (
      select r.emoji,count(*)::bigint cnt,bool_or(r.reactor_id=auth.uid()::text) mine
      from public.apn_chat_reactions r where r.message_id=m.id group by r.emoji
    ) rx),'[]'::jsonb), coalesce(m.mentions,'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_path',a.storage_path) order by a.created_at) from public.apn_chat_attachments a where a.message_id=m.id),'[]'::jsonb)
  from public.apn_chat_messages m
  join public.apn_chat_conversations c on c.id=m.conversation_id
  where m.conversation_id=$1 and (
    exists(select 1 from public.apn_chat_participants p where p.conversation_id=$1 and p.participant_id=auth.uid()::text)
    or (public.is_admin() and c.type in ('district','state'))
  )
  order by m.created_at asc;
$$;
revoke all on function public.apn_list_messages(uuid) from public,anon;
grant execute on function public.apn_list_messages(uuid) to authenticated;

create or replace function public.apn_admin_mark_read(p_conversation_id uuid,p_message_id uuid)
returns table(ok boolean) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_type text;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  select c.type into v_type from public.apn_chat_conversations c where c.id=p_conversation_id;
  if v_type is null then raise exception 'Conversation not found.' using errcode='P0002'; end if;
  if v_type='person' and not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=auth.uid()::text) then
    raise exception 'This partner conversation belongs to another admin.' using errcode='42501';
  end if;
  insert into public.apn_chat_participants(conversation_id,participant_id,role) values(p_conversation_id,auth.uid()::text,'admin')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,auth.uid()::text,p_message_id)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  return query select true;
end;
$$;
grant execute on function public.apn_admin_mark_read(uuid,uuid) to authenticated;

create or replace function public.apn_admin_send_message(p_conversation_id uuid,p_body text)
returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_msg uuid; v_created timestamptz; v_type text;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if p_conversation_id is null or p_body is null or trim(p_body)='' then raise exception 'Conversation and message body are required.' using errcode='22000'; end if;
  select c.type into v_type from public.apn_chat_conversations c where c.id=p_conversation_id;
  if v_type is null then raise exception 'Conversation not found.' using errcode='P0002'; end if;
  if v_type='person' and not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then
    raise exception 'This partner conversation belongs to another admin.' using errcode='42501';
  end if;
  select coalesce(nullif(trim(p.name),''),'ALLBEE Admin') into v_name from public.profiles p where p.id=auth.uid();
  insert into public.apn_chat_participants(conversation_id,participant_id,role) values(p_conversation_id,v_self,'admin') on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body,created_at,updated_at) values(gen_random_uuid(),p_conversation_id,v_self,v_name,null,trim(p_body),now(),now()) returning apn_chat_messages.id,apn_chat_messages.created_at into v_msg,v_created;
  update public.apn_chat_conversations set updated_at=now() where id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg) on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  perform public.apn_emit_chat_notifications(p_conversation_id,v_msg,v_self,v_name,trim(p_body));
  return query select v_msg,v_created,v_self,v_name,null::text;
end;
$$;
grant execute on function public.apn_admin_send_message(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

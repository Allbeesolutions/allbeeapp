begin;

create or replace function public.apn_emit_chat_notifications(
  p_conversation_id uuid, p_message_id uuid, p_sender_id text,
  p_sender_name text, p_body text
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  r record;
  v_admin_notified boolean := false;
  v_now_ms bigint := floor(extract(epoch from now()) * 1000);
  v_title text := case when coalesce(trim(p_sender_name),'') <> ''
    then p_sender_name || ' sent a new APN message' else 'New APN message' end;
  v_id uuid;
begin
  for r in select distinct p.participant_id from public.apn_chat_participants p
    where p.conversation_id=p_conversation_id and p.participant_id<>p_sender_id loop
    if exists (select 1 from public.profiles pr where pr.id::text=r.participant_id
      and pr.active=true and pr.status='active' and pr.role in ('admin','superadmin')) then
      if not v_admin_notified then
        v_id:=gen_random_uuid();
        insert into public.notifications(id,data,updated_at) values(v_id,jsonb_build_object(
          'id',v_id,'title',v_title,'body',left(coalesce(p_body,''),240),'audience','all',
          'module','APN','priority','High','createdAt',v_now_ms,'senderName',coalesce(p_sender_name,'APN Partner'),
          'senderDesignation','APN','senderRole','APN Partner','reads','[]'::jsonb,
          'metadata',jsonb_build_object('conversationId',p_conversation_id,'messageId',p_message_id,'type','apn_chat_message')
        ),now());
        v_admin_notified:=true;
      end if;
    elsif exists (select 1 from public.apn_users u where u.id::text=r.participant_id) then
      v_id:=gen_random_uuid();
      insert into public.apn_notifications(id,data,updated_at) values(v_id,jsonb_build_object(
        'id',v_id,'title',v_title,'body',left(coalesce(p_body,''),240),
        'audience','partner:'||r.participant_id,'type','chat_message','refId',p_conversation_id::text,
        'messageId',p_message_id::text,'createdAt',v_now_ms,'updatedAt',v_now_ms,'createdBy',p_sender_name
      ),now());
    end if;
  end loop;
end;
$$;

grant execute on function public.apn_emit_chat_notifications(uuid,uuid,text,text,text) to authenticated;


drop function if exists public.apn_admin_send_message(uuid,text);
create function public.apn_admin_send_message(p_conversation_id uuid,p_body text)
returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_msg uuid; v_created timestamptz;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if p_conversation_id is null or p_body is null or trim(p_body)='' then raise exception 'Conversation and message body are required.' using errcode='22000'; end if;
  if not exists(select 1 from public.apn_chat_conversations where id=p_conversation_id) then raise exception 'Conversation not found.' using errcode='P0002'; end if;
  select coalesce(nullif(trim(p.name),''),'ALLBEE Admin') into v_name from public.profiles p where p.id=auth.uid();
  insert into public.apn_chat_participants(conversation_id,participant_id,role) values(p_conversation_id,v_self,'admin')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body,created_at,updated_at)
    values(gen_random_uuid(),p_conversation_id,v_self,v_name,null,trim(p_body),now(),now())
    returning apn_chat_messages.id,apn_chat_messages.created_at into v_msg,v_created;
  update public.apn_chat_conversations set updated_at=now() where id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  perform public.apn_emit_chat_notifications(p_conversation_id,v_msg,v_self,v_name,trim(p_body));
  return query select v_msg,v_created,v_self,v_name,null::text;
end;
$$;
grant execute on function public.apn_admin_send_message(uuid,text) to authenticated;

drop function if exists public.apn_admin_mark_read(uuid,uuid);
create function public.apn_admin_mark_read(p_conversation_id uuid,p_message_id uuid)
returns table(ok boolean) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if not exists(select 1 from public.apn_chat_conversations where id=p_conversation_id) then raise exception 'Conversation not found.' using errcode='P0002'; end if;
  insert into public.apn_chat_participants(conversation_id,participant_id,role) values(p_conversation_id,auth.uid()::text,'admin')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,auth.uid()::text,p_message_id)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  return query select true;
end;
$$;
grant execute on function public.apn_admin_mark_read(uuid,uuid) to authenticated;


drop function if exists public.apn_admin_mark_delivered(uuid);
create function public.apn_admin_mark_delivered(p_message_id uuid)
returns table(ok boolean) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  update public.apn_chat_messages m set delivered_at=coalesce(m.delivered_at,now()),updated_at=now()
    where m.id=p_message_id and m.sender_id<>auth.uid()::text
      and exists(select 1 from public.apn_chat_conversations c where c.id=m.conversation_id);
  return query select true;
end;
$$;
grant execute on function public.apn_admin_mark_delivered(uuid) to authenticated;

drop function if exists public.apn_admin_open_partner_chat(text);
create function public.apn_admin_open_partner_chat(p_partner_apn_id text)
returns table(conversation_id uuid,subject text,participant_apn_id text)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_partner text; v_name text; v_apn text; v_slug text; v_conv uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  select u.id::text,u.data->>'name',u.data->>'apnId' into v_partner,v_name,v_apn from public.apn_users u
    where lower(trim(u.data->>'apnId'))=lower(trim(p_partner_apn_id)) and u.data->>'status'='active';
  if v_partner is null then raise exception 'Partner not found or inactive.' using errcode='P0002'; end if;
  v_slug:='admin:'||lower(least(v_self,v_partner))||':'||lower(greatest(v_self,v_partner));
  insert into public.apn_chat_conversations(id,type,slug,subject,created_by,created_at,updated_at)
    values(gen_random_uuid(),'person',v_slug,v_name,v_self,now(),now()) on conflict(slug) do nothing returning id into v_conv;
  if v_conv is null then select c.id into v_conv from public.apn_chat_conversations c where c.slug=v_slug; end if;
  insert into public.apn_chat_participants(conversation_id,participant_id,role)
    values(v_conv,v_self,'admin'),(v_conv,v_partner,'participant')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv,v_name,v_apn;
end;
$$;
grant execute on function public.apn_admin_open_partner_chat(text) to authenticated;

-- Partner sender now fans out a durable notification to every recipient.
create or replace function public.apn_send_message(p_conversation_id uuid,p_body text)
returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_apn text; v_msg uuid; v_created timestamptz;
begin
  if p_conversation_id is null then raise exception 'Conversation ID is required.' using errcode='22000'; end if;
  if p_body is null or trim(p_body)='' then raise exception 'Message body is required.' using errcode='22000'; end if;
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then raise exception 'You are not a participant of this conversation.' using errcode='P0002'; end if;
  select data->>'name',data->>'apnId' into v_name,v_apn from public.apn_users where id=v_self;
  if v_name is null then raise exception 'APN sender profile not found.' using errcode='P0002'; end if;
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body,created_at,updated_at)
    values(gen_random_uuid(),p_conversation_id,v_self,v_name,v_apn,trim(p_body),now(),now())
    returning apn_chat_messages.id,apn_chat_messages.created_at into v_msg,v_created;
  update public.apn_chat_conversations set updated_at=now() where id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=excluded.last_read_msg_id,updated_at=now();
  perform public.apn_emit_chat_notifications(p_conversation_id,v_msg,v_self,v_name,trim(p_body));
  return query select v_msg,v_created,v_self,v_name,v_apn;
end;
$$;
grant execute on function public.apn_send_message(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

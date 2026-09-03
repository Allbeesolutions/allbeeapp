-- ALLBEE APN Team Chat v2 — OpenHive-inspired collaboration primitives.
-- Backwards-compatible: existing messages/conversations remain valid.

alter table public.apn_chat_messages
  add column if not exists reply_to_id uuid references public.apn_chat_messages(id) on delete set null,
  add column if not exists edited_at timestamptz;

create index if not exists apn_chat_messages_reply_idx on public.apn_chat_messages (reply_to_id);
create index if not exists apn_chat_messages_sender_created_idx on public.apn_chat_messages (sender_id, created_at desc);

create table if not exists public.apn_chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.apn_chat_messages(id) on delete cascade,
  reactor_id text not null,
  emoji text not null check (char_length(trim(emoji)) between 1 and 32),
  created_at timestamptz not null default now(),
  unique(message_id, reactor_id, emoji)
);
create index if not exists apn_chat_reactions_message_idx on public.apn_chat_reactions(message_id);

alter table public.apn_chat_reactions enable row level security;
revoke all on public.apn_chat_reactions from public, anon, authenticated;
drop policy if exists apn_chat_reactions_select on public.apn_chat_reactions;
create policy apn_chat_reactions_select on public.apn_chat_reactions
  for select to authenticated using (
    exists (select 1 from public.apn_chat_messages m join public.apn_chat_participants p on p.conversation_id=m.conversation_id
      where m.id=apn_chat_reactions.message_id and (p.participant_id=auth.uid()::text or public.is_admin()))
  );
drop policy if exists apn_chat_reactions_no_insert on public.apn_chat_reactions;
create policy apn_chat_reactions_no_insert on public.apn_chat_reactions for insert to authenticated with check (false);
drop policy if exists apn_chat_reactions_no_update on public.apn_chat_reactions;
create policy apn_chat_reactions_no_update on public.apn_chat_reactions for update to authenticated using (false);
drop policy if exists apn_chat_reactions_no_delete on public.apn_chat_reactions;
create policy apn_chat_reactions_no_delete on public.apn_chat_reactions for delete to authenticated using (false);

-- New message path. The original apn_send_message(uuid,text) remains intact for compatibility.
create or replace function public.apn_send_message_v2(p_conversation_id uuid, p_body text, p_reply_to_id uuid default null)
returns table(message_id uuid, created_at timestamptz, sender_id text, sender_name text, sender_apn_id text, reply_to_id uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_apn text; v_msg uuid; v_created timestamptz;
begin
  if p_conversation_id is null then raise exception 'Conversation ID is required.' using errcode='22000'; end if;
  if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
  if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then
    raise exception 'You are not a participant of this conversation.' using errcode='P0002';
  end if;
  if p_reply_to_id is not null and not exists(select 1 from public.apn_chat_messages m where m.id=p_reply_to_id and m.conversation_id=p_conversation_id) then
    raise exception 'Reply target is not in this conversation.' using errcode='P0002';
  end if;
  select data->>'name',data->>'apnId' into v_name,v_apn from public.apn_users where id=v_self;
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body,reply_to_id,created_at,updated_at)
    values(gen_random_uuid(),p_conversation_id,v_self,v_name,v_apn,p_body,p_reply_to_id,now(),now()) returning id,created_at into v_msg,v_created;
  update public.apn_chat_conversations set updated_at=now() where id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg)
    on conflict(conversation_id,participant_id) do update set last_read_msg_id=v_msg,updated_at=now();
  return query select v_msg,v_created,v_self,v_name,v_apn,p_reply_to_id;
end; $$;

-- Edit own message within the existing five-minute deletion window.
create or replace function public.apn_edit_message(p_message_id uuid, p_body text)
returns table(ok boolean, edited_at timestamptz) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_created timestamptz; v_now timestamptz:=now();
begin
  if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
  if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
  select created_at into v_created from public.apn_chat_messages where id=p_message_id and sender_id=v_self;
  if v_created is null then raise exception 'Message not found or not yours.' using errcode='P0002'; end if;
  if v_now-v_created > interval '5 minutes' then raise exception 'Message can only be edited for five minutes.' using errcode='P0002'; end if;
  update public.apn_chat_messages set body=trim(p_body),edited_at=v_now,updated_at=v_now where id=p_message_id and sender_id=v_self;
  return query select true,v_now;
end; $$;

create or replace function public.apn_toggle_reaction(p_message_id uuid, p_emoji text)
returns table(reacted boolean, reaction_count bigint) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_emoji text:=trim(p_emoji); v_conv uuid; v_reacted boolean;
begin
  if v_emoji='' or length(v_emoji)>32 then raise exception 'Invalid reaction.' using errcode='22000'; end if;
  select conversation_id into v_conv from public.apn_chat_messages where id=p_message_id;
  if v_conv is null or not exists(select 1 from public.apn_chat_participants p where p.conversation_id=v_conv and p.participant_id=v_self) then
    raise exception 'Not a participant.' using errcode='P0002';
  end if;
  if exists(select 1 from public.apn_chat_reactions where message_id=p_message_id and reactor_id=v_self and emoji=v_emoji) then
    delete from public.apn_chat_reactions where message_id=p_message_id and reactor_id=v_self and emoji=v_emoji; v_reacted:=false;
  else
    insert into public.apn_chat_reactions(message_id,reactor_id,emoji) values(p_message_id,v_self,v_emoji); v_reacted:=true;
  end if;
  return query select v_reacted,(select count(*) from public.apn_chat_reactions where message_id=p_message_id and emoji=v_emoji);
end; $$;

drop function if exists public.apn_list_messages(uuid);
create function public.apn_list_messages(p_conversation_id uuid)
returns table(id uuid,sender_id text,sender_name text,sender_apn_id text,body text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz,reply_to_id uuid,edited_at timestamptz,reactions jsonb)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and (p.participant_id=auth.uid()::text or public.is_admin())) then
    raise exception 'Not a participant.' using errcode='P0002';
  end if;
  return query
  select m.id,m.sender_id,m.sender_name,m.sender_apn_id,m.body,m.created_at,m.delivered_at,m.read_at,m.reply_to_id,m.edited_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.cnt,'mine',r.mine) order by r.emoji) from (
      select emoji,count(*)::bigint cnt,bool_or(reactor_id=auth.uid()::text) mine from public.apn_chat_reactions where message_id=m.id group by emoji
    ) r),'[]'::jsonb)
  from public.apn_chat_messages m where m.conversation_id=p_conversation_id order by m.created_at asc;
end; $$;

grant execute on function public.apn_send_message_v2(uuid,text,uuid) to authenticated;
grant execute on function public.apn_edit_message(uuid,text) to authenticated;
grant execute on function public.apn_toggle_reaction(uuid,text) to authenticated;
grant execute on function public.apn_list_messages(uuid) to authenticated;
select public._allbee_realtime('apn_chat_reactions');
notify pgrst,'reload schema';

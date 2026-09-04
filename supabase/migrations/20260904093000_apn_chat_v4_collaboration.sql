-- APN Team Chat v4: private attachments + durable mentions.
alter table public.apn_chat_messages add column if not exists mentions jsonb not null default '[]'::jsonb;
create table if not exists public.apn_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.apn_chat_messages(id) on delete cascade,
  conversation_id uuid not null references public.apn_chat_conversations(id) on delete cascade,
  uploader_id text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists apn_chat_attachments_message_idx on public.apn_chat_attachments(message_id);
create index if not exists apn_chat_attachments_conversation_idx on public.apn_chat_attachments(conversation_id,created_at desc);
alter table public.apn_chat_attachments enable row level security;
revoke all on public.apn_chat_attachments from public,anon,authenticated;
grant select,insert on public.apn_chat_attachments to authenticated;
drop policy if exists apn_chat_attachments_select on public.apn_chat_attachments;
create policy apn_chat_attachments_select on public.apn_chat_attachments for select to authenticated using (exists(select 1 from public.apn_chat_participants p where p.conversation_id=conversation_id and p.participant_id=auth.uid()::text) or public.is_admin());
drop policy if exists apn_chat_attachments_insert on public.apn_chat_attachments;
create policy apn_chat_attachments_insert on public.apn_chat_attachments for insert to authenticated with check (uploader_id=auth.uid()::text and exists(select 1 from public.apn_chat_participants p where p.conversation_id=conversation_id and p.participant_id=auth.uid()::text) and exists(select 1 from public.apn_chat_messages m where m.id=message_id and m.conversation_id=conversation_id));

insert into storage.buckets(id,name,public) values('apn-chat','apn-chat',false) on conflict(id) do update set public=false;
drop policy if exists apn_chat_storage_select on storage.objects;
create policy apn_chat_storage_select on storage.objects for select to authenticated using(bucket_id='apn-chat' and (public.is_admin() or exists(select 1 from public.apn_chat_participants p where p.conversation_id=split_part(name,'/',1)::uuid and p.participant_id=auth.uid()::text)));
drop policy if exists apn_chat_storage_insert on storage.objects;
create policy apn_chat_storage_insert on storage.objects for insert to authenticated with check(bucket_id='apn-chat' and exists(select 1 from public.apn_chat_participants p where p.conversation_id=split_part(name,'/',1)::uuid and p.participant_id=auth.uid()::text));
drop policy if exists apn_chat_storage_delete on storage.objects;
create policy apn_chat_storage_delete on storage.objects for delete to authenticated using(bucket_id='apn-chat' and owner_id=auth.uid()::text);

create or replace function public.apn_send_message_v3(p_conversation_id uuid,p_body text,p_reply_to_id uuid default null,p_mentions jsonb default '[]'::jsonb)
returns table(message_id uuid,created_at timestamptz,sender_id text,sender_name text,sender_apn_id text,reply_to_id uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_name text; v_apn text; v_msg uuid; v_created timestamptz;
begin
  if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
  if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and p.participant_id=v_self) then raise exception 'You are not a participant of this conversation.' using errcode='P0002'; end if;
  if p_reply_to_id is not null and not exists(select 1 from public.apn_chat_messages m where m.id=p_reply_to_id and m.conversation_id=p_conversation_id) then raise exception 'Reply target is not in this conversation.' using errcode='P0002'; end if;
  select data->>'name',data->>'apnId' into v_name,v_apn from public.apn_users where id=v_self;
  insert into public.apn_chat_messages(id,conversation_id,sender_id,sender_name,sender_apn_id,body,reply_to_id,mentions,created_at,updated_at) values(gen_random_uuid(),p_conversation_id,v_self,v_name,v_apn,trim(p_body),p_reply_to_id,case when jsonb_typeof(coalesce(p_mentions,'[]'::jsonb))='array' then p_mentions else '[]'::jsonb end,now(),now()) returning id,created_at into v_msg,v_created;
  update public.apn_chat_conversations set updated_at=now() where id=p_conversation_id;
  insert into public.apn_chat_read_states(conversation_id,participant_id,last_read_msg_id) values(p_conversation_id,v_self,v_msg) on conflict(conversation_id,participant_id) do update set last_read_msg_id=v_msg,updated_at=now();
  return query select v_msg,v_created,v_self,v_name,v_apn,p_reply_to_id;
end; $$;

drop function if exists public.apn_list_messages(uuid);
create function public.apn_list_messages(p_conversation_id uuid)
returns table(id uuid,sender_id text,sender_name text,sender_apn_id text,body text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz,reply_to_id uuid,edited_at timestamptz,reactions jsonb,mentions jsonb,attachments jsonb)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and (p.participant_id=auth.uid()::text or public.is_admin())) then raise exception 'Not a participant.' using errcode='P0002'; end if;
  return query select m.id,m.sender_id,m.sender_name,m.sender_apn_id,m.body,m.created_at,m.delivered_at,m.read_at,m.reply_to_id,m.edited_at,
    coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.cnt,'mine',r.mine) order by r.emoji) from (select emoji,count(*)::bigint cnt,bool_or(reactor_id=auth.uid()::text) mine from public.apn_chat_reactions where message_id=m.id group by emoji) r),'[]'::jsonb),
    coalesce(m.mentions,'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'storage_path',a.storage_path) order by a.created_at) from public.apn_chat_attachments a where a.message_id=m.id),'[]'::jsonb)
  from public.apn_chat_messages m where m.conversation_id=p_conversation_id order by m.created_at asc;
end; $$;

grant execute on function public.apn_send_message_v3(uuid,text,uuid,jsonb),public.apn_list_messages(uuid) to authenticated;
select public._allbee_realtime('apn_chat_attachments');
notify pgrst,'reload schema';

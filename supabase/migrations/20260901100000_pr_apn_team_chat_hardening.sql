-- ALLBEE APN Team Chat hardening.
--
-- 1. Adds a fresh RPC name for opening an accepted person chat. This avoids
--    PostgREST stale-signature collisions left behind by older overloads.
-- 2. Rebuilds the legacy RPC with one exact text signature.
-- 3. Makes unread counts chronological instead of comparing UUID ordering.
-- 4. Forces a PostgREST schema reload after the DDL.

begin;

drop function if exists public.apn_open_person_chat(text);
create function public.apn_open_person_chat(p_other_apn_id text)
returns table(conversation_id uuid, subject text, participant_apn_id text)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_other_id text;
  v_other_name text;
  v_other_apn text;
  v_slug text;
  v_conv uuid;
begin
  if p_other_apn_id is null or trim(p_other_apn_id) = '' then
    raise exception 'Partner APN ID is required.' using errcode = '22000';
  end if;
  select u.id::text, u.data->>'name', u.data->>'apnId'
    into v_other_id, v_other_name, v_other_apn
  from public.apn_users u
  where lower(trim(u.data->>'apnId')) = lower(trim(p_other_apn_id))
    and u.data->>'status' = 'active';
  if v_other_id is null then
    raise exception 'Partner not found or inactive.' using errcode = 'P0002';
  end if;
  if v_other_id = v_self then
    raise exception 'You cannot start a chat with yourself.' using errcode = '22000';
  end if;
  if not exists (
    select 1 from public.apn_friend_requests r
    where r.status = 'accepted'
      and ((r.requester_id = v_self and r.recipient_id = v_other_id)
        or (r.requester_id = v_other_id and r.recipient_id = v_self))
  ) then
    raise exception 'Partners are not connected.' using errcode = 'P0002';
  end if;
  v_slug := 'person:' || lower(least(v_self, v_other_id)) || ':' || lower(greatest(v_self, v_other_id));
  insert into public.apn_chat_conversations(id,type,slug,subject,created_by,created_at,updated_at)
  values(gen_random_uuid(),'person',v_slug,v_other_name,v_self,now(),now())
  on conflict (slug) do nothing
  returning id into v_conv;
  if v_conv is null then
    select c.id into v_conv from public.apn_chat_conversations c where c.slug = v_slug;
  end if;
  insert into public.apn_chat_participants(conversation_id,participant_id,role)
  values(v_conv,v_self,'participant'),(v_conv,v_other_id,'participant')
  on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv,v_other_name,v_other_apn;
end;
$$;

grant execute on function public.apn_open_person_chat(text) to authenticated;

-- Keep exactly one legacy signature so old clients remain compatible.
drop function if exists public.apn_get_or_create_person_conversation();
drop function if exists public.apn_get_or_create_person_conversation(text);
create function public.apn_get_or_create_person_conversation(p_other_apn_id text)
returns table(conversation_id uuid, subject text, participant_apn_id text)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query select * from public.apn_open_person_chat(p_other_apn_id);
end;
$$;
grant execute on function public.apn_get_or_create_person_conversation(text) to authenticated;

-- UUIDs are identifiers, not chronological values. Compare timestamps for
-- unread counts so delivery order stays correct even across UUID generations.
drop function if exists public.apn_list_conversations();
create function public.apn_list_conversations()
returns table(conversation_id uuid, conv_type text, subject text, last_message text,
  last_sender_id text, last_at timestamptz, unread_count bigint, participant_count bigint)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select c.id,c.type,c.subject,lm.body,lm.sender_id,lm.created_at,
    count(m.id) filter (where m.sender_id <> auth.uid()::text
      and m.created_at > coalesce(rs_last.last_read_at,'epoch'::timestamptz)) as unread_count,
    count(distinct p.participant_id) as participant_count
  from public.apn_chat_conversations c
  join public.apn_chat_participants p2 on p2.conversation_id=c.id
    and (p2.participant_id=auth.uid()::text or public.is_admin())
  left join public.apn_chat_messages m on m.conversation_id=c.id
  left join lateral (
    select r.updated_at as last_read_at
    from public.apn_chat_read_states r
    where r.conversation_id=c.id and r.participant_id=auth.uid()::text
    limit 1
  ) rs_last on true
  left join lateral (
    select body,sender_id,created_at from public.apn_chat_messages mm
    where mm.conversation_id=c.id order by mm.created_at desc limit 1
  ) lm on true
  group by c.id,c.type,c.subject,c.updated_at,lm.body,lm.sender_id,lm.created_at,rs_last.last_read_at
  having bool_or(p2.participant_id=auth.uid()::text) or public.is_admin()
  order by c.updated_at desc;
end;
$$;

grant execute on function public.apn_list_conversations() to authenticated;
notify pgrst,'reload schema';
commit;

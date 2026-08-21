-- Fix Team Chat conversation listing: the participant join is aliased p2,
-- but the aggregate previously referenced the nonexistent alias p.
create or replace function public.apn_list_conversations()
returns table(
  conversation_id uuid, conv_type text, subject text,
  last_message text, last_sender_id text, last_at timestamptz,
  unread_count bigint, participant_count bigint
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select c.id, c.type, c.subject,
         lm.body, lm.sender_id, lm.created_at,
         count(m.id) filter (where m.sender_id <> auth.uid()::text
              and m.id > coalesce(rs.last_read_msg_id, '00000000-0000-0000-0000-000000000000'::uuid)) as unread_count,
         count(p2.participant_id) as participant_count
  from public.apn_chat_conversations c
  join public.apn_chat_participants p2 on p2.conversation_id = c.id
    and (p2.participant_id = auth.uid()::text or public.is_admin())
  left join public.apn_chat_messages m on m.conversation_id = c.id
  left join public.apn_chat_read_states rs on rs.conversation_id = c.id and rs.participant_id = auth.uid()::text
  left join lateral (
    select body, sender_id, created_at from public.apn_chat_messages mm
    where mm.conversation_id = c.id order by mm.created_at desc limit 1
  ) lm on true
  group by c.id, c.type, c.subject, lm.body, lm.sender_id, lm.created_at
  having bool_or(p2.participant_id = auth.uid()::text) or public.is_admin()
  order by c.updated_at desc;
end;
$$;

grant execute on function public.apn_list_conversations() to authenticated;

-- Fix the production Team Chat conversation RPC.
-- The previous hardening migration referenced `p.participant_id` even though
-- the participant table was aliased as `p2`, causing:
--   missing FROM-clause entry for table "p"
-- This version uses the correct participant alias and keeps chronological
-- unread counting based on the read watermark timestamp.
begin;

drop function if exists public.apn_list_conversations();
create function public.apn_list_conversations()
returns table(
  conversation_id uuid,
  conv_type text,
  subject text,
  last_message text,
  last_sender_id text,
  last_at timestamptz,
  unread_count bigint,
  participant_count bigint
)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select
    c.id,
    c.type,
    c.subject,
    lm.body,
    lm.sender_id,
    lm.created_at,
    count(m.id) filter (
      where m.sender_id <> auth.uid()::text
        and m.created_at > coalesce(rs.last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    count(distinct p2.participant_id) as participant_count
  from public.apn_chat_conversations c
  join public.apn_chat_participants p2
    on p2.conversation_id = c.id
  left join public.apn_chat_messages m
    on m.conversation_id = c.id
  left join lateral (
    select r.updated_at as last_read_at
    from public.apn_chat_read_states r
    where r.conversation_id = c.id
      and r.participant_id = auth.uid()::text
    order by r.updated_at desc
    limit 1
  ) rs on true
  left join lateral (
    select mm.body, mm.sender_id, mm.created_at
    from public.apn_chat_messages mm
    where mm.conversation_id = c.id
    order by mm.created_at desc
    limit 1
  ) lm on true
  where public.is_admin()
     or exists (
       select 1
       from public.apn_chat_participants mine
       where mine.conversation_id = c.id
         and mine.participant_id = auth.uid()::text
     )
  group by
    c.id,
    c.type,
    c.subject,
    c.updated_at,
    lm.body,
    lm.sender_id,
    lm.created_at,
    rs.last_read_at
  order by c.updated_at desc;
end;
$$;

grant execute on function public.apn_list_conversations() to authenticated;
notify pgrst, 'reload schema';
commit;

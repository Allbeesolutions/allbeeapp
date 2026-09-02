-- Optimize Team Chat RPCs using targeted lookups instead of joining and grouping all messages.
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
language sql security definer
set search_path = pg_catalog, public, pg_temp as $$
  select
    c.id,
    c.type,
    c.subject,
    lm.body,
    lm.sender_id,
    lm.created_at,
    coalesce(uc.unread_count, 0)::bigint,
    coalesce(pc.participant_count, 0)::bigint
  from public.apn_chat_conversations c
  cross join lateral (
    select 1 as visible
    where public.is_admin()
       or exists (
         select 1 from public.apn_chat_participants mine
         where mine.conversation_id = c.id
           and mine.participant_id = auth.uid()::text
       )
  ) visible
  left join lateral (
    select m.body, m.sender_id, m.created_at
    from public.apn_chat_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as unread_count
    from public.apn_chat_messages m
    where m.conversation_id = c.id
      and m.sender_id <> auth.uid()::text
      and m.created_at > coalesce((
        select max(r.updated_at) from public.apn_chat_read_states r
        where r.conversation_id = c.id
          and r.participant_id = auth.uid()::text
      ), 'epoch'::timestamptz)
  ) uc on true
  left join lateral (
    select count(*) as participant_count
    from public.apn_chat_participants p
    where p.conversation_id = c.id
  ) pc on true
  order by c.updated_at desc;
$$;

grant execute on function public.apn_list_conversations() to authenticated;
notify pgrst, 'reload schema';

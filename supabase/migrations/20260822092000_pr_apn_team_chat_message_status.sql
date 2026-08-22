-- Expose delivery/read timestamps to the Team Chat message list RPC.

drop function if exists public.apn_list_messages(uuid);
create function public.apn_list_messages(p_conversation_id uuid)
returns table(
  id uuid,
  sender_id text,
  sender_name text,
  sender_apn_id text,
  body text,
  created_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (
    select 1 from public.apn_chat_participants p
    where p.conversation_id=p_conversation_id
      and (p.participant_id=auth.uid()::text or public.is_admin())
  ) then
    raise exception 'Not a participant.' using errcode='P0002';
  end if;
  return query
  select m.id,m.sender_id,m.sender_name,m.sender_apn_id,m.body,m.created_at,m.delivered_at,m.read_at
  from public.apn_chat_messages m
  where m.conversation_id=p_conversation_id
  order by m.created_at asc;
end;
$$;

grant execute on function public.apn_list_messages(uuid) to authenticated;
notify pgrst, 'reload schema';

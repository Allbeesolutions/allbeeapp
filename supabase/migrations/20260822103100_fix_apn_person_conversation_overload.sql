-- Remove both legacy overloads so PostgREST exposes exactly the RPC used by the app.
drop function if exists public.apn_get_or_create_person_conversation();
drop function if exists public.apn_get_or_create_person_conversation(text);

create function public.apn_get_or_create_person_conversation(p_other_apn_id text)
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
  if p_other_apn_id is null or trim(p_other_apn_id) = '' then raise exception 'Partner APN ID is required.'; end if;
  select u.id, u.data->>'name', u.data->>'apnId' into v_other_id, v_other_name, v_other_apn
  from public.apn_users u where lower(trim(u.data->>'apnId')) = lower(trim(p_other_apn_id));
  if v_other_id is null then raise exception 'Partner not found.'; end if;
  if v_other_id = v_self then raise exception 'You cannot start a chat with yourself.'; end if;
  if not exists (select 1 from public.apn_friend_requests r where r.status='accepted' and ((r.requester_id=v_self and r.recipient_id=v_other_id) or (r.requester_id=v_other_id and r.recipient_id=v_self))) then raise exception 'Partners are not connected.'; end if;
  v_slug := 'person:' || lower(least(v_self,v_other_id)) || ':' || lower(greatest(v_self,v_other_id));
  insert into public.apn_chat_conversations(id,type,slug,subject,created_by,created_at,updated_at)
  values(gen_random_uuid(),'person',v_slug,v_other_name,v_self,now(),now()) on conflict(slug) do nothing returning id into v_conv;
  if v_conv is null then select c.id into v_conv from public.apn_chat_conversations c where c.slug=v_slug; end if;
  insert into public.apn_chat_participants(conversation_id,participant_id,role)
  values(v_conv,v_self,'participant'),(v_conv,v_other_id,'participant') on conflict(conversation_id,participant_id) do nothing;
  return query select v_conv,v_other_name,v_other_apn;
end;
$$;
grant execute on function public.apn_get_or_create_person_conversation(text) to authenticated;
notify pgrst,'reload schema';

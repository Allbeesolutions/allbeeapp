-- APN Team Chat contacts: all active partners + always-available admin/superadmin direct chats.
create or replace function public.apn_list_chat_contacts()
returns table(
  contact_id text,
  contact_type text,
  name text,
  apn_id text,
  district text,
  state text,
  photo_url text,
  availability text,
  relationship text
) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  return query
  select u.id::text,
         'partner'::text,
         coalesce(u.data->>'name','Partner'),
         u.data->>'apnId',
         u.data->>'district',
         u.data->>'state',
         coalesce(u.data->>'profilePicture', u.data->>'photo_url', u.data->>'photoUrl'),
         case when u.data->>'status' = 'active' then 'available' else u.data->>'status' end,
         case
           when exists (select 1 from public.apn_friend_requests r
             where r.status='accepted' and ((r.requester_id=auth.uid()::text and r.recipient_id=u.id::text)
               or (r.requester_id=u.id::text and r.recipient_id=auth.uid()::text))) then 'friend'
           when exists (select 1 from public.apn_friend_requests r
             where r.status='pending' and r.requester_id=auth.uid()::text and r.recipient_id=u.id::text) then 'outgoing'
           when exists (select 1 from public.apn_friend_requests r
             where r.status='pending' and r.recipient_id=auth.uid()::text and r.requester_id=u.id::text) then 'incoming'
           else 'none'
         end
  from public.apn_users u
  where u.id::text <> auth.uid()::text
    and u.data->>'status' = 'active'
  union all
  select p.id::text,
         case when p.role='superadmin' then 'superadmin' else 'admin' end,
         coalesce(p.name, case when p.role='superadmin' then 'Super Admin' else 'Admin' end),
         null::text,
         null::text,
         null::text,
         p.photo_url,
         'always_available'::text,
         'pre_enabled'::text
  from public.profiles p
  where p.id <> auth.uid()
    and p.active = true
    and p.status = 'active'
    and p.role in ('admin','superadmin')
  order by contact_type, name;
end;
$$;

grant execute on function public.apn_list_chat_contacts() to authenticated;

create or replace function public.apn_get_or_create_admin_conversation(p_admin_id text)
returns table(conversation_id uuid, subject text, contact_type text) language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_self text := auth.uid()::text;
  v_admin uuid;
  v_name text;
  v_role text;
  v_slug text;
  v_conv uuid;
begin
  v_admin := p_admin_id::uuid;
  select p.name, p.role into v_name, v_role
  from public.profiles p
  where p.id=v_admin and p.active=true and p.status='active' and p.role in ('admin','superadmin');
  if v_name is null then raise exception 'Admin is not available.' using errcode='P0002'; end if;
  v_slug := 'admin:' || lower(least(v_self, v_admin::text)) || ':' || lower(greatest(v_self, v_admin::text));
  insert into public.apn_chat_conversations (id,type,slug,subject,created_by,created_at,updated_at)
    values (gen_random_uuid(),'person',v_slug,v_name,v_self,now(),now())
    on conflict (slug) do nothing returning id into v_conv;
  if v_conv is null then select c.id into v_conv from public.apn_chat_conversations c where c.slug=v_slug; end if;
  insert into public.apn_chat_participants (conversation_id,participant_id,role)
    values (v_conv,v_self,'participant'),(v_conv,v_admin::text,'admin')
    on conflict on constraint apn_chat_participants_conversation_id_participant_id_key do nothing;
  return query select v_conv,v_name,case when v_role='superadmin' then 'superadmin' else 'admin' end;
end;
$$;

grant execute on function public.apn_get_or_create_admin_conversation(text) to authenticated;

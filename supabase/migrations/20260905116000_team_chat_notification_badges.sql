begin;

-- The newer team_chat collection is also JSON-backed. Lock its UPDATE path and
-- expose only identity-checked state/tombstone RPCs to authenticated users.
alter table public.team_chat enable row level security;
revoke update on public.team_chat from authenticated,anon,public;
drop policy if exists team_chat_update on public.team_chat;
drop policy if exists team_chat_upd on public.team_chat;
create policy team_chat_no_update on public.team_chat for update to authenticated using(false) with check(false);

create or replace function public.team_chat_mark_seen(p_ids text[])
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  update public.team_chat c set data=jsonb_set(c.data,'{seenBy}',to_jsonb(array(select distinct x from jsonb_array_elements_text(coalesce(c.data->'seenBy','[]'::jsonb)||to_jsonb(array[auth.uid()::text])) x order by x))),updated_at=now()
  where c.id=any(coalesce(p_ids,'{}')) and (c.data->>'userId') is distinct from auth.uid()::text and not coalesce((c.data->'seenBy') ? auth.uid()::text,false);
  get diagnostics n=row_count; return n;
end $$;
revoke execute on function public.team_chat_mark_seen(text[]) from public,anon; grant execute on function public.team_chat_mark_seen(text[]) to authenticated;

create or replace function public.team_chat_delete_message(p_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.team_chat%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  select * into r from public.team_chat where id=p_id for update;
  if not found then raise exception 'Message not found.' using errcode='no_data_found'; end if;
  if not public.is_admin() and r.data->>'userId'<>auth.uid()::text then raise exception 'You can only delete your own message.' using errcode='insufficient_privilege'; end if;
  update public.team_chat set data=jsonb_set(jsonb_set(jsonb_set(data,'{deleted}','true'::jsonb),'{text}','""'::jsonb,true),'{deletedBy}',to_jsonb(auth.uid()::text),true),updated_at=now() where id=p_id returning * into r;
  return r.data;
end $$;
revoke execute on function public.team_chat_delete_message(text) from public,anon; grant execute on function public.team_chat_delete_message(text) to authenticated;

create or replace function public.notification_unread_count()
returns integer language sql security invoker stable set search_path=pg_catalog,public,pg_temp as $$
select count(*)::integer from public.notifications n
where (coalesce(n.data->>'audience','all')='all'
  or coalesce(n.data->>'audience','')=coalesce((select role from public.profiles where id=auth.uid()),'')
  or coalesce(n.data->>'audience','')=('user:'||auth.uid()::text))
  and not (coalesce(n.data->'reads','[]'::jsonb) ? auth.uid()::text)
  and not exists(select 1 from public.notification_user_state s where s.notification_id=n.id and s.user_id=auth.uid() and (s.read_at is not null or s.snoozed_until>now()));
$$;
revoke execute on function public.notification_unread_count() from public,anon; grant execute on function public.notification_unread_count() to authenticated;

commit;
notify pgrst,'reload schema';

begin;

-- Notification and chat writes are split from message/notification content.
-- Users may mark their own state; only admins may mutate notification content.
create table if not exists public.notification_user_state (
  notification_id text not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(notification_id,user_id)
);
alter table public.notification_user_state enable row level security;
revoke all on public.notification_user_state from public,anon,authenticated;
grant select,insert,update on public.notification_user_state to authenticated;
drop policy if exists notification_user_state_self on public.notification_user_state;
create policy notification_user_state_self on public.notification_user_state for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());

revoke insert,update,delete on public.notifications from authenticated;
drop policy if exists notif_insert on public.notifications;
drop policy if exists notif_update on public.notifications;
create policy notif_insert_admin on public.notifications for insert to authenticated with check(public.is_admin());
create policy notif_update_admin on public.notifications for update to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.notification_mark_read(p_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n public.notifications%rowtype; aud text;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  select * into n from public.notifications where id=p_id for update;
  if not found then raise exception 'Notification not found.'; end if;
  aud:=coalesce(n.data->>'audience','all');
  if not public.is_admin() and aud<>'all' and aud<>coalesce((select role from public.profiles where id=auth.uid()),'') and aud<>('user:'||auth.uid()::text) then raise exception 'Notification access denied.' using errcode='insufficient_privilege'; end if;
  update public.notifications set data=jsonb_set(data,'{reads}',(
    select to_jsonb(array(select distinct x from jsonb_array_elements_text(coalesce(data->'reads','[]'::jsonb)||to_jsonb(array[auth.uid()::text])) x order by x))
  )),read_at=coalesce(read_at,now()),updated_at=now() where id=p_id returning * into n;
  insert into public.notification_user_state(notification_id,user_id,read_at,updated_at) values(p_id,auth.uid(),now(),now())
    on conflict(notification_id,user_id) do update set read_at=excluded.read_at,updated_at=now();
  return jsonb_build_object('id',n.id,'read_at',now());
end $$;
revoke execute on function public.notification_mark_read(text) from public,anon; grant execute on function public.notification_mark_read(text) to authenticated;

create or replace function public.notification_user_state_get()
returns jsonb language sql security definer stable set search_path=pg_catalog,public,pg_temp as $$
select coalesce(jsonb_agg(jsonb_build_object('notification_id',s.notification_id,'read_at',s.read_at,'snoozed_until',s.snoozed_until) order by s.updated_at desc),'[]'::jsonb)
from public.notification_user_state s where s.user_id=auth.uid()
$$;
revoke execute on function public.notification_user_state_get() from public,anon; grant execute on function public.notification_user_state_get() to authenticated;

create or replace function public.notification_snooze(p_id text,p_minutes integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n public.notifications%rowtype; aud text; until_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  select * into n from public.notifications where id=p_id for update;
  if not found then raise exception 'Notification not found.'; end if;
  aud:=coalesce(n.data->>'audience','all');
  if not public.is_admin() and aud<>'all' and aud<>coalesce((select role from public.profiles where id=auth.uid()),'') and aud<>('user:'||auth.uid()::text) then raise exception 'Notification access denied.' using errcode='insufficient_privilege'; end if;
  until_at:=now()+make_interval(mins=>greatest(1,least(coalesce(p_minutes,15),10080)));
  insert into public.notification_user_state(notification_id,user_id,snoozed_until,updated_at) values(p_id,auth.uid(),until_at,now())
    on conflict(notification_id,user_id) do update set snoozed_until=excluded.snoozed_until,updated_at=now();
  return jsonb_build_object('notification_id',p_id,'snoozed_until',until_at);
end $$;
revoke execute on function public.notification_snooze(text,integer) from public,anon; grant execute on function public.notification_snooze(text,integer) to authenticated;

-- Legacy Team Chat is JSON-backed. No direct UPDATE is allowed: seen receipts
-- use this identity-checked RPC so a user cannot edit another person's message.
revoke update on public.chat from authenticated;
drop policy if exists chat_upd on public.chat;
create policy chat_no_update on public.chat for update to authenticated using(false) with check(false);
create or replace function public.chat_mark_seen(p_ids text[])
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  with targets as (select c.id,c.data from public.chat c where c.id=any(coalesce(p_ids,'{}')) and not public.is_client() and (c.data->>'userId') is distinct from auth.uid()::text and not coalesce((c.data->'seenBy') ? auth.uid()::text,false))
  update public.chat c set data=jsonb_set(c.data,'{seenBy}',to_jsonb(array(select distinct x from jsonb_array_elements_text(coalesce(c.data->'seenBy','[]'::jsonb)||to_jsonb(array[auth.uid()::text])) x order by x))),updated_at=now()
  where c.id in (select id from targets);
  get diagnostics n=row_count; return n;
end $$;
revoke execute on function public.chat_mark_seen(text[]) from public,anon; grant execute on function public.chat_mark_seen(text[]) to authenticated;

commit;
notify pgrst,'reload schema';

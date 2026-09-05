begin;

create or replace function public.notification_unread_count()
returns integer language sql security definer stable set search_path=pg_catalog,public,pg_temp as $$
select count(*)::integer from public.notifications n
where (coalesce(n.data->>'audience','all')='all'
  or coalesce(n.data->>'audience','')=coalesce((select role from public.profiles where id=auth.uid()),'')
  or coalesce(n.data->>'audience','')=('user:'||auth.uid()::text))
  and not (coalesce(n.data->'reads','[]'::jsonb) ? auth.uid()::text)
  and not exists(select 1 from public.notification_user_state s where s.notification_id=n.id and s.user_id=auth.uid() and (s.read_at is not null or s.snoozed_until>now()));
$$;
revoke execute on function public.notification_unread_count() from public,anon;
grant execute on function public.notification_unread_count() to authenticated;

commit;
notify pgrst,'reload schema';

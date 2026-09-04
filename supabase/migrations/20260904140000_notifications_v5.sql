begin;
create table if not exists public.notification_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,endpoint text not null,subscription jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint));
create index if not exists notification_push_user_idx on public.notification_push_subscriptions(user_id,updated_at desc);
alter table public.notification_push_subscriptions enable row level security;
revoke all on public.notification_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.notification_push_subscriptions to authenticated;
create policy push_self on public.notification_push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.notification_push_save(p_subscription jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid; ep text:=p_subscription->>'endpoint';begin if auth.uid() is null or ep is null or length(ep)<10 then raise exception 'Valid push subscription required.';end if;insert into public.notification_push_subscriptions(user_id,endpoint,subscription,updated_at) values(auth.uid(),ep,p_subscription,now()) on conflict(user_id,endpoint) do update set subscription=excluded.subscription,updated_at=now() returning id into v;return v;end $$;
create or replace function public.notification_push_remove(p_endpoint text) returns void language sql security definer set search_path=public as $$ delete from public.notification_push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint $$;
revoke execute on function public.notification_push_save(jsonb),public.notification_push_remove(text) from public,anon;grant execute on function public.notification_push_save(jsonb),public.notification_push_remove(text) to authenticated;

create or replace function public.notification_delivery_analytics() returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object('attempts',(select count(*) from public.notification_delivery_audit),'delivered',(select count(*) from public.notification_delivery_audit where status='delivered'),'failed',(select count(*) from public.notification_delivery_audit where status='failed'),'read',(select count(*) from public.notification_delivery_audit where read_at is not null),'push_subscribers',(select count(*) from public.notification_push_subscriptions)) where public.is_admin()
$$;
revoke execute on function public.notification_delivery_analytics() from public,anon;grant execute on function public.notification_delivery_analytics() to authenticated;

create or replace function public.notification_snooze(p_id text,p_minutes integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare n public.notifications%rowtype;begin select * into n from public.notifications where id=p_id for update;if not found then raise exception 'Notification not found.';end if;update public.notifications set snoozed_until=now()+make_interval(mins=>greatest(1,least(p_minutes,10080))),snooze_count=snooze_count+1,updated_at=now() where id=p_id returning * into n;return to_jsonb(n);end $$;
revoke execute on function public.notification_snooze(text,integer) from public,anon;grant execute on function public.notification_snooze(text,integer) to authenticated;
commit;
notify pgrst,'reload schema';

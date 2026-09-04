-- Notification Center v3: per-user delivery preferences and action metadata.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  urgent_enabled boolean not null default true,
  important_enabled boolean not null default true,
  general_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
drop policy if exists notification_preferences_self on public.notification_preferences;
create policy notification_preferences_self on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.notification_preferences_get()
returns jsonb language sql security definer stable set search_path=public as $$
  select coalesce(to_jsonb(p),jsonb_build_object('user_id',auth.uid(),'enabled',true,'urgent_enabled',true,'important_enabled',true,'general_enabled',true)) from public.notification_preferences p where p.user_id=auth.uid()
$$;
create or replace function public.notification_preferences_save(p_enabled boolean,p_urgent boolean,p_important boolean,p_general boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.notification_preferences%rowtype;
begin
  insert into public.notification_preferences(user_id,enabled,urgent_enabled,important_enabled,general_enabled,updated_at) values(auth.uid(),coalesce(p_enabled,true),coalesce(p_urgent,true),coalesce(p_important,true),coalesce(p_general,true),now()) on conflict(user_id) do update set enabled=excluded.enabled,urgent_enabled=excluded.urgent_enabled,important_enabled=excluded.important_enabled,general_enabled=excluded.general_enabled,updated_at=now() returning * into r; return to_jsonb(r);
end $$;
revoke execute on function public.notification_preferences_get(),public.notification_preferences_save(boolean,boolean,boolean,boolean) from public,anon; grant execute on function public.notification_preferences_get(),public.notification_preferences_save(boolean,boolean,boolean,boolean) to authenticated;

-- Keep the notifications stream realtime-capable explicitly (idempotent).
do $$ begin begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; when undefined_object then null; end; end $$;
notify pgrst,'reload schema';

-- Durable APN notification read state for every authenticated APN partner/admin.
-- Admin action badges remain admin-only; notification_unread is user-scoped.

begin;

alter table public.apn_action_badge_reads enable row level security;

drop policy if exists apn_action_badge_reads_select on public.apn_action_badge_reads;
create policy apn_action_badge_reads_select
  on public.apn_action_badge_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists apn_action_badge_reads_insert on public.apn_action_badge_reads;
create policy apn_action_badge_reads_insert
  on public.apn_action_badge_reads for insert to authenticated
  with check (user_id = auth.uid() and (action_type = 'notification_unread' or public.is_admin()));

drop policy if exists apn_action_badge_reads_update on public.apn_action_badge_reads;
create policy apn_action_badge_reads_update
  on public.apn_action_badge_reads for update to authenticated
  using (user_id = auth.uid() and (action_type = 'notification_unread' or public.is_admin()))
  with check (user_id = auth.uid() and (action_type = 'notification_unread' or public.is_admin()));

create or replace function public.mark_apn_action_badge_seen(p_action_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(trim(coalesce(p_action_type, '')));
  v_seen_at timestamptz := now();
begin
  if v_action not in ('partner_pending','commission_pending','withdrawal_pending','referral_pending','target_action','training_action','material_action','notification_unread') then
    raise exception 'Invalid APN action badge type.' using errcode = 'invalid_parameter_value';
  end if;
  if v_action <> 'notification_unread' and not public.is_admin() then
    raise exception 'Only administrators can mark APN action badges as seen.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.apn_action_badge_reads (user_id, action_type, seen_at, updated_at)
  values (auth.uid(), v_action, v_seen_at, v_seen_at)
  on conflict (user_id, action_type) do update
    set seen_at = excluded.seen_at, updated_at = excluded.updated_at;
  return jsonb_build_object('actionType', v_action, 'seenAt', v_seen_at);
end;
$$;

revoke all on function public.mark_apn_action_badge_seen(text) from public;
grant execute on function public.mark_apn_action_badge_seen(text) to authenticated;

commit;

-- PR-UX-2 — production root-cause fixes
--
-- Repairs the canonical HajiAPN APN identifier and extends the existing
-- pre-auth resolver to support username, email, and APN ID aliases. No auth
-- identity or APN business row is deleted.

begin;

-- The linked production query role is subject to table RLS for data writes;
-- use the already established migration convention for service-owned repair.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$ <<repair>>
declare
  target_id text;
  conflicting_id text;
  conflicting_apn_id text;
  next_number integer := 6;
  replacement_apn_id text;
begin
  target_id := '2e755d09-64df-48cf-9a18-02edb3d823f9';
  if not exists (
    select 1
    from public.profiles p
    join public.apn_users u on u.id = p.id::text
    where p.id::text = '2e755d09-64df-48cf-9a18-02edb3d823f9'
      and lower(trim(p.username)) = 'hajiapn'
      and lower(trim(p.email)) = 'suplaykart@gmail.com'
  ) then
    raise exception 'PR-UX-2 identity repair could not find the active HajiAPN identity.';
  end if;

  -- The legacy immutability trigger protects normal edits, but this migration
  -- is the authorized identity repair. Temporarily suspend that trigger inside
  -- the transaction so both the retired duplicate and canonical APN ID can be
  -- repaired atomically.
  drop trigger if exists apn_users_apnid_immutable_trg on public.apn_users;
  drop trigger if exists apn_users_guard_trg on public.apn_users;

  select u.id, u.data->>'apnId'
  into conflicting_id, conflicting_apn_id
  from public.apn_users u
  where upper(trim(u.data->>'apnId')) = 'APN-TN-0001'
    and u.id <> repair.target_id
  order by case when lower(coalesce(u.data->>'status', '')) = 'deleted' then 0 else 1 end, u.id
  limit 1;

  if conflicting_id is not null then
    if lower(coalesce((select data->>'status' from public.apn_users where id = repair.conflicting_id), '')) <> 'deleted' then
      raise exception 'PR-UX-2 cannot safely repair duplicate active APN-TN-0001 identity %.', repair.conflicting_id;
    end if;

    while exists (
      select 1 from public.apn_users
      where upper(trim(data->>'apnId')) = 'APN-TN-' || lpad(next_number::text, 4, '0')
    ) loop
      next_number := next_number + 1;
    end loop;
    replacement_apn_id := 'APN-TN-' || lpad(next_number::text, 4, '0');

    update public.apn_users
    set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
      'legacyApnId', coalesce(data->>'legacyApnId', conflicting_apn_id),
      'apnId', replacement_apn_id,
      'identityRepair', 'PR-UX-2'
    ), updated_at = now()
    where id = repair.conflicting_id;
  end if;

  if exists (
    select 1 from auth.users
    where lower(email) = 'suplaykart@gmail.com' and id::text <> repair.target_id
  ) then
    raise exception 'PR-UX-2 cannot safely repair duplicate HajiAPN auth email.';
  end if;

  update auth.users
  set email = 'suplaykart@gmail.com'
  where id::text = repair.target_id
    and lower(coalesce(email, '')) <> 'suplaykart@gmail.com';

  update public.profiles
  set username = 'hajiapn', email = 'suplaykart@gmail.com', active = true, status = 'active'
  where id::text = repair.target_id;

  update public.profiles set approved = true where id::text = repair.target_id;

  update public.apn_users
  set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
    'username', 'hajiapn',
    'email', 'suplaykart@gmail.com',
    'apnId', 'APN-TN-0001',
    'status', 'active',
    'identityRepair', 'PR-UX-2'
  ), updated_at = now()
  where id = repair.target_id;

  create trigger apn_users_apnid_immutable_trg
    before insert or update on public.apn_users
    for each row execute function public.apn_users_apnid_immutable();

  create trigger apn_users_guard_trg
    before insert or update on public.apn_users
    for each row execute function public.apn_users_guard();

  insert into public.audit (id, data, updated_at)
  values (
    'apn-audit:identity-repair:pr-ux-2:hajiapn',
    jsonb_build_object(
      'id', 'apn-audit:identity-repair:pr-ux-2:hajiapn',
      'ts', (extract(epoch from now()) * 1000)::bigint,
      'user', 'PR-UX-2 deployment',
      'action', 'repaired APN identity mapping',
      'module', 'APN',
      'entity', 'APN Partner',
      'entityId', repair.target_id,
      'metadata', jsonb_build_object('username', 'hajiapn', 'email', 'suplaykart@gmail.com', 'apnId', 'APN-TN-0001', 'conflictingDeletedId', conflicting_id, 'replacementApnId', replacement_apn_id)
    ), now()
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.username_to_email(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  input_value text := lower(trim(coalesce(p_username, '')));
  compact_value text := regexp_replace(input_value, '[^a-z0-9]', '', 'g');
  apn_digits text;
  canonical_apn_id text;
  resolved_email text;
begin
  if input_value = '' then return null; end if;

  -- Preserve employee/client username and email login compatibility.
  select lower(trim(p.email))
  into resolved_email
  from public.profiles p
  where p.active = true
    and lower(coalesce(p.status, 'active')) not in ('suspended', 'terminated', 'deleted', 'inactive')
    and (
      lower(trim(coalesce(p.email, ''))) = input_value
      or regexp_replace(lower(coalesce(p.username, '')), '[^a-z0-9]', '', 'g') = compact_value
    )
    and nullif(trim(coalesce(p.email, '')), '') is not null
  order by p.created_at asc
  limit 1;
  if resolved_email is not null then return resolved_email; end if;

  -- Accept APN-TN-0008, apn-tn-0008, APNTN0008, and 0008.
  apn_digits := regexp_replace(compact_value, '^(apntn|apn|tn)', '');
  if apn_digits ~ '^\d{1,4}$' then
    canonical_apn_id := 'APN-TN-' || lpad(apn_digits, 4, '0');
    select lower(trim(p.email))
    into resolved_email
    from public.apn_users u
    join public.profiles p on p.id::text = u.id
    where upper(trim(u.data->>'apnId')) = canonical_apn_id
      and lower(coalesce(u.data->>'status', '')) = 'active'
      and p.active = true
      and lower(coalesce(p.status, 'active')) not in ('suspended', 'terminated', 'deleted', 'inactive')
      and nullif(trim(coalesce(p.email, '')), '') is not null
    order by p.created_at asc
    limit 1;
  end if;
  return resolved_email;
end;
$$;

revoke all on function public.username_to_email(text) from public;
grant execute on function public.username_to_email(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

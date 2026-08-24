-- APN signup: create the pending application at auth signup time.
-- This makes the application visible to admins even when email confirmation
-- means the new user has no authenticated browser session yet.

create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text; old_status text; new_status text;
  bootstrap boolean := coalesce(current_setting('allbee.apn_signup_bootstrap', true), '') = '1';
begin
  if public.is_superadmin() then return new; end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and not bootstrap and (new.data->>'id') <> auth.uid()::text then
      raise exception 'You cannot create another APN profile.';
    end if;
    if not public.is_admin() and not bootstrap then
      new.data := jsonb_set(new.data, array['status'], '"pending"'::jsonb, true);
      new.data := jsonb_set(new.data, array['role'], '"partner"'::jsonb, true);
      new.data := new.data - 'commissionPct' - 'attendanceScore' - 'target' - 'walletBalance' - 'revenueGenerated';
    end if;
    return new;
  end if;
  foreach k in array array[
    'name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt'
  ] loop
    if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
  end loop;
  if public.is_admin() then
    foreach k in array array['quizPasses','unlocked','notifReads','lastCheckIn','lastActivity','reactivationRequested','reactivationRecommended'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
    end loop;
  end if;
  if not public.is_admin() then
    old_status := coalesce(old.data->>'status','pending');
    new.data := jsonb_set(new.data, array['status'], to_jsonb(old_status), true);
  else
    old_status := coalesce(old.data->>'status','pending');
    new_status := coalesce(new.data->>'status',old_status);
    if new_status not in ('pending','active','inactive','rejected') then new.data := jsonb_set(new.data, array['status'], to_jsonb(old_status), true); end if;
  end if;
  return new;
end $$;

drop trigger if exists apn_users_guard_trg on public.apn_users;
create trigger apn_users_guard_trg before insert or update on public.apn_users
for each row execute function public.apn_users_guard();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1));
  v_code text := new.raw_user_meta_data->>'admin_code';
  v_admin text;
  v_role text := 'staff';
  v_apn jsonb := coalesce(new.raw_user_meta_data->'apn', '{}'::jsonb);
  v_apn_number bigint;
  v_apn_id text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  perform public.apn_registration_guard(new.email, new.raw_user_meta_data);
  select value into v_admin from public.app_config where key = 'admin_signup_code';
  if v_code is not null and v_admin is not null and v_code = v_admin then
    v_role := 'superadmin';
  elsif new.raw_user_meta_data->>'role_intent' = 'partner' then
    v_role := 'partner';
  end if;

  -- APN applicants must never be pre-approved. The admin approval queue is
  -- authoritative; the profile is inactive until that approval happens.
  insert into public.profiles (id, name, email, role, approved, active, status)
  values (new.id, v_name, new.email, v_role, false, false, 'pending')
  on conflict (id) do nothing;

  if v_role = 'partner' then
    -- Allocate the permanent APN identity at registration, not first login.
    -- The advisory lock makes concurrent registrations deterministic.
    perform pg_advisory_xact_lock(hashtext('allbee.apn.partner.number'));
    select greatest(
      coalesce(max(case when regexp_replace(data->>'apnId', '[^0-9]', '', 'g') ~ '^[0-9]+$'
        then (regexp_replace(data->>'apnId', '[^0-9]', '', 'g'))::bigint end), 5) + 1,
      6
    ) into v_apn_number
    from public.apn_users;
    while exists (select 1 from public.apn_users where data->>'apnId' = 'APN-TN-' || lpad(v_apn_number::text, 4, '0')) loop
      v_apn_number := v_apn_number + 1;
    end loop;
    v_apn_id := 'APN-TN-' || lpad(v_apn_number::text, 4, '0');

    -- Bootstrap is restricted to this trigger invocation; the guard still
    -- forces normal client-side APN inserts to pending.
    perform set_config('allbee.apn_signup_bootstrap', '1', true);
    insert into public.apn_users (id, data, updated_at)
    values (
      new.id::text,
      jsonb_build_object(
        'id', new.id::text,
        'apnId', v_apn_id,
        'name', v_name,
        'username', lower(trim(coalesce(v_apn->>'username', ''))),
        'email', lower(new.email),
        'mobile', coalesce(v_apn->>'mobile', ''),
        'dob', coalesce(v_apn->>'dob', ''),
        'district', coalesce(v_apn->>'district', ''),
        'taluk', coalesce(v_apn->>'taluk', ''),
        'city', coalesce(v_apn->>'city', ''),
        'occupation', coalesce(v_apn->>'occupation', ''),
        'college', coalesce(v_apn->>'college', ''),
        'reason', coalesce(v_apn->>'reason', ''),
        'referralCode', upper(trim(coalesce(v_apn->>'referralCode', ''))),
        'role', 'partner',
        'status', 'pending',
        'createdAt', v_now,
        'unlocked', '{}'::jsonb,
        'quizPasses', '{}'::jsonb
      ),
      now()
    ) on conflict (id) do update set updated_at = excluded.updated_at;
    perform set_config('allbee.apn_signup_bootstrap', '', true);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates pending APN applications at signup so admin approval does not depend on first login/email confirmation.';

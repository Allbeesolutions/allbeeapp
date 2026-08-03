-- ALLBEE APN Enhancement Pack V1
-- Run after supabase/apn-partner-management.sql. Additive and safe to re-run.

-- Partners may edit their own profile fields, while hierarchy, status,
-- financial, suspension, archive, and APN identity fields remain protected.
create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  old_status text;
  new_status text;
begin
  if public.is_superadmin() then return new; end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and (new.data->>'id') <> auth.uid()::text then raise exception 'You cannot create another APN profile.'; end if;
    if not public.is_admin() then
      new.data := jsonb_set(new.data, array['status'], '"pending"'::jsonb, true);
      new.data := jsonb_set(new.data, array['role'], '"partner"'::jsonb, true);
      new.data := new.data - 'commissionPct' - 'attendanceScore' - 'target' - 'walletBalance' - 'revenueGenerated';
    end if;
    return new;
  end if;

  if public.is_admin() then
    -- Preserve the existing admin permission boundary: non-superadmins may
    -- process allowed statuses, but cannot edit partner identity fields.
    foreach k in array array['name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
    end loop;
  else
    -- Self-service APN profile fields.
    foreach k in array array['id','apnId','status','role','level','target','targetMetric','commissionPct','attendanceScore','notes','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt','createdAt','approvedAt','approvedBy','reactivatedAt','reactivatedBy'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
    end loop;
  end if;

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

-- Allow a partner to update only their own display/profile fields. Admin role,
-- activity, approval, and permission fields remain immutable to that partner.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_admin boolean := public.is_admin(); caller_super boolean := public.is_superadmin();
begin
  if old.role = 'superadmin' and not caller_super then return old; end if;
  if old.role in ('partner','district_head') and not caller_super then
    if not caller_admin and auth.uid() = old.id then
      new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
      return new;
    end if;
    new.name := old.name; new.email := old.email; new.mobile := old.mobile; new.username := old.username;
    new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
    return new;
  end if;
  if not caller_admin then
    new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
  end if;
  if new.role = 'superadmin' and old.role <> 'superadmin' and not caller_super then new.role := old.role; end if;
  return new;
end $$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
for each row execute function public.profiles_guard();

-- Canonicalize the existing hajiAPN seed/account identifier without leaving
-- the superseded identifier in application data. The numeric comparison also
-- handles equivalent padded APN identifier formats safely.
update public.apn_users as target_row
set data = jsonb_set(data, '{apnId}', to_jsonb('APN-TN-0001'::text), true), updated_at = now()
where lower(trim(coalesce(target_row.data->>'username',''))) = 'hajiapn'
  and regexp_replace(coalesce(target_row.data->>'apnId',''), '[^0-9]', '', 'g') = '0003'
  and not exists (
    select 1 from public.apn_users other
    where other.id <> target_row.id
      and lower(trim(coalesce(other.data->>'apnId',''))) = 'apn-tn-0001'
  );

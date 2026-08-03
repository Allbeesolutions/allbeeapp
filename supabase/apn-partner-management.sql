-- ALLBEE APN Partner Management
-- Run after the base ALLBEE schema. Additive and safe to re-run.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists approved boolean not null default true;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check
  (role in ('superadmin','admin','accountant','staff','intern','client','partner','district_head','state_head')) not valid;

-- Existing production data may contain duplicate legacy identities. Preserve
-- those rows, retain lookup performance, and enforce uniqueness for all new or
-- changed values through profiles_identity_guard(). Once legacy duplicates are
-- resolved, re-running this block automatically creates the unique indexes.
do $$
begin
  if exists (
    select 1 from public.profiles
    where nullif(trim(username), '') is not null
    group by lower(trim(username)) having count(*) > 1
  ) then
    execute $sql$create index if not exists profiles_username_apn_lookup_idx on public.profiles (lower(trim(username))) where username is not null and trim(username) <> ''$sql$;
  else
    execute $sql$create unique index if not exists profiles_username_apn_unique on public.profiles (lower(trim(username))) where username is not null and trim(username) <> ''$sql$;
  end if;
  if exists (
    select 1 from public.profiles
    where nullif(regexp_replace(mobile, '[^0-9]', '', 'g'), '') is not null
    group by regexp_replace(mobile, '[^0-9]', '', 'g') having count(*) > 1
  ) then
    execute $sql$create index if not exists profiles_mobile_apn_lookup_idx on public.profiles ((regexp_replace(mobile, '[^0-9]', '', 'g'))) where mobile is not null and regexp_replace(mobile, '[^0-9]', '', 'g') <> ''$sql$;
  else
    execute $sql$create unique index if not exists profiles_mobile_apn_unique on public.profiles ((regexp_replace(mobile, '[^0-9]', '', 'g'))) where mobile is not null and regexp_replace(mobile, '[^0-9]', '', 'g') <> ''$sql$;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_achievements',
    'apn_notifications','apn_documents','apn_timeline','apn_warnings','apn_notes','apn_activity','apn_transfer_history','apn_communications'
  ] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null default ''{}''::jsonb, updated_at timestamptz not null default now())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

do $$
declare t text; sel text; ins text; upd text; del text; own text; own_write text; pol record;
begin
  foreach t in array array[
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_achievements',
    'apn_notifications','apn_documents','apn_timeline','apn_warnings','apn_notes','apn_activity','apn_transfer_history','apn_communications'
  ] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    own := case when t = 'apn_users' then '(data->>''id'') = auth.uid()::text' else '(data->>''partnerId'') = auth.uid()::text' end;
    own_write := '(' || own || ' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.status <> ''suspended''))';
    sel := case
      when t = 'apn_users' then 'public.is_superadmin() or (public.is_admin() and coalesce(data->>''status'',''pending'') <> ''deleted'') or ' || own
      when t in ('apn_timeline','apn_warnings','apn_notes','apn_activity','apn_transfer_history','apn_communications') then 'public.is_admin()'
      when t = 'apn_documents' then 'public.is_admin() or (data->>''partnerId'' is null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''partner'',''district_head'') and p.active))'
      when t in ('apn_training','apn_quizzes') then 'public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''partner'',''district_head'') and p.active)'
      when t = 'apn_notifications' then 'public.is_admin() or ' || own || ' or data->>''audience'' = ''all'' or data->>''audience'' = ''partner:'' || auth.uid()::text or data->>''audience'' = ''district:'' || coalesce((select u.data->>''district'' from public.apn_users u where u.id = auth.uid()::text limit 1), '''')'
      else 'public.is_admin() or ' || own
    end;
    ins := case when t = 'apn_users' then 'public.is_superadmin() or ' || own_write when t in ('apn_attendance','apn_leads','apn_quotations') then 'public.is_admin() or ' || own_write else 'public.is_admin()' end;
    upd := case when t = 'apn_timeline' then 'false' when t in ('apn_users','apn_attendance','apn_targets','apn_leads','apn_quotations') then 'public.is_admin() or ' || own_write else 'public.is_admin()' end;
    del := case when t in ('apn_users','apn_warnings','apn_notes') then 'public.is_superadmin()' when t in ('apn_timeline','apn_activity','apn_transfer_history','apn_communications') then 'false' else 'public.is_admin()' end;
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, sel);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, ins);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, upd, upd);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, del);
  end loop;
end $$;

-- Full-row JSON upserts are used by the client. This guard lets existing
-- admins approve/reject/deactivate/reactivate, but only Super Admin can alter
-- APN identity, hierarchy, financial, suspension, or deletion fields.
create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; old_status text; new_status text;
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

create or replace function public.apn_commissions_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.apn_users u where u.id = new.data->>'partnerId' and u.data->>'status' = 'suspended') then
    raise exception 'Suspended APN partners cannot receive new commissions.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists apn_commissions_guard_trg on public.apn_commissions;
create trigger apn_commissions_guard_trg before insert or update on public.apn_commissions
for each row execute function public.apn_commissions_guard();

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_admin boolean := public.is_admin(); caller_super boolean := public.is_superadmin();
begin
  if old.role = 'superadmin' and not caller_super then return old; end if;
  if old.role in ('partner','district_head') and not caller_super then
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

create or replace function public.apn_registration_guard(p_email text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_username text := lower(trim(coalesce(p_meta->'apn'->>'username', p_meta->>'username','')));
        v_mobile text := regexp_replace(coalesce(p_meta->'apn'->>'mobile', p_meta->>'mobile',''), '[^0-9]', '', 'g');
begin
  if exists (
    select 1 from public.profiles p where p.status = 'suspended' and (
      lower(coalesce(p.email,'')) = lower(coalesce(p_email,''))
      or (v_username <> '' and lower(coalesce(p.username,'')) = v_username)
      or (v_mobile <> '' and regexp_replace(coalesce(p.mobile,''), '[^0-9]', '', 'g') = v_mobile)
    )
  ) then raise exception 'This APN identifier belongs to a suspended account.' using errcode = 'check_violation'; end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text := coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1));
        v_code text := new.raw_user_meta_data->>'admin_code'; v_admin text; v_role text := 'staff';
begin
  perform public.apn_registration_guard(new.email, new.raw_user_meta_data);
  select value into v_admin from public.app_config where key = 'admin_signup_code';
  if v_code is not null and v_admin is not null and v_code = v_admin then v_role := 'superadmin';
  elsif new.raw_user_meta_data->>'role_intent' = 'partner' then v_role := 'partner'; end if;
  insert into public.profiles (id, name, email, role, approved)
  values (new.id, v_name, new.email, v_role, v_role in ('superadmin','partner'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- APN actions use the existing audit collection. Make it append-only.
alter table public.audit enable row level security;
drop policy if exists audit_del on public.audit;
drop policy if exists audit_delete on public.audit;
drop policy if exists audit_update on public.audit;
revoke update, delete on public.audit from authenticated, anon;

do $$ declare t text;
begin
  foreach t in array array['apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes','apn_leads','apn_quotations','apn_commissions','apn_achievements','apn_notifications','apn_documents','apn_timeline','apn_warnings','apn_notes','apn_activity','apn_transfer_history','apn_communications'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; when others then null; end;
  end loop;
end $$;

-- JSON-backed APN records remain compatible with the current client while
-- these expression indexes keep list/search/profile history queries bounded
-- as the partner network grows.
create index if not exists apn_users_status_idx on public.apn_users ((data->>'status'));
create index if not exists apn_users_district_idx on public.apn_users ((data->>'district'));
create index if not exists apn_users_name_idx on public.apn_users (lower(data->>'name'));
create index if not exists apn_timeline_partner_created_idx on public.apn_timeline ((data->>'partnerId'), ((case when data->>'createdAt' ~ '^[0-9]+$' then (data->>'createdAt')::bigint end)) desc);
create index if not exists apn_warnings_partner_status_idx on public.apn_warnings ((data->>'partnerId'), (data->>'status'));
create index if not exists apn_notes_partner_updated_idx on public.apn_notes ((data->>'partnerId'), ((case when data->>'updatedAt' ~ '^[0-9]+$' then (data->>'updatedAt')::bigint end)) desc);
create index if not exists apn_activity_partner_created_idx on public.apn_activity ((data->>'partnerId'), ((case when data->>'createdAt' ~ '^[0-9]+$' then (data->>'createdAt')::bigint end)) desc);
create index if not exists apn_transfer_partner_effective_idx on public.apn_transfer_history ((data->>'partnerId'), ((case when data->>'effectiveDate' ~ '^[0-9]+$' then (data->>'effectiveDate')::bigint end)) desc);
create index if not exists apn_communications_partner_created_idx on public.apn_communications ((data->>'partnerId'), ((case when data->>'createdAt' ~ '^[0-9]+$' then (data->>'createdAt')::bigint end)) desc);

-- Partner identity documents are private and downloaded through short-lived
-- signed URLs. Existing APN sales materials continue to use apn_documents
-- rows without partnerId and remain visible to active partners.
insert into storage.buckets (id, name, public)
values ('apn-private', 'apn-private', false)
on conflict (id) do update set public = false;
drop policy if exists apn_private_select on storage.objects;
drop policy if exists apn_private_insert on storage.objects;
drop policy if exists apn_private_update on storage.objects;
drop policy if exists apn_private_delete on storage.objects;
create policy apn_private_select on storage.objects for select to authenticated using (bucket_id = 'apn-private' and public.is_admin());
create policy apn_private_insert on storage.objects for insert to authenticated with check (bucket_id = 'apn-private' and public.is_superadmin());
create policy apn_private_update on storage.objects for update to authenticated using (bucket_id = 'apn-private' and public.is_superadmin()) with check (bucket_id = 'apn-private' and public.is_superadmin());
create policy apn_private_delete on storage.objects for delete to authenticated using (bucket_id = 'apn-private' and public.is_superadmin());

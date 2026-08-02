-- ALLBEE APN Enhancement Pack V3
-- Run after schema.sql, apn-partner-management.sql, and the V1/V2 APN
-- migrations. This migration is additive and re-runnable.
-- Repairs APN tables/schema cache, reconciles fixed IDs, enforces immutable
-- APN IDs, and cleans the explicitly requested orphan account.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists approved boolean not null default true;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check
  (role in ('superadmin','admin','accountant','staff','intern','client','partner','district_head','state_head'));

-- Keep service-role account synchronization authoritative, while allowing an
-- Admin to approve/reject APN lifecycle fields without gaining identity or
-- hierarchy editing rights.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_admin boolean := public.is_admin(); caller_super boolean := public.is_superadmin();
begin
  if auth.role() = 'service_role' then return new; end if;
  if old.role = 'superadmin' and not caller_super then return old; end if;
  if old.role in ('partner','district_head','state_head') and not caller_super then
    if not caller_admin and auth.uid() = old.id then
      new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
      return new;
    end if;
    if caller_admin then
      new.name := old.name; new.email := old.email; new.mobile := old.mobile; new.username := old.username; new.role := old.role; new.perms := old.perms;
      return new;
    end if;
    return old;
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

do $$
declare t text;
begin
  foreach t in array array[
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_achievements',
    'apn_notifications','apn_documents','apn_timeline','apn_warnings',
    'apn_notes','apn_activity','apn_transfer_history','apn_communications'
  ] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null default ''{}''::jsonb, updated_at timestamptz not null default now())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Permanent identity mapping. Existing APN-TN-0004 and APN-TN-0005 records
-- are only assigned when their canonical identity is present; no other ID is
-- renumbered. Manual creation may fill reserved gaps 0002 and 0003.
update public.apn_users
set data = jsonb_set(data, '{apnId}', to_jsonb('APN-TN-0001'::text), true), updated_at = now()
where (lower(trim(coalesce(data->>'username',''))) = 'hajiapn' or lower(trim(coalesce(data->>'name',''))) = 'hajiapn')
  and coalesce(data->>'apnId','') <> 'APN-TN-0001';

update public.apn_users
set data = jsonb_set(data, '{apnId}', to_jsonb('APN-TN-0004'::text), true), updated_at = now()
where lower(trim(coalesce(data->>'name',''))) = 'mohamed maqdoom ahmed'
  and coalesce(data->>'apnId','') <> 'APN-TN-0004';

update public.apn_users
set data = jsonb_set(data, '{apnId}', to_jsonb('APN-TN-0005'::text), true), updated_at = now()
where lower(trim(coalesce(data->>'name',''))) = 'sana'
  and coalesce(data->>'apnId','') <> 'APN-TN-0005';

create unique index if not exists apn_users_apnid_unique_idx
  on public.apn_users ((data->>'apnId'))
  where nullif(trim(data->>'apnId'), '') is not null;

create or replace function public.apn_users_apnid_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.data ? 'apnId' then
    new.data := jsonb_set(new.data, '{apnId}', old.data->'apnId', true);
  end if;
  return new;
end $$;
drop trigger if exists apn_users_apnid_immutable_trg on public.apn_users;
create trigger apn_users_apnid_immutable_trg
before update on public.apn_users
for each row execute function public.apn_users_apnid_immutable();

create or replace function public.next_apn_number()
returns bigint language plpgsql security definer set search_path = public as $$
declare next_number bigint;
begin
  perform pg_advisory_xact_lock(hashtext('allbee.apn.partner.number'));
  select greatest(coalesce(max((regexp_replace(data->>'apnId', '[^0-9]', '', 'g'))::bigint), 5) + 1, 6)
    into next_number from public.apn_users;
  while next_number in (2, 3)
     or exists (select 1 from public.apn_users where data->>'apnId' = 'APN-TN-' || lpad(next_number::text, 4, '0')) loop
    next_number := next_number + 1;
  end loop;
  return next_number;
end $$;
grant execute on function public.next_apn_number() to authenticated;

create index if not exists apn_users_status_v3_idx on public.apn_users ((data->>'status'));
create index if not exists apn_users_district_v3_idx on public.apn_users ((data->>'district'));
create index if not exists apn_timeline_partner_created_v3_idx on public.apn_timeline ((data->>'partnerId'), ((nullif(data->>'createdAt',''))::bigint) desc);
create index if not exists apn_activity_partner_created_v3_idx on public.apn_activity ((data->>'partnerId'), ((nullif(data->>'createdAt',''))::bigint) desc);

do $$ declare t text;
begin
  foreach t in array array[
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_achievements',
    'apn_notifications','apn_documents','apn_timeline','apn_warnings',
    'apn_notes','apn_activity','apn_transfer_history','apn_communications'
  ] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; when others then null; end;
  end loop;
end $$;

-- Remove all application/APN records belonging to the explicitly requested
-- orphaned account. The auth row is included so the email can be reused.
do $$
declare ids text[]; partner_audience text[]; t text;
begin
  select coalesce(array_agg(id), '{}'::text[]) into ids
  from (
    select id::text as id from public.profiles where lower(trim(coalesce(email,''))) = 'hasankuddos@gmail.com'
    union
    select id::text as id from public.apn_users where lower(trim(coalesce(data->>'email',''))) = 'hasankuddos@gmail.com'
  ) matched;
  if coalesce(array_length(ids, 1), 0) > 0 then
    select array_agg('partner:' || u.id) into partner_audience from unnest(ids) as u(id);
    foreach t in array array[
      'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
      'apn_leads','apn_quotations','apn_commissions','apn_achievements',
      'apn_notifications','apn_documents','apn_timeline','apn_warnings',
      'apn_notes','apn_activity','apn_transfer_history','apn_communications'
    ] loop
      execute format('delete from public.%I where id = any($1) or data->>''partnerId'' = any($1) or data->>''fromPartnerId'' = any($1) or data->>''userId'' = any($1) or data->>''audience'' = any($2)', t) using ids, partner_audience;
    end loop;
    delete from auth.users where id::text = any(ids);
    delete from public.profiles where id::text = any(ids);
  end if;
end $$;

-- PostgREST caches table metadata. Explicitly reload it so apn_timeline and
-- any other repaired APN table are available without restarting the project.
select pg_notify('pgrst', 'reload schema');

-- Rebuild policies if an older project has APN tables without policies.
do $$
declare t text; sel text; ins text; upd text; del text; own text; own_write text; pol record;
begin
  foreach t in array array[
    'apn_users','apn_attendance','apn_targets','apn_training','apn_quizzes',
    'apn_leads','apn_quotations','apn_commissions','apn_achievements',
    'apn_notifications','apn_documents','apn_timeline','apn_warnings',
    'apn_notes','apn_activity','apn_transfer_history','apn_communications'
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
    ins := case when t = 'apn_users' then 'public.is_admin() or ' || own_write when t in ('apn_attendance','apn_leads','apn_quotations') then 'public.is_admin() or ' || own_write else 'public.is_admin()' end;
    upd := case when t = 'apn_timeline' then 'false' when t in ('apn_users','apn_attendance','apn_targets','apn_leads','apn_quotations') then 'public.is_admin() or ' || own_write else 'public.is_admin()' end;
    del := case when t in ('apn_users','apn_warnings','apn_notes') then 'public.is_superadmin()' when t in ('apn_timeline','apn_activity','apn_transfer_history','apn_communications') then 'false' else 'public.is_admin()' end;
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, sel);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, ins);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, upd, upd);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, del);
  end loop;
end $$;

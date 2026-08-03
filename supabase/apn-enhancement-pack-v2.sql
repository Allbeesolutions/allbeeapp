-- ALLBEE APN Enhancement Pack V2
-- Run after supabase/apn-partner-management.sql and apn-enhancement-pack-v1.sql.
-- This migration is additive, re-runnable, and is intentionally not executed by the client.

-- APN hierarchy is stored in the JSON-backed APN record. The application keeps
-- profiles.role = partner for APN portal routing; apn_users.data.role/level
-- carries the APN hierarchy, including State Head.

-- Preserve the requested legacy identity mapping without renumbering any other
-- existing partner. The remaining reserved numbers are never allocated.
update public.apn_users as target_row
set data = jsonb_set(data, '{apnId}', to_jsonb('APN-TN-0001'::text), true),
    updated_at = now()
where lower(coalesce(target_row.data->>'username', '')) = 'hajiapn'
  and coalesce(target_row.data->>'apnId', '') <> 'APN-TN-0001'
  and not exists (
    select 1 from public.apn_users other
    where other.id <> target_row.id
      and lower(trim(coalesce(other.data->>'apnId',''))) = 'apn-tn-0001'
  );

-- Allocate new registrations from APN-TN-0006 onward. The transaction lock
-- prevents two concurrent registrations from receiving the same number.
drop function if exists public.next_apn_number();
create or replace function public.next_apn_number()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number bigint;
begin
  perform pg_advisory_xact_lock(hashtext('allbee.apn.partner.number'));
  select greatest(coalesce(max(case when regexp_replace(data->>'apnId', '[^0-9]', '', 'g') ~ '^[0-9]+$' then (regexp_replace(data->>'apnId', '[^0-9]', '', 'g'))::bigint end), 5) + 1, 6)
    into next_number
    from public.apn_users;
  while next_number in (2, 3)
     or exists (select 1 from public.apn_users where data->>'apnId' = 'APN-TN-' || lpad(next_number::text, 4, '0')) loop
    next_number := next_number + 1;
  end loop;
  return next_number;
end;
$$;
grant execute on function public.next_apn_number() to authenticated;

-- Keep percentage fields valid at the database boundary as well as in the UI.
create or replace function public.apn_percent_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  commission numeric;
  attendance numeric;
begin
  if nullif(trim(coalesce(new.data->>'commissionPct', '')), '') is not null then
    commission := (new.data->>'commissionPct')::numeric;
    if commission < 0 or commission > 100 then
      raise exception 'Commission percentage must be between 0 and 100.' using errcode = 'check_violation';
    end if;
  end if;
  if nullif(trim(coalesce(new.data->>'attendanceScore', '')), '') is not null then
    attendance := (new.data->>'attendanceScore')::numeric;
    if attendance < 0 or attendance > 100 then
      raise exception 'Attendance score must be between 0 and 100.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists apn_users_percent_limits_trg on public.apn_users;
create trigger apn_users_percent_limits_trg
before insert or update on public.apn_users
for each row execute function public.apn_percent_limits();

-- Helpful indexes for State Head filters and profile lookup.
create index if not exists apn_users_role_idx on public.apn_users ((data->>'role'));
create index if not exists apn_users_level_idx on public.apn_users ((data->>'level'));
create index if not exists apn_users_apnid_idx on public.apn_users ((data->>'apnId'));

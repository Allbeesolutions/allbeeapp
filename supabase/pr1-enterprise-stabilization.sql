-- PR-1: identity lookup and availability helpers.
-- This migration intentionally contains no referral tables, triggers, wallet,
-- or commission-engine changes. Existing identity guards remain authoritative.

create index if not exists profiles_username_lookup_pr1_idx
  on public.profiles (lower(trim(username)))
  where username is not null and trim(username) <> '';

create or replace function public.username_to_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(email))
  from public.profiles
  where lower(trim(coalesce(username, ''))) = lower(trim(coalesce(p_username, '')))
    and nullif(trim(coalesce(username, '')), '') is not null
    and nullif(trim(coalesce(email, '')), '') is not null
  order by created_at asc
  limit 1;
$$;

create or replace function public.username_available(p_username text, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(coalesce(p_username, '')), '') is not null
    and not exists (
      select 1
      from public.profiles
      where lower(trim(coalesce(username, ''))) = lower(trim(coalesce(p_username, '')))
        and (p_exclude is null or id <> p_exclude)
    );
$$;

create or replace function public.email_available(p_email text, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(coalesce(p_email, '')), '') is not null
    and position('@' in trim(coalesce(p_email, ''))) > 1
    and not exists (
      select 1
      from public.profiles
      where lower(trim(coalesce(email, ''))) = lower(trim(coalesce(p_email, '')))
        and (p_exclude is null or id <> p_exclude)
    );
$$;

revoke all on function public.username_to_email(text) from public;
grant execute on function public.username_to_email(text) to anon, authenticated;
revoke all on function public.username_available(text, uuid) from public;
grant execute on function public.username_available(text, uuid) to anon, authenticated;
revoke all on function public.email_available(text, uuid) from public;
grant execute on function public.email_available(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- These legacy checks were created as NOT VALID during earlier upgrades. The
-- production integrity scan completed with zero violations before validation.
alter table public.profiles
  validate constraint profiles_role_check;
alter table public.profiles
  validate constraint profiles_status_check;
alter table public.apn_commission_projects
  validate constraint apn_commission_projects_status_check;
alter table public.apn_commission_projects
  validate constraint apn_commission_projects_values_check;
alter table public.apn_revenue_collections
  validate constraint apn_revenue_collections_status_check;
alter table public.apn_revenue_collections
  validate constraint apn_revenue_collections_values_check;

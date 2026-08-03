-- ALLBEE APN — Enterprise Referral Engine (PR2)
-- Direct referrals only. One referrer -> one referred partner. No recursive
-- payouts, no tree traversal, and no changes to the existing commission wallet.
-- Safe to re-run. Referral earnings are created by the database when a new
-- APN revenue collection is inserted, with a permanent percentage snapshot.

create table if not exists public.apn_referral_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  default_percent numeric(5,2) not null default 1 check (default_percent >= 0 and default_percent <= 100),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.apn_referral_settings (id, enabled, default_percent)
values (1, true, 1)
on conflict (id) do nothing;

create table if not exists public.apn_referral_codes (
  partner_id text primary key references public.apn_users(id) on delete restrict,
  code text not null unique,
  rename_count smallint not null default 0 check (rename_count between 0 and 1),
  created_at timestamptz not null default now(),
  renamed_at timestamptz,
  active boolean not null default true
);

create table if not exists public.apn_referral_relationships (
  id uuid primary key default gen_random_uuid(),
  referrer_id text not null references public.apn_users(id) on delete restrict,
  referred_id text not null unique references public.apn_users(id) on delete restrict,
  referral_code text not null references public.apn_referral_codes(code) on delete restrict,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','disabled')),
  linked_by text,
  disabled_at timestamptz,
  constraint apn_referral_no_self check (referrer_id <> referred_id)
);

create table if not exists public.apn_referral_earnings (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.apn_referral_relationships(id) on delete restrict,
  referrer_id text not null references public.apn_users(id) on delete restrict,
  referred_id text not null references public.apn_users(id) on delete restrict,
  source_collection_id text not null unique,
  project_id text,
  revenue_amount numeric(14,2) not null check (revenue_amount > 0),
  referral_percent numeric(5,2) not null check (referral_percent >= 0 and referral_percent <= 100),
  referral_amount numeric(14,2) not null check (referral_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','withdrawable','paid','void')),
  collection_at timestamptz not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.apn_referral_snapshots (
  id uuid primary key default gen_random_uuid(),
  earning_id uuid not null unique references public.apn_referral_earnings(id) on delete restrict,
  referral_percent numeric(5,2) not null,
  settings_enabled boolean not null,
  captured_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.apn_referral_wallets (
  partner_id text primary key references public.apn_users(id) on delete restrict,
  pending numeric(14,2) not null default 0,
  approved numeric(14,2) not null default 0,
  withdrawable numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  lifetime numeric(14,2) not null default 0,
  monthly numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.apn_referral_withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  paid_at timestamptz,
  note text
);

create table if not exists public.apn_referral_timeline (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  event_type text not null,
  title text not null,
  description text not null default '',
  related_id text,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.apn_referral_activities (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  actor_id text,
  event_type text not null,
  title text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.apn_referral_monthly_summary (
  partner_id text not null references public.apn_users(id) on delete restrict,
  month_start date not null,
  referral_count integer not null default 0,
  active_count integer not null default 0,
  revenue numeric(14,2) not null default 0,
  earnings numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (partner_id, month_start)
);

create table if not exists public.apn_referral_analytics_monthly (
  partner_id text not null references public.apn_users(id) on delete restrict,
  month_start date not null,
  conversion_rate numeric(7,2) not null default 0,
  referral_count integer not null default 0,
  active_count integer not null default 0,
  revenue numeric(14,2) not null default 0,
  earnings numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (partner_id, month_start)
);

create index if not exists apn_referral_codes_code_idx on public.apn_referral_codes (lower(code));
create index if not exists apn_referral_relationships_referrer_idx on public.apn_referral_relationships (referrer_id, linked_at desc);
create index if not exists apn_referral_relationships_status_idx on public.apn_referral_relationships (status, linked_at desc);
create index if not exists apn_referral_earnings_referrer_created_idx on public.apn_referral_earnings (referrer_id, created_at desc);
create index if not exists apn_referral_earnings_referred_created_idx on public.apn_referral_earnings (referred_id, created_at desc);
create index if not exists apn_referral_earnings_status_idx on public.apn_referral_earnings (status, created_at desc);
create index if not exists apn_referral_withdrawals_partner_status_idx on public.apn_referral_withdrawals (partner_id, status, requested_at desc);
create index if not exists apn_referral_timeline_partner_created_idx on public.apn_referral_timeline (partner_id, created_at desc);
create index if not exists apn_referral_activities_partner_created_idx on public.apn_referral_activities (partner_id, created_at desc);
create index if not exists apn_referral_monthly_summary_month_idx on public.apn_referral_monthly_summary (month_start desc);

create or replace function public.apn_referral_code_available(p_code text, p_exclude_partner text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select nullif(trim(p_code), '') is not null
    and trim(p_code) ~ '^[A-Za-z0-9][A-Za-z0-9_-]{3,19}$'
    and not exists (
      select 1 from public.apn_referral_codes
      where lower(code) = lower(trim(p_code))
        and (p_exclude_partner is null or partner_id <> p_exclude_partner)
    );
$$;

create or replace function public.apn_referral_ensure_code(p_partner_id text)
returns text language plpgsql security definer set search_path = public as $$
declare
  existing_code text;
  base text;
  candidate text;
  suffix text := upper(substr(md5(coalesce(p_partner_id, '')), 1, 4));
  n integer := 0;
  partner_row jsonb;
begin
  if auth.uid() is not null and auth.uid()::text <> p_partner_id and not public.is_admin() then raise exception 'Referral code access denied.' using errcode = 'insufficient_privilege'; end if;
  select code into existing_code from public.apn_referral_codes where partner_id = p_partner_id;
  if existing_code is not null then return existing_code; end if;
  select data into partner_row from public.apn_users where id = p_partner_id;
  if partner_row is null then raise exception 'APN partner does not exist.' using errcode = 'foreign_key_violation'; end if;
  base := upper(regexp_replace(coalesce(partner_row->>'username', partner_row->>'apnId', partner_row->>'name', 'APN'), '[^A-Za-z0-9]', '', 'g'));
  base := left(coalesce(nullif(base, ''), 'APN'), 8);
  candidate := left(base || suffix, 20);
  while exists (select 1 from public.apn_referral_codes where lower(code) = lower(candidate)) loop
    n := n + 1;
    candidate := left(base || suffix || n::text, 20);
  end loop;
  insert into public.apn_referral_codes (partner_id, code) values (p_partner_id, candidate)
  on conflict (partner_id) do nothing;
  select code into existing_code from public.apn_referral_codes where partner_id = p_partner_id;
  return existing_code;
end;
$$;

create or replace function public.apn_referral_notify(p_partner_id text, p_title text, p_body text, p_event_type text)
returns void language plpgsql security definer set search_path = public as $$
declare
  notification_id text := 'referral-notification:' || gen_random_uuid()::text;
begin
  insert into public.apn_notifications (id, data, updated_at)
  values (notification_id, jsonb_build_object(
    'id', notification_id, 'title', p_title, 'body', p_body, 'audience', 'partner:' || p_partner_id,
    'partnerId', p_partner_id, 'level', 'Referral', 'priority', 'Normal', 'eventType', p_event_type,
    'senderName', 'ALLBEE', 'senderDesignation', 'Referral System', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
    'createdAt', (extract(epoch from now()) * 1000)::bigint, 'createdDate', to_char(now(), 'YYYY-MM-DD'),
    'createdTime', to_char(now(), 'HH24:MI:SS'), 'reads', '[]'::jsonb
  ), now()) on conflict (id) do nothing;
  insert into public.notifications (id, data, updated_at)
  values (notification_id, jsonb_build_object(
    'id', notification_id, 'title', p_title, 'body', p_body, 'audience', 'partner:' || p_partner_id,
    'partnerId', p_partner_id, 'module', 'APN', 'priority', 'Normal', 'eventType', p_event_type,
    'senderName', 'ALLBEE', 'senderDesignation', 'Referral System', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
    'createdAt', (extract(epoch from now()) * 1000)::bigint, 'reads', '[]'::jsonb
  ), now()) on conflict (id) do nothing;
end;
$$;

create or replace function public.apn_referral_audit(p_action text, p_partner_id text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare audit_id text := 'referral-audit:' || gen_random_uuid()::text;
begin
  perform set_config('row_security', 'off', true);
  insert into public.audit (id, data, updated_at)
  values (audit_id, jsonb_build_object(
    'id', audit_id, 'ts', (extract(epoch from now()) * 1000)::bigint, 'user', 'Referral System',
    'userId', null, 'action', p_action, 'module', 'APN', 'entity', 'Referral',
    'entityId', p_entity_id, 'partnerId', p_partner_id, 'metadata', coalesce(p_metadata, '{}'::jsonb)
  ), now()) on conflict (id) do nothing;
end;
$$;

create or replace function public.apn_referral_refresh_wallet(p_partner_id text)
returns void language plpgsql security definer set search_path = public as $$
declare current_month date := date_trunc('month', now())::date;
begin
  insert into public.apn_referral_wallets (partner_id, pending, approved, withdrawable, paid, lifetime, monthly, updated_at)
  select p_partner_id,
    coalesce(sum(referral_amount) filter (where status = 'pending'), 0),
    coalesce(sum(referral_amount) filter (where status = 'approved'), 0),
    greatest(0, coalesce(sum(referral_amount) filter (where status = 'withdrawable'), 0) - coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0)),
    coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status = 'paid'), 0),
    coalesce(sum(referral_amount) filter (where status <> 'void'), 0),
    coalesce(sum(referral_amount) filter (where status <> 'void' and created_at >= current_month), 0),
    now()
  from public.apn_referral_earnings
  where referrer_id = p_partner_id
  on conflict (partner_id) do update set pending = excluded.pending, approved = excluded.approved,
    withdrawable = excluded.withdrawable, paid = excluded.paid, lifetime = excluded.lifetime,
    monthly = excluded.monthly, updated_at = now();

  insert into public.apn_referral_monthly_summary (partner_id, month_start, referral_count, active_count, revenue, earnings, updated_at)
  select p_partner_id, date_trunc('month', r.linked_at)::date,
    count(*)::integer, count(*) filter (where r.status = 'active')::integer,
    coalesce(sum(e.revenue_amount), 0), coalesce(sum(e.referral_amount), 0), now()
  from public.apn_referral_relationships r
  left join public.apn_referral_earnings e on e.relationship_id = r.id and e.status <> 'void'
  where r.referrer_id = p_partner_id
  group by date_trunc('month', r.linked_at)::date
  on conflict (partner_id, month_start) do update set referral_count = excluded.referral_count,
    active_count = excluded.active_count, revenue = excluded.revenue, earnings = excluded.earnings, updated_at = now();

  insert into public.apn_referral_analytics_monthly (partner_id, month_start, conversion_rate, referral_count, active_count, revenue, earnings, updated_at)
  select partner_id, month_start,
    case when referral_count > 0 then round((active_count::numeric / referral_count::numeric) * 100, 2) else 0 end,
    referral_count, active_count, revenue, earnings, now()
  from public.apn_referral_monthly_summary where partner_id = p_partner_id
  on conflict (partner_id, month_start) do update set conversion_rate = excluded.conversion_rate,
    referral_count = excluded.referral_count, active_count = excluded.active_count,
    revenue = excluded.revenue, earnings = excluded.earnings, updated_at = now();
end;
$$;

create or replace function public.apn_referral_link_code(p_partner_id text, p_code text, p_source text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  code_row public.apn_referral_codes%rowtype;
  existing public.apn_referral_relationships%rowtype;
  relationship public.apn_referral_relationships%rowtype;
  referred_data jsonb;
begin
  if auth.uid()::text <> p_partner_id and not public.is_admin() then raise exception 'Referral linking access denied.' using errcode = 'insufficient_privilege'; end if;
  if p_partner_id is null or trim(p_code) = '' then raise exception 'A referral code is required.' using errcode = 'invalid_parameter_value'; end if;
  select data into referred_data from public.apn_users where id = p_partner_id;
  if referred_data is null then raise exception 'APN partner does not exist.' using errcode = 'foreign_key_violation'; end if;
  if coalesce(referred_data->>'status', 'pending') in ('suspended','deleted','rejected') then raise exception 'This partner cannot be linked to a referral.' using errcode = 'check_violation'; end if;
  select * into code_row from public.apn_referral_codes where lower(code) = lower(trim(p_code)) and active for update;
  if not found then raise exception 'That referral code is not valid.' using errcode = 'foreign_key_violation'; end if;
  if code_row.partner_id = p_partner_id then raise exception 'You cannot use your own referral code.' using errcode = 'check_violation'; end if;
  select * into existing from public.apn_referral_relationships where referred_id = p_partner_id;
  if found then
    if existing.referrer_id = code_row.partner_id then return jsonb_build_object('linked', true, 'relationshipId', existing.id, 'code', code_row.code, 'linkedAt', existing.linked_at); end if;
    raise exception 'This partner is already linked to a referral.' using errcode = 'unique_violation';
  end if;
  insert into public.apn_referral_relationships (referrer_id, referred_id, referral_code, linked_by)
  values (code_row.partner_id, p_partner_id, code_row.code, nullif(p_source, '')) returning * into relationship;
  update public.apn_users set data = jsonb_set(jsonb_set(data, '{referralCode}', to_jsonb(code_row.code), true), '{referralLinkedAt}', to_jsonb((extract(epoch from relationship.linked_at) * 1000)::bigint), true), updated_at = now() where id = p_partner_id;
  insert into public.apn_referral_timeline (partner_id, event_type, title, description, related_id, created_by)
  values (p_partner_id, 'referral-linked', 'Referral linked', 'Your direct referral relationship is now active.', relationship.id::text, 'Referral System'),
         (code_row.partner_id, 'referral-joined', 'New referral joined', 'A new partner joined using your referral code.', relationship.id::text, 'Referral System');
  insert into public.apn_referral_activities (partner_id, event_type, title, description, metadata)
  values (p_partner_id, 'referral-linked', 'Referral linked', 'Your direct referral relationship is now active.', jsonb_build_object('relationshipId', relationship.id)),
         (code_row.partner_id, 'referral-joined', 'New referral joined', 'A new partner joined using your referral code.', jsonb_build_object('relationshipId', relationship.id, 'referredId', p_partner_id));
  perform public.apn_referral_notify(code_row.partner_id, 'New referral joined', 'A new APN partner joined using your referral code.', 'referral-joined');
  perform public.apn_referral_audit('linked direct referral', p_partner_id, relationship.id::text, jsonb_build_object('referrerId', code_row.partner_id, 'source', p_source));
  perform public.apn_referral_ensure_code(p_partner_id);
  return jsonb_build_object('linked', true, 'relationshipId', relationship.id, 'code', code_row.code, 'linkedAt', relationship.linked_at);
end;
$$;

create or replace function public.apn_referral_rename_code(p_partner_id text, p_new_code text)
returns text language plpgsql security definer set search_path = public as $$
declare old_row public.apn_referral_codes%rowtype; clean text := trim(p_new_code);
begin
  if auth.uid()::text <> p_partner_id and not public.is_admin() then raise exception 'Referral code access denied.' using errcode = 'insufficient_privilege'; end if;
  if not public.apn_referral_code_available(clean, p_partner_id) then raise exception 'That referral code is unavailable. Use 4–20 letters, numbers, hyphens, or underscores.' using errcode = 'unique_violation'; end if;
  select * into old_row from public.apn_referral_codes where partner_id = p_partner_id for update;
  if not found then perform public.apn_referral_ensure_code(p_partner_id); select * into old_row from public.apn_referral_codes where partner_id = p_partner_id for update; end if;
  if old_row.rename_count >= 1 then raise exception 'Referral codes can only be renamed once.' using errcode = 'check_violation'; end if;
  update public.apn_referral_codes set code = upper(clean), rename_count = rename_count + 1, renamed_at = now() where partner_id = p_partner_id;
  update public.apn_referral_relationships set referral_code = upper(clean) where referrer_id = p_partner_id and status = 'active';
  perform public.apn_referral_audit('renamed referral code', p_partner_id, p_partner_id, jsonb_build_object('code', upper(clean)));
  return upper(clean);
end;
$$;

create or replace function public.apn_referral_collection_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  partner_id_value text := new.partner_id;
  collection_time timestamptz;
  relationship_row public.apn_referral_relationships%rowtype;
  settings_row public.apn_referral_settings%rowtype;
  revenue_value numeric;
  referral_value numeric;
begin
  if partner_id_value is null or trim(partner_id_value) = '' then return new; end if;
  collection_time := coalesce(new.created_at, new.received_date::timestamptz, new.updated_at, now());
  select * into relationship_row from public.apn_referral_relationships where referred_id = partner_id_value and status = 'active' and linked_at <= collection_time order by linked_at asc limit 1;
  if not found then return new; end if;
  select * into settings_row from public.apn_referral_settings where id = 1;
  if not coalesce(settings_row.enabled, true) then return new; end if;
  revenue_value := greatest(0, coalesce(new.received_amount, 0));
  if revenue_value <= 0 then return new; end if;
  referral_value := round(revenue_value * coalesce(settings_row.default_percent, 1) / 100, 2);
  if referral_value <= 0 then return new; end if;
  insert into public.apn_referral_earnings (relationship_id, referrer_id, referred_id, source_collection_id, project_id, revenue_amount, referral_percent, referral_amount, collection_at, snapshot)
  values (relationship_row.id, relationship_row.referrer_id, relationship_row.referred_id, new.id, new.project_id, revenue_value, settings_row.default_percent, referral_value, collection_time,
    jsonb_build_object('defaultPercent', settings_row.default_percent, 'enabled', settings_row.enabled, 'capturedAt', now(), 'collectionId', new.id))
  on conflict (source_collection_id) do nothing;
  perform public.apn_referral_notify(relationship_row.referrer_id, 'Referral earnings generated', format('%s referral earnings were generated from a new collection.', to_char(referral_value, 'FM999G999G990D00')), 'referral-earnings');
  perform public.apn_referral_audit('generated referral earnings', relationship_row.referrer_id, new.id, jsonb_build_object('amount', referral_value, 'percent', settings_row.default_percent, 'referredId', relationship_row.referred_id));
  return new;
end;
$$;

create or replace function public.apn_referral_earning_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.apn_referral_snapshots (earning_id, referral_percent, settings_enabled, snapshot)
  values (new.id, new.referral_percent, coalesce((new.snapshot->>'enabled')::boolean, true), new.snapshot)
  on conflict (earning_id) do nothing;
  if tg_op = 'INSERT' then
    insert into public.apn_referral_timeline (partner_id, event_type, title, description, related_id, created_by)
    values (new.referrer_id, 'referral-earned', 'Referral earnings generated', format('%s was generated at the %s%% snapshot rate.', to_char(new.referral_amount, 'FM999G999G990D00'), trim(to_char(new.referral_percent, 'FM999990D00'))), new.id::text, 'Referral System');
    insert into public.apn_referral_activities (partner_id, event_type, title, description, metadata)
    values (new.referrer_id, 'referral-earned', 'Referral earnings generated', 'A direct referral collection generated earnings.', jsonb_build_object('earningId', new.id, 'amount', new.referral_amount, 'percent', new.referral_percent));
  end if;
  perform public.apn_referral_refresh_wallet(new.referrer_id);
  return new;
end;
$$;

create or replace function public.apn_referral_withdrawal_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.apn_referral_refresh_wallet(coalesce(new.partner_id, old.partner_id));
  return new;
end;
$$;

create or replace function public.apn_referral_identity_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare supplied_code text := nullif(trim(new.data->>'referralCode'), '');
begin
  perform public.apn_referral_ensure_code(new.id);
  if supplied_code is not null then begin perform public.apn_referral_link_code(new.id, supplied_code, 'registration'); exception when others then null; end; end if;
  return new;
end;
$$;
drop trigger if exists apn_referral_identity_trg on public.apn_users;
create trigger apn_referral_identity_trg after insert on public.apn_users for each row execute function public.apn_referral_identity_after_insert();

drop trigger if exists apn_referral_collection_trg on public.apn_revenue_collections;
create trigger apn_referral_collection_trg after insert on public.apn_revenue_collections for each row execute function public.apn_referral_collection_after_insert();
drop trigger if exists apn_referral_earning_trg on public.apn_referral_earnings;
create trigger apn_referral_earning_trg after insert or update on public.apn_referral_earnings for each row execute function public.apn_referral_earning_after_change();
drop trigger if exists apn_referral_withdrawal_trg on public.apn_referral_withdrawals;
create trigger apn_referral_withdrawal_trg after insert or update or delete on public.apn_referral_withdrawals for each row execute function public.apn_referral_withdrawal_after_change();

create or replace function public.apn_referral_update_earning_status(p_earning_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_value public.apn_referral_earnings%rowtype;
begin
  if not public.is_admin() then raise exception 'Only an admin can update referral earnings.' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('approved','withdrawable','paid','void') then raise exception 'Invalid referral earning status.' using errcode = 'invalid_parameter_value'; end if;
  update public.apn_referral_earnings set status = p_status, approved_at = case when p_status in ('approved','withdrawable','paid') then coalesce(approved_at, now()) else approved_at end, paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end where id = p_earning_id returning * into row_value;
  if not found then raise exception 'Referral earning not found.' using errcode = 'no_data_found'; end if;
  insert into public.apn_referral_activities (partner_id, actor_id, event_type, title, description, metadata)
  values (row_value.referrer_id, auth.uid()::text, 'earning-status', 'Referral earning updated', coalesce(p_note, 'Referral earning marked ' || p_status || '.'), jsonb_build_object('earningId', p_earning_id, 'status', p_status));
  perform public.apn_referral_notify(row_value.referrer_id, 'Referral earning updated', 'A referral earning is now ' || p_status || '.', 'referral-earning-status');
  perform public.apn_referral_audit('updated referral earning status', row_value.referrer_id, p_earning_id::text, jsonb_build_object('status', p_status, 'note', p_note));
  return jsonb_build_object('id', row_value.id, 'status', row_value.status, 'amount', row_value.referral_amount);
end;
$$;

create or replace function public.apn_referral_request_withdrawal(p_partner_id text, p_amount numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare wallet_row public.apn_referral_wallets%rowtype; withdrawal_row public.apn_referral_withdrawals%rowtype;
begin
  if auth.uid()::text <> p_partner_id and not public.is_admin() then raise exception 'You cannot request a referral withdrawal for another partner.' using errcode = 'insufficient_privilege'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Withdrawal amount must be greater than zero.' using errcode = 'invalid_parameter_value'; end if;
  perform public.apn_referral_refresh_wallet(p_partner_id);
  select * into wallet_row from public.apn_referral_wallets where partner_id = p_partner_id for update;
  if coalesce(wallet_row.withdrawable, 0) < p_amount then raise exception 'The requested amount exceeds your withdrawable referral balance.' using errcode = 'check_violation'; end if;
  insert into public.apn_referral_withdrawals (partner_id, amount, note) values (p_partner_id, round(p_amount, 2), p_note) returning * into withdrawal_row;
  insert into public.apn_referral_timeline (partner_id, event_type, title, description, related_id, created_by) values (p_partner_id, 'withdrawal-requested', 'Referral withdrawal requested', format('Withdrawal request for %s was submitted.', to_char(p_amount, 'FM999G999G990D00')), withdrawal_row.id::text, p_partner_id);
  perform public.apn_referral_audit('requested referral withdrawal', p_partner_id, withdrawal_row.id::text, jsonb_build_object('amount', p_amount));
  return jsonb_build_object('id', withdrawal_row.id, 'status', withdrawal_row.status, 'amount', withdrawal_row.amount);
end;
$$;

create or replace function public.apn_referral_set_withdrawal_status(p_withdrawal_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_value public.apn_referral_withdrawals%rowtype;
begin
  if not public.is_admin() then raise exception 'Only an admin can review referral withdrawals.' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('approved','rejected','paid') then raise exception 'Invalid withdrawal status.' using errcode = 'invalid_parameter_value'; end if;
  update public.apn_referral_withdrawals set status = p_status, reviewed_at = coalesce(reviewed_at, now()), reviewed_by = auth.uid()::text, paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end, note = coalesce(p_note, note) where id = p_withdrawal_id returning * into row_value;
  if not found then raise exception 'Referral withdrawal not found.' using errcode = 'no_data_found'; end if;
  insert into public.apn_referral_timeline (partner_id, event_type, title, description, related_id, created_by) values (row_value.partner_id, 'withdrawal-' || p_status, 'Referral withdrawal ' || p_status, coalesce(p_note, 'Referral withdrawal status updated to ' || p_status || '.'), row_value.id::text, auth.uid()::text);
  perform public.apn_referral_notify(row_value.partner_id, 'Referral withdrawal ' || p_status, coalesce(p_note, 'Your referral withdrawal is now ' || p_status || '.'), 'referral-withdrawal');
  perform public.apn_referral_audit('updated referral withdrawal', row_value.partner_id, row_value.id::text, jsonb_build_object('status', p_status, 'amount', row_value.amount));
  return jsonb_build_object('id', row_value.id, 'status', row_value.status, 'amount', row_value.amount);
end;
$$;

create or replace function public.apn_referral_update_settings(p_enabled boolean, p_percent numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Only a Super Admin can change referral settings.' using errcode = 'insufficient_privilege'; end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then raise exception 'Referral percentage must be between 0 and 100.' using errcode = 'invalid_parameter_value'; end if;
  update public.apn_referral_settings set enabled = coalesce(p_enabled, true), default_percent = round(p_percent, 2), updated_at = now(), updated_by = auth.uid()::text where id = 1;
  perform public.apn_referral_audit('changed referral settings', auth.uid()::text, 'settings', jsonb_build_object('enabled', p_enabled, 'percent', p_percent));
  return (select to_jsonb(s) from public.apn_referral_settings s where id = 1);
end;
$$;

create or replace function public.apn_referral_set_relationship_status(p_relationship_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_value public.apn_referral_relationships%rowtype;
begin
  if not public.is_admin() then raise exception 'Only an admin can update referral relationships.' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('active','disabled') then raise exception 'Invalid referral relationship status.' using errcode = 'invalid_parameter_value'; end if;
  update public.apn_referral_relationships set status = p_status, disabled_at = case when p_status = 'disabled' then coalesce(disabled_at, now()) else null end where id = p_relationship_id returning * into row_value;
  if not found then raise exception 'Referral relationship not found.' using errcode = 'no_data_found'; end if;
  perform public.apn_referral_audit('updated referral relationship', row_value.referred_id, row_value.id::text, jsonb_build_object('status', p_status, 'note', p_note));
  return jsonb_build_object('id', row_value.id, 'status', row_value.status);
end;
$$;

create or replace function public.apn_referral_dashboard(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare wallet_row public.apn_referral_wallets%rowtype;
begin
  if auth.uid()::text <> p_partner_id and not public.is_admin() then raise exception 'Referral dashboard access denied.' using errcode = 'insufficient_privilege'; end if;
  perform public.apn_referral_ensure_code(p_partner_id);
  perform public.apn_referral_refresh_wallet(p_partner_id);
  select * into wallet_row from public.apn_referral_wallets where partner_id = p_partner_id;
  return jsonb_build_object(
    'wallet', to_jsonb(wallet_row),
    'totalReferrals', (select count(*) from public.apn_referral_relationships where referrer_id = p_partner_id),
    'activeReferrals', (select count(*) from public.apn_referral_relationships where referrer_id = p_partner_id and status = 'active'),
    'pendingReferrals', (select count(*) from public.apn_referral_relationships where referrer_id = p_partner_id and status = 'active' and exists (select 1 from public.apn_users u where u.id = referred_id and coalesce(u.data->>'status','pending') = 'pending'))
  );
end;
$$;

create or replace function public.apn_referral_network(p_partner_id text)
returns table (relationship_id uuid, referred_id text, referred_name text, referred_apn_id text, status text, linked_at timestamptz, revenue numeric, earnings numeric)
language sql security definer set search_path = public as $$
  select r.id, r.referred_id, coalesce(u.data->>'name', 'APN Partner'), u.data->>'apnId', r.status, r.linked_at,
    coalesce(sum(e.revenue_amount) filter (where e.status <> 'void'), 0), coalesce(sum(e.referral_amount) filter (where e.status <> 'void'), 0)
  from public.apn_referral_relationships r
  join public.apn_users u on u.id = r.referred_id
  left join public.apn_referral_earnings e on e.relationship_id = r.id
  where r.referrer_id = p_partner_id and (auth.uid()::text = p_partner_id or public.is_admin())
  group by r.id, r.referred_id, u.data, r.status, r.linked_at
  order by r.linked_at desc;
$$;

create or replace function public.apn_referral_leaderboard(p_period text default 'lifetime')
returns table (partner_id text, partner_name text, referral_count bigint, earnings numeric)
language sql security definer set search_path = public as $$
  select e.referrer_id, coalesce(u.data->>'name', 'APN Partner'), count(distinct e.referred_id), round(sum(e.referral_amount), 2)
  from public.apn_referral_earnings e
  join public.apn_users u on u.id = e.referrer_id
  where e.status <> 'void'
    and (lower(coalesce(p_period, 'lifetime')) = 'lifetime'
      or (lower(p_period) = 'monthly' and e.created_at >= date_trunc('month', now()))
      or (lower(p_period) = 'yearly' and e.created_at >= date_trunc('year', now())))
    and (public.is_admin() or auth.uid() is not null)
  group by e.referrer_id, u.data
  order by sum(e.referral_amount) desc, count(distinct e.referred_id) desc
  limit 50;
$$;

-- RLS: partners can read only their own wallet/history/network; admins can
-- review the entire referral system. Writes happen through audited RPCs.
do $$ declare t text; begin
  foreach t in array array['apn_referral_settings','apn_referral_codes','apn_referral_relationships','apn_referral_earnings','apn_referral_snapshots','apn_referral_wallets','apn_referral_withdrawals','apn_referral_timeline','apn_referral_activities','apn_referral_monthly_summary','apn_referral_analytics_monthly'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists apn_referral_settings_select on public.apn_referral_settings;
create policy apn_referral_settings_select on public.apn_referral_settings for select to authenticated using (true);
drop policy if exists apn_referral_codes_select on public.apn_referral_codes;
create policy apn_referral_codes_select on public.apn_referral_codes for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_relationships_select on public.apn_referral_relationships;
create policy apn_referral_relationships_select on public.apn_referral_relationships for select to authenticated using (referrer_id = auth.uid()::text or referred_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_earnings_select on public.apn_referral_earnings;
create policy apn_referral_earnings_select on public.apn_referral_earnings for select to authenticated using (referrer_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_snapshots_select on public.apn_referral_snapshots;
create policy apn_referral_snapshots_select on public.apn_referral_snapshots for select to authenticated using (exists (select 1 from public.apn_referral_earnings e where e.id = earning_id and (e.referrer_id = auth.uid()::text or public.is_admin())));
drop policy if exists apn_referral_wallets_select on public.apn_referral_wallets;
create policy apn_referral_wallets_select on public.apn_referral_wallets for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_withdrawals_select on public.apn_referral_withdrawals;
create policy apn_referral_withdrawals_select on public.apn_referral_withdrawals for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_timeline_select on public.apn_referral_timeline;
create policy apn_referral_timeline_select on public.apn_referral_timeline for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_activities_select on public.apn_referral_activities;
create policy apn_referral_activities_select on public.apn_referral_activities for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_monthly_select on public.apn_referral_monthly_summary;
create policy apn_referral_monthly_select on public.apn_referral_monthly_summary for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());
drop policy if exists apn_referral_analytics_select on public.apn_referral_analytics_monthly;
create policy apn_referral_analytics_select on public.apn_referral_analytics_monthly for select to authenticated using (partner_id = auth.uid()::text or public.is_admin());

revoke all on table public.apn_referral_settings, public.apn_referral_codes, public.apn_referral_relationships, public.apn_referral_earnings, public.apn_referral_snapshots, public.apn_referral_wallets, public.apn_referral_withdrawals, public.apn_referral_timeline, public.apn_referral_activities, public.apn_referral_monthly_summary, public.apn_referral_analytics_monthly from anon;
grant select on table public.apn_referral_settings, public.apn_referral_codes, public.apn_referral_relationships, public.apn_referral_earnings, public.apn_referral_snapshots, public.apn_referral_wallets, public.apn_referral_withdrawals, public.apn_referral_timeline, public.apn_referral_activities, public.apn_referral_monthly_summary, public.apn_referral_analytics_monthly to authenticated;
grant execute on function public.apn_referral_code_available(text, text), public.apn_referral_ensure_code(text), public.apn_referral_link_code(text, text, text), public.apn_referral_rename_code(text, text), public.apn_referral_dashboard(text), public.apn_referral_network(text), public.apn_referral_leaderboard(text), public.apn_referral_request_withdrawal(text, numeric, text), public.apn_referral_update_earning_status(uuid, text, text), public.apn_referral_set_withdrawal_status(uuid, text, text), public.apn_referral_update_settings(boolean, numeric), public.apn_referral_set_relationship_status(uuid, text, text) to authenticated;

-- Existing APN partners get a permanent code without changing their profile or
-- any historical commission/revenue row.
do $$ declare p record; begin
  for p in select id from public.apn_users loop perform public.apn_referral_ensure_code(p.id); end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['apn_referral_codes','apn_referral_relationships','apn_referral_earnings','apn_referral_snapshots','apn_referral_wallets','apn_referral_withdrawals','apn_referral_timeline','apn_referral_activities','apn_referral_monthly_summary','apn_referral_analytics_monthly'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

notify pgrst, 'reload schema';

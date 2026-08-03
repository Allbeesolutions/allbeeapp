-- ALLBEE APN Withdrawal & Settlement Engine (PR3)
-- Additive and safe to rerun. The engine never modifies source commission or
-- referral earnings: immutable wallet ledger rows and request locks preserve
-- source-of-truth history and prevent double spending.

begin;

create table if not exists public.apn_withdrawal_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null unique references public.apn_users(id) on delete restrict,
  account_holder text,
  bank_name text,
  account_number text,
  ifsc text,
  upi_id text,
  branch text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.apn_withdrawal_wallets (
  partner_id text not null references public.apn_users(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('commission','referral','incentive')),
  pending numeric(14,2) not null default 0 check (pending >= 0),
  approved numeric(14,2) not null default 0 check (approved >= 0),
  withdrawable numeric(14,2) not null default 0 check (withdrawable >= 0),
  locked numeric(14,2) not null default 0 check (locked >= 0),
  paid numeric(14,2) not null default 0 check (paid >= 0),
  lifetime numeric(14,2) not null default 0 check (lifetime >= 0),
  monthly numeric(14,2) not null default 0 check (monthly >= 0),
  today numeric(14,2) not null default 0 check (today >= 0),
  total_requested numeric(14,2) not null default 0 check (total_requested >= 0),
  total_approved numeric(14,2) not null default 0 check (total_approved >= 0),
  total_rejected numeric(14,2) not null default 0 check (total_rejected >= 0),
  total_processing numeric(14,2) not null default 0 check (total_processing >= 0),
  last_paid_at timestamptz,
  next_settlement_date date,
  updated_at timestamptz not null default now(),
  primary key (partner_id, wallet_type)
);

create table if not exists public.apn_withdrawal_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  status text not null default 'open' check (status in ('open','processing','completed','cancelled')),
  scheduled_for date not null default current_date,
  created_by text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  notes text
);

create table if not exists public.apn_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('commission','referral','incentive')),
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  approved_amount numeric(14,2) check (approved_amount > 0 and approved_amount <= requested_amount),
  preferred_method text not null check (preferred_method in ('upi','bank_transfer')),
  bank_account_id uuid references public.apn_withdrawal_bank_accounts(id) on delete restrict,
  bank_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','under_review','approved','processing','paid','rejected','cancelled','expired')),
  reason text,
  notes text,
  review_reason text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  processing_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  batch_id uuid references public.apn_withdrawal_batches(id) on delete restrict,
  settlement_reference text,
  updated_at timestamptz not null default now()
);

create table if not exists public.apn_withdrawal_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.apn_withdrawal_requests(id) on delete restrict,
  from_status text,
  to_status text not null,
  amount numeric(14,2) not null check (amount >= 0),
  reason text,
  notes text,
  actor_id text,
  actor_name text not null default 'Withdrawal System',
  actor_role text,
  created_at timestamptz not null default now()
);

create table if not exists public.apn_withdrawal_settlements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.apn_withdrawal_requests(id) on delete restrict,
  batch_id uuid references public.apn_withdrawal_batches(id) on delete restrict,
  partner_id text not null references public.apn_users(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('commission','referral','incentive')),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('upi','bank_transfer')),
  payment_reference text,
  paid_at timestamptz not null default now(),
  paid_by text,
  receipt_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.apn_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.apn_users(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('commission','referral','incentive')),
  request_id uuid references public.apn_withdrawal_requests(id) on delete restrict,
  entry_type text not null check (entry_type in ('lock','approval','release','processing','payment','reopen','override')),
  amount numeric(14,2) not null check (amount > 0),
  balance_effect text not null check (balance_effect in ('reserve','release','paid','none')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.apn_withdrawal_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.apn_withdrawal_requests(id) on delete restrict,
  settlement_id uuid references public.apn_withdrawal_settlements(id) on delete restrict,
  partner_id text not null references public.apn_users(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('commission','referral','incentive')),
  transaction_type text not null check (transaction_type in ('withdrawal_approved','withdrawal_paid','withdrawal_released')),
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now(),
  created_by text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.apn_withdrawal_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.apn_withdrawal_requests(id) on delete restrict,
  partner_id text references public.apn_users(id) on delete restrict,
  action text not null,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.apn_withdrawal_exports (
  id uuid primary key default gen_random_uuid(),
  exported_by text,
  format text not null check (format in ('csv','xlsx')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists apn_withdrawal_requests_partner_status_idx on public.apn_withdrawal_requests (partner_id, status, requested_at desc);
create index if not exists apn_withdrawal_requests_status_requested_idx on public.apn_withdrawal_requests (status, requested_at desc);
create index if not exists apn_withdrawal_requests_batch_idx on public.apn_withdrawal_requests (batch_id, status);
create index if not exists apn_withdrawal_history_request_idx on public.apn_withdrawal_status_history (request_id, created_at desc);
create index if not exists apn_withdrawal_settlements_partner_paid_idx on public.apn_withdrawal_settlements (partner_id, paid_at desc);
create index if not exists apn_wallet_transactions_partner_idx on public.apn_wallet_transactions (partner_id, wallet_type, created_at desc);
create index if not exists apn_withdrawal_audit_partner_idx on public.apn_withdrawal_audit (partner_id, created_at desc);
create index if not exists apn_withdrawal_batches_status_idx on public.apn_withdrawal_batches (status, scheduled_for desc);

create or replace function public.apn_withdrawal_can_manage()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or public.can_finance();
$$;

create or replace function public.apn_withdrawal_actor_role()
returns text language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'system');
$$;

create or replace function public.apn_withdrawal_request_amount(p_requested numeric, p_approved numeric, p_status text)
returns numeric language sql immutable as $$
  select case when p_status in ('pending','under_review','approved','processing','paid') then round(coalesce(p_approved, p_requested), 2) else 0 end;
$$;

create or replace function public.apn_withdrawal_next_settlement_date()
returns date language sql stable as $$
  select current_date + (8 - extract(isodow from current_date)::integer);
$$;

create or replace function public.apn_withdrawal_partner_is_active(p_partner_id text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.apn_users u
    where u.id = p_partner_id and coalesce(u.data->>'status', 'pending') = 'active'
  );
$$;

create or replace function public.apn_withdrawal_audit_event(p_action text, p_partner_id text, p_request_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := 'withdrawal-audit:' || gen_random_uuid()::text;
begin
  perform set_config('row_security', 'off', true);
  insert into public.apn_withdrawal_audit (request_id, partner_id, action, actor_id, metadata)
  values (p_request_id, p_partner_id, p_action, auth.uid()::text, coalesce(p_metadata, '{}'::jsonb));
  insert into public.audit (id, data, updated_at)
  values (v_id, jsonb_build_object(
    'id', v_id, 'ts', (extract(epoch from now()) * 1000)::bigint,
    'user', coalesce(public.current_name(), 'Withdrawal System'), 'userId', auth.uid()::text,
    'action', p_action, 'module', 'APN', 'entity', 'APN Withdrawal',
    'entityId', coalesce(p_request_id::text, p_partner_id), 'partnerId', p_partner_id,
    'metadata', coalesce(p_metadata, '{}'::jsonb)
  ), now()) on conflict (id) do nothing;
end;
$$;

create or replace function public.apn_withdrawal_notify(p_partner_id text, p_title text, p_body text, p_priority text default 'Normal', p_event_type text default 'withdrawal')
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := 'withdrawal-notification:' || gen_random_uuid()::text;
begin
  insert into public.apn_notifications (id, data, updated_at)
  values (v_id, jsonb_build_object(
    'id', v_id, 'title', p_title, 'body', p_body, 'audience', 'partner:' || p_partner_id,
    'partnerId', p_partner_id, 'level', 'Withdrawal', 'priority', p_priority, 'eventType', p_event_type,
    'senderName', 'ALLBEE Finance', 'senderDesignation', 'Settlement Engine', 'senderRole', 'Finance', 'senderAvatar', '/allbee-icon.png',
    'createdAt', (extract(epoch from now()) * 1000)::bigint, 'createdDate', to_char(now(), 'YYYY-MM-DD'),
    'createdTime', to_char(now(), 'HH24:MI:SS'), 'reads', '[]'::jsonb
  ), now()) on conflict (id) do nothing;
  insert into public.notifications (id, data, updated_at)
  values (v_id, jsonb_build_object(
    'id', v_id, 'title', p_title, 'body', p_body, 'audience', 'partner:' || p_partner_id,
    'partnerId', p_partner_id, 'module', 'APN', 'priority', p_priority, 'eventType', p_event_type,
    'senderName', 'ALLBEE Finance', 'senderDesignation', 'Settlement Engine', 'senderRole', 'Finance', 'senderAvatar', '/allbee-icon.png',
    'createdAt', (extract(epoch from now()) * 1000)::bigint, 'reads', '[]'::jsonb
  ), now()) on conflict (id) do nothing;
end;
$$;

create or replace function public.apn_withdrawal_add_timeline(p_request public.apn_withdrawal_requests, p_title text, p_description text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := 'withdrawal-timeline:' || gen_random_uuid()::text;
begin
  insert into public.apn_timeline (id, data, updated_at)
  values (v_id, jsonb_build_object(
    'id', v_id, 'partnerId', p_request.partner_id, 'eventType', 'withdrawal-' || p_request.status,
    'title', p_title, 'description', p_description, 'relatedId', p_request.id::text,
    'performedBy', coalesce(public.current_name(), 'Withdrawal System'), 'performedById', auth.uid()::text,
    'createdAt', (extract(epoch from now()) * 1000)::bigint
  ), now()) on conflict (id) do nothing;
end;
$$;

create or replace function public.apn_withdrawal_source_totals(p_partner_id text, p_wallet_type text)
returns table (pending numeric, approved numeric, withdrawable numeric, external_paid numeric, lifetime numeric, monthly numeric, today numeric)
language plpgsql security definer set search_path = public as $$
begin
  if p_wallet_type = 'referral' then
    return query
    select
      coalesce(sum(e.referral_amount) filter (where e.status = 'pending'), 0),
      coalesce(sum(e.referral_amount) filter (where e.status = 'approved'), 0),
      coalesce(sum(e.referral_amount) filter (where e.status = 'withdrawable'), 0),
      coalesce(sum(e.referral_amount) filter (where e.status = 'paid'), 0)
        + coalesce((select sum(w.amount) from public.apn_referral_withdrawals w where w.partner_id = p_partner_id and w.status = 'paid'), 0),
      coalesce(sum(e.referral_amount) filter (where e.status <> 'void'), 0),
      coalesce(sum(e.referral_amount) filter (where e.status <> 'void' and e.created_at >= date_trunc('month', now())), 0),
      coalesce(sum(e.referral_amount) filter (where e.status <> 'void' and e.collection_at >= current_date), 0)
    from public.apn_referral_earnings e where e.referrer_id = p_partner_id;
  elsif p_wallet_type = 'incentive' then
    return query
    select
      coalesce(sum(c.incentive) filter (where c.commission_status = 'Pending'), 0),
      coalesce(sum(c.incentive) filter (where c.commission_status = 'Approved'), 0),
      coalesce(sum(c.incentive) filter (where c.commission_status = 'Payable'), 0),
      coalesce(sum(c.incentive) filter (where c.commission_status = 'Paid'), 0),
      coalesce(sum(c.incentive), 0),
      coalesce(sum(c.incentive) filter (where c.created_at >= date_trunc('month', now())), 0),
      coalesce(sum(c.incentive) filter (where c.received_date = current_date), 0)
    from public.apn_revenue_collections c where c.partner_id = p_partner_id;
  else
    return query
    with v4 as (
      select
        coalesce(sum(c.commission_generated) filter (where c.commission_status = 'Pending'), 0) pending,
        coalesce(sum(c.commission_generated) filter (where c.commission_status = 'Approved'), 0) approved,
        coalesce(sum(c.commission_generated) filter (where c.commission_status = 'Payable'), 0) withdrawable,
        coalesce(sum(c.commission_generated) filter (where c.commission_status = 'Paid'), 0) external_paid,
        coalesce(sum(c.commission_generated), 0) lifetime,
        coalesce(sum(c.commission_generated) filter (where c.created_at >= date_trunc('month', now())), 0) monthly,
        coalesce(sum(c.commission_generated) filter (where c.received_date = current_date), 0) today
      from public.apn_revenue_collections c where c.partner_id = p_partner_id
    ), legacy_rows as (
      select
        coalesce(data->>'status', 'Pending') as status,
        case when coalesce(data->>'amount','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (data->>'amount')::numeric else 0 end as amount,
        case when coalesce(data->>'createdAt','') ~ '^[0-9]+$' then to_timestamp((data->>'createdAt')::numeric / 1000) end as created_at
      from public.apn_commissions where data->>'partnerId' = p_partner_id and coalesce(data->>'kind','partner') <> 'district'
    ), legacy as (
      select
        coalesce(sum(amount) filter (where status = 'Pending'), 0) pending,
        coalesce(sum(amount) filter (where status = 'Approved'), 0) approved,
        coalesce(sum(amount) filter (where status = 'Payable'), 0) withdrawable,
        coalesce(sum(amount) filter (where status = 'Paid'), 0) external_paid,
        coalesce(sum(amount), 0) lifetime,
        coalesce(sum(amount) filter (where created_at >= date_trunc('month', now())), 0) monthly,
        coalesce(sum(amount) filter (where created_at::date = current_date), 0) today
      from legacy_rows
    )
    select v4.pending + legacy.pending, v4.approved + legacy.approved, v4.withdrawable + legacy.withdrawable,
      v4.external_paid + legacy.external_paid, v4.lifetime + legacy.lifetime, v4.monthly + legacy.monthly, v4.today + legacy.today
    from v4 cross join legacy;
  end if;
end;
$$;

create or replace function public.apn_withdrawal_refresh_wallet(p_partner_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_type text; s record; v_reserved numeric; v_locked numeric; v_paid numeric; v_requested numeric; v_approved numeric; v_rejected numeric; v_processing numeric; v_external_legacy_reserved numeric := 0; v_external_legacy_paid numeric := 0;
begin
  foreach v_type in array array['commission','referral','incentive'] loop
    select * into s from public.apn_withdrawal_source_totals(p_partner_id, v_type);
    select
      coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing','paid')), 0),
      coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status in ('pending','under_review','approved','processing')), 0),
      coalesce(sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) filter (where status = 'paid'), 0),
      coalesce(sum(requested_amount), 0),
      coalesce(sum(coalesce(approved_amount, requested_amount)) filter (where status in ('approved','processing','paid')), 0),
      coalesce(sum(requested_amount) filter (where status = 'rejected'), 0),
      coalesce(sum(coalesce(approved_amount, requested_amount)) filter (where status = 'processing'), 0)
    into v_reserved, v_locked, v_paid, v_requested, v_approved, v_rejected, v_processing
    from public.apn_withdrawal_requests where partner_id = p_partner_id and wallet_type = v_type;
    if v_type = 'referral' then
      select coalesce(sum(amount) filter (where status in ('pending','approved')), 0), coalesce(sum(amount) filter (where status = 'paid'), 0)
      into v_external_legacy_reserved, v_external_legacy_paid
      from public.apn_referral_withdrawals where partner_id = p_partner_id;
    else
      v_external_legacy_reserved := 0; v_external_legacy_paid := 0;
    end if;
    insert into public.apn_withdrawal_wallets (
      partner_id, wallet_type, pending, approved, withdrawable, locked, paid, lifetime, monthly, today,
      total_requested, total_approved, total_rejected, total_processing, last_paid_at, next_settlement_date, updated_at
    ) values (
      p_partner_id, v_type, round(s.pending,2), round(s.approved,2), round(greatest(0, s.withdrawable - v_reserved - v_external_legacy_reserved),2),
      round(v_locked + v_external_legacy_reserved,2), round(s.external_paid + v_paid,2), round(s.lifetime,2), round(s.monthly,2), round(s.today,2),
      round(v_requested,2), round(v_approved,2), round(v_rejected,2), round(v_processing,2),
      (select max(paid_at) from public.apn_withdrawal_requests where partner_id = p_partner_id and wallet_type = v_type and status = 'paid'),
      public.apn_withdrawal_next_settlement_date(), now()
    ) on conflict (partner_id, wallet_type) do update set
      pending = excluded.pending, approved = excluded.approved, withdrawable = excluded.withdrawable, locked = excluded.locked,
      paid = excluded.paid, lifetime = excluded.lifetime, monthly = excluded.monthly, today = excluded.today,
      total_requested = excluded.total_requested, total_approved = excluded.total_approved, total_rejected = excluded.total_rejected,
      total_processing = excluded.total_processing, last_paid_at = excluded.last_paid_at,
      next_settlement_date = excluded.next_settlement_date, updated_at = now();
  end loop;
end;
$$;

create or replace function public.apn_withdrawal_refresh_from_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.apn_withdrawal_refresh_wallet(old.partner_id);
    if old.wallet_type = 'referral' then perform public.apn_referral_refresh_wallet(old.partner_id); end if;
    return old;
  end if;
  perform public.apn_withdrawal_refresh_wallet(new.partner_id);
  if new.wallet_type = 'referral' then perform public.apn_referral_refresh_wallet(new.partner_id); end if;
  return new;
end;
$$;

create or replace function public.apn_withdrawal_refresh_from_collection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.partner_id is not null then perform public.apn_withdrawal_refresh_wallet(old.partner_id); end if;
    return old;
  end if;
  if new.partner_id is not null then perform public.apn_withdrawal_refresh_wallet(new.partner_id); end if;
  return new;
end;
$$;

create or replace function public.apn_withdrawal_refresh_from_referral_earning()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.apn_withdrawal_refresh_wallet(old.referrer_id);
    return old;
  end if;
  perform public.apn_withdrawal_refresh_wallet(new.referrer_id);
  return new;
end;
$$;

drop trigger if exists apn_withdrawal_request_wallet_trg on public.apn_withdrawal_requests;
create trigger apn_withdrawal_request_wallet_trg after insert or update or delete on public.apn_withdrawal_requests
for each row execute function public.apn_withdrawal_refresh_from_request();
drop trigger if exists apn_withdrawal_collection_wallet_trg on public.apn_revenue_collections;
create trigger apn_withdrawal_collection_wallet_trg after insert or update or delete on public.apn_revenue_collections
for each row execute function public.apn_withdrawal_refresh_from_collection();
drop trigger if exists apn_withdrawal_referral_wallet_trg on public.apn_referral_earnings;
create trigger apn_withdrawal_referral_wallet_trg after insert or update or delete on public.apn_referral_earnings
for each row execute function public.apn_withdrawal_refresh_from_referral_earning();

create or replace function public.apn_withdrawal_prevent_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Withdrawal ledger and audit records are immutable.' using errcode = 'insufficient_privilege';
end;
$$;
do $$ declare t text; begin
  foreach t in array array['apn_withdrawal_status_history','apn_withdrawal_settlements','apn_wallet_transactions','apn_withdrawal_finance_transactions','apn_withdrawal_audit','apn_withdrawal_exports'] loop
    execute format('drop trigger if exists apn_withdrawal_immutable_trg on public.%I', t);
    execute format('create trigger apn_withdrawal_immutable_trg before update or delete on public.%I for each row execute function public.apn_withdrawal_prevent_mutation()', t);
  end loop;
end $$;

create or replace function public.apn_upsert_withdrawal_bank_account(
  p_partner_id text, p_account_holder text, p_bank_name text, p_account_number text,
  p_confirm_account_number text, p_ifsc text, p_upi_id text, p_branch text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.apn_withdrawal_bank_accounts%rowtype; v_previous jsonb;
begin
  if auth.uid()::text <> p_partner_id and not public.apn_withdrawal_can_manage() then raise exception 'Bank details access denied.' using errcode = 'insufficient_privilege'; end if;
  if not public.apn_withdrawal_partner_is_active(p_partner_id) then raise exception 'Only active APN partners can save bank details.' using errcode = 'check_violation'; end if;
  if nullif(trim(coalesce(p_account_number,'')), '') is not null and trim(coalesce(p_account_number,'')) <> trim(coalesce(p_confirm_account_number,'')) then raise exception 'Account number confirmation does not match.' using errcode = 'check_violation'; end if;
  if nullif(trim(coalesce(p_upi_id,'')), '') is null and (nullif(trim(coalesce(p_account_holder,'')), '') is null or nullif(trim(coalesce(p_bank_name,'')), '') is null or nullif(trim(coalesce(p_account_number,'')), '') is null or nullif(trim(coalesce(p_ifsc,'')), '') is null) then
    raise exception 'Provide a UPI ID or complete bank transfer details.' using errcode = 'check_violation';
  end if;
  select to_jsonb(b) into v_previous from public.apn_withdrawal_bank_accounts b where b.partner_id = p_partner_id;
  insert into public.apn_withdrawal_bank_accounts (partner_id, account_holder, bank_name, account_number, ifsc, upi_id, branch, verification_status, active, updated_at, updated_by)
  values (p_partner_id, nullif(trim(p_account_holder),''), nullif(trim(p_bank_name),''), nullif(trim(p_account_number),''), upper(nullif(trim(p_ifsc),'')), lower(nullif(trim(p_upi_id),'')), nullif(trim(p_branch),''), 'pending', true, now(), auth.uid()::text)
  on conflict (partner_id) do update set account_holder = excluded.account_holder, bank_name = excluded.bank_name, account_number = excluded.account_number,
    ifsc = excluded.ifsc, upi_id = excluded.upi_id, branch = excluded.branch, verification_status = 'pending', active = true, updated_at = now(), updated_by = auth.uid()::text
  returning * into v_row;
  insert into public.apn_timeline (id, data, updated_at)
  values ('withdrawal-bank-timeline:' || gen_random_uuid()::text, jsonb_build_object(
    'partnerId', p_partner_id, 'eventType', 'withdrawal-bank-details', 'title', 'Payout details updated',
    'description', 'Bank or UPI payout details were updated and require verification.', 'performedBy', coalesce(public.current_name(), 'APN Partner'),
    'performedById', auth.uid()::text, 'createdAt', (extract(epoch from now()) * 1000)::bigint
  ), now());
  perform public.apn_withdrawal_audit_event('updated withdrawal bank details', p_partner_id, null, jsonb_build_object('changed', true, 'hadPreviousDetails', v_previous is not null));
  perform public.apn_withdrawal_notify(p_partner_id, 'Payout details updated', 'Your bank or UPI payout details were updated and are pending verification.', 'Normal', 'withdrawal-bank-updated');
  return jsonb_build_object('id', v_row.id, 'verificationStatus', v_row.verification_status, 'active', v_row.active);
end;
$$;

create or replace function public.apn_request_withdrawal(
  p_wallet_type text, p_amount numeric, p_preferred_method text, p_reason text default null, p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_partner text := auth.uid()::text; v_wallet public.apn_withdrawal_wallets%rowtype; v_bank public.apn_withdrawal_bank_accounts%rowtype; v_request public.apn_withdrawal_requests%rowtype; v_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if v_partner is null then raise exception 'Sign in to request a withdrawal.' using errcode = 'insufficient_privilege'; end if;
  if p_wallet_type not in ('commission','referral','incentive') then raise exception 'Choose a valid wallet type.' using errcode = 'invalid_parameter_value'; end if;
  if p_preferred_method not in ('upi','bank_transfer') then raise exception 'Choose UPI or bank transfer.' using errcode = 'invalid_parameter_value'; end if;
  if v_amount <= 0 then raise exception 'Withdrawal amount must be greater than zero.' using errcode = 'check_violation'; end if;
  if not public.apn_withdrawal_partner_is_active(v_partner) then raise exception 'Only active APN partners can request a withdrawal.' using errcode = 'check_violation'; end if;
  select * into v_bank from public.apn_withdrawal_bank_accounts where partner_id = v_partner and active for update;
  if not found then raise exception 'Add your bank or UPI details before requesting a withdrawal.' using errcode = 'check_violation'; end if;
  if p_preferred_method = 'upi' and nullif(v_bank.upi_id,'') is null then raise exception 'Add a UPI ID before selecting UPI payout.' using errcode = 'check_violation'; end if;
  if p_preferred_method = 'bank_transfer' and (nullif(v_bank.account_holder,'') is null or nullif(v_bank.bank_name,'') is null or nullif(v_bank.account_number,'') is null or nullif(v_bank.ifsc,'') is null) then raise exception 'Complete bank details before selecting bank transfer.' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.apn_withdrawal_requests where partner_id = v_partner and wallet_type = p_wallet_type and status in ('pending','under_review','approved','processing') and requested_amount = v_amount) then raise exception 'An identical withdrawal is already being processed.' using errcode = 'unique_violation'; end if;
  perform public.apn_withdrawal_refresh_wallet(v_partner);
  select * into v_wallet from public.apn_withdrawal_wallets where partner_id = v_partner and wallet_type = p_wallet_type for update;
  if coalesce(v_wallet.withdrawable, 0) < v_amount then raise exception 'The request exceeds your withdrawable %s balance.', p_wallet_type using errcode = 'check_violation'; end if;
  insert into public.apn_withdrawal_requests (partner_id, wallet_type, requested_amount, preferred_method, bank_account_id, bank_snapshot, reason, notes, expires_at)
  values (v_partner, p_wallet_type, v_amount, p_preferred_method, v_bank.id,
    jsonb_build_object('accountHolder', v_bank.account_holder, 'bankName', v_bank.bank_name, 'accountNumberLast4', right(coalesce(v_bank.account_number,''), 4), 'ifsc', v_bank.ifsc, 'upiId', v_bank.upi_id, 'branch', v_bank.branch, 'verificationStatus', v_bank.verification_status),
    nullif(trim(p_reason),''), nullif(trim(p_notes),''), now() + interval '30 days') returning * into v_request;
  insert into public.apn_withdrawal_status_history (request_id, to_status, amount, reason, notes, actor_id, actor_name, actor_role)
  values (v_request.id, 'pending', v_amount, v_request.reason, v_request.notes, v_partner, coalesce(public.current_name(),'APN Partner'), public.apn_withdrawal_actor_role());
  insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by)
  values (v_partner, p_wallet_type, v_request.id, 'lock', v_amount, 'reserve', 'Withdrawal request reserved wallet funds.', v_partner);
  perform public.apn_withdrawal_add_timeline(v_request, 'Withdrawal submitted', format('%s %s withdrawal was submitted for review.', to_char(v_amount, 'FM999G999G990D00'), initcap(p_wallet_type)));
  perform public.apn_withdrawal_notify(v_partner, 'Withdrawal submitted', format('Your %s withdrawal request for %s is pending review.', p_wallet_type, to_char(v_amount, 'FM999G999G990D00')), 'Normal', 'withdrawal-submitted');
  perform public.apn_withdrawal_audit_event('submitted withdrawal request', v_partner, v_request.id, jsonb_build_object('walletType', p_wallet_type, 'amount', v_amount, 'method', p_preferred_method));
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'amount', v_request.requested_amount);
end;
$$;

create or replace function public.apn_set_withdrawal_bank_verification(p_partner_id text, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.apn_withdrawal_bank_accounts%rowtype;
begin
  if not public.apn_withdrawal_can_manage() then raise exception 'Bank verification access denied.' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('pending','verified','rejected') then raise exception 'Invalid bank verification status.' using errcode = 'invalid_parameter_value'; end if;
  update public.apn_withdrawal_bank_accounts set verification_status = p_status, updated_at = now(), updated_by = auth.uid()::text where partner_id = p_partner_id returning * into v_row;
  if not found then raise exception 'Bank details not found.' using errcode = 'no_data_found'; end if;
  perform public.apn_withdrawal_audit_event('updated bank verification', p_partner_id, null, jsonb_build_object('status', p_status, 'note', p_note));
  perform public.apn_withdrawal_notify(p_partner_id, 'Payout details ' || p_status, coalesce(p_note, 'Your payout details are now ' || p_status || '.'), case when p_status = 'rejected' then 'High' else 'Normal' end, 'withdrawal-bank-' || p_status);
  return jsonb_build_object('partnerId', v_row.partner_id, 'verificationStatus', v_row.verification_status);
end;
$$;

create or replace function public.apn_withdrawal_review(
  p_request_id uuid, p_action text, p_approved_amount numeric default null, p_reason text default null, p_notes text default null, p_batch_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.apn_withdrawal_requests%rowtype; v_old_status text; v_old_amount numeric; v_amount numeric; v_settlement public.apn_withdrawal_settlements%rowtype; v_title text; v_description text;
begin
  if p_action not in ('under_review','approved','rejected','processing','paid','cancelled','expired') then raise exception 'Invalid withdrawal action.' using errcode = 'invalid_parameter_value'; end if;
  select * into v_request from public.apn_withdrawal_requests where id = p_request_id for update;
  if not found then raise exception 'Withdrawal request not found.' using errcode = 'no_data_found'; end if;
  if not public.apn_withdrawal_can_manage() and not (p_action = 'cancelled' and auth.uid()::text = v_request.partner_id) then raise exception 'Withdrawal review access denied.' using errcode = 'insufficient_privilege'; end if;
  v_old_status := v_request.status; v_old_amount := public.apn_withdrawal_request_amount(v_request.requested_amount, v_request.approved_amount, v_request.status);
  if p_action = 'under_review' and v_old_status <> 'pending' then raise exception 'Only pending requests can enter review.' using errcode = 'check_violation'; end if;
  if p_action = 'approved' and v_old_status not in ('pending','under_review') then raise exception 'Only pending or under-review requests can be approved.' using errcode = 'check_violation'; end if;
  if p_action = 'rejected' and v_old_status not in ('pending','under_review','approved') then raise exception 'Processing or paid requests cannot be rejected.' using errcode = 'check_violation'; end if;
  if p_action = 'processing' and v_old_status <> 'approved' then raise exception 'Only approved requests can be marked processing.' using errcode = 'check_violation'; end if;
  if p_action = 'paid' and v_old_status <> 'processing' then raise exception 'Only processing requests can be marked paid.' using errcode = 'check_violation'; end if;
  if p_action in ('cancelled','expired') and v_old_status not in ('pending','under_review','approved') then raise exception 'Only unprocessed requests can be released.' using errcode = 'check_violation'; end if;
  if p_action = 'approved' then
    v_amount := round(coalesce(p_approved_amount, v_request.requested_amount), 2);
    if v_amount <= 0 or v_amount > v_request.requested_amount then raise exception 'Approved amount must be greater than zero and cannot exceed the requested amount.' using errcode = 'check_violation'; end if;
    update public.apn_withdrawal_requests set status = 'approved', approved_amount = v_amount, review_reason = nullif(trim(p_reason),''), notes = coalesce(nullif(trim(p_notes),''), notes), reviewed_at = now(), reviewed_by = auth.uid()::text, updated_at = now() where id = p_request_id returning * into v_request;
    if v_old_amount > v_amount then insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'release', v_old_amount - v_amount, 'release', 'Partial approval released the unapproved balance.', auth.uid()::text); end if;
    insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'approval', v_amount, 'none', 'Withdrawal approved for settlement.', auth.uid()::text);
    insert into public.apn_withdrawal_finance_transactions (request_id, partner_id, wallet_type, transaction_type, amount, reference, created_by, metadata) values (v_request.id, v_request.partner_id, v_request.wallet_type, 'withdrawal_approved', v_amount, v_request.id::text, auth.uid()::text, jsonb_build_object('requestedAmount', v_request.requested_amount));
    v_title := 'Withdrawal approved'; v_description := format('%s %s is approved for settlement.', to_char(v_amount, 'FM999G999G990D00'), initcap(v_request.wallet_type));
  elsif p_action = 'processing' then
    if p_batch_id is not null and not exists (select 1 from public.apn_withdrawal_batches where id = p_batch_id and status in ('open','processing')) then raise exception 'Settlement batch is unavailable.' using errcode = 'foreign_key_violation'; end if;
    update public.apn_withdrawal_requests set status = 'processing', batch_id = coalesce(p_batch_id, batch_id), review_reason = coalesce(nullif(trim(p_reason),''), review_reason), notes = coalesce(nullif(trim(p_notes),''), notes), processing_at = now(), reviewed_at = coalesce(reviewed_at, now()), reviewed_by = coalesce(reviewed_by, auth.uid()::text), updated_at = now() where id = p_request_id returning * into v_request;
    insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'processing', v_old_amount, 'none', 'Withdrawal queued for payment processing.', auth.uid()::text);
    v_title := 'Withdrawal processing'; v_description := format('%s %s is being processed.', to_char(v_old_amount, 'FM999G999G990D00'), initcap(v_request.wallet_type));
  elsif p_action = 'paid' then
    update public.apn_withdrawal_requests set status = 'paid', settlement_reference = coalesce(nullif(trim(p_notes),''), settlement_reference), paid_at = now(), reviewed_at = coalesce(reviewed_at, now()), reviewed_by = coalesce(reviewed_by, auth.uid()::text), updated_at = now() where id = p_request_id returning * into v_request;
    insert into public.apn_withdrawal_settlements (request_id, batch_id, partner_id, wallet_type, amount, payment_method, payment_reference, paid_by, receipt_snapshot)
    values (v_request.id, v_request.batch_id, v_request.partner_id, v_request.wallet_type, v_old_amount, v_request.preferred_method, v_request.settlement_reference, auth.uid()::text, v_request.bank_snapshot)
    returning * into v_settlement;
    insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'payment', v_old_amount, 'paid', 'Withdrawal payment settled.', auth.uid()::text);
    insert into public.apn_withdrawal_finance_transactions (request_id, settlement_id, partner_id, wallet_type, transaction_type, amount, reference, created_by, metadata) values (v_request.id, v_settlement.id, v_request.partner_id, v_request.wallet_type, 'withdrawal_paid', v_old_amount, coalesce(v_request.settlement_reference, v_settlement.id::text), auth.uid()::text, jsonb_build_object('method', v_request.preferred_method));
    v_title := 'Withdrawal paid'; v_description := format('%s %s was paid via %s.', to_char(v_old_amount, 'FM999G999G990D00'), initcap(v_request.wallet_type), replace(v_request.preferred_method, '_', ' '));
  elsif p_action in ('rejected','cancelled','expired') then
    update public.apn_withdrawal_requests set status = p_action, review_reason = nullif(trim(p_reason),''), notes = coalesce(nullif(trim(p_notes),''), notes), reviewed_at = case when p_action = 'rejected' then now() else reviewed_at end, reviewed_by = case when p_action = 'rejected' then auth.uid()::text else reviewed_by end, cancelled_at = case when p_action = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = p_request_id returning * into v_request;
    insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'release', v_old_amount, 'release', 'Withdrawal lock released: ' || p_action || '.', auth.uid()::text);
    insert into public.apn_withdrawal_finance_transactions (request_id, partner_id, wallet_type, transaction_type, amount, reference, created_by, metadata) values (v_request.id, v_request.partner_id, v_request.wallet_type, 'withdrawal_released', v_old_amount, v_request.id::text, auth.uid()::text, jsonb_build_object('status', p_action));
    v_title := 'Withdrawal ' || p_action; v_description := format('%s %s was %s and the wallet lock was released.', to_char(v_old_amount, 'FM999G999G990D00'), initcap(v_request.wallet_type), p_action);
  else
    update public.apn_withdrawal_requests set status = 'under_review', review_reason = nullif(trim(p_reason),''), notes = coalesce(nullif(trim(p_notes),''), notes), reviewed_at = now(), reviewed_by = auth.uid()::text, updated_at = now() where id = p_request_id returning * into v_request;
    v_title := 'Withdrawal under review'; v_description := format('%s %s is under review.', to_char(v_old_amount, 'FM999G999G990D00'), initcap(v_request.wallet_type));
  end if;
  insert into public.apn_withdrawal_status_history (request_id, from_status, to_status, amount, reason, notes, actor_id, actor_name, actor_role) values (v_request.id, v_old_status, v_request.status, coalesce(v_request.approved_amount, v_request.requested_amount), v_request.review_reason, v_request.notes, auth.uid()::text, coalesce(public.current_name(),'Withdrawal System'), public.apn_withdrawal_actor_role());
  perform public.apn_withdrawal_add_timeline(v_request, v_title, v_description);
  perform public.apn_withdrawal_notify(v_request.partner_id, v_title, v_description, case when v_request.status in ('rejected','cancelled','expired') then 'High' else 'Normal' end, 'withdrawal-' || v_request.status);
  perform public.apn_withdrawal_audit_event('withdrawal ' || v_request.status, v_request.partner_id, v_request.id, jsonb_build_object('from', v_old_status, 'to', v_request.status, 'amount', coalesce(v_request.approved_amount, v_request.requested_amount), 'reason', v_request.review_reason));
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'amount', coalesce(v_request.approved_amount, v_request.requested_amount));
end;
$$;

create or replace function public.apn_approve_withdrawal(p_request_id uuid, p_approved_amount numeric default null, p_reason text default null, p_notes text default null)
returns jsonb language sql security definer set search_path = public as $$ select public.apn_withdrawal_review(p_request_id, 'approved', p_approved_amount, p_reason, p_notes, null); $$;
create or replace function public.apn_reject_withdrawal(p_request_id uuid, p_reason text default null, p_notes text default null)
returns jsonb language sql security definer set search_path = public as $$ select public.apn_withdrawal_review(p_request_id, 'rejected', null, p_reason, p_notes, null); $$;
create or replace function public.apn_mark_withdrawal_processing(p_request_id uuid, p_batch_id uuid default null, p_notes text default null)
returns jsonb language sql security definer set search_path = public as $$ select public.apn_withdrawal_review(p_request_id, 'processing', null, null, p_notes, p_batch_id); $$;
create or replace function public.apn_mark_withdrawal_paid(p_request_id uuid, p_payment_reference text default null)
returns jsonb language sql security definer set search_path = public as $$ select public.apn_withdrawal_review(p_request_id, 'paid', null, null, p_payment_reference, null); $$;

create or replace function public.apn_cancel_withdrawal(p_request_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_partner text; v_status text;
begin
  select partner_id, status into v_partner, v_status from public.apn_withdrawal_requests where id = p_request_id;
  if v_partner is null then raise exception 'Withdrawal request not found.' using errcode = 'no_data_found'; end if;
  if auth.uid()::text <> v_partner and not public.apn_withdrawal_can_manage() then raise exception 'Withdrawal cancellation access denied.' using errcode = 'insufficient_privilege'; end if;
  if auth.uid()::text = v_partner and not public.apn_withdrawal_can_manage() and v_status <> 'pending' then raise exception 'Only pending requests can be cancelled by the partner.' using errcode = 'check_violation'; end if;
  return public.apn_withdrawal_review(p_request_id, 'cancelled', null, p_reason, null, null);
end;
$$;

create or replace function public.apn_unlock_withdrawal_wallet(p_request_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Only a Super Admin can unlock a withdrawal wallet.' using errcode = 'insufficient_privilege'; end if;
  return public.apn_withdrawal_review(p_request_id, 'cancelled', null, coalesce(p_reason, 'Super Admin wallet unlock'), 'Wallet lock released by Super Admin.', null);
end;
$$;

create or replace function public.apn_reopen_withdrawal(p_request_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_request public.apn_withdrawal_requests%rowtype; v_wallet public.apn_withdrawal_wallets%rowtype;
begin
  if not public.is_superadmin() then raise exception 'Only a Super Admin can reopen a withdrawal.' using errcode = 'insufficient_privilege'; end if;
  select * into v_request from public.apn_withdrawal_requests where id = p_request_id for update;
  if not found then raise exception 'Withdrawal request not found.' using errcode = 'no_data_found'; end if;
  if v_request.status not in ('rejected','cancelled','expired') then raise exception 'Only released withdrawals can be reopened.' using errcode = 'check_violation'; end if;
  perform public.apn_withdrawal_refresh_wallet(v_request.partner_id);
  select * into v_wallet from public.apn_withdrawal_wallets where partner_id = v_request.partner_id and wallet_type = v_request.wallet_type for update;
  if v_wallet.withdrawable < v_request.requested_amount then raise exception 'The wallet no longer has enough withdrawable balance to reopen this request.' using errcode = 'check_violation'; end if;
  update public.apn_withdrawal_requests set status = 'pending', approved_amount = null, review_reason = nullif(trim(p_reason),''), reviewed_at = null, reviewed_by = null, cancelled_at = null, expires_at = now() + interval '30 days', updated_at = now() where id = p_request_id returning * into v_request;
  insert into public.apn_withdrawal_status_history (request_id, from_status, to_status, amount, reason, actor_id, actor_name, actor_role) values (v_request.id, 'released', 'pending', v_request.requested_amount, p_reason, auth.uid()::text, coalesce(public.current_name(),'Withdrawal System'), public.apn_withdrawal_actor_role());
  insert into public.apn_wallet_transactions (partner_id, wallet_type, request_id, entry_type, amount, balance_effect, description, created_by) values (v_request.partner_id, v_request.wallet_type, v_request.id, 'reopen', v_request.requested_amount, 'reserve', 'Super Admin reopened and reserved the withdrawal.', auth.uid()::text);
  perform public.apn_withdrawal_add_timeline(v_request, 'Withdrawal reopened', 'A Super Admin reopened this withdrawal request.');
  perform public.apn_withdrawal_notify(v_request.partner_id, 'Withdrawal reopened', 'Your withdrawal request was reopened for review.', 'Normal', 'withdrawal-reopened');
  perform public.apn_withdrawal_audit_event('reopened withdrawal', v_request.partner_id, v_request.id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'amount', v_request.requested_amount);
end;
$$;

create or replace function public.apn_create_withdrawal_batch(p_frequency text, p_scheduled_for date default current_date, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_batch public.apn_withdrawal_batches%rowtype; v_count integer;
begin
  if not public.apn_withdrawal_can_manage() then raise exception 'Settlement batch access denied.' using errcode = 'insufficient_privilege'; end if;
  if p_frequency not in ('daily','weekly','monthly') then raise exception 'Batch frequency must be daily, weekly, or monthly.' using errcode = 'invalid_parameter_value'; end if;
  insert into public.apn_withdrawal_batches (batch_code, frequency, scheduled_for, created_by, notes)
  values ('APN-SET-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)), p_frequency, coalesce(p_scheduled_for,current_date), auth.uid()::text, nullif(trim(p_notes),'')) returning * into v_batch;
  update public.apn_withdrawal_requests set batch_id = v_batch.id, updated_at = now() where status = 'approved' and batch_id is null;
  get diagnostics v_count = row_count;
  perform public.apn_withdrawal_audit_event('created settlement batch', auth.uid()::text, null, jsonb_build_object('batchId', v_batch.id, 'batchCode', v_batch.batch_code, 'frequency', p_frequency, 'requestCount', v_count));
  return jsonb_build_object('id', v_batch.id, 'batchCode', v_batch.batch_code, 'frequency', v_batch.frequency, 'requests', v_count);
end;
$$;

create or replace function public.apn_withdrawal_dashboard(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid()::text <> p_partner_id and not public.apn_withdrawal_can_manage() then raise exception 'Withdrawal dashboard access denied.' using errcode = 'insufficient_privilege'; end if;
  perform public.apn_withdrawal_refresh_wallet(p_partner_id);
  return jsonb_build_object(
    'wallets', coalesce((select jsonb_agg(to_jsonb(w) order by w.wallet_type) from public.apn_withdrawal_wallets w where w.partner_id = p_partner_id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc) from public.apn_withdrawal_requests r where r.partner_id = p_partner_id), '[]'::jsonb),
    'nextSettlementDate', public.apn_withdrawal_next_settlement_date()
  );
end;
$$;

create or replace function public.apn_log_withdrawal_export(p_format text, p_filters jsonb default '{}'::jsonb, p_row_count integer default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.apn_withdrawal_can_manage() then raise exception 'Withdrawal export access denied.' using errcode = 'insufficient_privilege'; end if;
  if p_format not in ('csv','xlsx') then raise exception 'Export format must be csv or xlsx.' using errcode = 'invalid_parameter_value'; end if;
  insert into public.apn_withdrawal_exports (exported_by, format, filters, row_count) values (auth.uid()::text, p_format, coalesce(p_filters,'{}'::jsonb), greatest(0,coalesce(p_row_count,0))) returning id into v_id;
  perform public.apn_withdrawal_audit_event('exported withdrawal report', auth.uid()::text, null, jsonb_build_object('format', p_format, 'rowCount', p_row_count, 'filters', p_filters));
  return v_id;
end;
$$;

-- Keep the original PR2 referral wallet correct when requests are made through
-- the unified PR3 Withdrawal Center as well as through its legacy endpoint.
create or replace function public.apn_referral_refresh_wallet(p_partner_id text)
returns void language plpgsql security definer set search_path = public as $$
declare current_month date := date_trunc('month', now())::date;
begin
  insert into public.apn_referral_wallets (partner_id, pending, approved, withdrawable, paid, lifetime, monthly, updated_at)
  select p_partner_id,
    coalesce(sum(referral_amount) filter (where status = 'pending'), 0),
    coalesce(sum(referral_amount) filter (where status = 'approved'), 0),
    greatest(0, coalesce(sum(referral_amount) filter (where status = 'withdrawable'), 0)
      - coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status in ('pending','approved')), 0)
      - coalesce((select sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) from public.apn_withdrawal_requests where partner_id = p_partner_id and wallet_type = 'referral' and status in ('pending','under_review','approved','processing','paid')), 0)),
    coalesce(sum(referral_amount) filter (where status = 'paid'), 0)
      + coalesce((select sum(amount) from public.apn_referral_withdrawals where partner_id = p_partner_id and status = 'paid'), 0)
      + coalesce((select sum(public.apn_withdrawal_request_amount(requested_amount, approved_amount, status)) from public.apn_withdrawal_requests where partner_id = p_partner_id and wallet_type = 'referral' and status = 'paid'), 0),
    coalesce(sum(referral_amount) filter (where status <> 'void'), 0),
    coalesce(sum(referral_amount) filter (where status <> 'void' and created_at >= current_month), 0), now()
  from public.apn_referral_earnings where referrer_id = p_partner_id
  on conflict (partner_id) do update set pending = excluded.pending, approved = excluded.approved, withdrawable = excluded.withdrawable,
    paid = excluded.paid, lifetime = excluded.lifetime, monthly = excluded.monthly, updated_at = now();
end;
$$;

create or replace view public.apn_withdrawal_partner_summary as
select w.partner_id, w.wallet_type, w.pending, w.approved, w.withdrawable, w.locked, w.paid, w.lifetime, w.monthly, w.today,
  w.total_requested, w.total_approved, w.total_rejected, w.total_processing, w.last_paid_at, w.next_settlement_date, w.updated_at
from public.apn_withdrawal_wallets w;

create or replace view public.apn_withdrawal_admin_queue as
select r.id, r.partner_id, u.data->>'name' as partner_name, r.wallet_type, r.requested_amount, r.approved_amount, r.preferred_method,
  r.status, r.requested_at, r.reviewed_at, r.reviewed_by, r.processing_at, r.paid_at, r.batch_id, r.settlement_reference,
  b.verification_status as bank_verification_status, r.bank_snapshot
from public.apn_withdrawal_requests r
join public.apn_users u on u.id = r.partner_id
left join public.apn_withdrawal_bank_accounts b on b.id = r.bank_account_id;

do $$ declare t text; begin
  foreach t in array array['apn_withdrawal_bank_accounts','apn_withdrawal_wallets','apn_withdrawal_batches','apn_withdrawal_requests','apn_withdrawal_status_history','apn_withdrawal_settlements','apn_wallet_transactions','apn_withdrawal_finance_transactions','apn_withdrawal_audit','apn_withdrawal_exports'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists apn_withdrawal_bank_accounts_select on public.apn_withdrawal_bank_accounts;
create policy apn_withdrawal_bank_accounts_select on public.apn_withdrawal_bank_accounts for select to authenticated using (partner_id = auth.uid()::text or public.apn_withdrawal_can_manage());
drop policy if exists apn_withdrawal_wallets_select on public.apn_withdrawal_wallets;
create policy apn_withdrawal_wallets_select on public.apn_withdrawal_wallets for select to authenticated using (partner_id = auth.uid()::text or public.apn_withdrawal_can_manage());
drop policy if exists apn_withdrawal_requests_select on public.apn_withdrawal_requests;
create policy apn_withdrawal_requests_select on public.apn_withdrawal_requests for select to authenticated using (partner_id = auth.uid()::text or public.apn_withdrawal_can_manage());
drop policy if exists apn_withdrawal_history_select on public.apn_withdrawal_status_history;
create policy apn_withdrawal_history_select on public.apn_withdrawal_status_history for select to authenticated using (public.apn_withdrawal_can_manage() or exists (select 1 from public.apn_withdrawal_requests r where r.id = request_id and r.partner_id = auth.uid()::text));
drop policy if exists apn_withdrawal_settlements_select on public.apn_withdrawal_settlements;
create policy apn_withdrawal_settlements_select on public.apn_withdrawal_settlements for select to authenticated using (public.apn_withdrawal_can_manage() or partner_id = auth.uid()::text);
drop policy if exists apn_wallet_transactions_select on public.apn_wallet_transactions;
create policy apn_wallet_transactions_select on public.apn_wallet_transactions for select to authenticated using (public.apn_withdrawal_can_manage() or partner_id = auth.uid()::text);
drop policy if exists apn_withdrawal_finance_select on public.apn_withdrawal_finance_transactions;
create policy apn_withdrawal_finance_select on public.apn_withdrawal_finance_transactions for select to authenticated using (public.apn_withdrawal_can_manage() or partner_id = auth.uid()::text);
drop policy if exists apn_withdrawal_batches_select on public.apn_withdrawal_batches;
create policy apn_withdrawal_batches_select on public.apn_withdrawal_batches for select to authenticated using (public.apn_withdrawal_can_manage());
drop policy if exists apn_withdrawal_audit_select on public.apn_withdrawal_audit;
create policy apn_withdrawal_audit_select on public.apn_withdrawal_audit for select to authenticated using (public.apn_withdrawal_can_manage() or partner_id = auth.uid()::text);
drop policy if exists apn_withdrawal_exports_select on public.apn_withdrawal_exports;
create policy apn_withdrawal_exports_select on public.apn_withdrawal_exports for select to authenticated using (public.apn_withdrawal_can_manage());

revoke all on table public.apn_withdrawal_bank_accounts, public.apn_withdrawal_wallets, public.apn_withdrawal_batches, public.apn_withdrawal_requests, public.apn_withdrawal_status_history, public.apn_withdrawal_settlements, public.apn_wallet_transactions, public.apn_withdrawal_finance_transactions, public.apn_withdrawal_audit, public.apn_withdrawal_exports from anon;
grant select on table public.apn_withdrawal_bank_accounts, public.apn_withdrawal_wallets, public.apn_withdrawal_batches, public.apn_withdrawal_requests, public.apn_withdrawal_status_history, public.apn_withdrawal_settlements, public.apn_wallet_transactions, public.apn_withdrawal_finance_transactions, public.apn_withdrawal_audit, public.apn_withdrawal_exports to authenticated;
grant execute on function public.apn_upsert_withdrawal_bank_account(text,text,text,text,text,text,text,text), public.apn_request_withdrawal(text,numeric,text,text,text), public.apn_set_withdrawal_bank_verification(text,text,text), public.apn_withdrawal_review(uuid,text,numeric,text,text,uuid), public.apn_approve_withdrawal(uuid,numeric,text,text), public.apn_reject_withdrawal(uuid,text,text), public.apn_mark_withdrawal_processing(uuid,uuid,text), public.apn_mark_withdrawal_paid(uuid,text), public.apn_cancel_withdrawal(uuid,text), public.apn_unlock_withdrawal_wallet(uuid,text), public.apn_reopen_withdrawal(uuid,text), public.apn_create_withdrawal_batch(text,date,text), public.apn_withdrawal_dashboard(text), public.apn_log_withdrawal_export(text,jsonb,integer) to authenticated;

do $$ declare t text; begin
  foreach t in array array['apn_withdrawal_bank_accounts','apn_withdrawal_wallets','apn_withdrawal_batches','apn_withdrawal_requests','apn_withdrawal_status_history','apn_withdrawal_settlements','apn_wallet_transactions','apn_withdrawal_finance_transactions','apn_withdrawal_audit'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- Materialize wallet rows for existing APN partners without touching source data.
do $$ declare p record; begin
  for p in select id from public.apn_users loop perform public.apn_withdrawal_refresh_wallet(p.id); end loop;
end $$;

commit;
notify pgrst, 'reload schema';

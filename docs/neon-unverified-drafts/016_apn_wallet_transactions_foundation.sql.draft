-- =============================================================================
-- ALLBEE APN Withdrawal & Settlement Engine: FOUNDATION (Neon Port)
-- File: database/neon/016_apn_wallet_transactions_foundation.sql
--
-- Ported from: supabase/apn-withdrawal-settlement-engine-pr3.sql
-- =============================================================================

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

do $$ declare t text; begin
  foreach t in array array['apn_withdrawal_bank_accounts','apn_withdrawal_wallets','apn_withdrawal_batches','apn_withdrawal_requests','apn_withdrawal_status_history','apn_withdrawal_settlements','apn_wallet_transactions','apn_withdrawal_finance_transactions','apn_withdrawal_audit'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════
-- WP5 — APN ALLBEE AI + SUPPORT TICKET SYSTEM
--
-- Server-side, APN-scoped AI. The logged-in partner's identity comes ONLY from
-- auth.uid(); no function accepts a target user id, so manipulated IDs cannot
-- widen the scope. The AI edge function (supabase/functions/apn-ai) calls these
-- RPCs with the partner's own JWT; every query here filters by that identity.
--
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. SUPPORT TICKETS ──────────────────────────────────────────────────────
create table if not exists public.apn_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null,
  partner_id text not null references public.apn_users(id) on delete restrict,
  category text not null,
  question text not null,
  ai_summary text,
  relevant_ids jsonb not null default '[]'::jsonb,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','under_review','waiting_for_partner','answered','resolved','closed')),
  rule_version text,
  created_at timestamptz not null default now(),
  admin_response text,
  admin_responded_by text,
  admin_responded_at timestamptz,
  superadmin_response text,
  superadmin_responded_by text,
  superadmin_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (ticket_no)
);

-- Idempotency key: the client generates one stable key per "ticket decision"
-- (Yes click). Repeated clicks / retries reuse the same key, so the RPC below
-- returns the already-created ticket instead of inserting a duplicate row.
alter table public.apn_support_tickets add column if not exists client_key text;
create unique index if not exists apn_support_tickets_partner_client_key_idx
  on public.apn_support_tickets (partner_id, client_key) where client_key is not null;

alter table public.apn_support_tickets enable row level security;
revoke all on public.apn_support_tickets from public, anon, authenticated;
grant select on public.apn_support_tickets to authenticated;

-- Partner sees only their own tickets; admin group sees everything.
drop policy if exists apn_support_tickets_select_own on public.apn_support_tickets;
create policy apn_support_tickets_select_own on public.apn_support_tickets
  for select to authenticated
  using (partner_id = auth.uid()::text or public.is_admin() or public.is_superadmin());

-- No direct INSERT/UPDATE/DELETE for anyone: all writes go through audited RPCs.

create index if not exists apn_support_tickets_partner_idx on public.apn_support_tickets (partner_id, created_at desc);
create index if not exists apn_support_tickets_status_idx on public.apn_support_tickets (status);

-- ── 2. AI USAGE / RATE LIMIT (persistent, per partner) ──────────────────────
create table if not exists public.apn_ai_usage (
  user_id text primary key,
  window_start timestamptz not null,
  call_count integer not null default 0
);

alter table public.apn_ai_usage enable row level security;
revoke all on public.apn_ai_usage from public, anon, authenticated;

-- ── 3. PARTNER SCOPE HELPER ─────────────────────────────────────────────────
-- Returns the caller's APN partner identity (active only) or NULL. Used by the
-- AI context builder and ticket creation; identity is always auth.uid().
create or replace function public.apn_ai_partner_scope()
returns jsonb
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select case
    when auth.uid() is null then null
    else (
      select jsonb_build_object(
        'partnerId', u.id,
        'name', coalesce(u.data->>'name', u.data->>'fullName', 'Partner'),
        'apnId', coalesce(u.data->>'apnId', u.data->>'partnerId', u.id),
        'role', coalesce(u.data->>'role', 'partner'),
        'status', coalesce(u.data->>'status', 'pending'),
        'district', coalesce(u.data->>'district', ''),
        'state', coalesce(u.data->>'state', ''),
        'zone', coalesce(u.data->>'zone', ''),
        'level', coalesce(u.data->>'level', ''),
        'joinedAt', coalesce(u.data->>'joinedAt', u.updated_at::text)
      )
      from public.apn_users u
      where u.id = auth.uid()::text
        and coalesce(u.data->>'status', 'pending') = 'active'
        and coalesce(u.data->>'role', 'partner') in ('partner','district_head','state_head')
    )
  end;
$$;

revoke all on function public.apn_ai_partner_scope() from public, anon;
grant execute on function public.apn_ai_partner_scope() to authenticated;

-- ── 4. AI USAGE TICK (persistent per-hour window; server-side cap) ──────────
create or replace function public.apn_ai_usage_tick(p_cap integer default 60)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid text := auth.uid()::text;
  v_window_start timestamptz;
  v_count integer;
  v_remaining integer;
begin
  if v_uid is null or v_uid = '' then
    raise exception 'Not authenticated.' using errcode = 'insufficient_privilege';
  end if;
  v_window_start := date_trunc('hour', now());
  insert into public.apn_ai_usage (user_id, window_start, call_count)
  values (v_uid, v_window_start, 1)
  on conflict (user_id) do update
    set call_count = case
      when public.apn_ai_usage.window_start < excluded.window_start then 1
      else public.apn_ai_usage.call_count + 1
    end,
    window_start = case
      when public.apn_ai_usage.window_start < excluded.window_start then excluded.window_start
      else public.apn_ai_usage.window_start
    end
  returning call_count, window_start into v_count, v_window_start;

  v_remaining := greatest(p_cap - v_count, 0);
  if v_count > p_cap then
    raise exception 'Too many requests. Please wait and try again later.'
      using errcode = 'RL001', hint = 'hourly cap ' || p_cap;
  end if;
  return jsonb_build_object('user_id', v_uid, 'window_start', v_window_start, 'call_count', v_count, 'remaining', v_remaining);
end;
$$;

revoke all on function public.apn_ai_usage_tick(integer) from public, anon;
grant execute on function public.apn_ai_usage_tick(integer) to authenticated;

-- ── 5. APN AI CONTEXT BUILDER (the server-side security boundary) ───────────
-- Builds a bounded, APN-scoped snapshot for the caller's identity ONLY.
-- No parameter can point the scope at another user. Never returns secrets,
-- service-role material, other partners' financial data, or admin data.
-- p_question is accepted (and bounded) only so the snapshot can bias toward
-- the asked topic; it is never used in a WHERE clause against identities.
create or replace function public.apn_ai_build_context(p_question text default null)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_scope jsonb;
  v_pid text;
  v_set jsonb;
  v_wallet jsonb;
  v_ledger jsonb;
  v_reversals jsonb;
  v_withdrawals jsonb;
  v_wallets jsonb;
  v_referrals jsonb;
  v_earnings jsonb;
  v_projects jsonb;
  v_collections jsonb;
  v_leads jsonb;
  v_quotes jsonb;
  v_targets jsonb;
  v_zones jsonb;
  v_tickets jsonb;
  v_notifications jsonb;
  v_next_eligible date;
  v_question text := left(coalesce(nullif(trim(p_question), ''), ''), 500);
begin
  v_scope := public.apn_ai_partner_scope();
  if v_scope is null then
    raise exception 'ALLBEE AI is available to active APN partners only.'
      using errcode = 'insufficient_privilege';
  end if;
  v_pid := v_scope->>'partnerId';
  perform set_config('row_security', 'off', true);

  -- Current effective rule version + ladder (read-only knowledge).
  v_set := (
    select jsonb_build_object(
      'ruleSet', jsonb_build_object('code', rs.code, 'name', rs.name, 'effectiveFrom', rs.effective_from, 'effectiveTo', rs.effective_to),
      'ladder', coalesce(jsonb_agg(jsonb_build_object(
        'commissionType', r.commission_type, 'tierMin', r.tier_min, 'tierMax', r.tier_max,
        'percent', r.percent, 'maxPercent', r.max_percent, 'capClass', r.cap_class) order by r.commission_type, r.tier_min), '[]'::jsonb)
    )
    from public.apn_rule_sets rs
    left join public.apn_commission_rules r on r.rule_set_id = rs.id and r.active
    where rs.status = 'active'
      and rs.effective_from <= now()
      and (rs.effective_to is null or rs.effective_to >= now())
    group by rs.id, rs.code, rs.name, rs.effective_from, rs.effective_to
    order by rs.effective_from desc
    limit 1
  );

  -- Authoritative wallet (derived surface; read-only here).
  select to_jsonb(w) into v_wallet from public.apn_consolidated_wallets w where w.partner_id = v_pid;

  -- Ledger trail: the authority for commission/eligibility explanations.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'commissionType', l.commission_type, 'sourceType', l.source_type,
      'baseAmount', l.base_amount, 'percent', l.percent, 'amount', l.amount,
      'eventAt', l.event_at, 'eligibleFrom', l.eligible_from,
      'snapshot', jsonb_build_object(
        'project', l.snapshot->>'project', 'projectNumber', l.snapshot->>'projectNumber',
        'clientName', l.snapshot->>'clientName', 'note', l.snapshot->>'note',
        'reason', l.snapshot->>'reason', 'reversalReason', l.snapshot->>'reversalReason'
      ))
    order by l.event_at desc), '[]'::jsonb) into v_ledger
  from (
    select * from public.apn_commission_ledger where partner_id = v_pid
    order by event_at desc limit 30
  ) l;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'amount', r.amount, 'reason', r.reason, 'status', r.status,
      'createdAt', r.created_at, 'appliedAt', r.applied_at,
      'originalLedger', l.id, 'originalAmount', l.amount, 'commissionType', l.commission_type)
    order by r.created_at desc), '[]'::jsonb) into v_reversals
  from public.apn_reversals r
  join public.apn_commission_ledger l on l.id = r.original_ledger_id
  where l.partner_id = v_pid
  limit 15;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'walletType', w.wallet_type, 'requestedAmount', w.requested_amount,
      'approvedAmount', w.approved_amount, 'status', w.status, 'preferredMethod', w.preferred_method,
      'reason', w.reason, 'reviewReason', w.review_reason, 'requestedAt', w.requested_at,
      'paidAt', w.paid_at, 'cancelledAt', w.cancelled_at)
    order by w.requested_at desc), '[]'::jsonb) into v_withdrawals
  from (
    select * from public.apn_withdrawal_requests where partner_id = v_pid
    order by requested_at desc limit 15
  ) w;

  select coalesce(jsonb_agg(to_jsonb(x) - 'partner_id' order by x.wallet_type), '[]'::jsonb) into v_wallets
  from public.apn_withdrawal_wallets x where x.partner_id = v_pid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', rel.id, 'referrerId', rel.referrer_id, 'referredId', rel.referred_id,
      'referredName', ru.data->>'name', 'referralCode', rel.referral_code,
      'linkedAt', rel.linked_at, 'status', rel.status)
    order by rel.linked_at desc), '[]'::jsonb) into v_referrals
  from public.apn_referral_relationships rel
  left join public.apn_users ru on ru.id = rel.referred_id
  where rel.referrer_id = v_pid
  limit 10;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'referrerId', e.referrer_id, 'referredId', e.referred_id,
      'referralAmount', e.referral_amount, 'status', e.status, 'revenueAmount', e.revenue_amount,
      'referralPercent', e.referral_percent, 'collectionAt', e.collection_at,
      'createdAt', e.created_at)
    order by e.created_at desc), '[]'::jsonb) into v_earnings
  from (
    select * from public.apn_referral_earnings where referrer_id = v_pid
    order by created_at desc limit 10
  ) e;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'projectName', p.project_name, 'clientName', p.client_name,
      'category', p.category, 'projectValue', p.project_value, 'commissionRate', p.commission_rate,
      'maximumCommission', p.maximum_commission, 'totalReceived', p.total_received,
      'totalCommissionPaid', p.total_commission_paid, 'remainingAmount', p.remaining_amount,
      'remainingCommission', p.remaining_commission, 'updatedAt', p.updated_at)
    order by p.updated_at desc), '[]'::jsonb) into v_projects
  from (
    select * from public.apn_commission_projects where partner_id = v_pid
    order by updated_at desc limit 15
  ) p;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'projectId', c.project_id, 'receivedAmount', c.received_amount,
      'commissionGenerated', c.commission_generated, 'incentive', c.incentive,
      'receivedDate', c.received_date, 'commissionStatus', c.commission_status, 'remarks', left(c.remarks, 80))
    order by c.received_date desc), '[]'::jsonb) into v_collections
  from (
    select * from public.apn_revenue_collections where partner_id = v_pid
    order by received_date desc limit 15
  ) c;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.data->>'id', 'clientName', l.data->>'clientName', 'business', l.data->>'business',
      'service', l.data->>'service', 'status', l.data->>'status', 'budget', l.data->>'budget',
      'revenue', l.data->>'revenue', 'converted', l.data->>'projectCompleted', 'createdAt', l.data->>'createdAt')
    order by (l.data->>'createdAt') desc), '[]'::jsonb) into v_leads
  from (
    select * from public.apn_leads
    where data->>'partnerId' = v_pid
    order by (data->>'createdAt') desc limit 15
  ) l;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.data->>'id', 'clientName', q.data->>'clientName', 'title', q.data->>'title',
      'amount', q.data->>'amount', 'status', q.data->>'status', 'createdAt', q.data->>'createdAt')
    order by (q.data->>'createdAt') desc), '[]'::jsonb) into v_quotes
  from (
    select * from public.apn_quotations
    where data->>'partnerId' = v_pid
    order by (data->>'createdAt') desc limit 10
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.data->>'id', 'title', t.data->>'title', 'goal', t.data->>'goal',
      'metric', t.data->>'metric', 'acknowledged', t.data->>'acknowledged',
      'createdAt', t.data->>'createdAt')
    order by (t.data->>'createdAt') desc), '[]'::jsonb) into v_targets
  from (
    select * from public.apn_targets
    where data->>'partnerId' = v_pid
    order by (data->>'createdAt') desc limit 10
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', z.data->>'id', 'zone', z.data->>'zone', 'status', z.data->>'status',
      'notes', z.data->>'notes', 'createdAt', z.data->>'createdAt')
    order by (z.data->>'createdAt') desc), '[]'::jsonb) into v_zones
  from (
    select * from public.apn_zone_requests
    where data->>'partnerId' = v_pid
    order by (data->>'createdAt') desc limit 5
  ) z;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'ticketNo', t.ticket_no, 'category', t.category, 'status', t.status,
      'priority', t.priority, 'question', left(t.question, 160), 'createdAt', t.created_at,
      'answered', t.admin_response is not null)
    order by t.created_at desc), '[]'::jsonb) into v_tickets
  from (
    select * from public.apn_support_tickets where partner_id = v_pid
    order by created_at desc limit 10
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.data->>'id', 'title', n.data->>'title', 'body', left(n.data->>'body', 160),
      'createdAt', n.data->>'createdAt')
    order by (n.data->>'createdAt') desc), '[]'::jsonb) into v_notifications
  from (
    select * from public.apn_notifications
    where (data->>'audience') in ('all', 'partner:' || v_pid, 'district:' || coalesce(v_scope->>'district', ''))
       or (data->>'partnerId') = v_pid
    order by (data->>'createdAt') desc limit 10
  ) n;

  -- Next date a pending commission becomes eligible (for "when can I withdraw").
  select min(coalesce(eligible_from, event_at::date)) into v_next_eligible
  from public.apn_commission_ledger
  where partner_id = v_pid and amount > 0
    and coalesce(eligible_from, event_at::date) > current_date;

  return jsonb_strip_nulls(jsonb_build_object(
    'scope', v_scope,
    'question', v_question,
    'ruleKnowledge', v_set,
    'wallet', v_wallet,
    'ledger', v_ledger,
    'reversals', v_reversals,
    'withdrawalRequests', v_withdrawals,
    'withdrawalWallets', v_wallets,
    'nextEligibleDate', v_next_eligible,
    'referrals', v_referrals,
    'referralEarnings', v_earnings,
    'projects', v_projects,
    'revenueCollections', v_collections,
    'leads', v_leads,
    'quotations', v_quotes,
    'targets', v_targets,
    'zoneRequests', v_zones,
    'tickets', v_tickets,
    'notifications', v_notifications
  ));
end;
$$;

revoke all on function public.apn_ai_build_context(text) from public, anon;
grant execute on function public.apn_ai_build_context(text) to authenticated;

-- ── 6. TICKET RPCs (all writes audited; identity from auth.uid()) ───────────
-- p_client_key makes creation idempotent: a repeated call with the same key
-- (double-click / retry after a network failure) returns the existing ticket
-- instead of inserting a duplicate. Concurrency-safe via the partial unique
-- index (partner_id, client_key) where client_key is not null.
drop function if exists public.apn_support_tickets_create(text, text, text, jsonb, text);
create or replace function public.apn_support_tickets_create(
  p_category text,
  p_question text,
  p_ai_summary text default null,
  p_relevant_ids jsonb default '[]'::jsonb,
  p_priority text default 'normal',
  p_client_key text default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_scope jsonb;
  v_pid text;
  v_id uuid;
  v_ticket_no text;
  v_client_key text := nullif(left(trim(coalesce(p_client_key, '')), 120), '');
  v_category text := left(nullif(trim(p_category), ''), 60);
  v_question text := left(nullif(trim(p_question), ''), 2000);
  v_priority text := coalesce(p_priority, 'normal');
begin
  if v_category is null or v_question is null then
    raise exception 'Category and question are required.' using errcode = 'invalid_parameter_value';
  end if;
  if v_priority not in ('low','normal','high','urgent') then v_priority := 'normal'; end if;

  perform set_config('apn.support.write', 'on', true);

  v_scope := public.apn_ai_partner_scope();
  if v_scope is null then
    raise exception 'Only active APN partners can create support tickets.'
      using errcode = 'insufficient_privilege';
  end if;
  v_pid := v_scope->>'partnerId';

  -- Idempotent path: same partner + same client key → return the existing ticket.
  if v_client_key is not null then
    select t.id into v_id from public.apn_support_tickets t
    where t.partner_id = v_pid and t.client_key = v_client_key;
    if v_id is not null then
      return (select to_jsonb(t) from public.apn_support_tickets t where t.id = v_id);
    end if;
  end if;

  insert into public.apn_support_tickets (
    ticket_no, partner_id, category, question, ai_summary, relevant_ids,
    priority, status, rule_version, client_key
  ) values (
    'APN-TK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_pid, v_category, v_question, left(p_ai_summary, 8000),
    case when jsonb_typeof(p_relevant_ids) = 'array' then (select jsonb_agg(x) from jsonb_array_elements(p_relevant_ids) x limit 50) else '[]'::jsonb end,
    v_priority, 'open',
    (select code from public.apn_rule_sets rs where rs.status = 'active' and rs.effective_from <= now() and (rs.effective_to is null or rs.effective_to >= now()) order by rs.effective_from desc limit 1),
    v_client_key
  )
  on conflict do nothing
  returning id, ticket_no into v_id, v_ticket_no;

  -- Lost the race against a concurrent identical call → return that ticket.
  if v_id is null then
    select t.id, t.ticket_no into v_id, v_ticket_no from public.apn_support_tickets t
    where t.partner_id = v_pid and t.client_key = v_client_key;
  end if;

  perform public.apn_rule_audit('support ticket created', 'apn_support_tickets', v_id::text,
    jsonb_build_object('ticketNo', v_ticket_no, 'category', v_category, 'priority', v_priority));

  return (select to_jsonb(t) from public.apn_support_tickets t where t.id = v_id);
end;
$$;

revoke all on function public.apn_support_tickets_create(text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.apn_support_tickets_create(text, text, text, jsonb, text, text) to authenticated;

-- Partner: own tickets. Admin/Superadmin: everything (full rows).
create or replace function public.apn_support_tickets_list(p_limit integer default 100)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_is_admin boolean;
  v_rows jsonb;
begin
  v_is_admin := public.is_admin() or public.is_superadmin();
  if not v_is_admin and (auth.uid() is null or public.apn_ai_partner_scope() is null) then
    raise exception 'Access denied.' using errcode = 'insufficient_privilege';
  end if;
  if v_is_admin then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      into v_rows
    from (select * from public.apn_support_tickets order by created_at desc limit greatest(least(p_limit, 500), 1)) t;
  else
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      into v_rows
    from (select * from public.apn_support_tickets where partner_id = auth.uid()::text order by created_at desc limit greatest(least(p_limit, 200), 1)) t;
  end if;
  return v_rows;
end;
$$;

revoke all on function public.apn_support_tickets_list(integer) from public, anon;
grant execute on function public.apn_support_tickets_list(integer) to authenticated;

-- Official admin response → the authoritative answer for that case.
-- Superadmin has superior authority: may also set final status (resolved/closed)
-- and their response is stored separately (superadmin_response).
create or replace function public.apn_support_tickets_respond(
  p_ticket_id uuid,
  p_response text,
  p_status text default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_is_super boolean := public.is_superadmin();
  v_is_admin boolean := public.is_admin();
  v_response text := left(nullif(trim(p_response), ''), 8000);
  v_status text := nullif(p_status, '');
  v_actor text := auth.uid()::text;
  v_row jsonb;
begin
  if not (v_is_super or v_is_admin) then
    raise exception 'Only administrators can respond to support tickets.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_response is null then
    raise exception 'A response is required.' using errcode = 'invalid_parameter_value';
  end if;

  perform set_config('apn.support.write', 'on', true);

  if not exists (select 1 from public.apn_support_tickets where id = p_ticket_id) then
    raise exception 'Ticket not found.' using errcode = 'no_data_found';
  end if;

  -- Superadmin is the only authority allowed to force resolved/closed; an admin
  -- may still move a ticket through the working statuses.
  if v_status is not null then
    if not v_is_super and v_status in ('resolved','closed') then
      raise exception 'Only a Super Admin can resolve or close a support ticket.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_status not in ('open','under_review','waiting_for_partner','answered','resolved','closed') then
      raise exception 'Invalid status.' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  update public.apn_support_tickets t set
    admin_response = v_response,
    admin_responded_by = v_actor,
    admin_responded_at = now(),
    status = coalesce(v_status, case when t.status in ('resolved','closed') then t.status else 'answered' end),
    superadmin_response = case when v_is_super then v_response else t.superadmin_response end,
    superadmin_responded_by = case when v_is_super then v_actor else t.superadmin_responded_by end,
    superadmin_responded_at = case when v_is_super then now() else t.superadmin_responded_at end,
    resolved_at = case when coalesce(v_status, 'answered') = 'resolved' then now() else t.resolved_at end,
    closed_at = case when coalesce(v_status, 'answered') = 'closed' then now() else t.closed_at end,
    updated_at = now()
  where t.id = p_ticket_id
  returning to_jsonb(t) into v_row;

  perform public.apn_rule_audit('support ticket responded', 'apn_support_tickets', p_ticket_id::text,
    jsonb_build_object('status', coalesce(v_status, 'answered'), 'superadmin', v_is_super));

  return v_row;
end;
$$;

revoke all on function public.apn_support_tickets_respond(uuid, text, text) from public, anon;
grant execute on function public.apn_support_tickets_respond(uuid, text, text) to authenticated;

-- Status transitions: admin may work the ticket; superadmin may do anything
-- (including resolved/closed, and re-open).
create or replace function public.apn_support_tickets_status(p_ticket_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_is_super boolean := public.is_superadmin();
  v_is_admin boolean := public.is_admin();
  v_status text := nullif(trim(p_status), '');
  v_row jsonb;
begin
  if not (v_is_super or v_is_admin) then
    raise exception 'Access denied.' using errcode = 'insufficient_privilege';
  end if;
  if v_status is null or v_status not in ('open','under_review','waiting_for_partner','answered','resolved','closed') then
    raise exception 'Invalid status.' using errcode = 'invalid_parameter_value';
  end if;
  if not v_is_super and v_status in ('resolved','closed') then
    raise exception 'Only a Super Admin can resolve or close a support ticket.'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.apn_support_tickets where id = p_ticket_id) then
    raise exception 'Ticket not found.' using errcode = 'no_data_found';
  end if;

  perform set_config('apn.support.write', 'on', true);

  update public.apn_support_tickets t set
    status = v_status,
    resolved_at = case when v_status = 'resolved' then now() else t.resolved_at end,
    closed_at = case when v_status = 'closed' then now() else t.closed_at end,
    updated_at = now()
  where t.id = p_ticket_id
  returning to_jsonb(t) into v_row;

  perform public.apn_rule_audit('support ticket status', 'apn_support_tickets', p_ticket_id::text,
    jsonb_build_object('status', v_status));

  return v_row;
end;
$$;

revoke all on function public.apn_support_tickets_status(uuid, text) from public, anon;
grant execute on function public.apn_support_tickets_status(uuid, text) to authenticated;

-- ── 7. EXTRA GUARDS ──────────────────────────────────────────────────────────
-- The AI context/ticket functions are read-only by construction; belt-and-braces:
-- ensure no one (including the service role via SQL editor) can write to the
-- derived consolidated wallet outside the engine refresh.
create or replace function public.apn_support_ticket_mutation_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if coalesce(current_setting('apn.support.write', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Support tickets can only be written through the audited RPCs.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists apn_support_tickets_mutation_trg on public.apn_support_tickets;
create trigger apn_support_tickets_mutation_trg
  before insert or update or delete on public.apn_support_tickets
  for each row execute function public.apn_support_ticket_mutation_guard();

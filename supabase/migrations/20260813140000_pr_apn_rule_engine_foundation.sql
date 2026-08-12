-- =============================================================================
-- ALLBEE — APN Rule Engine & Partner Platform: FOUNDATION
-- File: supabase/pr-apn-rule-engine-foundation.sql
--
-- Phase 0 + Foundation work package. Builds the rails of the production-grade
-- APN rule engine WITHOUT changing the behavior of any working system:
--
--   1. apn_system_controls         emergency freeze + engine toggle
--   2. apn_rule_sets / rules       versioned, effective-dated commission rules
--   3. apn_hierarchy_assignments   partner -> district_head -> state_head
--   4. apn_commission_ledger       immutable, idempotency-keyed ledger
--   5. apn_reversals               additive reversal model (original untouched)
--   6. apn_finance_expense_map     deterministic finance expense per ledger row
--   7. apn_migrations              migration mapping framework (review_required)
--   8. apn_rule_audit              audit integration (mirrors withdrawal pattern)
--
-- Behavior compatibility rules:
--   * No rule set active  -> resolver falls back to TODAY's behavior
--     (partner ladder 10/15/20 via apn_commission_rate_for_project;
--      referral/district/state 1%).
--   * Zero DML on existing data. All DDL idempotent (safe to re-run).
--   * Working engines (referral trigger, withdrawal settlement, finance
--     income/expense) are untouched; convergence is tracked in apn_migrations
--     as MIGRATION_REVIEW_REQUIRED, not performed silently.
--
-- Security: SECURITY DEFINER + set search_path = pg_catalog, public, pg_temp,
-- explicit role gates, revoke from public/anon then grant to authenticated,
-- no dynamic SQL, RLS enabled on every new table, no direct writes to the
-- ledger/reversal/audit tables from any client role.
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SYSTEM CONTROLS (emergency freeze)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_system_controls (
  id smallint primary key default 1 check (id = 1),
  frozen boolean not null default false,
  frozen_at timestamptz,
  frozen_by text,
  reason text,
  rule_engine_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.apn_system_controls (id) values (1) on conflict (id) do nothing;

alter table public.apn_system_controls enable row level security;
revoke all on public.apn_system_controls from public, anon, authenticated;
grant select on public.apn_system_controls to authenticated;
grant update on public.apn_system_controls to authenticated;

drop policy if exists apn_system_controls_read on public.apn_system_controls;
create policy apn_system_controls_read on public.apn_system_controls
  for select to authenticated using (true);

drop policy if exists apn_system_controls_write on public.apn_system_controls;
create policy apn_system_controls_write on public.apn_system_controls
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create or replace function public.apn_system_controls_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'UPDATE'
     and (new.frozen is distinct from old.frozen or new.rule_engine_enabled is distinct from old.rule_engine_enabled) then
    if not public.is_superadmin() then
      raise exception 'Only Super Admin may change APN system controls.' using errcode = 'insufficient_privilege';
    end if;
    if new.frozen is distinct from old.frozen then
      new.frozen_at := now();
      new.frozen_by := auth.uid()::text;
    end if;
    new.updated_at := now();
    new.updated_by := auth.uid()::text;
  end if;
  return new;
end;
$$;
drop trigger if exists apn_system_controls_guard_trg on public.apn_system_controls;
create trigger apn_system_controls_guard_trg
  before insert or update on public.apn_system_controls
  for each row execute function public.apn_system_controls_guard();

-- Operational gate called at the top of every engine write path.
create or replace function public.apn_guard_operational()
returns void
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_frozen boolean;
begin
  select coalesce(frozen, false) into v_frozen from public.apn_system_controls where id = 1;
  if coalesce(v_frozen, false) then
    raise exception 'APN operations are temporarily frozen.' using errcode = 'FZ001';
  end if;
end;
$$;
revoke all on function public.apn_guard_operational() from public, anon;
grant execute on function public.apn_guard_operational() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUDIT INTEGRATION (created first; every engine write logs through it)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_rule_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text not null,
  entity_id text,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.apn_rule_audit enable row level security;
revoke all on public.apn_rule_audit from public, anon, authenticated;

create or replace function public.apn_rule_audit(p_action text, p_entity text, p_entity_id text default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_id text := 'rule-audit:' || gen_random_uuid()::text;
begin
  perform set_config('row_security', 'off', true);
  insert into public.apn_rule_audit (action, entity, entity_id, actor_id, metadata)
  values (p_action, p_entity, p_entity_id, auth.uid()::text, coalesce(p_metadata, '{}'::jsonb));
  insert into public.audit (id, data, updated_at)
  values (v_id, jsonb_build_object(
    'id', v_id,
    'ts', (extract(epoch from now()) * 1000)::bigint,
    'user', coalesce(public.current_name(), 'APN Rule Engine'),
    'userId', auth.uid()::text,
    'action', p_action,
    'module', 'APN',
    'entity', p_entity,
    'entityId', coalesce(p_entity_id, ''),
    'data', coalesce(p_metadata, '{}'::jsonb)
  ), now());
end;
$$;
revoke all on function public.apn_rule_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.apn_rule_audit(text, text, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RULE SETS + COMMISSION RULES (versioned, effective-dated)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  status text not null default 'active' check (status in ('draft','active','superseded')),
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  superseded_by uuid references public.apn_rule_sets(id) on delete restrict,
  unique (code, effective_from)
);

create table if not exists public.apn_commission_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.apn_rule_sets(id) on delete cascade,
  commission_type text not null check (commission_type in ('partner','district','state','referral')),
  tier_min integer not null default 1 check (tier_min >= 1),
  tier_max integer check (tier_max is null or tier_max >= tier_min),
  percent numeric(5,2) not null check (percent >= 0 and percent <= 100),
  max_percent numeric(5,2) not null default 5 check (max_percent >= 0 and max_percent <= 100),
  cap_class text not null default 'secondary' check (cap_class in ('primary','secondary')),
  priority integer not null default 10,
  active boolean not null default true,
  unique (rule_set_id, commission_type, tier_min, tier_max)
);

alter table public.apn_rule_sets enable row level security;
alter table public.apn_commission_rules enable row level security;
revoke all on public.apn_rule_sets from public, anon, authenticated;
revoke all on public.apn_commission_rules from public, anon, authenticated;
grant select on public.apn_rule_sets to authenticated;
grant select on public.apn_commission_rules to authenticated;

drop policy if exists apn_rule_sets_read on public.apn_rule_sets;
create policy apn_rule_sets_read on public.apn_rule_sets for select to authenticated using (true);
drop policy if exists apn_commission_rules_read on public.apn_commission_rules;
create policy apn_commission_rules_read on public.apn_commission_rules for select to authenticated using (true);

-- Seed: v1 default rule set mirroring TODAY's behavior (idempotent).
insert into public.apn_rule_sets (code, name, status, reason, created_by)
select 'v1', 'Default APN commission rules', 'active',
       'Foundation seed — mirrors the legacy ladder (10/15/20) and referral/district/state 1%.', 'system'
where not exists (select 1 from public.apn_rule_sets where code = 'v1');

insert into public.apn_commission_rules (rule_set_id, commission_type, tier_min, tier_max, percent, max_percent, cap_class)
select rs.id, r.commission_type, r.tier_min, r.tier_max, r.percent, r.max_percent, r.cap_class
from public.apn_rule_sets rs
cross join (values
  ('partner',   1,  1, 10.00, 20, 'primary'),
  ('partner',   2,  9, 15.00, 20, 'primary'),
  ('partner',  10, null, 20.00, 20, 'primary'),
  ('referral',  1, null,  1.00,  5, 'secondary'),
  ('district',  1, null,  1.00,  5, 'secondary'),
  ('state',     1, null,  1.00,  5, 'secondary')
) as r(commission_type, tier_min, tier_max, percent, max_percent, cap_class)
where rs.code = 'v1'
  and not exists (
    select 1 from public.apn_commission_rules x
    where x.rule_set_id = rs.id
      and x.commission_type = r.commission_type
      and x.tier_min = r.tier_min
      and coalesce(x.tier_max, -1) = coalesce(r.tier_max, -1)
  );

-- Rate resolver: rules first, legacy fallback when nothing configured.
create or replace function public.apn_resolve_commission_rate(
  p_partner_id text,
  p_project_number integer default null,
  p_commission_type text default 'partner',
  p_at timestamptz default now()
)
returns numeric
language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_set_id uuid;
  v_number integer;
  v_rule numeric;
  v_count integer;
begin
  select rs.id into v_set_id
  from public.apn_rule_sets rs
  where rs.status = 'active'
    and rs.effective_from <= p_at
    and (rs.effective_to is null or rs.effective_to >= p_at)
  order by rs.effective_from desc
  limit 1;
  if v_set_id is not null then
    v_number := coalesce(p_project_number, 1);
    select r.percent into v_rule
    from public.apn_commission_rules r
    where r.rule_set_id = v_set_id
      and r.commission_type = p_commission_type
      and r.active
      and v_number between r.tier_min and coalesce(r.tier_max, 2147483647)
    order by r.priority asc, r.tier_max asc nulls last
    limit 1;
    if v_rule is not null then
      return v_rule;
    end if;
  end if;
  -- Fallback: no rule set / no matching rule -> today's behavior.
  if p_commission_type = 'partner' then
    if v_set_id is null then
      return public.apn_commission_rate_for_project(p_partner_id, p_project_number);
    end if;
    v_count := 0;
    select count(*) into v_count
    from public.apn_commission_rules r
    where r.rule_set_id = v_set_id and r.commission_type = 'partner' and r.active;
    if v_count = 0 then
      return public.apn_commission_rate_for_project(p_partner_id, p_project_number);
    end if;
    return 0;
  end if;
  return 1;
end;
$$;
revoke all on function public.apn_resolve_commission_rate(text, integer, text, timestamptz) from public, anon;
grant execute on function public.apn_resolve_commission_rate(text, integer, text, timestamptz) to authenticated;

-- Publish a new rule set (definer write path; active overlapping sets are
-- superseded, never mutated).
create or replace function public.apn_rule_set_publish(
  p_code text,
  p_name text,
  p_effective_from timestamptz default now(),
  p_reason text default null,
  p_rules jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_id uuid;
  v_rule jsonb;
  v_rules jsonb := coalesce(p_rules, '[]'::jsonb);
begin
  if not (public.is_admin() or public.can_module('apn')) then
    raise exception 'Only APN administrators may publish rule sets.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'A rule set code and name are required.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(v_rules) <> 'array' or jsonb_array_length(v_rules) = 0 then
    raise exception 'A rule set must contain at least one commission rule.' using errcode = 'check_violation';
  end if;
  insert into public.apn_rule_sets (code, name, effective_from, reason, created_by)
  values (p_code, p_name, p_effective_from, p_reason, auth.uid()::text)
  returning id into v_id;
  for v_rule in select jsonb_array_elements(v_rules) loop
    if (v_rule->>'commission_type') is null or (v_rule->>'percent') is null then
      raise exception 'Each rule requires commission_type and percent.' using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.apn_commission_rules x
      where x.rule_set_id = v_id
        and x.commission_type = v_rule->>'commission_type'
        and x.tier_min = coalesce(nullif(v_rule->>'tier_min', '')::integer, 1)
        and coalesce(x.tier_max, -1) = coalesce(nullif(v_rule->>'tier_max', '')::integer, -1)
    ) then
      continue;
    end if;
    insert into public.apn_commission_rules
      (rule_set_id, commission_type, tier_min, tier_max, percent, max_percent, cap_class, priority, active)
    values (
      v_id,
      v_rule->>'commission_type',
      coalesce(nullif(v_rule->>'tier_min', '')::integer, 1),
      nullif(v_rule->>'tier_max', '')::integer,
      (v_rule->>'percent')::numeric,
      coalesce(nullif(v_rule->>'max_percent', '')::numeric, 5),
      coalesce(nullif(v_rule->>'cap_class', ''), 'secondary'),
      coalesce(nullif(v_rule->>'priority', '')::integer, 10),
      true
    );
  end loop;
  update public.apn_rule_sets set status = 'superseded', superseded_by = v_id
  where id <> v_id
    and status = 'active'
    and code = p_code;
  update public.apn_rule_sets set status = 'superseded', superseded_by = v_id
  where id <> v_id
    and code <> p_code
    and status = 'active'
    and (effective_to is null or effective_to >= p_effective_from);
  perform public.apn_rule_audit('published rule set', 'apn_rule_sets', v_id::text,
    jsonb_build_object('code', p_code, 'rules', jsonb_array_length(v_rules), 'effectiveFrom', p_effective_from));
  return jsonb_build_object('id', v_id, 'code', p_code, 'status', 'active', 'rules', jsonb_array_length(v_rules));
end;
$$;
revoke all on function public.apn_rule_set_publish(text, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.apn_rule_set_publish(text, text, timestamptz, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HIERARCHY MODEL (partner -> district_head -> state_head)
--    Mirrors crm_leads.assigned_partner_id / assigned_district_head_id /
--    assigned_state_head_id 1:1 (see apn_migrations row 'crm-assignments').
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_hierarchy_assignments (
  partner_id text primary key references public.apn_users(id) on delete restrict,
  district_head_id text references public.apn_users(id) on delete restrict,
  state_head_id text references public.apn_users(id) on delete restrict,
  effective_from timestamptz not null default now(),
  assigned_by text,
  assigned_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','reassigned')),
  check (coalesce(district_head_id, '') <> partner_id),
  check (coalesce(state_head_id, '') <> partner_id)
);

alter table public.apn_hierarchy_assignments enable row level security;
revoke all on public.apn_hierarchy_assignments from public, anon, authenticated;
grant select on public.apn_hierarchy_assignments to authenticated;
grant insert, update on public.apn_hierarchy_assignments to authenticated;

drop policy if exists apn_hierarchy_assignments_read on public.apn_hierarchy_assignments;
create policy apn_hierarchy_assignments_read on public.apn_hierarchy_assignments
  for select to authenticated
  using (public.is_superadmin() or public.is_admin()
    or partner_id = auth.uid()::text
    or district_head_id = auth.uid()::text
    or state_head_id = auth.uid()::text);

drop policy if exists apn_hierarchy_assignments_write on public.apn_hierarchy_assignments;
create policy apn_hierarchy_assignments_write on public.apn_hierarchy_assignments
  for insert to authenticated
  with check (public.is_admin());
drop policy if exists apn_hierarchy_assignments_update on public.apn_hierarchy_assignments;
create policy apn_hierarchy_assignments_update on public.apn_hierarchy_assignments
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.apn_hierarchy_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.apn_guard_operational();
  if not (public.is_admin() or public.can_module('apn')) then
    raise exception 'Only APN administrators may assign hierarchy.' using errcode = 'insufficient_privilege';
  end if;
  if new.district_head_id is not null and not exists (
    select 1 from public.apn_users u
    where u.id = new.district_head_id and coalesce(u.data->>'role', '') in ('district_head','state_head')
  ) then
    raise exception 'District head must be a district_head or state_head partner.' using errcode = 'check_violation';
  end if;
  if new.state_head_id is not null and not exists (
    select 1 from public.apn_users u
    where u.id = new.state_head_id and coalesce(u.data->>'role', '') = 'state_head'
  ) then
    raise exception 'State head must be a state_head partner.' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.apn_users u
    where u.id = new.partner_id and coalesce(u.data->>'role', '') in ('district_head','state_head')
  ) then
    raise exception 'A district/state head cannot be assigned as a regular partner.' using errcode = 'check_violation';
  end if;
  if new.partner_id in (new.district_head_id, new.state_head_id) then
    raise exception 'A partner cannot be their own head.' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.status = 'active' and old.status = 'active'
     and (new.district_head_id is distinct from old.district_head_id
       or new.state_head_id is distinct from old.state_head_id) then
    new.assigned_by := auth.uid()::text;
    new.assigned_at := now();
    new.effective_from := now();
  end if;
  return new;
end;
$$;
drop trigger if exists apn_hierarchy_guard_trg on public.apn_hierarchy_assignments;
create trigger apn_hierarchy_guard_trg
  before insert or update on public.apn_hierarchy_assignments
  for each row execute function public.apn_hierarchy_guard();

create or replace function public.apn_hierarchy_resolve(p_partner_id text)
returns jsonb
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select jsonb_build_object(
    'partnerId', partner_id,
    'districtHeadId', district_head_id,
    'stateHeadId', state_head_id,
    'effectiveFrom', effective_from
  )
  from public.apn_hierarchy_assignments
  where partner_id = p_partner_id and status = 'active'
  order by effective_from desc
  limit 1;
$$;
revoke all on function public.apn_hierarchy_resolve(text) from public, anon;
grant execute on function public.apn_hierarchy_resolve(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. IMMUTABLE COMMISSION LEDGER
--    Append-only: no client role has insert/update/delete; only SECURITY
--    DEFINER engine functions (owner bypass) write rows.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  source_id text not null,
  source_type text not null check (source_type in ('revenue_collection','project_event','referral','hierarchy','reversal','adjustment')),
  partner_id text not null references public.apn_users(id) on delete restrict,
  commission_type text not null check (commission_type in ('partner','district','state','referral')),
  base_amount numeric(14,2) not null check (base_amount >= 0),
  percent numeric(5,2) not null check (percent >= 0 and percent <= 100),
  amount numeric(14,2) not null check (amount <> 0),
  event_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text,
  reversed_by uuid references public.apn_commission_ledger(id) on delete restrict
);

alter table public.apn_commission_ledger enable row level security;
revoke all on public.apn_commission_ledger from public, anon, authenticated;
grant select on public.apn_commission_ledger to authenticated;

drop policy if exists apn_commission_ledger_read on public.apn_commission_ledger;
create policy apn_commission_ledger_read on public.apn_commission_ledger
  for select to authenticated
  using (public.is_superadmin() or public.is_admin()
    or partner_id = auth.uid()::text
    or exists (
      select 1 from public.apn_hierarchy_assignments h
      where h.status = 'active'
        and (h.district_head_id = auth.uid()::text or h.state_head_id = auth.uid()::text)
        and h.partner_id = apn_commission_ledger.partner_id
    ));

-- Record one immutable ledger entry (replay-safe via idempotency_key).
create or replace function public.apn_ledger_entry(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row public.apn_commission_ledger%rowtype;
  v_secondary numeric;
  v_total numeric;
  v_base numeric := greatest(0, coalesce(p_base_amount, 0));
  v_event timestamptz := coalesce(p_event_at, now());
  v_max_percent numeric;
begin
  if not (public.is_admin() or public.can_module('apn')) then
    raise exception 'Only APN administrators may record ledger entries.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();
  if nullif(trim(p_idempotency_key), '') is null or nullif(trim(p_source_id), '') is null then
    raise exception 'Ledger idempotency key and source id are required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.apn_users u where u.id = p_partner_id) then
    raise exception 'Unknown APN partner.' using errcode = 'foreign_key_violation';
  end if;
  select * into v_row from public.apn_commission_ledger where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_row.id, 'duplicate', true, 'amount', v_row.amount);
  end if;
  select max(r.max_percent) into v_max_percent
  from public.apn_rule_sets rs
  join public.apn_commission_rules r on r.rule_set_id = rs.id
  where rs.status = 'active'
    and rs.effective_from <= v_event
    and (rs.effective_to is null or rs.effective_to >= v_event)
    and r.commission_type = p_commission_type
    and r.active;
  if v_max_percent is not null and p_percent > v_max_percent then
    raise exception 'Rate % exceeds the active rule maximum (%) for %.', p_percent, v_max_percent, p_commission_type
      using errcode = 'check_violation';
  end if;
  if p_commission_type in ('referral','district','state') then
    select coalesce(sum(amount), 0) into v_secondary
    from public.apn_commission_ledger
    where source_id = p_source_id and source_type = p_source_type
      and commission_type in ('referral','district','state')
      and amount > 0;
    if v_secondary + p_amount > round(v_base * 15 / 100, 2) then
      raise exception 'Secondary commission cap exceeded (15%% max per event).' using errcode = 'check_violation';
    end if;
  end if;
  select coalesce(sum(amount), 0) into v_total
  from public.apn_commission_ledger
  where source_id = p_source_id and source_type = p_source_type
    and amount > 0;
  if v_total + p_amount > round(v_base * 35 / 100, 2) then
    raise exception 'Total commission cap exceeded (35%% max per event).' using errcode = 'check_violation';
  end if;
  insert into public.apn_commission_ledger
    (idempotency_key, source_id, source_type, partner_id, commission_type,
     base_amount, percent, amount, event_at, snapshot, created_by)
  values
    (p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
     v_base, p_percent, p_amount, v_event, coalesce(p_snapshot, '{}'::jsonb), auth.uid()::text)
  returning * into v_row;
  perform public.apn_rule_audit('recorded ledger entry', 'apn_commission_ledger', v_row.id::text,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'commissionType', p_commission_type,
      'amount', p_amount, 'sourceType', p_source_type));
  return jsonb_build_object('id', v_row.id, 'duplicate', false, 'amount', v_row.amount,
    'commissionType', p_commission_type);
end;
$$;
revoke all on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) from public, anon;
grant execute on function public.apn_ledger_entry(text, text, text, text, text, numeric, numeric, numeric, timestamptz, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FINANCE EXPENSE MAP (deterministic finance expense per ledger entry)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_finance_expense_map (
  ledger_id uuid primary key references public.apn_commission_ledger(id) on delete restrict,
  deterministic_id text not null unique,
  finance_transaction_id text,
  expense_type text not null check (expense_type in ('commission','reversal')),
  status text not null default 'posted' check (status in ('pending','posted','failed')),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

alter table public.apn_finance_expense_map enable row level security;
revoke all on public.apn_finance_expense_map from public, anon, authenticated;
grant select on public.apn_finance_expense_map to authenticated;

drop policy if exists apn_finance_expense_map_read on public.apn_finance_expense_map;
create policy apn_finance_expense_map_read on public.apn_finance_expense_map
  for select to authenticated
  using (public.is_superadmin() or public.is_admin() or public.can_finance());

-- Post (exactly once) the deterministic finance expense row for a ledger entry.
-- Mirrors the live expense payload shape from create_apn_income_transaction.
create or replace function public.apn_ensure_finance_expense(p_ledger_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_ledger public.apn_commission_ledger%rowtype;
  v_expense_type text;
  v_deterministic text;
  v_txn_id text;
  v_payload jsonb;
  v_mapped text;
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may post ledger expenses.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_ledger from public.apn_commission_ledger where id = p_ledger_id;
  if not found then
    raise exception 'Ledger entry not found.' using errcode = 'no_data_found';
  end if;
  select deterministic_id into v_mapped from public.apn_finance_expense_map where ledger_id = p_ledger_id;
  if v_mapped is not null then
    return jsonb_build_object('deterministicId', v_mapped, 'duplicate', true);
  end if;
  v_expense_type := case when v_ledger.source_type = 'reversal' then 'reversal' else 'commission' end;
  v_deterministic := case
    when v_ledger.source_type = 'reversal' then 'apn-expense-rev:' || coalesce(v_ledger.reversed_by::text, v_ledger.id::text)
    else 'apn-expense-ledger:' || v_ledger.id::text
  end;
  v_txn_id := v_deterministic;
  if not exists (select 1 from public.transactions where id = v_txn_id) then
    v_payload := jsonb_build_object(
      'id', v_txn_id,
      'kind', 'expense',
      'date', (v_ledger.event_at::date)::text,
      'category', 'APN ' || v_ledger.commission_type || ' commission',
      'scope', 'partner',
      'amount', v_ledger.amount,
      'notes', 'APN ' || v_ledger.commission_type || ' commission on ' || v_ledger.source_type || ' event ' || v_ledger.source_id,
      'source', 'apn-commission',
      'apnCommissionExpense', true,
      'apnPartnerId', v_ledger.partner_id,
      'apnLedgerId', v_ledger.id::text,
      'apnCommissionType', v_ledger.commission_type,
      'createdAt', (extract(epoch from now()) * 1000)::bigint::text
    );
    perform set_config('row_security', 'off', true);
    insert into public.transactions (id, data, updated_at)
    values (v_txn_id, v_payload, now())
    on conflict (id) do nothing;
  end if;
  insert into public.apn_finance_expense_map (ledger_id, deterministic_id, finance_transaction_id, expense_type, status, posted_at)
  values (p_ledger_id, v_deterministic, v_txn_id, v_expense_type, 'posted', now());
  perform public.apn_rule_audit('posted ledger expense', 'apn_finance_expense_map', p_ledger_id::text,
    jsonb_build_object('deterministicId', v_deterministic, 'expenseType', v_expense_type));
  return jsonb_build_object('deterministicId', v_deterministic, 'transactionId', v_txn_id, 'duplicate', false);
end;
$$;
revoke all on function public.apn_ensure_finance_expense(uuid) from public, anon;
grant execute on function public.apn_ensure_finance_expense(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REVERSAL MODEL (additive: original ledger entry is NEVER touched)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_reversals (
  id uuid primary key default gen_random_uuid(),
  original_ledger_id uuid not null unique references public.apn_commission_ledger(id) on delete restrict,
  reversal_ledger_id uuid unique references public.apn_commission_ledger(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  initiated_by text,
  status text not null default 'pending' check (status in ('pending','applied','rejected')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.apn_reversals enable row level security;
revoke all on public.apn_reversals from public, anon, authenticated;
grant select on public.apn_reversals to authenticated;

drop policy if exists apn_reversals_read on public.apn_reversals;
create policy apn_reversals_read on public.apn_reversals
  for select to authenticated
  using (public.is_superadmin() or public.is_admin()
    or exists (
      select 1 from public.apn_commission_ledger l
      where l.id = apn_reversals.original_ledger_id and l.partner_id = auth.uid()::text
    ));

create or replace function public.apn_create_reversal(p_original_ledger_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_orig public.apn_commission_ledger%rowtype;
  v_rev_id uuid;
  v_reversal_id uuid;
begin
  if not (public.is_admin() or public.can_finance() or public.can_module('apn')) then
    raise exception 'Only Finance or APN administrators may reverse ledger entries.' using errcode = 'insufficient_privilege';
  end if;
  perform public.apn_guard_operational();
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reversal reason is required.' using errcode = 'check_violation';
  end if;
  select * into v_orig from public.apn_commission_ledger where id = p_original_ledger_id;
  if not found then
    raise exception 'Ledger entry not found.' using errcode = 'no_data_found';
  end if;
  if v_orig.source_type = 'reversal' then
    raise exception 'A reversal entry cannot itself be reversed.' using errcode = 'check_violation';
  end if;
  if v_orig.reversed_by is not null then
    raise exception 'This ledger entry has already been reversed.' using errcode = 'duplicate_object';
  end if;
  if exists (select 1 from public.apn_reversals where original_ledger_id = p_original_ledger_id) then
    raise exception 'This ledger entry has already been reversed.' using errcode = 'duplicate_object';
  end if;
  -- Conservative guard: no reversal once a payout may have occurred for this
  -- partner after the original event (wallet-level linkage is not wired yet).
  if exists (
    select 1 from public.apn_wallet_transactions wt
    where wt.partner_id = v_orig.partner_id
      and wt.entry_type in ('payment','release')
      and wt.created_at >= v_orig.event_at
  ) then
    raise exception 'This entry cannot be reversed because funds may already have been paid out.' using errcode = 'check_violation';
  end if;
  insert into public.apn_reversals (original_ledger_id, amount, reason, initiated_by, status)
  values (p_original_ledger_id, v_orig.amount, p_reason, auth.uid()::text, 'applied')
  returning id into v_reversal_id;
  select id into v_rev_id from public.apn_commission_ledger where idempotency_key = 'rev:' || p_original_ledger_id::text;
  if v_rev_id is null then
    insert into public.apn_commission_ledger
      (idempotency_key, source_id, source_type, partner_id, commission_type,
       base_amount, percent, amount, event_at, snapshot, created_by, reversed_by)
    values
      ('rev:' || p_original_ledger_id::text, v_orig.id::text, 'reversal', v_orig.partner_id, v_orig.commission_type,
       v_orig.base_amount, v_orig.percent, -v_orig.amount, now(),
       jsonb_build_object('reversalId', v_reversal_id, 'reason', p_reason), auth.uid()::text, v_orig.id)
    returning id into v_rev_id;
  end if;
  -- Additive marker on the original (financial fields untouched): points at the
  -- counter-entry so the ledger itself shows the reversal without any rewrite.
  update public.apn_commission_ledger set reversed_by = v_rev_id where id = v_orig.id;
  update public.apn_reversals set reversal_ledger_id = v_rev_id, applied_at = now()
  where id = v_reversal_id;
  perform public.apn_ensure_finance_expense(v_rev_id);
  perform public.apn_rule_audit('applied reversal', 'apn_reversals', v_reversal_id::text,
    jsonb_build_object('originalLedgerId', p_original_ledger_id::text, 'amount', v_orig.amount));
  return jsonb_build_object('reversalId', v_reversal_id, 'reversalLedgerId', v_rev_id,
    'amount', v_orig.amount, 'additive', true);
end;
$$;
revoke all on function public.apn_create_reversal(uuid, text) from public, anon;
grant execute on function public.apn_create_reversal(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MIGRATION MAPPING FRAMEWORK
--    Every existing surface that must converge onto the engine is registered
--    as MIGRATION_REVIEW_REQUIRED. Nothing is silently rewritten.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apn_migrations (
  id text primary key,
  phase text not null,
  mapping_key text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending','review_required','completed')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  unique (phase, mapping_key)
);

alter table public.apn_migrations enable row level security;
revoke all on public.apn_migrations from public, anon, authenticated;
grant select on public.apn_migrations to authenticated;

drop policy if exists apn_migrations_read on public.apn_migrations;
create policy apn_migrations_read on public.apn_migrations for select to authenticated using (true);

insert into public.apn_migrations (id, phase, mapping_key, description, status) values
  ('engine.referral-trigger', 'engine', 'referral-trigger',
   'Wire apn_referral_collection_after_insert onto apn_commission_ledger + apn_finance_expense_map.', 'review_required'),
  ('engine.district-client', 'engine', 'district-client',
   'Replace client-side district 1% apn_commissions rows (kind=district) with engine hierarchy entries.', 'review_required'),
  ('engine.settings-rule', 'engine', 'settings-rule',
   'Converge apn_referral_settings.default_percent onto the active rule set (referral rule wins).', 'review_required'),
  ('engine.rate-function', 'engine', 'rate-function',
   'apn_commission_rate_for_project stays live; resolver fallback proves compatibility before any switchover.', 'review_required'),
  ('engine.legacy-commissions', 'engine', 'legacy-apn_commissions',
   'Backfill existing apn_commissions rows (incl. kind=district) into apn_commission_ledger.', 'review_required'),
  ('engine.withdrawal-wallets', 'engine', 'withdrawal-wallets',
   'Recompute apn_withdrawal_wallets balances from the ledger once linkage is wired.', 'review_required'),
  ('engine.app-ui', 'engine', 'app-ui',
   'AllbeeApp.jsx partner portal reads rules/ledger/hierarchy; no UI change in this work package.', 'review_required'),
  ('engine.finance-reversal', 'engine', 'finance-expense-reversal',
   'Reversal expense posting (apn-expense-rev:) is live; enable in UI when reversal screen ships.', 'review_required'),
  ('engine.crm-assignments', 'engine', 'crm-assignments',
   'Mirror crm_leads.assigned_district_head_id/assigned_state_head_id into apn_hierarchy_assignments.', 'review_required')
on conflict (id) do nothing;

create or replace function public.apn_migration_mark(
  p_phase text,
  p_mapping_key text,
  p_description text,
  p_status text default 'review_required',
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_id text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators may update migration markers.' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('pending','review_required','completed') then
    raise exception 'Invalid migration status.' using errcode = 'check_violation';
  end if;
  v_id := p_phase || '.' || p_mapping_key;
  insert into public.apn_migrations (id, phase, mapping_key, description, status, notes)
  values (v_id, p_phase, p_mapping_key, p_description, p_status, p_notes)
  on conflict (id) do update set
    status = excluded.status,
    notes = coalesce(excluded.notes, apn_migrations.notes),
    resolved_at = case when excluded.status = 'completed' then now() else apn_migrations.resolved_at end,
    resolved_by = case when excluded.status = 'completed' then auth.uid()::text else apn_migrations.resolved_by end;
  perform public.apn_rule_audit('marked migration', 'apn_migrations', v_id,
    jsonb_build_object('status', p_status, 'notes', p_notes));
  return jsonb_build_object('id', v_id, 'status', p_status);
end;
$$;
revoke all on function public.apn_migration_mark(text, text, text, text, text) from public, anon;
grant execute on function public.apn_migration_mark(text, text, text, text, text) to authenticated;

commit;

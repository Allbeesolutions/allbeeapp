-- ══════════════════════════════════════════════════════════════════════════
-- WP4 — APN PARTNER LIFECYCLE & ADMIN HUB
--   • status lifecycle (banned) + profiles→apn_users name sync trigger
--   • apn_zone_requests (auto + manual zone joins) with hub-note + notification
--   • admin hub consoles + notes (JSON-blob tables)
--   • client-level / prescription / loyalty tables (normalized, RPC-written)
--   • RPCs: zone send/approve/reject + prescription & loyalty operations
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. ADMIN HUB TABLES (JSON-blob, like the rest of the APN module) ──────
create table if not exists public.apn_admin_consoles (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_admin_notes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_zone_requests (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.apn_admin_consoles enable row level security;
alter table public.apn_admin_notes enable row level security;
alter table public.apn_zone_requests enable row level security;
grant select, insert, update, delete on public.apn_admin_consoles to authenticated;
grant select, insert, update, delete on public.apn_admin_notes to authenticated;
grant select, insert, update, delete on public.apn_zone_requests to authenticated;

-- consoles + notes: readable/writable only by the admin group.
drop policy if exists apn_admin_consoles_all on public.apn_admin_consoles;
create policy apn_admin_consoles_all on public.apn_admin_consoles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists apn_admin_notes_all on public.apn_admin_notes;
create policy apn_admin_notes_all on public.apn_admin_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- zone requests: a partner sees/creates their own; the admin group manages all.
drop policy if exists apn_zone_requests_select on public.apn_zone_requests;
create policy apn_zone_requests_select on public.apn_zone_requests
  for select to authenticated
  using (public.is_admin() or (data->>'partnerId') = auth.uid()::text);
drop policy if exists apn_zone_requests_insert on public.apn_zone_requests;
create policy apn_zone_requests_insert on public.apn_zone_requests
  for insert to authenticated
  with check (public.is_admin() or (data->>'partnerId') = auth.uid()::text);
drop policy if exists apn_zone_requests_update on public.apn_zone_requests;
create policy apn_zone_requests_update on public.apn_zone_requests
  for update to authenticated
  using (public.is_admin() and (data->>'status') in ('pending','requested'))
  with check (public.is_admin());
drop policy if exists apn_zone_requests_delete on public.apn_zone_requests;
create policy apn_zone_requests_delete on public.apn_zone_requests
  for delete to authenticated using (public.is_admin());

select public._allbee_realtime('apn_admin_consoles');
select public._allbee_realtime('apn_admin_notes');
select public._allbee_realtime('apn_zone_requests');

-- ── 2. ZONE REQUEST → HUB NOTE + NOTIFICATION TRIGGERS ─────────────────────
-- A new or handled zone request lands a note in the admin console, and the
-- handling decision notifies the partner (both are JSON-blob tables, so the
-- trigger keeps the shapes identical to what the app writes).
create or replace function public.apn_zone_request_hub_note()
-- security definer: a partner's own zone-request insert must be able to land
-- the derived hub note without tripping the admin-only RLS on consoles.
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data->>'status' in ('pending','requested') or tg_op = 'INSERT' then
    insert into public.apn_admin_consoles (id, data, updated_at)
    values (
      'console:zone:' || new.id || ':note',
      jsonb_build_object(
        'kind', 'hub-note',
        'title', 'Zone request — ' || coalesce(new.data->>'zone', 'New zone'),
        'body', coalesce(new.data->>'notes', '') || ' · by ' || (new.data->>'partnerName') || ' (' || (new.data->>'partnerId') || ')',
        'zone', new.data->>'zone',
        'partnerId', new.data->>'partnerId',
        'status', new.data->>'status',
        'createdAt', now(),
        'createdBy', coalesce(new.data->>'createdBy', 'Partner')
      ),
      now()
    )
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  end if;
  if tg_op = 'UPDATE' and new.data->>'status' in ('approved','rejected') and old.data->>'status' not in ('approved','rejected') then
    insert into public.apn_notifications (id, data, updated_at)
    values (
      'notif:zone:' || new.id,
      jsonb_build_object(
        'id', 'notif:zone:' || new.id,
        'title', case when new.data->>'status' = 'approved' then 'Zone request approved 🎉' else 'Zone request declined' end,
        'body', case when new.data->>'status' = 'approved'
               then 'Your request to join the ' || coalesce(new.data->>'zone', 'new') || ' zone was approved.'
               else 'Your zone request was declined' || case when new.data->>'note' is not null then ': ' || (new.data->>'note') else '.' end end,
        'audience', 'partner:' || (new.data->>'partnerId'),
        'level', 'Important',
        'reads', '[]'::jsonb,
        'createdAt', extract(epoch from now()) * 1000,
        'createdDate', to_char(now(), 'YYYY-MM-DD'),
        'createdTime', to_char(now(), 'HH24:MI:SS'),
        'senderName', coalesce(new.data->>'handledBy', 'ALLBEE')
      ),
      now()
    )
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  end if;
  return new;
end $$;
drop trigger if exists apn_zone_request_hub_note_trg on public.apn_zone_requests;
create trigger apn_zone_request_hub_note_trg
  after insert or update on public.apn_zone_requests
  for each row execute function public.apn_zone_request_hub_note();

-- ── 3. ZONE REQUEST RPCS ────────────────────────────────────────────────────
create or replace function public.apn_zone_requests_send(p_partner_id text, p_zone text, p_notes text default null, p_auto boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text := 'zone:' || p_partner_id || ':' || now();
  v_data jsonb;
begin
  if p_partner_id is null or p_zone is null then
    raise exception 'partner and zone are required.';
  end if;
  -- a partner may only request on their own behalf; admins may request for anyone.
  if not (public.is_admin() or auth.uid()::text = p_partner_id) then
    raise exception 'You can only send zone requests for your own account.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.apn_zone_requests z
      where z.data->>'partnerId' = p_partner_id and z.data->>'status' in ('pending','requested')) > 0 then
    raise exception 'A zone request is already pending for this partner.' using errcode = 'check_violation';
  end if;
  v_data := jsonb_build_object(
    'id', v_id,
    'partnerId', p_partner_id,
    'partnerName', coalesce((select (u.data->>'name') from public.apn_users u where u.id = p_partner_id), ''),
    'zone', p_zone,
    'status', 'pending',
    'notes', coalesce(p_notes, ''),
    'auto', p_auto,
    'createdAt', extract(epoch from now()) * 1000
  );
  insert into public.apn_zone_requests (id, data, updated_at) values (v_id, v_data, now())
  on conflict (id) do nothing;
  return v_data;
end $$;

create or replace function public.apn_zone_requests_approve(p_request_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can approve zone requests.'; end if;
  select data into v from public.apn_zone_requests where id = p_request_id;
  if v is null then raise exception 'Zone request not found.'; end if;
  if v->>'status' = 'approved' then return v; end if;
  v := v
    || jsonb_build_object(
      'status', 'approved',
      'handledAt', extract(epoch from now()) * 1000,
      'handledBy', public.current_name(),
      'note', coalesce(v->>'note', coalesce(p_note, ''))
    );
  -- reflect the new zone on the partner row the app keeps in sync too.
  update public.apn_users u
  set data = data || jsonb_build_object('zone', v->>'zone', 'updatedAt', extract(epoch from now()) * 1000)
  where u.id = v->>'partnerId';
  update public.apn_zone_requests set data = v, updated_at = now() where id = p_request_id;
  return v;
end $$;

create or replace function public.apn_zone_requests_reject(p_request_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can decline zone requests.'; end if;
  select data into v from public.apn_zone_requests where id = p_request_id;
  if v is null then raise exception 'Zone request not found.'; end if;
  if v->>'status' = 'rejected' then return v; end if;
  v := v
    || jsonb_build_object(
      'status', 'rejected',
      'handledAt', extract(epoch from now()) * 1000,
      'handledBy', public.current_name(),
      'note', coalesce(p_note, v->>'note')
    );
  update public.apn_zone_requests set data = v, updated_at = now() where id = p_request_id;
  return v;
end $$;

-- Zone request RPCs are partner/admin-facing only — never callable anonymously.
revoke execute on function public.apn_zone_requests_send(text, text, text, boolean) from anon, public;
revoke execute on function public.apn_zone_requests_approve(text, text) from anon, public;
revoke execute on function public.apn_zone_requests_reject(text, text) from anon, public;
grant execute on function public.apn_zone_requests_send(text, text, text, boolean) to authenticated;
grant execute on function public.apn_zone_requests_approve(text, text) to authenticated;
grant execute on function public.apn_zone_requests_reject(text, text) to authenticated;

-- ── 4. LIFECYCLE: allow bans (super admin) in the users guard ───────────────
create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; old_status text; new_status text;
begin
  if public.is_superadmin() then return new; end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and (new.data->>'id') <> auth.uid()::text then raise exception 'You cannot create another APN profile.'; end if;
    if not public.is_admin() then
      -- A partner may self-register straight to active ONLY when an admin has
      -- already approved+activated their profiles row (invited partner); the
      -- approval flag is admin-gated by profiles_guard, so this cannot be
      -- forged from the client.
      if (new.data->>'status') <> 'active'
        or not exists (select 1 from public.profiles p where p.id = (new.data->>'id') and p.approved and p.active) then
        new.data := jsonb_set(new.data, array['status'], '"pending"'::jsonb, true);
      end if;
      new.data := jsonb_set(new.data, array['role'], '"partner"'::jsonb, true);
      new.data := new.data - 'commissionPct' - 'attendanceScore' - 'target' - 'walletBalance' - 'revenueGenerated';
    end if;
    return new;
  end if;
  if public.is_admin() then
    -- Admin boundary: admins process lifecycle statuses but cannot edit the
    -- partner identity/rank/financial fields (only superadmin can, via the
    -- dedicated profile editor).
    foreach k in array array['name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
    end loop;
  else
    -- Self-service APN profile fields; identity, rank, financial, approval,
    -- APN-ID and lifecycle fields stay immutable to the partner.
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
    -- 'banned' is a super-admin-only status; it is NOT writable by admins
    -- (banned partners count as suspended everywhere via the app mapping).
    if new_status not in ('pending','active','inactive','rejected') then new.data := jsonb_set(new.data, array['status'], to_jsonb(old_status), true); end if;
  end if;
  return new;
end $$;
drop trigger if exists apn_users_guard_trg on public.apn_users;
create trigger apn_users_guard_trg before insert or update on public.apn_users
for each row execute function public.apn_users_guard();

-- ── 4b. DISTRICT HEAD LIFECYCLE WRITES ──────────────────────────────────────
-- A district head manages their members' lifecycle from the cockpit: they can
-- recommend reactivation, request a transfer, and log calls on member rows.
-- The base RLS only allows heads to write their OWN row, so this adds an
-- update policy for member rows in the head's own district, paired with a
-- guard that forces every protected field back to its previous value — a head
-- can touch the lifecycle keys and nothing else.
create or replace function public.apn_is_district_head_of(data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.apn_users h
    where h.id = auth.uid()::text
      and h.data->>'role' = 'district_head'
      and h.data->>'status' in ('active','inactive')
      and h.data->>'district' = data->>'district'
  );
$$;
drop policy if exists apn_users_head_update on public.apn_users;
create policy apn_users_head_update on public.apn_users
  for update to authenticated
  using (public.apn_is_district_head_of(data))
  with check (public.apn_is_district_head_of(data));
create or replace function public.apn_users_head_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if public.is_admin() or (new.data->>'id') = auth.uid()::text then return new; end if;
  if new.data->>'district' is null then return new; end if;
  if not public.apn_is_district_head_of(new.data) then return new; end if;
  foreach k in array array[
    'id','apnId','name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt','status','updatedAt','createdAt','zone','zoneApprovedAt','unlocked','quizPasses','notifReads','lastCheckIn','lastActivity','banReason','bannedBy','bannedAt','approvedAt','approvedBy','reactivatedAt','reactivatedBy'
  ] loop
    if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
  end loop;
  return new;
end $$;
drop trigger if exists apn_users_head_guard_trg on public.apn_users;
create trigger apn_users_head_guard_trg before update on public.apn_users
for each row execute function public.apn_users_head_guard();

-- A partner's display name edited in Profiles is reflected in their APN row.
create or replace function public.apn_profile_name_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.name,'') = coalesce(new.name,'') then return new; end if;
  update public.apn_users u
  set data = jsonb_set(u.data, array['name'], to_jsonb(new.name), true), updated_at = now()
  where u.id = new.id and u.data->>'name' is not null;
  return new;
end $$;
drop trigger if exists apn_profile_name_sync_trg on public.profiles;
create trigger apn_profile_name_sync_trg
  after update of name on public.profiles
  for each row execute function public.apn_profile_name_sync();

-- ── 5. CLIENT = LEVEL / PRODUCT / PRESCRIPTION / LOYALTY (normalized) ───────
create table if not exists public.apn_target_client_levels (
  partner_id text not null,
  record_id text not null primary key,
  level_key text not null,
  label text,
  goal numeric default 0,
  progress numeric default 0,
  status text default 'open',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_target_client_products (
  partner_id text not null,
  record_id text not null primary key,
  product_key text not null,
  label text,
  category text,
  price numeric default 0,
  quantity numeric default 0,
  status text default 'open',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_target_client_prescriptions (
  partner_id text not null,
  prescription_id text not null primary key,
  client_key text,
  patient_name text,
  doctor_name text,
  condition_name text,
  phase text default 'apex',
  balance numeric default 0,
  submit_count numeric default 0,
  last_submitted jsonb,
  status text default 'open',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_target_client_prescription_items (
  partner_id text not null,
  item_id text not null primary key,
  prescription_id text not null,
  item_key text not null,
  label text,
  quantity numeric default 1,
  unit text,
  amount numeric default 0,
  condition_item boolean default false,
  embed_order bigserial,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_target_client_loyalty (
  partner_id text not null,
  loyalty_id text not null primary key,
  client_key text,
  points numeric default 0,
  tier text default 'bronze',
  status text default 'active',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.apn_target_client_loyalty_rewards (
  partner_id text not null,
  reward_id text not null primary key,
  loyalty_id text,
  reward_key text not null,
  label text,
  points_cost numeric default 0,
  redeemed boolean default false,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apn_target_client_levels enable row level security;
alter table public.apn_target_client_products enable row level security;
alter table public.apn_target_client_prescriptions enable row level security;
alter table public.apn_target_client_prescription_items enable row level security;
alter table public.apn_target_client_loyalty enable row level security;
alter table public.apn_target_client_loyalty_rewards enable row level security;
grant select on public.apn_target_client_levels to authenticated;
grant select on public.apn_target_client_products to authenticated;
grant select on public.apn_target_client_prescriptions to authenticated;
grant select on public.apn_target_client_prescription_items to authenticated;
grant select on public.apn_target_client_loyalty to authenticated;
grant select on public.apn_target_client_loyalty_rewards to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'apn_target_client_levels','apn_target_client_products','apn_target_client_prescriptions',
    'apn_target_client_prescription_items','apn_target_client_loyalty','apn_target_client_loyalty_rewards'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    -- All six tables use the same owner column name: partner_id.
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin() or partner_id = auth.uid()::text)', t || '_select', t);
  end loop;
  perform public._allbee_realtime('apn_target_client_levels');
  perform public._allbee_realtime('apn_target_client_products');
  perform public._allbee_realtime('apn_target_client_prescriptions');
  perform public._allbee_realtime('apn_target_client_prescription_items');
  perform public._allbee_realtime('apn_target_client_loyalty');
  perform public._allbee_realtime('apn_target_client_loyalty_rewards');
end $$;

-- ── 6. PRESCRIPTION / LOYALTY RPCS (allow the app's numbers pipeline) ───────
-- Every RPC is owner-scoped: partners operate only on their own partner_id
-- (admin may operate on any partner). Anon has no execute on any of these.
create or replace function public.apn_add_block_interactions(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_data is null then raise exception 'data required.'; end if;
  if not (public.is_admin() or auth.uid()::text = p_data->>'partnerId') then
    raise exception 'You can only manage your own prescriptions.' using errcode = 'check_violation';
  end if;
  insert into public.apn_target_client_prescriptions (partner_id, prescription_id, client_key, patient_name, doctor_name, condition_name, phase, status, created_by, created_at, updated_at)
  values (
    p_data->>'partnerId',
    p_data->>'prescriptionId',
    p_data->>'clientKey',
    p_data->>'patientName',
    p_data->>'doctorName',
    p_data->>'conditionName',
    coalesce(p_data->>'phase', 'apex'),
    coalesce(p_data->>'status', 'open'),
    p_data->>'createdBy',
    now(), now()
  )
  on conflict (prescription_id) do update set
    client_key = excluded.client_key,
    patient_name = excluded.patient_name,
    doctor_name = excluded.doctor_name,
    condition_name = excluded.condition_name,
    phase = excluded.phase,
    status = excluded.status,
    updated_at = now()
  ;
  return p_data;
end $$;

create or replace function public.apn_add_prescription_items(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if not (public.is_admin() or auth.uid()::text = item->>'partnerId') then
      raise exception 'You can only manage your own prescription items.' using errcode = 'check_violation';
    end if;
    insert into public.apn_target_client_prescription_items (partner_id, item_id, prescription_id, item_key, label, quantity, unit, amount, condition_item, created_at, updated_at)
    values (
      item->>'partnerId', item->>'itemId', item->>'prescriptionId', item->>'itemKey',
      item->>'label', coalesce((item->>'quantity')::numeric, 1), item->>'unit',
      coalesce((item->>'amount')::numeric, 0), coalesce((item->>'conditionItem')::boolean, false),
      now(), now()
    )
    on conflict (item_id) do update set
      prescription_id = excluded.prescription_id,
      item_key = excluded.item_key,
      label = excluded.label,
      quantity = excluded.quantity,
      unit = excluded.unit,
      amount = excluded.amount,
      condition_item = excluded.condition_item,
      updated_at = now();
  end loop;
  return p_items;
end $$;

create or replace function public.apn_add_prescription_condition_items(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  p_items := coalesce(p_items, '[]'::jsonb);
  p_items := (select jsonb_agg(item || '{"conditionItem": true}') from jsonb_array_elements(p_items) item);
  return public.apn_add_prescription_items(p_items);
end $$;

create or replace function public.apn_apex_prescription_submit(p_partner_id text, p_prescription_id text, p_submission jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.uid()::text = p_partner_id) then
    raise exception 'You can only submit your own prescriptions.' using errcode = 'check_violation';
  end if;
  update public.apn_target_client_prescriptions
  set submit_count = submit_count + 1,
      last_submitted = p_submission,
      updated_at = now()
  where prescription_id = p_prescription_id and partner_id = p_partner_id;
  if not found then raise exception 'Prescription not found.'; end if;
  return p_submission;
end $$;

create or replace function public.apn_apex_prescription_balance(p_partner_id text, p_prescription_id text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if not (public.is_admin() or auth.uid()::text = p_partner_id) then
    raise exception 'You can only read your own prescription balance.' using errcode = 'check_violation';
  end if;
  select balance into v from public.apn_target_client_prescriptions
  where prescription_id = p_prescription_id and partner_id = p_partner_id;
  return coalesce(v, 0);
end $$;

create or replace function public.apn_apex_prescription_target(p_partner_id text, p_prescription_id text, p_balance numeric)
returns numeric language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.uid()::text = p_partner_id) then
    raise exception 'You can only set your own prescription targets.' using errcode = 'check_violation';
  end if;
  update public.apn_target_client_prescriptions
  set balance = coalesce(p_balance, 0), updated_at = now()
  where prescription_id = p_prescription_id and partner_id = p_partner_id;
  if not found then raise exception 'Prescription not found.'; end if;
  return coalesce(p_balance, 0);
end $$;

create or replace function public.apn_apex_mix_details(p_partner_id text, p_prescription_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.is_admin() or auth.uid()::text = p_partner_id) then
    raise exception 'You can only read your own prescription details.' using errcode = 'check_violation';
  end if;
  select jsonb_build_object(
    'prescription', to_jsonb(p),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.embed_order) from public.apn_target_client_prescription_items i where i.prescription_id = p_prescription_id), '[]'::jsonb),
    'balance', coalesce(p.balance, 0)
  ) into v
  from public.apn_target_client_prescriptions p
  where p.prescription_id = p_prescription_id and p.partner_id = p_partner_id;
  return coalesce(v, '{}'::jsonb);
end $$;

-- Prescription / loyalty RPCs are partner- and admin-facing only — never
-- callable anonymously. (The derived client tables grant SELECT to
-- authenticated only; every write goes through these audited RPCs.)
revoke execute on function public.apn_add_block_interactions(jsonb) from anon, public;
revoke execute on function public.apn_add_prescription_items(jsonb) from anon, public;
revoke execute on function public.apn_add_prescription_condition_items(jsonb) from anon, public;
revoke execute on function public.apn_apex_prescription_submit(text, text, jsonb) from anon, public;
revoke execute on function public.apn_apex_prescription_balance(text, text) from anon, public;
revoke execute on function public.apn_apex_prescription_target(text, text, numeric) from anon, public;
revoke execute on function public.apn_apex_mix_details(text, text) from anon, public;
grant execute on function public.apn_add_block_interactions(jsonb) to authenticated;
grant execute on function public.apn_add_prescription_items(jsonb) to authenticated;
grant execute on function public.apn_add_prescription_condition_items(jsonb) to authenticated;
grant execute on function public.apn_apex_prescription_submit(text, text, jsonb) to authenticated;
grant execute on function public.apn_apex_prescription_balance(text, text) to authenticated;
grant execute on function public.apn_apex_prescription_target(text, text, numeric) to authenticated;
grant execute on function public.apn_apex_mix_details(text, text) to authenticated;
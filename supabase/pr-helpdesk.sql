-- ──────────────────────────────────────────────────────────────────────────
-- Helpdesk — client support tickets for the client portal + ops staff
--
-- Clients raise tickets from the client portal; internal staff see every
-- ticket and reply/triage from the app ("Support" nav). Tickets live in
-- normalized relational tables (NOT the legacy JSON-blob writer). All writes
-- go through audited, identity-checked SECURITY DEFINER RPCs below; RLS
-- only ever allows a client to see their own tickets. Idempotent: safe to
-- re-run in the Supabase SQL Editor.
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  ticket_no   text not null default ('SUP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
  client_id   uuid not null,
  client_name text,
  client_email text,
  client_company text,
  subject     text not null,
  description text not null default '',
  category    text not null default 'General',
  priority    text not null default 'Normal',
  status      text not null default 'open',
  assignee_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);
alter table public.support_tickets add column if not exists client_name    text;
alter table public.support_tickets add column if not exists client_email   text;
alter table public.support_tickets add column if not exists client_company text;
alter table public.support_tickets add column if not exists assignee_id    uuid;
alter table public.support_tickets add column if not exists closed_at      timestamptz;
create index if not exists support_tickets_client_idx on public.support_tickets(client_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);

create table if not exists public.support_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid,
  author_name text,
  author_role text not null default 'client',
  author_public boolean not null default true,
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.support_ticket_messages add column if not exists author_public boolean not null default true;
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id);

create table if not exists public.support_ticket_audit (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid,
  author_name text,
  action      text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists support_ticket_audit_ticket_idx on public.support_ticket_audit(ticket_id);

-- ── helpers (SECURITY DEFINER avoids policy recursion) ───────────────────
create or replace function public.apn_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('superadmin','admin','accountant','staff','intern')
  );
$$;

create or replace function public.apn_can_view_ticket(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id
      and (t.client_id = auth.uid() or public.apn_is_staff())
  );
$$;

-- ── RLS: enable + drop-then-create policies ──────────────────────────────
alter table public.support_tickets           enable row level security;
alter table public.support_ticket_messages   enable row level security;
alter table public.support_ticket_audit      enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (client_id = auth.uid() or public.apn_is_staff());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert to authenticated
  with check (client_id = auth.uid() or public.apn_is_staff());

drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select on public.support_ticket_messages
  for select to authenticated
  using (public.apn_can_view_ticket(ticket_id) and (public.apn_is_staff() or author_public = true));

drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert on public.support_ticket_messages
  for insert to authenticated
  with check (public.apn_can_view_ticket(ticket_id));

drop policy if exists support_ticket_audit_select on public.support_ticket_audit;
create policy support_ticket_audit_select on public.support_ticket_audit
  for select to authenticated
  using (public.apn_is_staff() or (public.apn_can_view_ticket(ticket_id) and action = 'ticket_created'));

-- ── audited RPCs ─────────────────────────────────────────────────────────
-- Client raises a new ticket. Identity from the JWT; snapshot the client
-- profile so the ops team can see who asked even if the profile changes.
create or replace function public.apn_create_support_ticket(
  p_subject     text,
  p_description text default '',
  p_category    text default 'General',
  p_priority    text default 'Normal'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_client public.profiles%rowtype;
  v_ticket_id uuid;
begin
  select * into v_client from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Only registered clients can raise a support ticket.' using errcode = 'insufficient_privilege';
  end if;
  if v_client.role <> 'client' then
    raise exception 'Only registered clients can raise a support ticket.' using errcode = 'insufficient_privilege';
  end if;
  if v_client.approved is not true then
    raise exception 'Your client account is awaiting approval before you can raise tickets.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.support_tickets (client_id, client_name, client_email, client_company, subject, description, category, priority)
  values (auth.uid(), v_client.name, coalesce(v_client.email, ''), '', trim(p_subject), coalesce(p_description, ''), coalesce(nullif(trim(p_category), ''), 'General'), coalesce(nullif(trim(p_priority), ''), 'Normal'))
  returning id into v_ticket_id;

  insert into public.support_ticket_audit (ticket_id, author_id, author_name, action, metadata)
  values (v_ticket_id, auth.uid(), v_client.name, 'ticket_created',
          jsonb_build_object('subject', trim(p_subject), 'category', p_category, 'priority', p_priority));

  return v_ticket_id;
end $$;

-- Client posts a reply on their own ticket.
create or replace function public.apn_helpdesk_client_message(p_ticket_id uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_client public.profiles%rowtype;
  v_msg_id uuid;
begin
  select * into v_client from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Only a registered client can post on a ticket.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.support_tickets t where t.id = p_ticket_id and t.client_id = auth.uid()) then
    raise exception 'Only the owning client can post on this ticket.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_message), '') is null then
    raise exception 'Message cannot be empty.' using errcode = 'check_violation';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, author_name, author_role, body)
  values (p_ticket_id, auth.uid(), v_client.name, 'client', trim(p_message))
  returning id into v_msg_id;

  update public.support_tickets set updated_at = now()
  where id = p_ticket_id;

  return v_msg_id;
end $$;

-- Staff posts a reply / internal note on any ticket.
create or replace function public.apn_helpdesk_staff_message(
  p_ticket_id uuid,
  p_message   text,
  p_public    boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_staff public.profiles%rowtype;
  v_msg_id uuid;
begin
  if not public.apn_is_staff() then
    raise exception 'Staff access required.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_staff from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Staff access required.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(trim(p_message), '') is null then
    raise exception 'Message cannot be empty.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'Support ticket not found.' using errcode = 'no_data_found';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, author_name, author_role, body, author_public)
  values (p_ticket_id, auth.uid(), v_staff.name, 'staff', trim(p_message), coalesce(p_public, true))
  returning id into v_msg_id;

  update public.support_tickets set updated_at = now()
  where id = p_ticket_id;

  return v_msg_id;
end $$;

-- Staff triages a ticket (open / in_progress / resolved / closed).
create or replace function public.apn_set_support_ticket_status(
  p_ticket_id uuid,
  p_status    text,
  p_note      text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff public.profiles%rowtype;
begin
  if not public.apn_is_staff() then
    raise exception 'Staff access required.' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'Invalid status.' using errcode = 'check_violation';
  end if;
  select * into v_staff from public.profiles where id = auth.uid();

  update public.support_tickets
  set status = p_status,
      updated_at = now(),
      closed_at = case when p_status in ('resolved', 'closed') then now() else closed_at end
  where id = p_ticket_id;

  insert into public.support_ticket_audit (ticket_id, author_id, author_name, action, metadata)
  values (p_ticket_id, auth.uid(), v_staff.name, 'status_' || p_status,
          jsonb_build_object('note', coalesce(p_note, '')));
end $$;

-- Admin assigns a ticket to a staff member (visible to the ops team; the
-- client just sees the assigned team member).
create or replace function public.apn_assign_support_ticket(p_ticket_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_staff public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = 'insufficient_privilege';
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from public.profiles where id = p_assignee_id and role in ('superadmin','admin','accountant','staff','intern')
  ) then
    raise exception 'Assignee must be a staff member.' using errcode = 'no_data_found';
  end if;
  select * into v_staff from public.profiles where id = auth.uid();

  update public.support_tickets
  set assignee_id = p_assignee_id, updated_at = now()
  where id = p_ticket_id;

  insert into public.support_ticket_audit (ticket_id, author_id, author_name, action, metadata)
  values (p_ticket_id, auth.uid(), v_staff.name, 'assigned',
          jsonb_build_object('assignee_id', p_assignee_id));
end $$;

-- ── execution scope: no anon / PUBLIC execution ──────────────────────────
-- Helpers are invoked inside RLS policy expressions as the authenticated
-- caller, so they need EXECUTE for authenticated (and the engine roles).
-- The mutation RPCs must only ever be callable by authenticated + engine
-- roles; the role checks inside each RPC still gate who may DO what.
revoke execute on function public.apn_is_staff()                    from public, anon;
revoke execute on function public.apn_can_view_ticket(uuid)         from public, anon;
revoke execute on function public.apn_create_support_ticket(text,text,text,text) from public, anon;
revoke execute on function public.apn_helpdesk_client_message(uuid,text)         from public, anon;
revoke execute on function public.apn_helpdesk_staff_message(uuid,text,boolean)  from public, anon;
revoke execute on function public.apn_set_support_ticket_status(uuid,text,text)  from public, anon;
revoke execute on function public.apn_assign_support_ticket(uuid,uuid)           from public, anon;

grant execute on function public.apn_is_staff()                    to authenticated, service_role, postgres;
grant execute on function public.apn_can_view_ticket(uuid)         to authenticated, service_role, postgres;
grant execute on function public.apn_create_support_ticket(text,text,text,text) to authenticated, service_role, postgres;
grant execute on function public.apn_helpdesk_client_message(uuid,text)         to authenticated, service_role, postgres;
grant execute on function public.apn_helpdesk_staff_message(uuid,text,boolean)  to authenticated, service_role, postgres;
grant execute on function public.apn_set_support_ticket_status(uuid,text,text)  to authenticated, service_role, postgres;
grant execute on function public.apn_assign_support_ticket(uuid,uuid)           to authenticated, service_role, postgres;

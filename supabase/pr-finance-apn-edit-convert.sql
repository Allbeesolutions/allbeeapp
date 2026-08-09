-- =============================================================================
-- ALLBEE — APN finance income EDIT + CONVERT (unified income form)
-- File: supabase/pr-finance-apn-edit-convert.sql
-- Runs AFTER pr-finance-apn-commission-reconcile.sql.
--
-- Root cause fixed: editing an existing NORMAL income and enabling APN
-- attribution sent the income's OWN id into the create RPC, which read it as
-- a duplicate → "This finance entry already exists." The RPC now takes an
-- explicit p_mode and routes accordingly:
--
--   create  — unchanged: fresh income + project + collections + commission
--             expense, all duplicate guards intact.
--   edit    — p_transaction.id already exists AND carries an apnProjectId.
--             Anchors on THAT project (a partner+name+client match on a
--             different project is a collision → refused; the project may be
--             missing → orphan restore). The incoming p_collections REPLACE
--             the project's collection set (stale rows deleted, existing rows
--             updated, new rows inserted), the income amount becomes the new
--             total, the commission expense is recomputed and upserted under
--             its deterministic id, project totals/status recomputed. A
--             project cannot be reassigned to another partner.
--   convert — p_transaction.id exists WITHOUT an apnProjectId (normal income).
--             Creates/attaches the APN project exactly like 'create' (canonical
--             partner+name+client attach; duplicate guard still blocks a second
--             posting on an already-posted project). The form's collections are
--             inserted alongside any existing ones; the matching commission
--             expense is posted; the income KEEPS its own id so audit/history
--             links stay intact.
--
-- Detach (APN → normal) stays a client-side unlink (income loses its APN
-- attributes; the commission expense and APN project remain on the books) —
-- no SQL here.
--
-- The finance-lock trigger (fin_lock_guard) fires on every transaction write
-- (INSERT/UPDATE/DELETE), so editing into a locked month is still blocked for
-- everyone except a superadmin — nothing here bypasses it.
--
-- Idempotent: drops the old 3-arg signature first (a 4-arg function with a
-- default would make 3-arg calls ambiguous), then create-or-replace the
-- 4-arg one. Safe to re-run. Zero DML on existing data.
-- =============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. create_apn_income_transaction(p_transaction, p_project, p_collections,
--    p_mode) — create / edit / convert with explicit routing.
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.create_apn_income_transaction(jsonb, jsonb, jsonb);

create or replace function public.create_apn_income_transaction(
  p_transaction jsonb,
  p_project jsonb,
  p_collections jsonb default '[]'::jsonb,
  p_mode text default 'create'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_mode text := lower(trim(coalesce(p_mode, 'create')));
  v_transaction_id text := nullif(p_transaction->>'id', '');
  v_project_id text := nullif(p_project->>'id', '');
  v_partner_id text := nullif(p_project->>'partnerId', '');
  v_project_value numeric := greatest(0, coalesce(nullif(p_project->>'projectValue', '')::numeric, 0));
  v_rate numeric := coalesce(nullif(p_project->>'commissionRate', '')::numeric, 0);
  v_existing_id text := null;
  v_prev_project_id text := null;
  v_anchor_project_exists bool := false;
  v_attach bool := false;
  v_haji_pct numeric := greatest(0, least(100, coalesce(nullif(p_transaction->>'hajiPct', '')::numeric, 50)));
  v_alim_pct numeric := greatest(0, least(100, coalesce(nullif(p_transaction->>'alimPct', '')::numeric, 50)));
  v_max numeric := 0;
  v_received numeric := 0;
  v_earned numeric := 0;
  v_new_received numeric := 0;
  v_new_earned numeric := 0;
  v_status text;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_ids text[] := array[]::text[];
  v_normalized jsonb := '[]'::jsonb;
  v_project_payload jsonb;
  v_transaction_payload jsonb;
  v_expense_payload jsonb;
  v_expense_id text := 'apn-expense:' || v_transaction_id;
  v_date text := coalesce(p_transaction->>'date', current_date::text);
  v_other_id text := null;
  v_stored_value numeric := null;
  v_stored_rate numeric := null;
  item jsonb;
  normalized_item jsonb;
  v_id text;
  v_amount numeric;
  v_incentive numeric;
  v_commission numeric;
begin
  if v_mode not in ('create', 'edit', 'convert') then
    raise exception 'Unknown APN finance mode "%".', p_mode using errcode = 'check_violation';
  end if;
  if not public.can_finance() then
    raise exception 'Only Finance users can create APN income entries.' using errcode = 'insufficient_privilege';
  end if;
  if v_transaction_id is null or v_project_id is null or v_partner_id is null then
    raise exception 'Finance transaction, APN project, and partner ids are required.' using errcode = 'check_violation';
  end if;
  if coalesce(p_transaction->>'kind', 'income') <> 'income' then
    raise exception 'An APN commission entry must be an income transaction.' using errcode = 'check_violation';
  end if;
  if nullif(trim(p_project->>'projectName'), '') is null or nullif(trim(p_project->>'clientName'), '') is null then
    raise exception 'Partner, project name, and client name are required.' using errcode = 'check_violation';
  end if;
  if v_project_value <= 0 or v_rate < 0 or v_rate > 100 then
    raise exception 'Project value must be positive and commission rate must be between 0 and 100.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(coalesce(p_collections, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_collections, '[]'::jsonb)) = 0 then
    raise exception 'At least one APN collection is required.' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.apn_users u
    where u.id = v_partner_id
      and coalesce(u.data->>'status', 'pending') = 'active'
  ) then
    raise exception 'APN income requires an active partner.' using errcode = 'check_violation';
  end if;

  -- Transaction existence: create requires the id to be FREE; edit/convert
  -- require it to already EXIST (its own id must never be a duplicate).
  if v_mode = 'create' then
    if exists (select 1 from public.transactions where id = v_transaction_id) then
      raise exception 'This finance entry already exists.' using errcode = 'duplicate_object',
        detail = jsonb_build_object('kind', 'finance', 'transactionId', v_transaction_id,
          'projectId', nullif((select data->>'apnProjectId' from public.transactions where id = v_transaction_id), ''))::text;
    end if;
  else
    if not exists (select 1 from public.transactions where id = v_transaction_id) then
      raise exception 'This finance entry does not exist yet — save it as a new entry instead.' using errcode = 'foreign_key_violation';
    end if;
    select data->>'apnProjectId' into v_prev_project_id
    from public.transactions where id = v_transaction_id;
    if nullif(v_prev_project_id, '') is null then v_prev_project_id := null; end if;
  end if;

  -- ── Resolve the canonical APN project ────────────────────────────────────
  if v_mode = 'edit' and v_prev_project_id is not null then
    -- The income already posts to its own project; the form anchors there.
    v_project_id := v_prev_project_id;
    -- Same partner+name+client on a DIFFERENT project → the form tried to
    -- reuse another project's identity. Refuse (one project per name).
    select p.id into v_other_id
    from public.apn_commission_projects p
    where p.id <> v_project_id
      and coalesce(p.partner_id, p.data->>'partnerId') = v_partner_id
      and lower(trim(coalesce(p.project_name, p.data->>'projectName', p.data->>'project', ''))) = lower(trim(p_project->>'projectName'))
      and lower(trim(coalesce(p.client_name, p.data->>'clientName', ''))) = lower(trim(p_project->>'clientName'))
      and coalesce(p.status, p.data->>'status', '') <> 'Cancelled'
    limit 1;
    if v_other_id is not null then
      raise exception 'Another APN project already uses this partner, project and client name.' using errcode = 'unique_violation',
        detail = jsonb_build_object('kind', 'project-name-collision', 'projectId', v_other_id)::text;
    end if;
    -- The project may be missing (orphan finance row) → value/rate come from
    -- the form and the project row is recreated below. If present, the form
    -- may update value/rate but never the partner. Stage into separate vars:
    -- a zero-row SELECT INTO would otherwise null the form's value/rate.
    select project_value, commission_rate, coalesce(partner_id, p.data->>'partnerId')
      into v_stored_value, v_stored_rate, v_other_id
    from public.apn_commission_projects p where id = v_project_id;
    if found then
      v_anchor_project_exists := true;
      v_project_value := v_stored_value;
      v_rate := v_stored_rate;
      if nullif(v_other_id, '') is not null and v_other_id <> v_partner_id then
        raise exception 'A commission project cannot be reassigned to another partner.' using errcode = 'check_violation';
      end if;
    end if;
  else
    -- create / convert / edit-without-prev-project: canonical resolution —
    -- exact id first, then partner+name+client (cancelled projects excluded).
    select p.id into v_existing_id
    from public.apn_commission_projects p
    where (p.id = v_project_id
           or (coalesce(p.partner_id, p.data->>'partnerId') = v_partner_id
               and lower(trim(coalesce(p.project_name, p.data->>'projectName', p.data->>'project', ''))) = lower(trim(p_project->>'projectName'))
               and lower(trim(coalesce(p.client_name, p.data->>'clientName', ''))) = lower(trim(p_project->>'clientName'))
               and coalesce(p.status, p.data->>'status', '') <> 'Cancelled'))
    order by case when p.id = v_project_id then 0 else 1 end
    limit 1;

    if v_existing_id is not null then
      v_project_id := v_existing_id;
      -- Duplicate guard: only the entry being edited may be this project's
      -- posted income; any OTHER posting is refused.
      if exists (
        select 1 from public.transactions t
        where t.data->>'apnProjectId' = v_project_id
          and t.data->>'kind' = 'income'
          and t.id <> v_transaction_id
      ) then
        raise exception 'An APN commission already exists for this project.' using errcode = 'duplicate_object',
          detail = jsonb_build_object('kind', 'project-posted', 'projectId', v_project_id)::text;
      end if;
      v_attach := true;
      -- The APN project owns value/rate; the finance form must not diverge.
      select project_value, commission_rate into v_project_value, v_rate
      from public.apn_commission_projects where id = v_project_id;
      if abs(v_project_value - greatest(0, coalesce(nullif(p_project->>'projectValue', '')::numeric, 0))) > 0.01
         or abs(v_rate - coalesce(nullif(p_project->>'commissionRate', '')::numeric, 0)) > 0.01 then
        raise exception 'This commission project already exists with a value of % and a commission rate of %. Edit the APN project to change them.',
          to_char(v_project_value, 'FM999G999G990D00'), to_char(v_rate, 'FM999G999G990D00')
          using errcode = 'check_violation',
            detail = jsonb_build_object('kind', 'project-attach', 'projectId', v_project_id, 'projectValue', v_project_value, 'commissionRate', v_rate)::text;
      end if;
      select coalesce(sum(received_amount), 0), coalesce(sum(commission_generated), 0)
      into v_received, v_earned
      from public.apn_revenue_collections where project_id = v_project_id;
      if v_received > v_project_value then
        raise exception 'Existing collections exceed the project value.' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  v_max := round(v_project_value * v_rate / 100, 2);

  for item in select value from jsonb_array_elements(p_collections) loop
    v_id := nullif(item->>'id', '');
    if v_id is null or v_id = any(v_ids) then
      raise exception 'Each APN collection must have a unique id.' using errcode = 'unique_violation';
    end if;
    v_ids := array_append(v_ids, v_id);
    if exists (select 1 from public.apn_revenue_collections where id = v_id) then
      if exists (select 1 from public.apn_revenue_collections where id = v_id and project_id <> v_project_id) then
        raise exception 'Collection id is already assigned to another project.' using errcode = 'unique_violation';
      end if;
      -- create/attach + convert keep existing rows untouched (their amounts are
      -- already in the running totals seeded from the database); edit rewrites
      -- them from the form (full replacement).
      if not (v_mode = 'edit' and v_prev_project_id is not null) then
        continue;
      end if;
    end if;
    v_amount := coalesce(nullif(item->>'receivedAmount', '')::numeric, 0);
    if v_amount <= 0 then
      raise exception 'Collection amounts must be greater than zero.' using errcode = 'check_violation';
    end if;
    v_incentive := coalesce(nullif(item->>'incentive', '')::numeric, 0);
    if v_incentive < 0 then
      raise exception 'Incentives cannot be negative.' using errcode = 'check_violation';
    end if;
    if v_received + v_amount > v_project_value then
      raise exception 'Collections cannot exceed the project value.' using errcode = 'check_violation';
    end if;
    v_commission := least(greatest(0, v_max - v_earned), round(v_amount * v_rate / 100, 2));
    v_normalized := v_normalized || jsonb_build_array(
      item || jsonb_build_object(
        'projectId', v_project_id,
        'partnerId', v_partner_id,
        'receivedAmount', v_amount,
        'commissionGenerated', v_commission,
        'incentive', v_incentive,
        'commissionStatus', case lower(trim(coalesce(item->>'commissionStatus', 'pending')))
          when 'approved' then 'Approved'
          when 'payable' then 'Payable'
          when 'paid' then 'Paid'
          else 'Pending'
        end,
        'createdBy', coalesce(item->>'createdBy', public.current_name()),
        'createdAt', coalesce(item->>'createdAt', v_now_ms::text),
        'receivedDate', coalesce(nullif(item->>'receivedDate', ''), current_date::text)
      )
    );
    v_received := v_received + v_amount;
    v_earned := v_earned + v_commission;
    v_new_received := v_new_received + v_amount;
    v_new_earned := v_new_earned + v_commission;
  end loop;

  v_status := case when v_received >= v_project_value then 'Completed' else 'Processing' end;
  v_project_payload := p_project || jsonb_build_object(
    'partnerId', v_partner_id,
    'projectValue', v_project_value,
    'commissionRate', v_rate,
    'maximumCommission', v_max,
    'totalReceived', round(v_received, 2),
    'remainingAmount', greatest(0, round(v_project_value - v_received, 2)),
    'remainingCommission', greatest(0, round(v_max - v_earned, 2)),
    'status', v_status,
    'createdAt', coalesce(p_project->>'createdAt', v_now_ms::text),
    'updatedAt', v_now_ms
  );

  -- Single transaction boundary: any trigger/RPC error aborts everything,
  -- including both finance rows.
  perform set_config('row_security', 'off', true);
  insert into public.apn_commission_projects (id, data, updated_at)
  values (v_project_id, v_project_payload, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();

  -- Edit mode replaces the project's collection set wholesale: rows the form
  -- no longer shows are dropped; kept rows are updated; new rows inserted.
  if v_mode = 'edit' and v_prev_project_id is not null then
    delete from public.apn_revenue_collections
    where project_id = v_project_id and not (id = any(v_ids));
  end if;
  for normalized_item in select value from jsonb_array_elements(v_normalized) loop
    if exists (select 1 from public.apn_revenue_collections where id = normalized_item->>'id') then
      update public.apn_revenue_collections set data = normalized_item, updated_at = now()
      where id = normalized_item->>'id';
    else
      insert into public.apn_revenue_collections (id, data, updated_at)
      values (normalized_item->>'id', normalized_item, now());
    end if;
  end loop;

  v_transaction_payload := p_transaction || jsonb_build_object(
    'kind', 'income',
    'amount', round(v_new_received, 2),
    'apnProjectId', v_project_id,
    'apnCollectionIds', to_jsonb(v_ids),
    'apnCollectionId', case when array_length(v_ids, 1) = 1 then v_ids[1] else null end,
    'apnCommissionExpenseId', v_expense_id,
    'apnPostedToExistingProject', case when v_attach or v_mode = 'edit' then true else null end,
    'createdAt', coalesce(p_transaction->>'createdAt', v_now_ms::text)
  );
  if v_mode = 'create' then
    insert into public.transactions (id, data, updated_at)
    values (v_transaction_id, v_transaction_payload, now());
  else
    update public.transactions set data = v_transaction_payload, updated_at = now()
    where id = v_transaction_id;
  end if;

  -- Commission expense: one accounting impact per posting, split mirroring the
  -- income's own split. Deterministic id keeps retries idempotent.
  v_expense_payload := jsonb_build_object(
    'id', v_expense_id,
    'kind', 'expense',
    'client', p_project->>'clientName',
    'project', p_project->>'projectName',
    'amount', round(v_new_earned, 2),
    'date', v_date,
    'category', 'APN Commission',
    'scope', 'project',
    'hajiPct', v_haji_pct,
    'alimPct', v_alim_pct,
    'notes', format('APN partner commission for %s — %s%% of %s posted through finance (%s).',
      p_project->>'clientName', to_char(v_rate, 'FM990.0'), to_char(v_new_received, 'FM999G999G990D00'), p_project->>'projectName'),
    'source', 'apn-commission',
    'apnProjectId', v_project_id,
    'apnCommissionExpense', true,
    'apnCommissionOfIncome', v_transaction_id,
    'apnPartnerId', v_partner_id,
    'createdAt', coalesce(p_transaction->>'createdAt', v_now_ms::text)
  );
  insert into public.transactions (id, data, updated_at)
  values (v_expense_id, v_expense_payload, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();

  if v_mode = 'create' then
    insert into public.apn_timeline (id, data, updated_at)
    values (
      'apn-timeline:' || v_partner_id || ':finance-commission:' || v_project_id,
      jsonb_build_object('id', 'apn-timeline:' || v_partner_id || ':finance-commission:' || v_project_id,
        'partnerId', v_partner_id, 'eventType', 'finance-commission-created',
        'title', 'APN commission income recorded',
        'description', format('%s received for %s; commission %s.', to_char(v_new_received, 'FM999G999G990D00'), p_project->>'projectName', to_char(v_new_earned, 'FM999G999G990D00')),
        'relatedId', v_project_id, 'performedBy', coalesce(public.current_name(), 'Finance'), 'createdAt', v_now_ms), now()
    ) on conflict (id) do nothing;
    insert into public.apn_notifications (id, data, updated_at)
    values (
      'apn-notification:commission-project:' || v_project_id,
      jsonb_build_object('id', 'apn-notification:commission-project:' || v_project_id,
        'title', 'Income recorded', 'body', format('%s received for %s. Commission credited: %s.', to_char(v_new_received, 'FM999G999G990D00'), p_project->>'projectName', to_char(v_new_earned, 'FM999G999G990D00')),
        'audience', 'partner:' || v_partner_id, 'partnerId', v_partner_id, 'level', 'Important', 'priority', 'Normal',
        'metadata', jsonb_build_object('projectId', v_project_id, 'transactionId', v_transaction_id),
        'senderName', coalesce(public.current_name(), 'ALLBEE'), 'senderDesignation', 'Finance', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
        'createdAt', v_now_ms, 'reads', '[]'::jsonb), now()
    ) on conflict (id) do nothing;
    insert into public.notifications (id, data, updated_at)
    values (
      'apn-notification:commission-project:' || v_project_id,
      jsonb_build_object('id', 'apn-notification:commission-project:' || v_project_id,
        'title', 'Income recorded', 'body', format('%s received for %s.', to_char(v_new_received, 'FM999G999G990D00'), p_project->>'projectName'),
        'audience', 'partner:' || v_partner_id, 'partnerId', v_partner_id, 'module', 'APN', 'priority', 'Normal',
        'metadata', jsonb_build_object('projectId', v_project_id, 'transactionId', v_transaction_id),
        'senderName', coalesce(public.current_name(), 'ALLBEE'), 'senderDesignation', 'Finance', 'senderRole', 'System', 'senderAvatar', '/allbee-icon.png',
        'createdAt', v_now_ms, 'reads', '[]'::jsonb), now()
    ) on conflict (id) do nothing;
    insert into public.audit (id, data, updated_at)
    values (
      'apn-audit:commission-project:' || v_project_id,
      jsonb_build_object('id', 'apn-audit:commission-project:' || v_project_id, 'ts', v_now_ms,
        'user', coalesce(public.current_name(), 'Finance'), 'userId', auth.uid()::text,
        'action', case when v_attach then 'recorded APN commission income (attached to existing project)' else 'recorded APN commission income' end,
        'module', 'Finance', 'entity', 'APN Commission Project', 'entityId', v_project_id,
        'metadata', jsonb_build_object('transactionId', v_transaction_id, 'expenseId', v_expense_id,
          'partnerId', v_partner_id, 'receivedAmount', v_new_received, 'commissionExpense', v_new_earned,
          'attachedToExistingProject', v_attach, 'hajiSplit', v_haji_pct, 'alimSplit', v_alim_pct)), now()
    ) on conflict (id) do nothing;
  else
    insert into public.audit (id, data, updated_at)
    values (
      'apn-audit:commission-' || v_mode || ':' || v_transaction_id,
      jsonb_build_object('id', 'apn-audit:commission-' || v_mode || ':' || v_transaction_id, 'ts', v_now_ms,
        'user', coalesce(public.current_name(), 'Finance'), 'userId', auth.uid()::text,
        'action', case when v_mode = 'edit' then 'updated APN commission income' else 'converted normal income to APN commission' end,
        'module', 'Finance', 'entity', 'APN Commission Project', 'entityId', v_project_id,
        'metadata', jsonb_build_object('transactionId', v_transaction_id, 'expenseId', v_expense_id,
          'partnerId', v_partner_id, 'postedReceived', v_new_received, 'commissionExpense', v_new_earned,
          'hajiSplit', v_haji_pct, 'alimSplit', v_alim_pct, 'mode', v_mode,
          'collectionsReplaced', v_mode = 'edit')), now()
    ) on conflict (id) do nothing;
    insert into public.apn_timeline (id, data, updated_at)
    values (
      'apn-timeline:finance-commission-' || v_mode || ':' || v_transaction_id,
      jsonb_build_object('id', 'apn-timeline:finance-commission-' || v_mode || ':' || v_transaction_id,
        'partnerId', v_partner_id, 'eventType', 'finance-commission-' || v_mode,
        'title', case when v_mode = 'edit' then 'APN commission income updated' else 'APN commission income recorded' end,
        'description', format('%s posted for %s; commission %s.', to_char(v_new_received, 'FM999G999G990D00'), p_project->>'projectName', to_char(v_new_earned, 'FM999G999G990D00')),
        'relatedId', v_project_id, 'performedBy', coalesce(public.current_name(), 'Finance'), 'createdAt', v_now_ms), now()
    ) on conflict (id) do nothing;
  end if;

  return jsonb_build_object('projectId', v_project_id, 'transactionId', v_transaction_id,
    'expenseId', v_expense_id, 'collectionIds', to_jsonb(v_ids),
    'postedReceived', round(v_new_received, 2), 'commissionExpense', round(v_new_earned, 2),
    'status', v_status, 'mode', case when v_mode = 'edit' then 'edited' when v_mode = 'convert' then 'converted' when v_attach then 'attached' else 'created' end);
end;
$$;

revoke all on function public.create_apn_income_transaction(jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_apn_income_transaction(jsonb, jsonb, jsonb, text) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

-- =============================================================================
-- Verification checklist (run AFTER this batch — read-only):
--   1. create (new income, new project): unchanged behaviour, returns mode
--      'created', one income + one deterministic expense row.
--   2. create against an existing unposted project: 'attached', no second
--      project, existing collections untouched.
--   3. create duplicate (same transaction id / posted project): still raises
--      duplicate_object 'This finance entry already exists.' / 'An APN
--      commission already exists for this project.'
--   4. edit (existing APN income): mode 'edited'; income amount becomes the
--      new collection total; stale collections deleted, kept rows updated,
--      new rows inserted; expense upserted with recomputed commission; audit +
--      timeline rows written; a second posting on the project still refused.
--   5. edit with a partner+name+client matching ANOTHER project: refused
--      (project-name-collision). edit with a different partner on the anchored
--      project: refused (reassignment).
--   6. edit of an orphan APN income (project row missing): project recreated
--      from the form, collection set created, expense upserted.
--   7. convert (existing normal income + APN attribution): mode 'converted';
--      the income keeps its id; project created/attached; the form's
--      collections inserted alongside existing ones; expense created; a second
--      posting on an already-posted project refused.
--   8. edit/convert into a locked month: fin_lock_guard still blocks the
--      UPDATE unless the actor is a superadmin.
--   9. Grants: only authenticated has EXECUTE on the 4-arg signature; the old
--      3-arg signature no longer exists.
-- =============================================================================

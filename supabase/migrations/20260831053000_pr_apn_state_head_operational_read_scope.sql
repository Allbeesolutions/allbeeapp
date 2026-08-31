-- State Head read scope for the operational APN cockpit.
-- Read-only visibility is state-scoped; financial mutation and withdrawals remain protected.
create or replace function public.apn_state_head_partner_scope(p_partner_id text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.apn_users u
    where u.id = p_partner_id
      and public.apn_state_head_scope(u.data)
  );
$$;

grant execute on function public.apn_state_head_partner_scope(text) to authenticated;

-- JSON-backed operational tables.
drop policy if exists apn_leads_state_head_select on public.apn_leads;
create policy apn_leads_state_head_select on public.apn_leads for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_commissions_state_head_select on public.apn_commissions;
create policy apn_commissions_state_head_select on public.apn_commissions for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_attendance_state_head_select on public.apn_attendance;
create policy apn_attendance_state_head_select on public.apn_attendance for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_targets_state_head_select on public.apn_targets;
create policy apn_targets_state_head_select on public.apn_targets for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_achievements_state_head_select on public.apn_achievements;
create policy apn_achievements_state_head_select on public.apn_achievements for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_training_state_head_select on public.apn_training;
create policy apn_training_state_head_select on public.apn_training for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_quizzes_state_head_select on public.apn_quizzes;
create policy apn_quizzes_state_head_select on public.apn_quizzes for select to authenticated
  using (public.apn_state_head_scope(data));
-- Scalar partner-owned operational tables.
drop policy if exists apn_commission_projects_state_head_select on public.apn_commission_projects;
create policy apn_commission_projects_state_head_select on public.apn_commission_projects for select to authenticated
  using (public.apn_state_head_partner_scope(partner_id));

drop policy if exists apn_revenue_collections_state_head_select on public.apn_revenue_collections;
create policy apn_revenue_collections_state_head_select on public.apn_revenue_collections for select to authenticated
  using (public.apn_state_head_partner_scope(partner_id));

drop policy if exists apn_commission_ledger_state_head_select on public.apn_commission_ledger;
create policy apn_commission_ledger_state_head_select on public.apn_commission_ledger for select to authenticated
  using (public.apn_state_head_partner_scope(partner_id));

drop policy if exists apn_hierarchy_assignments_state_head_select on public.apn_hierarchy_assignments;
create policy apn_hierarchy_assignments_state_head_select on public.apn_hierarchy_assignments for select to authenticated
  using (state_head_id = auth.uid()::text or public.apn_state_head_partner_scope(partner_id));
-- Partner documents/notes/timeline/warnings/communications are operational context.
drop policy if exists apn_documents_state_head_select on public.apn_documents;
create policy apn_documents_state_head_select on public.apn_documents for select to authenticated
  using (public.apn_state_head_scope(data) or (data->>'partnerId') is null);

drop policy if exists apn_notes_state_head_select on public.apn_notes;
create policy apn_notes_state_head_select on public.apn_notes for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_timeline_state_head_select on public.apn_timeline;
create policy apn_timeline_state_head_select on public.apn_timeline for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_warnings_state_head_select on public.apn_warnings;
create policy apn_warnings_state_head_select on public.apn_warnings for select to authenticated
  using (public.apn_state_head_scope(data));

drop policy if exists apn_communications_state_head_select on public.apn_communications;
create policy apn_communications_state_head_select on public.apn_communications for select to authenticated
  using (public.apn_state_head_scope(data));

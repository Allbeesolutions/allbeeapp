-- =============================================================================
-- ALLBEE — APN Rule Engine Foundation: privilege fix (incremental)
--
-- Supabase's ALTER DEFAULT PRIVILEGES grants ALL on newly created tables to
-- anon/authenticated/service_role. The foundation migration therefore left
-- `authenticated` with INSERT/UPDATE/DELETE on the new tables. This fix
-- explicitly revokes authenticated on every new table and re-grants only the
-- intended privileges (idempotent: safe to re-run).
--
-- Grant state after this migration:
--   apn_system_controls        SELECT + UPDATE (policy gates superadmin-only)
--   apn_rule_sets              SELECT only
--   apn_commission_rules       SELECT only
--   apn_hierarchy_assignments  SELECT + INSERT + UPDATE (policy gates admin)
--   apn_commission_ledger      SELECT only (append-only; engine writes only)
--   apn_finance_expense_map    SELECT only (finance/admin read policy)
--   apn_reversals              SELECT only
--   apn_migrations             SELECT only
--   apn_rule_audit             NO grants (immutable)
-- =============================================================================

revoke all on public.apn_system_controls from public, anon, authenticated;
grant select on public.apn_system_controls to authenticated;
grant update on public.apn_system_controls to authenticated;

revoke all on public.apn_rule_audit from public, anon, authenticated;

revoke all on public.apn_rule_sets from public, anon, authenticated;
revoke all on public.apn_commission_rules from public, anon, authenticated;
grant select on public.apn_rule_sets to authenticated;
grant select on public.apn_commission_rules to authenticated;

revoke all on public.apn_hierarchy_assignments from public, anon, authenticated;
grant select on public.apn_hierarchy_assignments to authenticated;
grant insert, update on public.apn_hierarchy_assignments to authenticated;

revoke all on public.apn_commission_ledger from public, anon, authenticated;
grant select on public.apn_commission_ledger to authenticated;

revoke all on public.apn_finance_expense_map from public, anon, authenticated;
grant select on public.apn_finance_expense_map to authenticated;

revoke all on public.apn_reversals from public, anon, authenticated;
grant select on public.apn_reversals to authenticated;

revoke all on public.apn_migrations from public, anon, authenticated;
grant select on public.apn_migrations to authenticated;

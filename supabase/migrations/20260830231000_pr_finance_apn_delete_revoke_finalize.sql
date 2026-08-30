-- Finalize the finance-deletion APN state after the canonical reversal path.
-- Some legacy project-sync paths can recalculate a project status from its
-- historical totals during the reversal. Reassert Cancelled as the terminal
-- APN state before the finance rows are removed from the active ledger.

create or replace function public.apn_finalize_finance_income_revoke(p_transaction_id text, p_reason text default 'Finance income entry deleted')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_result jsonb;
  v_project_id text;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Finance income entry deleted');
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  v_result := public.apn_revoke_finance_income(p_transaction_id, v_reason);
  v_project_id := nullif(v_result->>'projectId', '');

  if v_project_id is not null then
    update public.apn_commission_projects
    set status = 'Cancelled',
        data = data || jsonb_build_object(
          'status', 'Cancelled',
          'cancelledAt', now(),
          'cancelledBy', auth.uid()::text,
          'cancellationReason', v_reason,
          'updatedAt', v_now_ms
        ),
        updated_at = now()
    where id = v_project_id;
  end if;

  return v_result || jsonb_build_object('status', 'Revoked', 'projectStatus', 'Cancelled');
end;
$$;

revoke all on function public.apn_finalize_finance_income_revoke(text, text) from public, anon;
grant execute on function public.apn_finalize_finance_income_revoke(text, text) to authenticated;

select pg_notify('pgrst', 'reload schema');

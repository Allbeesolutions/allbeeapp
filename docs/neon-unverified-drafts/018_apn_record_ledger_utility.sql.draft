-- =============================================================================
-- ALLBEE — APN Ledger Recording Utility (Neon Port)
-- File: database/neon/018_apn_record_ledger_utility.sql
--
-- Ported from: supabase/migrations/20260831100000_pr_apn_commission_distribution_finance_details.sql
-- =============================================================================

begin;

create or replace function public.apn_record_ledger_and_expense(
  p_idempotency_key text,
  p_source_id text,
  p_source_type text,
  p_partner_id text,
  p_commission_type text,
  p_base_amount numeric,
  p_percent numeric,
  p_amount numeric,
  p_event_at timestamptz,
  p_snapshot jsonb,
  p_eligible_from date default null
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.apn_ledger_record_safe(
    p_idempotency_key, p_source_id, p_source_type, p_partner_id, p_commission_type,
    p_base_amount, p_percent, p_amount, p_event_at, p_snapshot, p_eligible_from);
  v_id := nullif(v_result->>'id', '')::uuid;
  if v_id is not null then
    begin
      perform public.apn_ensure_finance_expense(v_id);
    exception when others then
      perform public.apn_rule_audit('finance deduction deferred', 'apn_commission_ledger', v_id::text,
        jsonb_build_object('error', SQLERRM, 'commissionType', p_commission_type, 'amount', p_amount));
    end;
  end if;
  return v_result;
end;
$$;

revoke all on function public.apn_record_ledger_and_expense(text,text,text,text,text,numeric,numeric,numeric,timestamptz,jsonb,date) from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';

-- Finalize the one-time APN test cleanup after the canonical reversal path.
-- A legacy status-sync trigger can recalculate status from historical totals;
-- the explicit Cancelled state is the authoritative terminal state here.

do $$
declare
  v_project_id text := 'mtg4lq6y-4qtxf';
  v_partner_id text := '2e755d09-64df-48cf-9a18-02edb3d823f9';
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  update public.apn_commission_projects
  set status = 'Cancelled',
      data = data || jsonb_build_object(
        'status', 'Cancelled',
        'cancelledAt', coalesce(data->'cancelledAt', to_jsonb(now())),
        'cancelledBy', coalesce(data->>'cancelledBy', '15304189-bdab-443d-a016-43d0c6e3c0d0'),
        'cancellationReason', coalesce(data->>'cancellationReason', 'Repair: finance income was deleted before APN revoke support existed.'),
        'updatedAt', v_now_ms
      ),
      updated_at = now()
  where id = v_project_id;

  perform public.apn_consolidated_wallet_refresh(v_partner_id);
end;
$$;

select pg_notify('pgrst', 'reload schema');

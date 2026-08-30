-- One-time production repair for the APN test income that was deleted before
-- the finance->APN revoke path existed. Preserve ledger/history; do not erase it.
-- Exact project id is the stale 2026-08-30 ₹10,000 / 10% test project.

do $$
declare
  v_project_id text := 'mtg4lq6y-4qtxf';
  v_partner_id text := '2e755d09-64df-48cf-9a18-02edb3d823f9';
  v_status text;
begin
  -- Run the canonical reversal path as the known active Super Admin actor.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '3d0bf186-70d2-48b5-851c-9d556860511c')::text,
    true
  );

  select status into v_status
  from public.apn_commission_projects
  where id = v_project_id;

  if v_status is not null and v_status <> 'Cancelled' then
    perform public.apn_commission_cancel_project(
      v_project_id,
      'Repair: finance income was deleted before APN revoke support existed.'
    );
  end if;

  perform public.apn_consolidated_wallet_refresh(v_partner_id);
end;
$$;

select pg_notify('pgrst', 'reload schema');

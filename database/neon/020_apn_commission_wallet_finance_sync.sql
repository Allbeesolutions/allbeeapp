-- =============================================================================
-- ALLBEE — APN Commission Wallet Finance Sync (Neon Port)
-- File: database/neon/020_apn_commission_wallet_finance_sync.sql
--
-- Ported from: supabase/migrations/20260903050000_apn_commission_wallet_finance_sync.sql
-- =============================================================================

begin;

create or replace function public.apn_valid_head_recipient(p_partner_id text, p_role text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1
    from public.apn_users u
    where u.id = p_partner_id
      and coalesce(u.data->>'status', 'active') not in ('inactive','suspended','deleted')
      and coalesce(u.data->>'role','') = p_role
  );
$$;
revoke all on function public.apn_valid_head_recipient(text,text) from public, anon;
grant execute on function public.apn_valid_head_recipient(text,text) to authenticated;

create or replace function public.apn_ledger_collection_after_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_rate numeric;
  v_dhead text;
  v_shead text;
  v_drate numeric;
  v_srate numeric;
  v_damt numeric;
  v_samt numeric;
  v_eligible date;
  v_event timestamptz;
  v_partner_name text;
  v_client_name text;
  v_project_name text;
  v_district text;
  v_state text;
begin
  if tg_op = 'DELETE' then
    if old.partner_id is not null then perform public.apn_consolidated_wallet_refresh(old.partner_id); end if;
    return old;
  end if;
  if new.partner_id is null or coalesce(new.received_amount, 0) <= 0 then return new; end if;
  v_eligible := public.apn_commission_eligibility_date(new.received_date);
  v_event := coalesce(new.created_at, new.received_date::timestamptz, now());
  select coalesce(u.data->>'name','APN Partner'), coalesce(u.data->>'district',''), coalesce(u.data->>'state','')
    into v_partner_name, v_district, v_state from public.apn_users u where u.id = new.partner_id;
  select p.project_name, p.client_name into v_project_name, v_client_name
    from public.apn_commission_projects p where p.id = new.project_id;

  if coalesce(new.commission_generated, 0) > 0 then
    select commission_rate into v_rate from public.apn_commission_projects where id = new.project_id;
    perform public.apn_record_ledger_and_expense(
      'col:' || new.id || ':partner', new.id, 'revenue_collection', new.partner_id, 'partner',
      new.received_amount, coalesce(v_rate, 0), new.commission_generated, v_event,
      jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
        'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
        'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
        'recipientRole', 'partner', 'source', 'commission-distribution-v2'), v_eligible);

    select district_head_id, state_head_id into v_dhead, v_shead
      from public.apn_hierarchy_assignments where partner_id = new.partner_id and status = 'active' limit 1;

    if v_dhead is not null and public.apn_valid_head_recipient(v_dhead, 'district_head') then
      v_drate := coalesce(public.apn_commission_rate_for('district'), 1);
      v_damt := round(new.received_amount * v_drate / 100, 2);
      if v_damt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':district', new.id, 'revenue_collection', v_dhead, 'district',
          new.received_amount, v_drate, v_damt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'district_head', 'recipientId', v_dhead, 'scope', 'district-collections', 'source', 'commission-distribution-v2'), v_eligible);
      end if;
    end if;

    if v_shead is not null and public.apn_valid_head_recipient(v_shead, 'state_head') then
      v_srate := coalesce(public.apn_commission_rate_for('state'), 1);
      v_samt := round(new.received_amount * v_srate / 100, 2);
      if v_samt > 0 then
        perform public.apn_record_ledger_and_expense(
          'col:' || new.id || ':state', new.id, 'revenue_collection', v_shead, 'state',
          new.received_amount, v_srate, v_samt, v_event,
          jsonb_build_object('projectId', new.project_id, 'receivedDate', new.received_date::text,
            'sourcePartnerId', new.partner_id, 'sourcePartnerName', v_partner_name,
            'clientName', v_client_name, 'projectName', v_project_name, 'district', v_district, 'state', v_state,
            'recipientRole', 'state_head', 'recipientId', v_shead, 'scope', 'all-state-collections', 'source', 'commission-distribution-v2'), v_eligible);
      end if;
    end if;
  end if;

  perform public.apn_consolidated_wallet_refresh(new.partner_id);
  if v_dhead is not null then perform public.apn_consolidated_wallet_refresh(v_dhead); end if;
  if v_shead is not null then perform public.apn_consolidated_wallet_refresh(v_shead); end if;
  return new;
end;
$$;

drop trigger if exists apn_ledger_collection_trg on public.apn_revenue_collections;
create trigger apn_ledger_collection_trg after insert or update or delete on public.apn_revenue_collections
for each row execute function public.apn_ledger_collection_after_change();

commit;
notify pgrst, 'reload schema';

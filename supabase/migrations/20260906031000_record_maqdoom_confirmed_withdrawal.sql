-- Record the user-confirmed historical APN commission withdrawal.
-- Maqdoom Ahmed received the ₹600 partner commission already posted for the
-- Python class project. There was no corresponding paid withdrawal row in the
-- normalized withdrawal tables, so the consolidated wallet still treated the
-- ₹600 as unwithdrawn. This forward-only correction records the settlement as
-- paid; it does not alter the immutable commission ledger or Finance expense.
begin;

do $$
declare
  v_partner text := 'c5305cf2-ed17-4b9b-97a9-d05cc9744fc7';
  v_id uuid;
  v_when timestamptz := now();
begin
  if not exists (
    select 1 from public.apn_withdrawal_requests
    where partner_id=v_partner
      and wallet_type='commission'
      and status='paid'
      and round(public.apn_withdrawal_request_amount(requested_amount,approved_amount,status),2)=600
  ) then
    insert into public.apn_withdrawal_requests
      (partner_id,wallet_type,requested_amount,approved_amount,preferred_method,
       bank_snapshot,status,reason,notes,review_reason,requested_at,reviewed_at,
       reviewed_by,processing_at,paid_at,settlement_reference,data,updated_at)
    values
      (v_partner,'commission',600,600,'bank_transfer','{}'::jsonb,'paid',
       'Historical settlement correction',
       'Historical ₹600 APN partner commission withdrawal confirmed by the user; normalized paid-withdrawal record was missing.',
       'Corrected from confirmed settlement history.',v_when,v_when,
       '15304189-bdab-443d-a016-43d0c6e3c0d0',v_when,v_when,
       'HIST-MAQDOOM-600',
       jsonb_build_object('correction','confirmed_historical_withdrawal',
         'partnerName','Mohamed Maqdoom Ahmed','amount',600,
         'sourceCommissionLedgerId','da62b74c-7e60-415e-a44b-895684de1c90'),v_when)
    returning id into v_id;
  end if;
end $$;

-- Recompute the partner's consolidated wallet after the paid settlement is
-- represented. The existing request trigger also performs this automatically;
-- this explicit call makes the correction deterministic if the trigger is ever
-- changed in a future schema version.
select public.apn_consolidated_wallet_refresh('c5305cf2-ed17-4b9b-97a9-d05cc9744fc7');

commit;
notify pgrst,'reload schema';

-- Production root fix: make withdrawal projections consume the same immutable
-- commission ledger that powers the APN Home/Wallet, and restore the proven
-- SQL conversation listing implementation to eliminate PL/pgSQL name ambiguity.
begin;

create or replace function public.apn_withdrawal_source_totals(p_partner_id text, p_wallet_type text)
returns table (pending numeric, approved numeric, withdrawable numeric, external_paid numeric, lifetime numeric, monthly numeric, today numeric)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if p_wallet_type = 'referral' then
    return query
    with l as (
      select amount,event_at,coalesce(eligible_from,event_at::date) eligible_on
      from public.apn_commission_ledger
      where partner_id=p_partner_id and commission_type='referral'
    )
    select
      coalesce(sum(amount) filter(where amount>0 and eligible_on>current_date),0),
      0::numeric,
      coalesce(sum(amount) filter(where eligible_on<=current_date),0),
      coalesce((select sum(w.amount) from public.apn_referral_withdrawals w where w.partner_id=p_partner_id and w.status='paid'),0),
      coalesce(sum(amount) filter(where amount>0),0),
      coalesce(sum(amount) filter(where amount>0 and event_at>=date_trunc('month',now())),0),
      coalesce(sum(amount) filter(where amount>0 and event_at::date=current_date),0)
    from l;
  elsif p_wallet_type = 'incentive' then
    return query select
      coalesce(sum(c.incentive) filter(where c.commission_status='Pending'),0),
      coalesce(sum(c.incentive) filter(where c.commission_status='Approved'),0),
      coalesce(sum(c.incentive) filter(where c.commission_status='Payable'),0),
      coalesce(sum(c.incentive) filter(where c.commission_status='Paid'),0),
      coalesce(sum(c.incentive),0),
      coalesce(sum(c.incentive) filter(where c.created_at>=date_trunc('month',now())),0),
      coalesce(sum(c.incentive) filter(where c.received_date=current_date),0)
    from public.apn_revenue_collections c where c.partner_id=p_partner_id;
  else
    return query
    with l as (
      select amount,event_at,coalesce(eligible_from,event_at::date) eligible_on,commission_type
      from public.apn_commission_ledger
      where partner_id=p_partner_id
        and commission_type in ('partner','district','state','adjustment','reversal','recovery')
    )
    select
      coalesce(sum(amount) filter(where amount>0 and commission_type not in ('reversal','recovery') and eligible_on>current_date),0),
      0::numeric,
      greatest(0,coalesce(sum(amount) filter(where eligible_on<=current_date),0)),
      coalesce((select sum(public.apn_withdrawal_request_amount(r.requested_amount,r.approved_amount,r.status)) from public.apn_withdrawal_requests r where r.partner_id=p_partner_id and r.wallet_type='commission' and r.status='paid'),0),
      coalesce(sum(amount) filter(where amount>0 and commission_type not in ('reversal','recovery')),0),
      coalesce(sum(amount) filter(where amount>0 and commission_type not in ('reversal','recovery') and event_at>=date_trunc('month',now())),0),
      coalesce(sum(amount) filter(where amount>0 and commission_type not in ('reversal','recovery') and event_at::date=current_date),0)
    from l;
  end if;
end;
$$;

-- Recompute all active partner projections immediately from authoritative ledger.
do $$ declare r record; begin
  for r in select u.id from public.apn_users u where lower(coalesce(u.data->>'status','active')) not in ('inactive','suspended','deleted') loop
    perform public.apn_consolidated_wallet_refresh(r.id);
    perform public.apn_withdrawal_refresh_wallet(r.id);
    perform public.apn_referral_refresh_wallet(r.id);
  end loop;
end $$;

-- SQL-language version avoids PL/pgSQL output-variable/column collisions entirely.
drop function if exists public.apn_list_conversations();
create function public.apn_list_conversations()
returns table(conversation_id uuid,conv_type text,subject text,last_message text,last_sender_id text,last_at timestamptz,unread_count bigint,participant_count bigint)
language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select c.id,c.type,c.subject,lm.body,lm.sender_id,lm.message_created_at,
         coalesce(uc.unread_count,0)::bigint,coalesce(pc.participant_count,0)::bigint
  from public.apn_chat_conversations c
  cross join lateral (
    select 1 where public.is_admin() or exists(
      select 1 from public.apn_chat_participants mine
      where mine.conversation_id=c.id and mine.participant_id=auth.uid()::text)
  ) visible
  left join lateral (
    select m.body,m.sender_id,m.created_at as message_created_at
    from public.apn_chat_messages m where m.conversation_id=c.id
    order by m.created_at desc limit 1
  ) lm on true
  left join lateral (
    select count(*) unread_count from public.apn_chat_messages um
    where um.conversation_id=c.id and um.sender_id<>auth.uid()::text
      and um.created_at>coalesce((select max(rs.updated_at) from public.apn_chat_read_states rs where rs.conversation_id=c.id and rs.participant_id=auth.uid()::text),'epoch'::timestamptz)
  ) uc on true
  left join lateral (select count(*) participant_count from public.apn_chat_participants cp where cp.conversation_id=c.id) pc on true
  order by c.updated_at desc;
$$;
revoke all on function public.apn_list_conversations() from public,anon;
grant execute on function public.apn_list_conversations() to authenticated;

-- Also harden the two chat functions that return a created_at column: output
-- names in PL/pgSQL are variables, so every underlying reference must be qualified.
create or replace function public.apn_edit_message(p_message_id uuid,p_body text)
returns table(ok boolean,edited_at timestamptz) language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_self text:=auth.uid()::text; v_created timestamptz; v_now timestamptz:=now(); begin
 if p_body is null or length(trim(p_body))=0 then raise exception 'Message body is required.' using errcode='22000'; end if;
 if length(p_body)>2000 then raise exception 'Message is too long.' using errcode='22000'; end if;
 select m.created_at into v_created from public.apn_chat_messages m where m.id=p_message_id and m.sender_id=v_self;
 if v_created is null then raise exception 'Message not found or not yours.' using errcode='P0002'; end if;
 if v_now-v_created>interval '5 minutes' then raise exception 'Message can only be edited for five minutes.' using errcode='P0002'; end if;
 update public.apn_chat_messages m set body=trim(p_body),edited_at=v_now,updated_at=v_now where m.id=p_message_id and m.sender_id=v_self;
 return query select true,v_now;
end $$;
grant execute on function public.apn_edit_message(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

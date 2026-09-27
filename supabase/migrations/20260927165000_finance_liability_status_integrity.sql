-- Financial liabilities survive account-status changes.
-- Suspending/deleting an APN login must never erase money already earned and unpaid.
begin;

create or replace function public.finance_account_balances()
returns jsonb
language plpgsql
security definer
volatile
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_haji numeric := 0;
  v_alim numeric := 0;
  v_company numeric := 0;
  v_apn_unwithdrawn numeric := 0;
  v_partners jsonb := '[]'::jsonb;
  r record;
begin
  if not public.can_finance() then
    raise exception 'Finance balance access denied.' using errcode='insufficient_privilege';
  end if;

  -- Refresh every APN identity, not only active logins. Financial liability is
  -- independent from access status and remains until withdrawal/reversal settles it.
  for r in select u.id from public.apn_users u loop
    perform public.apn_consolidated_wallet_refresh(r.id);
  end loop;

  select
    coalesce(sum(case
      when lower(coalesce(t.data->>'kind',''))='income' then coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'hajiPct')::numeric,0) / 100
      when lower(coalesce(t.data->>'kind',''))='expense' and lower(coalesce(t.data->>'source',''))<>'apn-withdrawal' then -coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'hajiPct')::numeric,0) / 100
      else 0 end),0),
    coalesce(sum(case
      when lower(coalesce(t.data->>'kind',''))='income' then coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'alimPct')::numeric,0) / 100
      when lower(coalesce(t.data->>'kind',''))='expense' and lower(coalesce(t.data->>'source',''))<>'apn-withdrawal' then -coalesce((t.data->>'amount')::numeric,0) * coalesce((t.data->>'alimPct')::numeric,0) / 100
      else 0 end),0)
  into v_haji, v_alim
  from public.transactions t;

  v_haji := v_haji - coalesce((select sum(coalesce((w.data->>'amount')::numeric,0)) from public.withdrawals w where w.data->>'user'='Haji' and lower(coalesce(w.data->>'status','approved')) not in ('pending','rejected')),0);
  v_alim := v_alim - coalesce((select sum(coalesce((w.data->>'amount')::numeric,0)) from public.withdrawals w where w.data->>'user'='Alim' and lower(coalesce(w.data->>'status','approved')) not in ('pending','rejected')),0);
  v_company := round(v_haji + v_alim,2);

  with liability_wallets as (
    select
      w.partner_id,
      coalesce(u.data->>'name',u.data->>'username','APN Partner') as name,
      coalesce(u.data->>'apn_id',u.data->>'apnId','') as apn_id,
      coalesce(u.data->>'status','unknown') as status,
      coalesce(u.data->>'role','partner') as role,
      coalesce(w.earned,0) as earned,
      coalesce(w.pending,0) as pending,
      coalesce(w.eligible,0) as eligible,
      coalesce(w.total_balance,0) as total_balance,
      coalesce(w.reserved,0) as reserved,
      coalesce(w.withdrawable,0) as withdrawable,
      coalesce(w.withdrawn,0) as withdrawn,
      coalesce(w.reversed,0) as reversed,
      greatest(0,coalesce(w.earned,0)-coalesce(w.withdrawn,0)) as unwithdrawn
    from public.apn_consolidated_wallets w
    left join public.apn_users u on u.id=w.partner_id
  )
  select
    coalesce(sum(unwithdrawn),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'partner_id',partner_id,'name',name,'apn_id',apn_id,'status',status,'role',role,
      'earned',round(earned,2),'pending',round(pending,2),'eligible',round(eligible,2),
      'total_balance',round(total_balance,2),'reserved',round(reserved,2),
      'withdrawable',round(withdrawable,2),'withdrawn',round(withdrawn,2),
      'reversed',round(reversed,2),'unwithdrawn',round(unwithdrawn,2)
    ) order by unwithdrawn desc,name),'[]'::jsonb)
  into v_apn_unwithdrawn,v_partners
  from liability_wallets;

  return jsonb_build_object(
    'generated_at',now(),
    'haji',round(v_haji,2),
    'alim',round(v_alim,2),
    'company',v_company,
    'apn_unwithdrawn',round(v_apn_unwithdrawn,2),
    'account',round(v_company+v_apn_unwithdrawn,2),
    'partner_balances',v_partners
  );
end $$;

revoke all on function public.finance_account_balances() from public,anon;
grant execute on function public.finance_account_balances() to authenticated;

-- Bring every historical liability projection up to today's eligibility date now.
do $$ declare r record; begin
  for r in select id from public.apn_users loop
    perform public.apn_consolidated_wallet_refresh(r.id);
  end loop;
end $$;

commit;
notify pgrst,'reload schema';

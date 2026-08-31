-- State Head operational actions that must not require broad UPDATE access.
create or replace function public.apn_state_head_partner_action(p_partner_id text, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_now timestamptz := now(); v_ms bigint := (extract(epoch from v_now)*1000)::bigint;
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' then raise exception 'Only partners can receive this State Head action.' using errcode='check_violation'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if p_action = 'log_call' then
    update public.apn_users set data = data || jsonb_build_object('lastHeadCallAt',v_ms,'lastHeadCallBy',public.current_name()), updated_at=v_now where id=p_partner_id;
    return jsonb_build_object('lastHeadCallAt',v_ms,'lastHeadCallBy',public.current_name());
  elsif p_action = 'recommend_reactivation' then
    if coalesce(v_data->>'status','') not in ('inactive','suspended') then raise exception 'Reactivation can only be recommended for inactive or suspended partners.' using errcode='check_violation'; end if;
    update public.apn_users set data = data || jsonb_build_object('reactivationRecommended',v_ms,'reactivationRecommendedBy',public.current_name()), updated_at=v_now where id=p_partner_id;
    return jsonb_build_object('reactivationRecommended',v_ms,'reactivationRecommendedBy',public.current_name());
  else
    raise exception 'Unsupported State Head action.' using errcode='invalid_parameter_value';
  end if;
end;
$$;

revoke all on function public.apn_state_head_partner_action(text,text) from public, anon;
grant execute on function public.apn_state_head_partner_action(text,text) to authenticated;

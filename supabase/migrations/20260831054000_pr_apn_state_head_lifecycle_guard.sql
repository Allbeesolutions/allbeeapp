-- Never let a State Head lifecycle RPC mutate an admin identity.
-- A malformed/stale APN row must not become a privilege-escalation path.
create or replace function public.apn_state_head_approve_partner(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_profile_role text; v_at timestamptz := now(); v_name text;
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be approved.' using errcode='check_violation'; end if;
  select role into v_profile_role from public.profiles where id=p_partner_id::uuid;
  if v_profile_role in ('admin','superadmin') then raise exception 'This identity is administrator-controlled and cannot be approved by a State Head.' using errcode='insufficient_privilege'; end if;
  v_name := coalesce(v_data->>'name','Partner');
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set role='partner', approved=true, active=true, status='active' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(jsonb_set(data,'{status}','"active"'::jsonb,true),'{approvedAt}',to_jsonb((extract(epoch from v_at)*1000)::bigint),true),'{approvedBy}',to_jsonb(public.current_name()),true),'{rejectedAt}','null'::jsonb,true), updated_at=v_at where id=p_partner_id;
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','active','approvedBy',public.current_name());
end;
$$;

create or replace function public.apn_state_head_reject_partner(p_partner_id text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_profile_role text; v_at timestamptz := now(); v_name text; v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be rejected.' using errcode='check_violation'; end if;
  select role into v_profile_role from public.profiles where id=p_partner_id::uuid;
  if v_profile_role in ('admin','superadmin') then raise exception 'This identity is administrator-controlled and cannot be rejected by a State Head.' using errcode='insufficient_privilege'; end if;
  v_name := coalesce(v_data->>'name','Partner');
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set approved=false, active=false, status='terminated' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(data,'{status}','"rejected"'::jsonb,true),'{rejectReason}',to_jsonb(v_reason),true),'{rejectedBy}',to_jsonb(public.current_name()),true), updated_at=v_at where id=p_partner_id;
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','rejected','reason',v_reason,'rejectedBy',public.current_name());
end;
$$;

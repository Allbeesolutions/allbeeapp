-- Persist State Head lifecycle notifications and audit events server-side.
create or replace function public.apn_state_head_approve_partner(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_profile_role text; v_at timestamptz := now(); v_ms bigint := (extract(epoch from v_at)*1000)::bigint; v_name text; v_actor text; v_audit_id text; v_notification_id text; v_approver jsonb;
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be approved.' using errcode='check_violation'; end if;
  select role into v_profile_role from public.profiles where id=p_partner_id::uuid;
  if v_profile_role in ('admin','superadmin') then raise exception 'This identity is administrator-controlled and cannot be approved by a State Head.' using errcode='insufficient_privilege'; end if;
  v_name := coalesce(v_data->>'name','Partner'); v_actor := public.current_name();
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set role='partner', approved=true, active=true, status='active' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(jsonb_set(data,'{status}','"active"'::jsonb,true),'{approvedAt}',to_jsonb(v_ms),true),'{approvedBy}',to_jsonb(v_actor),true),'{rejectedAt}','null'::jsonb,true), updated_at=v_at where id=p_partner_id;
  v_notification_id := 'apn-approval-' || p_partner_id || '-' || v_ms;
  v_approver := jsonb_build_object('name',v_actor,'designation','State Head');
  insert into public.apn_notifications(id,data,updated_at) values (v_notification_id,jsonb_build_object('id',v_notification_id,'title','Welcome to APN 🎉','body','Your partner account has been approved by your State Head.','audience','partner:'||p_partner_id,'partnerId',p_partner_id,'level','Important','reads','[]'::jsonb,'createdAt',v_ms,'approvedBy',v_approver,'senderName',v_actor,'senderRole','State Head','senderDesignation','State Head'),v_at);
  v_audit_id := 'apn-state-head-' || p_partner_id || '-' || v_ms;
  insert into public.audit(id,data,updated_at) values (v_audit_id,jsonb_build_object('id',v_audit_id,'ts',v_ms,'user',v_actor,'userId',auth.uid()::text,'action','approved APN partner "'||v_name||'"','module','APN','entity','Partner','entityId',p_partner_id,'description','State Head approved pending APN partner application.'),v_at);
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','active','approvedAt',v_ms,'approvedBy',v_actor);
end;
$$;

create or replace function public.apn_state_head_reject_partner(p_partner_id text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_profile_role text; v_at timestamptz := now(); v_ms bigint := (extract(epoch from v_at)*1000)::bigint; v_name text; v_actor text; v_audit_id text; v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be rejected.' using errcode='check_violation'; end if;
  select role into v_profile_role from public.profiles where id=p_partner_id::uuid;
  if v_profile_role in ('admin','superadmin') then raise exception 'This identity is administrator-controlled and cannot be rejected by a State Head.' using errcode='insufficient_privilege'; end if;
  v_name := coalesce(v_data->>'name','Partner'); v_actor := public.current_name();
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set approved=false, active=false, status='terminated' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(data,'{status}','"rejected"'::jsonb,true),'{rejectReason}',to_jsonb(v_reason),true),'{rejectedBy}',to_jsonb(v_actor),true), updated_at=v_at where id=p_partner_id;
  v_audit_id := 'apn-state-head-reject-' || p_partner_id || '-' || v_ms;
  insert into public.audit(id,data,updated_at) values (v_audit_id,jsonb_build_object('id',v_audit_id,'ts',v_ms,'user',v_actor,'userId',auth.uid()::text,'action','rejected APN application "'||v_name||'"','module','APN','entity','Partner','entityId',p_partner_id,'description',coalesce(v_reason,'State Head rejected pending APN partner application.')),v_at);
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','rejected','rejectReason',v_reason,'rejectedBy',v_actor,'rejectedAt',v_ms);
end;
$$;

-- Re-assert caller access after CREATE OR REPLACE.
revoke all on function public.apn_state_head_approve_partner(text) from public, anon;
revoke all on function public.apn_state_head_reject_partner(text,text) from public, anon;
grant execute on function public.apn_state_head_approve_partner(text) to authenticated;
grant execute on function public.apn_state_head_reject_partner(text,text) to authenticated;

create or replace function public.apn_state_head_partner_action(p_partner_id text, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_now timestamptz := now(); v_ms bigint := (extract(epoch from v_now)*1000)::bigint; v_actor text; v_audit_id text; v_label text;
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' then raise exception 'Only partners can receive this State Head action.' using errcode='check_violation'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  v_actor := public.current_name();
  if p_action = 'log_call' then
    update public.apn_users set data = data || jsonb_build_object('lastHeadCallAt',v_ms,'lastHeadCallBy',v_actor), updated_at=v_now where id=p_partner_id;
    v_label := 'logged head call for "'||coalesce(v_data->>'name','Partner')||'"';
    v_audit_id := 'apn-state-head-call-' || p_partner_id || '-' || v_ms;
    insert into public.audit(id,data,updated_at) values (v_audit_id,jsonb_build_object('id',v_audit_id,'ts',v_ms,'user',v_actor,'userId',auth.uid()::text,'action',v_label,'module','APN','entity','Partner','entityId',p_partner_id,'description','State Head logged a partner call.'),v_now);
    return jsonb_build_object('lastHeadCallAt',v_ms,'lastHeadCallBy',v_actor);
  elsif p_action = 'recommend_reactivation' then
    if coalesce(v_data->>'status','') not in ('inactive','suspended') then raise exception 'Reactivation can only be recommended for inactive or suspended partners.' using errcode='check_violation'; end if;
    update public.apn_users set data = data || jsonb_build_object('reactivationRecommended',v_ms,'reactivationRecommendedBy',v_actor), updated_at=v_now where id=p_partner_id;
    v_label := 'recommended reactivation for "'||coalesce(v_data->>'name','Partner')||'"';
    v_audit_id := 'apn-state-head-reactivate-' || p_partner_id || '-' || v_ms;
    insert into public.audit(id,data,updated_at) values (v_audit_id,jsonb_build_object('id',v_audit_id,'ts',v_ms,'user',v_actor,'userId',auth.uid()::text,'action',v_label,'module','APN','entity','Partner','entityId',p_partner_id,'description','State Head recommended partner reactivation.'),v_now);
    return jsonb_build_object('reactivationRecommended',v_ms,'reactivationRecommendedBy',v_actor);
  else
    raise exception 'Unsupported State Head action.' using errcode='invalid_parameter_value';
  end if;
end;
$$;
revoke all on function public.apn_state_head_partner_action(text,text) from public, anon;
grant execute on function public.apn_state_head_partner_action(text,text) to authenticated;

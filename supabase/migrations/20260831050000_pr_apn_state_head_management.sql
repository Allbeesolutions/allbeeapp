-- APN State Head management: state-scoped visibility + partner approval/rejection.
-- State Heads receive lifecycle authority only for partners inside their scope.
-- Financial, hierarchy assignment, deletion and Super Admin-only controls remain protected.

create or replace function public.apn_state_head_scope(p_data jsonb)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role = 'state_head'
      and me.active = true
      and coalesce(me.status, 'active') not in ('suspended','terminated')
      and (
        exists (select 1 from public.apn_hierarchy_assignments h
          where h.partner_id = coalesce(p_data->>'id','')
            and h.state_head_id = auth.uid()::text
            and h.status = 'active')
        or (
          nullif(trim(p_data->>'state'),'') is not null
          and lower(trim(p_data->>'state')) = lower(trim(coalesce((select u.data->>'state' from public.apn_users u where u.id=auth.uid()::text),'')))
        )
        or (
          upper(coalesce(p_data->>'apnId','')) like 'APN-TN-%'
          and upper(coalesce((select u.data->>'apnId' from public.apn_users u where u.id=auth.uid()::text),'')) like 'APN-TN-%'
        )
      )
  );
$$;

revoke all on function public.apn_state_head_scope(jsonb) from public, anon;
grant execute on function public.apn_state_head_scope(jsonb) to authenticated;

drop policy if exists apn_users_state_head_select on public.apn_users;
create policy apn_users_state_head_select on public.apn_users
  for select to authenticated using (public.apn_state_head_scope(data));

-- State Head lifecycle updates are enabled only through the RPCs below. The
-- transaction-local flag is checked by both JSON-row and profiles guards.
create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; old_status text; new_status text;
        state_head_action boolean := current_setting('app.apn_state_head_lifecycle', true) = '1';
begin
  if public.is_superadmin() then return new; end if;
  if state_head_action and public.apn_state_head_scope(new.data) then
    foreach k in array array['id','apnId','name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt','quizPasses','unlocked','notifReads','lastCheckIn','lastActivity','zone','zoneApprovedAt'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true); else new.data := new.data - k; end if;
    end loop;
    if coalesce(new.data->>'status','') not in ('active','inactive','rejected','pending') then new.data := jsonb_set(new.data,array['status'],to_jsonb(old.data->>'status'),true); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and (new.data->>'id') <> auth.uid()::text then raise exception 'You cannot create another APN profile.'; end if;
    if not public.is_admin() then
      if (new.data->>'status') <> 'active' or not exists (select 1 from public.profiles p where p.id=(new.data->>'id') and p.approved and p.active) then new.data := jsonb_set(new.data,array['status'],'"pending"'::jsonb,true); end if;
      new.data := jsonb_set(new.data,array['role'],'"partner"'::jsonb,true);
      new.data := new.data - 'commissionPct' - 'attendanceScore' - 'target' - 'walletBalance' - 'revenueGenerated';
    end if;
    return new;
  end if;
  if public.is_admin() then
    foreach k in array array['name','username','email','mobile','alternateNumber','gender','dob','country','state','district','taluk','city','pincode','address','level','target','targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt'] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true); else new.data := new.data-k; end if;
    end loop;
    foreach k in array array['quizPasses','unlocked','notifReads','lastCheckIn','lastActivity','reactivationRequested','reactivationRecommended'] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true); else new.data := new.data-k; end if;
    end loop;
    old_status := coalesce(old.data->>'status','pending'); new_status := coalesce(new.data->>'status',old_status);
    if new_status not in ('pending','active','inactive','rejected') then new.data := jsonb_set(new.data,array['status'],to_jsonb(old_status),true); end if;
  else
    foreach k in array array['id','apnId','status','role','level','target','targetMetric','commissionPct','attendanceScore','notes','revenueGenerated','walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt','createdAt','approvedAt','approvedBy','reactivatedAt','reactivatedBy'] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true); else new.data := new.data-k; end if;
    end loop;
    new.data := jsonb_set(new.data,array['status'],to_jsonb(coalesce(old.data->>'status','pending')),true);
  end if;
  return new;
end;
$$;

drop trigger if exists apn_users_guard_trg on public.apn_users;
create trigger apn_users_guard_trg before insert or update on public.apn_users
for each row execute function public.apn_users_guard();

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_admin boolean := public.is_admin(); caller_super boolean := public.is_superadmin();
        state_head_action boolean := current_setting('app.apn_state_head_lifecycle', true) = '1';
begin
  if old.role = 'superadmin' and not caller_super then return old; end if;
  if state_head_action and public.apn_state_head_scope(jsonb_build_object('id',old.id::text,'apnId',coalesce((select u.data->>'apnId' from public.apn_users u where u.id=old.id::text),''),'state',coalesce((select u.data->>'state' from public.apn_users u where u.id=old.id::text),''))) then
    new.name := old.name; new.email := old.email; new.mobile := old.mobile; new.username := old.username;
    new.role := old.role; new.perms := old.perms;
    return new;
  end if;
  if old.role in ('partner','district_head') and not caller_super then
    new.name := old.name; new.email := old.email; new.mobile := old.mobile; new.username := old.username;
    new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
    return new;
  end if;
  if not caller_admin then
    new.role := old.role; new.active := old.active; new.status := old.status; new.perms := old.perms; new.approved := old.approved;
  end if;
  if new.role = 'superadmin' and old.role <> 'superadmin' and not caller_super then new.role := old.role; end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
for each row execute function public.profiles_guard();

create or replace function public.apn_state_head_approve_partner(p_partner_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_at timestamptz := now(); v_name text;
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be approved.' using errcode='check_violation'; end if;
  v_name := coalesce(v_data->>'name','Partner');
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set role='partner', approved=true, active=true, status='active' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(jsonb_set(data,'{status}','"active"'::jsonb,true),'{approvedAt}',to_jsonb((extract(epoch from v_at)*1000)::bigint),true),'{approvedBy}',to_jsonb(public.current_name()),true),'{rejectedAt}', 'null'::jsonb,true), updated_at=v_at where id=p_partner_id;
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','active','approvedBy',public.current_name());
end;
$$;

create or replace function public.apn_state_head_reject_partner(p_partner_id text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_data jsonb; v_at timestamptz := now(); v_name text; v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  select data into v_data from public.apn_users where id=p_partner_id for update;
  if v_data is null then raise exception 'APN partner not found.' using errcode='no_data_found'; end if;
  if not public.apn_state_head_scope(v_data) then raise exception 'Partner is outside your State Head scope.' using errcode='insufficient_privilege'; end if;
  if coalesce(v_data->>'role','partner') <> 'partner' or coalesce(v_data->>'status','pending') <> 'pending' then raise exception 'Only pending partner applications can be rejected.' using errcode='check_violation'; end if;
  v_name := coalesce(v_data->>'name','Partner');
  perform set_config('app.apn_state_head_lifecycle','1',true);
  update public.profiles set approved=false, active=false, status='terminated' where id=p_partner_id::uuid;
  update public.apn_users set data=jsonb_set(jsonb_set(jsonb_set(data,'{status}','"rejected"'::jsonb,true),'{rejectReason}',to_jsonb(v_reason),true),'{rejectedBy}',to_jsonb(public.current_name()),true), updated_at=v_at where id=p_partner_id;
  return jsonb_build_object('id',p_partner_id,'name',v_name,'status','rejected','reason',v_reason,'rejectedBy',public.current_name());
end;
$$;

revoke all on function public.apn_state_head_approve_partner(text) from public, anon;
revoke all on function public.apn_state_head_reject_partner(text,text) from public, anon;
grant execute on function public.apn_state_head_approve_partner(text) to authenticated;
grant execute on function public.apn_state_head_reject_partner(text,text) to authenticated;

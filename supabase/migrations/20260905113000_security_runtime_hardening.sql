begin;

-- Notification/chat RLS: user state is separate from shared content.
create or replace function public.chat_edit_message(p_id text,p_text text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.chat%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  select * into r from public.chat where id=p_id for update;
  if not found then raise exception 'Message not found.' using errcode='no_data_found'; end if;
  if public.is_client() or r.data->>'userId'<>auth.uid()::text then raise exception 'You can only edit your own message.' using errcode='insufficient_privilege'; end if;
  if coalesce(r.data->>'createdAt','0')::bigint < (extract(epoch from now())*1000)::bigint-30*60*1000 then raise exception 'Message edit window has expired.' using errcode='check_violation'; end if;
  update public.chat set data=jsonb_set(jsonb_set(data,'{text}',to_jsonb(trim(p_text)),true),'{editedAt}',to_jsonb((extract(epoch from now())*1000)::bigint),true),updated_at=now() where id=p_id returning * into r;
  return r.data;
end $$;
revoke execute on function public.chat_edit_message(text,text) from public,anon; grant execute on function public.chat_edit_message(text,text) to authenticated;

create or replace function public.chat_delete_message(p_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.chat%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  select * into r from public.chat where id=p_id for update;
  if not found then raise exception 'Message not found.' using errcode='no_data_found'; end if;
  if not public.is_admin() and r.data->>'userId'<>auth.uid()::text then raise exception 'You can only delete your own message.' using errcode='insufficient_privilege'; end if;
  update public.chat set data=jsonb_set(jsonb_set(jsonb_set(data,'{deleted}', 'true'::jsonb),'{text}','""'::jsonb,true),'{deletedBy}',to_jsonb(auth.uid()::text),true),updated_at=now() where id=p_id returning * into r;
  return r.data;
end $$;
revoke execute on function public.chat_delete_message(text) from public,anon; grant execute on function public.chat_delete_message(text) to authenticated;

-- APN signup is adult-only and the check is server-side, not a browser hint.
create or replace function public.apn_validate_adult_dob(p_dob text)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare d date; years integer;
begin
  if nullif(trim(p_dob),'') is null then raise exception 'Date of birth is required for APN registration.' using errcode='check_violation'; end if;
  begin d:=trim(p_dob)::date; exception when others then raise exception 'Invalid date of birth.' using errcode='check_violation'; end;
  if d>current_date then raise exception 'Date of birth cannot be in the future.' using errcode='check_violation'; end if;
  years:=extract(year from age(current_date,d));
  if years<18 then raise exception 'APN registration requires the applicant to be at least 18 years old.' using errcode='check_violation'; end if;
end $$;
revoke execute on function public.apn_validate_adult_dob(text) from public,anon; grant execute on function public.apn_validate_adult_dob(text) to authenticated;

create or replace function public.apn_registration_guard(p_email text,p_meta jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_username text:=lower(trim(coalesce(p_meta->'apn'->>'username',p_meta->>'username',''))); v_mobile text:=regexp_replace(coalesce(p_meta->'apn'->>'mobile',p_meta->'mobile',''),'[^0-9]','','g'); v_is_partner boolean:=p_meta->>'role_intent'='partner';
begin
  if exists(select 1 from public.profiles p where p.status='suspended' and (lower(coalesce(p.email,''))=lower(coalesce(p_email,'')) or (v_username<>'' and lower(coalesce(p.username,''))=v_username) or (v_mobile<>'' and regexp_replace(coalesce(p.mobile,''),'[^0-9]','','g')=v_mobile))) then raise exception 'This APN identifier belongs to a suspended account.' using errcode='check_violation'; end if;
  if v_is_partner then perform public.apn_validate_adult_dob(p_meta->'apn'->>'dob'); end if;
end $$;
revoke execute on function public.apn_registration_guard(text,jsonb) from public,anon; grant execute on function public.apn_registration_guard(text,jsonb) to service_role;

-- Never let an authenticated partner update their DOB to a minor value.
create or replace function public.apn_profile_age_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.role in ('partner','district_head','state_head') and new.dob is not null then perform public.apn_validate_adult_dob(new.dob::text); end if;
  return new;
end $$;
drop trigger if exists apn_profile_age_guard_trg on public.profiles;
create trigger apn_profile_age_guard_trg before insert or update of dob,role on public.profiles for each row execute function public.apn_profile_age_guard();
revoke execute on function public.apn_profile_age_guard() from public,anon,authenticated;

-- Platform v6 uses enabled, not the obsolete active column. Queue states are
-- canonical: queued/approved/executing/executed/failed; pending_approval is not used.
create or replace function public.platform_v6_ops_snapshot() returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,pg_temp as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
  select jsonb_build_object('automation',jsonb_build_object('rules',(select count(*) from public.business_automation_rules where coalesce(enabled,true) and not coalesce(simulation_only,false)),'queued',(select count(*) from public.business_automation_queue where status in ('queued','approved')),'executing',(select count(*) from public.business_automation_queue where status='executing'),'failed',(select count(*) from public.business_automation_executions where status='failed'),'dlq',(select count(*) from public.business_automation_dead_letters where resolved_at is null)),'notifications',jsonb_build_object('total',(select count(*) from public.notifications),'delivery_events',(select count(*) from public.notification_delivery_audit)),'chat',jsonb_build_object('messages',(select count(*) from public.chat)),'search',jsonb_build_object('history',(select count(*) from public.global_search_history),'saved',(select count(*) from public.global_search_saved),'analytics',(select count(*) from public.global_search_analytics)),'apn',jsonb_build_object('partners',(select count(*) from public.apn_users where coalesce(data->>'status','active')='active'),'wallet_entries',(select count(*) from public.apn_wallet_transactions),'withdrawals',(select count(*) from public.apn_withdrawal_requests)),'finance',jsonb_build_object('transactions',(select count(*) from public.transactions),'income',(select coalesce(sum((data->>'amount')::numeric),0) from public.transactions where lower(coalesce(data->>'kind',''))='income'),'expenses',(select coalesce(sum((data->>'amount')::numeric),0) from public.transactions where lower(coalesce(data->>'kind',''))='expense')),'security',jsonb_build_object('sessions',(select count(*) from public.security_sessions where revoked_at is null),'sensitive_events',(select count(*) from public.security_sensitive_actions),'permission_rows',(select count(*) from public.security_permission_matrix))) into r;
  return r;
end $$;
revoke execute on function public.platform_v6_ops_snapshot() from public,anon; grant execute on function public.platform_v6_ops_snapshot() to authenticated;

commit;
notify pgrst,'reload schema';

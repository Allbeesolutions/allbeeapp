-- Fix production APN partner signup after the State Head guard replaced the
-- earlier signup-aware guard. Auth signup runs the apn_users insert inside
-- handle_new_user(), where auth.uid() is not the new user identity.
-- The transaction-local bootstrap flag is set only by handle_new_user().

create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  old_status text;
  new_status text;
  state_head_action boolean := current_setting('app.apn_state_head_lifecycle', true) = '1';
  signup_bootstrap boolean := current_setting('allbee.apn_signup_bootstrap', true) = '1';
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
    -- The only non-authenticated insert path is the transaction-local Auth
    -- signup bootstrap established by handle_new_user(). Never make this a
    -- persistent privilege or a client-controlled setting.
    if not public.is_admin() and not signup_bootstrap and (new.data->>'id') <> auth.uid()::text then
      raise exception 'You cannot create another APN profile.';
    end if;
    if not public.is_admin() and not signup_bootstrap then
      new.data := jsonb_set(new.data, array['status'], '"pending"'::jsonb, true);
      new.data := jsonb_set(new.data, array['role'], '"partner"'::jsonb, true);
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
revoke execute on function public.apn_users_guard() from public, anon, authenticated;

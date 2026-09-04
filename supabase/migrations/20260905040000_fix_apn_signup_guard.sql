begin;
-- Partner signup regression fix: the State Head lifecycle guard had replaced
-- the signup bootstrap exception and compared uuid to text. That caused the
-- auth.users trigger to fail with "operator does not exist: uuid = text".
-- Keep the State Head protections while restoring the trigger-only bootstrap.
create or replace function public.apn_users_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  old_status text;
  new_status text;
  state_head_action boolean := current_setting('app.apn_state_head_lifecycle', true) = '1';
  bootstrap boolean := current_setting('allbee.apn_signup_bootstrap', true) = '1';
begin
  if public.is_superadmin() then return new; end if;
  if state_head_action and public.apn_state_head_scope(new.data) then
    foreach k in array array[
      'id','apnId','name','username','email','mobile','alternateNumber','gender',
      'dob','country','state','district','taluk','city','pincode','address','level',
      'target','targetMetric','commissionPct','attendanceScore','notes','role',
      'revenueGenerated','walletBalance','suspensionReason','suspensionNotes',
      'suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt','quizPasses',
      'unlocked','notifReads','lastCheckIn','lastActivity','zone','zoneApprovedAt'
    ] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k, true);
      else new.data := new.data - k;
      end if;
    end loop;
    if coalesce(new.data->>'status','') not in ('active','inactive','rejected','pending') then
      new.data := jsonb_set(new.data,array['status'],to_jsonb(old.data->>'status'),true);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and not bootstrap and (new.data->>'id') <> auth.uid()::text then
      raise exception 'You cannot create another APN profile.';
    end if;
    if not public.is_admin() and not bootstrap then
      if (new.data->>'status') <> 'active' or not exists (
        select 1 from public.profiles p
        where p.id::text = new.data->>'id' and p.approved and p.active
      ) then
        new.data := jsonb_set(new.data,array['status'],'"pending"'::jsonb,true);
      end if;
      new.data := jsonb_set(new.data,array['role'],'"partner"'::jsonb,true);
      new.data := new.data - 'commissionPct' - 'attendanceScore' - 'target' - 'walletBalance' - 'revenueGenerated';
    end if;
    return new;
  end if;
  if public.is_admin() then
    foreach k in array array[
      'name','username','email','mobile','alternateNumber','gender','dob','country',
      'state','district','taluk','city','pincode','address','level','target',
      'targetMetric','commissionPct','attendanceScore','notes','role','revenueGenerated',
      'walletBalance','suspensionReason','suspensionNotes','suspendedBy','suspendedAt',
      'deletedAt','deletedBy','archivedAt'
    ] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true);
      else new.data := new.data-k;
      end if;
    end loop;
    foreach k in array array[
      'quizPasses','unlocked','notifReads','lastCheckIn','lastActivity',
      'reactivationRequested','reactivationRecommended'
    ] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true);
      else new.data := new.data-k;
      end if;
    end loop;
    old_status := coalesce(old.data->>'status','pending');
    new_status := coalesce(new.data->>'status',old_status);
    if new_status not in ('pending','active','inactive','rejected') then
      new.data := jsonb_set(new.data,array['status'],to_jsonb(old_status),true);
    end if;
  else
    foreach k in array array[
      'id','apnId','status','role','level','target','targetMetric','commissionPct',
      'attendanceScore','notes','revenueGenerated','walletBalance','suspensionReason',
      'suspensionNotes','suspendedBy','suspendedAt','deletedAt','deletedBy','archivedAt',
      'createdAt','approvedAt','approvedBy','reactivatedAt','reactivatedBy'
    ] loop
      if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true);
      else new.data := new.data-k;
      end if;
    end loop;
    new.data := jsonb_set(new.data,array['status'],to_jsonb(coalesce(old.data->>'status','pending')),true);
  end if;
  return new;
end;
$$;
revoke all on function public.apn_users_guard() from public, anon;
commit;
notify pgrst,'reload schema';

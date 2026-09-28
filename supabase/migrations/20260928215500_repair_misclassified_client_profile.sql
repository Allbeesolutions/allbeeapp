-- One-time repair for the client registered while client role_intent still defaulted to staff.
-- profiles_guard correctly blocks unauthenticated privilege changes, so maintenance must
-- bypass that guard only for this exact row and immediately restore it.
alter table public.profiles disable trigger profiles_guard_trg;
update public.profiles
set role = 'client'
where id = '6604f29b-eed4-42fe-b950-dc511fa576ab'
  and role = 'staff' and status = 'pending' and approved = false;
alter table public.profiles enable trigger profiles_guard_trg;

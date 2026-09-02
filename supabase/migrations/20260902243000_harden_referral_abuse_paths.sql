-- Referral abuse-path hardening: fail closed on identity and money replay.
begin;

do $$ declare t text; begin
  foreach t in array array['apn_referral_settings','apn_referral_codes','apn_referral_relationships','apn_referral_earnings','apn_referral_snapshots','apn_referral_wallets','apn_referral_withdrawals'] loop
    execute format('revoke insert, update, delete, truncate, trigger on table public.%I from authenticated', t);
  end loop;
end $$;

create or replace function public.apn_referral_validate_earning()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.apn_referral_relationships%rowtype;
begin
  select * into r from public.apn_referral_relationships where id = new.relationship_id;
  if not found or r.referrer_id <> new.referrer_id or r.referred_id <> new.referred_id then
    raise exception 'Referral earning identity does not match its relationship.' using errcode = 'foreign_key_violation';
  end if;
  if new.referral_amount <> round(new.revenue_amount * new.referral_percent / 100, 2) then
    raise exception 'Referral earning amount does not match its percentage snapshot.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists apn_referral_validate_earning_trg on public.apn_referral_earnings;
create trigger apn_referral_validate_earning_trg before insert or update on public.apn_referral_earnings
for each row execute function public.apn_referral_validate_earning();

create or replace function public.apn_referral_guard_earning_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status <> old.status then
    if old.status in ('void','paid') then raise exception 'Final referral earning status cannot be changed.' using errcode = 'check_violation'; end if;
    if old.status = 'pending' and new.status not in ('approved','void') then raise exception 'Pending referral earnings may only become approved or void.' using errcode = 'check_violation'; end if;
    if old.status = 'approved' and new.status not in ('withdrawable','void') then raise exception 'Approved referral earnings may only become withdrawable or void.' using errcode = 'check_violation'; end if;
    if old.status = 'withdrawable' and new.status not in ('paid','void') then raise exception 'Withdrawable referral earnings may only become paid or void.' using errcode = 'check_violation'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists apn_referral_guard_earning_status_trg on public.apn_referral_earnings;
create trigger apn_referral_guard_earning_status_trg before update on public.apn_referral_earnings
for each row execute function public.apn_referral_guard_earning_status();

create or replace function public.apn_referral_guard_withdrawal_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status <> old.status then
    if old.status in ('paid','rejected') then raise exception 'Final referral withdrawal cannot be changed.' using errcode = 'check_violation'; end if;
    if old.status = 'pending' and new.status not in ('approved','rejected') then raise exception 'Pending referral withdrawal may only be approved or rejected.' using errcode = 'check_violation'; end if;
    if old.status = 'approved' and new.status <> 'paid' then raise exception 'Approved referral withdrawal may only become paid.' using errcode = 'check_violation'; end if;
  end if;
  if new.amount <= 0 then raise exception 'Referral withdrawal amount must be positive.' using errcode = 'check_violation'; end if;
  return new;
end;
$$;

drop trigger if exists apn_referral_guard_withdrawal_status_trg on public.apn_referral_withdrawals;
create trigger apn_referral_guard_withdrawal_status_trg before update on public.apn_referral_withdrawals
for each row execute function public.apn_referral_guard_withdrawal_status();

-- One pending/approved referral withdrawal cannot reserve the same wallet twice.
create unique index if not exists apn_referral_withdrawal_active_unique
on public.apn_referral_withdrawals (partner_id) where status in ('pending','approved');

-- Existing UNIQUE(referred_id) remains the final database guard against duplicate links.
commit;
notify pgrst, 'reload schema';

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
dbdir=$(mktemp -d /tmp/allbee-finance-rpc.XXXXXX)
port=55439
cleanup() { pg_ctl -D "$dbdir" stop >/dev/null 2>&1 || true; rm -rf "$dbdir"; }
trap cleanup EXIT
initdb -D "$dbdir" -A trust --no-instructions >/dev/null
pg_ctl -D "$dbdir" -o "-h 127.0.0.1 -p $port" -l "$dbdir/server.log" start >/dev/null
export PGHOST=127.0.0.1 PGPORT=$port PGDATABASE=postgres
psql -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.profiles(id uuid primary key, role text, active boolean default true);
create function public.can_finance() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('superadmin','accountant')) $$;
create function public.is_superadmin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and active and role='superadmin') $$;
create function public.can_module(mod text) returns boolean language sql stable as $$ select public.is_superadmin() $$;
create table public.fin_locks(period text primary key);
create function public.is_period_locked(d date) returns boolean language sql stable as $$ select exists(select 1 from public.fin_locks where period=to_char(d,'YYYY-MM')) $$;
create table public.transactions(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table public.students(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table public.marketing(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table public.audit(id uuid primary key default gen_random_uuid(),data jsonb);
create function public.audit_record(p_data jsonb) returns text language plpgsql as $$ begin insert into public.audit(data) values(p_data); return 'ok'; end $$;
insert into public.profiles(id,role) values
('00000000-0000-0000-0000-000000000001','superadmin'),
('00000000-0000-0000-0000-000000000002','accountant'),
('00000000-0000-0000-0000-000000000003','staff');
select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
insert into public.students(id,data) values('s1','{"paymentStatus":"Unpaid"}');
insert into public.marketing(id,data) values('m1','{"lastPaid":""}');
SQL
psql -v ON_ERROR_STOP=1 -q -f supabase/migrations/20260926100000_finance_save_entry_v1.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/migrations/20260926100000_finance_save_entry_v1.sql
psql -v ON_ERROR_STOP=1 -q <<'SQL'
select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
create function public.test_assert(ok boolean, message text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAILED: %', message; end if; end $$;
create function public.test_fail(message text, expected text) returns void language plpgsql as $$ begin raise exception 'FAILED: % did not fail',message; exception when others then if sqlerrm like 'FAILED:%' or sqlstate<>expected then raise; end if; end $$;
do $$
declare
  entry jsonb := '{"id":"t1","kind":"income","amount":100,"date":"2026-09-25","hajiPct":50,"alimPct":50}';
  key uuid := '10000000-0000-0000-0000-000000000001';
  result jsonb;
  version timestamptz;
begin
  result:=public.finance_save_entry_v1(entry,'student','s1',key,null);
  perform public.test_assert(result->>'id'='t1' and (select data->>'paymentStatus' from public.students where id='s1')='Paid','linked save');
  perform public.test_assert((select count(*) from public.audit)=1,'audit appended');
  perform public.test_assert(public.finance_save_entry_v1(entry,'student','s1',key,null)=result and (select count(*) from public.audit)=1,'same key returns unchanged result');
  begin
    perform public.finance_save_entry_v1(entry || '{"amount":200}'::jsonb,'student','s1',key,null);
    perform public.test_fail('mismatched key','23505');
  exception when unique_violation then null; end;
  begin
    perform public.finance_save_entry_v1(entry || '{"id":"t-missing"}'::jsonb,'student','missing',gen_random_uuid(),null);
    perform public.test_fail('missing source','23503');
  exception when foreign_key_violation then null; end;
  begin
    perform public.finance_save_entry_v1('{"id":"t-invalid","amount":10,"date":"2026-09-25","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: missing kind allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.finance_save_entry_v1('{"id":"t-invalid","kind":"income","date":"2026-09-25","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: missing amount allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.finance_save_entry_v1('{"id":"t-invalid","kind":"income","amount":10,"date":"2026-09-25","hajiPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: missing share allowed';
  exception when invalid_parameter_value then null; end;
  perform public.test_assert((select count(*) from public.transactions)=1,'missing source rolled back');
  select updated_at into version from public.transactions where id='t1';
  begin
    perform public.finance_save_entry_v1(entry || '{"amount":110}'::jsonb,null,null,gen_random_uuid(),version - interval '1 second');
    perform public.test_fail('stale version','40001');
  exception when serialization_failure then null; end;
  perform public.test_assert((select data->>'amount' from public.transactions where id='t1')='100','stale version preserved');
  perform public.finance_save_entry_v1(entry || '{"amount":120}'::jsonb,'marketing','m1',gen_random_uuid(),version);
  perform public.test_assert((select data->>'lastPaid' from public.marketing where id='m1')='2026-09-25','marketing linked');
end $$;
create function public.reject_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$;
create trigger test_audit_failure before insert on public.audit for each row execute function public.reject_audit();
do $$
begin
  begin
    perform public.finance_save_entry_v1('{"id":"t-fail","kind":"expense","amount":9,"date":"2026-09-25","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: audit failure did not propagate';
  exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
  perform public.test_assert(not exists(select 1 from public.transactions where id='t-fail'),'audit failure rolled back transaction');
  perform public.test_assert((select count(*) from public.finance_save_requests)=2,'failure rolled back idempotency reservation');
end $$;
drop trigger test_audit_failure on public.audit;
create function public.reject_marketing() returns trigger language plpgsql as $$ begin raise exception 'marketing unavailable'; end $$;
create trigger test_marketing_failure before update on public.marketing for each row execute function public.reject_marketing();
do $$
begin
  begin
    perform public.finance_save_entry_v1('{"id":"t-source-fail","kind":"income","amount":9,"date":"2026-09-25","hajiPct":50,"alimPct":50}'::jsonb,'marketing','m1',gen_random_uuid(),null);
    raise exception 'FAILED: source failure did not propagate';
  exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
  perform public.test_assert(not exists(select 1 from public.transactions where id='t-source-fail'),'source failure rolled back transaction');
  perform public.test_assert((select count(*) from public.audit)=2,'source failure did not append audit');
end $$;
drop trigger test_marketing_failure on public.marketing;
insert into public.fin_locks values('2026-09');
select set_config('test.uid','00000000-0000-0000-0000-000000000002',false);
do $$
begin
  begin
    perform public.finance_save_entry_v1('{"id":"t-lock","kind":"expense","amount":9,"date":"2026-09-25","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: lock not enforced';
  exception when insufficient_privilege then null; end;
  perform public.test_assert(not exists(select 1 from public.transactions where id='t-lock'),'period lock preserved');
end $$;
select set_config('test.uid','00000000-0000-0000-0000-000000000003',false);
do $$
begin
  begin
    perform public.finance_save_entry_v1('{"id":"t-unauth","kind":"expense","amount":9,"date":"2026-10-01","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
    raise exception 'FAILED: unauthorized role allowed';
  exception when insufficient_privilege then null; end;
end $$;
SQL
# The API role may execute the function but cannot inspect its retry ledger.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
select set_config('test.uid','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$
begin
  if has_table_privilege(current_user,'public.finance_save_requests','SELECT') then
    raise exception 'Authenticated can inspect finance request ledger';
  end if;
  if not has_function_privilege(current_user,'public.finance_save_entry_v1(jsonb,text,text,uuid,timestamptz)','EXECUTE') then
    raise exception 'Authenticated cannot execute finance RPC';
  end if;
  perform public.finance_save_entry_v1('{"id":"t-grant","kind":"expense","amount":8,"date":"2026-10-01","hajiPct":50,"alimPct":50}'::jsonb,null,null,gen_random_uuid(),null);
end $$;
reset role;
SQL
# Two independent sessions race on the same request key. The second must
# wait for the first commit and return its stored response without another audit.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
create or replace function public.delay_audit() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$;
create trigger test_delay_audit before insert on public.audit for each row execute function public.delay_audit();
SQL
call_sql="select set_config('test.uid','00000000-0000-0000-0000-000000000001',false); select public.finance_save_entry_v1('{\"id\":\"t-race\",\"kind\":\"income\",\"amount\":7,\"date\":\"2026-10-01\",\"hajiPct\":50,\"alimPct\":50}'::jsonb,null,null,'10000000-0000-0000-0000-000000000099'::uuid,null);"
psql -v ON_ERROR_STOP=1 -Atqc "$call_sql" >"$dbdir/first" & first_pid=$!
psql -v ON_ERROR_STOP=1 -Atqc "$call_sql" >"$dbdir/second" & second_pid=$!
wait "$first_pid"; wait "$second_pid"
tail -1 "$dbdir/first" | cmp -s - <(tail -1 "$dbdir/second")
count=$(psql -Atqc "select count(*) from public.transactions where id='t-race'")
audit_count=$(psql -Atqc "select count(*) from public.audit where data->>'targetId'='t-race'")
[[ "$count" == 1 && "$audit_count" == 1 ]]
echo "Finance RPC local rollback, retry, lock, role, migration replay and concurrent same-key checks passed."

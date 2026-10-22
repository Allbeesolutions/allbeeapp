#!/usr/bin/env bash
set -euo pipefail
# Disposable private PostgreSQL cluster. Never connects to a live or shared DB.
repo="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/allbee-usage-sql.XXXXXX")"
port=55487
cleanup() {
  pg_ctl -D "$tmp/pgdata" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
initdb -D "$tmp/pgdata" -A trust -U postgres --no-instructions >"$tmp/initdb.log"
pg_ctl -D "$tmp/pgdata" -o "-k $tmp -p $port -c listen_addresses=''" -l "$tmp/server.log" -w start >/dev/null
export PGHOST="$tmp" PGPORT="$port" PGUSER=postgres PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users (id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS
$$SELECT auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid$$;
GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated,anon,service_role;
SQL
psql -X -v ON_ERROR_STOP=1 -f "$repo/supabase/migrations/20261021221500_customer_usage_analytics.sql" >"$tmp/migration.log"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF has_function_privilege('anon','public.app_record_customer_usage(uuid,uuid,text,text,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'anonymous record EXECUTE exposed'; END IF;
 IF has_function_privilege('anon','public.app_customer_usage_report()','EXECUTE') THEN RAISE EXCEPTION 'anonymous report EXECUTE exposed'; END IF;
 IF has_function_privilege('authenticated','public.app_prune_customer_usage(integer)','EXECUTE') THEN RAISE EXCEPTION 'authenticated retention exposed'; END IF;
 IF NOT has_function_privilege('service_role','public.app_prune_customer_usage(integer)','EXECUTE') THEN RAISE EXCEPTION 'service retention unavailable'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222', false);
DO $$
BEGIN
 IF NOT public.app_record_customer_usage(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444','visit','tasks',NULL,NULL)
 THEN RAISE EXCEPTION 'valid consented visit rejected'; END IF;
 IF public.app_record_customer_usage(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444','tap','vault','button',NULL)
 THEN RAISE EXCEPTION 'private route accepted'; END IF;
 IF public.app_record_customer_usage(
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444','tap','tasks','private-account-name',NULL)
 THEN RAISE EXCEPTION 'unbounded click label accepted'; END IF;
 IF (SELECT count(*) FROM public.app_customer_usage_events) <> 0 THEN
  RAISE EXCEPTION 'RLS exposed raw non-admin rows'; END IF;
 BEGIN
  PERFORM public.app_customer_usage_report();
  RAISE EXCEPTION 'non-admin report succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;
DO $$
DECLARE i int; accepted boolean; report jsonb;
BEGIN
 FOR i IN 1..241 LOOP
  accepted:=public.app_record_customer_usage(
   '55555555-5555-4555-8555-555555555555',
   '66666666-6666-4666-8666-666666666666','view','dashboard',NULL,NULL);
  IF accepted <> (i <= 240) THEN RAISE EXCEPTION 'per-session limit failed at %',i;END IF;
 END LOOP;
 report:=public.app_customer_usage_report();
 IF (report->>'views7d')::int <> 240 THEN RAISE EXCEPTION 'admin aggregated count mismatch %',report;END IF;
 IF (SELECT count(*) FROM public.app_customer_usage_events)<>241 THEN RAISE EXCEPTION 'admin RLS count mismatch';END IF;
END $$;
DO $$
DECLARE i int; j int; sid uuid; accepted boolean;
BEGIN
 -- Simulate 4 more independent sessions for the same authenticated actor.
 FOR j IN 1..4 LOOP
  sid:=('70000000-0000-4000-8000-'||lpad(j::text,12,'0'))::uuid;
  FOR i IN 1..240 LOOP
   accepted:=public.app_record_customer_usage(
    '55555555-5555-4555-8555-555555555555',sid,'tap','tasks','button',NULL);
   IF NOT accepted THEN RAISE EXCEPTION 'global budget rejected early % %',j,i;END IF;
  END LOOP;
 END LOOP;
 IF public.app_record_customer_usage(
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777','visit','dashboard',NULL,NULL)
 THEN RAISE EXCEPTION 'actor-wide 1200 hourly limit bypassed using new session';END IF;
 IF (SELECT count(*) FROM public.app_customer_usage_events WHERE actor_id=auth.uid())<>1200
 THEN RAISE EXCEPTION 'global hourly limit count mismatch';END IF;
END $$;
RESET ROLE;
DO $$
DECLARE c int;
BEGIN
 SELECT count(*) INTO c FROM public.app_customer_usage_events
  WHERE created_at < now()-interval '90 days';
 IF c<>0 THEN RAISE EXCEPTION 'migration unexpectedly created old data'; END IF;
END $$;
-- Staged pruning: verify its function exists, but do not schedule it.
SQL
# Two concurrent authenticated connections race to insert 150 events each into
# the same session. Advisory serialization plus the checked budget must leave
# exactly 240 accepted events; no 241st write may slip through.
cat > "$tmp/concurrent-actor.sql" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222', false);
DO $$
DECLARE i integer;
BEGIN
 FOR i IN 1..150 LOOP
  PERFORM public.app_record_customer_usage(
   '99999999-9999-4999-8999-999999999999',
   '88888888-8888-4888-8888-888888888888','tap','client_home','button',NULL);
 END LOOP;
END $$;
SQL
psql -X -v ON_ERROR_STOP=1 -f "$tmp/concurrent-actor.sql" > "$tmp/race1.log" 2>&1 &
first=$!
psql -X -v ON_ERROR_STOP=1 -f "$tmp/concurrent-actor.sql" > "$tmp/race2.log" 2>&1 &
second=$!
wait "$first"
wait "$second"
accepted="$(psql -X -Atqc "SELECT count(*) FROM public.app_customer_usage_events WHERE actor_id='22222222-2222-4222-8222-222222222222' AND session_id='88888888-8888-4888-8888-888888888888'")"
if [ "$accepted" != 240 ]; then echo "FAILED concurrent session cap: $accepted, expected 240"; exit 1; fi
printf 'PASS analytics isolated SQL migration, auth/RLS, consent categories, session/global/concurrent budgets, admin reports, retention gate\n'

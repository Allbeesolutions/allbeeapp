#!/usr/bin/env bash
set -euo pipefail
base="$(mktemp -d /tmp/allbee-neon-schema-test.XXXXXX)"
cleanup() { pg_ctl -D "$base/pgdata" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$base"; }
trap cleanup EXIT
initdb -D "$base/pgdata" -A trust -U postgres --no-instructions > "$base/initdb.log"
pg_ctl -D "$base/pgdata" -o "-k $base -p 55496 -c listen_addresses=''" -l "$base/postgres.log" -w start >/dev/null
export PGHOST="$base" PGPORT=55496 PGUSER=postgres PGDATABASE=postgres
repo="$(cd "$(dirname "$0")/.." && pwd)"
psql -X -v ON_ERROR_STOP=1 -f "$repo/database/neon/001_allbee_fresh_foundation.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 -f "$repo/database/neon/001_allbee_fresh_foundation.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF (SELECT count(*) FROM allbee_platform.schema_migrations) <> 1
 THEN RAISE EXCEPTION 'migration replay duplicated rows'; END IF;
 IF (SELECT count(*) FROM allbee_platform.service_readiness) <> 7
 THEN RAISE EXCEPTION 'incomplete service registry'; END IF;
 IF (SELECT count(*) FROM allbee_platform.service_readiness WHERE status='ready') <> 1
 THEN RAISE EXCEPTION 'unverified services marked ready'; END IF;
 IF has_schema_privilege('public', 'allbee_platform', 'USAGE')
 THEN RAISE EXCEPTION 'platform schema exposed to PUBLIC'; END IF;
END $$;
SQL
echo 'PASS Neon foundation, replay-safe migration, private schema and gated services'

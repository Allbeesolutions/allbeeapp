#!/usr/bin/env bash
# AllBee Neon fresh identity / two-party chat RLS integration verification.
# Uses a disposable local database and mocked JWT identity function. No cloud writes.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d /tmp/allbee-neon-identity-test.XXXXXX)"
cleanup() { pg_ctl -D "$tmp/pgdata" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
initdb -D "$tmp/pgdata" -A trust -U postgres --no-instructions >/dev/null
pg_ctl -D "$tmp/pgdata" -o "-k $tmp -p 55497 -c listen_addresses=''" -l "$tmp/postgres.log" -w start >/dev/null
export PGHOST="$tmp" PGPORT=55497 PGUSER=postgres PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anonymous NOLOGIN;
CREATE SCHEMA neon_auth;
CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, email text NOT NULL);
CREATE SCHEMA auth;
-- Local test substitute ONLY; production comes from Neon Data API verified JWT.
CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('allbee.test_user_id', true), '')
$$;
INSERT INTO neon_auth."user" VALUES
 ('00000000-0000-4000-8000-000000000001','a@example.test'), ('00000000-0000-4000-8000-000000000002','b@example.test'), ('00000000-0000-4000-8000-000000000003','c@example.test');
SQL
psql -X -v ON_ERROR_STOP=1 -f "$repo/database/neon/001_allbee_fresh_foundation.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 -f "$repo/database/neon/002_neon_auth_core.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 -f "$repo/database/neon/002_neon_auth_core.sql" >/dev/null

query_as() {
  local who="$1" sql="$2"
  psql -q -X -A -t -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SELECT set_config('allbee.test_user_id', '$who', false); $sql" | sed '/^$/d' | tail -1
}
expect() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL $label: expected $expected, observed $actual" >&2
    exit 1
  fi
}
query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.member_profiles (user_id, display_name) VALUES ('00000000-0000-4000-8000-000000000001','Alice');" >/dev/null
query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.member_profiles (user_id, display_name) VALUES ('00000000-0000-4000-8000-000000000002','Bob');" >/dev/null
expect "self profile" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.member_profiles;")"
expect "user B cannot read A profile" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.member_profiles;")"
expect "stranger C sees no profiles" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.member_profiles;")"
expect "cross-user profile update" "0" "$(query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.member_profiles SET display_name='Hacked' WHERE user_id='00000000-0000-4000-8000-000000000002' RETURNING 1;" | grep -c '^1$' || true)"
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.member_profiles (user_id, display_name) VALUES ('00000000-0000-4000-8000-000000000003','Spoof');" >/dev/null 2>"$tmp/deny.log"; then
  echo "FAIL foreign profile insert allowed" >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO allbee_private.member_roles (user_id, role) VALUES ('00000000-0000-4000-8000-000000000001','superadmin');" >/dev/null 2>"$tmp/deny.log"; then
  echo "FAIL self-assign role allowed" >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.member_profiles SET user_id='00000000-0000-4000-8000-000000000002' WHERE user_id='00000000-0000-4000-8000-000000000001';" >/dev/null 2>"$tmp/deny.log"; then
  echo "FAIL profile identity mutation allowed" >&2; exit 1
fi

conversation_id="$(query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.direct_conversations (participant_one_id, participant_two_id, created_by) VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001') RETURNING id;" | grep -E '^[a-f0-9-]{36}$' | head -1)"
[[ -n "$conversation_id" ]] || { echo 'FAIL conversation not created' >&2; exit 1; }
expect "stranger C cannot see private thread" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.direct_conversations;")"
expect "participant B sees thread" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.direct_conversations;")"
query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.direct_messages(conversation_id,sender_user_id,body) VALUES ('$conversation_id','00000000-0000-4000-8000-000000000001','Hello Bob');" >/dev/null
expect "participant B reads chat" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.direct_messages;")"
expect "stranger C cannot read chat" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.direct_messages;")"
if query_as 00000000-0000-4000-8000-000000000003 "INSERT INTO public.direct_messages(conversation_id,sender_user_id,body) VALUES ('$conversation_id','00000000-0000-4000-8000-000000000003','injected');" >/dev/null 2>"$tmp/deny.log"; then
  echo "FAIL stranger allowed chat insertion" >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.direct_messages(conversation_id,sender_user_id,body) VALUES ('$conversation_id','00000000-0000-4000-8000-000000000001','spoof');" >/dev/null 2>"$tmp/deny.log"; then
  echo "FAIL forged message sender" >&2; exit 1
fi
query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.direct_messages SET body='spoofed' WHERE sender_user_id='00000000-0000-4000-8000-000000000001';" >/dev/null
expect "participant B cannot edit A message" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.direct_messages WHERE body='spoofed';")"
expect "participant A can edit own message" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.direct_messages SET body='Hello again' WHERE sender_user_id='00000000-0000-4000-8000-000000000001' RETURNING 1;" | grep -c '^1$' || true)"
if query_as 00000000-0000-4000-8000-000000000001 "DELETE FROM public.direct_messages WHERE sender_user_id='00000000-0000-4000-8000-000000000001';" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL hard deletion without policy/grant' >&2; exit 1
fi
expect "one message survives" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.direct_messages;")"
expect "two schema migrations" "2" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM allbee_platform.schema_migrations;')"
echo 'PASS Neon Auth core: self profiles, immutable role ownership, two-party conversation RLS, no sender spoofing, no foreign edits or hard deletes, safe replay'

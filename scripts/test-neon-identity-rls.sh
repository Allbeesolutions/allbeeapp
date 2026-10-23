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
# Keep the chain open-ended: a newly added numbered migration must run in CI.
# Replaying each file also catches non-idempotent ports before staging apply.
shopt -s nullglob
migrations=("$repo"/database/neon/[0-9][0-9][0-9]_*.sql)
[[ ${#migrations[@]} -gt 0 ]] || { echo 'FAIL no Neon migrations found' >&2; exit 1; }
for migration in "${migrations[@]}"; do
  psql -X -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

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
# An invitation is not permission to send messages until recipient accepts.
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.direct_messages(conversation_id,sender_user_id,body) VALUES ('$conversation_id','00000000-0000-4000-8000-000000000001','Premature');" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL unaccepted chat permitted' >&2; exit 1
fi
# Invitation sender cannot self-approve (the recipient must accept).
expect "inviter cannot self-approve" "0" "$(query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.direct_conversations SET accepted_at=now() WHERE id='$conversation_id' RETURNING 1;" | grep -c '^1$' || true)"
expect "recipient can accept" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.direct_conversations SET accepted_at=now() WHERE id='$conversation_id' RETURNING 1;" | grep -c '^1$' || true)"
# The supplied future date MUST be overwritten with the database's present time.
expect "acceptance server time" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT (accepted_at <= statement_timestamp() AND accepted_at >= statement_timestamp() - interval '1 minute')::int FROM public.direct_conversations WHERE id='$conversation_id';")"
if query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.direct_conversations SET accepted_at=null WHERE id='$conversation_id';" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL invitation acceptance reversed' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.direct_conversations SET accepted_at=now() + interval '20 years' WHERE id='$conversation_id';" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL accepted invitation timestamp changed again' >&2; exit 1
fi

# Column GRANTs must reject attempts to forge message IDs and timestamps.
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.direct_messages(conversation_id,sender_user_id,body,created_at) VALUES ('$conversation_id','00000000-0000-4000-8000-000000000001','Forged clock', now() - interval '30 days');" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL forged message creation timestamp' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.direct_messages(id,conversation_id,sender_user_id,body) VALUES (gen_random_uuid(),'$conversation_id','00000000-0000-4000-8000-000000000001','Forged ID');" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL user-controlled message ID' >&2; exit 1
fi
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
expect "body edit stamped by server" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT (edited_at IS NOT NULL AND edited_at BETWEEN now()-interval '1 minute' AND now())::int FROM public.direct_messages WHERE sender_user_id='00000000-0000-4000-8000-000000000001';")"
if query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.direct_messages SET edited_at=now()+interval '20 years' WHERE sender_user_id='00000000-0000-4000-8000-000000000001';" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL message edit timestamp forgery allowed' >&2; exit 1
fi

if query_as 00000000-0000-4000-8000-000000000001 "DELETE FROM public.direct_messages WHERE sender_user_id='00000000-0000-4000-8000-000000000001';" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL hard deletion without policy/grant' >&2; exit 1
fi
expect "one message survives" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.direct_messages;")"
# Deleted content must be scrubbed at rest and deletion must be terminal.
query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.direct_messages SET deleted_at=now()+interval '20 years' WHERE sender_user_id='00000000-0000-4000-8000-000000000001';" >/dev/null
expect "message deletion scrubbed" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT (body='[Deleted message]' AND deleted_at <= now() AND edited_at IS NULL)::int FROM public.direct_messages WHERE conversation_id='$conversation_id';")"
# An UPDATE affecting zero RLS-visible rows is a *successful query*; check
# mutation count, not merely whether SQL returned an error.
expect "deleted message cannot be updated" "0" "$(query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.direct_messages SET deleted_at=null, body='undelete' WHERE sender_user_id='00000000-0000-4000-8000-000000000001' RETURNING 1;" | grep -c '^1$' || true)"
expect "message text remains scrubbed" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT (body='[Deleted message]' AND deleted_at IS NOT NULL)::int FROM public.direct_messages WHERE sender_user_id='00000000-0000-4000-8000-000000000001';")"
# No self-role promotion; public RPC can read only its authenticated caller.
expect "unassigned user is client" "client" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT public.my_member_access()->>'role';")"
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO allbee_private.member_roles(user_id,role,status) VALUES('00000000-0000-4000-8000-000000000002','accountant','active');" >/dev/null
expect "role A remains client" "client" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT public.my_member_access()->>'role';")"
expect "role B resolves accountant" "accountant" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT public.my_member_access()->>'role';")"
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE anonymous; SELECT public.my_member_access();" >/dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL anonymous role read granted' >&2; exit 1
fi

# A suspended member's otherwise-valid session cannot view or mutate app data.
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null
expect "suspended role reported safely" "suspended" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT public.my_member_access()->>'status';")"
expect "suspended profile hidden" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.member_profiles;")"
expect "suspended messages hidden" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.direct_messages;")"
expect "suspended conversations hidden" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.direct_conversations;")"
if query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.member_profiles(user_id,display_name) VALUES('00000000-0000-4000-8000-000000000002','Bad');" > /dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL suspended user allowed to write' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "SELECT * FROM allbee_private.member_role_audit;" > /dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL client reads private role audit' >&2; exit 1
fi
expect "role changes audited" "2" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM allbee_private.member_role_audit;')"
# Work tasks use trusted auth UUIDs; JSON person names cannot escalate scope.
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.tasks(id,data,owner_user_id,assignee_user_id) VALUES('task_1','{}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');" > /dev/null 2>"$tmp/deny.log"; then
  echo 'FAIL client created employee task' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO allbee_private.member_roles(user_id,role,status) VALUES('00000000-0000-4000-8000-000000000001','staff','active');" >/dev/null
query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.tasks(id,data,owner_user_id,assignee_user_id) VALUES('task_1','{\"title\":\"QA\"}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');" >/dev/null
expect "task owner can read" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.tasks WHERE id='task_1';")"
expect "suspended assignee denied" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.tasks;")"
expect "unrelated user sees no tasks" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.tasks;")"
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET status='active' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null
expect "active assignee can read" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.tasks WHERE id='task_1';")"
expect "assignee can edit task status" "1" "$(query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.tasks SET state='in_progress' WHERE id='task_1' RETURNING 1;" | grep -c '^1$' || true)"
if query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.tasks SET owner_user_id='00000000-0000-4000-8000-000000000002' WHERE id='task_1';" > /dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL unauthorized owner reassignment allowed' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.tasks(id,owner_user_id,assignee_user_id,data) VALUES('task_fake','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','{}');" > /dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL forged owner task insertion' >&2; exit 1
fi
expect "task owner can still see" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.tasks WHERE id='task_1';")"
# Separate, recipient-scoped notification inbox. Only active internal admins
# can send; sender is always the authenticated actor, not editable metadata.
if query_as 00000000-0000-4000-8000-000000000001 "INSERT INTO public.member_notifications(recipient_user_id,sender_user_id,title,body) VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Staff spoof','No');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL ordinary staff can send admin notifications' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET role='admin' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null
if query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.member_notifications(recipient_user_id,sender_user_id,title,body) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Forged sender','No');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL notification sender impersonation' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.member_notifications(recipient_user_id,sender_user_id,title,body,created_at) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Forged time','No',now() - interval '6 months');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL notification timestamp spoof' >&2; exit 1
fi
# The admin sender deliberately has no SELECT policy on recipients' inboxes.
# Never return a recipient's notification row to the sending account.
query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.member_notifications(recipient_user_id,sender_user_id,kind,title,body) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','general','Staging alert','Your task has an update');" >/dev/null
notification_id="$(query_as 00000000-0000-4000-8000-000000000001 "SELECT id FROM public.member_notifications WHERE title='Staging alert';" | grep -E '^[a-f0-9-]{36}$' | head -1)"
[[ -n "$notification_id" ]] || { echo 'FAIL notification did not create' >&2; exit 1; }
expect "notification recipient sees own" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.member_notifications;")"
expect "notification other client sees none" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.member_notifications;")"
expect "notification admin cannot read recipient inbox" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.member_notifications;")"
expect "other client cannot acknowledge recipient alert" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "UPDATE public.member_notifications SET read_at=now() WHERE id='$notification_id' RETURNING 1;" | grep -c '^1$' || true)"
expect "recipient acknowledges notification" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.member_notifications SET read_at=now() + interval '3 years' WHERE id='$notification_id' RETURNING 1;" | grep -c '^1$' || true)"
expect "notification read time is server stamped" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT (read_at BETWEEN now() - interval '1 minute' AND now())::int FROM public.member_notifications WHERE id='$notification_id';")"
if query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.member_notifications SET read_at=null WHERE id='$notification_id';" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL cannot unread acknowledged notification' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "UPDATE public.member_notifications SET body='changed' WHERE id='$notification_id';" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL recipient rewrote notification body' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000001';" >/dev/null
expect "suspended recipient denied notifications" "0" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.member_notifications;")"
# Owner-only fixture inserts: APN JSON is not a browser authorization source.
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.apn_users(id,user_id,data) VALUES
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',jsonb_build_object('id','00000000-0000-4000-8000-000000000002','role','superadmin')),
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003',jsonb_build_object('id','00000000-0000-4000-8000-000000000003','role','admin'));" >/dev/null
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.apn_users(id,user_id) VALUES('forged','00000000-0000-4000-8000-000000000001');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL APN row accepted a forged identity' >&2; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.apn_users(id,user_id,data) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','{\"id\":\"forged\"}');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL APN JSON accepted a forged identity' >&2; exit 1
fi
# Nine-role matrix: only internal roles may read assigned tasks; only admins
# may send alerts; APN partner rows are self-only for partner/head roles and
# management-visible for admin/superadmin. This is not full app parity.
for current_role in superadmin admin accountant staff intern client partner district_head state_head; do
  psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET role='$current_role',status='active' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null
  case "$current_role" in
    superadmin|admin|accountant|staff|intern) task_view='1' ;;
    *) task_view='0' ;;
  esac
  expect "task role matrix $current_role" "$task_view" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.tasks WHERE id='task_1';")"
  case "$current_role" in
    superadmin|admin) apn_view='2' ;;
    partner|district_head|state_head) apn_view='1' ;;
    *) apn_view='0' ;;
  esac
  expect "APN role matrix $current_role" "$apn_view" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.apn_users;")"
  application_sql="SELECT public.apn_partner_apply('Sample Partner','+91 98765 43210','Chennai')->>'status';"
  if [[ "$current_role" == client || "$current_role" == partner ]]; then
    expect "APN application role $current_role" "pending" "$(query_as 00000000-0000-4000-8000-000000000002 "$application_sql")"
  elif query_as 00000000-0000-4000-8000-000000000002 "$application_sql" >/dev/null 2>"$tmp/deny.log"; then
    echo "FAIL $current_role improperly submitted an APN application" >&2; exit 1
  fi
  notice_sql="INSERT INTO public.member_notifications(recipient_user_id,sender_user_id,kind,title,body) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','general','Role matrix check','Only admin roles may send');"
  if [[ "$current_role" == superadmin || "$current_role" == admin ]]; then
    query_as 00000000-0000-4000-8000-000000000002 "$notice_sql" > /dev/null || { echo "FAIL $current_role admin notification send" >&2;exit 1; }
  else
    if query_as 00000000-0000-4000-8000-000000000002 "$notice_sql" >/dev/null 2>"$tmp/deny.log"; then
      echo "FAIL $current_role improperly sent an admin notification" >&2; exit 1
    fi
  fi
done
if query_as 00000000-0000-4000-8000-000000000002 "UPDATE public.apn_users SET data='{}' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL APN browser update granted' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "DELETE FROM public.apn_users WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL APN browser delete granted' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000002 "INSERT INTO public.apn_users(id,user_id) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL APN browser insert granted' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO allbee_private.member_roles(user_id,role,status) VALUES('00000000-0000-4000-8000-000000000003','partner','active');" >/dev/null
expect "partner sees own APN row only" "1" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.apn_users;")"
expect "partner cannot see another APN row" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.apn_users WHERE user_id='00000000-0000-4000-8000-000000000002';")"
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET status='suspended' WHERE user_id='00000000-0000-4000-8000-000000000003';" >/dev/null
expect "suspended partner sees no APN rows" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.apn_users;")"
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM allbee_private.member_roles WHERE user_id='00000000-0000-4000-8000-000000000003';" >/dev/null
expect "deleted Auth identity sees no APN rows" "0" "$(query_as 00000000-0000-4000-8000-000000000099 "SELECT count(*) FROM public.apn_users;")"
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE anonymous; SELECT count(*) FROM public.apn_users;" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL anonymous APN directory access' >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET role='admin' WHERE user_id='00000000-0000-4000-8000-000000000002';" >/dev/null

# Pending self-application creates one Auth-linked row and one private audit.
# It cannot assign a role, approve itself, or overwrite an existing APN row.
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM public.apn_users WHERE user_id='00000000-0000-4000-8000-000000000003';" >/dev/null
if query_as 00000000-0000-4000-8000-000000000003 "SELECT public.apn_partner_apply('X','bad-number','C');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL malformed APN application accepted' >&2; exit 1
fi
expect "pending application created" "pending" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT public.apn_partner_apply('Robin Example','+91 99999 88888','Chennai')->>'status';")"
expect "application belongs to verified Auth identity" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.apn_users WHERE id='00000000-0000-4000-8000-000000000003' AND user_id='00000000-0000-4000-8000-000000000003' AND data->>'name'='Robin Example' AND data->>'mobile'='919999988888' AND data->>'status'='pending';")"
expect "application does not self-grant partner role" "client" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT public.my_member_access()->>'role';")"
expect "application audit once" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM allbee_private.apn_application_audit WHERE applicant_user_id='00000000-0000-4000-8000-000000000003';")"
expect "application replay stays pending" "pending" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT public.apn_partner_apply('Changed Name','+91 99999 88888','Chennai')->>'status';")"
expect "application replay cannot edit initial data" "Robin Example" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT data->>'name' FROM public.apn_users WHERE user_id='00000000-0000-4000-8000-000000000003';")"
expect "application replay creates no extra audit" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM allbee_private.apn_application_audit WHERE applicant_user_id='00000000-0000-4000-8000-000000000003';")"
expect "pending client cannot read raw APN directory" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.apn_users;")"
if query_as 00000000-0000-4000-8000-000000000002 "SELECT public.apn_partner_apply('Admin','9999988888','Chennai');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL admin used partner self-application path' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "SELECT public.apn_partner_apply('Suspended','9999988888','Chennai');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL suspended account submitted APN application' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000099 "SELECT public.apn_partner_apply('Deleted','9999988888','Chennai');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL deleted Auth identity submitted APN application' >&2; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE anonymous; SELECT public.apn_partner_apply('Anon','9999988888','Chennai');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL anonymous APN application access' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000003 "SELECT * FROM allbee_private.apn_application_audit;" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL applicant read private APN application audit' >&2; exit 1
fi

# Privileged management gate: admin, clients, suspended accounts cannot change roles.
if query_as 00000000-0000-4000-8000-000000000002 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','admin','active');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL ordinary admin promoted a client' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000003 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000002','superadmin','active');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL unassigned client promoted a member' >&2; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE anonymous; SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','staff','active');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL anonymous superadmin RPC available' >&2; exit 1
fi
# A company's first superadmin must be explicitly bootstrapped by its trusted
# database owner. In this disposable test ONLY, emulate that trusted action.
psql -X -v ON_ERROR_STOP=1 -c "UPDATE allbee_private.member_roles SET role='superadmin',status='active' WHERE user_id='00000000-0000-4000-8000-000000000001';" >/dev/null
if query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000001','client','suspended');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL superadmin self-demotion' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','nonsense','active');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL invalid privilege level' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','staff','unrestricted');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL invalid status' >&2; exit 1
fi
if query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000099','staff','active');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL unknown target user' >&2; exit 1
fi
expect "superadmin grants scoped member role" "intern" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','intern','active')->>'role';")"
expect "new role appears to target" "intern" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT public.my_member_access()->>'role';")"
expect "role audit identifies verified acting superadmin" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM allbee_private.member_role_audit WHERE actor_user_id='00000000-0000-4000-8000-000000000001' AND user_id='00000000-0000-4000-8000-000000000003' AND new_role='intern';")"
expect "superadmin suspends other user" "suspended" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','intern','suspended')->>'status';")"
expect "suspended employee cannot read tasks" "0" "$(query_as 00000000-0000-4000-8000-000000000003 "SELECT count(*) FROM public.tasks;")"
expect "superadmin restores other account" "active" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT public.manage_member_role('00000000-0000-4000-8000-000000000003','intern','active')->>'status';")"
if query_as 00000000-0000-4000-8000-000000000003 "SELECT * FROM allbee_private.member_role_audit;" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL newly provisioned employee read audit history' >&2; exit 1
fi
# A plausible JWT user ID with no Neon Auth record cannot access data.
# This emulates a stale session without removing any test fixture.
if query_as 00000000-0000-4000-8000-000000000099 "SELECT public.my_member_access();" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL absent identity still resolves role' >&2; exit 1
fi
expect "absent Auth identity is not active" "f" "$(query_as 00000000-0000-4000-8000-000000000099 "SELECT allbee_private.is_active_member();")"
expect "absent Auth identity has zero tasks" "0" "$(query_as 00000000-0000-4000-8000-000000000099 "SELECT count(*) FROM public.tasks;")"
expect "absent Auth identity has zero notifications" "0" "$(query_as 00000000-0000-4000-8000-000000000099 "SELECT count(*) FROM public.member_notifications;")"
expect "restricted trigger uses definer for service lifecycle" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT p.prosecdef::int FROM pg_proc p WHERE p.oid='allbee_private.log_role_change()'::regprocedure;")"
expect "unprivileged user cannot invoke private audit trigger" "f" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT has_function_privilege('authenticated','allbee_private.log_role_change()','EXECUTE');")"
# Removing the Auth identity must retain APN business history, detach its
# login binding, and hide the archived row from every role except superadmin.
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO neon_auth.\"user\"(id,email) VALUES('00000000-0000-4000-8000-000000000004','d@example.test');" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.apn_users(id,user_id,data) VALUES('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004',jsonb_build_object('id','00000000-0000-4000-8000-000000000004','status','active','name','Archived Partner'));" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM neon_auth.\"user\" WHERE id='00000000-0000-4000-8000-000000000004';" >/dev/null
expect "Auth deletion preserves archived APN row" "1" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.apn_users WHERE id='00000000-0000-4000-8000-000000000004' AND user_id IS NULL AND data @> '{\"status\":\"deleted\",\"archived\":true}'::jsonb AND (data->>'deletedAt')::bigint > 0;")"
expect "ordinary admin cannot see deleted APN row" "0" "$(query_as 00000000-0000-4000-8000-000000000002 "SELECT count(*) FROM public.apn_users WHERE id='00000000-0000-4000-8000-000000000004';")"
expect "active superadmin can see archived APN row" "1" "$(query_as 00000000-0000-4000-8000-000000000001 "SELECT count(*) FROM public.apn_users WHERE id='00000000-0000-4000-8000-000000000004';")"
expect "deleted Auth identity cannot see APN history" "0" "$(query_as 00000000-0000-4000-8000-000000000004 "SELECT count(*) FROM public.apn_users;")"
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.apn_users(id,user_id,data) VALUES('detached-invalid',NULL,'{\"status\":\"active\"}');" >/dev/null 2>"$tmp/deny.log"; then
 echo 'FAIL active-looking detached APN record accepted' >&2; exit 1
fi
expect "every schema migration recorded" "${#migrations[@]}" "$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM allbee_platform.schema_migrations;')"
echo 'PASS Neon Auth core: roles, chat, tasks, notifications, nine-role APN isolation, pending self-application and archived Auth deletion; browser APN writes denied'

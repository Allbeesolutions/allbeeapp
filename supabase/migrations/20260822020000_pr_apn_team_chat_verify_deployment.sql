-- =============================================================================
-- ALLBEE — APN Team Chat: read-only deployment smoke check (live verification)
-- File: 20260822020000_pr_apn_team_chat_verify_deployment.sql
--
-- PURELY READ-ONLY: asserts that the patched team-chat schema/functions/grants/
-- RLS are present in the target database and that the corrected friend-request
-- notification text is deployed. Writes NOTHING; on success it commits a no-op
-- migration, on failure the transaction aborts (supabase rolls back). Safe to
-- re-run (idempotent asserts).
-- =============================================================================

begin;

do $$
  declare
  fn text;
  body text;
  cfg text[];
begin
  -- Core write RPCs exist
  select p.proname || '_' || pg_get_function_identity_arguments(p.oid) into fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('apn_send_friend_request','apn_accept_friend_request','apn_reject_friend_request');
  if fn is null then raise exception 'VERIFY FAIL: accept/reject/send functions missing'; end if;

  -- Accept / reject are SECURITY DEFINER
  foreach fn in array array['apn_send_friend_request','apn_accept_friend_request','apn_reject_friend_request'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=fn and p.prosecdef
    ) then
      raise exception 'VERIFY FAIL: % is not SECURITY DEFINER', fn;
    end if;
  end loop;

  -- Hardened search_path (proconfig must carry an explicit search_path)
  foreach fn in array array['apn_send_friend_request','apn_accept_friend_request','apn_reject_friend_request'] loop
    select p.proconfig into cfg
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=fn;
    if cfg is null or not (cfg @> array['search_path=pg_catalog, public, pg_temp']) then
      raise exception 'VERIFY FAIL: % missing hardened search_path', fn;
    end if;
  end loop;

  -- Friend-request notification text is the CORRECTED text
  select pg_get_functiondef(f.oid) into body
  from pg_proc f join pg_namespace n on n.oid=f.pronamespace
  where n.nspname='public' and f.proname='apn_send_friend_request';
  if body is null or body not like '%New APN friend request%' then
    raise exception 'VERIFY FAIL: apn_send_friend_request notification text not corrected';
  end if;
  if body like '%joined APN using your referral code%' then
    raise exception 'VERIFY FAIL: apn_send_friend_request still has old referral text';
  end if;

  -- Accept notification has level + createdBy
  select pg_get_functiondef(f.oid) into body
  from pg_proc f join pg_namespace n on n.oid=f.pronamespace
  where n.nspname='public' and f.proname='apn_accept_friend_request';
  if body is null or body not like '%''level'', ''General''%' or body not like '%''createdBy'', ''APN''%' then
    raise exception 'VERIFY FAIL: apn_accept_friend_request missing level/createdBy';
  end if;

  -- Recipient-scoped authorization present in accept RPC source
  if body not like '%recipient_id = v_self%' then
    raise exception 'VERIFY FAIL: accept RPC not recipient-scoped';
  end if;

  -- Grants to authenticated
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='apn_accept_friend_request'
    and has_function_privilege('authenticated', p.oid, 'execute')
  ) then raise exception 'VERIFY FAIL: apn_accept_friend_request not executable by authenticated'; end if;

  -- RLS enabled on chat tables (pg_class.relrowsecurity = true)
  foreach fn in array array['apn_friend_requests','apn_chat_conversations','apn_chat_participants','apn_chat_messages','apn_chat_read_states'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=fn and c.relrowsecurity
    ) then
      raise exception 'VERIFY FAIL: % RLS not enabled', fn;
    end if;
  end loop;

  raise notice 'VERIFY OK: APN Team Chat deployment verified.';
end $$;

commit;

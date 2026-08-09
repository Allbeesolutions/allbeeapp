-- ════════════════════════════════════════════════════════════════════════
--  ALLBEE — Phase 1 security lockdown · anon execute hygiene
--
--  What: revoke EXECUTE from the `anon` role on SECURITY DEFINER functions in
--        the proposal + requirement engines that (a) carry NO internal
--        authorization check, (b) are never called by the app, and (c) are
--        only invoked from inside other SECURITY DEFINER functions — which
--        keep working, because SECURITY DEFINER bypasses EXECUTE grants.
--
--  Mechanism (verified on the production project ogacjpwlbhmonycjevml):
--  this Supabase project's ALTER DEFAULT PRIVILEGES grant EXECUTE on every
--  new function to `anon`/`authenticated`/`service_role` explicitly — the ACL
--  entries are per-role, NOT the PUBLIC pseudo-role. `revoke ... from public`
--  is therefore a no-op here and the revoke MUST target `anon` directly
--  (kept alongside `public` for defense in depth on other environments).
--  `CREATE OR REPLACE FUNCTION` preserves the existing ACL, so the revoke
--  sticks across re-runs of the migration patches; only DROP + CREATE would
--  re-apply the default grants (then re-run this file).
--
--  Why: the three P0 functions mint CRM quotations/projects, APN commission
--  records and CRM leads with no auth check at all, so any anonymous caller
--  could have triggered them by guessing a UUID.
--
--  Callers verified against src/AllbeeApp.jsx `.rpc()` call sites:
--    proposal_finalize_approval, proposal_write_sections,
--    web_requirement_upsert_lead, web_ai_payload  → never called by the app
--    proposal_get, proposal_create_from_requirement → called as an
--    authenticated user; the authenticated grants are re-asserted below.
--
--  Genuinely public RPCs are LEFT UNTOUCHED on purpose (still anon-executable):
--    • web_ai_start / web_ai_message / web_ai_abandon / web_ai_config and
--      the other web consultant flow RPCs (pr-web-1, pr-web-2)
--    • knowledge_get_pricing / knowledge_estimate / knowledge_search
--      (pr-web-1.5)
--    • proposal_public_get / proposal_public_action — token-protected
--      customer proposal links (pr-web-3)
--    • username_to_email / username_available / email_available — public
--      registration checks (pr1 / pr-ux-2)
--
--  Safe to re-run (revoke/grant are idempotent). Paste into the Supabase
--  SQL Editor. No app redeploy needed. After applying, verify:
--      select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE'),
--             has_function_privilege('authenticated', p.oid, 'EXECUTE')
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname in
--        ('proposal_finalize_approval','proposal_write_sections',
--         'web_requirement_upsert_lead','proposal_create_from_requirement',
--         'proposal_get','web_ai_payload')
--      order by p.proname;
--  Each of the six must show anon = false, authenticated = true.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── P0: privileged writers with no authorization check ───────────────────
-- Called only from inside SECURITY DEFINER functions
-- (proposal_record_action → proposal_finalize_approval;
--  proposal_create_from_requirement → proposal_write_sections;
--  web_ai_message → web_requirement_upsert_lead).
revoke all on function public.proposal_finalize_approval(uuid) from anon, public;
revoke all on function public.proposal_write_sections(uuid, uuid, jsonb) from anon, public;
revoke all on function public.web_requirement_upsert_lead(uuid, text, jsonb, jsonb, uuid) from anon, public;

-- ── Same defect class inside the same engines ────────────────────────────
-- proposal_create_from_requirement: writes a proposal + returns its public
--   approval token; no auth check. Re-assert the authenticated grant the
--   app relies on (pr-web-3 line 345).
revoke all on function public.proposal_create_from_requirement(text, text, text) from anon, public;
grant execute on function public.proposal_create_from_requirement(text, text, text) to authenticated;

-- proposal_get: returns full proposal PII (customer name/email/phone,
--   versions, approvals, comments); no auth check. Authenticated grant kept.
revoke all on function public.proposal_get(uuid) from anon, public;
grant execute on function public.proposal_get(uuid) to authenticated;

-- web_ai_payload: returns the full conversation transcript incl. customer
--   answers (names, phones, emails); no auth check. Grant kept for future
--   authenticated callers; internal definer callers are unaffected.
revoke all on function public.web_ai_payload(uuid) from anon, public;
grant execute on function public.web_ai_payload(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

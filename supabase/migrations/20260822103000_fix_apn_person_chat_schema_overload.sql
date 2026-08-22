-- Remove the stale zero-argument overload that can make PostgREST expose
-- apn_get_or_create_person_conversation() instead of the required text argument.
-- Existing person conversations are untouched; the client also has a safe
-- deterministic-slug fallback while an environment catches up.
drop function if exists public.apn_get_or_create_person_conversation();

grant execute on function public.apn_get_or_create_person_conversation(text) to authenticated;

-- Rebuild PostgREST's RPC schema cache immediately after the overload is removed.
notify pgrst, 'reload schema';

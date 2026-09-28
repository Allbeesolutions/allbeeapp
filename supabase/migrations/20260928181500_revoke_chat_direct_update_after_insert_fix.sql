begin;

-- New records are now persisted with INSERT instead of UPSERT, so direct chat
-- UPDATE privilege is no longer needed. Message edits, deletes and read receipts
-- stay behind identity-checked RPCs and chat_no_update remains deny-all.
revoke update on table public.chat from authenticated, anon, public;

commit;
notify pgrst,'reload schema';

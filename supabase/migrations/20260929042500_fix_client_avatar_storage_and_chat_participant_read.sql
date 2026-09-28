-- RLS policies require the matching table privilege before Postgres can evaluate them.
grant select on table public.apn_chat_participants to authenticated;

-- Storage upload returns object metadata; let an authenticated uploader read only
-- their own public-media metadata. Public object delivery remains bucket-public.
drop policy if exists public_media_select_own on storage.objects;
create policy public_media_select_own on storage.objects
for select to authenticated
using (bucket_id='public-media' and owner_id=(select auth.uid())::text);

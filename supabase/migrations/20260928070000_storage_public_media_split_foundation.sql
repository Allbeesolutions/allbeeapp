begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('public-media','public-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif']::text[])
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "public_media_insert" on storage.objects;
drop policy if exists "public_media_update" on storage.objects;
drop policy if exists "public_media_delete" on storage.objects;
create policy "public_media_insert" on storage.objects for insert to authenticated with check(bucket_id='public-media');
create policy "public_media_update" on storage.objects for update to authenticated using(bucket_id='public-media' and (owner_id=(select auth.uid()::text) or public.is_admin())) with check(bucket_id='public-media');
create policy "public_media_delete" on storage.objects for delete to authenticated using(bucket_id='public-media' and (owner_id=(select auth.uid()::text) or public.is_admin()));
commit;

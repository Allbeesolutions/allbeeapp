begin;
drop policy if exists apn_chat_attachments_select on public.apn_chat_attachments;
create policy apn_chat_attachments_select on public.apn_chat_attachments for select to authenticated
using (public.is_admin() or exists(select 1 from public.apn_chat_participants p where p.conversation_id=apn_chat_attachments.conversation_id and p.participant_id=(select auth.uid())::text));
drop policy if exists apn_chat_attachments_insert on public.apn_chat_attachments;
create policy apn_chat_attachments_insert on public.apn_chat_attachments for insert to authenticated
with check (uploader_id=(select auth.uid())::text and exists(select 1 from public.apn_chat_participants p where p.conversation_id=apn_chat_attachments.conversation_id and p.participant_id=(select auth.uid())::text) and exists(select 1 from public.apn_chat_messages m where m.id=apn_chat_attachments.message_id and m.conversation_id=apn_chat_attachments.conversation_id));
commit;

begin;

drop policy if exists team_chat_all_authenticated on public.team_chat;
drop policy if exists team_chat_sel on public.team_chat;
drop policy if exists team_chat_ins on public.team_chat;
drop policy if exists team_chat_del on public.team_chat;

create policy team_chat_sel on public.team_chat
for select to authenticated
using (not public.is_client() and not public.is_partner());

create policy team_chat_ins on public.team_chat
for insert to authenticated
with check (
  not public.is_client()
  and not public.is_partner()
  and (data->>'userId') = auth.uid()::text
);

create policy team_chat_del on public.team_chat
for delete to authenticated
using (public.is_admin() or (data->>'userId') = auth.uid()::text);

revoke update on public.team_chat from authenticated, anon, public;

commit;
notify pgrst,'reload schema';

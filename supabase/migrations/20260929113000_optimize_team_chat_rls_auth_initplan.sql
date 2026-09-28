-- Preserve team_chat authorization while evaluating auth.uid() once per statement.
drop policy if exists team_chat_ins on public.team_chat;
create policy team_chat_ins on public.team_chat
for insert to authenticated
with check (
  not public.is_client()
  and not public.is_partner()
  and data->>'userId' = (select auth.uid())::text
);

drop policy if exists team_chat_del on public.team_chat;
create policy team_chat_del on public.team_chat
for delete to authenticated
using (
  public.is_admin()
  or data->>'userId' = (select auth.uid())::text
);

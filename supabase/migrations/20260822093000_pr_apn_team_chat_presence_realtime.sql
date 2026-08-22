-- Realtime presence updates for Team Chat contact availability.
alter publication supabase_realtime add table public.apn_chat_presence;
notify pgrst, 'reload schema';

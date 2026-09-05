begin;

-- Notification user state is an internal implementation detail. Clients may
-- read it through the scoped RPC and change it only through audited state RPCs.
revoke select,insert,update,delete on public.notification_user_state from authenticated,anon,public;
drop policy if exists notification_user_state_self on public.notification_user_state;

commit;
notify pgrst,'reload schema';

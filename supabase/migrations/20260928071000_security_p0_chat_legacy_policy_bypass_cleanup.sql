begin;
-- Keep the stricter chat_ins policy: signed-in non-client and userId=auth.uid().
drop policy if exists chat_insert_internal on public.chat;
-- Direct chat UPDATE stays denied; edits/deletes use guarded RPCs.
drop policy if exists chat_update_internal on public.chat;
-- app_config_tnc_read is the maintained superset (tnc_* + company).
drop policy if exists app_config_read_tnc on public.app_config;
commit;

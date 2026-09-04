begin;
do $outer$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='allbee_notification_push_worker_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'allbee_notification_push_worker_secret','ALLBEE notification push worker authentication secret');
 end if;
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.unschedule('allbee_notification_push_worker'); exception when others then null; end;
  perform cron.schedule('allbee_notification_push_worker','* * * * *',$job$select net.http_post(url:='https://ogacjpwlbhmonycjevml.supabase.co/functions/v1/notification-push-worker',headers:=jsonb_build_object('Content-Type','application/json','x-notification-push-worker-key',(select decrypted_secret from vault.decrypted_secrets where name='allbee_notification_push_worker_secret')),body:='{}'::jsonb,timeout_milliseconds:=30000)$job$);
 end if;
end $outer$;
commit;
notify pgrst,'reload schema';

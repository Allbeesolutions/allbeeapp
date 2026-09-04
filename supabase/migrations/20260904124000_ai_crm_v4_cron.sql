begin;
create extension if not exists pg_net;

do $outer$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='allbee_crm_worker_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'allbee_crm_worker_secret','AI CRM worker authentication secret');
 end if;
end $outer$;

do $outer$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.unschedule('allbee_ai_crm_worker'); exception when others then null; end;
  perform cron.schedule('allbee_ai_crm_worker','* * * * *',
   $job$select net.http_post(
     url:='https://ogacjpwlbhmonycjevml.supabase.co/functions/v1/ai-crm-worker',
     headers:=jsonb_build_object('Content-Type','application/json','x-allbee-worker-key',(select decrypted_secret from vault.decrypted_secrets where name='allbee_crm_worker_secret')),
     body:=jsonb_build_object('source','supabase_cron','scheduled_at',now()),timeout_milliseconds:=10000
   )$job$);
 end if;
end $outer$;
commit;
notify pgrst,'reload schema';

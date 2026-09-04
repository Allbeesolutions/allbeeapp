begin;
create table if not exists public.ai_memory_sync_queue(id bigserial primary key,source_type text not null,source_id text not null,created_at timestamptz not null default now(),processed_at timestamptz);
create index if not exists ai_memory_sync_queue_pending_idx on public.ai_memory_sync_queue(processed_at,created_at);
alter table public.ai_memory_sync_queue enable row level security;
revoke all on public.ai_memory_sync_queue from public,anon,authenticated;

create or replace function public.ai_memory_sync_entity(p_source_type text,p_source_id text,p_title text,p_content text,p_metadata jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare h text; oldh text;
begin
 h:=encode(extensions.digest(coalesce(p_title,'')||E'\n'||coalesce(p_content,''),'sha256'),'hex');
 select content_hash into oldh from public.ai_memory_documents where source_type=p_source_type and source_id=p_source_id;
 insert into public.ai_memory_documents(source_type,source_id,title,content,metadata,content_hash,active,version_no,conflict_state,updated_at)
 values(p_source_type,p_source_id,coalesce(p_title,''),coalesce(p_content,''),coalesce(p_metadata,'{}'),h,true,1,'clean',now())
 on conflict(source_type,source_id) do update set title=excluded.title,content=excluded.content,metadata=excluded.metadata,content_hash=excluded.content_hash,active=true,version_no=public.ai_memory_documents.version_no+case when public.ai_memory_documents.content_hash<>excluded.content_hash then 1 else 0 end,conflict_state=case when public.ai_memory_documents.content_hash<>excluded.content_hash then 'updated' else public.ai_memory_documents.conflict_state end,updated_at=now();
 insert into public.ai_memory_sync_queue(source_type,source_id) values(p_source_type,p_source_id);
end $$;

create or replace function public.ai_memory_crm_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.ai_memory_sync_entity('crm_lead',new.id::text,coalesce(new.customer_name,new.company,''),format('Lead %s. Status %s. Priority %s. Budget %s. Closing %s. Score %s. Remarks: %s',coalesce(new.customer_name,new.company,''),coalesce(new.status,''),coalesce(new.priority,''),coalesce(new.expected_budget,0),coalesce(new.expected_closing_date::text,''),coalesce(new.lead_score,0),coalesce(new.remarks,'')),jsonb_build_object('lead_number',new.lead_number,'district',new.district,'state',new.state,'project_category',new.project_category)); return new; end $$;
create or replace function public.ai_memory_apn_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.ai_memory_sync_entity('apn_partner',new.id::text,coalesce(new.data->>'name','APN partner'),format('APN partner %s. Status %s. District %s. State %s. Referral code %s.',coalesce(new.data->>'name',''),coalesce(new.data->>'status',''),coalesce(new.data->>'district',''),coalesce(new.data->>'state',''),coalesce(new.data->>'referral_code','')),jsonb_build_object('district',new.data->>'district','state',new.data->>'state','status',new.data->>'status')); return new; end $$;
create or replace function public.ai_memory_finance_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.ai_memory_sync_entity('finance_transaction',new.id::text,'Finance transaction',format('Finance transaction %s kind %s status %s amount %s.',new.id,coalesce(new.data->>'kind',''),coalesce(new.data->>'status',''),coalesce(new.data->>'amount',new.data->>'total','')),jsonb_build_object('kind',new.data->>'kind','status',new.data->>'status','amount',coalesce(new.data->>'amount',new.data->>'total'))); return new; end $$;
drop trigger if exists ai_memory_crm_sync on public.crm_leads; create trigger ai_memory_crm_sync after insert or update on public.crm_leads for each row execute function public.ai_memory_crm_trigger();
drop trigger if exists ai_memory_apn_sync on public.apn_users; create trigger ai_memory_apn_sync after insert or update on public.apn_users for each row execute function public.ai_memory_apn_trigger();
drop trigger if exists ai_memory_finance_sync on public.transactions; create trigger ai_memory_finance_sync after insert or update on public.transactions for each row execute function public.ai_memory_finance_trigger();

create or replace function public.ai_memory_resolve_conflict(p_id uuid,p_resolution text,p_content text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.ai_memory_documents%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if;
 select * into v from public.ai_memory_documents where id=p_id for update;
 if not found then raise exception 'Memory document not found.'; end if;
 if p_resolution not in ('accept','archive') then raise exception 'Resolution must be accept or archive.'; end if;
 if p_resolution='archive' then update public.ai_memory_documents set active=false,conflict_state='archived',updated_at=now() where id=p_id returning * into v;
 else update public.ai_memory_documents set content=coalesce(p_content,content),content_hash=encode(extensions.digest(coalesce(title,'')||E'\n'||coalesce(coalesce(p_content,content),''),'sha256'),'hex'),conflict_state='resolved',version_no=version_no+1,updated_at=now() where id=p_id returning * into v; end if;
 return to_jsonb(v);
end $$;
revoke execute on function public.ai_memory_resolve_conflict(uuid,text,text) from public,anon; grant execute on function public.ai_memory_resolve_conflict(uuid,text,text) to authenticated;

create or replace function public.ai_memory_health() returns jsonb language sql security definer stable set search_path=public as $$
select jsonb_build_object('total',(select count(*) from public.ai_memory_documents),'embedded',(select count(*) from public.ai_memory_documents where embedding is not null),'pending',(select count(*) from public.ai_memory_documents where active and embedding is null),'expired',(select count(*) from public.ai_memory_documents where active and expires_at is not null and expires_at<=now()),'conflicts',(select count(*) from public.ai_memory_documents where conflict_state not in ('clean','updated','resolved'))) where public.ai_can_read()
$$;
revoke execute on function public.ai_memory_health() from public,anon; grant execute on function public.ai_memory_health() to authenticated;

create or replace function public.ai_memory_archive_expired() returns integer language plpgsql security definer set search_path=public as $$ declare n integer; begin update public.ai_memory_documents set active=false,conflict_state='archived',updated_at=now() where active and expires_at is not null and expires_at<=now(); get diagnostics n=row_count; return n; end $$;
revoke execute on function public.ai_memory_archive_expired() from public,anon,authenticated; grant execute on function public.ai_memory_archive_expired() to service_role;
do $outer$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='allbee_ai_memory_worker_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'allbee_ai_memory_worker_secret','AI memory embedding worker authentication secret');
 end if;
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.unschedule('allbee_ai_memory_embedding'); exception when others then null; end;
  perform cron.schedule('allbee_ai_memory_embedding','*/5 * * * *',$job$select net.http_post(url:='https://ogacjpwlbhmonycjevml.supabase.co/functions/v1/ai-memory-runtime',headers:=jsonb_build_object('Content-Type','application/json','x-ai-memory-worker-key',(select decrypted_secret from vault.decrypted_secrets where name='allbee_ai_memory_worker_secret')),body:='{"mode":"index"}'::jsonb,timeout_milliseconds:=15000)$job$);
  begin perform cron.unschedule('allbee_ai_memory_archive'); exception when others then null; end;
  perform cron.schedule('allbee_ai_memory_archive','13 * * * *','select public.ai_memory_archive_expired();');
 end if;
end $outer$;
commit;
notify pgrst,'reload schema';

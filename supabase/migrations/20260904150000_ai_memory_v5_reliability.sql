begin;

-- Production reliability: source-trigger correctness, service-worker access,
-- durable queue attempts/errors, and embedding work ownership.
alter table public.ai_memory_sync_queue
  add column if not exists attempts integer not null default 0;
alter table public.ai_memory_sync_queue
  add column if not exists last_error text;
alter table public.ai_memory_sync_queue
  add column if not exists claimed_at timestamptz;
create index if not exists ai_memory_sync_queue_claim_idx
  on public.ai_memory_sync_queue(processed_at,claimed_at,created_at);

create or replace function public.ai_memory_apn_trigger()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.ai_memory_sync_entity(
    'apn_partner',new.id::text,
    coalesce(new.data->>'name','APN partner'),
    format('APN partner %s. Status %s. District %s. State %s. Referral code %s.',
      coalesce(new.data->>'name',''),coalesce(new.data->>'status',''),
      coalesce(new.data->>'district',''),coalesce(new.data->>'state',''),
      coalesce(new.data->>'referral_code','')),
    jsonb_build_object('district',new.data->>'district','state',new.data->>'state','status',new.data->>'status'));
  return new;
end $$;

create or replace function public.ai_memory_finance_trigger()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.ai_memory_sync_entity(
    'finance_transaction',new.id::text,'Finance transaction',
    format('Finance transaction %s kind %s status %s amount %s.',new.id,
      coalesce(new.data->>'kind',''),coalesce(new.data->>'status',''),
      coalesce(new.data->>'amount',new.data->>'total','')),
    jsonb_build_object('kind',new.data->>'kind','status',new.data->>'status',
      'amount',coalesce(new.data->>'amount',new.data->>'total')));
  return new;
end $$;

create or replace function public.ai_memory_sync_knowledge()
returns integer language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare changed integer:=0;
begin
  if not public.ai_can_read() and coalesce(auth.role(),'')<>'service_role' then
    raise exception 'AI memory access denied.' using errcode='insufficient_privilege';
  end if;
  insert into public.ai_memory_documents
    (source_type,source_id,title,content,metadata,content_hash,active,updated_at)
  select coalesce(k.result_type,'knowledge'),coalesce(k.result_id,k.slug),
    coalesce(k.title,''),coalesce(k.body,''),
    jsonb_build_object('slug',k.slug,'source','knowledge_search_index'),
    encode(extensions.digest(coalesce(k.title,'')||E'\n'||coalesce(k.body,''),'sha256'),'hex'),true,now()
  from public.knowledge_search_index k
  on conflict(source_type,source_id) do update set title=excluded.title,content=excluded.content,
    metadata=excluded.metadata,content_hash=excluded.content_hash,active=true,updated_at=now()
    where public.ai_memory_documents.content_hash<>excluded.content_hash or public.ai_memory_documents.active=false;
  get diagnostics changed=row_count;
  return changed;
end $$;

create or replace function public.ai_memory_sync_business()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0; r record;
begin
  if not public.ai_can_read() and coalesce(auth.role(),'')<>'service_role' then
    raise exception 'AI memory access denied.' using errcode='insufficient_privilege';
  end if;
  for r in select id::text source_id,customer_name,status,priority,expected_budget,remarks,lead_number,district,state,project_category from public.crm_leads loop
    perform public.ai_memory_sync_entity('crm_lead',r.source_id,coalesce(r.customer_name,'CRM lead'),
      format('Lead %s status %s priority %s budget %s closing remarks %s.',coalesce(r.customer_name,''),coalesce(r.status,''),coalesce(r.priority,''),coalesce(r.expected_budget,0),coalesce(r.remarks,'')),
      jsonb_build_object('lead_number',r.lead_number,'district',r.district,'state',r.state,'project_category',r.project_category));
    n:=n+1;
  end loop;
  for r in select id::text source_id,data from public.apn_users loop
    perform public.ai_memory_sync_entity('apn_partner',r.source_id,coalesce(r.data->>'name','APN partner'),
      format('APN partner %s. Status %s. District %s. State %s. Referral code %s.',coalesce(r.data->>'name',''),coalesce(r.data->>'status',''),coalesce(r.data->>'district',''),coalesce(r.data->>'state',''),coalesce(r.data->>'referral_code','')),
      jsonb_build_object('district',r.data->>'district','state',r.data->>'state','status',r.data->>'status'));
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.ai_memory_worker_claim(p_limit integer default 100)
returns table(id bigint,source_type text,source_id text)
language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker access required.' using errcode='insufficient_privilege'; end if;
  return query
  with picked as (
    select q.id from public.ai_memory_sync_queue q
    where q.processed_at is null and (q.claimed_at is null or q.claimed_at<now()-interval '10 minutes')
    order by q.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,100),500))
  ) update public.ai_memory_sync_queue q set claimed_at=now(),attempts=q.attempts+1
  from picked where q.id=picked.id
  returning q.id,q.source_type,q.source_id;
end $$;
revoke execute on function public.ai_memory_worker_claim(integer) from public,anon,authenticated;
grant execute on function public.ai_memory_worker_claim(integer) to service_role;

create or replace function public.ai_memory_worker_complete(p_id bigint,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker access required.' using errcode='insufficient_privilege'; end if;
  update public.ai_memory_sync_queue set processed_at=case when p_error is null then now() else null end,
    claimed_at=null,last_error=left(p_error,1000) where id=p_id;
end $$;
revoke execute on function public.ai_memory_worker_complete(bigint,text) from public,anon,authenticated;
grant execute on function public.ai_memory_worker_complete(bigint,text) to service_role;

commit;
notify pgrst,'reload schema';

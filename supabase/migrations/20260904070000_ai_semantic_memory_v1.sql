-- ALLBEE AI semantic memory v1
-- Vector-ready, admin-scoped memory with PostgreSQL lexical retrieval as a safe
-- provider-independent fallback. Embeddings can be populated later without
-- changing the application contract.
begin;

create extension if not exists vector with schema extensions;

grant usage on schema extensions to authenticated;

create table if not exists public.ai_memory_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  title text not null default '',
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  content_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
  ) stored,
  unique(source_type, source_id)
);

create index if not exists ai_memory_documents_search_idx
  on public.ai_memory_documents using gin(search_document);
create index if not exists ai_memory_documents_active_idx
  on public.ai_memory_documents(active, updated_at desc);

alter table public.ai_memory_documents enable row level security;
revoke all on table public.ai_memory_documents from public, anon, authenticated;

-- Memory is never directly exposed to the client. All access goes through the
-- security-definer RPCs below, which enforce the same admin boundary as AI v1.
create or replace function public.ai_memory_sync_knowledge()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  changed integer := 0;
begin
  if not public.ai_can_read() then
    raise exception 'AI memory access denied.' using errcode='insufficient_privilege';
  end if;

  insert into public.ai_memory_documents
    (source_type, source_id, title, content, metadata, content_hash, active, updated_at)
  select
    coalesce(k.result_type,'knowledge'),
    coalesce(k.result_id,k.slug),
    coalesce(k.title,''),
    coalesce(k.body,''),
    jsonb_build_object('slug',k.slug,'source','knowledge_search_index'),
    encode(extensions.digest(coalesce(k.title,'') || E'\n' || coalesce(k.body,''),'sha256'),'hex'),
    true,
    now()
  from public.knowledge_search_index k
  on conflict (source_type, source_id) do update
    set title=excluded.title,
        content=excluded.content,
        metadata=excluded.metadata,
        content_hash=excluded.content_hash,
        active=true,
        updated_at=now()
    where public.ai_memory_documents.content_hash <> excluded.content_hash
       or public.ai_memory_documents.active=false;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.ai_memory_search(
  p_query text,
  p_limit integer default 8
)
returns table(
  id uuid,
  source_type text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  score real,
  retrieval_method text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  q text := trim(coalesce(p_query,''));
  n integer := greatest(1, least(coalesce(p_limit,8), 12));
begin
  if not public.ai_can_read() then
    raise exception 'AI memory access denied.' using errcode='insufficient_privilege';
  end if;
  if q = '' then return; end if;

  return query
  select d.id,d.source_type,d.source_id,d.title,d.content,d.metadata,
         ts_rank_cd(d.search_document, websearch_to_tsquery('simple', q))::real as score,
         'lexical'::text as retrieval_method,
         d.updated_at
  from public.ai_memory_documents d
  where d.active
    and d.search_document @@ websearch_to_tsquery('simple', q)
  order by ts_rank_cd(d.search_document, websearch_to_tsquery('simple', q)) desc,
           d.updated_at desc
  limit n;
end;
$$;

create or replace function public.ai_memory_vector_search(
  p_embedding extensions.vector(1536),
  p_limit integer default 8,
  p_match_threshold real default 0.65
)
returns table(
  id uuid,
  source_type text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  score real,
  retrieval_method text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare n integer := greatest(1, least(coalesce(p_limit,8), 12));
begin
  if not public.ai_can_read() then
    raise exception 'AI memory access denied.' using errcode='insufficient_privilege';
  end if;
  if p_embedding is null then return; end if;

  return query
  select d.id,d.source_type,d.source_id,d.title,d.content,d.metadata,
         (1 - (d.embedding <=> p_embedding))::real as score,
         'vector'::text as retrieval_method,
         d.updated_at
  from public.ai_memory_documents d
  where d.active
    and d.embedding is not null
    and (1 - (d.embedding <=> p_embedding)) >= greatest(0, least(coalesce(p_match_threshold,0.65),1))
  order by d.embedding <=> p_embedding
  limit n;
end;
$$;

-- Keep the write surface server-controlled and make RPCs the only route.
revoke all on function public.ai_memory_sync_knowledge() from public, anon, authenticated;
revoke all on function public.ai_memory_search(text, integer) from public, anon;
revoke all on function public.ai_memory_vector_search(extensions.vector(1536), integer, real) from public, anon;
grant execute on function public.ai_memory_search(text, integer) to authenticated;
grant execute on function public.ai_memory_vector_search(extensions.vector(1536), integer, real) to authenticated;
grant execute on function public.ai_memory_sync_knowledge() to authenticated;

-- Seed the current knowledge catalog once. Future admin refreshes use the same RPC.
insert into public.ai_memory_documents
  (source_type, source_id, title, content, metadata, content_hash, active, updated_at)
select
  coalesce(k.result_type,'knowledge'), coalesce(k.result_id,k.slug), coalesce(k.title,''), coalesce(k.body,''),
  jsonb_build_object('slug',k.slug,'source','knowledge_search_index'),
  encode(extensions.digest(coalesce(k.title,'') || E'\n' || coalesce(k.body,''),'sha256'),'hex'), true, now()
from public.knowledge_search_index k
on conflict (source_type, source_id) do update
  set title=excluded.title, content=excluded.content, metadata=excluded.metadata,
      content_hash=excluded.content_hash, active=true, updated_at=now()
  where public.ai_memory_documents.content_hash <> excluded.content_hash
     or public.ai_memory_documents.active=false;

commit;

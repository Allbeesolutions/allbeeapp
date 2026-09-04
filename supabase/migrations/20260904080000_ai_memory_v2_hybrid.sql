-- ALLBEE AI semantic memory v2: hybrid retrieval infrastructure.
-- Lexical search remains the provider-independent fallback; vector ranking is
-- used whenever embeddings have been populated by a configured provider.
begin;

create index if not exists ai_memory_documents_embedding_hnsw_idx
  on public.ai_memory_documents using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null and active;

create or replace function public.ai_memory_hybrid_search(
  p_query text,
  p_embedding extensions.vector(1536) default null,
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
  if q = '' and p_embedding is null then return; end if;

  return query
  with lexical as (
    select d.id, ts_rank_cd(d.search_document, websearch_to_tsquery('simple', q))::real as score
    from public.ai_memory_documents d
    where d.active and q <> ''
      and d.search_document @@ websearch_to_tsquery('simple', q)
    order by 2 desc limit greatest(n * 3, 12)
  ),
  vector_hits as (
    select d.id, (1 - (d.embedding <=> p_embedding))::real as score
    from public.ai_memory_documents d
    where d.active and p_embedding is not null and d.embedding is not null
    order by d.embedding <=> p_embedding limit greatest(n * 3, 12)
  ),
  combined as (
    select id, score, 'lexical'::text method from lexical
    union all
    select id, score, 'vector'::text method from vector_hits
  ),
  ranked as (
    select id,
      max(score) filter (where method='vector') as vector_score,
      max(score) filter (where method='lexical') as lexical_score,
      bool_or(method='vector') and bool_or(method='lexical') as hybrid_hit
    from combined group by id
  )
  select d.id,d.source_type,d.source_id,d.title,d.content,d.metadata,
    (coalesce(r.vector_score,0) * 0.65 + coalesce(r.lexical_score,0) * 0.35)::real as score,
    case when r.hybrid_hit then 'hybrid' when r.vector_score is not null then 'vector' else 'lexical' end,
    d.updated_at
  from ranked r join public.ai_memory_documents d on d.id=r.id
  order by score desc,d.updated_at desc limit n;
end;
$$;

revoke all on function public.ai_memory_hybrid_search(text, extensions.vector(1536), integer) from public, anon;
grant execute on function public.ai_memory_hybrid_search(text, extensions.vector(1536), integer) to authenticated;

-- Observability indexes: keep admin error review cheap as the event table grows.
create index if not exists app_error_events_created_idx on public.app_error_events(created_at desc);
create index if not exists app_error_events_path_idx on public.app_error_events(path, created_at desc);

commit;

begin;
create extension if not exists pg_trgm;

alter table public.global_search_history add column if not exists result_count integer not null default 0;
alter table public.global_search_history add column if not exists selected_result text;
create index if not exists global_search_history_query_trgm_idx on public.global_search_history using gin(query gin_trgm_ops);
create index if not exists global_search_saved_query_trgm_idx on public.global_search_saved using gin(query gin_trgm_ops);

create or replace function public.global_search_record(p_query text,p_result_count integer default 0,p_selected_result text default null,p_filters jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
 insert into public.global_search_history(user_id,query,filters,result_count,selected_result)
 values(auth.uid(),left(trim(p_query),500),coalesce(p_filters,'{}'),greatest(0,p_result_count),left(p_selected_result,500)) returning id into v_id;
 return v_id;
end $$;
revoke execute on function public.global_search_record(text,integer,text,jsonb) from public,anon; grant execute on function public.global_search_record(text,integer,text,jsonb) to authenticated;

create or replace function public.global_search_suggestions(p_query text,p_limit integer default 8)
returns jsonb language sql security definer stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc,x.used_at desc),'[]'::jsonb) from (
   select h.query,max(h.used_at) used_at,greatest(similarity(h.query,trim(p_query)),case when h.query ilike trim(p_query)||'%' then 1 else 0 end) score
   from public.global_search_history h where h.user_id=auth.uid() and trim(p_query)<>'' and h.query ilike '%'||trim(p_query)||'%' group by h.query
   order by score desc,max(h.used_at) desc limit greatest(1,least(p_limit,20))
 ) x $$;
revoke execute on function public.global_search_suggestions(text,integer) from public,anon; grant execute on function public.global_search_suggestions(text,integer) to authenticated;

create or replace function public.global_search_admin_stats()
returns jsonb language sql security definer stable set search_path=public as $$
 select jsonb_build_object('history',count(*),'saved',(select count(*) from public.global_search_saved),'analytics',(select count(*) from public.global_search_analytics)) from public.global_search_history where public.is_admin() $$;
revoke execute on function public.global_search_admin_stats() from public,anon; grant execute on function public.global_search_admin_stats() to authenticated;
commit;
notify pgrst,'reload schema';

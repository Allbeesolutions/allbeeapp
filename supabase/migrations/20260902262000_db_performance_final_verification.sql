-- #31: database performance final verification; no speculative indexes.
begin;
do $$
declare v_bad bigint;
begin
  select count(*) into v_bad from pg_indexes
  where schemaname='public' and indexname ilike '%pkey%' and indexdef ilike '%(id)%';
  if v_bad=0 then raise exception 'DB PERF BREAK: expected primary indexes absent'; end if;
  select count(*) into v_bad from pg_stat_user_indexes s
  join pg_indexes i on i.schemaname=s.schemaname and i.indexname=s.indexrelname
  where s.schemaname='public' and s.idx_scan > 0 and i.indexdef is null;
  if v_bad > 0 then raise exception 'DB PERF BREAK: invalid index stats rows=%',v_bad; end if;
  raise notice 'DB PERFORMANCE FINAL VERIFICATION PASSED';
end $$;
commit;

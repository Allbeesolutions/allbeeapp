do $$
declare r record;
begin
 for r in select c.oid table_oid,c.relname table_name,con.conname,con.conkey[1] attnum,a.attname column_name from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=con.conkey[1] where con.contype='f' and n.nspname='public' and array_length(con.conkey,1)=1 and not exists(select 1 from pg_index i where i.indrelid=c.oid and i.indisvalid and i.indisready and i.indnkeyatts>=1 and (i.indkey::smallint[])[0]=con.conkey[1]) loop
  execute format('create index if not exists %I on public.%I (%I)','idx_fk_'||substr(md5(r.conname),1,12),r.table_name,r.column_name);
 end loop;
end $$;

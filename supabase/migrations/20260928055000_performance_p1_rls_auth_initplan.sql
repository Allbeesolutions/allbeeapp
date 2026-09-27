do $$
declare r record; q text; w text;
begin
 for r in select schemaname,tablename,policyname,qual,with_check from pg_policies where schemaname='public' and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%' or coalesce(qual,'') like '%auth.jwt()%' or coalesce(with_check,'') like '%auth.jwt()%' or coalesce(qual,'') like '%auth.role()%' or coalesce(with_check,'') like '%auth.role()%') loop
  q:=r.qual; w:=r.with_check;
  if q is not null then q:=replace(replace(replace(q,'auth.uid()','(select auth.uid())'),'auth.jwt()','(select auth.jwt())'),'auth.role()','(select auth.role())'); execute format('alter policy %I on %I.%I using (%s)',r.policyname,r.schemaname,r.tablename,q); end if;
  if w is not null then w:=replace(replace(replace(w,'auth.uid()','(select auth.uid())'),'auth.jwt()','(select auth.jwt())'),'auth.role()','(select auth.role())'); execute format('alter policy %I on %I.%I with check (%s)',r.policyname,r.schemaname,r.tablename,w); end if;
 end loop;
end $$;

begin;

-- Audit is append-only. The browser may request an event, but it cannot choose
-- the authoritative actor identity, timestamp, or privileged actor metadata.
create or replace function public.audit_record(p_data jsonb)
returns text language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_id text; v_data jsonb; v_actor text;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Audit event must be an object.' using errcode='invalid_parameter_value'; end if;
  v_id:=coalesce(nullif(p_data->>'id',''),gen_random_uuid()::text);
  v_actor:=auth.uid()::text;
  v_data:=coalesce(p_data,'{}'::jsonb)
    || jsonb_build_object('id',v_id,'actorId',v_actor,'userId',v_actor,'ts',(extract(epoch from clock_timestamp())*1000)::bigint);
  insert into public.audit(id,data,updated_at) values(v_id,v_data,clock_timestamp())
    on conflict(id) do nothing;
  return v_id;
end $$;

revoke all on function public.audit_record(jsonb) from public,anon;
grant execute on function public.audit_record(jsonb) to authenticated;

revoke insert,update,delete on public.audit from authenticated,anon,public;
drop policy if exists audit_insert on public.audit;
drop policy if exists audit_update on public.audit;
drop policy if exists audit_delete on public.audit;
create policy audit_no_direct_insert on public.audit for insert to authenticated with check (false);
create policy audit_no_update on public.audit for update to authenticated using (false) with check (false);
create policy audit_no_delete on public.audit for delete to authenticated using (false);

commit;
notify pgrst,'reload schema';

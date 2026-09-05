begin;

-- Server-side global search. The function is SECURITY INVOKER so every source
-- remains subject to the caller's existing grants and RLS policies.
create or replace function public.global_search_v6(
  p_query text,
  p_module text default 'All',
  p_route text default 'All',
  p_date_from date default null,
  p_date_to date default null,
  p_limit integer default 80
) returns jsonb
language plpgsql security invoker stable set search_path=pg_catalog,public,pg_temp as $$
declare src record; row_data jsonb; row_id text; row_updated timestamptz; out_rows jsonb:='[]'::jsonb; pat text:=trim(coalesce(p_query,''));
  title text; sub text; who text; module text; route text; date_iso text;
  sources jsonb:=jsonb_build_array(
    jsonb_build_object('table','projects','module','Projects','route','projects'),jsonb_build_object('table','inhouse','module','In-house projects','route','inhouse'),
    jsonb_build_object('table','leads','module','Leads','route','leads'),jsonb_build_object('table','clients','module','Clients','route','clients'),
    jsonb_build_object('table','quotations','module','Quotations','route','quotations'),jsonb_build_object('table','invoices','module','Invoices','route','invoices'),
    jsonb_build_object('table','tasks','module','Tasks','route','tasks'),jsonb_build_object('table','updates','module','Daily updates','route','updates'),
    jsonb_build_object('table','concepts','module','Concepts','route','concepts'),jsonb_build_object('table','knowledge','module','Knowledge base','route','knowledge'),
    jsonb_build_object('table','documents','module','Documents','route','documents'),jsonb_build_object('table','testing','module','Testing','route','testing'),
    jsonb_build_object('table','announcements','module','Announcements','route','announcements'),jsonb_build_object('table','chat','module','Team chat','route','chat'),
    jsonb_build_object('table','transactions','module','Accounts','route','accounts'),jsonb_build_object('table','withdrawals','module','Withdrawals','route','withdrawals'),
    jsonb_build_object('table','planned','module','Planned expenses','route','planned'),jsonb_build_object('table','rewards','module','Rewards','route','rewards'),
    jsonb_build_object('table','sheets','module','Sheets','route','sheets'),jsonb_build_object('table','prompts','module','Prompts','route','prompts'),
    jsonb_build_object('table','vault','module','Passwords','route','vault'),jsonb_build_object('table','students','module','Courses','route','courses'),
    jsonb_build_object('table','marketing','module','Marketing','route','marketing'),jsonb_build_object('table','portal_posts','module','Client updates','route','portal-posts'),
    jsonb_build_object('table','notifications','module','Notifications','route','notifications')
  );
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
  if pat='' then return '[]'::jsonb; end if;
  for src in select * from jsonb_to_recordset(sources) as x(table_name text,module_name text,route_name text) loop
    if p_module<>'All' and p_module<>src.module_name then continue; end if;
    if p_route<>'All' and p_route<>src.route_name then continue; end if;
    for row_id,row_data,row_updated in execute format(
      'select id,data,updated_at from public.%I where data::text ilike $1 and ($2 is null or updated_at::date >= $2) and ($3 is null or updated_at::date <= $3) order by updated_at desc limit 100',src.table_name
    ) using '%'||pat||'%',p_date_from,p_date_to loop
      -- App-level audience filters are repeated here because notifications are
      -- intentionally readable by internal users at the row-RLS layer.
      if src.table_name='notifications' and not public.is_admin() and not (
        coalesce(row_data->>'audience','all')='all' or
        coalesce(row_data->>'audience','')=coalesce((select role from public.profiles where id=auth.uid()),'') or
        coalesce(row_data->>'audience','')=('user:'||auth.uid()::text)
      ) then continue; end if;
      if src.table_name='documents' and not public.is_admin() and not (
        row_data->>'audience'='internal' or (row_data->>'audience'='members' and coalesce(row_data->'userIds','[]'::jsonb) ? auth.uid()::text) or row_data->>'ownerId'=auth.uid()::text
      ) then continue; end if;
      if src.table_name='testing' and not public.is_admin() and not (row_data->>'assignedToId'=auth.uid()::text or row_data->>'assignedTo'=public.current_name()) then continue; end if;
      title:=coalesce(nullif(row_data->>'name',''),nullif(row_data->>'title',''),nullif(row_data->>'client',''),nullif(row_data->>'project',''),nullif(row_data->>'number',''),nullif(row_data->>'service',''),'Record');
      sub:=coalesce(nullif(row_data->>'status',''),nullif(row_data->>'stage',''),nullif(row_data->>'category',''),nullif(row_data->>'plan',''),'');
      who:=coalesce(nullif(row_data->>'userName',''),nullif(row_data->>'ownerName',''),nullif(row_data->>'owner',''),nullif(row_data->>'user',''),nullif(row_data->>'email',''),'');
      module:=src.module_name; route:=src.route_name; date_iso:=coalesce(row_updated::date::text,'');
      out_rows:=out_rows||jsonb_build_array(jsonb_build_object('id',src.table_name||':'||row_id,'module',module,'route',route,'title',title,'sub',sub,'user',who,'dateISO',date_iso,'path',module||' > '||title,'text',lower(coalesce(row_data::text,''))));
    end loop;
  end loop;

  if p_route='All' or p_route='leads' then
    for row_id,title,sub,who,row_updated in
      select l.id::text,coalesce(l.customer_name,l.lead_number),l.status,coalesce(l.email,l.mobile),l.updated_at
      from public.crm_leads l
      where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state)
        and (l.customer_name||' '||coalesce(l.lead_number,'')||' '||coalesce(l.company,'')||' '||coalesce(l.email,'')||' '||coalesce(l.mobile,'')) ilike '%'||pat||'%'
        and (p_date_from is null or l.updated_at::date>=p_date_from) and (p_date_to is null or l.updated_at::date<=p_date_to)
      order by l.updated_at desc limit 100 loop
      out_rows:=out_rows||jsonb_build_array(jsonb_build_object('id','crm_leads:'||row_id,'module','CRM leads','route','leads','title',title,'sub',sub,'user',who,'dateISO',row_updated::date::text,'path','CRM leads > '||title,'text',lower(title||' '||coalesce(sub,'')||' '||coalesce(who,''))));
    end loop;
  end if;
  return (select coalesce(jsonb_agg(q.x order by (q.x->>'dateISO') desc),'[]'::jsonb) from (select x from jsonb_array_elements(out_rows) x order by (x->>'dateISO') desc limit greatest(1,least(coalesce(p_limit,80),200))) q);
end $$;

revoke execute on function public.global_search_v6(text,text,text,date,date,integer) from public,anon;
grant execute on function public.global_search_v6(text,text,text,date,date,integer) to authenticated;

commit;
notify pgrst,'reload schema';

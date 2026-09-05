begin;

create or replace function public.global_search_v6(
  p_query text,p_module text default 'All',p_route text default 'All',p_date_from date default null,p_date_to date default null,p_limit integer default 80
) returns jsonb language plpgsql security invoker stable set search_path=pg_catalog,public,pg_temp as $$
declare src record; row_data jsonb; row_id text; row_updated timestamptz; out_rows jsonb:='[]'::jsonb; pat text:=trim(coalesce(p_query,'')); title text; sub text; who text; module text; route text; date_iso text;
 sources jsonb:=jsonb_build_array(
  jsonb_build_object('table_name','projects','module_name','Projects','route_name','projects'),jsonb_build_object('table_name','inhouse','module_name','In-house projects','route_name','inhouse'),jsonb_build_object('table_name','leads','module_name','Leads','route_name','leads'),jsonb_build_object('table_name','clients','module_name','Clients','route_name','clients'),
  jsonb_build_object('table_name','quotations','module_name','Quotations','route_name','quotations'),jsonb_build_object('table_name','invoices','module_name','Invoices','route_name','invoices'),jsonb_build_object('table_name','tasks','module_name','Tasks','route_name','tasks'),jsonb_build_object('table_name','updates','module_name','Daily updates','route_name','updates'),
  jsonb_build_object('table_name','concepts','module_name','Concepts','route_name','concepts'),jsonb_build_object('table_name','knowledge','module_name','Knowledge base','route_name','knowledge'),jsonb_build_object('table_name','documents','module_name','Documents','route_name','documents'),jsonb_build_object('table_name','testing','module_name','Testing','route_name','testing'),
  jsonb_build_object('table_name','announcements','module_name','Announcements','route_name','announcements'),jsonb_build_object('table_name','chat','module_name','Team chat','route_name','chat'),jsonb_build_object('table_name','transactions','module_name','Accounts','route_name','accounts'),jsonb_build_object('table_name','withdrawals','module_name','Withdrawals','route_name','withdrawals'),
  jsonb_build_object('table_name','planned','module_name','Planned expenses','route_name','planned'),jsonb_build_object('table_name','rewards','module_name','Rewards','route_name','rewards'),jsonb_build_object('table_name','sheets','module_name','Sheets','route_name','sheets'),jsonb_build_object('table_name','prompts','module_name','Prompts','route_name','prompts'),
  jsonb_build_object('table_name','vault','module_name','Passwords','route_name','vault'),jsonb_build_object('table_name','students','module_name','Courses','route_name','courses'),jsonb_build_object('table_name','marketing','module_name','Marketing','route_name','marketing'),jsonb_build_object('table_name','portal_posts','module_name','Client updates','route_name','portal-posts'),jsonb_build_object('table_name','notifications','module_name','Notifications','route_name','notifications')
 );
begin
 if auth.uid() is null then raise exception 'Authentication required.' using errcode='invalid_authorization_specification'; end if;
 if pat='' then return '[]'::jsonb; end if;
 for src in select * from jsonb_to_recordset(sources) as x(table_name text,module_name text,route_name text) loop
  if p_module<>'All' and p_module<>src.module_name then continue; end if;
  if p_route<>'All' and p_route<>src.route_name then continue; end if;
  if to_regclass('public.'||src.table_name) is null then continue; end if;
  for row_id,row_data,row_updated in execute format('select id,data,updated_at from public.%I where data::text ilike $1 and ($2 is null or updated_at::date >= $2) and ($3 is null or updated_at::date <= $3) order by updated_at desc limit 100',src.table_name) using '%'||pat||'%',p_date_from,p_date_to loop
   if src.table_name='notifications' and not public.is_admin() and not (coalesce(row_data->>'audience','all')='all' or coalesce(row_data->>'audience','')=coalesce((select role from public.profiles where id=auth.uid()),'') or coalesce(row_data->>'audience','')=('user:'||auth.uid()::text)) then continue; end if;
   if src.table_name='documents' and not public.is_admin() and not (row_data->>'audience'='internal' or (row_data->>'audience'='members' and coalesce(row_data->'userIds','[]'::jsonb) ? auth.uid()::text) or row_data->>'ownerId'=auth.uid()::text) then continue; end if;
   if src.table_name='testing' and not public.is_admin() and not (row_data->>'assignedToId'=auth.uid()::text or row_data->>'assignedTo'=public.current_name()) then continue; end if;
   title:=coalesce(nullif(row_data->>'name',''),nullif(row_data->>'title',''),nullif(row_data->>'client',''),nullif(row_data->>'project',''),nullif(row_data->>'number',''),nullif(row_data->>'service',''),'Record');
   sub:=coalesce(nullif(row_data->>'status',''),nullif(row_data->>'stage',''),nullif(row_data->>'category',''),nullif(row_data->>'plan',''),'');
   who:=coalesce(nullif(row_data->>'userName',''),nullif(row_data->>'ownerName',''),nullif(row_data->>'owner',''),nullif(row_data->>'user',''),nullif(row_data->>'email',''),'');
   module:=src.module_name; route:=src.route_name; date_iso:=coalesce(row_updated::date::text,'');
   out_rows:=out_rows||jsonb_build_array(jsonb_build_object('id',src.table_name||':'||row_id,'module',module,'route',route,'title',title,'sub',sub,'user',who,'dateISO',date_iso,'path',module||' > '||title,'text',lower(coalesce(row_data::text,''))));
  end loop;
 end loop;
 if p_route='All' or p_route='leads' then
  for row_id,title,sub,who,row_updated in select l.id::text,coalesce(l.customer_name,l.lead_number),l.status,coalesce(l.email,l.mobile),l.updated_at from public.crm_leads l where public.crm_can_read(l.assigned_employee_id,l.assigned_partner_id,l.district,l.state) and (l.customer_name||' '||coalesce(l.lead_number,'')||' '||coalesce(l.company,'')||' '||coalesce(l.email,'')||' '||coalesce(l.mobile,'')) ilike '%'||pat||'%' and (p_date_from is null or l.updated_at::date>=p_date_from) and (p_date_to is null or l.updated_at::date<=p_date_to) order by l.updated_at desc limit 100 loop
   out_rows:=out_rows||jsonb_build_array(jsonb_build_object('id','crm_leads:'||row_id,'module','CRM leads','route','leads','title',title,'sub',sub,'user',who,'dateISO',row_updated::date::text,'path','CRM leads > '||title,'text',lower(title||' '||coalesce(sub,'')||' '||coalesce(who,''))));
  end loop;
 end if;
 return (select coalesce(jsonb_agg(q.x order by (q.x->>'dateISO') desc),'[]'::jsonb) from (select x from jsonb_array_elements(out_rows) x order by (x->>'dateISO') desc limit greatest(1,least(coalesce(p_limit,80),200))) q);
end $$;

commit;
notify pgrst,'reload schema';

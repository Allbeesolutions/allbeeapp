begin;

-- PR-APN-Quotation-Dynamic-Catalog
-- Extends the knowledge catalog so that:
--   1. package_features are populated for all APN-quotable packages.
--   2. delivery_timelines exist per service/package.
--   3. package_limits (page count, revisions, support period) are recorded.
--   4. knowledge_get_pricing() returns features, delivery, payment_terms, limits
--      so the APN wizard and PDF can source ALL commercial content from the DB.
--
-- Idempotent: safe to run multiple times.

-- 1. Add package_id column to delivery_timelines (per-package delivery)
alter table public.delivery_timelines
  add column if not exists package_id uuid references public.service_packages(id) on delete cascade;

create index if not exists delivery_timelines_package_idx
  on public.delivery_timelines(package_id, active);

-- 2. Add support/hosting/domain/ssl columns to service_packages
alter table public.service_packages
  add column if not exists support_period_days integer not null default 0;
alter table public.service_packages
  add column if not exists hosting_included boolean not null default false;
alter table public.service_packages
  add column if not exists domain_included  boolean not null default false;
alter table public.service_packages
  add column if not exists ssl_included     boolean not null default true;

-- Update website-starter with correct flags
update public.service_packages
  set support_period_days = 15, hosting_included = true, domain_included = true, ssl_included = true
  where slug = 'website-starter';

-- 3. Seed package_features for website-starter
do $$
declare p uuid;
begin
  select id into p from public.service_packages where slug = 'website-starter';
  if p is null then return; end if;
  insert into public.package_features(package_id, slug, name, description, included, sort_order, active)
  values
    (p, 'pages-5',         'Up to 5 website pages',                    'Five fully responsive website pages.',   true,  10, true),
    (p, 'responsive',      'Responsive design (Mobile/Tablet/Desktop)', 'Adapts to all screen sizes.',            true,  20, true),
    (p, 'basic-seo',       'Basic SEO-friendly structure',              'Meta tags, sitemap and canonical URLs.', true,  30, true),
    (p, 'contact-form',    'Contact / enquiry submission form',         'Lead capture form with email delivery.', true,  40, true),
    (p, 'ssl-https',       'SSL Certificate / HTTPS setup',             'Free SSL certificate installed.',        true,  50, true),
    (p, 'deployment',      'Website deployment',                        'Deployed to production hosting.',        true,  60, true),
    (p, 'post-support-15', 'Support for 15 days (post delivery)',       'Bug fixes and minor edits for 15 days.',true,  70, true),
    (p, 'domain-reg',      'Domain registration (1 year)',              'Approx. subject to availability.',       true,  80, true)
  on conflict(package_id, slug)
    do update set name        = excluded.name,
                  description = excluded.description,
                  included    = excluded.included,
                  sort_order  = excluded.sort_order,
                  active      = excluded.active;
end $$;

-- 4. Seed package_limits for website-starter
do $$
declare p uuid;
begin
  select id into p from public.service_packages where slug = 'website-starter';
  if p is null then return; end if;
  insert into public.package_limits(package_id, name, limit_value, unit, active)
  values
    (p, 'Pages',           '5',  'pages', true),
    (p, 'Revisions',       '2',  'rounds', true),
    (p, 'Support period',  '15', 'days',  true)
  on conflict(package_id, name)
    do update set limit_value = excluded.limit_value, unit = excluded.unit, active = excluded.active;
end $$;

-- 5. Seed delivery_timelines
do $$
declare s uuid; p uuid;
begin
  select id into s from public.services where slug = 'website';
  select id into p from public.service_packages where slug = 'website-starter';
  if s is not null then
    insert into public.delivery_timelines(service_id, package_id, name, min_days, max_days, priority, active)
    values (s, p, 'Standard delivery', 10, 15, 'standard', true)
    on conflict do nothing;
  end if;
  select id into s from public.services where slug = 'digital-marketing';
  if s is not null then
    insert into public.delivery_timelines(service_id, package_id, name, min_days, max_days, priority, active)
    values (s, null, 'Ongoing retainer', 0, 0, 'standard', true)
    on conflict do nothing;
  end if;
  select id into s from public.services where slug = 'training';
  if s is not null then
    insert into public.delivery_timelines(service_id, package_id, name, min_days, max_days, priority, active)
    values (s, null, 'Standard enrollment', 1, 5, 'standard', true)
    on conflict do nothing;
  end if;
end $$;

-- 6. Add domain/hosting/SSL line-item pricing rows to website-starter
do $$
declare p uuid;
begin
  select id into p from public.service_packages where slug = 'website-starter';
  if p is null then return; end if;
  insert into public.package_pricing(package_id, label, billing_model, amount, currency, visible, active, is_base)
  values
    (p, 'Domain Registration (1 Year)', 'custom_quote', null, 'INR', true, true, false),
    (p, 'Web Hosting (1 Year)',         'per_year',     null, 'INR', true, true, false),
    (p, 'SSL Certificate & Security',   'fixed',        0,    'INR', true, true, false)
  on conflict(package_id, label) do update
    set billing_model = excluded.billing_model,
        amount        = excluded.amount,
        active        = true,
        visible       = true,
        updated_at    = now();
end $$;

-- 7. Extend knowledge_get_pricing() to return features, delivery, limits, payment_terms
create or replace function public.knowledge_get_pricing(p_service text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  sid       uuid;
  pkg       record;
  base      record;
  opts      jsonb;
  feats     jsonb;
  lims      jsonb;
  deliv     record;
  pterm     record;
  line_items jsonb;
begin
  sid := public.knowledge_resolve_service(p_service);
  if sid is null then
    return jsonb_build_object(
      'service',p_service,'base',null,'baseLabel','Custom quotation',
      'options','[]'::jsonb,'features','[]'::jsonb,'limits','[]'::jsonb,'lineItems','[]'::jsonb,
      'model','custom_quote','visible',false,'customQuote',true,
      'disclaimer','Pricing is confirmed after scope review.',
      'deliveryMin',null,'deliveryMax',null,'deliveryNote',null,
      'paymentTerms',null,'packageName',null,'packageSlug',null,
      'packageDesc',null,'hostingIncluded',false,'domainIncluded',false,'sslIncluded',true,'supportDays',0);
  end if;

  select p.* into pkg from public.service_packages p
    where p.service_id = sid and p.active and p.archived_at is null
    order by p.sort_order limit 1;

  if pkg.id is null then
    return jsonb_build_object(
      'service',(select slug from public.services where id=sid),'base',null,'baseLabel','Custom quotation',
      'options','[]'::jsonb,'features','[]'::jsonb,'limits','[]'::jsonb,'lineItems','[]'::jsonb,
      'model','custom_quote','visible',false,'customQuote',true,
      'disclaimer','Pricing is confirmed after scope review.',
      'deliveryMin',null,'deliveryMax',null,'deliveryNote',null,
      'paymentTerms',null,'packageName',null,'packageSlug',null,
      'packageDesc',null,'hostingIncluded',false,'domainIncluded',false,'sslIncluded',true,'supportDays',0);
  end if;

  select pp.* into base from public.package_pricing pp
    where pp.package_id=pkg.id and pp.active and pp.visible and pp.is_base=true
      and (pp.effective_to is null or pp.effective_to>now())
    order by pp.effective_from desc limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object('key',a.slug,'label',a.name,'amount',coalesce(ap.amount,0),'model',coalesce(ap.billing_model,'custom_quote'))
    order by a.sort_order,a.name),'[]'::jsonb) into opts
  from public.package_addons a
  left join lateral (
    select pp.amount,pp.billing_model from public.package_pricing pp
      where pp.package_id=pkg.id and pp.active and pp.visible and lower(pp.label)=lower(a.name)
      order by pp.effective_from desc limit 1) ap on true
  where a.package_id=pkg.id and a.active;

  select coalesce(jsonb_agg(
    jsonb_build_object('slug',f.slug,'name',f.name,'description',f.description,'included',f.included)
    order by f.sort_order,f.name),'[]'::jsonb) into feats
  from public.package_features f where f.package_id=pkg.id and f.active and f.included=true;

  select coalesce(jsonb_agg(
    jsonb_build_object('name',l.name,'value',l.limit_value,'unit',l.unit) order by l.name),'[]'::jsonb) into lims
  from public.package_limits l where l.package_id=pkg.id and l.active;

  select dt.* into deliv from public.delivery_timelines dt
    where dt.active and (dt.package_id=pkg.id or (dt.package_id is null and dt.service_id=sid))
    order by (dt.package_id=pkg.id) desc, dt.min_days asc limit 1;

  select pt.* into pterm from public.payment_terms pt
    where pt.active order by pt.advance_percent desc, pt.created_at asc limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object('label',pp.label,'billingModel',pp.billing_model,'amount',pp.amount,'currency',pp.currency,'isBase',pp.is_base,'visible',pp.visible)
    order by pp.is_base desc,pp.label),'[]'::jsonb) into line_items
  from public.package_pricing pp
    where pp.package_id=pkg.id and pp.active and pp.visible
      and (pp.effective_to is null or pp.effective_to>now());

  return jsonb_build_object(
    'service',(select slug from public.services where id=sid),
    'package',pkg.name,'packageSlug',pkg.slug,'packageDesc',pkg.description,
    'base',base.amount,'baseLabel',coalesce(base.label,pkg.name),
    'options',opts,'model',coalesce(base.billing_model,'custom_quote'),
    'visible',coalesce(base.visible,false),'customQuote',pkg.custom_quote or base.amount is null,
    'currency',coalesce(base.currency,'INR'),
    'disclaimer','Official starting price; final quotation is subject to confirmed scope.',
    'features',coalesce(feats,'[]'::jsonb),
    'limits',coalesce(lims,'[]'::jsonb),
    'lineItems',coalesce(line_items,'[]'::jsonb),
    'deliveryMin',deliv.min_days,'deliveryMax',deliv.max_days,'deliveryNote',deliv.name,
    'paymentTerms',case when pterm.id is not null then
      jsonb_build_object('name',pterm.name,'advancePercent',pterm.advance_percent,'milestones',pterm.milestones,'description',pterm.description)
    else null end,
    'hostingIncluded',coalesce(pkg.hosting_included,false),
    'domainIncluded',coalesce(pkg.domain_included,false),
    'sslIncluded',coalesce(pkg.ssl_included,true),
    'supportDays',coalesce(pkg.support_period_days,0)
  );
end $$;

-- 8. Extend knowledge_admin_list to support 'features' and 'delivery'
create or replace function public.knowledge_admin_list(
  p_entity text, p_search text default '', p_page integer default 1, p_page_size integer default 25
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  items jsonb; total integer;
  off integer := greatest(0,(coalesce(p_page,1)-1)*greatest(1,least(coalesce(p_page_size,25),100)));
  lim integer := greatest(1,least(coalesce(p_page_size,25),100));
  q text := '%'||lower(coalesce(p_search,''))||'%';
begin
  if not public.is_admin() then raise exception 'Knowledge Center access denied.' using errcode='insufficient_privilege'; end if;
  if p_entity='services' then
    select count(*)::int into total from public.services s where lower(s.name||' '||s.slug||' '||s.description) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select s.id,s.slug,s.name,s.description,s.active,s.custom_quote,c.slug category_slug from public.services s left join public.service_categories c on c.id=s.category_id where lower(s.name||' '||s.slug||' '||s.description) like q order by s.sort_order,s.name offset off limit lim) x;
  elsif p_entity='packages' then
    select count(*)::int into total from public.service_packages p where lower(p.name||' '||p.slug||' '||p.description) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select p.id,p.slug,p.name,p.description,p.active,p.custom_quote,p.hosting_included,p.domain_included,p.ssl_included,p.support_period_days,s.slug service_slug,s.name service_name from public.service_packages p join public.services s on s.id=p.service_id where lower(p.name||' '||p.slug||' '||p.description) like q order by s.name,p.sort_order,p.name offset off limit lim) x;
  elsif p_entity='pricing' then
    select count(*)::int into total from public.package_pricing pp join public.service_packages sp on sp.id=pp.package_id join public.services s on s.id=sp.service_id where lower(pp.label||' '||pp.billing_model||' '||sp.name||' '||s.name) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select pp.id,pp.label,pp.billing_model,pp.amount,pp.currency,pp.visible,pp.active,pp.is_base,sp.slug package_slug,sp.name package_name,s.slug service_slug,s.name service_name from public.package_pricing pp join public.service_packages sp on sp.id=pp.package_id join public.services s on s.id=sp.service_id where lower(pp.label||' '||pp.billing_model||' '||sp.name||' '||s.name) like q order by s.name,sp.name,pp.is_base desc,pp.label offset off limit lim) x;
  elsif p_entity='features' then
    select count(*)::int into total from public.package_features f join public.service_packages sp on sp.id=f.package_id where lower(f.name||' '||f.slug||' '||sp.name) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select f.id,f.slug,f.name,f.description,f.included,f.sort_order,f.active,sp.slug package_slug,sp.name package_name,s.slug service_slug from public.package_features f join public.service_packages sp on sp.id=f.package_id join public.services s on s.id=sp.service_id where lower(f.name||' '||f.slug||' '||sp.name) like q order by s.name,sp.name,f.sort_order,f.name offset off limit lim) x;
  elsif p_entity='delivery' then
    select count(*)::int into total from public.delivery_timelines dt join public.services s on s.id=dt.service_id where lower(dt.name||' '||s.name) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select dt.id,dt.name,dt.min_days,dt.max_days,dt.priority,dt.rush_charge,dt.active,s.slug service_slug,s.name service_name,sp.slug package_slug,sp.name package_name from public.delivery_timelines dt join public.services s on s.id=dt.service_id left join public.service_packages sp on sp.id=dt.package_id where lower(dt.name||' '||s.name) like q order by s.name,dt.min_days offset off limit lim) x;
  elsif p_entity='hosting' then
    select count(*)::int into total from public.hosting_plans where lower(name||' '||slug||' '||description) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.hosting_plans where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='maintenance' then
    select count(*)::int into total from public.maintenance_plans where lower(name||' '||slug||' '||description) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.maintenance_plans where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='faq' then
    select count(*)::int into total from public.faq where lower(question||' '||answer||' '||slug) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,question,answer,published,active from public.faq where lower(question||' '||answer||' '||slug) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='policies' then
    select count(*)::int into total from public.company_policies where lower(name||' '||body||' '||slug) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,name,body,version,published,active from public.company_policies where lower(name||' '||body||' '||slug) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='discounts' then
    select count(*)::int into total from public.discount_rules where lower(name||' '||slug||' '||coalesce(code,'')) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.discount_rules where lower(name||' '||slug||' '||coalesce(code,'')) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='integrations' then
    select count(*)::int into total from public.supported_integrations where lower(name||' '||slug||' '||description) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.supported_integrations where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='knowledge' then
    select count(*)::int into total from public.knowledge_articles where lower(title||' '||slug||' '||body) like q;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,title,body,category,published,active from public.knowledge_articles where lower(title||' '||slug||' '||body) like q order by updated_at desc offset off limit lim) x;
  else raise exception 'Unknown knowledge entity.' using errcode='invalid_parameter_value'; end if;
  return jsonb_build_object('items',coalesce(items,'[]'::jsonb),'total',coalesce(total,0),'page',coalesce(p_page,1),'page_size',lim);
end $$;

-- 9. Extend knowledge_admin_save for 'features' and 'delivery'
create or replace function public.knowledge_admin_save(p_entity text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  old jsonb; row_id text:=nullif(p_payload->>'id',''); pkg_id uuid; svc_id uuid; result jsonb;
  slug_val text:=coalesce(nullif(p_payload->>'slug',''),lower(regexp_replace(coalesce(p_payload->>'name',p_payload->>'title','item'),'[^a-z0-9]+','-','g')));
begin
  if not public.is_admin() then raise exception 'Knowledge Center access denied.' using errcode='insufficient_privilege'; end if;

  if p_entity='features' then
    select id into pkg_id from public.service_packages where slug=p_payload->>'package_slug';
    if pkg_id is null and row_id is null then raise exception 'Package not found for feature.'; end if;
    if row_id is null then
      insert into public.package_features(package_id,slug,name,description,included,sort_order,active)
      values(pkg_id,slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'description',''),coalesce((p_payload->>'included')::boolean,true),coalesce((p_payload->>'sort_order')::integer,0),coalesce((p_payload->>'active')::boolean,true))
      returning to_jsonb(package_features.*),id::text into result,row_id;
    else
      select to_jsonb(f) into old from public.package_features f where id=row_id::uuid;
      update public.package_features set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),description=coalesce(p_payload->>'description',description),included=coalesce((p_payload->>'included')::boolean,included),sort_order=coalesce((p_payload->>'sort_order')::integer,sort_order),active=coalesce((p_payload->>'active')::boolean,active) where id=row_id::uuid returning to_jsonb(package_features.*),id::text into result,row_id;
    end if;

  elsif p_entity='delivery' then
    select id into svc_id from public.services where slug=p_payload->>'service_slug';
    if svc_id is null and row_id is null then raise exception 'Service not found for delivery timeline.'; end if;
    if row_id is null then
      insert into public.delivery_timelines(service_id,package_id,name,min_days,max_days,priority,rush_charge,active)
      values(svc_id,(select id from public.service_packages where slug=p_payload->>'package_slug'),coalesce(p_payload->>'name','Standard delivery'),coalesce((p_payload->>'min_days')::integer,0),coalesce((p_payload->>'max_days')::integer,0),coalesce(p_payload->>'priority','standard'),nullif(p_payload->>'rush_charge','')::numeric,coalesce((p_payload->>'active')::boolean,true))
      returning to_jsonb(delivery_timelines.*),id::text into result,row_id;
    else
      select to_jsonb(dt) into old from public.delivery_timelines dt where id=row_id::uuid;
      update public.delivery_timelines set name=coalesce(p_payload->>'name',name),min_days=coalesce((p_payload->>'min_days')::integer,min_days),max_days=coalesce((p_payload->>'max_days')::integer,max_days),priority=coalesce(p_payload->>'priority',priority),rush_charge=case when p_payload?'rush_charge' then nullif(p_payload->>'rush_charge','')::numeric else rush_charge end,active=coalesce((p_payload->>'active')::boolean,active) where id=row_id::uuid returning to_jsonb(delivery_timelines.*),id::text into result,row_id;
    end if;

  elsif p_entity='services' then
    if row_id is null then insert into public.services(slug,name,description,active,custom_quote) values(slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'custom_quote')::boolean,true)) returning to_jsonb(services.*),id::text into result,row_id;
    else select to_jsonb(s) into old from public.services s where id=row_id::uuid; update public.services set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active),custom_quote=coalesce((p_payload->>'custom_quote')::boolean,custom_quote),updated_at=now(),archived_at=case when coalesce((p_payload->>'active')::boolean,active) then null else coalesce(archived_at,now()) end where id=row_id::uuid returning to_jsonb(services.*),id::text into result,row_id; end if;

  elsif p_entity='packages' then
    select id into svc_id from public.services where slug=lower(p_payload->>'service_slug');
    if svc_id is null then raise exception 'Service not found.'; end if;
    if row_id is null then
      insert into public.service_packages(service_id,slug,name,description,active,custom_quote,hosting_included,domain_included,ssl_included,support_period_days) values(svc_id,slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'custom_quote')::boolean,false),coalesce((p_payload->>'hosting_included')::boolean,false),coalesce((p_payload->>'domain_included')::boolean,false),coalesce((p_payload->>'ssl_included')::boolean,true),coalesce((p_payload->>'support_period_days')::integer,0)) returning to_jsonb(service_packages.*),id::text into result,row_id;
    else
      select to_jsonb(p) into old from public.service_packages p where id=row_id::uuid;
      update public.service_packages set name=coalesce(p_payload->>'name',name),slug=coalesce(p_payload->>'slug',slug),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active),custom_quote=coalesce((p_payload->>'custom_quote')::boolean,custom_quote),hosting_included=coalesce((p_payload->>'hosting_included')::boolean,hosting_included),domain_included=coalesce((p_payload->>'domain_included')::boolean,domain_included),ssl_included=coalesce((p_payload->>'ssl_included')::boolean,ssl_included),support_period_days=coalesce((p_payload->>'support_period_days')::integer,support_period_days),updated_at=now(),archived_at=case when coalesce((p_payload->>'active')::boolean,active) then null else coalesce(archived_at,now()) end where id=row_id::uuid returning to_jsonb(service_packages.*),id::text into result,row_id;
    end if;

  elsif p_entity='pricing' then
    declare pricing_id uuid;
    begin
      select pp.id into pricing_id from public.package_pricing pp where pp.id=case when row_id is null then null else row_id::uuid end;
      select sp.id into pkg_id from public.service_packages sp join public.services s on s.id=sp.service_id where sp.slug=p_payload->>'package_slug' or s.slug=p_payload->>'service_slug' order by sp.sort_order limit 1;
      if pkg_id is null and pricing_id is null then raise exception 'Package not found.'; end if;
      if pricing_id is null then
        insert into public.package_pricing(package_id,label,billing_model,amount,visible,active,is_base) values(pkg_id,coalesce(p_payload->>'label','Pricing'),coalesce(p_payload->>'billing_model','custom_quote'),nullif(p_payload->>'amount','')::numeric,coalesce((p_payload->>'visible')::boolean,true),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'is_base')::boolean,false)) returning to_jsonb(package_pricing.*),id::text into result,row_id;
      else
        select to_jsonb(pp) into old from public.package_pricing pp where pp.id=pricing_id;
        update public.package_pricing set label=coalesce(p_payload->>'label',label),billing_model=coalesce(p_payload->>'billing_model',billing_model),amount=case when p_payload?'amount' then nullif(p_payload->>'amount','')::numeric else amount end,visible=coalesce((p_payload->>'visible')::boolean,visible),active=coalesce((p_payload->>'active')::boolean,active),is_base=coalesce((p_payload->>'is_base')::boolean,is_base),updated_at=now() where id=pricing_id returning to_jsonb(package_pricing.*),id::text into result,row_id;
        insert into public.pricing_change_history(pricing_id,entity_type,entity_id,old_amount,new_amount,old_value,new_value,reason,approval_status,changed_by) values(row_id::uuid,'package_pricing',row_id,(old->>'amount')::numeric,(result->>'amount')::numeric,old,result,coalesce(p_payload->>'reason',''),coalesce(p_payload->>'approval_status','approved'),auth.uid());
      end if;
    end;

  elsif p_entity='faq' then
    if row_id is null then insert into public.faq(slug,question,answer,published,active) values(slug_val,coalesce(p_payload->>'question',''),coalesce(p_payload->>'answer',''),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(faq.*),id::text into result,row_id;
    else select to_jsonb(f) into old from public.faq f where id=row_id::uuid; update public.faq set slug=coalesce(p_payload->>'slug',slug),question=coalesce(p_payload->>'question',question),answer=coalesce(p_payload->>'answer',answer),published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(faq.*),id::text into result,row_id; end if;

  elsif p_entity='policies' then
    if row_id is null then insert into public.company_policies(slug,name,body,published,active) values(slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'body',''),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(company_policies.*),id::text into result,row_id;
    else select to_jsonb(cp) into old from public.company_policies cp where id=row_id::uuid; update public.company_policies set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),body=coalesce(p_payload->>'body',body),version=version+1,published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(company_policies.*),id::text into result,row_id; end if;

  elsif p_entity='discounts' then
    if row_id is null then insert into public.discount_rules(slug,name,discount_type,value,code,active) values(slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'discount_type','custom'),nullif(p_payload->>'value','')::numeric,p_payload->>'code',coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(discount_rules.*),id::text into result,row_id;
    else select to_jsonb(d) into old from public.discount_rules d where id=row_id::uuid; update public.discount_rules set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),discount_type=coalesce(p_payload->>'discount_type',discount_type),value=case when p_payload?'value' then nullif(p_payload->>'value','')::numeric else value end,code=coalesce(p_payload->>'code',code),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(discount_rules.*),id::text into result,row_id; end if;

  elsif p_entity='integrations' then
    if row_id is null then insert into public.supported_integrations(slug,name,category,description,active) values(slug_val,coalesce(p_payload->>'name',slug_val),coalesce(p_payload->>'category','integration'),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(supported_integrations.*),id::text into result,row_id;
    else select to_jsonb(i) into old from public.supported_integrations i where id=row_id::uuid; update public.supported_integrations set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),category=coalesce(p_payload->>'category',category),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active) where id=row_id::uuid returning to_jsonb(supported_integrations.*),id::text into result,row_id; end if;

  elsif p_entity='knowledge' then
    if row_id is null then insert into public.knowledge_articles(slug,title,body,category,published,active) values(slug_val,coalesce(p_payload->>'title',slug_val),coalesce(p_payload->>'body',''),coalesce(p_payload->>'category','general'),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(knowledge_articles.*),id::text into result,row_id;
    else select to_jsonb(k) into old from public.knowledge_articles k where id=row_id::uuid; update public.knowledge_articles set slug=coalesce(p_payload->>'slug',slug),title=coalesce(p_payload->>'title',title),body=coalesce(p_payload->>'body',body),category=coalesce(p_payload->>'category',category),published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(knowledge_articles.*),id::text into result,row_id; end if;

  else raise exception 'Unsupported knowledge entity.' using errcode='invalid_parameter_value'; end if;

  perform public.knowledge_log_change(p_entity,row_id,case when old is null then 'created' else 'updated' end,old,result,coalesce(p_payload->>'reason',''),coalesce(p_payload->>'approval_status','approved'));
  return result;
end $$;

-- Grants
grant execute on function public.knowledge_get_pricing(text) to anon,authenticated;
grant execute on function public.knowledge_admin_list(text,text,integer,integer) to authenticated;
grant execute on function public.knowledge_admin_save(text,jsonb) to authenticated;
grant select on public.delivery_timelines,public.package_features,public.package_limits to anon,authenticated;

commit;

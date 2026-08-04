begin;

-- PR-Web-1.5: normalized, database-owned pricing and knowledge catalog.
-- Operational modules consume this catalog through read-only RPCs; admin writes
-- are transactional and are recorded before the transaction can commit.

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id),
  slug text not null unique,
  name text not null,
  description text not null default '',
  service_type text not null default 'standard',
  active boolean not null default true,
  custom_quote boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  custom_quote boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.package_feature_groups (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  unique(package_id, name)
);
create table if not exists public.package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  feature_group_id uuid references public.package_feature_groups(id) on delete set null,
  slug text not null,
  name text not null,
  description text not null default '',
  included boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique(package_id, slug)
);
create table if not exists public.package_limits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  name text not null,
  limit_value text not null,
  unit text not null default '',
  active boolean not null default true,
  unique(package_id, name)
);
create table if not exists public.package_pricing (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  label text not null,
  billing_model text not null check (billing_model in ('fixed','per_user','per_month','per_year','per_feature','custom_quote','hidden_price','negotiable')),
  amount numeric(14,2),
  currency text not null default 'INR',
  visible boolean not null default true,
  negotiable boolean not null default false,
  is_base boolean not null default false,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(package_id, label)
);
alter table public.package_pricing add column if not exists is_base boolean not null default false;
create table if not exists public.package_addons (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  pricing_id uuid references public.package_pricing(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique(package_id, slug)
);
create table if not exists public.hosting_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text not null default '',
  resources jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.hosting_features (
  id uuid primary key default gen_random_uuid(),
  hosting_plan_id uuid not null references public.hosting_plans(id) on delete cascade,
  name text not null,
  value text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true
);
create table if not exists public.hosting_pricing (
  id uuid primary key default gen_random_uuid(),
  hosting_plan_id uuid not null references public.hosting_plans(id) on delete cascade,
  billing_model text not null check (billing_model in ('per_month','per_year','custom_quote','hidden_price')),
  amount numeric(14,2),
  currency text not null default 'INR',
  visible boolean not null default true,
  active boolean not null default true,
  unique(hosting_plan_id, billing_model)
);
create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text not null default '',
  coverage jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.maintenance_features (
  id uuid primary key default gen_random_uuid(),
  maintenance_plan_id uuid not null references public.maintenance_plans(id) on delete cascade,
  name text not null,
  value text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true
);
create table if not exists public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  advance_percent numeric(5,2) not null default 0 check (advance_percent between 0 and 100),
  milestones jsonb not null default '[]'::jsonb,
  late_fee_percent numeric(7,3) not null default 0,
  active boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.delivery_timelines (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete cascade,
  name text not null,
  min_days integer not null default 0 check (min_days >= 0),
  max_days integer not null default 0 check (max_days >= min_days),
  priority text not null default 'standard',
  rush_charge numeric(14,2),
  active boolean not null default true
);
create table if not exists public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  discount_type text not null check (discount_type in ('percentage','fixed','promo_code','volume','seasonal','custom')),
  value numeric(14,2),
  code text,
  conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.technology_stack (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'technology',
  description text not null default '',
  active boolean not null default true
);
create table if not exists public.supported_integrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'integration',
  description text not null default '',
  active boolean not null default true
);
create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  active boolean not null default true
);
create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  question text not null,
  answer text not null,
  service_id uuid references public.services(id) on delete set null,
  keywords text[] not null default '{}',
  published boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.company_policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  body text not null,
  version integer not null default 1,
  published boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.quotation_templates (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, body jsonb not null default '{}'::jsonb, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, body jsonb not null default '{}'::jsonb, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pricing_notes (
  id uuid primary key default gen_random_uuid(), service_id uuid references public.services(id) on delete cascade, note text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.pricing_visibility (
  id uuid primary key default gen_random_uuid(), service_id uuid not null unique references public.services(id) on delete cascade, visible_to_public boolean not null default false, visible_to_partners boolean not null default true, visible_to_staff boolean not null default true, disclaimer text not null default '', active boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.service_dependencies (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade, dependency_service_id uuid not null references public.services(id) on delete cascade, required boolean not null default false, description text not null default '', active boolean not null default true, unique(service_id, dependency_service_id)
);
create table if not exists public.service_recommendations (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade, recommended_service_id uuid not null references public.services(id) on delete cascade, reason text not null default '', sort_order integer not null default 0, active boolean not null default true, unique(service_id, recommended_service_id)
);
create table if not exists public.cross_sell_rules (
  id uuid primary key default gen_random_uuid(), source_service_id uuid not null references public.services(id) on delete cascade, target_service_id uuid not null references public.services(id) on delete cascade, message text not null default '', active boolean not null default true, unique(source_service_id, target_service_id)
);
create table if not exists public.up_sell_rules (
  id uuid primary key default gen_random_uuid(), source_package_id uuid not null references public.service_packages(id) on delete cascade, target_package_id uuid not null references public.service_packages(id) on delete cascade, message text not null default '', active boolean not null default true, unique(source_package_id, target_package_id)
);
create table if not exists public.feature_icons (
  id uuid primary key default gen_random_uuid(), slug text not null unique, icon_name text not null, label text not null default '', active boolean not null default true
);
create table if not exists public.feature_tags (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, active boolean not null default true
);
create table if not exists public.service_media (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade, media_type text not null default 'image', url text not null, alt_text text not null default '', sort_order integer not null default 0, active boolean not null default true
);
create table if not exists public.service_documents (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade, title text not null, url text not null, document_type text not null default 'document', active boolean not null default true
);
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, body text not null, category text not null default 'general', keywords text[] not null default '{}', published boolean not null default true, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create table if not exists public.knowledge_audit_log (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id text, action text not null, old_value jsonb, new_value jsonb, reason text not null default '', approval_status text not null default 'approved', actor_id uuid, actor_name text, created_at timestamptz not null default now()
);
create table if not exists public.pricing_change_history (
  id uuid primary key default gen_random_uuid(), pricing_id uuid, entity_type text not null, entity_id text, old_amount numeric(14,2), new_amount numeric(14,2), old_value jsonb, new_value jsonb, reason text not null default '', approval_status text not null default 'approved', changed_by uuid, changed_at timestamptz not null default now()
);

create index if not exists services_category_active_idx on public.services(category_id, active, sort_order);
create index if not exists service_packages_service_active_idx on public.service_packages(service_id, active, sort_order);
create index if not exists package_pricing_lookup_idx on public.package_pricing(package_id, active, visible, effective_from desc);
create index if not exists package_addons_lookup_idx on public.package_addons(package_id, active, sort_order);
create index if not exists faq_search_idx on public.faq using gin(to_tsvector('simple', question || ' ' || answer));
create index if not exists knowledge_articles_search_idx on public.knowledge_articles using gin(to_tsvector('simple', title || ' ' || body));
create index if not exists knowledge_audit_entity_idx on public.knowledge_audit_log(entity_type, entity_id, created_at desc);
create index if not exists pricing_history_entity_idx on public.pricing_change_history(entity_type, entity_id, changed_at desc);

do $$
declare c uuid; s uuid; p uuid; pid uuid; addon uuid;
begin
  insert into public.service_categories(slug,name,description,sort_order) values
    ('web','Websites & web applications','Websites, portals and business web applications.',10),
    ('business-systems','Business systems','ERP, CRM and operational systems.',20),
    ('growth','Growth & automation','Marketing, SEO and AI automation.',30),
    ('support','Support & enablement','Hosting, maintenance, training and consultation.',40)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,updated_at=now();

  select id into c from public.service_categories where slug='web';
  insert into public.services(category_id,slug,name,description,service_type,custom_quote,sort_order) values
    (c,'website','Website','Business websites and landing pages.','website',false,10),
    (c,'restaurant','Restaurant Website','Restaurant and ordering websites.','website',true,20),
    (c,'school','School Website','School and education websites.','website',true,30),
    (c,'hospital','Hospital Website','Healthcare and hospital websites.','website',true,40),
    (c,'portfolio','Portfolio Website','Portfolio and personal brand websites.','website',true,50),
    (c,'corporate','Corporate Website','Corporate websites and portals.','website',true,60),
    (c,'real-estate','Real Estate Website','Property and real-estate websites.','website',true,70),
    (c,'hotel','Hotel Website','Hotel and hospitality websites.','website',true,80),
    (c,'gym','Gym Website','Gym and fitness websites.','website',true,90),
    (c,'salon','Salon Website','Salon and appointment websites.','website',true,100),
    (c,'ecommerce','E-Commerce','Online stores and commerce experiences.','website',true,110)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,updated_at=now();
  select id into c from public.service_categories where slug='business-systems';
  insert into public.services(category_id,slug,name,description,service_type,sort_order) values
    (c,'erp','ERP','Enterprise resource planning systems.','application',120),(c,'crm','CRM','Customer relationship management systems.','application',130),(c,'pos','POS','Point-of-sale systems.','application',140),(c,'inventory','Inventory','Inventory management systems.','application',150),(c,'hrms','HRMS','Human resources management systems.','application',160),(c,'attendance','Attendance','Attendance and workforce tracking.','application',170),(c,'accounting','Accounting','Accounting and finance systems.','application',180)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,updated_at=now();
  select id into c from public.service_categories where slug='growth';
  insert into public.services(category_id,slug,name,description,service_type,sort_order) values
    (c,'ai-automation','AI Automation','Deterministic workflow and automation solutions.','automation',190),(c,'digital-marketing','Digital Marketing','Digital marketing retainers and campaigns.','marketing',200),(c,'seo','SEO','Search engine optimisation services.','marketing',210)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,updated_at=now();
  select id into c from public.service_categories where slug='support';
  insert into public.services(category_id,slug,name,description,service_type,sort_order) values
    (c,'hosting','Hosting','Managed hosting plans.','support',220),(c,'amc','AMC','Annual maintenance and support.','support',230),(c,'training','Training','Training and course programs.','support',240),(c,'consultation','Consultation','Consultation and discovery engagements.','support',250)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,updated_at=now();

  select id into s from public.services where slug='website';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values (s,'website-starter','Website Starter','Starter website package.',false,10) on conflict(slug) do update set name=excluded.name,description=excluded.description,service_id=excluded.service_id,updated_at=now();
  select id into p from public.service_packages where slug='website-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Website (starter)','fixed',15000,true,false,true) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,is_base=true,active=true,visible=true,updated_at=now();
  insert into public.package_features(package_id,slug,name,description) values(p,'responsive','Responsive design','Mobile-friendly responsive pages.'),(p,'basic-seo','Basic SEO setup','Foundational metadata and indexing setup.') on conflict(package_id,slug) do nothing;
  insert into public.package_addons(package_id,slug,name,description,active,sort_order) values(p,'ecommerce','E-commerce store','Store and checkout functionality.',true,10),(p,'seo','SEO setup','Additional SEO setup.',true,20),(p,'extra','Extra pages / sections','Additional pages or sections.',true,30),(p,'maintenance','Annual maintenance','Annual maintenance coverage.',true,40) on conflict(package_id,slug) do update set name=excluded.name,description=excluded.description;
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'E-commerce store','fixed',12000,true,false,false),(p,'SEO setup','fixed',5000,true,false,false),(p,'Extra pages / sections','fixed',4000,true,false,false),(p,'Annual maintenance','per_year',6000,true,false,false) on conflict(package_id,label) do update set is_base=false,active=true,visible=true,updated_at=now();

  select id into s from public.services where slug='digital-marketing';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'digital-marketing-base','Digital marketing','Digital marketing monthly service.',false,10) on conflict(slug) do update set name=excluded.name,description=excluded.description,service_id=excluded.service_id,updated_at=now();
  select id into p from public.service_packages where slug='digital-marketing-base';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Digital marketing (monthly)','per_month',8000,true,false,true) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,is_base=true,active=true,visible=true,updated_at=now();
  insert into public.package_addons(package_id,slug,name,description,sort_order) values(p,'ads','Paid ad management','Paid ad management.',10),(p,'content','Content creation','Content creation.',20),(p,'social','Social media handling','Social media handling.',30) on conflict(package_id,slug) do update set name=excluded.name,description=excluded.description;
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Paid ad management','per_month',5000,true,false,false),(p,'Content creation','per_month',4000,true,false,false),(p,'Social media handling','per_month',3000,true,false,false) on conflict(package_id,label) do update set is_base=false,active=true,visible=true,updated_at=now();

  select id into s from public.services where slug='training';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'training-course','Course admission','Course admission and training.',false,10) on conflict(slug) do update set name=excluded.name,description=excluded.description,service_id=excluded.service_id,updated_at=now();
  select id into p from public.service_packages where slug='training-course';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Course admission','fixed',5000,true,false,true) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,is_base=true,active=true,visible=true,updated_at=now();
  insert into public.package_addons(package_id,slug,name,description,sort_order) values(p,'advanced','Advanced module','Advanced module.',10),(p,'certification','Certification','Certification.',20) on conflict(package_id,slug) do update set name=excluded.name,description=excluded.description;
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Advanced module','fixed',3000,true,false,false),(p,'Certification','fixed',1500,true,false,false) on conflict(package_id,label) do update set is_base=false,active=true,visible=true,updated_at=now();

  insert into public.pricing_visibility(service_id,visible_to_public,visible_to_partners,visible_to_staff,disclaimer) select id,case when slug in ('website','digital-marketing','training') then true else false end,true,true,'Final pricing depends on scope, content, integrations and delivery requirements.' from public.services on conflict(service_id) do update set visible_to_public=excluded.visible_to_public,disclaimer=excluded.disclaimer,updated_at=now();
  insert into public.payment_terms(slug,name,advance_percent,milestones,description) values('standard-50-50','Standard 50/50',50,'[{"label":"Project start","percent":50},{"label":"Delivery","percent":50}]','Standard project payment schedule.') on conflict(slug) do nothing;
  insert into public.knowledge_articles(slug,title,body,category,keywords) values('pricing-overview','Pricing overview','Official prices are maintained in the Pricing & Knowledge Center and may vary after scope review.','pricing','{pricing,quotation,estimate}'),('delivery-overview','Delivery timelines','Delivery timelines are confirmed after requirements, content and integration scope are reviewed.','delivery','{delivery,timeline,scope}') on conflict(slug) do update set title=excluded.title,body=excluded.body,category=excluded.category,keywords=excluded.keywords,updated_at=now();
  insert into public.faq(slug,question,answer,keywords) values('pricing-final','Is the displayed price final?','Displayed amounts are official starting prices. A confirmed quotation may change after scope and requirements review.','{pricing,quote,estimate}'),('payment-schedule','How are payments scheduled?','Payment terms are recorded on the quotation and follow the approved milestone schedule.','{payment,milestone,advance}') on conflict(slug) do update set question=excluded.question,answer=excluded.answer,keywords=excluded.keywords,updated_at=now();
end $$;

create or replace view public.knowledge_service_catalog as
select s.id,s.slug,s.name,s.description,s.service_type,s.active,s.custom_quote,s.sort_order,c.slug as category_slug,c.name as category_name,
  coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'description',p.description,'custom_quote',p.custom_quote) order by p.sort_order,p.name) from public.service_packages p where p.service_id=s.id and p.active and p.archived_at is null),'[]'::jsonb) packages
from public.services s left join public.service_categories c on c.id=s.category_id where s.active and s.archived_at is null;
create or replace view public.knowledge_public_price_list as
select s.slug as service_slug,s.name as service_name,p.slug as package_slug,p.name as package_name,pp.label,pp.billing_model,pp.amount,pp.currency,pp.visible
from public.services s join public.service_packages p on p.service_id=s.id join public.package_pricing pp on pp.package_id=p.id
join public.pricing_visibility pv on pv.service_id=s.id
where s.active and p.active and pp.active and pp.visible and pv.visible_to_public and s.archived_at is null and p.archived_at is null and (pp.effective_to is null or pp.effective_to>now());
create or replace view public.knowledge_admin_activity as select * from public.knowledge_audit_log order by created_at desc;
create or replace view public.knowledge_search_index as
select 'service'::text result_type,id::text result_id,slug,name as title,description as body from public.services where active
union all select 'package',id::text,slug,name,description from public.service_packages where active
union all select 'faq',id::text,slug,question,answer from public.faq where active and published
union all select 'policy',id::text,slug,name,body from public.company_policies where active and published
union all select 'article',id::text,slug,title,body from public.knowledge_articles where active and published;

create or replace function public.knowledge_resolve_service(p_service text) returns uuid language sql stable security definer set search_path=public as $$
  select id from public.services where active and (slug=lower(trim(p_service)) or lower(name)=lower(trim(p_service)) or slug=case lower(trim(p_service)) when 'marketing' then 'digital-marketing' when 'course' then 'training' when 'e-commerce' then 'ecommerce' else lower(trim(p_service)) end) order by sort_order limit 1;
$$;
create or replace function public.knowledge_get_pricing(p_service text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare sid uuid; pkg record; base record; opts jsonb;
begin
  sid:=public.knowledge_resolve_service(p_service);
  if sid is null then return jsonb_build_object('service',p_service,'base',null,'baseLabel','Custom quotation','options','[]'::jsonb,'model','custom_quote','visible',false,'customQuote',true,'disclaimer','Pricing is confirmed after scope review.'); end if;
  select p.* into pkg from public.service_packages p where p.service_id=sid and p.active and p.archived_at is null order by p.sort_order limit 1;
  if pkg.id is null then return jsonb_build_object('service',(select slug from public.services where id=sid),'base',null,'baseLabel','Custom quotation','options','[]'::jsonb,'model','custom_quote','visible',false,'customQuote',true,'disclaimer','Pricing is confirmed after scope review.'); end if;
  select pp.* into base from public.package_pricing pp where pp.package_id=pkg.id and pp.active and pp.visible and (pp.effective_to is null or pp.effective_to>now()) order by pp.is_base desc,pp.amount nulls last,pp.effective_from desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('key',a.slug,'label',a.name,'amount',coalesce(ap.amount,0),'model',coalesce(ap.billing_model,'custom_quote')) order by a.sort_order,a.name),'[]'::jsonb) into opts from public.package_addons a left join lateral (select pp.amount,pp.billing_model from public.package_pricing pp where pp.package_id=pkg.id and pp.active and pp.visible and lower(pp.label)=lower(a.name) order by pp.effective_from desc limit 1) ap on true where a.package_id=pkg.id and a.active;
  return jsonb_build_object('service',(select slug from public.services where id=sid),'package',pkg.name,'base',base.amount,'baseLabel',coalesce(base.label,pkg.name),'options',opts,'model',coalesce(base.billing_model,'custom_quote'),'visible',coalesce(base.visible,false),'customQuote',pkg.custom_quote or base.amount is null,'currency',coalesce(base.currency,'INR'),'disclaimer','Official starting price; final quotation depends on confirmed scope.');
end $$;

create or replace function public.knowledge_estimate(p_service text,p_answers jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare pricing jsonb; total numeric; selected jsonb:='[]'::jsonb; opt jsonb; hay text:=lower(coalesce(p_answers::text,''));
begin
  pricing:=public.knowledge_get_pricing(p_service); total:=coalesce(nullif(pricing->>'base','')::numeric,0);
  for opt in select value from jsonb_array_elements(coalesce(pricing->'options','[]'::jsonb)) loop
    if (opt->>'key'='ecommerce' and hay like '%ecommerce%') or (opt->>'key'='seo' and hay like '%seo%') or (opt->>'key'='extra' and (hay like '%extra page%' or hay like '%additional page%')) or (opt->>'key'='maintenance' and (hay like '%maintenance%' or hay like '%amc%')) or (opt->>'key'='ads' and (hay like '%advert%' or hay like '%paid ad%')) or (opt->>'key'='content' and hay like '%content%') or (opt->>'key'='social' and hay like '%social%') or (opt->>'key'='advanced' and hay like '%advanced%') or (opt->>'key'='certification' and hay like '%certif%') then total:=total+coalesce(nullif(opt->>'amount','')::numeric,0); selected:=selected||jsonb_build_array(opt); end if;
  end loop;
  return pricing||jsonb_build_object('known',(pricing->>'base') is not null,'estimated_cost',case when (pricing->>'base') is null then null else round(total,2) end,'optional_addons',selected,'answers',coalesce(p_answers,'{}'::jsonb));
end $$;

create or replace function public.knowledge_search(p_query text,p_type text default null,p_limit integer default 20) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.title),'[]'::jsonb) from (select * from public.knowledge_search_index x where (p_type is null or p_type='' or x.result_type=p_type) and (coalesce(trim(p_query),'')='' or lower(x.title||' '||x.body||' '||x.slug) like '%'||lower(trim(p_query))||'%') order by x.title limit greatest(1,least(coalesce(p_limit,20),100))) x;
$$;

create or replace function public.web_ai_estimate(p_service text,p_answers jsonb,p_pricing jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path=public as $$ select public.knowledge_estimate(p_service,p_answers); $$;

create or replace function public.knowledge_log_change(p_entity_type text,p_entity_id text,p_action text,p_old jsonb,p_new jsonb,p_reason text default '',p_approval_status text default 'approved') returns void language plpgsql security definer set search_path=public as $$
declare actor_name text; begin select name into actor_name from public.profiles where id=auth.uid(); insert into public.knowledge_audit_log(entity_type,entity_id,action,old_value,new_value,reason,approval_status,actor_id,actor_name) values(p_entity_type,p_entity_id,p_action,p_old,p_new,coalesce(p_reason,''),coalesce(p_approval_status,'approved'),auth.uid(),actor_name); if to_regclass('public.audit') is not null then begin execute 'insert into public.audit(id,data,updated_at) values($1,$2,now()) on conflict(id) do nothing' using 'knowledge-'||gen_random_uuid()::text,jsonb_build_object('id',gen_random_uuid(),'module','Knowledge','action',p_action,'entity',p_entity_type,'entityId',p_entity_id,'description',coalesce(p_reason,p_action),'user',coalesce(actor_name,'System'),'ts',(extract(epoch from now())*1000)::bigint); exception when others then null; end; end if; if to_regclass('public.notifications') is not null then begin execute 'insert into public.notifications(id,data,updated_at) values($1,$2,now()) on conflict(id) do nothing' using 'knowledge-'||gen_random_uuid()::text,jsonb_build_object('id',gen_random_uuid(),'title','Knowledge catalog updated','body',coalesce(p_reason,p_action),'level','Normal','audience','all','createdAt',(extract(epoch from now())*1000)::bigint,'by',coalesce(actor_name,'System')); exception when others then null; end; end if; end $$;

create or replace function public.knowledge_admin_list(p_entity text,p_search text default '',p_page integer default 1,p_page_size integer default 25) returns jsonb language plpgsql security definer set search_path=public as $$
declare items jsonb; total integer; off integer:=greatest(0,(coalesce(p_page,1)-1)*greatest(1,least(coalesce(p_page_size,25),100))); lim integer:=greatest(1,least(coalesce(p_page_size,25),100)); q text:='%'||lower(coalesce(p_search,''))||'%';
begin
  if not public.is_admin() then raise exception 'Knowledge Center access denied.' using errcode='insufficient_privilege'; end if;
  if p_entity='services' then select count(*)::int into total from public.services where lower(name||' '||slug||' '||description) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select s.id,s.slug,s.name,s.description,s.active,s.custom_quote,c.slug category_slug from public.services s left join public.service_categories c on c.id=s.category_id where lower(s.name||' '||s.slug||' '||s.description) like q order by s.sort_order,s.name offset off limit lim) x;
  elsif p_entity='packages' then select count(*)::int into total from public.service_packages p where lower(p.name||' '||p.slug||' '||p.description) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select p.id,p.slug,p.name,p.description,p.active,p.custom_quote,s.slug service_slug from public.service_packages p join public.services s on s.id=p.service_id where lower(p.name||' '||p.slug||' '||p.description) like q order by p.sort_order,p.name offset off limit lim) x;
  elsif p_entity='pricing' then select count(*)::int into total from public.package_pricing pp where lower(pp.label||' '||pp.billing_model) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select pp.id,pp.label,pp.billing_model,pp.amount,pp.currency,pp.visible,pp.active,pp.is_base,p.slug package_slug,s.slug service_slug from public.package_pricing pp join public.service_packages p on p.id=pp.package_id join public.services s on s.id=p.service_id where lower(pp.label||' '||pp.billing_model||' '||p.name||' '||s.name) like q order by s.name,p.name,pp.label offset off limit lim) x;
  elsif p_entity='hosting' then select count(*)::int into total from public.hosting_plans where lower(name||' '||slug||' '||description) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.hosting_plans where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='maintenance' then select count(*)::int into total from public.maintenance_plans where lower(name||' '||slug||' '||description) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.maintenance_plans where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='faq' then select count(*)::int into total from public.faq where lower(question||' '||answer||' '||slug) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,question,answer,published,active from public.faq where lower(question||' '||answer||' '||slug) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='policies' then select count(*)::int into total from public.company_policies where lower(name||' '||body||' '||slug) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,name,body,version,published,active from public.company_policies where lower(name||' '||body||' '||slug) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='discounts' then select count(*)::int into total from public.discount_rules where lower(name||' '||slug||' '||coalesce(code,'')) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.discount_rules where lower(name||' '||slug||' '||coalesce(code,'')) like q order by updated_at desc offset off limit lim) x;
  elsif p_entity='integrations' then select count(*)::int into total from public.supported_integrations where lower(name||' '||slug||' '||description) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select * from public.supported_integrations where lower(name||' '||slug||' '||description) like q order by name offset off limit lim) x;
  elsif p_entity='knowledge' then select count(*)::int into total from public.knowledge_articles where lower(title||' '||slug||' '||body) like q; select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (select id,slug,title,body,category,published,active from public.knowledge_articles where lower(title||' '||slug||' '||body) like q order by updated_at desc offset off limit lim) x;
  else raise exception 'Unknown knowledge entity.' using errcode='invalid_parameter_value'; end if;
  return jsonb_build_object('items',coalesce(items,'[]'::jsonb),'total',coalesce(total,0),'page',coalesce(p_page,1),'page_size',lim);
end $$;

create or replace function public.knowledge_admin_save(p_entity text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare old jsonb; row_id text:=nullif(p_payload->>'id',''); service_id uuid; package_id uuid; pricing_id uuid; result jsonb; slug text:=coalesce(nullif(p_payload->>'slug',''),lower(regexp_replace(coalesce(p_payload->>'name',p_payload->>'title','item'),'[^a-z0-9]+','-','g')));
begin
  if not public.is_admin() then raise exception 'Knowledge Center access denied.' using errcode='insufficient_privilege'; end if;
  if p_entity='services' then if row_id is null then insert into public.services(slug,name,description,active,custom_quote) values(slug,coalesce(p_payload->>'name',slug),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'custom_quote')::boolean,true)) returning to_jsonb(services.*),id::text into result,row_id; else select to_jsonb(s) into old from public.services s where id=row_id::uuid; update public.services set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active),custom_quote=coalesce((p_payload->>'custom_quote')::boolean,custom_quote),updated_at=now(),archived_at=case when coalesce((p_payload->>'active')::boolean,active) then null else coalesce(archived_at,now()) end where id=row_id::uuid returning to_jsonb(services.*),id::text into result,row_id; end if;
  elsif p_entity='packages' then select id into service_id from public.services where slug=lower(p_payload->>'service_slug'); if service_id is null then raise exception 'Service not found.'; end if; if row_id is null then insert into public.service_packages(service_id,slug,name,description,active,custom_quote) values(service_id,slug,coalesce(p_payload->>'name',slug),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'custom_quote')::boolean,false)) returning to_jsonb(service_packages.*),id::text into result,row_id; else select to_jsonb(p) into old from public.service_packages p where id=row_id::uuid; update public.service_packages set name=coalesce(p_payload->>'name',name),slug=coalesce(p_payload->>'slug',slug),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active),custom_quote=coalesce((p_payload->>'custom_quote')::boolean,custom_quote),updated_at=now(),archived_at=case when coalesce((p_payload->>'active')::boolean,active) then null else coalesce(archived_at,now()) end where id=row_id::uuid returning to_jsonb(service_packages.*),id::text into result,row_id; end if;
  elsif p_entity='pricing' then select p.id,p.service_id into pricing_id,service_id from public.package_pricing p join public.service_packages sp on sp.id=p.package_id where p.id=case when row_id is null then null else row_id::uuid end; select sp.id into package_id from public.service_packages sp join public.services s on s.id=sp.service_id where sp.slug=p_payload->>'package_slug' or s.slug=p_payload->>'service_slug' order by sp.sort_order limit 1; if package_id is null and pricing_id is null then raise exception 'Package not found.'; end if; if pricing_id is null then insert into public.package_pricing(package_id,label,billing_model,amount,visible,active,is_base) values(package_id,coalesce(p_payload->>'label','Pricing'),coalesce(p_payload->>'billing_model','custom_quote'),nullif(p_payload->>'amount','')::numeric,coalesce((p_payload->>'visible')::boolean,true),coalesce((p_payload->>'active')::boolean,true),coalesce((p_payload->>'is_base')::boolean,false)) returning to_jsonb(package_pricing.*),id::text into result,row_id; else select to_jsonb(pp) into old from public.package_pricing pp where pp.id=pricing_id; update public.package_pricing set label=coalesce(p_payload->>'label',label),billing_model=coalesce(p_payload->>'billing_model',billing_model),amount=case when p_payload ? 'amount' then nullif(p_payload->>'amount','')::numeric else amount end,visible=coalesce((p_payload->>'visible')::boolean,visible),active=coalesce((p_payload->>'active')::boolean,active),is_base=coalesce((p_payload->>'is_base')::boolean,is_base),updated_at=now() where id=pricing_id returning to_jsonb(package_pricing.*),id::text into result,row_id; end if;
  elsif p_entity='faq' then if row_id is null then insert into public.faq(slug,question,answer,published,active) values(slug,coalesce(p_payload->>'question',''),coalesce(p_payload->>'answer',''),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(faq.*),id::text into result,row_id; else select to_jsonb(f) into old from public.faq f where id=row_id::uuid; update public.faq set slug=coalesce(p_payload->>'slug',slug),question=coalesce(p_payload->>'question',question),answer=coalesce(p_payload->>'answer',answer),published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(faq.*),id::text into result,row_id; end if;
  elsif p_entity='policies' then if row_id is null then insert into public.company_policies(slug,name,body,published,active) values(slug,coalesce(p_payload->>'name',slug),coalesce(p_payload->>'body',''),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(company_policies.*),id::text into result,row_id; else select to_jsonb(cp) into old from public.company_policies cp where id=row_id::uuid; update public.company_policies set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),body=coalesce(p_payload->>'body',body),version=version+1,published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(company_policies.*),id::text into result,row_id; end if;
  elsif p_entity='discounts' then if row_id is null then insert into public.discount_rules(slug,name,discount_type,value,code,active) values(slug,coalesce(p_payload->>'name',slug),coalesce(p_payload->>'discount_type','custom'),nullif(p_payload->>'value','')::numeric,p_payload->>'code',coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(discount_rules.*),id::text into result,row_id; else select to_jsonb(d) into old from public.discount_rules d where id=row_id::uuid; update public.discount_rules set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),discount_type=coalesce(p_payload->>'discount_type',discount_type),value=case when p_payload ? 'value' then nullif(p_payload->>'value','')::numeric else value end,code=coalesce(p_payload->>'code',code),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(discount_rules.*),id::text into result,row_id; end if;
  elsif p_entity='integrations' then if row_id is null then insert into public.supported_integrations(slug,name,category,description,active) values(slug,coalesce(p_payload->>'name',slug),coalesce(p_payload->>'category','integration'),coalesce(p_payload->>'description',''),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(supported_integrations.*),id::text into result,row_id; else select to_jsonb(i) into old from public.supported_integrations i where id=row_id::uuid; update public.supported_integrations set slug=coalesce(p_payload->>'slug',slug),name=coalesce(p_payload->>'name',name),category=coalesce(p_payload->>'category',category),description=coalesce(p_payload->>'description',description),active=coalesce((p_payload->>'active')::boolean,active) where id=row_id::uuid returning to_jsonb(supported_integrations.*),id::text into result,row_id; end if;
  elsif p_entity='knowledge' then if row_id is null then insert into public.knowledge_articles(slug,title,body,category,published,active) values(slug,coalesce(p_payload->>'title',slug),coalesce(p_payload->>'body',''),coalesce(p_payload->>'category','general'),coalesce((p_payload->>'published')::boolean,true),coalesce((p_payload->>'active')::boolean,true)) returning to_jsonb(knowledge_articles.*),id::text into result,row_id; else select to_jsonb(k) into old from public.knowledge_articles k where id=row_id::uuid; update public.knowledge_articles set slug=coalesce(p_payload->>'slug',slug),title=coalesce(p_payload->>'title',title),body=coalesce(p_payload->>'body',body),category=coalesce(p_payload->>'category',category),published=coalesce((p_payload->>'published')::boolean,published),active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() where id=row_id::uuid returning to_jsonb(knowledge_articles.*),id::text into result,row_id; end if;
  else raise exception 'Unsupported knowledge entity.' using errcode='invalid_parameter_value'; end if;
  perform public.knowledge_log_change(p_entity,row_id,case when old is null then 'created' else 'updated' end,old,result,coalesce(p_payload->>'reason',''),coalesce(p_payload->>'approval_status','approved')); if p_entity='pricing' then insert into public.pricing_change_history(pricing_id,entity_type,entity_id,old_amount,new_amount,old_value,new_value,reason,approval_status,changed_by) values(row_id::uuid,'package_pricing',row_id,(old->>'amount')::numeric,(result->>'amount')::numeric,old,result,coalesce(p_payload->>'reason',''),coalesce(p_payload->>'approval_status','approved'),auth.uid()); end if; return result;
end $$;

create or replace function public.knowledge_export(p_entity text,p_search text default '') returns jsonb language sql security definer set search_path=public as $$ select (public.knowledge_admin_list(p_entity,p_search,1,100)->'items'); $$;
create or replace function public.knowledge_import(p_entity text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path=public as $$ declare r jsonb; n integer:=0; begin if not public.is_admin() then raise exception 'Knowledge Center access denied.' using errcode='insufficient_privilege'; end if; for r in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop perform public.knowledge_admin_save(p_entity,r); n:=n+1; end loop; return jsonb_build_object('imported',n); end $$;
create or replace function public.knowledge_admin_summary() returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('services',(select count(*) from public.services where active),'packages',(select count(*) from public.service_packages where active),'pricing',(select count(*) from public.package_pricing where active),'hosting',(select count(*) from public.hosting_plans where active),'maintenance',(select count(*) from public.maintenance_plans where active),'faq',(select count(*) from public.faq where active),'policies',(select count(*) from public.company_policies where active),'discounts',(select count(*) from public.discount_rules where active),'integrations',(select count(*) from public.supported_integrations where active),'knowledge',(select count(*) from public.knowledge_articles where active),'recent',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select entity_type,action,actor_name,created_at from public.knowledge_audit_log order by created_at desc limit 8) x)) where public.is_admin(); $$;

alter table public.service_categories enable row level security; alter table public.services enable row level security; alter table public.service_packages enable row level security; alter table public.package_feature_groups enable row level security; alter table public.package_features enable row level security; alter table public.package_limits enable row level security; alter table public.package_pricing enable row level security; alter table public.package_addons enable row level security; alter table public.hosting_plans enable row level security; alter table public.hosting_features enable row level security; alter table public.hosting_pricing enable row level security; alter table public.maintenance_plans enable row level security; alter table public.maintenance_features enable row level security; alter table public.payment_terms enable row level security; alter table public.delivery_timelines enable row level security; alter table public.discount_rules enable row level security; alter table public.technology_stack enable row level security; alter table public.supported_integrations enable row level security; alter table public.industries enable row level security; alter table public.faq enable row level security; alter table public.company_policies enable row level security; alter table public.quotation_templates enable row level security; alter table public.proposal_templates enable row level security; alter table public.pricing_notes enable row level security; alter table public.pricing_visibility enable row level security; alter table public.service_dependencies enable row level security; alter table public.service_recommendations enable row level security; alter table public.cross_sell_rules enable row level security; alter table public.up_sell_rules enable row level security; alter table public.feature_icons enable row level security; alter table public.feature_tags enable row level security; alter table public.service_media enable row level security; alter table public.service_documents enable row level security; alter table public.knowledge_articles enable row level security; alter table public.knowledge_audit_log enable row level security; alter table public.pricing_change_history enable row level security;

do $$ declare t text; begin foreach t in array array['service_categories','services','service_packages','package_feature_groups','package_features','package_limits','package_pricing','package_addons','hosting_plans','hosting_features','hosting_pricing','maintenance_plans','maintenance_features','payment_terms','delivery_timelines','discount_rules','technology_stack','supported_integrations','industries','faq','company_policies','quotation_templates','proposal_templates','pricing_notes','pricing_visibility','service_dependencies','service_recommendations','cross_sell_rules','up_sell_rules','feature_icons','feature_tags','service_media','service_documents','knowledge_articles'] loop execute format('drop policy if exists knowledge_read_%s on public.%I',t,t); execute format('create policy knowledge_read_%s on public.%I for select to anon,authenticated using (active)',t,t); end loop; foreach t in array array['knowledge_audit_log','pricing_change_history'] loop execute format('drop policy if exists knowledge_admin_read_%s on public.%I',t,t); execute format('create policy knowledge_admin_read_%s on public.%I for select to authenticated using (public.is_admin())',t,t); end loop; end $$;

grant select on public.service_categories,public.services,public.service_packages,public.package_feature_groups,public.package_features,public.package_limits,public.package_pricing,public.package_addons,public.hosting_plans,public.hosting_features,public.hosting_pricing,public.maintenance_plans,public.maintenance_features,public.payment_terms,public.delivery_timelines,public.discount_rules,public.technology_stack,public.supported_integrations,public.industries,public.faq,public.company_policies,public.quotation_templates,public.proposal_templates,public.pricing_notes,public.pricing_visibility,public.service_dependencies,public.service_recommendations,public.cross_sell_rules,public.up_sell_rules,public.feature_icons,public.feature_tags,public.service_media,public.service_documents,public.knowledge_articles to anon,authenticated;
grant select on public.knowledge_audit_log,public.pricing_change_history to authenticated;
grant execute on function public.knowledge_get_pricing(text),public.knowledge_estimate(text,jsonb),public.knowledge_search(text,text,integer),public.web_ai_estimate(text,jsonb,jsonb) to anon,authenticated;
grant execute on function public.knowledge_admin_list(text,text,integer,integer),public.knowledge_admin_save(text,jsonb),public.knowledge_export(text,text),public.knowledge_import(text,jsonb),public.knowledge_admin_summary() to authenticated;

do $$ declare t text; begin foreach t in array array['service_categories','services','service_packages','package_feature_groups','package_features','package_limits','package_pricing','package_addons','hosting_plans','hosting_features','hosting_pricing','maintenance_plans','maintenance_features','payment_terms','delivery_timelines','discount_rules','technology_stack','supported_integrations','industries','faq','company_policies','quotation_templates','proposal_templates','pricing_notes','pricing_visibility','service_dependencies','service_recommendations','cross_sell_rules','up_sell_rules','feature_icons','feature_tags','service_media','service_documents','knowledge_articles','knowledge_audit_log','pricing_change_history'] loop begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; end; end loop; end $$;

commit;

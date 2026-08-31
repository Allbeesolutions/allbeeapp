begin;

-- Complete, editable pricing catalogue for every commercial service.
-- Prices are starting prices only; Admin > Pricing & Knowledge remains the source of truth.

do $$
declare c uuid; s uuid; p uuid;
begin
  select id into c from public.service_categories where slug='web';
  if c is null then return; end if;

  -- Website packages
  select id into s from public.services where slug='website';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order)
  values
    (s,'website-single','Single Page Website','One-page responsive business or landing website.',false,5),
    (s,'website-starter','Website Starter','Professional small-business website.',false,10),
    (s,'website-business','Business Website','Custom business website with conversion-focused sections.',false,20),
    (s,'website-corporate','Corporate Website','Larger corporate website with advanced structure and integrations.',false,30)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,service_id=excluded.service_id,custom_quote=excluded.custom_quote,updated_at=now();

  select id into p from public.service_packages where slug='website-single';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base)
  values(p,'Single Page Website','fixed',9999,true,false,true),(p,'Domain Registration (1 Year)','per_year',1299,true,false,false),(p,'Web Hosting (1 Year)','per_year',2499,true,false,false),(p,'SSL Certificate & Security','fixed',0,true,false,false),(p,'Extra section','fixed',999,true,false,false)
  on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into p from public.service_packages where slug='website-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base)
  values(p,'Website Starter','fixed',14999,true,false,true),(p,'Domain Registration (1 Year)','per_year',1299,true,false,false),(p,'Web Hosting (1 Year)','per_year',3999,true,false,false),(p,'SSL Certificate & Security','fixed',0,true,false,false),(p,'Extra page','fixed',999,true,false,false),(p,'Additional language','fixed',2999,true,false,false),(p,'WhatsApp integration','fixed',1499,true,false,false),(p,'Payment gateway integration','fixed',2499,true,false,false),(p,'Google Analytics & Search Console','fixed',999,true,false,false)
  on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into p from public.service_packages where slug='website-business';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base)
  values(p,'Business Website','fixed',24999,true,false,true),(p,'Domain Registration (1 Year)','per_year',1299,true,false,false),(p,'Web Hosting (1 Year)','per_year',4999,true,false,false),(p,'SSL Certificate & Security','fixed',0,true,false,false),(p,'Extra page','fixed',999,true,false,false),(p,'Additional language','fixed',3999,true,false,false),(p,'WhatsApp integration','fixed',1499,true,false,false),(p,'Payment gateway integration','fixed',2499,true,false,false),(p,'Advanced SEO setup','fixed',4999,true,false,false),(p,'Content upload / migration','fixed',2999,true,false,false)
  on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into p from public.service_packages where slug='website-corporate';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base)
  values(p,'Corporate Website','fixed',44999,true,true,true),(p,'Domain Registration (1 Year)','per_year',1299,true,false,false),(p,'Web Hosting (1 Year)','per_year',7999,true,false,false),(p,'SSL Certificate & Security','fixed',0,true,false,false),(p,'Extra page','fixed',1499,true,false,false),(p,'Additional language','fixed',4999,true,false,false),(p,'Advanced SEO setup','fixed',7999,true,false,false),(p,'Third-party API integration','fixed',4999,true,true,false),(p,'Content migration','fixed',4999,true,false,false)
  on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  -- Business systems: useful starting points; final scope remains negotiable.
  for s in select id from public.services where slug in ('crm','erp','pos','inventory','hrms','attendance','accounting','ai-automation','consultation','digital-marketing','seo') loop
    null;
  end loop;

  select id into s from public.services where slug='crm';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'crm-starter','CRM Starter','Lead, customer and follow-up management.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='crm-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'CRM Starter — from','fixed',49999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',9999,true,false,false),(p,'Additional integration','fixed',4999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='erp';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'erp-starter','ERP Starter','Modular business operations platform.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='erp-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'ERP Starter — from','fixed',74999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',14999,true,false,false),(p,'Additional module','fixed',9999,true,true,false),(p,'Third-party integration','fixed',7499,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='pos';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'pos-starter','POS Starter','Point-of-sale and billing solution.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='pos-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'POS Starter — from','fixed',39999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',7999,true,false,false),(p,'Additional terminal','fixed',4999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='inventory';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'inventory-starter','Inventory Starter','Inventory, stock and reporting system.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='inventory-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Inventory Starter — from','fixed',34999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',7999,true,false,false),(p,'Additional warehouse','fixed',7499,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='hrms';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'hrms-starter','HRMS Starter','Employee, leave, payroll and HR operations.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='hrms-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'HRMS Starter — from','fixed',39999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',7999,true,false,false),(p,'Payroll module','fixed',9999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='attendance';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'attendance-starter','Attendance Starter','Attendance and workforce tracking.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='attendance-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Attendance Starter — from','fixed',24999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',5999,true,false,false),(p,'Biometric/device integration','fixed',9999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='accounting';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'accounting-starter','Accounting Starter','Business accounting and finance workflow.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='accounting-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Accounting Starter — from','fixed',44999,true,true,true),(p,'Hosting & backups (1 Year)','per_year',7999,true,false,false),(p,'Integration / migration','fixed',9999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='ai-automation';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'ai-automation-starter','AI Automation Starter','Workflow automation, AI-assisted operations and integrations.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='ai-automation-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'AI Automation — from','fixed',24999,true,true,true),(p,'Hosting / runtime (1 Year)','per_year',9999,true,false,false),(p,'Additional workflow','fixed',4999,true,true,false),(p,'External API integration','fixed',4999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  -- Growth services.
  select id into s from public.services where slug='digital-marketing';
  select id into p from public.service_packages where slug='digital-marketing-base';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base)
  values(p,'Digital marketing (monthly)','per_month',7999,true,false,true),(p,'Paid ad management (monthly)','per_month',4999,true,false,false),(p,'Content creation (monthly)','per_month',3999,true,false,false),(p,'Social media handling (monthly)','per_month',2999,true,false,false),(p,'Campaign setup','fixed',2999,true,false,false)
  on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='seo';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'seo-starter','SEO Starter','Foundational SEO and monthly optimisation.',false,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='seo-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'SEO Starter (monthly)','per_month',4999,true,false,true),(p,'Local SEO setup','fixed',2999,true,false,false),(p,'Technical SEO audit','fixed',3999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  -- Hosting as a first-class service.
  select id into s from public.services where slug='hosting';
  insert into public.hosting_plans(service_id,slug,name,description,resources,active) values
    (s,'hosting-basic','Basic Hosting','For brochure sites and low-traffic websites.','{"storage":"5 GB","bandwidth":"metered","ssl":"included","backups":"weekly"}',true),
    (s,'hosting-business','Business Hosting','For growing business websites and moderate traffic.','{"storage":"15 GB","bandwidth":"metered","ssl":"included","backups":"daily","cdn":"available"}',true),
    (s,'hosting-pro','Pro Hosting','For high-traffic sites and application workloads.','{"storage":"30 GB","bandwidth":"metered","ssl":"included","backups":"daily","cdn":"included","priority_support":"included"}',true)
  on conflict(slug) do update set name=excluded.name,description=excluded.description,resources=excluded.resources,active=true,updated_at=now();
  insert into public.hosting_pricing(hosting_plan_id,billing_model,amount,visible,active)
  select id,'per_year',case slug when 'hosting-basic' then 2499 when 'hosting-business' then 4999 when 'hosting-pro' then 9999 end,true,true from public.hosting_plans where slug in ('hosting-basic','hosting-business','hosting-pro')
  on conflict(hosting_plan_id,billing_model) do update set amount=excluded.amount,visible=true,active=true;

  -- AMC / maintenance as a first-class service.
  select id into s from public.services where slug='amc';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values
    (s,'amc-basic','AMC Basic','Annual website maintenance and support.',false,10),
    (s,'amc-standard','AMC Standard','Priority maintenance, backups and minor updates.',false,20),
    (s,'amc-premium','AMC Premium','Priority support, monitoring and broader maintenance coverage.',true,30)
  on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='amc-basic';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'AMC Basic (1 Year)','per_year',5999,true,false,true),(p,'Emergency support','fixed',1999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
  select id into p from public.service_packages where slug='amc-standard';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'AMC Standard (1 Year)','per_year',11999,true,false,true),(p,'Extra content update','fixed',999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
  select id into p from public.service_packages where slug='amc-premium';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'AMC Premium (1 Year)','per_year',24999,true,true,true),(p,'Priority development hour','fixed',1499,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  -- Domain and SSL standalone services are represented as packages so they remain editable in the same Pricing tab.
  select id into s from public.services where slug='consultation';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'technical-consultation','Technical Consultation','Discovery, architecture and estimation.',false,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='technical-consultation';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Technical consultation (1 hour)','fixed',999,true,false,true),(p,'Architecture / scope workshop','fixed',2999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  -- Public visibility: the website may show starting prices for all active commercial services.
  insert into public.pricing_visibility(service_id,visible_to_public,visible_to_partners,visible_to_staff,disclaimer)
  select id,true,true,true,'Starting price shown for planning. Final quotation depends on confirmed scope, content, integrations, third-party charges and delivery requirements.'
  from public.services where active
  on conflict(service_id) do update set visible_to_public=true,updated_at=now(),disclaimer=excluded.disclaimer;
end $$;

-- Unified public feed used by the public website. Admin changes to Pricing & Knowledge flow through automatically.
create or replace view public.knowledge_public_pricing_catalog as
select s.slug as service_slug,s.name as service_name,p.slug as package_slug,p.name as package_name,
       pp.label,pp.billing_model,pp.amount,pp.currency,pp.visible,'package'::text as source_type
from public.services s
join public.service_packages p on p.service_id=s.id
join public.package_pricing pp on pp.package_id=p.id
join public.pricing_visibility pv on pv.service_id=s.id
where s.active and p.active and pp.active and pp.visible and pv.visible_to_public
  and s.archived_at is null and p.archived_at is null
  and (pp.effective_to is null or pp.effective_to>now())
union all
select s.slug,s.name,hp.slug,hp.name,
       case hppr.billing_model when 'per_year' then hp.name||' (1 Year)' else hp.name end,
       hppr.billing_model,hppr.amount,hppr.currency,hppr.visible,'hosting'::text
from public.hosting_plans hp
join public.services s on s.id=hp.service_id
join public.pricing_visibility pv on pv.service_id=s.id
join public.hosting_pricing hppr on hppr.hosting_plan_id=hp.id
where s.active and hp.active and hppr.active and hppr.visible and pv.visible_to_public;

commit;

begin;
do $$
declare s uuid; p uuid;
begin
  select id into s from public.services where slug='hosting';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values
    (s,'hosting-basic-package','Basic Hosting','Managed hosting for brochure and low-traffic websites.',false,10),
    (s,'hosting-business-package','Business Hosting','Managed hosting for growing business websites.',false,20),
    (s,'hosting-pro-package','Pro Hosting','Managed hosting for high-traffic websites and applications.',false,30)
  on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='hosting-basic-package';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Basic Hosting (1 Year)','per_year',2499,true,false,true),(p,'Migration / setup','fixed',1499,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
  select id into p from public.service_packages where slug='hosting-business-package';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Business Hosting (1 Year)','per_year',4999,true,false,true),(p,'Migration / setup','fixed',1999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
  select id into p from public.service_packages where slug='hosting-pro-package';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Pro Hosting (1 Year)','per_year',9999,true,false,true),(p,'Migration / setup','fixed',2999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
  update public.pricing_visibility set visible_to_public=true,updated_at=now() where service_id=s;
end $$;

create or replace view public.knowledge_public_pricing_catalog as
select s.slug as service_slug,s.name as service_name,p.slug as package_slug,p.name as package_name,
       pp.label,pp.billing_model,pp.amount,pp.currency,pp.visible,'package'::text as source_type
from public.services s
join public.service_packages p on p.service_id=s.id
join public.package_pricing pp on pp.package_id=p.id
join public.pricing_visibility pv on pv.service_id=s.id
where s.active and p.active and pp.active and pp.visible and pv.visible_to_public
  and s.archived_at is null and p.archived_at is null
  and (pp.effective_to is null or pp.effective_to>now());
commit;

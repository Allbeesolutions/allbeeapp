begin;
update public.package_pricing pp set active=false, visible=false, updated_at=now() from public.service_packages p join public.services s on s.id=p.service_id where pp.package_id=p.id and s.slug='website' and p.slug='website-starter' and pp.label in ('Website (starter)','E-commerce store','SEO setup','Extra pages / sections');
update public.package_pricing pp set active=false, visible=false, updated_at=now() from public.service_packages p join public.services s on s.id=p.service_id where pp.package_id=p.id and s.slug='digital-marketing' and p.slug='digital-marketing-base' and pp.label in ('Digital marketing (monthly)','Paid ad management','Content creation','Social media handling');
commit;

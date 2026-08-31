begin;
do $$
declare s uuid; p uuid;
begin
  -- Service-specific website packages with editable starting prices.
  for s in select id from public.services where slug in ('restaurant','school','hospital','portfolio','corporate','real-estate','hotel','gym','salon','ecommerce') loop
    null;
  end loop;

  select id into s from public.services where slug='ecommerce';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'ecommerce-starter','E-Commerce Starter','Online store with catalogue, checkout and order management.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='ecommerce-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'E-Commerce Starter — from','fixed',34999,true,true,true),(p,'Domain Registration (1 Year)','per_year',1299,true,false,false),(p,'Web Hosting (1 Year)','per_year',7999,true,false,false),(p,'SSL Certificate & Security','fixed',0,true,false,false),(p,'Payment gateway integration','fixed',2499,true,false,false),(p,'Product upload — 100 products','fixed',1999,true,false,false),(p,'Additional 100 products','fixed',1499,true,false,false),(p,'WhatsApp ordering','fixed',1499,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='restaurant';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'restaurant-starter','Restaurant Website','Menu, enquiry, WhatsApp and table-booking ready website.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='restaurant-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Restaurant Website — from','fixed',24999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',5999,true,false,false),(p,'Online ordering integration','fixed',4999,true,true,false),(p,'Table booking integration','fixed',2999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='school';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'school-starter','School Website','Admissions, notices, forms and information portal.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='school-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'School Website — from','fixed',34999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',6999,true,false,false),(p,'Admission enquiry forms','fixed',2999,true,false,false),(p,'Student portal integration','fixed',9999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='hospital';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'hospital-starter','Hospital Website','Healthcare website with departments, doctors and enquiries.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='hospital-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Hospital Website — from','fixed',49999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',7999,true,false,false),(p,'Appointment integration','fixed',4999,true,true,false),(p,'Doctor / department directory','fixed',4999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='portfolio';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'portfolio-starter','Portfolio Website','Personal portfolio and professional profile website.',false,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='portfolio-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Portfolio Website — from','fixed',9999,true,false,true),(p,'Domain + Hosting (1 Year)','per_year',3999,true,false,false),(p,'Extra project section','fixed',999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='corporate';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'corporate-starter','Corporate Website','Corporate website and company portal.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='corporate-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Corporate Website — from','fixed',44999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',7999,true,false,false),(p,'Advanced SEO setup','fixed',7999,true,false,false),(p,'Third-party API integration','fixed',4999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='real-estate';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'real-estate-starter','Real Estate Website','Property listings, enquiries and agent-ready website.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='real-estate-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Real Estate Website — from','fixed',34999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',6999,true,false,false),(p,'Property listing module','fixed',9999,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='hotel';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'hotel-starter','Hotel Website','Hotel website with rooms, gallery, enquiries and booking integration.',true,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='hotel-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Hotel Website — from','fixed',39999,true,true,true),(p,'Domain + Hosting (1 Year)','per_year',6999,true,false,false),(p,'Booking integration','fixed',7499,true,true,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='gym';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'gym-starter','Gym Website','Gym and fitness website with plans and enquiries.',false,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='gym-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Gym Website — from','fixed',24999,true,false,true),(p,'Domain + Hosting (1 Year)','per_year',4999,true,false,false),(p,'Membership enquiry module','fixed',2999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();

  select id into s from public.services where slug='salon';
  insert into public.service_packages(service_id,slug,name,description,custom_quote,sort_order) values(s,'salon-starter','Salon Website','Salon and appointment-focused website.',false,10) on conflict(slug) do update set service_id=excluded.service_id,name=excluded.name,description=excluded.description,updated_at=now();
  select id into p from public.service_packages where slug='salon-starter';
  insert into public.package_pricing(package_id,label,billing_model,amount,visible,negotiable,is_base) values(p,'Salon Website — from','fixed',19999,true,false,true),(p,'Domain + Hosting (1 Year)','per_year',4999,true,false,false),(p,'Appointment booking','fixed',2999,true,false,false) on conflict(package_id,label) do update set amount=excluded.amount,billing_model=excluded.billing_model,visible=true,active=true,is_base=excluded.is_base,updated_at=now();
end $$;

-- Public pricing feed now covers every active service with a public visibility rule.
update public.pricing_visibility set visible_to_public=true,updated_at=now(),disclaimer='Starting price for planning. Final quotation may vary with scope, content, integrations, third-party charges and delivery requirements.' where service_id in (select id from public.services where active);
commit;

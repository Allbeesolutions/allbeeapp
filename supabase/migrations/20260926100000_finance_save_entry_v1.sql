begin;

create table if not exists public.finance_save_requests (
  actor_id uuid not null,
  request_id uuid not null,
  payload_hash text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);
alter table public.finance_save_requests enable row level security;
revoke all on public.finance_save_requests from public, anon, authenticated;

create or replace function public.finance_save_entry_v1(
  p_entry jsonb,
  p_source_kind text default null,
  p_source_id text default null,
  p_idempotency_key uuid default null,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_hash text;
  v_request public.finance_save_requests%rowtype;
  v_id text;
  v_old public.transactions%rowtype;
  v_source_old jsonb;
  v_source_updated timestamptz;
  v_updated timestamptz;
  v_amount numeric;
  v_date date;
  v_result jsonb;
  v_action text;
  v_inserted integer;
begin
  if v_actor is null or not public.can_finance() then
    raise exception 'Finance access required.' using errcode = '42501';
  end if;
  if p_entry is null or jsonb_typeof(p_entry) <> 'object' or p_idempotency_key is null then
    raise exception 'Entry and idempotency key are required.' using errcode = '22023';
  end if;
  v_id := nullif(btrim(p_entry->>'id'), '');
  if v_id is null or length(v_id) > 128 or coalesce(p_entry->>'kind','') not in ('income', 'expense')
     or p_entry ? 'apnProjectId' and nullif(p_entry->>'apnProjectId','') is not null
     or p_entry->>'incomeSource' = 'apn' then
    raise exception 'Invalid ordinary finance entry.' using errcode = '22023';
  end if;
  if coalesce(p_entry->>'amount','') !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Invalid amount.' using errcode = '22023';
  end if;
  v_amount := (p_entry->>'amount')::numeric;
  if v_amount <= 0 or v_amount > 1000000000000 then
    raise exception 'Invalid amount.' using errcode = '22023';
  end if;
  if coalesce(p_entry->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid date.' using errcode = '22023';
  end if;
  v_date := (p_entry->>'date')::date;
  if coalesce((p_entry->>'hajiPct')::numeric,-1) not between 0 and 100
     or coalesce((p_entry->>'alimPct')::numeric,-1) not between 0 and 100
     or coalesce((p_entry->>'hajiPct')::numeric + (p_entry->>'alimPct')::numeric,-1) <> 100 then
    raise exception 'Shares must total 100.' using errcode = '22023';
  end if;
  if (p_source_kind is null) <> (p_source_id is null)
     or p_source_kind is not null and (p_source_kind not in ('student','marketing') or nullif(btrim(p_source_id),'') is null) then
    raise exception 'Invalid linked source.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_array(p_entry,p_source_kind,p_source_id,p_expected_updated_at)::text,'UTF8')),'hex');
  insert into public.finance_save_requests(actor_id,request_id,payload_hash)
    values(v_actor,p_idempotency_key,v_hash)
    on conflict do nothing;
  select * into v_request from public.finance_save_requests
    where actor_id=v_actor and request_id=p_idempotency_key for update;
  if v_request.payload_hash <> v_hash then
    raise exception 'Idempotency key reused with different content.' using errcode = '23505';
  end if;
  if v_request.result is not null then return v_request.result; end if;

  select * into v_old from public.transactions where id=v_id for update;
  if found and (p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at) then
    raise exception 'Finance entry changed; reload before saving.' using errcode = '40001';
  elsif not found and p_expected_updated_at is not null then
    raise exception 'Finance entry no longer exists.' using errcode = '40001';
  end if;
  if not public.is_superadmin() and
     (public.is_period_locked(v_date) or (v_old.id is not null and public.is_period_locked((v_old.data->>'date')::date))) then
    raise exception 'Financial period is locked.' using errcode = '42501';
  end if;

  if p_source_kind = 'student' then
    if not public.can_module('courses') then raise exception 'Courses access required.' using errcode='42501'; end if;
    select data into v_source_old from public.students where id=p_source_id for update;
    if not found then raise exception 'Linked student missing.' using errcode='23503'; end if;
  elsif p_source_kind = 'marketing' then
    if not public.can_module('marketing') then raise exception 'Marketing access required.' using errcode='42501'; end if;
    select data into v_source_old from public.marketing where id=p_source_id for update;
    if not found then raise exception 'Linked marketing row missing.' using errcode='23503'; end if;
  end if;
  v_updated := clock_timestamp();
  if v_old.id is null then
    insert into public.transactions(id,data,updated_at) values(v_id,p_entry,v_updated) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted <> 1 then raise exception 'Finance entry appeared during save; reload before saving.' using errcode='40001'; end if;
  else
    update public.transactions set data=p_entry,updated_at=v_updated where id=v_id;
  end if;
  if p_source_kind = 'student' then
    update public.students set data=jsonb_set(data,'{paymentStatus}','"Paid"'::jsonb),updated_at=v_updated
      where id=p_source_id returning updated_at into v_source_updated;
  elsif p_source_kind = 'marketing' then
    update public.marketing set data=jsonb_set(data,'{lastPaid}',to_jsonb(p_entry->>'date')),updated_at=v_updated
      where id=p_source_id returning updated_at into v_source_updated;
  end if;
  v_action := case when v_old.id is null then 'added ' else 'updated ' end || (p_entry->>'kind') || ' ' || (p_entry->>'amount');
  perform public.audit_record(jsonb_build_object('module','Accounts','action',v_action,'targetId',v_id));
  v_result := jsonb_build_object('id',v_id,'updated_at',v_updated,'source_updated_at',v_source_updated,'request_id',p_idempotency_key);
  update public.finance_save_requests set result=v_result where actor_id=v_actor and request_id=p_idempotency_key;
  return v_result;
end $$;

revoke all on function public.finance_save_entry_v1(jsonb,text,text,uuid,timestamptz) from public, anon;
grant execute on function public.finance_save_entry_v1(jsonb,text,text,uuid,timestamptz) to authenticated;
commit;
notify pgrst, 'reload schema';

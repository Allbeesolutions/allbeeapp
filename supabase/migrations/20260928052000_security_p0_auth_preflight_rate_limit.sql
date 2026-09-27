begin;
create table if not exists public.auth_preflight_rate_limits(
  bucket_key text primary key, window_started_at timestamptz not null default now(),
  hit_count integer not null default 0, updated_at timestamptz not null default now()
);
alter table public.auth_preflight_rate_limits enable row level security;
revoke all on public.auth_preflight_rate_limits from public,anon,authenticated;
create or replace function public.auth_preflight_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.auth_preflight_rate_limits%rowtype; now_at timestamptz:=clock_timestamp(); lim int:=greatest(1,least(coalesce(p_limit,10),500)); win int:=greatest(10,least(coalesce(p_window_seconds,900),86400));
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required.' using errcode='insufficient_privilege'; end if;
 if coalesce(length(p_key),0)<16 then raise exception 'Invalid rate-limit key.' using errcode='invalid_parameter_value'; end if;
 insert into public.auth_preflight_rate_limits(bucket_key,window_started_at,hit_count,updated_at) values(p_key,now_at,1,now_at)
 on conflict(bucket_key) do update set window_started_at=case when public.auth_preflight_rate_limits.window_started_at+make_interval(secs=>win)<=now_at then now_at else public.auth_preflight_rate_limits.window_started_at end,hit_count=case when public.auth_preflight_rate_limits.window_started_at+make_interval(secs=>win)<=now_at then 1 else public.auth_preflight_rate_limits.hit_count+1 end,updated_at=now_at returning * into r;
 delete from public.auth_preflight_rate_limits where updated_at<now_at-interval '2 days';
 return jsonb_build_object('allowed',r.hit_count<=lim,'remaining',greatest(0,lim-r.hit_count),'retry_after',case when r.hit_count>lim then greatest(1,ceil(extract(epoch from (r.window_started_at+make_interval(secs=>win)-now_at))))::int else 0 end);
end $$;
revoke execute on function public.auth_preflight_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.auth_preflight_rate_limit(text,integer,integer) to service_role;
commit;
notify pgrst,'reload schema';

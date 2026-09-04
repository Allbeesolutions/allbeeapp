-- Observability v3: stable grouping, severity, resolution and health rollups.
alter table public.app_error_events add column if not exists fingerprint text;
alter table public.app_error_events add column if not exists severity text not null default 'error' check(severity in ('info','warning','error','critical'));
alter table public.app_error_events add column if not exists resolved boolean not null default false;
alter table public.app_error_events add column if not exists resolved_at timestamptz;
alter table public.app_error_events add column if not exists resolved_by uuid;
update public.app_error_events set fingerprint=md5(coalesce(path,'')||'|'||coalesce(message,'')||'|'||left(coalesce(stack,''),500)) where fingerprint is null;
create or replace function public.app_error_events_normalize() returns trigger language plpgsql as $$ begin new.fingerprint=coalesce(nullif(new.fingerprint,''),md5(coalesce(new.path,'')||'|'||coalesce(new.message,'')||'|'||left(coalesce(new.stack,''),500))); return new; end $$; drop trigger if exists app_error_events_normalize on public.app_error_events; create trigger app_error_events_normalize before insert or update on public.app_error_events for each row execute function public.app_error_events_normalize();
create index if not exists app_error_events_fingerprint_idx on public.app_error_events(fingerprint,created_at desc);
create index if not exists app_error_events_severity_idx on public.app_error_events(severity,resolved,created_at desc);
create or replace function public.app_error_health()
returns jsonb language sql security definer stable set search_path=public as $$
  select jsonb_build_object('generated_at',now(),'last_24h',(select count(*) from public.app_error_events where created_at>=now()-interval '24 hours'),'unresolved',(select count(*) from public.app_error_events where not resolved),'critical',(select count(*) from public.app_error_events where severity='critical' and not resolved),'groups',(select coalesce(jsonb_agg(to_jsonb(g) order by g.event_count desc,g.last_seen desc),'[]'::jsonb) from (select fingerprint,max(message) message,max(path) path,max(severity) severity,count(*) event_count,max(created_at) last_seen,bool_and(resolved) resolved from public.app_error_events where created_at>=now()-interval '30 days' group by fingerprint limit 50) g))
$$;
revoke execute on function public.app_error_health() from public,anon; grant execute on function public.app_error_health() to authenticated;
create or replace function public.app_error_resolve(p_fingerprint text)
returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_admin() then raise exception 'Admin access required.' using errcode='insufficient_privilege'; end if; update public.app_error_events set resolved=true,resolved_at=now(),resolved_by=auth.uid() where fingerprint=p_fingerprint; end $$;
revoke execute on function public.app_error_resolve(text) from public,anon; grant execute on function public.app_error_resolve(text) to authenticated;

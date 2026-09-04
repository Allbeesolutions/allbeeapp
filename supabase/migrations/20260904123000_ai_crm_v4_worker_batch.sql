begin;
create or replace function public.ai_crm_worker_claim(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public as $$
declare out jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'Service role required.' using errcode='insufficient_privilege'; end if;
 with picked as (
  select id from public.ai_crm_actions where status='approved' and (next_retry_at is null or next_retry_at<=now())
   and (delivery_lock_until is null or delivery_lock_until<now()) order by coalesce(next_retry_at,created_at),created_at
   for update skip locked limit greatest(1,least(p_limit,50))
 ), updated as (
  update public.ai_crm_actions a set status='executing',delivery_state='executing',delivery_attempted_at=now(),delivery_lock_until=now()+interval '10 minutes',updated_at=now(),attempt_count=a.attempt_count+1
  from picked where a.id=picked.id returning a.*
 ) select coalesce(jsonb_agg(to_jsonb(updated)),'[]') into out from updated;
 return out;
end $$;
revoke execute on function public.ai_crm_worker_claim(integer) from public,anon,authenticated;
grant execute on function public.ai_crm_worker_claim(integer) to service_role;
commit;
notify pgrst,'reload schema';

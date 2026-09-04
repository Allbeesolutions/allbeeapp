begin;
create or replace function public.notification_push_claim(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; out jsonb:='[]'::jsonb;
begin
 for r in select q.id,q.notification_id,n.data,q.attempt_count from public.notification_push_queue q join public.notifications n on n.id=q.notification_id where ((q.status='queued' and q.next_attempt_at<=now()) or (q.status='sending' and q.locked_until<now())) and coalesce(n.snoozed_until,'-infinity')<=now() and q.attempt_count<5 order by q.created_at for update of q skip locked limit greatest(1,least(p_limit,100)) loop
  update public.notification_push_queue set status='sending',locked_until=now()+interval '5 minutes',attempt_count=attempt_count+1 where id=r.id;
  out:=out||jsonb_build_array(jsonb_build_object('id',r.id,'notification_id',r.notification_id,'data',r.data,'attempt',r.attempt_count+1));
 end loop; return out;
end $$;
revoke execute on function public.notification_push_claim(integer) from public,anon,authenticated;
commit;
notify pgrst,'reload schema';

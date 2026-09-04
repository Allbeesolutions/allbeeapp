begin;
create table if not exists public.notification_push_queue(
 id uuid primary key default gen_random_uuid(), notification_id text not null references public.notifications(id) on delete cascade,
 status text not null default 'queued', attempt_count integer not null default 0, next_attempt_at timestamptz not null default now(),
 locked_until timestamptz, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create unique index if not exists notification_push_queue_notification_idx on public.notification_push_queue(notification_id);
create index if not exists notification_push_queue_due_idx on public.notification_push_queue(status,next_attempt_at);
alter table public.notification_push_queue enable row level security;
revoke all on public.notification_push_queue from public,anon,authenticated;

create or replace function public.notification_queue_push() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.notification_push_queue(notification_id) values(new.id) on conflict(notification_id) do nothing; return new; end $$;
drop trigger if exists notification_push_enqueue on public.notifications;
create trigger notification_push_enqueue after insert on public.notifications for each row execute function public.notification_queue_push();
revoke execute on function public.notification_queue_push() from public,anon,authenticated;

create or replace function public.notification_snooze(p_id text,p_minutes integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare n public.notifications%rowtype; aud text;
begin
 select * into n from public.notifications where id=p_id for update;if not found then raise exception 'Notification not found.';end if;
 aud:=coalesce(n.data->>'audience','all');
 if not public.is_admin() and aud<>'all' and aud<>coalesce((select role from public.profiles where id=auth.uid()),'') and aud<>('user:'||auth.uid()::text) then raise exception 'Notification access denied.' using errcode='insufficient_privilege'; end if;
 update public.notifications set snoozed_until=now()+make_interval(mins=>greatest(1,least(p_minutes,10080))),snooze_count=coalesce(snooze_count,0)+1,updated_at=now() where id=p_id returning * into n;return to_jsonb(n);
end $$;
revoke execute on function public.notification_snooze(text,integer) from public,anon;grant execute on function public.notification_snooze(text,integer) to authenticated;

create or replace function public.notification_push_claim(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; out jsonb:='[]'::jsonb;
begin
 for r in select q.id,q.notification_id,n.data,q.attempt_count from public.notification_push_queue q join public.notifications n on n.id=q.notification_id where q.status='queued' and q.next_attempt_at<=now() and coalesce(n.snoozed_until,'-infinity')<=now() order by q.created_at for update of q skip locked limit greatest(1,least(p_limit,100)) loop
  update public.notification_push_queue set status='sending',locked_until=now()+interval '5 minutes',attempt_count=attempt_count+1 where id=r.id;
  out:=out||jsonb_build_array(jsonb_build_object('id',r.id,'notification_id',r.notification_id,'data',r.data,'attempt',r.attempt_count+1));
 end loop; return out;
end $$;
revoke execute on function public.notification_push_claim(integer) from public,anon,authenticated;

create or replace function public.notification_push_result(p_id uuid,p_status text,p_error text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_status='sent' then update public.notification_push_queue set status='sent',sent_at=now(),locked_until=null,last_error=null where id=p_id;
 elsif p_status='failed' then update public.notification_push_queue set status=case when attempt_count>=5 then 'failed' else 'queued' end,next_attempt_at=case when attempt_count>=5 then now() else now()+make_interval(mins=>least(60,power(2,attempt_count)::int)) end,locked_until=null,last_error=left(coalesce(p_error,'Push delivery failed.'),1000) where id=p_id;
 else raise exception 'Unsupported push result.'; end if;
end $$;
revoke execute on function public.notification_push_result(uuid,text,text) from public,anon,authenticated;
commit;
notify pgrst,'reload schema';

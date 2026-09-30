-- Server-authoritative ALLBEE AI authorization + chat reaction visibility hardening.
create or replace function public.ai_chat_authorized()
returns boolean language sql stable security definer set search_path='' as $$
  select case
    when auth.uid() is null then false
    when p.role = 'client' then coalesce(e.enabled,false) and coalesce(p.active,false) and coalesce(p.approved,false)
    when p.role in ('admin','superadmin','accountant','staff','employee') then coalesce(p.active,true)
    else false
  end
  from public.profiles p
  left join public.client_ai_entitlements e on e.client_id=p.id
  where p.id=auth.uid()
  limit 1
$$;
revoke all on function public.ai_chat_authorized() from public,anon;
grant execute on function public.ai_chat_authorized() to authenticated,service_role;

-- Reaction rows are readable only where the caller can read the parent chat.
alter table public.team_chat_reactions enable row level security;
drop policy if exists team_chat_reactions_sel on public.team_chat_reactions;
create policy team_chat_reactions_sel on public.team_chat_reactions for select to authenticated
using (not public.is_client() and not public.is_partner() and exists(select 1 from public.team_chat m where m.id=message_id));
grant select on public.team_chat_reactions to authenticated;

alter table public.apn_chat_reactions enable row level security;
drop policy if exists apn_chat_reactions_sel on public.apn_chat_reactions;
create policy apn_chat_reactions_sel on public.apn_chat_reactions for select to authenticated
using (exists(select 1 from public.apn_chat_messages m join public.apn_chat_participants p on p.conversation_id=m.conversation_id where m.id=message_id and p.participant_id=auth.uid()::text));
grant select on public.apn_chat_reactions to authenticated;

-- Team reaction RPCs must mirror team_chat read authorization, not merely authentication.
create or replace function public.chat_toggle_reaction(p_id text,p_emoji text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid text:=auth.uid()::text;v_emoji text:=trim(p_emoji);v_on boolean;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if public.is_client() or public.is_partner() then raise exception 'Team chat access required' using errcode='42501'; end if;
 if v_emoji not in ('👍','❤️','😂','😮','😢','🎉') then raise exception 'Unsupported reaction'; end if;
 if not exists(select 1 from public.team_chat c where c.id=p_id) then raise exception 'Message not found'; end if;
 if exists(select 1 from public.team_chat_reactions r where r.message_id=p_id and r.reactor_id=v_uid and r.emoji=v_emoji) then
   delete from public.team_chat_reactions where message_id=p_id and reactor_id=v_uid and emoji=v_emoji; v_on:=false;
 else insert into public.team_chat_reactions(message_id,reactor_id,emoji) values(p_id,v_uid,v_emoji); v_on:=true; end if;
 return jsonb_build_object('reacted',v_on);
end $$;
create or replace function public.chat_list_reactions(p_ids text[]) returns table(message_id text,emoji text,reaction_count bigint,mine boolean) language sql stable security definer set search_path='' as $$
 select r.message_id,r.emoji,count(*)::bigint,bool_or(r.reactor_id=auth.uid()::text)
 from public.team_chat_reactions r join public.team_chat m on m.id=r.message_id
 where auth.uid() is not null and not public.is_client() and not public.is_partner() and r.message_id=any(p_ids)
 group by r.message_id,r.emoji
$$;
revoke all on function public.chat_toggle_reaction(text,text),public.chat_list_reactions(text[]),public.ai_chat_authorized() from public,anon;
grant execute on function public.chat_toggle_reaction(text,text),public.chat_list_reactions(text[]),public.ai_chat_authorized() to authenticated;

-- Keep legacy browser config secret-free. Runtime provider credentials belong only in Edge Function secrets.
update public.app_config set value='{"enabled":true,"mode":"function","functionName":"ai-chat-v2","model":"openai/gpt-oss-120b","apiKey":""}' where key='ai';

-- Ensure reaction tables can drive recipient-side refreshes.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='team_chat_reactions') then alter publication supabase_realtime add table public.team_chat_reactions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='apn_chat_reactions') then alter publication supabase_realtime add table public.apn_chat_reactions; end if;
end $$;
notify pgrst,'reload schema';

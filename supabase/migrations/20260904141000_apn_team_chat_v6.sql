begin;
create or replace function public.apn_chat_search(p_conversation_id uuid,p_query text,p_limit integer default 50)
returns table(id uuid,sender_id text,sender_name text,body text,created_at timestamptz,reply_to_id uuid,mentions jsonb,attachments jsonb)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.apn_chat_participants p where p.conversation_id=p_conversation_id and (p.participant_id=auth.uid()::text or public.is_admin())) then raise exception 'Not a participant.' using errcode='P0002'; end if;
 return query select m.id,m.sender_id,m.sender_name,m.body,m.created_at,m.reply_to_id,coalesce(m.mentions,'[]'::jsonb),coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes)) from public.apn_chat_attachments a where a.message_id=m.id),'[]'::jsonb) from public.apn_chat_messages m where m.conversation_id=p_conversation_id and (nullif(trim(p_query),'') is null or m.body ilike '%'||trim(p_query)||'%' or m.sender_name ilike '%'||trim(p_query)||'%' or m.mentions::text ilike '%'||trim(p_query)||'%') order by m.created_at desc limit greatest(1,least(p_limit,100));
end $$;
revoke execute on function public.apn_chat_search(uuid,text,integer) from public,anon;grant execute on function public.apn_chat_search(uuid,text,integer) to authenticated;
commit;
notify pgrst,'reload schema';

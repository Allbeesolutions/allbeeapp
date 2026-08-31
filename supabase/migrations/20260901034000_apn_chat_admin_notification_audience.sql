begin;

-- APN chat notifications in the internal notifications center are for
-- management only. Partner recipients continue to receive apn_notifications.
create or replace function public.apn_emit_chat_notifications(
  p_conversation_id uuid, p_message_id uuid, p_sender_id text,
  p_sender_name text, p_body text
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  r record;
  v_admin_notified boolean := false;
  v_now_ms bigint := floor(extract(epoch from now()) * 1000);
  v_title text := case when coalesce(trim(p_sender_name),'') <> ''
    then p_sender_name || ' sent a new APN message' else 'New APN message' end;
  v_id uuid;
begin
  for r in select distinct p.participant_id from public.apn_chat_participants p
    where p.conversation_id=p_conversation_id and p.participant_id<>p_sender_id loop
    if exists (select 1 from public.profiles pr where pr.id::text=r.participant_id
      and pr.active=true and pr.status='active' and pr.role in ('admin','superadmin')) then
      if not v_admin_notified then
        v_id:=gen_random_uuid();
        insert into public.notifications(id,data,updated_at) values(v_id,jsonb_build_object(
          'id',v_id,'title',v_title,'body',left(coalesce(p_body,''),240),'audience','admin',
          'module','APN','priority','High','createdAt',v_now_ms,'senderName',coalesce(p_sender_name,'APN Partner'),
          'senderDesignation','APN','senderRole','APN Partner','reads','[]'::jsonb,
          'metadata',jsonb_build_object('conversationId',p_conversation_id,'messageId',p_message_id,'type','apn_chat_message')
        ),now());
        v_admin_notified:=true;
      end if;
    elsif exists (select 1 from public.apn_users u where u.id::text=r.participant_id) then
      v_id:=gen_random_uuid();
      insert into public.apn_notifications(id,data,updated_at) values(v_id,jsonb_build_object(
        'id',v_id,'title',v_title,'body',left(coalesce(p_body,''),240),
        'audience','partner:'||r.participant_id,'type','chat_message','refId',p_conversation_id::text,
        'messageId',p_message_id::text,'createdAt',v_now_ms,'updatedAt',v_now_ms,'createdBy',p_sender_name
      ),now());
    end if;
  end loop;
end;
$$;

grant execute on function public.apn_emit_chat_notifications(uuid,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;

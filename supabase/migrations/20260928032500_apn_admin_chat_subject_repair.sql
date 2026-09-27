begin;
update public.apn_chat_conversations c
set subject=coalesce(nullif(trim(u.data->>'name'),''),nullif(trim(pr.name),''),'APN Partner')
from public.apn_chat_participants pp
left join public.apn_users u on u.id::text=pp.participant_id
left join public.profiles pr on pr.id::text=pp.participant_id
where c.id=pp.conversation_id
  and c.type='person'
  and c.slug like 'admin:%'
  and pp.role='participant'
  and c.subject is distinct from coalesce(nullif(trim(u.data->>'name'),''),nullif(trim(pr.name),''),'APN Partner');
notify pgrst,'reload schema';
commit;

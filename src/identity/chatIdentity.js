const clean = value => String(value || "").trim().toLowerCase();
export const chatPersonId = person => String(person?.id || person?.contact_id || person?.client_id || person?.user_id || person?.sender_id || person?.userId || person?.senderId || "");
export function normalizeChatPerson(person = {}) {
  const p = {...(person?.data || {}), ...(person || {})};
  return {...p, id:chatPersonId(p), name:p.name || p.client_name || p.sender_name || p.userName || p.senderName || "ALLBEE member",
    photo_url:Object.hasOwn(p,"photo_url") ? p.photo_url : p.client_photo_url || p.profilePicture || p.photoUrl || p.avatar || p.senderAvatar || null,
    bio:Object.hasOwn(p,"bio") ? p.bio || "" : p.client_bio || "", role_label:p.role_label || p.designation || p.role || p.contact_type || "ALLBEE member"};
}
/** IDs always win. Name-only legacy records match only one identity, never the first duplicate. */
export function resolveChatPerson(people = [], identity = {}) {
  const fallback = normalizeChatPerson(identity), id=chatPersonId(identity);
  const rows=people.filter(Boolean).map(normalizeChatPerson);
  const exact=id ? rows.find(p=>p.id===id) : null;
  if(exact) return {...fallback,...exact};
  if(id) return fallback;
  const name=clean(fallback.name);
  const matches=rows.filter(p=>clean(p.name)===name);
  return matches.length===1 ? {...fallback,...matches[0]} : fallback;
}
export function conversationPerson(contacts = [], conversation = {}) {
  const id=conversation.participant_id || conversation.other_id || conversation.contact_id || conversation.client_id;
  if(id) return contacts.find(p=>chatPersonId(p)===String(id)) || null;
  const apn=clean(conversation.participant_apn_id || conversation.other_apn_id);
  if(apn) return contacts.find(p=>clean(p.apn_id || p.apnId)===apn) || null;
  const matches=contacts.filter(p=>clean(p.name)===clean(conversation.subject));
  return matches.length===1 ? matches[0] : null;
}
export function uniqueChatMessages(rows) {
  return [...new Map((Array.isArray(rows)?rows:[]).filter(m=>m?.id).map(m=>[m.id,m])).values()];
}

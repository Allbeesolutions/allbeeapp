/** Conversation slugs are created by the existing authorized RPCs.
 * Read only IDs already returned by apn_list_conversations; RLS remains authoritative. */
export function participantFromSlug(slug,selfId) {
 const parts=String(slug || "").split(":");
 if(parts.length!==3 || !["admin","person"].includes(parts[0]) || !parts[1] || !parts[2] || parts[1]===parts[2]) return null;
 const self=String(selfId || "").toLowerCase(),a=parts[1].toLowerCase(),b=parts[2].toLowerCase();
 return self===a ? parts[2] : self===b ? parts[1] : null;
}
export async function hydrateConversationPeople(supabase,conversations,selfId) {
 const rows=Array.isArray(conversations)?conversations:[];
 const ids=[...new Set(rows.filter(c=>c.conv_type==="person"&&!c.participant_id).map(c=>c.conversation_id || c.id).filter(Boolean))];
 const participants=new Map();
 for(let i=0;i<ids.length;i+=100) {
  const {data,error}=await supabase.from("apn_chat_conversations").select("id,slug").in("id",ids.slice(i,i+100));
  if(error) throw new Error(error.message || "Could not resolve conversation identities.");
  for(const row of data || []) {const id=participantFromSlug(row.slug,selfId);if(id)participants.set(String(row.id),id);}
 }
 return rows.map(c=>({...c,participant_id:c.participant_id || participants.get(String(c.conversation_id || c.id)) || null}));
}

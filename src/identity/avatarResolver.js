const clean = value => String(value || "").trim().toLowerCase();
const dataOf = person => ({...(person?.data || {}), ...(person || {})});
const photoOf = person => Object.hasOwn(person,"photo_url") ? person.photo_url || "" : person.photoUrl || person.profilePicture || person.avatar || "";

export function resolvePersonAvatar({people=[],apnUsers=[],publicOwners=[]}={},identity={},fallback="") {
  const id=String(identity?.id || identity?.sender_id || identity?.senderId || identity?.userId || "");
  const rows=[people,apnUsers,publicOwners].filter(Array.isArray).flat().filter(Boolean).map(dataOf);
  // An exact identity takes precedence across every source, including removed photos.
  if(id) {
    const exact=rows.find(p=>[p.id,p.user_id,p.contact_id].some(v=>v!=null&&String(v)===id));
    if(exact) return photoOf(exact);
    return fallback || identity?.senderAvatar || identity?.avatar || "";
  }
  const names=[identity?.name,identity?.senderName,identity?.by,identity?.createdBy].map(clean).filter(Boolean);
  const matches=rows.filter(p=>names.includes(clean(p.name || p.senderName)));
  const ids=new Set(matches.map(p=>String(p.id || p.user_id || p.contact_id || "")));
  if(matches.length && ids.size===1 && (matches.length===1 || !ids.has(""))) return photoOf(matches[0]);
  return fallback || identity?.senderAvatar || identity?.avatar || "";
}

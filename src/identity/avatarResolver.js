const clean = (value) => String(value || "").trim().toLowerCase();
const photoOf = (person) => person?.photo_url || person?.photoUrl || person?.profilePicture || person?.avatar || "";

export function resolvePersonAvatar({ people = [], apnUsers = [], publicOwners = [] } = {}, identity = {}, fallback = "") {
  const id = String(identity?.id || identity?.senderId || identity?.userId || "");
  const names = [identity?.name, identity?.senderName, identity?.by, identity?.createdBy].map(clean).filter(Boolean);
  const pools = [people, apnUsers, publicOwners].filter(Array.isArray);
  for (const pool of pools) {
    const match = pool.find((person) => {
      if (id && [person?.id, person?.user_id, person?.contact_id].some((value) => String(value || "") === id)) return true;
      const personName = clean(person?.name || person?.senderName);
      return personName && names.includes(personName);
    });
    const url = photoOf(match);
    if (url) return url;
  }
  return fallback || identity?.senderAvatar || identity?.avatar || "";
}

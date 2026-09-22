export const apnMe = (db, pid) => (db.apn_users || []).find((u) => u.id === pid) || null;
export const apnAvatarUrl = (partner, profile) => partner?.profilePicture || partner?.photo_url || partner?.photoUrl || profile?.photo_url || "";
export const apnUnlocked = (u) => (u && u.unlocked && typeof u.unlocked === "object" ? u.unlocked : {});
export const apnLivePartners = (db) => (db.apn_users || []).filter((u) => u.status !== "rejected");

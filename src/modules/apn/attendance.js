export const apnCheckedInToday = (db, pid, todayISO) => (db.apn_attendance || []).some((a) => a.partnerId === pid && a.date === todayISO());
export const apnAttendanceBase = (u) => Math.max(u?.lastCheckIn || 0, u?.reactivatedAt || 0, u?.approvedAt || 0, u?.createdAt || 0);
export function apnAutoInactive(u, APN_INACTIVE_DAYS) {
  if (!u || u.status !== "active") return false;
  const base = apnAttendanceBase(u);
  return !!base && (Date.now() - base) > APN_INACTIVE_DAYS * 86400000;
}
export function apnEffectiveStatus(u, APN_INACTIVE_DAYS) {
  if (!u) return "pending";
  if (u.status === "banned") return "suspended";
  if (u.status === "active" && apnAutoInactive(u, APN_INACTIVE_DAYS)) return "inactive";
  return u.status || "pending";
}
export function apnAttendanceStreak(db, pid, localISODate) {
  const days = new Set((db.apn_attendance || []).filter((a) => a.partnerId === pid).map((a) => a.date));
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const iso = localISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
    if (days.has(iso)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

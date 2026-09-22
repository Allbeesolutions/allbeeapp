export const APN_ACHIEVEMENTS = [
  { id: "first_deal", em: "🏆", label: "First Deal Closed", test: (s) => s.converted >= 1 },
  { id: "first_lakh", em: "💰", label: "First ₹1 Lakh Revenue", test: (s) => s.revenue >= 100000 },
  { id: "ten_clients", em: "🤝", label: "First 10 Clients", test: (s) => s.converted >= 10 },
  { id: "fifty_club", em: "⭐", label: "50 Projects Club", test: (s) => s.completed >= 50 },
  { id: "hundred_club", em: "👑", label: "100 Projects Club", test: (s) => s.completed >= 100 },
];

export function apnRankBy(db, pid, scope, metric, apnLivePartners, apnMe, apnPartnerStats, apnAttendanceScore, apnHealthScore) {
  let pool = apnLivePartners(db);
  const meRow = apnMe(db, pid);
  if (scope === "district" && meRow) pool = pool.filter((u) => u.district === meRow.district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : metric === "leads" ? s.submitted : metric === "conversion" ? s.conv : metric === "attendance" ? apnAttendanceScore(db, u.id, u.attendanceScore) : metric === "health" ? apnHealthScore(db, u).score : s.completed; };
  const arr = pool.map((u) => ({ id: u.id, v: val(u) })).sort((a, b) => b.v - a.v);
  const idx = arr.findIndex((x) => x.id === pid);
  return { rank: idx < 0 ? null : idx + 1, total: arr.length };
}

export function apnLeaderboard(db, scope, district, metric, apnLivePartners, apnPartnerStats, apnAttendanceScore, apnHealthScore) {
  let pool = apnLivePartners(db);
  if (scope === "district" && district) pool = pool.filter((u) => u.district === district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : metric === "leads" ? s.submitted : metric === "conversion" ? s.conv : metric === "attendance" ? apnAttendanceScore(db, u.id, u.attendanceScore) : metric === "health" ? apnHealthScore(db, u).score : s.completed; };
  return pool.map((u) => ({ u, v: val(u) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 20);
}

export function apnAchievementsFor(db, pid, apnPartnerStats, rankBy) {
  const s = apnPartnerStats(db, pid);
  const got = APN_ACHIEVEMENTS.map((a) => ({ ...a, done: a.test(s) }));
  const r = rankBy(db, pid, "district", "revenue");
  got.push({ id: "district_top", em: "🥇", label: "District Top Performer", done: r.rank === 1 && s.revenue > 0 });
  return got;
}

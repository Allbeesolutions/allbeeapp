import { APN_INACTIVE_DAYS, APN_LEAD_REJECTED, APN_SERVICES } from "./constants.js";
import { apnLeadsOf, apnPartnerStats } from "./analytics.js";
import { apnAttendanceScore, apnLastActivity, apnLastSeenAt, apnHealthBand } from "./helpers.js";

export function apnHealthScore(db, partner, profile) {
  const pid = partner?.id;
  const stats = apnPartnerStats(db, pid);
  const attendance = Math.min(100, Number(partner?.attendanceScore ?? apnAttendanceScore(db, pid)) || 0);
  const lastActivity = apnLastActivity(db, pid, partner);
  const activity = lastActivity ? Math.max(0, Math.min(100, 100 - Math.floor((Date.now() - lastActivity) / 86400000) * 5)) : 0;
  const training = APN_SERVICES.length ? Math.round((APN_SERVICES.filter(([k]) => partner?.unlocked?.[k]).length / APN_SERVICES.length) * 100) : 0;
  const quiz = APN_SERVICES.length ? Math.round((APN_SERVICES.filter(([k]) => partner?.quizPasses?.[k] != null).length / APN_SERVICES.length) * 100) : 0;
  const leadQuality = stats.submitted ? Math.round(((stats.submitted - (db.apn_leads || []).filter((l) => l.partnerId === pid && APN_LEAD_REJECTED.has(l.status)).length) / stats.submitted) * 100) : 0;
  const conversions = stats.submitted ? Math.round((stats.converted / stats.submitted) * 100) : 0;
  const activeWarnings = (db.apn_warnings || []).filter((w) => w.partnerId === pid && w.status === "Active").length;
  const warnings = Math.max(0, 100 - activeWarnings * 20);
  const login = apnLastSeenAt(partner, profile) ? Math.max(0, Math.min(100, 100 - Math.floor((Date.now() - apnLastSeenAt(partner, profile)) / 86400000) * 10)) : 0;
  const score = Math.round(attendance * .15 + activity * .15 + training * .1 + quiz * .1 + leadQuality * .15 + conversions * .2 + warnings * .05 + login * .1);
  return { score, band: apnHealthBand(score), parts: { attendance, activity, training, quiz, leadQuality, conversions, warnings, login } };
}
export function apnRecommendations(db, partner, profile) {
  const s = apnPartnerStats(db, partner.id); const health = apnHealthScore(db, partner, profile); const out = [];
  if (s.completed >= 1 && partner.role !== "district_head") out.push("This partner qualifies for promotion.");
  if (health.parts.attendance < 50) out.push("Attendance has dropped significantly.");
  if (s.commission.pending > 0 || s.commission.payable > 0) out.push("Commission payout pending.");
  if (s.conv >= 50) out.push("High conversion rate.");
  if (apnLastActivity(db, partner.id, partner) && Date.now() - apnLastActivity(db, partner.id, partner) > APN_INACTIVE_DAYS * 86400000) out.push(`No activity in ${APN_INACTIVE_DAYS} days; requires follow-up.`);
  if (partner.role !== "district_head" && s.converted >= 10) out.push("Eligible for District Head review.");
  return out;
}
export function apnRiskIndicators(db, partner, profile) {
  const s = apnPartnerStats(db, partner.id); const rejected = apnLeadsOf(db, partner.id).filter((x) => APN_LEAD_REJECTED.has(x.status)).length; const warnings = (db.apn_warnings || []).filter((x) => x.partnerId === partner.id && x.status === "Active").length; const out = [];
  if ((db.apn_warnings || []).some((x) => x.partnerId === partner.id && /complaint/i.test(x.type || "") && x.status === "Active")) out.push(["Multiple customer complaints", "neg"]);
  if (s.submitted >= 5 && rejected / s.submitted >= .35) out.push(["High rejection rate", "neg"]);
  if (!s.submitted || (apnLastActivity(db, partner.id, partner) && Date.now() - apnLastActivity(db, partner.id, partner) > APN_INACTIVE_DAYS * 86400000)) out.push(["Zero or low activity", "accent"]);
  if (apnAttendanceScore(db, partner.id, partner.attendanceScore) < 50) out.push(["Low attendance", "accent"]);
  if (warnings >= 2) out.push(["Warning accumulation", "neg"]);
  if (s.commission.pending > s.commission.earned * .75 && s.commission.pending > 0) out.push(["Commission anomaly: high pending balance", "accent"]);
  return out;
}

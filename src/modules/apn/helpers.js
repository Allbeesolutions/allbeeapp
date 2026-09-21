import { APN_COMM_REVERSED, APN_COMMISSION_RULES, APN_LEAD_REJECTED, APN_TARGET_METRICS } from "./constants.js";
import { localISODate } from "../../utils/dateFormat.js";

export const apnStatusLabel = (s) => ({ pending: "Pending", active: "Active", inactive: "Inactive", suspended: "Suspended", banned: "Banned", deleted: "Deleted", rejected: "Rejected" }[s] || s || "Pending");
export const apnStatusClass = (s) => s === "active" ? "status-active" : s === "pending" ? "status-on_leave" : s === "suspended" || s === "banned" ? "status-terminated" : s === "inactive" ? "status-inactive" : s === "deleted" ? "status-deleted" : "status-on_leave";
export const apnAdminLevel = (u, stats) => u?.level || (u?.role === "state_head" ? "State Head" : u?.role === "district_head" ? "District Head" : (stats?.level?.name || "Trainee").replace(/ Partner$/, ""));
export const apnHealthBand = (score) => score >= 95 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs Attention" : "Critical";

export const apnTargetFor = (db, pid, resetAt = 0) => [...(db.apn_targets || [])]
  .filter((t) => t.partnerId === pid && (t.createdAt || 0) > (resetAt || 0))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
export const apnAttendanceScore = (db, pid, override) => {
  if (override != null && override !== "") return Number(override) || 0;
  const rows = (db.apn_attendance || []).filter((a) => a.partnerId === pid);
  if (!rows.length) return 0;
  const recent = rows.filter((a) => (a.createdAt || Date.parse(a.date || "") || 0) >= Date.now() - 30 * 86400000);
  return Math.min(100, Math.round((recent.length / 30) * 100));
};
export const apnLastSeenAt = (partner, profile) => {
  const vals = [profile?.last_active, partner?.lastSeen, partner?.lastLogin, partner?.lastActivity, partner?.lastCheckIn];
  return Math.max(...vals.map((x) => typeof x === "number" ? x : Date.parse(x || "") || 0));
};
export const apnLastSeenLabel = (partner, profile) => {
  const ts = apnLastSeenAt(partner, profile);
  if (!ts) return "Never Logged In";
  if (profile?.last_active && Date.now() - ts <= 2 * 60 * 1000) return "Online Now";
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const days = Math.floor(mins / 1440);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};
export const apnLastActivity = (db, pid, partner) => {
  const times = [partner?.lastActivity, partner?.lastCheckIn, partner?.lastLogin, partner?.updatedAt, partner?.createdAt];
  for (const coll of ["apn_attendance", "apn_leads", "apn_quotations", "apn_commissions"]) {
    for (const row of (db[coll] || [])) if (row.partnerId === pid) times.push(row.createdAt || row.updatedAt);
  }
  return Math.max(...times.map((x) => typeof x === "number" ? x : Date.parse(x || "") || 0));
};

export const apnLevelForCompleted = (n) => apnCommissionRuleForProject((Number(n) || 0) + 1);
export const apnCommissionRuleForProject = (projectNumber) => {
  const number = Math.max(1, Number(projectNumber) || 1);
  return APN_COMMISSION_RULES.find((rule) => number >= rule.minProject && number <= rule.maxProject) || APN_COMMISSION_RULES[APN_COMMISSION_RULES.length - 1];
};
export const apnRateForPrior = (prior) => apnCommissionRuleForProject((Number(prior) || 0) + 1).rate;
export const apnNextLevel = (n) => {
  const c = Number(n) || 0;
  if (c >= 10) return null;
  const next = c < 2 ? APN_COMMISSION_RULES[1] : APN_COMMISSION_RULES[2];
  return { next, remaining: Math.max(0, next.minProject - c), pct: Math.min(100, Math.round((c / next.minProject) * 100)) };
};
export const apnLeadTone = (s) => (s === "Converted" ? "pos" : APN_LEAD_REJECTED.has(s) ? "neg" : s === "Approved" || s === "Quotation Sent" ? "pri" : "");
export const apnCommTone = (s) => (s === "Paid" ? "pos" : s === "Payable" ? "accent" : s === "Approved" ? "pri" : s === APN_COMM_REVERSED ? "neg" : "");
export function apnPayoutDate(fromISO) {
  const d = fromISO ? new Date(fromISO) : new Date();
  return localISODate(new Date(d.getFullYear(), d.getMonth() + 1, 5));
}
export const apnMetricLabel = (m) => (APN_TARGET_METRICS.find((x) => x[0] === m)?.[1]) || "Leads";

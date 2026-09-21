import { APN_GOVERNED_TARGETS_LIMIT, APN_LEAD_REJECTED } from "./constants.js";
import { localISODate } from "../../utils/dateFormat.js";
import { apnLeadsOf } from "./analytics.js";

export const apnMonthStart = (offset = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); };
export function apnZonePeriods(count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const start = apnMonthStart(i);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { key: `zone${i + 1}`, label: start.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), startAt: start.getTime(), endAt: end.getTime(), startIso: localISODate(start) };
  });
}
export const apnZonePeriodKey = (ts) => {
  const t = Number(ts) || Date.now();
  return apnZonePeriods(6).find((p) => t >= p.startAt && t <= p.endAt)?.key || "zone1";
};
export function apnCurrentZone(db) {
  const consoleRow = apnConsoleRow(db);
  const period = apnZonePeriods(6).find((p) => p.key === apnZonePeriodKey(consoleRow?.zoneStartAt || Date.now())) || apnZonePeriods(6)[0];
  return { key: period.key, label: period.label, period };
}
export const apnZoneTone = (key) => ({ zone1: "pri", zone2: "pos", zone3: "accent", zone4: "pri", zone5: "pos", zone6: "accent" }[key] || "");
// Sweep: every partner belongs to a zone; old rows without one are mapped from
// their registration month so the hub HUD is never empty.

// Hub console row: the admin-side campaign/zone settings live in a row of
// apn_admin_consoles tagged kind:"console". All hub cards read from here.
export function apnConsoleRow(db) {
  return [...(db.apn_admin_consoles || [])].filter((c) => c.kind === "console").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || {};
}
export function apnCampaignOf(db) {
  const c = apnConsoleRow(db);
  const memberCount = Number(c.apnMemberCount) || 0;
  const targetCount = Number(c.apnTargetCount) || 0;
  return {
    active: !!c.apnCampaignActive,
    memberCount,
    targetCount,
    message: c.apnCampaignMessage || `WORLDWIDE CAMPAIGN — ${memberCount} of ${targetCount} partners have joined`,
    joined: targetCount > 0 ? Math.min(100, Math.round((memberCount / targetCount) * 100)) : 0,
    under: targetCount > 0 && memberCount < targetCount,
  };
}
// One active admin-assigned target at a time per partner (the govern limit);
// anything the partner creates themselves does not count against them.

export function apnGovernedTargets(db, pid) {
  return (db.apn_targets || []).filter((t) => t.partnerId === pid && !t.selfCreated);
}
export function apnGovernedLimit(db, pid) {
  const targets = apnGovernedTargets(db, pid);
  return { count: targets.length, limit: APN_GOVERNED_TARGETS_LIMIT, full: targets.length >= APN_GOVERNED_TARGETS_LIMIT };
}
export function apnCalculatedGovernedExplanation(db, pid) {
  const g = apnGovernedLimit(db, pid);
  if (!g.count) return "No admin-assigned targets right now — your targets are your own.";
  if (g.full) return `You currently have ${g.count} admin-assigned target${g.count === 1 ? "" : "s"} (limit ${g.limit}). Acknowledge it on the Targets tab to clear the counter.`;
  return `You have ${g.count} admin-assigned target${g.count === 1 ? "" : "s"} of ${g.limit} allowed.`;
}
// Express tie-ups: submitting a lead/quote can mark a tie-up with the client.
// When the client also works with us on the other side of the deal the tie is
// reciprocal — both parties are governed by the same relationship.

export function apnReciprocal(db, meRow) {
  const mine = apnLeadsOf(db, meRow?.id).filter((l) => l.tieUp);
  if (!mine.length) return { any: false, count: 0 };
  const clients = new Set(mine.map((l) => String(l.mobile || "").replace(/\D/g, "")));
  let count = 0;
  for (const l of (db.apn_leads || [])) {
    if (!String(l.mobile || "").replace(/\D/g, "") || clients.has(String(l.mobile || "").replace(/\D/g, ""))) continue;
    if (mine.some((m) => String(m.mobile || "").replace(/\D/g, "") === String(l.mobile || "").replace(/\D/g, "") && l.partnerId !== meRow?.id)) count += 1;
  }
  return { any: count > 0, count };
}
// Express form rules: which fields a form surfaces depends on the chosen
// service (kept in one place so all three forms agree).
export function apnFormRules(service) {
  switch (service) {
    case "website": return { showBusiness: true, showBudget: true, showCollege: false, showTieUps: true };
    case "marketing": return { showBusiness: true, showBudget: true, showCollege: false, showTieUps: true };
    case "course": return { showBusiness: false, showBudget: false, showCollege: true, showTieUps: true };
    default: return { showBusiness: true, showBudget: false, showCollege: true, showTieUps: true };
  }
}


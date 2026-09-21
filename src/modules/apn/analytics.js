import { APN_COMM_REVERSED, APN_COMMISSION_RULES } from "./constants.js";
import { round2 } from "../../utils/dateFormat.js";

export const apnLeadsOf = (db, pid) => (db.apn_leads || []).filter((l) => l.partnerId === pid);
export const apnCommsOf = (db, pid) => (db.apn_commissions || []).filter((c) => c.partnerId === pid);
export const apnCommissionProjectsOf = (db, pid) => (db.apn_commission_projects || []).filter((p) => !pid || p.partnerId === pid);
export const apnRevenueCollectionsOf = (db, projectId) => (db.apn_revenue_collections || []).filter((c) => c.projectId === projectId);
export function apnProjectStatus(project, received) {
  if (project?.status === "Cancelled") return "Cancelled";
  const value = Number(project?.projectValue) || 0;
  if (!received) return "Pending";
  return value > 0 && received >= value ? "Completed" : "Processing";
}
export function apnProjectSummary(db, project) {
  const collections = apnRevenueCollectionsOf(db, project.id).slice().sort((a, b) => (a.receivedDate || a.createdAt || "").localeCompare(b.receivedDate || b.createdAt || ""));
  const projectValue = Math.max(0, Number(project.projectValue) || 0);
  const rate = Math.max(0, Math.min(100, Number(project.commissionRate) || 0));
  const maximumCommission = Math.max(0, Number(project.maximumCommission) || round2((projectValue * rate) / 100));
  const totalReceived = round2(collections.reduce((sum, row) => sum + Math.max(0, Number(row.receivedAmount) || 0), 0));
  const commissionEarned = round2(Math.min(maximumCommission, collections.reduce((sum, row) => sum + Math.max(0, Number(row.commissionGenerated) || 0), 0)));
  const totalIncentives = round2(collections.reduce((sum, row) => sum + Math.max(0, Number(row.incentive) || 0), 0));
  const totalCommissionPaid = round2(Math.max(Number(project.totalCommissionPaid) || 0, collections.filter((row) => row.commissionStatus === "Paid").reduce((sum, row) => sum + (Number(row.commissionGenerated) || 0), 0)));
  const remainingAmount = round2(Math.max(0, projectValue - totalReceived));
  const remainingCommission = round2(Math.max(0, maximumCommission - commissionEarned));
  return { ...project, projectValue, commissionRate: rate, maximumCommission, collections, totalReceived, commissionEarned, totalCommissionPaid, totalIncentives, remainingAmount, remainingCommission, status: apnProjectStatus(project, totalReceived) };
}
// Canonical finance↔APN acknowledgement state for a project: the posted
// income receipt and its auto-generated commission expense (if any).
export function apnFinancePostedFor(db, projectId) {
  const posted = (db.transactions || []).find((t) => t.kind === "income" && t.apnProjectId === projectId);
  const expense = (db.transactions || []).find((t) => t.apnCommissionExpense && t.apnProjectId === projectId);
  return { posted, expense };
}
export function apnCommissionDashboardSummary(db) {
  const projects = apnCommissionProjectsOf(db).map((project) => apnProjectSummary(db, project));
  const collections = db.apn_revenue_collections || [];
  return {
    totalValue: round2(projects.reduce((sum, project) => sum + project.projectValue, 0)),
    totalReceived: round2(projects.reduce((sum, project) => sum + project.totalReceived, 0)),
    outstanding: round2(projects.reduce((sum, project) => sum + project.remainingAmount, 0)),
    commissionPaid: round2(projects.reduce((sum, project) => sum + project.totalCommissionPaid, 0)),
    pendingCommission: round2(projects.reduce((sum, project) => sum + project.remainingCommission, 0)),
    processingProjects: projects.filter((project) => project.status === "Processing").length,
    completedProjects: projects.filter((project) => project.status === "Completed").length,
    projects: projects.length,
    collections: collections.length,
  };
}
export const apnCommissionRuleForProject = (projectNumber) => {
  const number = Math.max(1, Number(projectNumber) || 1);
  return APN_COMMISSION_RULES.find((rule) => number >= rule.minProject && number <= rule.maxProject) || APN_COMMISSION_RULES[APN_COMMISSION_RULES.length - 1];
};
const apnLevelForCompleted = (n) => apnCommissionRuleForProject((Number(n) || 0) + 1);

export const apnMonthKey = (date) => { const d = date instanceof Date ? date : new Date(date || 0); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export function apnMonthlyAnalytics(db, pid, count = 6) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - i - 1), 1);
    return { key: apnMonthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), leads: 0, revenue: 0, commission: 0, attendance: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  apnLeadsOf(db, pid).forEach((l) => { const row = byKey.get(apnMonthKey(l.createdAt)); if (row) { row.leads += 1; if (l.status === "Converted") row.revenue += Number(l.revenue) || 0; } });
  apnCommsOf(db, pid).forEach((c) => { const row = byKey.get(apnMonthKey(c.createdAt || c.paidAt)); if (row) { row.commission += Number(c.amount) || 0; if (c.source === "manual") { row.leads += 1; row.revenue += Number(c.revenue) || 0; } } });
  apnCommissionProjectsOf(db, pid).forEach((project) => apnRevenueCollectionsOf(db, project.id).forEach((collection) => { const row = byKey.get(apnMonthKey(collection.receivedDate || collection.createdAt)); if (row) { row.commission += Number(collection.commissionGenerated) || 0; row.revenue += Number(collection.receivedAmount) || 0; } }));
  (db.apn_attendance || []).filter((a) => a.partnerId === pid).forEach((a) => { const row = byKey.get(apnMonthKey(a.createdAt || a.at || a.date)); if (row) row.attendance += 1; });
  return months.map((m) => ({ ...m, revenue: round2(m.revenue), commission: round2(m.commission), attendance: Math.min(100, Math.round((m.attendance / new Date(Number(m.key.slice(0, 4)), Number(m.key.slice(5)) || 1, 0).getDate()) * 100)) }));
}

export function apnMilestones(db, partner) {
  const s = apnPartnerStats(db, partner.id);
  const leads = apnLeadsOf(db, partner.id).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const converted = leads.filter((x) => x.status === "Converted");
  const first = (id, label, done, at) => ({ id, label, done, at: at || null });
  const out = [
    first("first-lead", "First Lead", leads.length > 0, leads[0]?.createdAt),
    first("first-client", "First Client", converted.length > 0, converted[0]?.updatedAt || converted[0]?.createdAt),
  ];
  [10000, 50000, 100000].forEach((value) => out.push(first(`revenue-${value}`, `₹${value.toLocaleString("en-IN")} Revenue`, s.revenue >= value, leads.find((x) => x.status === "Converted" && Number(x.revenue) >= value)?.createdAt)));
  [10, 50, 100].forEach((value) => out.push(first(`clients-${value}`, `${value} Clients`, s.converted >= value, converted[value - 1]?.updatedAt || converted[value - 1]?.createdAt)));
  out.push(first("district-head", "District Head Promotion", partner.role === "district_head" || partner.level === "District Head", partner.promotedAt));
  return out;
}

export function apnPartnerStats(db, pid) {
  const leads = apnLeadsOf(db, pid);
  const submitted = leads.length;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const manual = apnCommsOf(db, pid).filter((c) => c.kind !== "district" && c.source === "manual" && c.status !== APN_COMM_REVERSED);
  const completed = leads.filter((l) => l.projectCompleted).length + manual.length;
  const projectSummaries = apnCommissionProjectsOf(db, pid).map((project) => apnProjectSummary(db, project));
  const activeProjectSummaries = projectSummaries.filter((project) => project.status !== "Cancelled");
  const revenue = round2(leads.filter((l) => l.status === "Converted").reduce((s, l) => s + (Number(l.revenue) || 0), 0) + manual.reduce((s, c) => s + (Number(c.revenue) || 0), 0) + activeProjectSummaries.reduce((s, project) => s + project.totalReceived, 0));
  const conv = submitted ? Math.round((converted / submitted) * 100) : 0;
  const own = apnCommsOf(db, pid).filter((c) => c.kind !== "district" && c.status !== APN_COMM_REVERSED);
  const sumBy = (st) => round2(own.filter((c) => c.status === st).reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const projectEarned = round2(activeProjectSummaries.reduce((s, project) => s + project.commissionEarned, 0));
  const projectPaid = round2(activeProjectSummaries.reduce((s, project) => s + project.totalCommissionPaid, 0));
  const earned = round2(own.reduce((s, c) => s + (Number(c.amount) || 0), 0) + projectEarned);
  return {
    submitted, converted, completed: completed + activeProjectSummaries.filter((project) => project.status === "Completed").length, revenue, conv, level: apnLevelForCompleted(completed + activeProjectSummaries.filter((project) => project.status === "Completed").length),
    projects: activeProjectSummaries.length, completedProjects: activeProjectSummaries.filter((project) => project.status === "Completed").length, processingProjects: activeProjectSummaries.filter((project) => project.status === "Processing").length, collectionsReceived: activeProjectSummaries.reduce((s, project) => s + project.collections.length, 0), totalIncentives: round2(activeProjectSummaries.reduce((s, project) => s + project.totalIncentives, 0)),
    commission: { earned, pending: round2(sumBy("Pending") + activeProjectSummaries.reduce((s, project) => s + project.remainingCommission, 0)), approved: sumBy("Approved"), payable: sumBy("Payable"), paid: round2(sumBy("Paid") + projectPaid) },
    districtEarned: round2(apnCommsOf(db, pid).filter((c) => c.kind === "district" && c.status !== APN_COMM_REVERSED).reduce((s, c) => s + (Number(c.amount) || 0), 0)),
  };
}

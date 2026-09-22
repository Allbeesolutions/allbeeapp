import { APN_COMM_REVERSED, APN_SERVICES } from "./constants.js";
import { round2, money } from "../../utils/dateFormat.js";
import { apnCommissionRuleForProject, apnLevelForCompleted } from "./helpers.js";

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
export const apnTimelineEntry = (partnerId, eventType, title, description, performedBy = "System", performedById = null, at = Date.now()) => ({ id: `apn-timeline:${partnerId}:${eventType}`, partnerId, eventType, title, description, performedBy, performedById, createdAt: at });
export function apnTargetProgress(db, t) {
  const leads = apnLeadsOf(db, t.partnerId).filter((l) => (l.createdAt || 0) >= (t.createdAt || 0));
  const metric = t.metric || "leads";
  let raw;
  if (metric === "leads") raw = leads.length;
  else if (metric === "conversions") raw = leads.filter((l) => l.status === "Converted").length;
  else raw = leads.filter((l) => l.status === "Converted" && l.service === metric).length;
  const goal = Number(t.goal) || 0;
  return { raw, count: goal ? Math.min(raw, goal) : raw, goal, pct: goal ? Math.min(100, Math.round((raw / goal) * 100)) : 0 };
}
export function apnDerivedTimeline(db, partner) {
  const pid = partner.id, out = [];
  if (partner.createdAt) out.push(apnTimelineEntry(pid, "registered", "Partner Registered", `${partner.name} joined the APN network.`, "System", null, partner.createdAt));
  if (partner.approvedAt) out.push(apnTimelineEntry(pid, "approved", "Approved by Super Admin", "The APN application was approved.", partner.approvedBy || "Super Admin", null, partner.approvedAt));
  if (partner.district && (partner.districtAssignedAt || partner.createdAt)) out.push(apnTimelineEntry(pid, "district-assigned", "District Assigned", `Assigned to ${partner.district}.`, partner.districtAssignedBy || "System", null, partner.districtAssignedAt || partner.createdAt));
  (db.apn_transfer_history || []).filter((x) => x.partnerId === pid).forEach((x) => out.push(apnTimelineEntry(pid, `district-changed:${x.id}`, "District Changed", `${x.previousDistrict || "Unassigned"} → ${x.newDistrict || "Unassigned"}${x.reason ? ` · ${x.reason}` : ""}.`, x.changedBy || "System", null, x.effectiveDate || x.createdAt)));
  const leads = apnLeadsOf(db, pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const quotes = (db.apn_quotations || []).filter((x) => x.partnerId === pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const converted = leads.find((x) => x.status === "Converted");
  const commission = apnCommsOf(db, pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (Object.keys(partner.quizPasses || {}).length) out.push(apnTimelineEntry(pid, "quiz-completed", "Quiz Completed", "A partner quiz was completed.", "System", null, partner.quizCompletedAt || partner.updatedAt || partner.createdAt));
  if (APN_SERVICES.every(([k]) => partner.unlocked?.[k])) out.push(apnTimelineEntry(pid, "training-completed", "Training Completed", "All APN training categories are complete.", "System", null, partner.trainingCompletedAt || partner.updatedAt || partner.createdAt));
  if (leads[0]) out.push(apnTimelineEntry(pid, "first-lead", "First Lead Submitted", `First lead submitted for ${leads[0].clientName || "a client"}.`, "System", null, leads[0].createdAt));
  if (quotes[0]) out.push(apnTimelineEntry(pid, "first-quotation", "First Quotation Generated", `First quotation generated for ${quotes[0].clientName || "a client"}.`, "System", null, quotes[0].createdAt));
  if (converted) out.push(apnTimelineEntry(pid, "first-conversion", "First Client Converted", `First client converted: ${converted.clientName || "client"}.`, "System", null, converted.updatedAt || converted.createdAt));
  if (commission[0]) out.push(apnTimelineEntry(pid, "first-commission", "First Commission Earned", `First commission recorded: ${money(commission[0].amount)}.`, "System", null, commission[0].createdAt));
  const paid = commission.find((x) => x.status === "Paid");
  if (paid) out.push(apnTimelineEntry(pid, "commission-paid", "Commission Paid", `${money(paid.amount)} commission was paid.`, "System", null, paid.paidAt || paid.updatedAt || paid.createdAt));
  apnCommissionProjectsOf(db, pid).forEach((project) => {
    out.push(apnTimelineEntry(pid, `commission-project:${project.id}`, "Commission Project Created", `${project.projectName || project.project || "Project"} · ${money(project.projectValue)} at ${project.commissionRate || project.rate || 0}%.`, project.createdBy || "Admin", null, project.createdAt));
    apnRevenueCollectionsOf(db, project.id).forEach((collection) => out.push(apnTimelineEntry(pid, `revenue-collection:${collection.id}`, "Revenue Collection Added", `Received ${money(collection.receivedAmount)} · commission credited ${money(collection.commissionGenerated)}${Number(collection.incentive) ? ` · incentive ${money(collection.incentive)}` : ""}.`, collection.createdBy || "Admin", null, collection.createdAt || collection.receivedDate)));
    const summary = apnProjectSummary(db, project);
    if (summary.status === "Completed") out.push(apnTimelineEntry(pid, `commission-completed:${project.id}`, "Project Completed", `Total commission ${money(summary.commissionEarned)}.`, "System", null, project.updatedAt || project.createdAt));
  });
  if (partner.promotedAt) out.push(apnTimelineEntry(pid, "promoted", "Promoted", "Partner was promoted to District Head.", partner.promotedBy || "Super Admin", null, partner.promotedAt));
  if (partner.demotedAt) out.push(apnTimelineEntry(pid, "demoted", "Demoted", "Partner level or hierarchy was changed.", partner.demotedBy || "Super Admin", null, partner.demotedAt));
  if (partner.suspendedAt) out.push(apnTimelineEntry(pid, "suspended", "Suspended", partner.suspensionReason || "Partner account suspended.", partner.suspendedBy || "Super Admin", null, partner.suspendedAt));
  if (partner.reactivatedAt) out.push(apnTimelineEntry(pid, "reactivated", "Reactivated", partner.reactivationReason || "Partner account reactivated.", partner.reactivatedBy || "Super Admin", null, partner.reactivatedAt));
  if (partner.deletedAt) out.push(apnTimelineEntry(pid, "deleted", "Deleted (Archived)", partner.deleteReason || "Partner account archived.", partner.deletedBy || "Super Admin", null, partner.deletedAt));
  return out;
}
export function apnActivityHistory(db, partner, profile) {
  const pid = partner.id, rows = [];
  const add = (id, ts, eventType, title, description, user = "System") => { if (ts) rows.push({ id: `activity:${id}`, ts: typeof ts === "number" ? ts : Date.parse(ts) || 0, eventType, title, description, user }); };
  (db.apn_activity || []).filter((x) => x.partnerId === pid).forEach((x) => add(x.id, x.createdAt || x.ts, x.eventType || "activity", x.title || "Activity", x.description || "", x.performedBy || x.user || "System"));
  apnDerivedTimeline(db, partner).forEach((x) => add(x.id, x.createdAt, x.eventType, x.title, x.description, x.performedBy));
  (db.apn_timeline || []).filter((x) => x.partnerId === pid).forEach((x) => add(x.id, x.createdAt, x.eventType || "timeline", x.title, x.description, x.performedBy));
  apnLeadsOf(db, pid).forEach((x) => { add(`lead-created:${x.id}`, x.createdAt, "lead", "Lead Created", x.clientName || "Lead submitted", x.createdBy || "System"); if (x.updatedAt && x.updatedAt !== x.createdAt) add(`lead-updated:${x.id}`, x.updatedAt, "lead", "Lead Updated", `${x.clientName || "Lead"} · ${x.status || "updated"}`, x.updatedBy || "System"); });
  (db.apn_quotations || []).filter((x) => x.partnerId === pid).forEach((x) => add(`quotation:${x.id}`, x.createdAt, "quotation", "Quotation Generated", x.clientName || x.project || "Quotation", x.createdBy || "System"));
  apnCommsOf(db, pid).forEach((x) => add(`commission:${x.id}`, x.createdAt, "commission", `Commission ${x.status || "recorded"}`, `${money(x.amount)} · ${x.project || "Project"}`, x.updatedBy || "System"));
  apnCommissionProjectsOf(db, pid).forEach((project) => { add(`commission-project:${project.id}`, project.createdAt, "commission-project", "Commission Project Created", `${project.projectName || project.project || "Project"} · ${money(project.projectValue)}`, project.createdBy || "Admin"); apnRevenueCollectionsOf(db, project.id).forEach((collection) => add(`revenue-collection:${collection.id}`, collection.createdAt || collection.receivedDate, "revenue-collection", "Revenue Collection Added", `Received ${money(collection.receivedAmount)} · commission credited ${money(collection.commissionGenerated)}${Number(collection.incentive) ? ` · incentive ${money(collection.incentive)}` : ""}`, collection.createdBy || "Admin")); if (apnProjectSummary(db, project).status === "Completed") add(`commission-project-completed:${project.id}`, project.updatedAt || project.createdAt, "project-completed", "Project Completed", `Total commission ${money(apnProjectSummary(db, project).commissionEarned)}.`, "System"); });
  if (Object.keys(partner.unlocked || {}).length) add("training-started", partner.trainingStartedAt || partner.updatedAt, "training", "Training Started", "Partner training activity began.", "System");
  (db.apn_targets || []).filter((x) => x.partnerId === pid).forEach((x) => { const progress = apnTargetProgress(db, x); if (progress.goal && progress.raw >= progress.goal) add(`target-achieved:${x.id}`, x.achievedAt || x.updatedAt || x.createdAt, "target", "Target Achieved", x.title || "Target completed", "System"); });
  (db.apn_attendance || []).filter((x) => x.partnerId === pid).forEach((x) => add(`attendance:${x.id}`, x.createdAt || x.at, "attendance", "Attendance Check-in", x.date || "Partner checked in", x.createdBy || "System"));
  (db.apn_communications || []).filter((x) => x.partnerId === pid).forEach((x) => add(`communication:${x.id}`, x.createdAt, "communication", `${x.type || "Communication"} · ${x.status || "Logged"}`, x.subject || x.message || "", x.sender || "Admin"));
  (db.apn_notifications || []).filter((x) => x.audience === `partner:${pid}`).forEach((x) => add(`notification:${x.id}`, x.createdAt, "notification", "Notification", x.title || x.body || "", x.createdBy || "Admin"));
  (db.audit || []).filter((x) => x.module === "APN" && x.partnerId === pid).forEach((x) => add(`audit:${x.id}`, x.ts, "admin", "Administrative Action", x.action, x.user || "Admin"));
  if (partner.lastLogin || profile?.last_login) add("login", partner.lastLogin || profile.last_login, "login", "Login", "Partner signed in.", partner.name);
  if (partner.lastLogout) add("logout", partner.lastLogout, "logout", "Logout", "Partner signed out.", partner.name);
  return rows.filter((x) => x.ts).sort((a, b) => b.ts - a.ts);
}

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

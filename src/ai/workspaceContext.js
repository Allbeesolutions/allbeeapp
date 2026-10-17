import { maskEmail, maskPhone, scrubText } from "../utils/aiText.jsx";
import { money } from "../utils/dateFormat.js";

export function buildAIContext(db, company, assigneeText = () => "—") {
  db = db && typeof db === "object" && !Array.isArray(db) ? db : {};
  const cap = (arr, n) => (Array.isArray(arr) ? arr.slice(-n).filter((row) => row && typeof row === "object").reverse() : []);
  const co = company || {};
  const L = [];
  L.push(`COMPANY: ${co.name || "ALLBEE Solutions"}${co.email ? " · " + co.email : ""}${co.phone ? " · " + co.phone : ""}${co.website ? " · " + co.website : ""}`);
  if (co.address) L.push(`ADDRESS: ${co.address}`);

  const clients = cap(db.clients, 40);
  if (clients.length) {
    L.push(`\nCLIENTS (${db.clients.length} total, newest first):`);
    clients.forEach((c) => L.push(`- ${c.name}${c.company ? " (" + c.company + ")" : ""} · ${c.status || "—"}${c.phone ? " · " + maskPhone(c.phone) : ""}${c.email ? " · " + maskEmail(c.email) : ""}${c.value ? " · deal " + money(c.value) : ""}${c.notes ? " · " + scrubText(String(c.notes)).slice(0, 80) : ""}`));
  }
  const leads = cap(db.leads, 40);
  if (leads.length) {
    L.push(`\nLEADS (${db.leads.length}):`);
    leads.forEach((x) => L.push(`- ${x.name}${x.company ? " (" + x.company + ")" : ""} · service ${x.service || "—"} · stage ${x.stage || "—"}${x.value ? " · est " + money(x.value) : ""}${x.leadOwner ? " · owner " + x.leadOwner : ""}${x.phone ? " · " + maskPhone(x.phone) : ""}${x.notes ? " · " + scrubText(String(x.notes)).slice(0, 80) : ""}`));
  }
  const quotes = cap(db.quotations, 30);
  if (quotes.length) {
    L.push(`\nQUOTATIONS (${db.quotations.length}):`);
    quotes.forEach((q) => {
      const items = (Array.isArray(q.items) ? q.items : []).map((it) => `${scrubText(it.desc || "item").slice(0, 60)} x${it.qty || 1} @ ${money(it.rate || 0)}`).join("; ");
      L.push(`- ${q.client || "—"}${q.title ? " · " + q.title : ""} · ${q.status || "Draft"} · total ${money(q.total || 0)}${items ? " · items: " + items.slice(0, 180) : ""}`);
    });
  }
  const inv = cap(db.invoices, 30);
  if (inv.length) {
    L.push(`\nINVOICES (${db.invoices.length}):`);
    inv.forEach((i) => L.push(`- ${i.number || ""} ${i.client || "—"}${i.title ? " · " + i.title : ""} · ${i.status || "Draft"} · ${money(i.amount || 0)}${i.dueDate ? " · due " + i.dueDate : ""}`));
  }
  const portalUpdates = cap(db.portal_posts, 30);
  if (portalUpdates.length) {
    L.push(`\nCLIENT PORTAL UPDATES (${db.portal_posts.length}):`);
    portalUpdates.forEach((x) => L.push(`- ${scrubText(x.title || "Update").slice(0, 100)} · ${x.status || x.kind || "update"}${x.body ? " · " + scrubText(String(x.body)).slice(0, 180) : ""}`));
  }
  const sharedDocs = cap(db.documents, 30);
  if (sharedDocs.length) {
    L.push(`\nSHARED FILES (${db.documents.length}):`);
    sharedDocs.forEach((d) => L.push(`- ${scrubText(d.title || "File").slice(0, 100)}${d.category ? " · " + scrubText(d.category).slice(0, 60) : ""}${d.notes ? " · " + scrubText(String(d.notes)).slice(0, 120) : ""}`));
  }
  const proj = cap(db.projects, 40);
  if (proj.length) {
    L.push(`\nPROJECTS (${db.projects.length}):`);
    proj.forEach((p) => L.push(`- ${p.name}${p.client ? " for " + p.client : ""} · ${p.type || "—"} · ${p.stage || "—"}${p.cost ? " · " + money(p.cost) : ""}${p.expected ? " · due " + p.expected : ""}`));
  }
  const openTasks = (Array.isArray(db.tasks) ? db.tasks : []).filter((t) => t && typeof t === "object" && t.status !== "Completed");
  const tks = cap(openTasks, 40);
  if (tks.length) {
    L.push(`\nOPEN TASKS (${openTasks.length}):`);
    tks.forEach((t) => L.push(`- ${t.title} · ${assigneeText(t)} · ${t.status}${t.priority ? " · " + t.priority : ""}${t.due ? " · due " + t.due : ""}`));
  }
  const cs = cap(db.class_students, 30);
  if (cs.length) {
    L.push(`\nCLASS STUDENTS (${db.class_students.length}):`);
    cs.forEach((s) => L.push(`- ${s.name}${s.course ? " · " + s.course : ""}${s.mode ? " · " + s.mode : ""}${s.fee ? " · fee " + money(s.fee) : ""}${s.paymentStatus ? " · " + s.paymentStatus : ""}`));
  }
  const counts = [];
  if (db.students?.length) counts.push(`course students ${db.students.length}`);
  if (db.marketing?.length) counts.push(`marketing clients ${db.marketing.length}`);
  if (db.concepts?.length) counts.push(`concepts/ideas ${db.concepts.length}`);
  if (db.inhouse?.length) counts.push(`in-house projects ${db.inhouse.length}`);
  if (db.planned?.length) counts.push(`planned expenses ${db.planned.length}`);
  if (counts.length) L.push(`\nOTHER COUNTS: ${counts.join(" · ")}`);
  const apn = cap(db.apn_users, 60);
  if (apn.length) {
    L.push(`\nAPN PARTNER NETWORK (${db.apn_users.length} total):`);
    apn.forEach((a) => L.push(`- ${a.name || a.username || "Partner"} · ${a.apnId || a.apn_id || "—"} · ${a.level || "—"} · ${a.status || "—"}${a.district ? " · district " + a.district : ""}${a.state ? " · state " + a.state : ""}${a.commissionRate != null ? " · commission " + a.commissionRate + "%" : ""}`));
  }
  const tx = cap(db.transactions, 50);
  if (tx.length) {
    L.push(`\nFINANCE TRANSACTIONS (${db.transactions.length} total, newest first):`);
    tx.forEach((x) => L.push(`- ${x.date || x.ts || "—"} · ${x.type || x.category || "transaction"} · ${x.description || x.client || "—"} · ${money(x.amount || x.value || 0)} · ${x.status || "—"}`));
  }
  const withdrawals = cap(db.withdrawals, 30);
  if (withdrawals.length) {
    L.push(`\nWITHDRAWALS (${db.withdrawals.length} total):`);
    withdrawals.forEach((w) => L.push(`- ${w.userName || w.user || "—"} · ${money(w.amount || 0)} · ${w.status || "—"} · ${w.requestedAt || w.date || "—"}`));
  }
  const audit = cap(db.audit, 50);
  if (audit.length) {
    L.push(`\nRECENT AUDIT ACTIVITY (${db.audit.length} total):`);
    audit.forEach((a) => L.push(`- ${a.ts ? new Date(a.ts).toLocaleString("en-IN") : "—"} · ${a.user || "System"} · ${a.module || "—"} · ${a.action || "—"} · ${scrubText(a.description || "")}`));
  }
  const genericModules = [
    ["tasks", "Tasks"], ["attendance", "Attendance"], ["leave", "Leave"], ["updates", "Daily updates"],
    ["team_chat", "Team chat"], ["projects", "Projects"], ["inhouse", "In-house projects"], ["marketing", "Marketing"],
    ["students", "Course students"], ["class_students", "Class students"], ["concepts", "Ideas"], ["notifications", "Notifications"],
    ["agreements", "Agreements"], ["materials", "Materials"], ["targets", "Targets"], ["rewards", "Rewards"],
  ];
  const moduleCounts = genericModules.filter(([k]) => Array.isArray(db[k])).map(([k, label]) => `${label}: ${db[k].length}`);
  if (moduleCounts.length) L.push(`\nMODULE COUNTS: ${moduleCounts.join(" · ")}`);
  L.push(`\nNOTE: Client/lead phone numbers and emails in this snapshot are masked; free-text notes and item descriptions are scrubbed for contact details. Ask the user for a full contact when one is needed.`);

  let out = L.join("\n");
  if (out.length > 12000) out = out.slice(0, 12000) + "\n…(snapshot truncated)";
  return out;
}

export function apnBuildCommissions(d, lead, apnPartnerStats, apnRateForPrior, apnPayoutDate, uid, round2) {
  const rows = [];
  const pid = lead.partnerId;
  const prior = apnPartnerStats({ ...d, apn_leads: (d.apn_leads || []).filter((row) => row.id !== lead.id) }, pid).completed;
  const rate = apnRateForPrior(prior);
  const revenue = Number(lead.revenue) || 0;
  const project = lead.business || lead.clientName || "Project";
  rows.push({ id: uid(), partnerId: pid, kind: "partner", leadId: lead.id, project, clientName: lead.clientName, service: lead.service, revenue, rate, amount: round2((revenue * rate) / 100), status: "Pending", createdAt: Date.now(), payoutDate: apnPayoutDate() });
  return rows;
}

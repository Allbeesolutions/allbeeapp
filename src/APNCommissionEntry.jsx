import React, { useState } from "react";

export default function APNCommissionEntry({ db, partners, initial, onSave, onClose, onDelete, runtime = {} }) {
  const { APN_SERVICES, apnRevenueCollectionsOf, apnPartnerStats, apnRateForPrior, apnProjectStatus, apnFinancePostedFor, apnIdFor, money, round2, todayISO, uid, Modal, Field, SearchableSelect, Coins, GaugeCircle, FileCheck2, Plus, Trash2 } = runtime;

  const existingCollections = initial ? apnRevenueCollectionsOf(db, initial.id) : [];
  const [f, setF] = useState(() => ({ partnerId: initial?.partnerId || partners[0]?.id || "", projectName: initial?.projectName || initial?.project || "", clientName: initial?.clientName || "", projectValue: initial?.projectValue ?? initial?.revenue ?? "", commissionRate: initial?.commissionRate ?? initial?.rate ?? "", category: initial?.category || initial?.service || "website", remarks: initial?.remarks || "", status: initial?.status || "Pending" }));
  const [collections, setCollections] = useState(() => existingCollections.length ? existingCollections.map((row) => ({ ...row })) : [{ id: uid(), receivedAmount: "", incentive: "", remarks: "", receivedDate: todayISO() }]);
  const [err, setErr] = useState("");
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const setCollection = (id, key, value) => setCollections((prev) => prev.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const partner = partners.find((p) => p.id === f.partnerId);
  const stats = partner ? apnPartnerStats(db, partner.id) : null;
  const derivedRate = partner ? apnRateForPrior(stats.completed) : 0;
  const rate = f.commissionRate === "" ? derivedRate : Number(f.commissionRate);
  const projectValue = Number(f.projectValue) || 0;
  const maximumCommission = round2((projectValue * (Number(rate) || 0)) / 100);
  let runningReceived = 0;
  let runningCommission = 0;
  const previewCollections = collections.map((row) => {
    const receivedAmount = Math.max(0, Number(row.receivedAmount) || 0);
    const commissionGenerated = round2(Math.min(Math.max(0, maximumCommission - runningCommission), (receivedAmount * (Number(rate) || 0)) / 100));
    runningReceived += receivedAmount; runningCommission += commissionGenerated;
    return { ...row, receivedAmount, commissionGenerated };
  });
  const totalReceived = round2(previewCollections.reduce((sum, row) => sum + row.receivedAmount, 0));
  const commissionEarned = round2(previewCollections.reduce((sum, row) => sum + row.commissionGenerated, 0));
  const totalIncentives = round2(previewCollections.reduce((sum, row) => sum + Math.max(0, Number(row.incentive) || 0), 0));
  const remainingAmount = round2(Math.max(0, projectValue - totalReceived));
  const remainingCommission = round2(Math.max(0, maximumCommission - commissionEarned));
  const derivedStatus = apnProjectStatus({ ...f, projectValue }, totalReceived);
  const save = () => {
    setErr("");
    if (!partner || !f.projectName.trim() || !f.clientName.trim()) return setErr("Partner, project name, and client name are required.");
    if (projectValue <= 0) return setErr("Total project value must be greater than ₹0.");
    if (!Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) return setErr("Commission % must be between 0 and 100.");
    if ((db.apn_commission_projects || []).some((row) => row.id !== initial?.id && row.partnerId === partner.id && String(row.projectName || row.project || "").trim().toLowerCase() === f.projectName.trim().toLowerCase() && String(row.clientName || "").trim().toLowerCase() === f.clientName.trim().toLowerCase())) return setErr("This partner already has a commission project with that name and client.");
    if (totalReceived > projectValue) return setErr("Collections cannot exceed the total project value.");
    if (collections.some((row) => String(row.receivedAmount).trim() !== "" && (!Number.isFinite(Number(row.receivedAmount)) || Number(row.receivedAmount) <= 0))) return setErr("Every entered collection must be greater than ₹0.");
    if (collections.some((row) => String(row.incentive).trim() !== "" && (!Number.isFinite(Number(row.incentive)) || Number(row.incentive) < 0))) return setErr("Incentives cannot be negative.");
    if (previewCollections.some((row) => row.receivedAmount > 0 && !row.receivedDate)) return setErr("Every collection needs a received date.");
    const now = Date.now();
    const project = { id: initial?.id || uid(), partnerId: partner.id, partnerName: partner.name, projectName: f.projectName.trim(), clientName: f.clientName.trim(), category: f.category, projectValue, commissionRate: Number(rate), maximumCommission, totalReceived, totalCommissionPaid: Number(initial?.totalCommissionPaid) || 0, remainingAmount, remainingCommission, status: f.status === "Cancelled" ? "Cancelled" : derivedStatus, remarks: f.remarks.trim(), createdBy: initial?.createdBy || "Admin", createdAt: initial?.createdAt || now, updatedAt: now };
    const savedCollections = previewCollections.filter((row) => row.receivedAmount > 0).map((row) => ({ ...row, projectId: project.id, partnerId: partner.id, commissionGenerated: row.commissionGenerated, incentive: Math.max(0, Number(row.incentive) || 0), receivedDate: row.receivedDate || todayISO(), createdBy: row.createdBy || "Admin", createdAt: row.createdAt || now, commissionStatus: row.commissionStatus || "Pending" }));
    onSave({ project, collections: savedCollections });
    onClose();
  };
  const title = initial?.id ? "Edit Project Commission Manager" : "Project Commission Manager";
  return <Modal title={title} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!partner || !f.projectName.trim() || !f.clientName.trim() || projectValue <= 0}><Coins size={15} />{totalReceived > 0 ? "Save collection" : "Save project"}</button></>}>
    <div className="banner" style={{ margin: 0 }}><GaugeCircle size={15} />Commission is credited only on client money actually received. It never exceeds the maximum commission.</div>
    {initial?.id && apnFinancePostedFor(db, initial.id).posted && <div className="banner" style={{ margin: "10px 0 0" }}><FileCheck2 size={15} />Posted to finance {apnFinancePostedFor(db, initial.id).expense ? `· commission expense ${money(apnFinancePostedFor(db, initial.id).expense.amount)}` : ""} — changing the value or rate here won't retro-adjust the recorded commission expense. Update Share & accounts instead.</div>}
    <div className="grid2"><div className="field"><label>Partner<span className="req" aria-hidden="true"> *</span></label><SearchableSelect value={f.partnerId} onChange={(value) => set("partnerId", value)} disabled={!!initial?.id} ariaLabel="Commission partner" options={partners.map((p) => ({ value: p.id, label: p.name, meta: apnIdFor(p) }))} /></div><Field label="Project category"><select className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{APN_SERVICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
    <div className="grid2"><Field label="Project name" required><input className="input" value={f.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="Website redesign" /></Field><Field label="Client name" required><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client" /></Field></div>
    <div className="grid2"><Field label="Total project value" required><input className="input mono" type="number" min="0" value={f.projectValue} onChange={(e) => set("projectValue", e.target.value)} placeholder="100000" /></Field><Field label="Commission %" required hint="Defaults to the partner's current rate."><input className="input mono" type="number" min="0" max="100" value={f.commissionRate} onChange={(e) => set("commissionRate", e.target.value)} placeholder={String(derivedRate)} /></Field></div>
    <div className="grid2"><div className="apn-profile-kv"><span>Maximum commission</span><b className="mono">{money(maximumCommission)}</b></div><Field label="Status"><select className="select" value={f.status === "Cancelled" ? "Cancelled" : derivedStatus} onChange={(e) => set("status", e.target.value)}><option value="Pending">Pending (automatic)</option><option value="Processing">Processing (automatic)</option><option value="Completed">Completed (automatic)</option><option value="Cancelled">Cancelled (manual)</option></select></Field></div>
    <Field label="Remarks"><textarea className="textarea" value={f.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Internal project note" /></Field>
    <div className="apn-section-head" style={{ marginTop: 12 }}><h4 style={{ margin: 0 }}>Revenue Collections</h4><button className="btn sm" type="button" onClick={() => setCollections((prev) => [...prev, { id: uid(), receivedAmount: "", incentive: "", remarks: "", receivedDate: todayISO() }])}><Plus size={13} />Add collection</button></div>
    <div className="apn-list">{collections.map((row, index) => <div className="apn-rowcard" key={row.id} style={{ padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><b style={{ flex: 1 }}>Collection {index + 1}</b>{collections.length > 1 && <button className="iconbtn" type="button" style={{ width: 28, height: 28 }} aria-label={`Remove collection ${index + 1}`} onClick={() => setCollections((prev) => prev.filter((x) => x.id !== row.id))}><Trash2 size={13} /></button>}</div><div className="grid2"><Field label="Received amount"><input className="input mono" type="number" min="0" value={row.receivedAmount} onChange={(e) => setCollection(row.id, "receivedAmount", e.target.value)} placeholder="50000" /></Field><Field label="Received date"><input className="input" type="date" value={row.receivedDate || ""} onChange={(e) => setCollection(row.id, "receivedDate", e.target.value)} /></Field></div><div className="grid2"><Field label="Incentive"><input className="input mono" type="number" min="0" value={row.incentive} onChange={(e) => setCollection(row.id, "incentive", e.target.value)} placeholder="0" /></Field><div className="apn-profile-kv"><span>Commission generated</span><b className="mono pos-txt">{money(previewCollections[index]?.commissionGenerated || 0)}</b></div></div><Field label="Remarks"><input className="input" value={row.remarks || ""} onChange={(e) => setCollection(row.id, "remarks", e.target.value)} placeholder="Payment reference or note" /></Field></div>)}</div>
    {err && <div className="auth-msg err" style={{ marginTop: 10 }}>{err}</div>}
    <div className="calc-box" style={{ marginTop: 12 }}><div className="calc-row"><span>Project value</span><b className="mono">{money(projectValue)}</b></div><div className="calc-row"><span>Received</span><b className="mono">{money(totalReceived)}</b></div><div className="calc-row"><span>Remaining</span><b className="mono">{money(remainingAmount)}</b></div><div className="calc-row"><span>Commission rate</span><b>{Number(rate) || 0}%</b></div><div className="calc-row"><span>Commission earned</span><b className="mono pos-txt">{money(commissionEarned)}</b></div><div className="calc-row"><span>Pending commission</span><b className="mono">{money(remainingCommission)}</b></div><div className="calc-row"><span>Total incentives</span><b className="mono">{money(totalIncentives)}</b></div><div className="calc-row"><span>Final payout</span><b className="mono pos-txt">{money(commissionEarned + totalIncentives)}</b></div><div className="calc-row"><span>Status</span><span className="badge pri">{f.status === "Cancelled" ? "CANCELLED" : derivedStatus.toUpperCase()}</span></div></div>
    {initial?.id && onDelete && <div className="banner" style={{ marginTop: 14, borderColor: "var(--neg)", alignItems: "flex-start" }}><div style={{ flex: 1 }}><b>Danger Zone</b><div className="hint-line" style={{ marginTop: 4 }}>Permanently remove this commission project and removable dependent records.</div></div><button className="btn" type="button" style={{ color: "var(--neg)", borderColor: "var(--neg)" }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(initial); }}><Trash2 size={14} />Delete commission project</button></div>}
  </Modal>;
}

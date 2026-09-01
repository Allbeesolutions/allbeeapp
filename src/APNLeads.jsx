import React, { useState } from "react";

export default function APNLeads({ db, meRow, pid, openModal, mutate, runtime = {} }) {
  const { apnLeadsOf, APN_SERVICE_LABEL, apnLeadTone, APN_LEAD_REJECTED, money, fmtDate, Empty, UserPlus, Plus, Handshake, AlertTriangle } = runtime;
  const [view, setView] = useState("all");
  const all = apnLeadsOf(db, pid).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = view === "all" ? all : view === "open" ? all.filter((l) => !["Converted", "Lost", "Invalid", "Fake", "Duplicate"].includes(l.status)) : all.filter((l) => l.status === "Converted");
  return (
    <div>
      <div className="apn-section-h">My leads</div>
      <div className="apn-seg-scroll">{[["all", "All"], ["open", "Active"], ["converted", "Converted"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No leads yet" text="Submit your first lead to start earning commission." action={<button className="btn primary" onClick={() => openModal({ type: "apnLead" })}><Plus size={16} />Submit a lead</button>} /></div>
        : <div className="apn-list">{list.map((l) => (
          <div key={l.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{l.clientName}</div>
                <div className="hint-line" style={{ fontSize: 12, marginTop: 2 }}>{l.business ? l.business + " · " : ""}{APN_SERVICE_LABEL[l.service]} · {l.leadId}</div>
              </div>
              <span className={"badge " + apnLeadTone(l.status)}>{l.status}</span>
            </div>
            {l.tieUp && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}><Handshake size={12} style={{ verticalAlign: -2 }} /> Tie-up: {l.tieUp}{l.tieUpReciprocal ? " · reciprocal" : ""}</div>}
            {l.budget && <div className="hint-line" style={{ marginTop: 4, fontSize: 12 }}>Budget {money(Number(l.budget) || 0)}</div>}
            {l.status === "Converted" && l.revenue != null && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Revenue {money(l.revenue)}{l.projectCompleted ? " · project completed" : ""}</div>}
            {APN_LEAD_REJECTED.has(l.status) && l.rejectReason && <div className="field-err" style={{ marginTop: 6 }}><AlertTriangle size={13} />{l.status}: {l.rejectReason}</div>}
            <div className="hint-line" style={{ fontSize: 11, marginTop: 6 }}>Submitted {fmtDate(new Date(l.createdAt).toISOString().slice(0, 10))}{l.ownershipLocked ? " · ownership locked to you" : ""}</div>
          </div>
        ))}</div>}
    </div>
  );
}

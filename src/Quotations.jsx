import React, { useState, useMemo, useEffect, useRef } from "react";
import * as Icons from "./icons.jsx";

export default function Quotations(props) {
  const {  db, mutate, openModal, removeItem, me, currentUser, isAdmin  } = props;
  const { Empty, money, uid, QUOTE_STATUS, VAULT_CATEGORIES, fmtDate, avatarColor } = props.runtime || {};
  const { FileText, Pencil, Plus, Trash2 } = Icons;

  const [status, setStatus] = useState("All");
  const all = [...db.quotations].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = status === "All" ? all : all.filter((qt) => qt.status === status);
  const setQuoteStatus = (qt, s) => {
    const makeProject = s === "Accepted" && !db.projects.some((pr) => pr.quoteId === qt.id);
    mutate((d) => {
      const projects = makeProject
        ? [...d.projects, { id: uid(), name: qt.title || qt.client, client: qt.client, type: "From quotation", stage: "In progress", priority: "Medium", cost: qt.total || 0, quoteId: qt.id, approvalStatus: isAdmin ? "approved" : "pending", createdById: me?.id, ownerName: currentUser, createdAt: Date.now() }]
        : d.projects;
      return { ...d, quotations: d.quotations.map((x) => x.id === qt.id ? { ...x, status: s } : x), projects };
    }, { action: `marked quote for ${qt.client} ${s}${makeProject ? " — created a project" : ""}`, module: "Quotations" });
  };
  const del = (qt) => removeItem("quotations", qt, { name: qt.client, audit: `deleted quotation for ${qt.client}` });
  const tone = (s) => s === "Accepted" ? "pos" : s === "Rejected" ? "neg" : s === "Sent" ? "pri" : "";
  return (
    <div className="content">
      <div className="page-head"><h3>Quotations</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "quotation" })}><Plus size={16} />New quotation</button></div>
      <div className="toolbar"><div className="seg">{["All", ...QUOTE_STATUS].map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div></div>
      {(() => { const decided = all.filter((q) => q.status === "Accepted" || q.status === "Rejected").length; const accepted = all.filter((q) => q.status === "Accepted").length; const rate = decided ? Math.round((accepted / decided) * 100) : 0; return <div className="hint-line" style={{ marginTop: -2, marginBottom: 10 }}>Conversion rate: <b style={{ color: "var(--ink)" }}>{rate}%</b> · {accepted} accepted of {decided} decided · {all.length} total</div>; })()}
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<FileText size={22} color="var(--muted)" />} title="No quotations" text="Build a quote with line items and a running total, then mark it Sent." action={<button className="btn primary" onClick={() => openModal({ type: "quotation" })}><Plus size={16} />New quotation</button>} /></div>
          : list.map((qt) => (
            <div key={qt.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{qt.client}</div><div className="sub">{qt.title || "Quotation"}</div></div>
                <div className="mono" style={{ fontWeight: 700 }}>{money(qt.total)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className={"badge " + tone(qt.status)}>{qt.status}</span>
                {(qt.items || []).length > 0 && <span className="hint-line" style={{ fontSize: 12 }}>{qt.items.length} item{qt.items.length > 1 ? "s" : ""}</span>}
                {qt.clientId && <span className="badge accent">Shared</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                <select className="select" style={{ width: "auto", padding: "5px 8px" }} value={qt.status} onChange={(e) => setQuoteStatus(qt, e.target.value)}>{QUOTE_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                {qt.pdfUrl && <a className="btn sm" href={qt.pdfUrl} target="_blank" rel="noreferrer"><FileText size={13} />PDF</a>}
                <button className="btn sm" onClick={() => openModal({ type: "quotation", initial: qt })}><Pencil size={13} /></button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete quotation?", body: `Delete the quote for ${qt.client}?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(qt) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
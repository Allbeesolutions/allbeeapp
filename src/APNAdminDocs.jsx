import React from "react";

export default function APNAdminDocs({ db, openModal, removeRow, runtime = {} }) {
  const { fmtDate, Empty, FileText, Download, Eye, Trash2, Plus } = runtime;
  const list = (db.apn_documents || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Sales materials</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnDoc" })}><Plus size={15} />Upload</button></div>
      <div className="apn-list">
        {list.length === 0 ? <div className="card stat"><Empty icon={<FileText size={20} color="var(--muted)" />} title="No materials" text="Upload scripts, price lists, brochures and posters for partners." /></div>
          : list.map((d) => (
            <div key={d.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{d.category}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{d.title}</div>
              <a className="iconbtn" style={{ width: 30, height: 30 }} href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnDoc", initial: d })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_documents", d.id, `deleted APN material "${d.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}

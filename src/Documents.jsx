import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Documents(props) {
  const {  db, mutate, openModal, removeItem, isAdmin, me  } = props;
  const { Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks } = props.runtime || {};
  const { ExternalLink, FileText, Pencil, Plus, Trash2 } = Icons;

  const [cat, setCat] = useState("All");
  const all = [...db.documents].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canSee = (d) => {
    if (isAdmin || d.ownerId === me?.id) return true;
    const aud = d.audience || "internal";
    if (aud === "internal") return true;
    if (aud === "members") return (d.userIds || []).includes(me?.id);
    return false; // client-targeted documents appear in the client portal, not the internal list
  };
  const visibleDocs = all.filter(canSee);
  const list = cat === "All" ? visibleDocs : visibleDocs.filter((d) => d.category === cat);
  const audLabel = (d) => { const a = d.audience || "internal"; return a === "client" ? "Client" : a === "members" ? `${(d.userIds || []).length} member${(d.userIds || []).length === 1 ? "" : "s"}` : null; };
  const del = (d) => removeItem("documents", d, { name: d.title, audit: `deleted document "${d.title}"` });
  const canManage = (d) => isAdmin || d.ownerId === me?.id;
  return (
    <div className="content">
      <div className="page-head"><h3>Documents</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "document" })}><Plus size={16} />Add document</button></div>
      <div className="toolbar"><div className="seg">{["All", ...DOC_CATEGORIES].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<FileText size={22} color="var(--muted)" />} title="No documents" text="Keep shared contracts, templates and brand files (as links) in one place." action={<button className="btn primary" onClick={() => openModal({ type: "document" })}><Plus size={16} />Add document</button>} />
          : list.map((d) => (
            <div key={d.id} className="item-row">
              <div className="empty" style={{ padding: 0 }}><div className="ic" style={{ width: 40, height: 40, margin: 0 }}><FileText size={18} color="var(--muted)" /></div></div>
              <div className="item-main">
                <div className="item-title"><a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)", textDecoration: "none" }}>{d.title}</a></div>
                <div className="item-meta"><span className="tag">{d.category}</span>{audLabel(d) && <span className="badge accent" style={{ fontSize: 10.5 }}>{audLabel(d)}</span>}{d.owner && <span>by {d.owner}</span>}{d.notes && <span>{d.notes}</span>}<span>{fmtDate(new Date(d.createdAt).toISOString().slice(0, 10))}</span></div>
              </div>
              <div className="row-actions" style={{ alignItems: "center" }}>
                <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open</a>
                {canManage(d) && <><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "document", initial: d })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete document?", body: `Delete "${d.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(d) })}><Trash2 size={14} /></button></>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
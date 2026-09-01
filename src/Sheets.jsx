import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Sheets(props) {
  const {  db, openModal, removeItem  } = props;
  const { Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks } = props.runtime || {};
  const { Check, Copy, ExternalLink, Pencil, Plus, Search, Sheet, Trash2 } = Icons;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const all = [...(db.sheets || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean)));
  const list = all.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || (p.title + " " + (p.note || "") + " " + (p.category || "")).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.url || ""); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); } catch { emitToast("Couldn't copy the link.", "error"); } };
  const del = (p) => removeItem("sheets", p, { name: p.title, audit: `deleted sheet link "${p.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Sheets</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "sheet" })}><Plus size={16} />Add link</button></div>
      <p className="hint-line" style={{ marginTop: -8, marginBottom: 14 }}>Keep all your Google Sheets links in one place — trackers, reports, old workbooks. Open or copy any of them in one tap.</p>
      <div className="filterbar">
        <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sheets…" /></Field>
        {cats.length > 0 && <Field label="Category"><select className="select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={<Sheet size={22} color="var(--muted)" />} title="No sheet links yet" text="Paste your Google Sheets links here so the whole team can find them." action={<button className="btn primary" onClick={() => openModal({ type: "sheet" })}><Plus size={16} />Add link</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{list.map((p) => (
          <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sheet size={16} color="var(--pos)" style={{ flex: "none" }} />
              <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.category && <span className="tag">{p.category}</span>}
            </div>
            {p.note && <div className="hint-line" style={{ fontSize: 13, lineHeight: 1.5 }}>{p.note}</div>}
            <div className="hint-line" style={{ fontSize: 12, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.url}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button className="btn sm primary" onClick={() => window.open(p.url, "_blank", "noopener")}><ExternalLink size={13} />Open</button>
              <button className="btn sm" onClick={() => copy(p)}>{copiedId === p.id ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}</button>
              <button className="btn sm" onClick={() => openModal({ type: "sheet", initial: p })}><Pencil size={13} /></button>
              <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete sheet link?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

// A <select> whose last entry is "Other…", which reveals a text box so you can
// type a custom value. Drop-in for any preset dropdown that should also accept
// free text. `value` is the current string; `options` are the presets.
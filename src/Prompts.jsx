import React, { useMemo, useState } from "react";

function Prompts({ db, openModal, removeItem, runtime }) {
  const { Empty, Plus, Trash2, Search, Field, emitToast, Check, Copy, Pencil, Sparkles } = runtime;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const all = [...(db.prompts || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean)));
  const list = all.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || (p.title + " " + (p.body || "") + " " + (p.category || "")).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.body || ""); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); } catch { emitToast("Couldn't copy — your browser blocked clipboard access.", "error"); } };
  const del = (p) => removeItem("prompts", p, { name: p.title, audit: `deleted prompt "${p.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Prompts</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "prompt" })}><Plus size={16} />New prompt</button></div>
      <p className="hint-line" style={{ marginTop: -8, marginBottom: 14 }}>A shared library of the prompts your team reuses — briefs, email templates, AI prompts. Add one, then copy it whenever you need it.</p>
      <div className="filterbar">
        <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" /></Field>
        {cats.length > 0 && <Field label="Category"><select className="select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={<Sparkles size={22} color="var(--muted)" />} title="No prompts yet" text="Add the prompts your team uses most and copy them in one tap." action={<button className="btn primary" onClick={() => openModal({ type: "prompt" })}><Plus size={16} />New prompt</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{list.map((p) => (
          <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.category && <span className="tag">{p.category}</span>}
            </div>
            <div className="hint-line" style={{ whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden", fontSize: 13, lineHeight: 1.5 }}>{p.body}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button className="btn sm primary" onClick={() => copy(p)}>{copiedId === p.id ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}</button>
              <button className="btn sm" onClick={() => openModal({ type: "prompt", initial: p })}><Pencil size={13} /></button>
              <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete prompt?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

// Google Sheets (and any spreadsheet) link library — one tidy place for all the
// team's workbook links. Backed by the `sheets` table (run allbee-sheets.sql).

export default Prompts;

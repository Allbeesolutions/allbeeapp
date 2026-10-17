import React from "react";
import { ArrowRight, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { fmtDate } from "./utils/dateFormat.js";

export default function Concepts({ db, openModal, removeItem, Empty }) {
  const list = (Array.isArray(db?.concepts) ? db.concepts : []).filter((x) => x && typeof x === "object").slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (c) => removeItem("concepts", c, { name: c.title, audit: `deleted idea "${c.title}"` });
  const convert = (c) => openModal({ type: "task", initial: { title: c.title, desc: c.notes }, fromConcept: c.id });
  return <div className="content">
    <div className="page-head"><h3>Concepts &amp; ideas</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button></div>
    <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
      {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Lightbulb size={22} color="var(--muted)" />} title="No ideas saved" text="Park business ideas and future plans here. Turn any of them into a task with one tap." action={<button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button>} /></div>
        : list.map((c) => <div key={c.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>{c.notes && <div className="sub" style={{ lineHeight: 1.5 }}>{String(c.notes).length > 160 ? String(c.notes).slice(0, 160) + "…" : c.notes}</div>}
          {Array.isArray(c.tags) && c.tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.tags.filter((t) => typeof t === "string").map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
          <div className="item-meta"><span>{fmtDate(c.date)}</span></div><div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button className="btn sm primary" onClick={() => convert(c)}><ArrowRight size={13} />Convert to task</button><button aria-label="Edit record" className="btn sm" onClick={() => openModal({ type: "concept", initial: c })}><Pencil size={13} /></button><button aria-label="Delete record" className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete idea?", body: `Delete "${c.title}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(c) })}><Trash2 size={13} /></button>
          </div></div>)}
    </div>
  </div>;
}

import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Knowledge(props) {
  const {  db, mutate, openModal, removeItem, isAdmin  } = props;
  const { Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks } = props.runtime || {};
  const { ArrowLeft, Bell, BookOpen, ListTodo, Pencil, Plus, Trash2 } = Icons;

  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState("All");
  const all = [...db.knowledge].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = cat === "All" ? all : all.filter((k) => k.category === cat);
  const del = (k) => removeItem("knowledge", k, { name: k.title, audit: `deleted article "${k.title}"` });
  // PRD: knowledge can be shared through Notifications / Tasks. Each opens the
  // matching composer pre-filled, so the admin still picks audience / assignee.
  const shareKb = (k, how) => {
    const excerpt = (k.body || "").slice(0, 600);
    if (how === "notify") openModal({ type: "notification", initial: { title: "📚 " + k.title, body: excerpt + ((k.body || "").length > 600 ? "…" : ""), level: "General", audience: "all" } });
    else openModal({ type: "task", initial: { title: "Read: " + k.title, desc: k.body || "" } });
  };
  const article = open ? db.knowledge.find((k) => k.id === open) : null;
  if (article) return (
    <div className="content">
      <button className="backlink" onClick={() => setOpen(null)}><ArrowLeft size={15} />Back to knowledge base</button>
      <div className="detail-head"><div><h3>{article.title}</h3><div className="item-meta" style={{ marginTop: 6 }}><span className="tag">{article.category}</span><span>{fmtDate(new Date(article.createdAt).toISOString().slice(0, 10))}</span></div></div>
        {isAdmin && <div className="row-actions"><button className="btn sm" onClick={() => shareKb(article, "notify")}><Bell size={13} />Share as notification</button><button className="btn sm" onClick={() => shareKb(article, "task")}><ListTodo size={13} />Make a task</button></div>}
      </div>
      <div className="card stat" style={{ lineHeight: 1.65, whiteSpace: "pre-wrap", fontSize: 14.5 }}>{article.body || "No content yet."}</div>
    </div>
  );
  return (
    <div className="content">
      <div className="page-head"><h3>Knowledge base</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "knowledge" })}><Plus size={16} />New article</button>}</div>
      <div className="toolbar"><div className="seg">{["All", ...KB_CATEGORIES].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<BookOpen size={22} color="var(--muted)" />} title="No articles yet" text={isAdmin ? "Write down how-tos, policies and onboarding guides for the team." : "Guides from your team will show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "knowledge" })}><Plus size={16} />New article</button>} /></div>
          : list.map((k) => (
            <div key={k.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }} onClick={() => setOpen(k.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={16} color="var(--primary)" /><span className="tag">{k.category}</span></div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{k.title}</div>
              <div className="sub" style={{ lineHeight: 1.5 }}>{(k.body || "").slice(0, 110)}{(k.body || "").length > 110 ? "…" : ""}</div>
              {isAdmin && <div style={{ display: "flex", gap: 6, marginTop: 2 }} onClick={(e) => e.stopPropagation()}><button className="btn sm" title="Share with the team as a notification" onClick={() => shareKb(k, "notify")}><Bell size={13} />Share</button><button className="btn sm" onClick={() => openModal({ type: "knowledge", initial: k })}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete article?", body: `Delete "${k.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(k) })}><Trash2 size={13} /></button></div>}
            </div>
          ))}
      </div>
    </div>
  );
}
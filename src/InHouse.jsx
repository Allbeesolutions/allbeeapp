import React from "react";

export default function InHouse({ db, mutate, openModal, removeItem, isAdmin, me, team = [], runtime }) {
  const { Home, Activity, CheckCircle2, Wallet, Plus, Empty, priorityTone, INHOUSE_STAGES, money, fmtDate, ExternalLink, Pencil, Trash2, LockIcon } = runtime;
  const list = [...(db.inhouse || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canEdit = (p) => isAdmin || p.ownerId === me?.id;
  const setStage = (p, stage) => mutate((d) => ({ ...d, inhouse: d.inhouse.map((x) => x.id === p.id ? { ...x, stage, progress: stage === "Launched" ? 100 : x.progress } : x) }), { action: `moved "${p.name}" to ${stage}`, module: "In-house projects" });
  const del = (p) => removeItem("inhouse", p, { name: p.name, audit: `deleted in-house project "${p.name}"` });
  const active = list.filter((p) => p.stage !== "Launched" && p.stage !== "On hold").length;
  const launched = list.filter((p) => p.stage === "Launched").length;
  const budget = list.reduce((s, p) => s + (Number(p.budget) || 0), 0);
  const stageTone = (s) => s === "Launched" ? "pos" : s === "On hold" ? "neg" : s === "Building" || s === "Testing" ? "accent" : "pri";
  return (
    <div className="content">
      <div className="page-head"><h3>In-house projects</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "inhouse" })}><Plus size={16} />New project</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><Home size={14} /> Total</div><div className="v">{list.length}</div></div>
        <div className="card"><div className="k"><Activity size={14} /> In progress</div><div className="v">{active}</div></div>
        <div className="card"><div className="k"><CheckCircle2 size={14} /> Launched</div><div className="v">{launched}</div></div>
        {budget > 0 && <div className="card"><div className="k"><Wallet size={14} /> Budget</div><div className="v mono">{money(budget)}</div></div>}
      </div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Home size={22} color="var(--muted)" />} title="No in-house projects yet" text="Track the company's own products, internal tools and R&D from Idea to Launched." action={<button className="btn primary" onClick={() => openModal({ type: "inhouse" })}><Plus size={16} />New project</button>} /></div>
          : list.map((p) => {
            const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
            return (
              <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div><div className="sub">{p.category}{p.lead ? ` · ${p.lead}` : ""}</div></div>
                  {p.priority && <span className={"badge " + priorityTone(p.priority)}>{p.priority}</span>}
                </div>
                <select className="select" value={p.stage} onChange={(e) => setStage(p, e.target.value)}>{INHOUSE_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}><span className={"badge " + stageTone(p.stage)}>{p.stage}</span><span className="mono">{pct}%</span></div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "var(--pos)" : "var(--primary)", transition: ".2s" }} /></div>
                </div>
                <div className="item-meta">{p.start && <span>Start {fmtDate(p.start)}</span>}{p.target && <span>Target {fmtDate(p.target)}</span>}{Number(p.budget) > 0 && <span className="mono">{money(p.budget)}</span>}</div>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--primary)", textDecoration: "none", fontWeight: 600, wordBreak: "break-all" }}><ExternalLink size={13} style={{ flex: "none" }} />{p.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
                {p.notes && <div className="hint-line" style={{ lineHeight: 1.5 }}>{p.notes.length > 120 ? p.notes.slice(0, 120) + "…" : p.notes}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                  {canEdit(p) && <button className="btn sm" onClick={() => openModal({ type: "inhouse", initial: p })}><Pencil size={13} />Edit</button>}
                  {canEdit(p) && <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete project?", body: `Delete "${p.name}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>}
                  {!canEdit(p) && <span className="hint-line" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}><LockIcon size={11} />{p.owner ? `Added by ${p.owner}` : "Admin-only"}</span>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

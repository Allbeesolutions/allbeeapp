import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Projects(props) {
  const {  db, mutate, openModal, openIncome, removeItem, canFinance, isAdmin, me  } = props;
  const { Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts } = props.runtime || {};
  const { Check, FolderKanban, Hourglass, LockIcon, Pencil, Plus, Trash2, X } = Icons;

  const list = [...db.projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Staff may edit a project they created for 7 days; after that it's admin-only.
  const canEditP = (p) => isAdmin || (p.createdById === me?.id && (Date.now() - (p.createdAt || 0)) < 7 * 86400000);
  const setStage = (p, stage) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, stage } : x) }), { action: `set "${p.name}" to ${stage}`, module: "Projects" });
  const appr = (p) => p.approvalStatus || "approved"; // legacy projects count as approved
  const setApproval = (p, s) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, approvalStatus: s, approvedAt: Date.now() } : x) }), { action: `${s === "approved" ? "approved" : "rejected"} project "${p.name}"`, module: "Projects" });
  const del = (p) => removeItem("projects", p, { name: p.name, audit: `deleted project "${p.name}"` });
  const pending = isAdmin ? list.filter((p) => appr(p) === "pending").length : 0;
  return (
    <div className="content">
      <div className="page-head"><h3>Projects</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "project" })}><Plus size={16} />New project</button></div>
      {pending > 0 && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><Hourglass size={15} /> {pending} project{pending > 1 ? "s" : ""} submitted by staff awaiting your approval.</div>}
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<FolderKanban size={22} color="var(--muted)" />} title="No projects yet" text="Track websites, apps and software from Lead all the way to Completed." action={<button className="btn primary" onClick={() => openModal({ type: "project" })}><Plus size={16} />New project</button>} /></div>
          : list.map((p) => (
            <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div><div className="sub">{p.client || "No client"} · {p.type}</div></div>
                <div className="mono" style={{ fontWeight: 700 }}>{money(p.cost)}</div>
              </div>
              {appr(p) !== "approved" && <div><span className={"badge " + (appr(p) === "rejected" ? "neg" : "accent")}>{appr(p) === "rejected" ? "Rejected" : "Awaiting approval"}</span>{p.ownerName && <span className="hint-line" style={{ fontSize: 11, marginLeft: 8 }}>by {p.ownerName}</span>}</div>}
              <select className="select" value={p.stage} onChange={(e) => setStage(p, e.target.value)}>{PROJECT_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
              <div className="item-meta">{p.start && <span>Start {fmtDate(p.start)}</span>}{p.expected && <span>Due {fmtDate(p.expected)}</span>}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {isAdmin && appr(p) !== "approved" && <button className="btn sm primary" onClick={() => setApproval(p, "approved")}><Check size={13} />Approve</button>}
                {isAdmin && appr(p) === "pending" && <button className="btn sm danger" onClick={() => setApproval(p, "rejected")}><X size={13} />Reject</button>}
                {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: p.client, project: p.name, amount: p.cost, category: "Project" })}>Record income</button>}
                {canEditP(p) && <button className="btn sm" onClick={() => openModal({ type: "project", initial: p })}><Pencil size={13} /></button>}
                {canEditP(p) && <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete project?", body: `Delete "${p.name}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>}
                {!canEditP(p) && <span className="hint-line" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}><LockIcon size={11} />Admin-only after 7 days</span>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
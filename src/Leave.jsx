import React, { useState, useMemo } from "react";
import * as Icons from "./icons.jsx";

export default function Leave(props) {
  const { db, team, mutate, me, isAdmin, openModal } = props;
  const { Empty, avatarColor, fmtDate, haptic, leaveTone, ContactButtons } = props.runtime || {};
  const { CalendarDays, Check, Plane, Plus, Trash2, XCircle } = Icons;

  const [filter, setFilter] = useState(isAdmin ? "Pending" : "all");
  const all = [...db.leave].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin
    ? all.filter((l) => filter === "all" ? true : l.status === filter)
    : all.filter((l) => l.userId === me.id);

  const decide = (l, status) => { haptic(/^app/i.test(status) ? 12 : [10, 30, 10]); mutate((d) => ({ ...d, leave: d.leave.map((x) => x.id === l.id ? { ...x, status, decidedBy: me.name, decidedAt: Date.now() } : x) }), { action: `${status.toLowerCase()} ${l.userName}'s ${l.type.toLowerCase()} leave`, module: "Leave" }); };
  const cancel = (l) => mutate((d) => ({ ...d, leave: d.leave.filter((x) => x.id !== l.id) }), null);

  return (
    <div className="content">
      <div className="page-head"><h3>{isAdmin ? "Leave requests" : "My leave"}</h3><span className="spacer" />
        {!isAdmin && <button className="btn primary" onClick={() => openModal({ type: "leave" })}><Plus size={16} />Request leave</button>}</div>
      {isAdmin && <div className="toolbar"><div className="seg">{["Pending", "Approved", "Rejected", "all"].map((k) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : k}</button>)}</div></div>}

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Plane size={22} color="var(--muted)" />} title={isAdmin ? "Nothing to review" : "No leave requests"} text={isAdmin ? "Approved and rejected requests stay here for your records." : "Request time off and track its status here."}
            action={!isAdmin ? <button className="btn primary" onClick={() => openModal({ type: "leave" })}><Plus size={16} />Request leave</button> : undefined} />
        ) : list.map((l) => (
          <div key={l.id} className="item-row">
            <div className="item-main">
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                {isAdmin && <span className="avatar" style={{ background: avatarColor(l.userName), width: 24, height: 24, fontSize: 10 }}>{l.userName[0]}</span>}
                <span className="item-title">{isAdmin ? l.userName + " · " : ""}{l.type} leave</span>
                <span className={"badge " + leaveTone(l.status)}>{l.status}</span>
                <span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{l.days} day{l.days > 1 ? "s" : ""}</span>
              </div>
              <div className="item-meta" style={{ marginTop: 6 }}>
                <span><CalendarDays size={12} style={{ verticalAlign: -2 }} /> {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</span>
                {l.decidedBy && <span>{l.status} by {l.decidedBy}</span>}
              </div>
              {l.reason && <div className="item-meta" style={{ marginTop: 6 }}>{l.reason}</div>}
            </div>
            <div className="row-actions">
              {isAdmin && (() => { const person = team.find((p) => p.id === l.userId); return person ? <ContactButtons person={person} compact message={`Hi ${l.userName || ""}, regarding your ${String(l.type || "").toLowerCase()} leave (${fmtDate(l.fromDate)} to ${fmtDate(l.toDate)}) —`} /> : null; })()}
              {isAdmin && l.status === "Pending" && (
                <>
                  <button className="btn sm primary" onClick={() => decide(l, "Approved")}><Check size={13} />Approve</button>
                  <button className="btn sm" onClick={() => decide(l, "Rejected")} style={{ color: "var(--neg)" }}><XCircle size={13} />Reject</button>
                </>
              )}
              {!isAdmin && l.status === "Pending" && (
                <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => openModal({ type: "confirm", title: "Cancel request?", body: "Withdraw this pending leave request?", confirmLabel: "Cancel request", onConfirm: () => cancel(l) })}><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
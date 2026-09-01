import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Marketing(props) {
  const {  db, mutate, openModal, openIncome, removeItem, canFinance  } = props;
  const { Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts } = props.runtime || {};
  const { Megaphone, Pencil, Plus, Trash2 } = Icons;

  const list = [...db.marketing].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (m) => removeItem("marketing", m, { name: m.client, audit: `removed marketing client ${m.client}` });
  return (
    <div className="content">
      <div className="page-head"><h3>Digital marketing</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "marketing" })}><Plus size={16} />New client</button></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Megaphone size={22} color="var(--muted)" />} title="No marketing clients yet" text="Track monthly retainers and get a due reminder each cycle." action={<button className="btn primary" onClick={() => openModal({ type: "marketing" })}><Plus size={16} />New client</button>} /></div>
          : list.map((m) => {
            const due = marketingDue(m);
            return (
              <div key={m.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{m.client}</div><div className="sub">{m.business || "—"} · {m.plan || "Plan"}</div></div>
                  <div className="mono" style={{ fontWeight: 700 }}>{money(m.monthlyFee)}<span style={{ fontSize: 11, color: "var(--muted)" }}>/mo</span></div>
                </div>
                <div><span className={"badge " + due.tone}>{due.label}</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: m.client, project: (m.plan || "Marketing") + " — monthly", amount: m.monthlyFee, category: "Marketing", source: { kind: "marketing", id: m.id } })}>Record payment</button>}
                  <button className="btn sm" onClick={() => openModal({ type: "marketing", initial: m })}><Pencil size={13} /></button>
                  <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Remove client?", body: `Remove ${m.client}?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(m) })}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
import React, { useState, useMemo } from "react";
import * as Icons from "./icons.jsx";

export default function Clients(props) {
  const { db, mutate, openModal, removeItem, isAdmin = true, me, portalClients = [], deleteClientAccount } = props;
  const { Empty, LoadMore, avatarColor, fmtDate } = props.runtime || {};
  const { Building2, ExternalLink, FileText, Pencil, Plus, Search, Trash2 } = Icons;

  const [q, setQ] = useState("");
  const [n, setN] = useState(25);
  const all = [...db.clients].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const scoped = isAdmin ? all : all.filter((c) => c.ownerId === (me && me.id));
  const list = q.trim() ? scoped.filter((c) => (c.name + " " + (c.company || "") + " " + (c.phone || "") + " " + (c.email || "")).toLowerCase().includes(q.toLowerCase())) : scoped;
  const del = (c) => removeItem("clients", c, { name: c.name, audit: `removed client "${c.name}"` });
  const quote = (c) => openModal({ type: "quotation", initial: { client: c.name } });
  // Registered clients = people who signed up themselves from the login screen
  // (choose "Client"). Newest first.
  const registered = [...portalClients].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const removeAccount = (p) => openModal({
    type: "deleteConfirm", title: "Delete client account?",
    body: `Permanently remove ${p.name}'s portal account?`,
    note: "They're removed from the team and can't sign back in. This can't be undone here.",
    onConfirm: () => deleteClientAccount && deleteClientAccount(p),
  });
  return (
    <div className="content">
      <div className="page-head"><h3>Clients</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "client" })}><Plus size={16} />New client</button></div>
      <div className="toolbar"><div className="search"><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => { setQ(e.target.value); setN(25); }} placeholder="Search clients…" /></div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<Building2 size={22} color="var(--muted)" />} title={q ? "No matches" : "No clients yet"} text="Win a lead or add a client directly, then send them quotations." action={!q && <button className="btn primary" onClick={() => openModal({ type: "client" })}><Plus size={16} />New client</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Client</th><th>Contact</th><th>Added</th><th></th></tr></thead>
            <tbody>{list.slice(0, n).map((c) => (
              <tr key={c.id}>
                <td><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{c.name}{c.status && <span className={"badge " + (c.status === "Blacklisted" ? "neg" : c.status === "Active" ? "pos" : c.status === "Inactive" ? "" : "pri")} style={{ fontSize: 10 }}>{c.status}</span>}</div>{c.company && <div className="hint-line" style={{ fontSize: 11 }}>{c.company}</div>}</td>
                <td>{c.phone && <div style={{ fontSize: 13 }}>{c.phone}</div>}{c.email && <div className="hint-line" style={{ fontSize: 11 }}>{c.email}</div>}{!c.phone && !c.email && "—"}</td>
                <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{c.createdAt ? fmtDate(new Date(c.createdAt).toISOString().slice(0, 10)) : "—"}</td>
                <td><div className="row-actions">
                  <button className="btn sm" onClick={() => quote(c)}><FileText size={13} />Quote</button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "client", initial: c })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove client?", body: `Remove ${c.name}?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(c) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
        <LoadMore shown={Math.min(n, list.length)} total={list.length} onMore={() => setN((x) => x + 25)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <ExternalLink size={15} /> Registered clients
          {registered.length > 0 && <span className="badge" style={{ marginLeft: 2 }}>{registered.length}</span>}
        </div>
        {registered.length === 0
          ? <Empty icon={<ExternalLink size={22} color="var(--muted)" />} title="No registered clients yet" text="When someone signs up from the login screen and chooses “Client”, their account shows up here." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Client</th><th>Contact</th><th>Joined</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>{registered.map((p) => (
              <tr key={p.id}>
                <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(p.name), width: 24, height: 24, fontSize: 10 }}>{(p.name || "?")[0]}</span>{p.name}</span></td>
                <td>{p.email && <div style={{ fontSize: 13 }}>{p.email}</div>}{p.mobile && <div className="hint-line" style={{ fontSize: 11 }}>{p.mobile}</div>}{!p.email && !p.mobile && "—"}</td>
                <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{p.created_at ? fmtDate(p.created_at) : "—"}</td>
                <td>{p.approved === false
                  ? <span className="badge pri" style={{ fontSize: 10 }}>Pending approval</span>
                  : <span className={"badge " + (p.active === false ? "neg" : "pos")} style={{ fontSize: 10 }}>{p.active === false ? "Inactive" : "Active"}</span>}</td>
                {isAdmin && <td><div className="row-actions">
                  <button className="iconbtn" style={{ width: 30, height: 30 }} title="Delete client account" onClick={() => removeAccount(p)}><Trash2 size={14} /></button>
                </div></td>}
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

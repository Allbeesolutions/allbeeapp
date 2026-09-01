import React, { useState, useMemo, useEffect, useRef } from "react";
import * as Icons from "./icons.jsx";

export default function Vault(props) {
  const {  db, mutate, openModal, removeItem  } = props;
  const { Empty, money, uid, QUOTE_STATUS, VaultCategories, VAULT_CATEGORIES, fmtDate, avatarColor } = props.runtime || {};
  const { Copy, ExternalLink, Eye, EyeOff, KeyRound, LockIcon, Pencil, Plus, Search, Trash2, User } = Icons;

  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState({});
  const all = [...db.vault].sort((a, b) => (a.service || "").localeCompare(b.service || ""));
  const list = q.trim() ? all.filter((v) => (v.service + " " + (v.category || "") + " " + (v.username || "")).toLowerCase().includes(q.toLowerCase())) : all;
  const del = (v) => removeItem("vault", v, { name: v.service, audit: `deleted credential "${v.service}"` });
  const logVault = (action) => mutate((d) => d, { action, module: "Passwords" });
  const copy = (t, v, what) => { try { navigator.clipboard?.writeText(t || ""); logVault(`copied ${what} for "${v.service}"`); } catch { /* clipboard may be blocked */ } };
  const toggleReveal = (v) => setReveal((r) => { const now = !r[v.id]; if (now) logVault(`viewed password for "${v.service}"`); return { ...r, [v.id]: now }; });
  return (
    <div className="content">
      <div className="page-head"><h3>Passwords</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "vault" })}><Plus size={16} />New credential</button></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0 }}><LockIcon size={15} /> Visible to partners only. Stored in your database with row-level security.</div>
      <div className="toolbar" style={{ marginTop: 14 }}><div className="search"><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logins…" /></div></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<KeyRound size={22} color="var(--muted)" />} title={q ? "No matches" : "No logins saved"} text="Keep shared business logins — social, hosting, email, domains — in one safe place." action={!q && <button className="btn primary" onClick={() => openModal({ type: "vault" })}><Plus size={16} />New credential</button>} /></div>
          : list.map((v) => (
            <div key={v.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{v.service}</div><div className="sub">{v.category}</div></div>
                <span className="tag">{v.category}</span>
              </div>
              {v.username && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}><span className="hint-line" style={{ minWidth: 64 }}>User</span><span className="mono" style={{ flex: 1, wordBreak: "break-all" }}>{v.username}</span><button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => copy(v.username, v, "username")}><Copy size={13} /></button></div>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}><span className="hint-line" style={{ minWidth: 64 }}>Pass</span><span className="mono" style={{ flex: 1 }}>{reveal[v.id] ? v.password : "••••••••"}</span>
                <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => toggleReveal(v)}>{reveal[v.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => copy(v.password, v, "password")}><Copy size={13} /></button>
              </div>
              {v.url && <a className="hint-line" href={v.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><ExternalLink size={12} />Open login</a>}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn sm" onClick={() => openModal({ type: "vault", initial: v })}><Pencil size={13} />Edit</button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete credential?", body: `Delete "${v.service}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(v) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
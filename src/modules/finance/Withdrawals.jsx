import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Check, ChevronRight, Hourglass, Lock as LockIcon, Pencil, Plus, Search, ShieldCheck, Trash2, Unlock as UnlockIcon, Wallet, X } from "lucide-react";

export default function Withdrawals({ db, bal, mutate, openModal, removeItem, isSuper, currentUser, helpers }) {
  const { money, fmtDate, Empty, USERS, avatarColor, haptic } = helpers;
  const list = [...db.withdrawals].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const del = (w) => removeItem("withdrawals", w, { name: `Withdrawal ${money(w.amount)} · ${w.user}`, audit: `deleted a withdrawal of ${money(w.amount)}` });
  const statusOf = (w) => w.status || "approved"; // legacy rows (no status) already moved money
  const tone = (s) => s === "approved" ? "pos" : s === "rejected" ? "neg" : "pri";
  const setStatus = (w, s) => { haptic(s === "approved" ? 12 : [10, 30, 10]); mutate((d) => ({ ...d, withdrawals: d.withdrawals.map((x) => x.id === w.id ? { ...x, status: s, approvedBy: currentUser, approvedAt: Date.now() } : x) }),
    { action: `${s === "approved" ? "approved" : "rejected"} withdrawal of ${money(w.amount)} for ${w.user}`, module: "Withdrawals" }); };
  const pending = list.filter((w) => statusOf(w) === "pending").length;
  return (
    <div className="content">
      <div className="page-head"><h3>Withdrawals</h3><span className="spacer" />
        <button className="btn primary" onClick={() => openModal({ type: "withdraw" })}><Plus size={16} />Record withdrawal</button></div>

      {pending > 0 && <div className="banner" style={{ marginLeft: 0, marginRight: 0 }}><Hourglass size={15} /> {pending} withdrawal{pending > 1 ? "s" : ""} awaiting a partner's approval. Only approved withdrawals affect the balances.</div>}

      <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: "16px 0" }}>
        {USERS.map((u) => (
          <div key={u} className="card stat"><div className="lbl"><span className="dot" style={{ background: avatarColor(u) }} /> {u} available</div>
            <div className="num mono" style={{ color: bal[u] < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal[u])}</div>
            {bal[u] < 0 && <div className="sub neg-txt">Negative — to be settled by future profit share</div>}</div>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ArrowDownToLine size={22} color="var(--muted)" />} title="No withdrawals yet" text="A partner can withdraw up to their current balance. Each withdrawal needs a partner's approval before it moves money." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Partner</th><th className="num-cell">Amount</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>{list.map((w) => {
                const st = statusOf(w);
                return (
                <tr key={w.id} style={st === "rejected" ? { opacity: 0.55 } : undefined}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(w.date)}</td>
                  <td><span className="badge" style={{ background: "var(--surface-2)" }}><span className="dot" style={{ background: avatarColor(w.user), display: "inline-block", marginRight: 5 }} />{w.user}</span></td>
                  <td className="num-cell mono neg-txt" style={{ fontWeight: 700 }}>{money(-w.amount)}</td>
                  <td><span className={"badge " + tone(st)} style={{ textTransform: "capitalize" }}>{st}</span></td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{w.notes || "—"}</td>
                  <td><div className="row-actions">
                    {isSuper && st !== "approved" && <button className="btn sm primary" onClick={() => setStatus(w, "approved")} title="Approve"><Check size={13} /></button>}
                    {isSuper && st !== "rejected" && <button className="btn sm danger" onClick={() => setStatus(w, "rejected")} title="Reject"><X size={13} /></button>}
                    <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete withdrawal?", body: `Remove this ${money(w.amount)} withdrawal for ${w.user}?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(w) })}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function priorityTone(p) { return p === "Urgent" || p === "High" ? "neg" : p === "Medium" ? "pri" : ""; }


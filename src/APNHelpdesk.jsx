import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function APNHelpdesk(props) {
  const {  db, me, team = [], isAdmin = false, onRefresh  } = props;
  const { Avatar, Empty, HELP_STATUS_LABEL, HELP_STATUS_TONE, Invoices, Notifications, emitToast, fmtDateTime } = props.runtime || {};
  const { Activity, ChevronDown, EyeOff, Headset, History, RefreshCw, Search, Send } = Icons;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const staff = (team || []).filter((p) => ["superadmin", "admin", "accountant", "staff", "intern"].includes(p.role));
  const nameOf = (id) => (staff.find((p) => p.id === id) || (team || []).find((p) => p.id === id))?.name || (id ? id : "Unassigned");
  const allTickets = [...(db.support_tickets || [])].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const msgsOf = (id) => [...(db.support_ticket_messages || [])].filter((m) => m.ticket_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const auditOf = (id) => [...(db.support_ticket_audit || [])].filter((a) => a.ticket_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const rows = allTickets.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (priority !== "all" && (t.priority || "Normal") !== priority) return false;
    if (q && ![t.subject, t.ticket_no, t.client_name, t.client_email, t.category].join(" ").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const counts = (s) => allTickets.filter((t) => t.status === s).length;
  const pCounts = (p) => allTickets.filter((t) => (t.priority || "Normal") === p).length;
  const auditText = (a) => {
    if (a.action === "ticket_created") return `Ticket created — ${a.metadata?.subject || "subject"} (category: ${a.metadata?.category || "—"}, priority: ${a.metadata?.priority || "Normal"})`;
    if (a.action === "assigned") {
      const assignee = a.metadata?.assignee_id;
      return assignee ? `Assigned to ${nameOf(assignee)}` : "Ticket unassigned";
    }
    if (a.action && a.action.startsWith("status_")) return `Status changed to ${HELP_STATUS_LABEL[a.action.slice(7)] || a.action.slice(7)}`;
    return a.action || "Update";
  };
  const run = async (rpcName, args, okMsg) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc(rpcName, args);
      if (error) throw error;
      if (okMsg) emitToast(okMsg, "success");
      await onRefresh();
      return true;
    } catch (e) { emitToast(e.message || "Something went wrong.", "error"); return false; }
    finally { setBusy(false); }
  };
  const reply = async (t, body, isPublic) => {
    const txt = (body || "").trim();
    if (!txt || busy) return;
    const ok = await run("apn_helpdesk_staff_message", { p_ticket_id: t.id, p_message: txt, p_public: !!isPublic }, isPublic ? "Reply sent to the client." : "Internal note saved.");
    if (ok) setDrafts((d) => ({ ...d, [t.id]: "" }));
  };
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h3>Support tickets</h3>
          <div className="hint-line">Tickets raised by clients from the portal — reply, triage and assign here. Replies are one-to-one with the client.</div>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={onRefresh}><RefreshCw size={14} className={busy ? "spin" : ""} />Refresh</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="toolbar" style={{ margin: 0, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search" style={{ flex: "1 1 220px" }}><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket, client, category…" /></div>
          <div className="seg" style={{ width: "max-content", flexWrap: "wrap" }}>
            <button className={status === "all" ? "on" : ""} onClick={() => setStatus("all")}>All <span className="badge">{allTickets.length}</span></button>
            <button className={status === "open" ? "on" : ""} onClick={() => setStatus("open")}>Open {counts("open") > 0 && <span className="badge accent">{counts("open")}</span>}</button>
            <button className={status === "in_progress" ? "on" : ""} onClick={() => setStatus("in_progress")}>In progress</button>
            <button className={status === "resolved" ? "on" : ""} onClick={() => setStatus("resolved")}>Resolved</button>
            <button className={status === "closed" ? "on" : ""} onClick={() => setStatus("closed")}>Closed</button>
          </div>
        </div>
        <div className="toolbar" style={{ margin: "10px 0 0", alignItems: "center", flexWrap: "wrap" }}>
          <span className="hint-line" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Priority</span>
          <div className="seg" style={{ width: "max-content", flexWrap: "wrap" }}>
            <button className={priority === "all" ? "on" : ""} onClick={() => setPriority("all")}>All</button>
            <button className={priority === "Urgent" ? "on" : ""} onClick={() => setPriority("Urgent")}>Urgent {pCounts("Urgent") > 0 && <span className="badge neg">{pCounts("Urgent")}</span>}</button>
            <button className={priority === "High" ? "on" : ""} onClick={() => setPriority("High")}>High</button>
            <button className={priority === "Medium" ? "on" : ""} onClick={() => setPriority("Medium")}>Medium</button>
            <button className={priority === "Low" ? "on" : ""} onClick={() => setPriority("Low")}>Low</button>
            <button className={priority === "Normal" ? "on" : ""} onClick={() => setPriority("Normal")}>Normal</button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? <div className="card"><Empty icon={<Headset size={22} color="var(--muted)" />} title="No support tickets" text="When a client raises a ticket in the portal, it will appear here in real time." /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{rows.map((t) => {
          const isOpen = expanded === t.id;
          const thread = msgsOf(t.id);
          return (
            <div key={t.id} className="card stat">
              <div role="button" tabIndex={0} aria-expanded={isOpen} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }} onClick={() => setExpanded(isOpen ? null : t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isOpen ? null : t.id); } }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{t.subject}</div>
                  <div className="hint-line" style={{ fontSize: 11.5, marginTop: 2 }}>{t.ticket_no} · {nameOfT(t)} · {t.category}</div>
                </div>
                {t.priority && t.priority !== "Normal" && <span className={"badge " + (t.priority === "High" || t.priority === "Urgent" ? "neg" : "accent")}>{t.priority}</span>}
                {t.assignee_id && <span className="badge">→ {nameOf(t.assignee_id)}</span>}
                <span className={"badge " + HELP_STATUS_TONE(t.status)}>{HELP_STATUS_LABEL[t.status] || t.status}</span>
                <ChevronDown size={15} style={{ transform: isOpen ? "rotate(180deg)" : "", transition: "transform .18s ease", color: "var(--muted)" }} />
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }} className="hint-line">
                    <span><b style={{ color: "var(--ink)" }}>Client:</b> {t.client_name || "—"} {t.client_company ? `· ${t.client_company}` : ""}</span>
                    {t.client_email && <span><b style={{ color: "var(--ink)" }}>Email:</b> {t.client_email}</span>}
                    <span><b style={{ color: "var(--ink)" }}>Raised:</b> {fmtDateTime(t.created_at)}</span>
                    {["resolved", "closed"].includes(t.status) && t.closed_at && <span><b style={{ color: "var(--ink)" }}>Closed:</b> {fmtDateTime(t.closed_at)}</span>}
                  </div>
                  {t.description && <div className="hint-line" style={{ margin: "0 0 12px", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{t.description}</div>}

                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <select className="select" style={{ width: "auto" }} value={t.status} onChange={(e) => { const v = e.target.value; if (v !== t.status) run("apn_set_support_ticket_status", { p_ticket_id: t.id, p_status: v }, `Ticket marked ${(HELP_STATUS_LABEL[v] || v).toLowerCase()}.`); }} disabled={busy}>
                      {Object.keys(HELP_STATUS_LABEL).map((s) => <option key={s} value={s}>{HELP_STATUS_LABEL[s]}</option>)}
                    </select>
                    {isAdmin && <select className="select" style={{ width: "auto" }} value={t.assignee_id || ""} onChange={(e) => { const v = e.target.value || null; if (v !== (t.assignee_id || null)) run("apn_assign_support_ticket", { p_ticket_id: t.id, p_assignee_id: v }, v ? `Assigned to ${nameOf(v)}.` : "Ticket unassigned."); }} disabled={busy}>
                      <option value="">Assign to…</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {thread.length === 0 ? <div className="hint-line">No messages yet on this ticket.</div>
                      : thread.map((m) => (
                        <div key={m.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <Avatar name={m.author_name || (m.author_role === "staff" ? "ALLBEE" : "Client")} url={(staff.find((p) => p.id === m.author_id))?.photo_url} size={26} />
                          <div style={{ background: m.author_role === "staff" ? "var(--surface-2)" : "var(--primary-soft)", borderRadius: 10, padding: "9px 12px", flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <b style={{ fontSize: 12.5 }}>{m.author_name || (m.author_role === "staff" ? "ALLBEE" : "Client")}{m.author_role === "staff" && !m.author_public ? <span className="badge accent" style={{ marginLeft: 6 }}>Internal note</span> : null}</b>
                              <span className="hint-line" style={{ fontSize: 10.5 }}>{fmtDateTime(m.created_at)}</span>
                            </div>
                            <div style={{ marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 13.5 }}>{m.body}</div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "flex-start" }}>
                    <textarea className="textarea" style={{ minHeight: 40, flex: 1 }} value={drafts[t.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} placeholder="Reply to the client, or add an internal note…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if ((drafts[t.id] || "").trim()) reply(t, drafts[t.id], true); } }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button className="btn primary" disabled={busy || !(drafts[t.id] || "").trim()} onClick={() => reply(t, drafts[t.id], true)}><Send size={14} />Send to client</button>
                      <button className="btn sm" disabled={busy || !(drafts[t.id] || "").trim()} onClick={() => reply(t, drafts[t.id], false)}><EyeOff size={12} />Internal note</button>
                    </div>
                  </div>

                  {auditOf(t.id).length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}><History size={13} color="var(--muted)" />Activity</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {auditOf(t.id).map((a) => (
                          <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5 }}>
                            <div className="av" style={{ width: 22, height: 22, fontSize: 10, flex: "none" }}>{a.author_name?.[0] || "?"}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ lineHeight: 1.45 }}><b>{a.author_name || "System"}</b> {auditText(a)}</div>
                              <div className="hint-line" style={{ fontSize: 10.5 }}>{fmtDateTime(a.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}</div>}
    </div>
  );

  function nameOfT(t) { return (team || []).find((p) => p.id === t.client_id)?.name || t.client_name || "Client"; }
}



/* ══════════════════════════════════════════════════════════════════════
   PHASE 7 — Notifications, Invoices, Company profile
══════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";

const HELP_STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const HELP_STATUS_TONE = (s) => ({ open: "pri", in_progress: "accent", resolved: "pos", closed: "" }[s] || "pri");
const HELP_CATEGORIES = ["Login / Account", "Payment / Billing", "Quotation", "Project", "Website", "Digital Marketing", "Training", "Technical Issue", "App / Portal", "APN", "Other"];

function PortalHelpdesk({ myId, tickets, messages, onCreate, onSend, helpFormOpen, setHelpFormOpen, helpBusy, co = {}, runtime }) {
  const { Avatar, Empty, Field, Modal, Headset, Plus, Mail, MessageCircle, ChevronDown, Send, emitToast, fmtDate, fmtDateTime } = runtime;
  const waNumber = String(co.phone || "").replace(/[^\d]/g, "");
  const waLink = waNumber ? `https://wa.me/${waNumber.replace(/^0+/, "")}?text=${encodeURIComponent("Hello ALLBEE, I need help with a support query.")}` : "";
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "Other", priority: "Normal", description: "" });
  const msgsOf = (id) => [...messages].filter((m) => m.ticket_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const send = async (t, body) => {
    const txt = (body || "").trim();
    if (!txt || busy) return;
    setBusy(true);
    const ok = await onSend(t.id, txt);
    setBusy(false);
    if (ok) setDrafts((d) => ({ ...d, [t.id]: "" }));
  };
  const submit = () => {
    if (!form.subject.trim()) { emitToast("Please add a subject.", "error"); return; }
    onCreate({ subject: form.subject, description: form.description, category: form.category, priority: form.priority });
    setForm({ subject: "", category: "Other", priority: "Normal", description: "" });
  };
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ marginBottom: 3 }}>Support</h3>
          <div className="hint-line">Facing an issue or have a question? Raise a ticket and our team will reply right here.</div>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setHelpFormOpen(true)}><Plus size={15} />Create Ticket</button>
      </div>

      {(co.email || waLink) && (
        <div className="card" style={{ marginBottom: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="hint-line" style={{ flex: "1 1 200px" }}>Prefer to reach us directly? Email or WhatsApp your query anytime — tickets still get the fastest response.</span>
          {co.email && <a className="btn sm" href={`mailto:${co.email}?subject=${encodeURIComponent("Support request — client portal")}`} style={{ textDecoration: "none" }}><Mail size={13} />Email us</a>}
          {waLink && <a className="btn sm" href={waLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><MessageCircle size={13} />WhatsApp</a>}
        </div>
      )}

      {tickets.length === 0 ? <div className="card"><Empty icon={<Headset size={22} color="var(--muted)" />} title="No support tickets yet" text="When you create a ticket, it will show up here with the team's replies." action={<button className="btn primary" onClick={() => setHelpFormOpen(true)}><Plus size={15} />Create your first ticket</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{tickets.map((t) => {
          const isOpen = expanded === t.id;
          const thread = msgsOf(t.id);
          return (
            <div key={t.id} className="card stat">
              <div role="button" tabIndex={0} aria-expanded={isOpen} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }} onClick={() => setExpanded(isOpen ? null : t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isOpen ? null : t.id); } }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{t.subject}</div>
                  <div className="hint-line" style={{ fontSize: 11.5, marginTop: 2 }}>{t.ticket_no} · {t.category} · raised {fmtDate(t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : 0)}</div>
                </div>
                {t.priority && t.priority !== "Normal" && <span className={"badge " + (t.priority === "High" || t.priority === "Urgent" ? "neg" : "accent")}>{t.priority}</span>}
                <span className={"badge " + HELP_STATUS_TONE(t.status)}>{HELP_STATUS_LABEL[t.status] || t.status}</span>
                <ChevronDown size={15} style={{ transform: isOpen ? "rotate(180deg)" : "", transition: "transform .18s ease", color: "var(--muted)" }} />
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  {t.description && <div className="hint-line" style={{ margin: "0 0 12px", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{t.description}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {thread.length === 0 ? <div className="hint-line">No replies yet — our team typically follows up within one business day.</div>
                      : thread.map((m) => (
                        <div key={m.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <Avatar name={m.author_name || (m.author_role === "client" ? "You" : "ALLBEE")} size={26} />
                          <div style={{ background: m.author_role === "client" ? "var(--primary-soft)" : "var(--surface-2)", borderRadius: 10, padding: "9px 12px", flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <b style={{ fontSize: 12.5 }}>{m.author_role === "client" ? "You" : (m.author_name || "ALLBEE team")}</b>
                              <span className="hint-line" style={{ fontSize: 10.5 }}>{fmtDateTime(m.created_at)}</span>
                            </div>
                            <div style={{ marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 13.5 }}>{m.body}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {!["resolved", "closed"].includes(t.status) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <textarea className="textarea" style={{ minHeight: 40, flex: 1 }} value={drafts[t.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} placeholder="Write a reply…" />
                      <button className="btn primary" disabled={busy || !(drafts[t.id] || "").trim()} onClick={() => send(t, drafts[t.id])}><Send size={14} />Reply</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}</div>}

      {helpFormOpen && <Modal title="Create a support ticket" onClose={() => setHelpFormOpen(false)} footer={<><button className="btn" onClick={() => setHelpFormOpen(false)}>Cancel</button><button className="btn primary" disabled={helpBusy || !form.subject.trim()} onClick={submit}>{helpBusy ? "Submitting…" : "Submit ticket"}</button></>}>
        <Field label="Subject" required><input className="input" autoFocus value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} placeholder="Short summary of your request" /></Field>
        <div className="grid2"><Field label="Category"><select className="select" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>{HELP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Priority"><select className="select" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>{["Low", "Medium", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field></div>
        <Field label="Describe the issue"><textarea className="textarea" style={{ minHeight: 110 }} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Share as much detail as you can — what happened, when, and what you'd like us to do." /></Field>
      </Modal>}
    </div>
  );
}





export default PortalHelpdesk;

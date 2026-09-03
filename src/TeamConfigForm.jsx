import React, { useState } from "react";
import { AlertTriangle, Check } from "./icons.jsx";

export default function TeamConfigForm({ initial, roster, onSave, onClose, runtime = {} }) {
  const { Modal, Field, uid, ROLE_LABEL = {}, Avatar } = runtime;
  const [name, setName] = useState(initial?.name || "");
  const [leadId, setLeadId] = useState(initial?.leadId || "");
  const [memberIds, setMemberIds] = useState(initial?.memberIds || []);
  const [err, setErr] = useState("");
  const toggle = (id) => setMemberIds((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
  const candidates = roster.filter((p) => p.id !== leadId);
  const save = () => {
    if (!name.trim()) { setErr("Give the team a name."); return; }
    if (!leadId) { setErr("Choose a team lead."); return; }
    const lead = roster.find((p) => p.id === leadId);
    onSave({ id: initial?.id || uid(), name: name.trim(), leadId, leadName: lead?.name || "", memberIds: memberIds.filter((id) => id !== leadId), createdAt: initial?.createdAt || Date.now(), updatedAt: Date.now() });
  };
  return (
    <Modal title={initial?.id ? "Edit team" : "New team"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={16} />Save team</button></>}>
      {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} /> {err}</div>}
      <div className="grid2">
        <Field label="Team name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Development squad" /></Field>
        <Field label="Team lead" required><select className="select" value={leadId} onChange={(e) => setLeadId(e.target.value)}><option value="">Choose…</option>{roster.map((p) => <option key={p.id} value={p.id}>{p.name} · {ROLE_LABEL[p.role] || p.role}</option>)}</select></Field>
      </div>
      <Field label={`Members${memberIds.length ? ` · ${memberIds.length} selected` : ""}`} hint="Tick everyone who reports to this lead. The lead is included automatically.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {candidates.length === 0 ? <div className="hint-line">No other members available.</div> : candidates.map((p) => {
            const on = memberIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} className="card" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", cursor: "pointer", textAlign: "left", border: on ? "1px solid var(--primary)" : "1px solid var(--border)", background: on ? "var(--primary-soft)" : "var(--surface)" }}>
                <Avatar name={p.name} url={p.photo_url} size={26} />
                <span style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[p.role] || p.role}</div></span>
                {on && <Check size={15} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
      </Field>
    </Modal>
  );
}


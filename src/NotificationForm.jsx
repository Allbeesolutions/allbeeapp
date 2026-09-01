import React, { useState } from "react";

export default function NotificationForm({ initial, team, onSave, onClose, runtime }) {
  const { Modal, Field, SearchableSelect, Bell, uid, NOTIF_LEVELS, NOTIF_AUDIENCES, ROLE_LABEL } = runtime;
  const [f, setF] = useState(initial || { title: "", body: "", level: "General", audience: "all" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");
  const people = (team || []).filter((p) => p.role !== "client");
  const save = () => { if (!f.title.trim()) { setErr("Add a title."); return; } onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), reads: f.reads || [] }); };
  return (
    <Modal title={f.id ? "Edit notification" : "New notification"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Bell size={15} />Send</button></>}>
      <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office closed Friday" /></Field>
      <Field label="Message"><textarea className="textarea" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Details\u2026" /></Field>
      <div className="grid2">
        <Field label="Priority"><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{NOTIF_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <div className="field"><label>Send to</label><SearchableSelect value={f.audience} onChange={(value) => set("audience", value)} ariaLabel="Notification recipients" options={[...NOTIF_AUDIENCES.map(([k, l]) => ({ value: k, label: l })), ...people.map((p) => ({ value: "user:" + p.id, label: p.name, meta: ROLE_LABEL[p.role] || p.role }))]} /></div>
      </div>
    </Modal>
  );
}

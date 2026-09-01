import React, { useState } from "react";

export default function AnnouncementForm({ initial, onSave, onClose, runtime }) {
  const { Modal, Field, MegaphoneIcon } = runtime;
  const [f, setF] = useState(initial || { title: "", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a headline."); return; }
    onSave({ ...f, id: f.id || runtime.uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), meetingLink: (f.meetingLink || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit announcement" : "New announcement"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><MegaphoneIcon size={15} />Post</button></>}>
      <Field label="Headline" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office closed on Friday" /></Field>
      <Field label="Details"><textarea className="textarea" style={{ minHeight: 120 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="The full message…" /></Field>
      <Field label="Meeting link (optional)" hint="Paste a Google Meet / Zoom / Teams link — everyone gets a Join button."><input className="input" value={f.meetingLink || ""} onChange={(e) => set("meetingLink", e.target.value)} placeholder="https://meet.google.com/…" /></Field>
    </Modal>
  );
}

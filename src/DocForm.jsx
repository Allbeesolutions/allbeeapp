import React, { useState, useRef } from "react";

export default function DocForm({ initial, onSave, onClose, team, portalClients, runtime }) {
  const { Modal, Field, Check, SelectOther, RefreshCw, Upload, uid, uploadAttachment, DOC_CATEGORIES } = runtime;
  const [f, setF] = useState(initial || { title: "", category: "Contract", url: "", notes: "", audience: "internal", userIds: [], clientId: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, url: up.url, title: s.title || up.name })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    if (!f.url.trim()) { setErr("Add a link to the file."); return; }
    const norm = { ...f, clientId: f.audience === "client" ? f.clientId : "", userIds: f.audience === "members" ? (f.userIds || []) : [] };
    onSave({ ...norm, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), url: f.url.trim() });
  };
  return (
    <Modal title={f.id ? "Edit document" : "Add document"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. NDA template" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={DOC_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="File or link" required hint="Upload (image ≤10MB, PDF ≤50MB, other ≤25MB) or paste a link.">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://… or upload →" />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
          <input ref={fileRef} type="file" onChange={pick} style={{ display: "none" }} />
        </div>
      </Field>
      <Field label="Who can see this">
        <select className="select" value={f.audience} onChange={(e) => set("audience", e.target.value)}>
          <option value="internal">Everyone (internal team)</option>
          <option value="members">Specific team members</option>
          <option value="client">A portal client</option>
        </select>
      </Field>
      {f.audience === "members" && (
        <Field label="Team members" hint="Only these people (plus admins) can see it.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(team || []).filter((pp) => pp.role !== "client").map((pp) => {
            const on = (f.userIds || []).includes(pp.id);
            return <button type="button" key={pp.id} onClick={() => set("userIds", on ? (f.userIds || []).filter((x) => x !== pp.id) : [...(f.userIds || []), pp.id])} style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid var(--border)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "#fff" : "var(--ink)", cursor: "pointer", fontSize: 12.5 }}>{pp.name}</button>;
          })}</div>
        </Field>
      )}
      {f.audience === "client" && (
        <Field label="Portal client" hint="Shows in that client's portal under Files.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Select a client…</option>
            {(portalClients || []).map((pp) => <option key={pp.id} value={pp.id}>{pp.name} ({pp.email})</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

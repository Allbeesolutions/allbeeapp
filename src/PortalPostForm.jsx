import React, { useRef, useState } from "react";

export default function PortalPostForm({ initial, onSave, onClose, portalClients, runtime }) {
  const { Modal, Field, Send, RefreshCw, Upload, uid, uploadAttachment } = runtime;
  const [f, setF] = useState(initial || { clientId: portalClients?.[0]?.id || "", title: "", body: "", status: "In progress", kind: "update", fileUrl: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, fileUrl: up.url, title: s.title || up.name })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.clientId) { setErr("Pick a client."); return; }
    if (!f.title.trim()) { setErr("Add a heading."); return; }
    const person = (portalClients || []).find((p) => p.id === f.clientId);
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), clientName: person?.name || "", title: f.title.trim(), meetingLink: (f.meetingLink || "").trim(), fileUrl: (f.fileUrl || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit update" : "Post a client update"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Send size={15} />Post</button></>}>
      {(!portalClients || portalClients.length === 0)
        ? <p className="hint-line">No client portal accounts yet. A client creates one from the login screen (choose <b>Client</b>), then they'll appear here.</p>
        : <>
          <Field label="Client" required error={err}>
            <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>{portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}</select>
          </Field>
          <div className="grid2">
            <Field label="Type"><select className="select" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="update">Project update</option><option value="deliverable">Deliverable</option></select></Field>
            <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{["Not started", "In progress", "Review", "Completed", "On hold"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <Field label="Heading"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={f.kind === "deliverable" ? "e.g. Final logo pack" : "e.g. Homepage design ready"} /></Field>
          <Field label="Message"><textarea className="textarea" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="What's the latest for this client?" /></Field>
          {f.kind === "deliverable" && (
            <Field label="Deliverable file or link" hint="Upload the file or paste a link — the client gets a Download button.">
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" value={f.fileUrl || ""} onChange={(e) => set("fileUrl", e.target.value)} placeholder="https://… or upload →" />
                <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
                <input ref={fileRef} type="file" onChange={pick} style={{ display: "none" }} />
              </div>
            </Field>
          )}
          <Field label="Meeting link (optional)" hint="Paste a Google Meet / Zoom / Teams link — the client gets a Join button in their portal."><input className="input" value={f.meetingLink || ""} onChange={(e) => set("meetingLink", e.target.value)} placeholder="https://meet.google.com/…" /></Field>
        </>}
    </Modal>
  );
}


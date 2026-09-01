import React, { useState } from "react";

export default function InHouseForm({ initial, team = [], onSave, onClose, runtime }) {
  const { Modal, Field, SelectOther, Check, uid, todayISO, INHOUSE_CATEGORIES, PRIORITIES, INHOUSE_STAGES, ExternalLink } = runtime;
  const [f, setF] = useState(() => ({ name: "", category: "Product", lead: "", stage: "Idea", priority: "Medium", start: todayISO(), target: "", budget: "", progress: 0, link: "", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 0;
  const leads = team.filter((p) => p.role !== "client").map((p) => p.name);
  const save = () => {
    if (!valid) return;
    let link = f.link.trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link; // tolerate "site.com"
    onSave({ ...initial, id: initial?.id || uid(), name: f.name.trim(), category: f.category, lead: f.lead, stage: f.stage, priority: f.priority, start: f.start, target: f.target, budget: Number(f.budget) || 0, progress: Math.max(0, Math.min(100, Number(f.progress) || 0)), link, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit in-house project" : "New in-house project"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save project</button></>}>
      <div className="grid2">
        <Field label="Project name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="Internal CRM revamp" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => up("category", v)} options={INHOUSE_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Project lead"><select className="select" value={f.lead} onChange={(e) => up("lead", e.target.value)}><option value="">Unassigned</option>{leads.map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => up("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Start date"><input className="input" type="date" value={f.start} onChange={(e) => up("start", e.target.value)} /></Field>
        <Field label="Target date"><input className="input" type="date" value={f.target} onChange={(e) => up("target", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => up("stage", e.target.value)}>{INHOUSE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Budget (optional)"><input className="input mono" type="number" min="0" value={f.budget} onChange={(e) => up("budget", e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label={`Progress · ${Math.max(0, Math.min(100, Number(f.progress) || 0))}%`}><input type="range" min="0" max="100" step="5" value={f.progress} onChange={(e) => up("progress", e.target.value)} style={{ width: "100%" }} /></Field>
      <Field label="Project link" hint="Live URL, repo, or doc — shown as a clickable link on the card."><input className="input" type="url" value={f.link} onChange={(e) => up("link", e.target.value)} placeholder="https://edusphere.allbeesolutions.com/" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Goal, scope, who's involved…" /></Field>
    </Modal>
  );
}


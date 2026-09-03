import React, { useState } from "react";
import { Check } from "./icons.jsx";

export default function MarketingForm({ initial, onSave, onClose, runtime = {} }) {
  const { Modal, Field, uid, todayISO } = runtime;
  const [f, setF] = useState(() => ({ client: "", business: "", plan: "", monthlyFee: "", startDate: todayISO(), notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.client.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), client: f.client.trim(), business: f.business.trim(), plan: f.plan.trim(), monthlyFee: Number(f.monthlyFee) || 0, startDate: f.startDate, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit marketing client" : "New marketing client"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save client</button></>}>
      <div className="grid2">
        <Field label="Client name" required><input className="input" value={f.client} onChange={(e) => up("client", e.target.value)} /></Field>
        <Field label="Business name"><input className="input" value={f.business} onChange={(e) => up("business", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Plan name"><input className="input" value={f.plan} onChange={(e) => up("plan", e.target.value)} placeholder="Growth / Social" /></Field>
        <Field label="Monthly fee"><input className="input mono" type="number" min="0" value={f.monthlyFee} onChange={(e) => up("monthlyFee", e.target.value)} /></Field>
      </div>
      <Field label="Start date"><input className="input" type="date" value={f.startDate} onChange={(e) => up("startDate", e.target.value)} /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}


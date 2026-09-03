import React, { useState } from "react";
import { Check } from "./icons.jsx";

export default function PlannedForm({ initial, onSave, onClose, runtime = {} }) {
  const { Modal, Field, SelectOther, uid, todayISO, EXPENSE_CATEGORIES = ["Office Rent", "Utilities", "Software", "Other"], EXPENSE_RECURRENCE = ["Monthly", "Quarterly", "Yearly", "One-time"], PLANNED_STATUS = ["Planned", "Paid", "Cancelled"] } = runtime;
  const [f, setF] = useState(initial || { title: "", category: "Office Rent", amount: "", recurrence: "Monthly", status: "Planned", nextDue: todayISO(), notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Name this expense."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), amount: Number(f.amount) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit planned expense" : "New planned expense"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <Field label="What is it?" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office rent" /></Field>
      <div className="grid2">
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={EXPENSE_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
        <Field label="Amount (₹)"><input className="input" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid2">
        <Field label="Repeats"><select className="select" value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)}>{EXPENSE_RECURRENCE.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Next due"><input className="input" type="date" value={f.nextDue} onChange={(e) => set("nextDue", e.target.value)} /></Field>
      </div>
      <Field label="Status"><select className="select" value={f.status || "Planned"} onChange={(e) => set("status", e.target.value)}>{PLANNED_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
    </Modal>
  );
}


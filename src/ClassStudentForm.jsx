import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Icons from "./icons.jsx";
const { Check, Plus, Lightbulb, ArrowRight, Pencil, Trash2 } = Icons;

export default function ClassStudentForm({ initial, onSave, onClose, runtime = {} }) {
  const { Modal, Field, uid, todayISO, CLASS_COURSES = [], CLASS_MODES = ["Offline", "Online"] } = runtime;
  const [f, setF] = useState(() => ({ name: "", phone: "", email: "", course: "", mode: "Offline", batch: "", joinDate: todayISO(), fee: "", paid: "", paymentStatus: "Unpaid", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = (f.name || "").trim().length > 0;
  const save = () => {
    if (!valid) return;
    onSave({
      ...initial,
      id: initial?.id || uid(),
      name: f.name.trim(), phone: (f.phone || "").trim(), email: (f.email || "").trim(),
      course: (f.course || "").trim(), mode: f.mode || "Offline", batch: (f.batch || "").trim(),
      joinDate: f.joinDate, fee: Number(f.fee) || 0, paid: Number(f.paid) || 0,
      paymentStatus: f.paymentStatus, notes: (f.notes || "").trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit class student" : "New class student"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save student</button></>}>
      <div className="grid2">
        <Field label="Student name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label="Phone number"><input className="input" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+91…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Course"><input className="input" list="class-course-list" value={f.course} onChange={(e) => up("course", e.target.value)} placeholder="MS Office, Tally, Python…" />
          <datalist id="class-course-list">{CLASS_COURSES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Class mode"><select className="select" value={f.mode} onChange={(e) => up("mode", e.target.value)}>{CLASS_MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Batch / timing"><input className="input" value={f.batch} onChange={(e) => up("batch", e.target.value)} placeholder="Morning 10–11" /></Field>
      </div>
      <div className="grid2">
        <Field label="Joining date"><input className="input" type="date" value={f.joinDate} onChange={(e) => up("joinDate", e.target.value)} /></Field>
        <Field label="Payment status"><select className="select" value={f.paymentStatus} onChange={(e) => up("paymentStatus", e.target.value)}>{["Unpaid", "Partial", "Paid"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Total fee"><input className="input mono" type="number" min="0" value={f.fee} onChange={(e) => up("fee", e.target.value)} /></Field>
        <Field label="Amount paid"><input className="input mono" type="number" min="0" value={f.paid} onChange={(e) => up("paid", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

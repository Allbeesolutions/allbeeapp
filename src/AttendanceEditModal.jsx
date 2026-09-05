import React from "react";
export default function AttendanceEditModal({ member, record, date, onSave, onClear, onClose, runtime }) {
  const { useState, Modal, Field, Check, Trash2, emitToast, fmtDate } = runtime;
  const toTimeInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const [inT, setInT] = useState(toTimeInput(record?.checkIn) || "09:00");
  const [outT, setOutT] = useState(toTimeInput(record?.checkOut));
  const atTime = (hhmm) => {
    if (!hhmm) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = hhmm.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  };
  const save = () => {
    if (!inT) return;
    const ci = atTime(inT);
    const co = atTime(outT);
    if (co && new Date(co) < new Date(ci)) { emitToast("Check-out can't be before check-in.", "error"); return; }
    onSave(ci, co);
  };
  return (
    <Modal title={`Edit attendance — ${member.name}`} onClose={onClose}
      footer={<>
        {record && <button className="btn danger" style={{ marginRight: "auto" }} onClick={onClear}><Trash2 size={15} />Mark absent</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!inT}><Check size={16} />Save</button>
      </>}>
      <p className="hint-line" style={{ marginBottom: 14, lineHeight: 1.5 }}>Set the check-in and check-out for <b style={{ color: "var(--ink)" }}>{fmtDate(date)}</b>. Leave check-out empty to mark them still checked in.</p>
      <div className="grid2">
        <Field label="Check in" required><input className="input" type="time" value={inT} onChange={(e) => setInT(e.target.value)} /></Field>
        <Field label="Check out"><input className="input" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}


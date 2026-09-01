export default function LeaveForm({ initial, me, onSave, onClose, runtime }) {
  const { useState, Modal, Field, SelectOther, Check, uid, todayISO, daysBetween, LEAVE_TYPES } = runtime;
  const [f, setF] = useState(() => ({ type: "Casual", fromDate: todayISO(), toDate: todayISO(), reason: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const days = daysBetween(f.fromDate, f.toDate);
  const valid = f.fromDate && f.toDate && f.toDate >= f.fromDate && f.reason.trim().length > 0 && (f.type !== "Other" || (f.customType || "").trim().length > 0);
  const save = () => {
    if (!valid) return;
    onSave({ ...initial, id: initial?.id || uid(), userId: me.id, userName: me.name, type: f.type === "Other" ? ((f.customType || "").trim() || "Other") : f.type, fromDate: f.fromDate, toDate: f.toDate, days, reason: f.reason.trim(), status: initial?.status || "Pending", createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit leave request" : "Request leave"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Submit request</button></>}>
      <Field label="Leave type"><SelectOther value={f.type} onChange={(v) => up("type", v)} options={LEAVE_TYPES.filter((t) => t !== "Other")} placeholder="Other reason…" /></Field>
      {f.type === "Other" && <Field label="Specify type" required><input className="input" value={f.customType || ""} onChange={(e) => up("customType", e.target.value)} placeholder="e.g. Bereavement" /></Field>}
      <div className="grid2">
        <Field label="From" required><input className="input" type="date" value={f.fromDate} onChange={(e) => up("fromDate", e.target.value)} /></Field>
        <Field label="To" required><input className="input" type="date" value={f.toDate} min={f.fromDate} onChange={(e) => up("toDate", e.target.value)} /></Field>
      </div>
      <div className="hint-line" style={{ marginBottom: 12 }}>{days > 0 ? `${days} day${days > 1 ? "s" : ""}` : "Pick valid dates"}{f.toDate < f.fromDate ? " · end date is before start" : ""}</div>
      <Field label="Reason" required><textarea className="textarea" value={f.reason} onChange={(e) => up("reason", e.target.value)} placeholder="Briefly, why you need this leave." /></Field>
    </Modal>
  );
}

import React, { useState } from "react";

export default function RewardForm({ initial, onSave, onClose, team, runtime }) {
  const { Modal, Field, SelectOther, Award, Check, uid, todayISO, REWARD_KINDS } = runtime;
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role));
  const [f, setF] = useState(initial || { userId: staff[0]?.id || "", kind: "Star performer", points: 10, note: "", date: todayISO() });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.userId) { setErr("Pick a team member."); return; }
    const person = staff.find((p) => p.id === f.userId);
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), userName: person?.name || "", points: Number(f.points) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit recognition" : "Give recognition"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Award size={15} />Award</button></>}>
      <Field label="To" required error={err}>
        <select className="select" value={f.userId} onChange={(e) => set("userId", e.target.value)}>
          {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="For"><SelectOther value={f.kind} onChange={(v) => set("kind", v)} options={REWARD_KINDS} placeholder="Custom recognition…" /></Field>
        <Field label="Points"><input className="input" type="number" value={f.points} onChange={(e) => set("points", e.target.value)} /></Field>
      </div>
      <Field label="Note"><textarea className="textarea" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="What did they do well?" /></Field>
    </Modal>
  );
}


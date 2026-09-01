export default function ResignForm({ existing, onSave, onClose, runtime }) {
  const { useState, Modal, Field, Check, todayISO, fmtDate } = runtime;
  const mine = (existing || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState("");
  const pending = mine && mine.status === "Pending";
  const approved = mine && mine.status === "Approved";
  const submit = () => { if (!reason.trim()) return; onSave({ reason: reason.trim(), lastDay: lastDay || null }); };
  return (
    <Modal title="Resignation" onClose={onClose}
      footer={(pending || approved)
        ? <button className="btn" onClick={onClose}>Close</button>
        : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}><Check size={15} />Submit request</button></>}>
      {approved ? <p className="hint-line">Your resignation has been approved. Thank you for your time with the team.</p>
        : pending ? <p className="hint-line">Your resignation request was submitted{mine.lastDay ? ` with a proposed last working day of ${fmtDate(mine.lastDay)}` : ""} and is pending review by an admin.</p>
        : <>
          <p className="hint-line" style={{ marginBottom: 10 }}>This notifies your admins. They'll confirm your last working day and offboard your access.</p>
          <Field label="Reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly, why are you resigning?" /></Field>
          <Field label="Proposed last working day"><input className="input" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} min={todayISO()} /></Field>
        </>}
    </Modal>
  );
}

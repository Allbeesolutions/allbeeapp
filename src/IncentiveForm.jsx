export default function IncentiveForm({ person, onAdd, onClose, runtime }) {
  const { useState, Modal, Field, Gift, Plus, todayISO, uid, round2 } = runtime;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState("");
  const save = () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    onAdd({ id: uid(), amount: round2(amt), note: note.trim(), date, createdAt: Date.now() });
  };
  return (
    <Modal title={`Add incentive — ${person.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Plus size={15} />Add incentive</button></>}>
      <div className="banner" style={{ margin: "0 0 12px" }}><Gift size={15} /> A one-off bonus — a festival bonus, a spot reward, a performance incentive. It's added to what this person has earned to date.</div>
      <div className="grid2">
        <Field label="Amount" required error={err}><input className="input mono" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" autoFocus /></Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Reason (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali bonus, top performer" /></Field>
    </Modal>
  );
}


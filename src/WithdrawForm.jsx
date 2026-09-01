import React, { useState } from "react";

export default function WithdrawForm({ balances, defaultUser, onSave, onClose, runtime }) {
  const { Modal, Field, Check, USERS, todayISO, round2, uid, money } = runtime;
  const [user, setUser] = useState(defaultUser || "Haji");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const avail = balances[user] || 0;
  const amt = Number(amount) || 0;
  const over = amt > avail;
  const valid = amt > 0 && !over;
  const after = round2(avail - amt);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ id: uid(), user, amount: amt, date, notes: notes.trim(), createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Record withdrawal" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Withdraw</button></>}>
      <Field label="Who is withdrawing" required>
        <div className="seg">{USERS.map((u) => <button key={u} className={user === u ? "on" : ""} onClick={() => setUser(u)}>{u}</button>)}</div>
      </Field>
      <div className="calc-box"><div className="calc-row"><span style={{ color: "var(--muted)" }}>{user}'s available balance</span>
        <span className="mono" style={{ fontWeight: 700 }}>{money(avail)}</span></div></div>
      <div className="grid2">
        <Field label="Amount" required error={touched && amt <= 0 ? "Enter an amount" : over ? `Can't exceed available balance (${money(avail)})` : ""}>
          <input className="input mono" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </Field>
        <Field label="Date" required><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {amt > 0 && !over && (
        <div className="hint-line">Balance after withdrawal: <b className="mono">{money(after)}</b></div>
      )}
      <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / reference" /></Field>
    </Modal>
  );
}

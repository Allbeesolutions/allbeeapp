export default function ClientForm({ initial, onSave, onClose, existing }) {
  const [f, setF] = useState(initial || { name: "", phone: "", email: "", company: "", status: "Prospect", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  // duplicate detection on phone / email (ignore the record being edited)
  const dupe = (existing || []).find((c) => c.id !== f.id && ((f.phone && c.phone && c.phone.replace(/\D/g, "") === f.phone.replace(/\D/g, "")) || (f.email && c.email && c.email.toLowerCase() === f.email.toLowerCase())));
  const save = () => {
    if (!f.name.trim()) { setErr("Add the client's name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), name: f.name.trim(), value: Number(f.value) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit client" : "New client"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save client</button></>}>
      <Field label="Name" required error={err}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Client name" /></Field>
      {dupe && <div className="auth-msg err" style={{ marginTop: -4 }}><AlertTriangle size={14} /> Looks like a duplicate of <b style={{ margin: "0 4px" }}>{dupe.name}</b> — same {dupe.email && f.email && dupe.email.toLowerCase() === f.email.toLowerCase() ? "email" : "phone"}.</div>}
      <div className="grid2">
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email" /></Field>
      </div>
      <div className="grid2">
        <Field label="Company"><input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Business name (optional)" /></Field>
        <Field label="Status"><select className="select" value={f.status || "Prospect"} onChange={(e) => set("status", e.target.value)}>{CLIENT_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      <Field label="Deal value" hint="Contract value for this client. Commission credits the person who added them once the status is Active."><input className="input mono" type="number" min="0" value={f.value ?? ""} onChange={(e) => set("value", e.target.value)} placeholder="0" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering" /></Field>
    </Modal>
  );
}


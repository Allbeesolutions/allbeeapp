export default function ConceptForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ title: "", notes: "", date: todayISO(), ...initial, tags: Array.isArray(initial?.tags) ? initial.tags.join(", ") : initial?.tags || "" }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.title.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), title: f.title.trim(), notes: f.notes.trim(), tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), date: f.date, createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit idea" : "New idea"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save idea</button></>}>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Subscription billing tool" /></Field>
      <Field label="Detailed notes"><textarea className="textarea" style={{ minHeight: 120 }} value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Flesh out the idea…" /></Field>
      <div className="grid2">
        <Field label="Tags" hint="Comma separated"><input className="input" value={f.tags} onChange={(e) => up("tags", e.target.value)} placeholder="saas, future, B2B" /></Field>
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => up("date", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}


export default function ProjectForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ client: "", name: "", type: "Website", cost: "", start: todayISO(), expected: "", stage: "Lead", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), client: f.client.trim(), name: f.name.trim(), type: f.type, cost: Number(f.cost) || 0, start: f.start, expected: f.expected, stage: f.stage, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit project" : "New project"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save project</button></>}>
      <div className="grid2">
        <Field label="Project name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="E-commerce site" /></Field>
        <Field label="Client name"><input className="input" value={f.client} onChange={(e) => up("client", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Project type"><SelectOther value={f.type} onChange={(v) => up("type", v)} options={["Website", "Mobile App", "Software"]} placeholder="Custom type…" /></Field>
        <Field label="Cost"><input className="input mono" type="number" min="0" value={f.cost} onChange={(e) => up("cost", e.target.value)} placeholder="50000" /></Field>
      </div>
      <div className="grid2">
        <Field label="Start date"><input className="input" type="date" value={f.start} onChange={(e) => up("start", e.target.value)} /></Field>
        <Field label="Expected completion"><input className="input" type="date" value={f.expected} onChange={(e) => up("expected", e.target.value)} /></Field>
      </div>
      <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => up("stage", e.target.value)}>{PROJECT_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}


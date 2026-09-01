export default function KbForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", category: "How-to", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim() });
  };
  return (
    <Modal title={f.id ? "Edit article" : "New article"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. How to onboard a client" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={KB_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Content"><textarea className="textarea" style={{ minHeight: 180 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write the guide…" /></Field>
    </Modal>
  );
}


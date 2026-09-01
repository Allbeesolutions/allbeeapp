export default function PromptForm({ initial, onSave, onClose, runtime }) {
  const { Modal, Field, SelectOther, Check, uid, PROMPT_CATEGORIES } = runtime;
  const [f, setF] = useState(initial || { title: "", category: "General", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    if (!(f.body || "").trim()) { setErr("Add the prompt text."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim() });
  };
  return (
    <Modal title={f.id ? "Edit prompt" : "New prompt"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Cold outreach email" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={PROMPT_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Prompt" required><textarea className="textarea" style={{ minHeight: 200 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Paste or write the full prompt here…" /></Field>
    </Modal>
  );
}


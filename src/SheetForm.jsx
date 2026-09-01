export default function SheetForm({ initial, onSave, onClose, runtime }) {
  const { Modal, Field, SelectOther, Check, uid, SHEET_CATEGORIES } = runtime;
  const [f, setF] = useState(initial || { title: "", url: "", category: "General", note: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a name."); return; }
    const url = f.url.trim();
    if (!/^https?:\/\//i.test(url)) { setErr("Add a valid link starting with http(s)://"); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), url });
  };
  return (
    <Modal title={f.id ? "Edit sheet link" : "Add a sheet link"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Name" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 2026 Expense tracker" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={SHEET_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Link" required hint="Paste the Google Sheets (or any spreadsheet) URL."><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" /></Field>
      <Field label="Note"><textarea className="textarea" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="What's in this sheet? (optional)" /></Field>
    </Modal>
  );
}


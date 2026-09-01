export default function VaultForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { service: "", category: "Social", username: "", password: "", url: "", notes: "" });
  const [show, setShow] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.service.trim()) { setErr("Name the service."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), service: f.service.trim() });
  };
  return (
    <Modal title={f.id ? "Edit credential" : "New credential"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Service" required error={err}><input className="input" value={f.service} onChange={(e) => set("service", e.target.value)} placeholder="e.g. Instagram" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={VAULT_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Username / email"><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="login@…" /></Field>
      <Field label="Password">
        <div style={{ display: "flex", gap: 6 }}>
          <input className="input" type={show ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
          <button className="iconbtn" onClick={() => setShow((v) => !v)} type="button" aria-label="Show/hide">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </Field>
      <Field label="Login URL"><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></Field>
      <Field label="Notes" hint="Recovery email, 2FA backup codes, etc."><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}


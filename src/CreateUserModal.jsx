export default function CreateUserModal({ onClose, onActivity, runtime }) {
  const { useState, Modal, Field, PasswordField, supabase, ROLE_OPTIONS, ROLE_LABEL, RefreshCw, Plus, Check, AlertTriangle } = runtime;
  const [f, setF] = useState({ name: "", email: "", password: "", role: "staff" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const create = async () => {
    if (!f.email.trim() || f.password.length < 6) { setErr("Enter an email and a password of at least 6 characters."); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "create", email: f.email.trim(), password: f.password, name: f.name.trim(), role: f.role } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      onActivity?.({ action: `created user "${f.name.trim() || f.email.trim()}"`, module: "System", entity: "User", entityId: data?.user?.id || null });
      setOk(true);
    } catch (e) { setErr((e && e.message) || "Couldn't create the user. Is the admin-users function deployed?"); }
    finally { setBusy(false); }
  };
  if (ok) return <Modal title="User created" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}><p className="hint-line" style={{ lineHeight: 1.6 }}>{f.name || f.email} can now sign in with the email and password you set. The account is confirmed and approved.</p></Modal>;
  return (
    <Modal title="Add a user" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}Create user</button></>}>
      <div className="grid2">
        <Field label="Full name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Priya Sharma" /></Field>
        <Field label="Role"><select className="select" value={f.role} onChange={(e) => set("role", e.target.value)}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
      </div>
      <Field label="Email" required><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@allbee.in" /></Field>
      <PasswordField label="Password" required hint="At least 6 characters. Share it with them securely." value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Temporary password" autoComplete="new-password" />
      {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
      <p className="hint-line" style={{ marginTop: 8 }}>Requires the <b>admin-users</b> edge function to be deployed.</p>
    </Modal>
  );
}

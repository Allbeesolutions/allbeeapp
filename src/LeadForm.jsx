export default function LeadForm({ initial, onSave, onClose, runtime }) {
  const { useState, Modal, Field, SelectOther, Check, uid, LEAD_SOURCES, LEAD_STAGES, LEAD_SERVICES } = runtime;
  const [f, setF] = useState(initial || { name: "", company: "", phone: "", email: "", source: "Referral", referredBy: "", leadOwner: "", service: "Website", stage: "New", value: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.name.trim()) { setErr("Add the lead's name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), name: f.name.trim(), value: Number(f.value) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit lead" : "New lead"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save lead</button></>}>
      <Field label="Name" required error={err}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Person or business" /></Field>
      <div className="grid2">
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email" /></Field>
      </div>
      <div className="grid2">
        <Field label="Source"><SelectOther value={f.source} onChange={(v) => set("source", v)} options={LEAD_SOURCES.filter((s) => s !== "Other")} placeholder="e.g. Ajis, Saranya…" /></Field>
        <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => set("stage", e.target.value)}>{LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Company"><input className="input" value={f.company || ""} onChange={(e) => set("company", e.target.value)} placeholder="Business name" /></Field>
        <Field label="Service interested"><SelectOther value={f.service || "Website"} onChange={(v) => set("service", v)} options={LEAD_SERVICES.filter((x) => x !== "Other")} placeholder="Custom service…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Referred by"><input className="input" value={f.referredBy || ""} onChange={(e) => set("referredBy", e.target.value)} placeholder="Who referred them?" /></Field>
        <Field label="Lead owner"><input className="input" value={f.leadOwner || ""} onChange={(e) => set("leadOwner", e.target.value)} placeholder="Who owns this lead?" /></Field>
      </div>
      <Field label="Estimated value (₹)"><input className="input" type="number" value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="0" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What do they need?" /></Field>
    </Modal>
  );
}

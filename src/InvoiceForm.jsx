export default function InvoiceForm({ initial, clients, portalClients, onSave, onClose, runtime = {} }) {
  const { Modal, Field, Check, uid, todayISO, INVOICE_STATUS } = runtime;
  const [f, setF] = useState(initial || { number: "INV-" + String(Date.now()).slice(-5), client: "", clientId: "", title: "", amount: "", status: "Draft", dueDate: todayISO(), notes: "" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => { if (!f.client.trim()) { setErr("Add a client."); return; } onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), client: f.client.trim(), amount: Number(f.amount) || 0 }); };
  return (
    <Modal title={f.id ? "Edit invoice" : "New invoice"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save invoice</button></>}>
      <div className="grid2">
        <Field label="Invoice #"><input className="input" value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="INV-001" /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{INVOICE_STATUS.map((sv) => <option key={sv}>{sv}</option>)}</select></Field>
      </div>
      <Field label="Client" required error={err}>
        <input className="input" list="inv-clients" value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Client name" />
        <datalist id="inv-clients">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <Field label="Description"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website \u2014 milestone 1" /></Field>
      <div className="grid2">
        <Field label="Amount (\u20b9)"><input className="input mono" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" /></Field>
        <Field label="Due date"><input className="input" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
      </div>
      {portalClients && portalClients.length > 0 && (
        <Field label="Share to portal client" hint="Optional \u2014 lets that client see this invoice and its payment status.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Don't share</option>
            {portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Payment terms, bank details, etc." /></Field>
    </Modal>
  );
}


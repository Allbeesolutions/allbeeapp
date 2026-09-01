import React, { useState, useRef } from "react";

export default function QuotationForm({ initial, onSave, onClose, clients, portalClients, runtime }) {
  const { Modal, Field, Check, X, Plus, RefreshCw, Upload, uid, round2, money, uploadAttachment, QUOTE_STATUS } = runtime;
  const [f, setF] = useState(initial || { client: "", clientId: "", title: "", status: "Draft", notes: "", items: [{ desc: "", qty: 1, rate: 0 }], pdfUrl: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setItem = (i, k, v) => setF((s) => ({ ...s, items: s.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setF((s) => ({ ...s, items: [...s.items, { desc: "", qty: 1, rate: 0 }] }));
  const delItem = (i) => setF((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }));
  const total = (f.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const [err, setErr] = useState("");
  const pdfRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pickPdf = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, pdfUrl: up.url })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.client.trim()) { setErr("Add a client name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), client: f.client.trim(), total: round2(total), pdfUrl: (f.pdfUrl || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit quotation" : "New quotation"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save quotation</button></>}>
      <div className="grid2">
        <Field label="Client" required error={err}>
          <input className="input" list="quote-clients" value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Client name" />
          <datalist id="quote-clients">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{QUOTE_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Title"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website + branding" /></Field>
      {portalClients && portalClients.length > 0 && (
        <Field label="Share to portal client" hint="Optional — lets that client see this quote when they sign in.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Don't share</option>
            {portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
          </select>
        </Field>
      )}
      <div className="field">
        <label>Line items</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(f.items || []).map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 90px 32px", gap: 6, alignItems: "center" }}>
              <input className="input" value={it.desc} onChange={(e) => setItem(i, "desc", e.target.value)} placeholder="Description" />
              <input className="input" type="number" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} placeholder="Qty" />
              <input className="input" type="number" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} placeholder="Rate" />
              <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => delItem(i)} disabled={f.items.length === 1}><X size={14} /></button>
            </div>
          ))}
        </div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={addItem}><Plus size={13} />Add line</button>
      </div>
      <div className="calc-box"><div className="calc-row"><span>Total</span><b className="mono">{money(total)}</b></div></div>
      <Field label="Attach PDF" hint="Optional — store a PDF of this quotation (≤50MB).">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={f.pdfUrl || ""} onChange={(e) => set("pdfUrl", e.target.value)} placeholder="https://… or upload →" />
          <button className="btn" type="button" onClick={() => pdfRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
          <input ref={pdfRef} type="file" accept="application/pdf" onChange={pickPdf} style={{ display: "none" }} />
        </div>
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Terms, validity, etc." /></Field>
    </Modal>
  );
}

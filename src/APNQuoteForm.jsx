import React from "react";

export default function APNQuoteForm({ meRow, initial, onSave, onClose, runtime }) {
  const { useState, supabase, uid, round2, money, Modal, Field, APN_SERVICES, APN_TIEUPS, Send, X } = runtime;
  const [service, setService] = useState(initial?.service || "website");
  const [price, setPrice] = useState(null);
  const [priceBusy, setPriceBusy] = useState(true);
  const [clientName, setClientName] = useState(initial?.clientName || "");
  const [requirements, setRequirements] = useState(initial?.requirements || "");
  const [tieUp, setTieUp] = useState(initial?.tieUp || "");
  const [items, setItems] = useState(initial?.items || null);
  React.useEffect(() => {
    let alive = true;
    setPriceBusy(true);
    supabase.rpc("knowledge_get_pricing", { p_service: service }).then(({ data, error }) => {
      if (!alive) return;
      setPrice(error ? { base: null, baseLabel: "Custom quotation", options: [], customQuote: true } : (data || { base: null, baseLabel: "Custom quotation", options: [], customQuote: true }));
      setPriceBusy(false);
    });
    return () => { alive = false; };
  }, [service]);
  React.useEffect(() => {
    if (!initial && price && !priceBusy) setItems(price.base == null ? [] : [{ id: uid(), label: price.baseLabel || "Base service", amount: Number(price.base) || 0 }]);
  }, [initial, price, priceBusy]);
  const base = items || (price?.base == null ? [] : [{ id: uid(), label: price.baseLabel || "Base service", amount: Number(price.base) || 0 }]);
  const list = items || base;
  const total = list.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const addOpt = (label, amount) => setItems((prev) => [...(prev || base), { id: uid(), label, amount }]);
  const upItem = (id, k, v) => setItems((prev) => (prev || base).map((it) => it.id === id ? { ...it, [k]: k === "amount" ? Number(v) || 0 : v } : it));
  const rmItem = (id) => setItems((prev) => (prev || base).filter((it) => it.id !== id));
  const save = (status) => {
    if (!clientName.trim()) return;
    onSave({ id: initial?.id || uid(), partnerId: meRow.id, partnerName: meRow.name, clientName: clientName.trim(), service, requirements: requirements.trim(), tieUp, items: list, total: round2(total), status, createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit quotation" : "Generate quotation"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn" onClick={() => save("Draft")} disabled={!clientName.trim()}>Save draft</button><button className="btn primary" onClick={() => save("Sent for approval")} disabled={!clientName.trim()}><Send size={15} />Send for approval</button></>}>
      <div className="grid2">
        <Field label="Client name" required><input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client / business" /></Field>
        <Field label="Service"><select className="select" value={service} onChange={(e) => setService(e.target.value)} disabled={!!initial?.id}>{APN_SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <Field label="Requirements"><textarea className="textarea" value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="What does the client need?" /></Field>
      <Field label="Tie-up with the client" hint="Express an optional tie-up — reciprocal deals govern both sides of the relationship.">
        <select className="select" value={tieUp} onChange={(e) => setTieUp(e.target.value)}>
          <option value="">No tie-up</option>
          {(APN_TIEUPS[service] || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Add-ons" hint={priceBusy ? "Loading official pricing…" : price?.customQuote ? "This service is quoted after scope review." : "Tap to add an official add-on — you can edit every line below."}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(price?.options || []).map((option) => <button key={option.key} type="button" className="preset" disabled={priceBusy} onClick={() => addOpt(option.label, Number(option.amount) || 0)}>+ {option.label} {option.amount != null ? `(₹${Number(option.amount).toLocaleString("en-IN")})` : "(custom quote)"}</button>)}</div>
      </Field>
      <Field label="Quotation lines">
        <div className="apn-list">{list.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" value={it.label} onChange={(e) => upItem(it.id, "label", e.target.value)} style={{ flex: 1 }} />
            <input className="input mono" type="number" value={it.amount} onChange={(e) => upItem(it.id, "amount", e.target.value)} style={{ width: 110 }} />
            <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => rmItem(it.id)}><X size={14} /></button>
          </div>
        ))}</div>
        <div className="calc-box" style={{ marginTop: 10 }}><div className="calc-row"><b>Total</b><b className="mono">{money(total)}</b></div></div>
      </Field>
    </Modal>
  );
}

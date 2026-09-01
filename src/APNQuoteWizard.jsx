import React, { useState, useMemo } from "react";
import * as Icons from "./icons.jsx";

export default function APNQuoteWizard(props) {
  const {  meRow, onSave, onClose, go  } = props;
  const { APN_SERVICES, Field, Modal, QUOTE_BUSINESS_EMAIL, QUOTE_DISCLAIMER, QUOTE_SERVICE_LABEL, QUOTE_SITE_TYPES, QUOTE_STEP_LABELS, QUOTE_TECHS, QUOTE_URGENT_RATE, emitToast, money, round2, shareQuoteVia, uid } = props.runtime || {};
  const { Check, Download, FileText, Mail, MessageCircle, Phone, RotateCcw, Save, Send } = Icons;

  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [price, setPrice] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [siteType, setSiteType] = useState(null);
  const [tech, setTech] = useState(null);
  const [addons, setAddons] = useState([]);
  const [urgent, setUrgent] = useState(null);
  const [clientName, setClientName] = useState("");
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const isWeb = service === "website";
  const stepNow = () => {
    if (!isWeb && step >= 1) {
      const order = [0, 3, 4, 5, 6];
      const idx = order.indexOf(step);
      return order[Math.max(0, idx - 1)];
    }
    return Math.max(0, step - 1);
  };
  const stepNext = () => {
    if (step === 2 && !isWeb) { setStep(3); return; }
    setStep((s) => Math.min(6, s + 1));
  };
  const chooseService = (key) => {
    setService(key); setAddons([]); setSiteType(null); setTech(null); setDone(null);
    setPriceBusy(true);
    supabase.rpc("knowledge_get_pricing", { p_service: key }).then(({ data, error }) => {
      if (error || !data || data.base === null) {
        emitToast("Could not load official pricing. Please check your network connection.", "error");
        setPrice(null);
      } else {
        setPrice(data);
      }
      setPriceBusy(false);
    });
    setStep(key === "website" ? 1 : 3);
  };
  const optOf = (k) => (price?.options || []).find((o) => o.key === k);
  const itemId = () => `qi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const items = (() => {
    if (!service || !price) return [];
    const lines = [];

    // Use full catalog line items if available, else fall back to base
    if (price.lineItems && price.lineItems.length) {
      for (const li of price.lineItems) {
        lines.push({
          id: itemId(),
          label: li.label,
          amount: li.amount !== null ? Number(li.amount) : null,
          isBase: !!li.isBase
        });
      }
    } else {
      lines.push({ id: itemId(), label: price.baseLabel || QUOTE_SERVICE_LABEL[service], amount: price.base !== null ? Number(price.base) : null });
    }

    if (isWeb) {
      if (siteType === "ecommerce" && optOf("ecommerce")) {
        lines.push({ id: itemId(), label: optOf("ecommerce").label, amount: Number(optOf("ecommerce").amount) || 0 });
      }
      if (siteType === "dynamic") {
        lines.push({ id: itemId(), label: "Dynamic website build (modules and content)", amount: null });
      }
      if (siteType === "custom") {
        lines.push({ id: itemId(), label: "Custom build engineering", amount: null });
      }
      if (addons.includes("business_email")) {
        const opt = optOf("business_email");
        if (opt) {
          // Handled by the addons loop below
        } else if (!lines.some((l) => l.label.includes("Business Email"))) {
          lines.push({ id: itemId(), label: QUOTE_BUSINESS_EMAIL.label, amount: QUOTE_BUSINESS_EMAIL.amount });
        }
      }
      if (addons.includes("source_code")) {
        lines.push({ id: itemId(), label: "Source code handover", amount: null });
      }
    }

    for (const k of addons) {
      const o = optOf(k);
      if (o) {
        lines.push({ id: itemId(), label: o.label, amount: o.amount !== null ? Number(o.amount) : null });
      }
    }
    return lines;
  })();
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const surcharge = urgent ? round2(subtotal * QUOTE_URGENT_RATE) : 0;
  const total = round2(subtotal + surcharge);
  const addonLabel = (k) => k === "business_email" ? "Business Email (per year)" : k === "source_code" ? "Source code handover" : (optOf(k)?.label || k);
  const requirements = [QUOTE_SERVICE_LABEL[service], siteType ? (QUOTE_SITE_TYPES.find(([k2]) => k2 === siteType) || [])[1] : null, tech && tech !== "No Preference" ? `Tech: ${tech}` : null, addons.length ? addons.map(addonLabel).join(", ") : null, urgent ? "Urgent delivery" : null].filter(Boolean).join(" · ");
  const toggleAddon = (k) => setAddons((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const startOver = () => { setService(null); setPrice(null); setSiteType(null); setTech(null); setAddons([]); setUrgent(null); setClientName(""); setBusiness(""); setContact(""); setDone(null); setStep(0); };
  const saveQuote = (status) => {
    if (saving) return;
    if (!clientName.trim()) { emitToast("Add the client's name to save the quotation.", "error"); return; }
    setSaving(true);
    const id = uid();
    const qq = {
      id, partnerId: meRow.id, partnerName: meRow.name,
      clientName: clientName.trim(), business: business.trim(), contact: contact.trim(),
      service, siteType, tech: tech && tech !== "No Preference" ? tech : "", urgent: !!urgent,
      requirements, items, subtotal, total,
      quoteNo: "QT" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + id.slice(0, 4).toUpperCase(),
      status, createdAt: Date.now(),
      catalogSnapshot: price ? {
        packageName: price.package,
        packageSlug: price.packageSlug,
        packageDesc: price.packageDesc,
        features: price.features || [],
        limits: price.limits || [],
        deliveryMin: price.deliveryMin,
        deliveryMax: price.deliveryMax,
        deliveryNote: price.deliveryNote,
        paymentTerms: price.paymentTerms,
        hostingIncluded: !!price.hostingIncluded,
        domainIncluded: !!price.domainIncluded,
        sslIncluded: !!price.sslIncluded,
        supportDays: price.supportDays || 0,
        disclaimer: price.disclaimer
      } : null
    };
    onSave(qq, status);
    setSaving(false);
    setDone(qq);
    setStep(7);
  };
  const chip = (active, onClick, label, sub) => (
    <button type="button" className={`apn-rowcard wizard-card${active ? " wizard-card-active" : ""}`} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 700, flex: 1 }}>{label}</span>
        {active && <Check size={16} color="var(--primary)" />}
      </div>
      {sub && <div className="hint-line" style={{ marginTop: 4, fontSize: 12 }}>{sub}</div>}
    </button>
  );
  const canContinue = !price ? false : (step === 0 ? !!service : step === 1 ? !!siteType : step === 2 ? !!tech : step === 3 ? true : step === 4 ? urgent != null : step === 5 ? !!clientName.trim() : true);
  return (
    <Modal title="Generate Quotation" onClose={onClose}
      footer={step === 7 ? <><button className="btn" onClick={onClose}>Done</button></>
        : <><button className="btn" onClick={() => (step === 0 ? onClose() : setStep(stepNow()))} disabled={saving}>{step === 0 ? "Cancel" : "Back"}</button><button className="btn" onClick={startOver} disabled={saving}><RotateCcw size={14} />Start over</button><span className="spacer" />{step < 6 && <button className="btn primary" onClick={stepNext} disabled={!canContinue || saving}>Continue</button>}</>}>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {QUOTE_STEP_LABELS.map((l, i) => <i key={l} title={l} style={{ height: 5, flex: 1, borderRadius: 3, background: i <= step ? "var(--primary)" : "var(--border)", transition: "background .2s" }} />)}
      </div>
      <div className="hint-line" style={{ margin: "-8px 0 12px" }}>Step {Math.min(step + 1, 7)} of 7 — {QUOTE_STEP_LABELS[Math.min(step, 6)]}</div>

      <div className="wizard-step" key={step}>
        {step === 0 && <>
        <div style={{ display: "grid", gap: 10 }}>
          {APN_SERVICES.map(([k, l]) => chip(service === k, () => chooseService(k), l, k === "website" ? "Business websites and landing pages" : k === "marketing" ? "Monthly retainer for ads, content and social media" : "Course admission and training programs"))}
        </div>
        {priceBusy && <div className="hint-line" style={{ marginTop: 10 }}>Loading official pricing…</div>}
      </>}

      {step === 1 && <>
        <div style={{ display: "grid", gap: 10 }}>
          {QUOTE_SITE_TYPES.map(([k, l, d]) => chip(siteType === k, () => setSiteType(k), l, d))}
        </div>
      </>}

      {step === 2 && <>
        <div className="hint-line" style={{ marginBottom: 10 }}>Which technology does the client prefer? {"No Preference"} means ALLBEE picks the best fit for the scope.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {QUOTE_TECHS.map((t) => <button key={t} type="button" className={`preset${tech === t ? " active" : ""}`} onClick={() => setTech(t)}>{t}</button>)}
        </div>
      </>}

      {step === 3 && <>
        <div className="hint-line" style={{ marginBottom: 10 }}>Select any add-ons required — you can edit every line in the summary.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(price?.options || []).map((o) => <button key={o.key} type="button" className={`preset${addons.includes(o.key) ? " active" : ""}`} onClick={() => toggleAddon(o.key)}>+ {o.label} (₹{(Number(o.amount) || 0).toLocaleString("en-IN")})</button>)}
          {isWeb && <button type="button" className={`preset${addons.includes("business_email") ? " active" : ""}`} onClick={() => toggleAddon("business_email")}>+ {QUOTE_BUSINESS_EMAIL.label} (₹{QUOTE_BUSINESS_EMAIL.amount})</button>}
          {isWeb && <button type="button" className={`preset${addons.includes("source_code") ? " active" : ""}`} onClick={() => toggleAddon("source_code")}>+ Source code handover (quote on request)</button>}
        </div>
      </>}

      {step === 4 && <>
        <div className="hint-line" style={{ marginBottom: 10 }}>Does the client need faster delivery? Urgent delivery adds a 10% surcharge to the quoted amount.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {chip(urgent === false, () => setUrgent(false), "Normal delivery", "Standard timeline, no surcharge")}
          {chip(urgent === true, () => setUrgent(true), `Urgent delivery (+10%)`, "Priority scheduling — quoted total will include the surcharge")}
        </div>
      </>}

      {step === 5 && <>
        <Field label="Client name" required><input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Person or business" autoFocus /></Field>
        <div className="grid2">
          <Field label="Business name (optional)"><input className="input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Business / company" /></Field>
          <Field label="Phone or email (optional)"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 … or name@email" /></Field>
        </div>
      </>}

      {step === 6 && <>
        <div className="calc-box" style={{ marginBottom: 12 }}>
          <div className="hint-line" style={{ marginBottom: 6 }}>{requirements}</div>
          {items.map((it) => (
            <div key={it.id} className="calc-row"><span>{it.label}</span><b className="mono">{it.amount == null ? "Quote on request" : money(it.amount)}</b></div>
          ))}
          <div className="calc-row" style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}><span>Subtotal</span><b className="mono">{money(subtotal)}</b></div>
          {urgent && <div className="calc-row"><span>Urgent delivery surcharge (+10%)</span><b className="mono">{money(surcharge)}</b></div>}
          <div className="calc-row calc-total" style={{ fontSize: 16 }}><span>Total</span><b className="mono">{money(total)}</b></div>
        </div>
        <div className="hint-line" style={{ fontSize: 12, lineHeight: 1.55 }}>{QUOTE_DISCLAIMER} Amounts marked “Quote on request” are excluded from the total and confirmed after scope review.</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => saveQuote("Draft")} disabled={saving}><Save size={13} />Save draft</button>
          <button className="btn sm primary" onClick={() => saveQuote("Sent for approval")} disabled={saving}><Send size={13} />{saving ? "Saving…" : "Send for approval"}</button>
        </div>
      </>}

      {step === 7 && done && <>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 4 }}>
          <div className="av" style={{ background: "var(--pos-soft, rgba(22,163,74,.14))", color: "var(--pos)", width: 34, height: 34, fontSize: 15 }}><Check size={17} /></div>
          <div>
            <div style={{ fontWeight: 800 }}>Quotation {done.quoteNo}</div>
            <div className="hint-line">Saved to My Quotations as {done.status}. {done.status === "Draft" ? "Send it for approval when you're ready." : "It's now with the ALLBEE team for review."}</div>
          </div>
        </div>
        <div className="calc-box" style={{ marginTop: 12, marginBottom: 14 }}>
          {done.items.map((it) => <div key={it.id} className="calc-row"><span>{it.label}</span><b className="mono">{it.amount == null ? "Quote on request" : money(it.amount)}</b></div>)}
          <div className="calc-row calc-total" style={{ fontSize: 15 }}><span>{done.clientName} — total</span><b className="mono">{money(done.total)}</b></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => downloadQuotePdf(done, meRow)}><Download size={14} />Download PDF</button>
          <button className="btn" onClick={() => shareQuoteVia(done, "email")}><Mail size={14} />Email</button>
          <button className="btn" onClick={() => shareQuoteVia(done, "whatsapp")}><MessageCircle size={14} />WhatsApp</button>
          <button className="btn" onClick={() => go?.("quotations")}><FileText size={14} />My quotations</button>
        </div>
      </>}
      </div>
    </Modal>
  );
}
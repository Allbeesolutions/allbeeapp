import React, { useEffect, useMemo, useState } from "react";

export default function ShareForm({ kind, initial, onSave, onClose, currentUser, db, apnProjects = [], apnPartners = [], runtime }) {
  const { supabase, uid, todayISO, money, round2, fmtPeriod, expenseSharePlan, emptyDB, apnRateForPrior, apnPartnerStats, apnFinancePostedFor, apnIdFor, INCOME_CATEGORIES, PRESETS, COMPANY_EXPENSE_CATEGORIES, PROJECT_EXPENSE_CATEGORIES, Modal, Field, SearchableSelect, SelectOther, SplitBar, Trash2, Plus, X, Link2 } = runtime;
  const isIncome = kind === "income";
  // An income whose transaction already carries APN attribution (stored on the
  // row itself, so even an orphan APN income without a local project row is
  // recognised and can be edited/repaired).
  const editingApn = isIncome && !!initial?.apnProjectId;
  const initialProject = editingApn ? apnProjects.find((project) => project.id === initial.apnProjectId) : null;
  const [f, setF] = useState(() => {
    const base = { client: "", project: "", amount: "", date: todayISO(), category: isIncome ? "Project" : "Office Rent", hajiPct: 50, alimPct: 50, notes: "", apnProjectId: initial?.apnProjectId || "", apnPartnerId: initialProject?.partnerId || initial?.apnPartnerId || "", apnProjectName: initialProject?.projectName || initial?.apnProjectName || "", apnClientName: initialProject?.clientName || initial?.apnClientName || "", apnProjectValue: initialProject?.projectValue ?? initial?.apnProjectValue ?? "", apnCommissionRate: initialProject?.commissionRate ?? initial?.apnCommissionRate ?? "", ...initial };
    // New expenses default to the shared "company" bucket; legacy edits stay
    // manual ("project") so historical splits are never silently rewritten.
    if (!isIncome) base.scope = initial?.scope || (initial?.id ? "project" : "company");
    return base;
  });
  const [apnCollections, setApnCollections] = useState(() => {
    const existing = editingApn ? (db?.apn_revenue_collections || []).filter((row) => row.projectId === initial.apnProjectId) : [];
    if (existing.length) return existing.map((row) => ({ ...row }));
    // New APN posting or converting an existing plain income: seed one
    // collection with the entry's own amount so a conversion stays neutral.
    return [{ id: initial?.apnCollectionId || uid(), receivedAmount: initial?.amount ?? "", incentive: "", remarks: initial?.notes || "", receivedDate: initial?.date || todayISO() }];
  });
  const [apnAttribution, setApnAttribution] = useState(() => isIncome && !!initial?.apnProjectId);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setSplit = (h) => setF((s) => ({ ...s, hajiPct: h, alimPct: 100 - h }));
  const isAPNIncome = isIncome && apnAttribution;
  const apnPartner = apnPartners.find((partner) => partner.id === f.apnPartnerId);
  const derivedApnRate = apnPartner ? apnRateForPrior(apnPartnerStats(db, apnPartner.id).completed) : 0;
  const apnRelationship = (db?.apn_referral_relationships || []).find((relationship) => relationship.referred_id === f.apnPartnerId && relationship.status === "active");
  const apnReferrer = apnPartners.find((partner) => partner.id === apnRelationship?.referrer_id);
  const setApnCollection = (id, key, value) => setApnCollections((rows) => rows.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const apnTotal = round2(apnCollections.reduce((sum, row) => sum + Math.max(0, Number(row.receivedAmount) || 0), 0));
  const apnProjectValue = Number(f.apnProjectValue) || 0;
  const apnRate = String(f.apnCommissionRate).trim() === "" ? derivedApnRate : Number(f.apnCommissionRate) || 0;
  const apnMax = round2(apnProjectValue * apnRate / 100);
  // Mirrors the RPC's commission accrual so the finance form can show the exact
  // expense that posting will record (per-collection, capped at the maximum).
  const apnCommissionPreview = (() => {
    let earned = 0;
    for (const row of apnCollections) {
      const amount = Math.max(0, Number(row.receivedAmount) || 0);
      earned += round2(Math.min(Math.max(0, apnMax - earned), amount * apnRate / 100));
    }
    return round2(earned);
  })();
  // Attaching to an existing project (new posting or conversion) reads the
  // project's own value/rate — only a brand-new project or an anchored edit
  // (the income already posts to it) may change them.
  const apnFieldLocked = !!f.apnProjectId && !editingApn;
  // Picking an existing commission project pre-fills its identity so the RPC
  // attaches instead of creating a duplicate.
  const onPickProject = (value) => {
    if (value === f.apnProjectId) return;
    const picked = apnProjects.find((project) => project.id === value);
    setF((state) => ({
      ...state,
      apnProjectId: value,
      apnProjectName: picked?.projectName ?? state.apnProjectName,
      apnClientName: picked?.clientName ?? state.apnClientName,
      apnProjectValue: picked?.projectValue ?? state.apnProjectValue,
      apnCommissionRate: picked?.commissionRate ?? state.apnCommissionRate,
    }));
  };
  // Attribution off removes the APN flags from the payload (detach on an
  // existing APN income — the snapshot below is kept so it can be re-enabled).
  const setAttribution = (on) => setApnAttribution(on);

  // Company expenses derive their split from the previous valid revenue month.
  const isCompany = !isIncome && f.scope === "company";
  const plan = useMemo(() => expenseSharePlan(db || emptyDB(), (f.date || todayISO()).slice(0, 7)), [db, f.date]);
  useEffect(() => {
    if (isCompany) setF((s) => (Number(s.hajiPct) === plan.haji && Number(s.alimPct) === plan.alim ? s : { ...s, hajiPct: plan.haji, alimPct: plan.alim }));
  }, [isCompany, plan.haji, plan.alim]);

  const amt = isAPNIncome ? apnTotal : Number(f.amount) || 0;
  const sum = (Number(f.hajiPct) || 0) + (Number(f.alimPct) || 0);
  const splitOK = sum === 100;
  const valid = amt > 0 && (isCompany || splitOK) && f.date && (!isAPNIncome || (apnPartner && f.apnProjectName?.trim() && f.apnClientName?.trim() && String(f.apnProjectValue).trim() !== "" && apnProjectValue > 0 && Number.isFinite(apnRate) && apnRate >= 0 && apnRate <= 100 && apnTotal <= apnProjectValue && apnCollections.every((row) => Number(row.receivedAmount) > 0 && row.receivedDate)));
  // APN commission is an automatic finance expense, so the partner commission
  // must be deducted from the gross collection before the Haji/Alim profit
  // split is shown. The RPC records the same expense using the same split,
  // producing the identical net result in Share & accounts.
  const apnNetShareAmount = round2(Math.max(0, amt - apnCommissionPreview));
  const hShare = round2(((isAPNIncome ? apnNetShareAmount : amt) * (Number(f.hajiPct) || 0)) / 100);
  const aShare = round2(((isAPNIncome ? apnNetShareAmount : amt) * (Number(f.alimPct) || 0)) / 100);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    if (isAPNIncome && apnCollections.some((row) => !Number.isFinite(Number(row.receivedAmount)) || Number(row.receivedAmount) <= 0)) return;
    if (isAPNIncome && apnCollections.some((row) => !Number.isFinite(Number(row.incentive || 0)) || Number(row.incentive || 0) < 0)) return;
    const payload = {
      ...initial, id: initial?.id || uid(), kind, client: isAPNIncome ? f.apnClientName.trim() : f.client.trim(),
      project: isAPNIncome ? f.apnProjectName.trim() : f.project.trim(),
      amount: amt, date: isAPNIncome ? (apnCollections[0]?.receivedDate || f.date) : f.date,
      category: f.category, hajiPct: Number(f.hajiPct), alimPct: Number(f.alimPct),
      notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now(),
      incomeSource: isIncome ? (isAPNIncome ? "apn" : "normal") : undefined,
      apnProjectId: isAPNIncome ? (f.apnProjectId || uid()) : null,
    };
    if (isAPNIncome) Object.assign(payload, { apnPartnerId: f.apnPartnerId, apnProjectName: f.apnProjectName.trim(), apnClientName: f.apnClientName.trim(), apnProjectValue, apnCommissionRate: apnRate, apnCollections: apnCollections.map((row) => ({ ...row, receivedAmount: Number(row.receivedAmount), incentive: Number(row.incentive || 0), remarks: String(row.remarks || "").trim() })) });
    if (!isIncome) { payload.scope = f.scope; payload.shareSource = isCompany ? (plan.fallback ? null : plan.sourcePeriod) : null; }
    setSaving(true);
    try { const result = await onSave(payload); if (result !== false) onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={(initial?.id ? "Edit " : "Add ") + (isIncome ? "income" : "expense")} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid || saving}><Check size={16} />{saving ? "Saving…" : isIncome ? "Add income" : "Add expense"}</button></>}>
      {isIncome && <div className="apn-section-head" style={{ margin: "14px 0 10px" }}><h4 style={{ margin: 0 }}>APN attribution <span className="hint-line" style={{ fontWeight: 400 }}>(optional)</span></h4><button className="btn sm" type="button" onClick={() => setAttribution(!apnAttribution)}>{isAPNIncome ? <><X size={13} />Remove attribution</> : <><Link2 size={13} />Add APN attribution</>}</button></div>}
      {isAPNIncome && <>
        <div className="grid2"><Field label="Partner" required><SearchableSelect value={f.apnPartnerId} onChange={(value) => up("apnPartnerId", value)} disabled={!!editingApn} ariaLabel="APN income partner" options={apnPartners.map((partner) => ({ value: partner.id, label: partner.name, meta: apnIdFor(partner) }))} /></Field><Field label="Referral"><SearchableSelect value={apnRelationship?.referrer_id || ""} disabled ariaLabel="Direct referral partner" options={[{ value: "", label: apnReferrer ? apnReferrer.name : "No direct referral" }, ...(apnReferrer ? [{ value: apnReferrer.id, label: apnReferrer.name, meta: "Direct referral" }] : [])]} /></Field></div>
        <div className="grid2"><Field label="Commission project" required hint={editingApn ? "This income is anchored to its own project — the APN link cannot be moved." : "Pick an existing project to attach this income to it, or start a new commission."}><SearchableSelect value={f.apnProjectId || ""} onChange={onPickProject} disabled={!!editingApn} ariaLabel="APN commission project" options={[{ value: "", label: "New commission project" }, ...(editingApn ? [{ value: initial.apnProjectId, label: initialProject ? `${initialProject.projectName} · ${initialProject.clientName}` : `${initial?.apnProjectName || "Orphan project"} · ${initial?.apnClientName || "Unknown client"}`, meta: initialProject ? "Anchored to this project" : "Project row missing — recreated on save" }] : []), ...apnProjects.filter((project) => !initialProject || project.id !== initialProject.id).map((project) => { const linked = apnFinancePostedFor(db, project.id); return { value: project.id, label: `${project.projectName} · ${project.clientName}`, meta: `${linked.posted ? "Posted to finance · " : ""}${money(project.remainingAmount)} remaining · ${project.partnerName || "Partner"}` }; })]} /></Field><Field label="Posting status">{(f.apnProjectId ? (apnFinancePostedFor(db, f.apnProjectId).posted ? <span className="badge pos" style={{ marginTop: 12 }}>Posted to finance</span> : apnFinancePostedFor(db, f.apnProjectId).expense ? <span className="badge accent" style={{ marginTop: 12 }}>Linked APN expense</span> : <span className="badge accent" style={{ marginTop: 12 }}>Not posted yet</span>) : <span className="hint-line" style={{ marginTop: 16 }}>Created when you save.</span>)}</Field></div>
        <div className="grid2"><Field label="Project name" required hint={apnFieldLocked ? "Project identity comes from the selected commission project." : undefined}><input className="input" value={f.apnProjectName} onChange={(e) => up("apnProjectName", e.target.value)} readOnly={apnFieldLocked} placeholder="Website redesign" /></Field><Field label="Client name" required hint={apnFieldLocked ? "Comes from the selected commission project." : undefined}><input className="input" value={f.apnClientName} onChange={(e) => up("apnClientName", e.target.value)} readOnly={apnFieldLocked} placeholder="Client" /></Field></div>
        <div className="grid2"><Field label="Project value" required hint={apnFieldLocked ? "The project owns its value — edit it in the APN module." : (editingApn && initialProject ? "On record for this project — the APN project keeps these numbers." : undefined)}><input className="input mono" type="number" min="0" value={f.apnProjectValue} onChange={(e) => up("apnProjectValue", e.target.value)} readOnly={apnFieldLocked} placeholder="100000" /></Field><Field label="Commission %" required hint={apnFieldLocked ? "Comes from the selected project." : (editingApn && initialProject ? "On record for this project — rate changes belong in the APN module." : "Defaults to the partner's current progression rate.")}><input className="input mono" type="number" min="0" max="100" value={f.apnCommissionRate} onChange={(e) => up("apnCommissionRate", e.target.value)} readOnly={apnFieldLocked} placeholder={String(derivedApnRate)} /></Field></div>
        <div className="calc-box"><div className="calc-row"><span>Maximum commission</span><b className="mono">{money(apnMax)}</b></div><div className="calc-row"><span>{editingApn ? "Total collections" : "New collections"}</span><b className="mono">{money(apnTotal)}</b></div><div className="calc-row"><span>Commission expense (auto)</span><b className="mono">{money(apnCommissionPreview)}</b></div><div className="calc-row"><span>Status</span><span className={"badge " + (apnTotal >= apnProjectValue && apnProjectValue > 0 ? "pos" : "accent")}>{apnTotal >= apnProjectValue && apnProjectValue > 0 ? "Completed" : "Processing"}</span></div></div>
        <div className="hint-line" style={{ marginTop: 6 }}>{editingApn ? "Saving replaces this income's collections and recalculates the matching APN Commission expense — both stay in sync with Share & accounts." : <>Posting records a matching <b>APN Commission</b> expense in Share & accounts automatically, split like this income. If the project already exists, this entry attaches to it instead of creating a duplicate.</>}</div>
        <div className="apn-section-head" style={{ marginTop: 12 }}><h4 style={{ margin: 0 }}>Collections</h4><button className="btn sm" type="button" onClick={() => setApnCollections((rows) => [...rows, { id: uid(), receivedAmount: "", incentive: "", remarks: "", receivedDate: todayISO() }])}><Plus size={13} />Add collection</button></div>
        <div className="apn-list">{apnCollections.map((row, index) => <div className="apn-rowcard" key={row.id} style={{ padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><b style={{ flex: 1 }}>Collection {index + 1}</b>{apnCollections.length > 1 && <button className="iconbtn" type="button" style={{ width: 28, height: 28 }} aria-label={`Remove collection ${index + 1}`} onClick={() => setApnCollections((rows) => rows.filter((item) => item.id !== row.id))}><Trash2 size={13} /></button>}</div><div className="grid2"><Field label="Received amount" required><input className="input mono" type="number" min="0" value={row.receivedAmount} onChange={(e) => setApnCollection(row.id, "receivedAmount", e.target.value)} placeholder="50000" /></Field><Field label="Received date" required><input className="input" type="date" value={row.receivedDate || ""} onChange={(e) => setApnCollection(row.id, "receivedDate", e.target.value)} /></Field></div><div className="grid2"><Field label="Incentive"><input className="input mono" type="number" min="0" value={row.incentive} onChange={(e) => setApnCollection(row.id, "incentive", e.target.value)} placeholder="0" /></Field><Field label="Remarks"><input className="input" value={row.remarks || ""} onChange={(e) => setApnCollection(row.id, "remarks", e.target.value)} placeholder="Payment reference or note" /></Field></div></div>)}</div>
      </>}
      <div className="grid2"><Field label="Client name" hint={isAPNIncome ? "Derived from APN attribution." : undefined}><input className="input" value={isAPNIncome ? f.apnClientName : f.client} onChange={(e) => up("client", e.target.value)} readOnly={isAPNIncome} placeholder="e.g. Sun Textiles" /></Field>
        <Field label={isIncome ? "Project / source" : "Project (optional)"} hint={isAPNIncome ? "Derived from APN attribution." : undefined}><input className="input" value={isAPNIncome ? f.apnProjectName : f.project} onChange={(e) => up("project", e.target.value)} readOnly={isAPNIncome} placeholder={isIncome ? "Website redesign" : "Tied to a project?"} /></Field></div>
      <div className="grid2">
        <Field label={isAPNIncome ? "Total income amount" : isIncome ? "Income amount" : "Expense amount"} required error={touched && amt <= 0 ? "Enter an amount above ₹0" : ""}>
          <input className="input mono" type="number" min="0" value={isAPNIncome ? apnTotal : f.amount} onChange={(e) => up("amount", e.target.value)} placeholder="10000" readOnly={isAPNIncome} />
        </Field>
        <Field label={isAPNIncome ? "Posting date" : "Date"} required><input className="input" type="date" value={isAPNIncome ? (apnCollections[0]?.receivedDate || f.date) : f.date} onChange={(e) => up("date", e.target.value)} readOnly={isAPNIncome} /></Field>
      </div>
      {!isIncome && (
        <Field label="Expense type" hint={isCompany ? "Company costs are shared automatically from your revenue split." : "Project & client costs keep their own manual split."}>
          <div className="seg" style={{ display: "inline-flex" }}>
            <button type="button" className={isCompany ? "on" : ""} onClick={() => up("scope", "company")}>Company (auto-shared)</button>
            <button type="button" className={!isCompany ? "on" : ""} onClick={() => up("scope", "project")}>Project / client</button>
          </div>
        </Field>
      )}
      <Field label="Category">
        <SelectOther value={f.category} onChange={(v) => up("category", v)} options={(isIncome ? INCOME_CATEGORIES : (isCompany ? COMPANY_EXPENSE_CATEGORIES : PROJECT_EXPENSE_CATEGORIES)).filter((c) => c !== "Other")} placeholder="Custom category…" />
      </Field>

      {isCompany ? (
        <Field label="Company expense split" hint="Set automatically — manage it under Share & accounts.">
          <div className="calc-box">
            <div className="calc-row" style={{ color: "var(--muted)", fontSize: 12 }}>
              {plan.fallback ? "No revenue recorded yet — using an even 50/50 split until your first revenue month." : `Based on ${fmtPeriod(plan.sourcePeriod)} revenue share`}
            </div>
            <div style={{ margin: "2px 0 4px" }}><SplitBar h={plan.haji} a={plan.alim} /></div>
            <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--haji)" }} />Haji</span><span className="mono" style={{ fontWeight: 700 }}>{plan.haji}%</span></div>
            <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--alim)" }} />Alim</span><span className="mono" style={{ fontWeight: 700 }}>{plan.alim}%</span></div>
          </div>
        </Field>
      ) : (
        <Field label="Profit split" required error={touched && !splitOK ? `Split must total 100% (currently ${sum}%)` : ""}
          hint="Set the share for this entry — no fixed percentage is assumed.">
          <div className="preset-row" style={{ marginBottom: 10 }}>
            {PRESETS.map(([h, a]) => (
              <button key={h + "/" + a} className="preset" onClick={() => setSplit(h)}>{h} / {a}</button>
            ))}
          </div>
          <div className="grid2">
            <div><div className="hint-line" style={{ marginBottom: 5 }}>Haji %</div>
              <input className="input mono" type="number" min="0" max="100" value={f.hajiPct} onChange={(e) => up("hajiPct", e.target.value === "" ? "" : Number(e.target.value))} /></div>
            <div><div className="hint-line" style={{ marginBottom: 5 }}>Alim %</div>
              <input className="input mono" type="number" min="0" max="100" value={f.alimPct} onChange={(e) => up("alimPct", e.target.value === "" ? "" : Number(e.target.value))} /></div>
          </div>
          <div style={{ marginTop: 12 }}><SplitBar h={Number(f.hajiPct) || 0} a={Number(f.alimPct) || 0} /></div>
        </Field>
      )}

      {amt > 0 && splitOK && (
        <div className="calc-box">
          {isAPNIncome && (<>
            <div className="calc-row"><span>Gross income</span><b className="mono">{money(amt)}</b></div>
            <div className="calc-row"><span>Less: APN commission expense</span><b className="mono neg-txt">−{money(apnCommissionPreview)}</b></div>
            <div className="calc-row" style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 8 }}><span><b>Net amount to share</b></span><b className="mono">{money(apnNetShareAmount)}</b></div>
          </>)}
          <div className="calc-row" style={{ color: "var(--muted)", fontSize: 12, marginTop: isAPNIncome ? 8 : 0 }}>This entry will {isIncome ? "credit" : "debit"}:</div>
          <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--haji)" }} />Haji</span>
            <span className={"mono " + (isIncome ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(isIncome ? hShare : -hShare, { sign: isIncome })}</span></div>
          <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--alim)" }} />Alim</span>
            <span className={"mono " + (isIncome ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(isIncome ? aShare : -aShare, { sign: isIncome })}</span></div>
        </div>
      )}

      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Anything worth recording…" /></Field>
    </Modal>
  );
}

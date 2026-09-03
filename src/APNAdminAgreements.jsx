import React, { useEffect, useMemo, useState } from "react";

export default function APNAdminAgreements({ db, isAdmin, onRefresh, runtime = {} }) {
  const { supabase, fmtDate, fmtDateTime, Empty, Modal, Field, SelectOther, Search, Plus, Trash2, Pencil, Save, Check, X, FileText, Download, Eye, emitToast, ScrollText, RefreshCw, AlertTriangle, AGREEMENT_CATEGORIES } = runtime;
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rows = (db.apn_agreements || []).slice().sort((a, b) => (a.code === b.code ? (b.version || 0) - (a.version || 0) : a.code.localeCompare(b.code)));
  const accepts = db.apn_agreement_acceptances || [];
  const activePartners = (db.apn_users || []).filter((u) => u.status === "active").length;
  const grouped = [];
  for (const r of rows) { const g = grouped.find((x) => x.code === r.code); if (g) g.rows.push(r); else grouped.push({ code: r.code, rows: [r] }); }
  const statusChip = (s) => s === "published" ? <span className="badge pos">Published</span> : s === "superseded" ? <span className="badge">Superseded</span> : <span className="badge accent">Draft</span>;
  const openEditor = (code, doc) => setEditing({ code, title: doc?.title || "", category: doc?.category || "Agreement", body: doc?.body || "", body_simple: doc?.body_simple || "", mandatory: doc ? !!doc.mandatory : true, material: doc ? doc.material !== false : true, change_summary: doc?.change_summary || "", effective_from: doc?.effective_from || "", reason: "" });
  const save = async (publish) => {
    setBusy(true); setErr("");
    try {
      if (!editing.title.trim() || !editing.body.trim()) throw new Error("Title and body are required.");
      if (publish && !(editing.body_simple || "").trim()) throw new Error("A Simple English rendering is required before publishing.");
      const args = { p_code: editing.code, p_title: editing.title.trim(), p_category: editing.category, p_body: editing.body, p_mandatory: editing.mandatory, p_body_simple: (editing.body_simple || "").trim() };
      if (editing.effective_from) args.p_effective_from = editing.effective_from;
      if (editing.reason) args.p_reason = editing.reason.trim();
      const { data, error } = await supabase.rpc("apn_agreement_save_draft", args);
      if (error) throw new Error(error.message);
      if (publish && !/\[ DRAFT/.test(editing.body) && data?.id) {
        const pargs = { p_agreement_id: data.id, p_material: editing.material !== false };
        if ((editing.change_summary || "").trim()) pargs.p_change_summary = editing.change_summary.trim();
        const { error: perr } = await supabase.rpc("apn_agreement_publish", pargs);
        if (perr) throw new Error(perr.message);
      } else if (publish) {
        throw new Error("This document still contains the [ DRAFT ] placeholder marker. Remove it (or keep only a saved draft) before publishing.");
      }
      emitToast(publish ? "Document published — partner gate updated." : "Draft saved.", "success");
      setEditing(null);
      onRefresh?.();
    } catch (e) { setErr(e.message || "That operation failed."); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <div className="apn-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>Agreements <span className="hint-line" style={{ fontSize: 11 }}>— drafts never block partners; publish activates the gate.</span></div>
      {grouped.length === 0 ? <div className="apn-rowcard"><Empty icon={<ScrollText size={22} color="var(--muted)" />} title="No agreement documents" text="The seed docs appear after the agreement table is deployed." /></div>
        : grouped.map((g) => (
          <div key={g.code} style={{ marginBottom: 16 }}>
            <div className="apn-section-h" style={{ fontSize: 13, textTransform: "none" }}>{g.code}</div>
            <div className="apn-list">
              {g.rows.map((d) => {
                const cur = g.rows.find((r) => r.status === "published");
                const coverage = cur ? `${accepts.filter((a) => a.agreement_id === cur.id).length} of ${activePartners} active partners accepted` : null;
                return (
                  <div key={d.id} className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div className="cmdk-ic"><ScrollText size={16} /></div>
                    <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 600 }}>{d.title} <span className="hint-line">v{d.version}</span></div><div className="hint-line" style={{ fontSize: 11 }}>{d.category} · {d.mandatory ? "Required" : "Optional"}{d.material === false ? " · Editorial change" : d.material ? " · Material change" : ""}{d.status === "published" && d.change_summary ? ` · ${d.change_summary}` : ""}{d.status === "superseded" && d.supersedes_id ? " · superseded by v" + (d.version + 1) : ""}{d.effective_from ? " · Effective " + fmtDate(d.effective_from) : ""}{d.status === "published" && coverage ? ` · ${coverage}` : ""}</div></div>
                    {statusChip(d.status)}
                    {d.status === "draft" && <div style={{ display: "flex", gap: 6 }}><button className="btn sm" onClick={() => openEditor(g.code, d)}><Pencil size={13} />Edit</button><button className="btn sm primary" onClick={() => { setEditing({ ...d, reason: "" }); }}><Check size={13} />Publish</button></div>}
                    {d.status === "published" && <button className="btn sm" onClick={() => openEditor(g.code, null)}><Plus size={13} />New version</button>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      {editing && (
        <Modal title={`${editing.id ? "Edit" : "New version"} — ${editing.code}`} onClose={() => !busy && setEditing(null)} footer={
          <>
            <button className="btn" disabled={busy} onClick={() => save(false)}>{busy ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}Save draft</button>
            <button className="btn primary" disabled={busy} onClick={() => save(true)}>{busy ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}Save &amp; publish</button>
          </>
        }>
          <div className="grid2">
            <Field label="Title" required><input className="input" value={editing.title} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))} /></Field>
            <Field label="Category" required>{(() => <select className="input" value={editing.category} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, category: e.target.value }))}>{AGREEMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>)()}</Field>
          </div>
          <Field label="Body" required hint="Paste the final wording from the business / legal owner. The [ DRAFT ] marker is only allowed while saving drafts — publishing requires final wording."><textarea className="textarea" rows={7} value={editing.body} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, body: e.target.value }))} /></Field>
            <Field label="Simple English" hint="Plain-language rendering of the SAME legal version above. Required before publishing — partners can read this instead of the full text."><textarea className="textarea" rows={5} value={editing.body_simple || ""} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, body_simple: e.target.value }))} /></Field>
            <div className="grid2">
              <Field label="Effective from"><input className="input" type="date" value={(editing.effective_from || "").slice(0, 10)} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, effective_from: e.target.value ? new Date(e.target.value + "T12:00:00Z").toISOString() : "" }))} /></Field>
              <Field label="Reason for this version"><input className="input" value={editing.reason} placeholder="e.g. Legal refresh 2026" disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, reason: e.target.value }))} /></Field>
            </div>
            <div className="grid2">
              <Field label="Change type" hint="Material changes re-lock partners; editorial changes do not."><select className="input" value={(editing.material ?? true) ? "material" : "editorial"} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, material: e.target.value === "material" }))}><option value="material">Material — partners must re-accept</option><option value="editorial">Editorial — no re-accept required</option></select></Field>
              <Field label="Change summary"><input className="input" value={editing.change_summary || ""} placeholder="e.g. Added breach-reporting duty" disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, change_summary: e.target.value }))} /></Field>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
            <input type="checkbox" checked={editing.mandatory} disabled={busy} onChange={(e) => setEditing((s) => ({ ...s, mandatory: e.target.checked }))} />
            <span>Required — partners must accept before using the portal</span>
            </label>
            {(editing.material ?? true) === false && <div className="hint-line" style={{ marginTop: 8, fontSize: 11.5 }}>Editorial changes never block partners: acceptance of the superseded version keeps satisfying the document (and the change summary appears in the partner's reader).</div>}
          {/\[ DRAFT/.test(editing.body) && <div className="auth-msg" style={{ marginTop: 10 }}><AlertTriangle size={13} />This version still contains the [ DRAFT ] placeholder marker — publishing is blocked while it remains.</div>}
          {err && <div className="auth-msg err" style={{ marginTop: 10 }}>{err}</div>}
        </Modal>
      )}
    </div>
  );
}

/* ── dashboard ───────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════
   ALLBEE AI (APN partner) + SUPPORT TICKETS
   Chat runs through the server-side apn-ai edge function: the model only
   ever sees the SQL-built, partner-scoped snapshot — never the full DB.
   Ticket writes go through audited RPCs (identity from the JWT server-side).
══════════════════════════════════════════════════════════════════════ */
const APN_TICKET_STATUSES = ["open", "under_review", "waiting_for_partner", "answered", "resolved", "closed"];
const APN_TICKET_TONE = { open: "pri", under_review: "accent", waiting_for_partner: "accent", answered: "pos", resolved: "pos", closed: "" };
const APN_AI_CHIPS = [
  ["My wallet", "What is my wallet balance and when can I withdraw?"],
  ["My commission", "Why haven't I received my commission yet? Explain from my records."],
  ["My reversal", "Which reversals appear on my account and why were they made?"],
  ["My projects", "Which of my projects and revenue collections are on record?"],
  ["My referrals", "How much have I earned from referrals and when were they effective?"],
  ["Rules", "Explain the current commission ladder and caps under the active rule version."],
  ["Escalate to support", "I need help from the ALLBEE support team."],
];
const apnAiCategoryFor = (q) => {
  const s = String(q || "");
  if (/withdraw|settlement|payout|release/i.test(s)) return "Withdrawal";
  if (/refer|tie-up|network|link/i.test(s)) return "Referral";
  if (/commission|percent|earn|paid|ladder|tier/i.test(s)) return "Commission";
  if (/wallet|balance|money|₹|rupee/i.test(s)) return "Wallet";
  if (/project|lead|convert|revenue|collection/i.test(s)) return "Project";
  if (/rule|version|policy|cap/i.test(s)) return "Rules & Policy";
  if (/support|help|ticket|escalate/i.test(s)) return "Support";
  return "Other";
};

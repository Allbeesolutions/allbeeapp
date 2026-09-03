import React, { useState, useEffect, useCallback } from "react";
import * as Icons from "./icons.jsx";
import { supabase } from "./supabaseClient";

export default function PricingKnowledgeCenter(props) {
  const { isAdmin } = props;
  const { Field, Empty, Modal, money, todayISO, exportRowsToExcel, emitToast, AlertTriangle, BookOpen, Check, Download, Pencil, Plus, RefreshCw, Search, ShieldAlert, X } = props.runtime || {};
  const tabs = [["services", "Services"], ["packages", "Packages"], ["pricing", "Pricing"], ["features", "Features"], ["delivery", "Delivery"], ["hosting", "Hosting"], ["maintenance", "AMC"], ["faq", "FAQs"], ["policies", "Policies"], ["discounts", "Discounts"], ["integrations", "Integrations"], ["knowledge", "Knowledge"]];
  const [tab, setTab] = useState("services");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page_size: 25 });
  const [summary, setSummary] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorText, setEditorText] = useState("");
  const [jsonMode, setJsonMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const blankForm = (entity) => {
    if (entity === "services")  return { name: "", slug: "", description: "", active: true, custom_quote: false };
    if (entity === "packages")  return { name: "", slug: "", description: "", service_slug: "", active: true, custom_quote: false, hosting_included: false, domain_included: false, ssl_included: true, support_period_days: 15 };
    if (entity === "pricing")   return { label: "", billing_model: "fixed", amount: "", package_slug: "", service_slug: "", is_base: false, visible: true, active: true };
    if (entity === "features")  return { name: "", slug: "", description: "", package_slug: "", included: true, sort_order: 0, active: true };
    if (entity === "delivery")  return { name: "Standard delivery", service_slug: "", package_slug: "", min_days: 10, max_days: 15, priority: "standard", rush_charge: "", active: true };
    return {};
  };
  const [form, setForm] = useState({});
  const structuredTabs = new Set(["services", "packages", "pricing", "features", "delivery"]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true); setError("");
    try {
      const [{ data: list, error: listError }, { data: counts, error: countError }] = await Promise.all([
        supabase.rpc("knowledge_admin_list", { p_entity: tab, p_search: query, p_page: page, p_page_size: 25 }),
        supabase.rpc("knowledge_admin_summary"),
      ]);
      if (listError) throw new Error(listError.message);
      if (countError) throw new Error(countError.message);
      setData(list || { items: [], total: 0, page_size: 25 }); setSummary(counts || {});
    } catch (e) { setError(e.message || "Knowledge catalog could not be loaded."); }
    finally { setBusy(false); }
  }, [isAdmin, page, query, tab]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, query]);

  const openEditor = (row) => {
    setEditor(row || { entity: tab });
    setEditorText(JSON.stringify(row || {}, null, 2));
    if (structuredTabs.has(tab)) {
      const f = { ...blankForm(tab), ...(row || {}) };
      if (f.amount != null) f.amount = String(f.amount);
      if (f.rush_charge != null) f.rush_charge = String(f.rush_charge);
      setForm(f);
      setJsonMode(false);
    } else {
      setJsonMode(true);
    }
  };

  const formField = (label, key, type = "text", extra = {}) => {
    const val = form[key] ?? "";
    const onChange = (e) => setForm((prev) => ({ ...prev, [key]: type === "checkbox" ? e.target.checked : e.target.value }));
    if (type === "checkbox") return (
      <div className="field" key={key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <input type="checkbox" id={`kf-${key}`} checked={!!form[key]} onChange={onChange} />
        <label htmlFor={`kf-${key}`} style={{ marginBottom: 0, fontWeight: 600 }}>{label}</label>
      </div>
    );
    if (type === "select") return (
      <Field label={label} key={key}>
        <select className="select" value={val} onChange={onChange} {...(extra.options ? {} : extra)}>
          {(extra.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
    );
    return (
      <Field label={label} key={key}>
        <input className="input" type={type} value={val} onChange={onChange} placeholder={extra.placeholder || ""} />
      </Field>
    );
  };

  const renderStructuredForm = () => {
    if (tab === "services") return (
      <div className="grid2">
        {formField("Service name", "name")}
        {formField("Slug (identifier)", "slug")}
        <div style={{ gridColumn: "1 / -1" }}>{formField("Description", "description")}</div>
        {formField("Active", "active", "checkbox")}
        {formField("Custom quote only (no fixed price)", "custom_quote", "checkbox")}
      </div>
    );
    if (tab === "packages") return (
      <div className="grid2">
        {formField("Package name", "name")}
        {formField("Slug (identifier)", "slug")}
        {formField("Service slug", "service_slug", "text", { placeholder: "website, digital-marketing, training…" })}
        <div style={{ gridColumn: "1 / -1" }}>{formField("Description", "description")}</div>
        {formField("Support period (days)", "support_period_days", "number")}
        {formField("Active", "active", "checkbox")}
        {formField("Hosting included", "hosting_included", "checkbox")}
        {formField("Domain included", "domain_included", "checkbox")}
        {formField("SSL included", "ssl_included", "checkbox")}
        {formField("Custom quote (no fixed base price)", "custom_quote", "checkbox")}
      </div>
    );
    if (tab === "pricing") return (
      <div className="grid2">
        {formField("Label / Item name", "label")}
        {formField("Billing model", "billing_model", "select", { options: [["fixed","Fixed price"],["per_month","Per month"],["per_year","Per year"],["per_user","Per user"],["custom_quote","Custom quote"],["hidden_price","Hidden / TBD"],["negotiable","Negotiable"]] })}
        {formField("Amount (₹, blank = included / quote on request)", "amount", "number", { placeholder: "Leave blank if included" })}
        {formField("Package slug", "package_slug", "text", { placeholder: "website-starter" })}
        {formField("Service slug (fallback)", "service_slug", "text", { placeholder: "website" })}
        {formField("Base price (main line item)", "is_base", "checkbox")}
        {formField("Visible in quotation", "visible", "checkbox")}
        {formField("Active", "active", "checkbox")}
      </div>
    );
    if (tab === "features") return (
      <div className="grid2">
        {formField("Feature name", "name")}
        {formField("Slug", "slug")}
        {formField("Package slug", "package_slug", "text", { placeholder: "website-starter" })}
        <div style={{ gridColumn: "1 / -1" }}>{formField("Description", "description")}</div>
        {formField("Sort order", "sort_order", "number")}
        {formField("Included (shown as ✓ in quotation)", "included", "checkbox")}
        {formField("Active", "active", "checkbox")}
      </div>
    );
    if (tab === "delivery") return (
      <div className="grid2">
        {formField("Timeline name", "name")}
        {formField("Service slug", "service_slug", "text", { placeholder: "website" })}
        {formField("Package slug (optional, overrides service-level)", "package_slug", "text", { placeholder: "website-starter" })}
        {formField("Minimum working days", "min_days", "number")}
        {formField("Maximum working days", "max_days", "number")}
        {formField("Priority", "priority", "select", { options: [["standard","Standard"],["rush","Rush"],["express","Express"]] })}
        {formField("Rush charge (₹, optional)", "rush_charge", "number", { placeholder: "Leave blank if none" })}
        {formField("Active", "active", "checkbox")}
      </div>
    );
    return null;
  };

  const saveStructured = async () => {
    const payload = { ...form };
    if ("amount" in payload) payload.amount = payload.amount === "" ? null : Number(payload.amount);
    if ("rush_charge" in payload) payload.rush_charge = payload.rush_charge === "" ? null : Number(payload.rush_charge);
    if ("sort_order" in payload) payload.sort_order = Number(payload.sort_order) || 0;
    if ("min_days" in payload) payload.min_days = Number(payload.min_days) || 0;
    if ("max_days" in payload) payload.max_days = Number(payload.max_days) || 0;
    if ("support_period_days" in payload) payload.support_period_days = Number(payload.support_period_days) || 0;
    setBusy(true); setError("");
    try {
      const { error: saveError } = await supabase.rpc("knowledge_admin_save", { p_entity: tab, p_payload: payload });
      if (saveError) throw new Error(saveError.message);
      setEditor(null); await load(); emitToast("Knowledge catalog saved.", "success");
    } catch (e) { setError(e.message || "Knowledge catalog could not be saved."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (structuredTabs.has(tab) && !jsonMode) { await saveStructured(); return; }
    let payload;
    try { payload = JSON.parse(editorText); } catch { setError("Enter valid JSON before saving."); return; }
    setBusy(true); setError("");
    try { const { error: saveError } = await supabase.rpc("knowledge_admin_save", { p_entity: tab, p_payload: payload }); if (saveError) throw new Error(saveError.message); setEditor(null); await load(); emitToast("Knowledge catalog saved.", "success"); }
    catch (e) { setError(e.message || "Knowledge catalog could not be saved."); }
    finally { setBusy(false); }
  };
  const archive = async (row) => {
    setBusy(true); setError("");
    try { const { error: archiveError } = await supabase.rpc("knowledge_admin_save", { p_entity: tab, p_payload: { ...row, active: row.active === false, reason: `${row.active === false ? "Restored" : "Archived"} ${row.name || row.title || row.label || row.slug || "catalog record"}.` } }); if (archiveError) throw new Error(archiveError.message); await load(); }
    catch (e) { setError(e.message || "Catalog status could not be changed."); }
    finally { setBusy(false); }
  };
  const exportRows = async () => {
    const { data: rows, error: exportError } = await supabase.rpc("knowledge_export", { p_entity: tab, p_search: query });
    if (exportError) { setError(exportError.message); return; }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) { emitToast("There are no records to export.", "info"); return; }
    const keys = Array.from(new Set(list.flatMap((row) => Object.keys(row))));
    await exportRowsToExcel(`allbee-knowledge-${tab}-${todayISO()}.xlsx`, tab, keys.map((key) => ({ label: key, value: (row) => typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key] ?? "" })), list);
  };

  if (!isAdmin) return <div className="content"><div className="card"><Empty icon={<ShieldAlert size={22} />} title="Admin access required" text="The Pricing & Knowledge Center is restricted to administrators." /></div></div>;
  const pages = Math.max(1, Math.ceil((data.total || 0) / (data.page_size || 25)));
  const labelOf = (row) => row.name || row.title || row.question || row.label || row.slug || "Untitled";

  const detailOf = (row) => {
    if (tab === "pricing")   return `${row.billing_model || ""} · ${row.package_name || row.package_slug || ""} · ${row.service_name || ""}`;
    if (tab === "features")  return `${row.package_name || row.package_slug || ""} · ${row.included ? "Included" : "Excluded"}`;
    if (tab === "delivery")  return `${row.service_name || ""} · ${row.min_days ?? "?"}–${row.max_days ?? "?"} days`;
    if (tab === "packages")  return `${row.service_name || row.service_slug || ""} · support ${row.support_period_days ?? 0}d`;
    return row.description || row.answer || row.body || row.billing_model || row.category || row.service_slug || "";
  };
  const amountOf = (row) => {
    if (tab === "pricing" || tab === "hosting")  return row.amount != null ? money(row.amount) : "Included / TBD";
    if (tab === "delivery") return row.min_days != null ? `${row.min_days}–${row.max_days} days` : "—";
    if (tab === "features") return row.included ? "✓ Included" : "Excluded";
    return row.amount != null ? money(row.amount) : row.billing_model || row.category || row.service_slug || "—";
  };

  return <div className="content">
    <div className="page-head"><div><h3><BookOpen size={18} style={{ verticalAlign: -3, marginRight: 7, color: "var(--primary)" }} />Pricing & Knowledge Center</h3><div className="hint-line">Single source of truth for pricing, features, delivery guidance, FAQs and AI knowledge. Changes reflect immediately in new APN quotations.</div></div><span className="spacer" /><button className="btn" onClick={exportRows} disabled={busy}><Download size={14} />Export</button><button className="btn primary" onClick={() => openEditor()}><Plus size={15} />New record</button></div>
    {error && <div className="auth-msg err" role="alert"><AlertTriangle size={15} />{error}<button className="iconbtn" style={{ marginLeft: "auto", width: 26, height: 26 }} onClick={() => setError("")} aria-label="Dismiss knowledge error"><X size={14} /></button></div>}
    <div className="ai-health-grid" style={{ marginBottom: 14 }}>{[["Services", "services"], ["Packages", "packages"], ["Price points", "pricing"], ["Features", "features"], ["Delivery rules", "delivery"], ["FAQs", "faq"], ["Knowledge articles", "knowledge"]].map(([label, key]) => <button key={key} className="card stat" style={{ textAlign: "left", border: 0, cursor: "pointer" }} onClick={() => { setTab(key); setPage(1); }}><div className="lbl"><BookOpen size={14} />{label}</div><div className="num mono">{summary?.[key] ?? "—"}</div></button>)}</div>
    <div className="seg" style={{ marginBottom: 12, overflowX: "auto" }}>{tabs.map(([key, label]) => <button key={key} className={tab === key ? "on" : ""} onClick={() => { setTab(key); setPage(1); }}>{label}</button>)}</div>
    <div className="toolbar"><div className="search"><Search size={16} color="var(--muted)" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tabs.find((x) => x[0] === tab)?.[1].toLowerCase() || "knowledge"}…`} aria-label="Search knowledge catalog" /></div><button className="btn" onClick={load} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} />Refresh</button></div>
    <div className="card"><div className="hint-line" style={{ padding: "0 0 10px" }}>{data.total || 0} records · {busy ? "Loading…" : "DB-backed catalog"}</div>{data.items?.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Identifier</th><th>Status</th><th>Details</th><th></th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id || row.slug}><td><b>{labelOf(row)}</b><div className="hint-line">{detailOf(row)}</div></td><td className="mono">{row.slug || row.id || "—"}</td><td><span className={`badge ${row.active === false || row.published === false ? "neg" : "pos"}`}>{row.active === false ? "Archived" : row.published === false ? "Draft" : "Active"}</span></td><td>{amountOf(row)}</td><td><div className="row-actions"><button className="btn sm" onClick={() => openEditor(row)}><Pencil size={13} />Edit</button><button className="btn sm" onClick={() => archive(row)} disabled={busy}>{row.active === false ? "Restore" : "Archive"}</button></div></td></tr>)}</tbody></table></div> : <Empty icon={<BookOpen size={22} />} title={query ? "No matching knowledge" : "No records yet"} text="Create a catalog record or adjust the search to continue." action={!query && <button className="btn primary" onClick={() => openEditor()}><Plus size={15} />Create record</button>} />}{pages > 1 && <div className="apn-pagination"><button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="hint-line">Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</div>
    {editor && <Modal title={`${editor.id ? "Edit" : "New"} ${tabs.find((x) => x[0] === tab)?.[1] || "record"}`} onClose={() => setEditor(null)} footer={<><button className="btn" onClick={() => setEditor(null)}>Cancel</button>{structuredTabs.has(tab) && <button className="btn sm" style={{ marginRight: "auto" }} onClick={() => setJsonMode((x) => !x)}>{jsonMode ? "Form view" : "JSON (advanced)"}</button>}<button className="btn primary" onClick={save} disabled={busy}><Check size={15} />Save record</button></>}>
      {structuredTabs.has(tab) && !jsonMode ? <>{renderStructuredForm()}</> : <><p className="hint-line">Edit the normalized record as JSON. Changes are versioned and audited transactionally.</p><textarea className="textarea mono" style={{ minHeight: 300, fontSize: 12 }} value={editorText} onChange={(e) => setEditorText(e.target.value)} aria-label="Knowledge record JSON" /></>}
    </Modal>}
  </div>;
}


import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { GaugeCircle, TrendingUp, Coins, Users, UserCheck, Target, Wallet, ShieldAlert, AlertTriangle, X, Sparkles, Lightbulb, CheckCircle2, Search, RefreshCw, Check, ArrowRight, FileText } from "./icons.jsx";

const crmCount = (db, key, predicate) => (db?.[key] || []).filter(predicate).length;

export default function AIIntelligenceCenter(props) {
  const { db, go, openModal, reload, mutate } = props;
  const runtime = props.runtime || {};
  const { Empty, Field, money, fmtDate, Activity, emitToast, exportRowsToExcel, exportRowsToPDF, todayISO, fmtDateTime, ROLE_LABEL, supabase: runtimeSupabase } = runtime;
  const sb = runtimeSupabase || supabase;

  const [snapshot, setSnapshot] = useState(null);
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({ enabled: true, sensitivity: "balanced", forecast_period: 90, prediction_model: "deterministic-v1" });
  const [webSettings, setWebSettings] = useState({ enabled: true, welcome_message: "Hi — I’m AllBee AI. I can help you explore the right business solution.", business_hours: "Monday–Saturday, 9:00 AM–6:00 PM IST", fallback_contact: "", max_conversation_length: 18, pricing_visibility: true });
  const [reportType, setReportType] = useState("sales");
  const [reportFormat, setReportFormat] = useState("json");
  const [automationBusy, setAutomationBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("ai_get_dashboard");
      if (rpcError) throw new Error(rpcError.message);
      setSnapshot(data || {});
      if (data?.settings) setSettings(data.settings);
      try {
        const { data: webConfig, error: webError } = await sb.rpc("web_ai_config");
        if (!webError && webConfig) setWebSettings((current) => ({ ...current, ...webConfig }));
      } catch { /* PR-Web migration may not be installed in older environments */ }
    } catch (e) { setError(e.message || "Unable to load intelligence data."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await sb.rpc("ai_refresh_insights");
      if (rpcError) throw new Error(rpcError.message);
      await load(); await reload?.(); emitToast("AI intelligence refreshed.", "success");
    } catch (e) { setError(e.message || "Refresh failed."); setBusy(false); }
  };
  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) { setResults([]); return; }
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("ai_natural_language_search", { p_query: query.trim() });
      if (rpcError) throw new Error(rpcError.message);
      setResults(data || []); setTab("search");
    } catch (e) { setError(e.message || "Search failed."); }
    finally { setBusy(false); }
  };
  const saveSettings = async () => {
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("ai_save_settings", { p_enabled: !!settings.enabled, p_sensitivity: settings.sensitivity, p_forecast_period: Number(settings.forecast_period), p_prediction_model: settings.prediction_model });
      if (rpcError) throw new Error(rpcError.message);
      setSettings(data || settings); await load(); emitToast("AI settings saved.", "success");
    } catch (e) { setError(e.message || "Settings could not be saved."); }
    finally { setBusy(false); }
  };
  const saveWebSettings = async () => {
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("web_ai_save_settings", { p_patch: { enabled: !!webSettings.enabled, welcome_message: webSettings.welcome_message, business_hours: webSettings.business_hours, fallback_contact: webSettings.fallback_contact, max_conversation_length: Number(webSettings.max_conversation_length), pricing_visibility: !!webSettings.pricing_visibility } });
      if (rpcError) throw new Error(rpcError.message);
      setWebSettings((current) => ({ ...current, ...(data || {}) })); emitToast("Website consultant settings saved.", "success");
    } catch (e) { setError(e.message || "Website consultant settings could not be saved."); }
    finally { setBusy(false); }
  };
  const openCommand = (label) => {
    if (label === "Open CRM") return go("leads");
    if (label === "Open Finance") return go("accounts");
    if (label === "Open APN") return go("apn");
    if (label === "Search Partner") return go("apn");
    if (label === "Search Employee") return go("team");
    if (label === "Create Lead") return openModal({ type: "lead" });
    if (label === "Create Quotation") return openModal({ type: "quotation" });
    if (label === "Create Project") return openModal({ type: "project" });
    if (label === "Open Client") return go("clients");
  };
  const generateReport = async () => {
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("ai_generate_report", { p_report_type: reportType, p_format: reportFormat });
      if (rpcError) throw new Error(rpcError.message);
      const payload = data?.payload || {};
      if (reportFormat === "json") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `allbee-ai-${reportType}-${todayISO()}.json`; link.click(); URL.revokeObjectURL(url);
      } else if (reportFormat === "xlsx") {
        const rows = (payload.leadScores || []).map((x) => ({ type: "Lead", name: x.customer_name, score: x.ai_lead_score, probability: x.win_probability, risk: x.lost_risk, action: x.next_action }));
        await exportRowsToExcel(`allbee-ai-${reportType}-${todayISO()}.xlsx`, "AI report", [{ label: "Type", value: (x) => x.type }, { label: "Name", value: (x) => x.name }, { label: "Score", value: (x) => x.score }, { label: "Win probability", value: (x) => x.probability }, { label: "Lost risk", value: (x) => x.risk }, { label: "Next action", value: (x) => x.action }], rows.length ? rows : [{ type: "Summary", name: data?.title || "AI report", score: payload.health?.company_health || 0, probability: "", risk: "", action: "See report payload" }]);
      } else {
        const health = payload.health || {};
        await exportRowsToPDF(`allbee-ai-${reportType}-${todayISO()}.pdf`, `ALLBEE — ${data?.title || "AI report"}`, `Deterministic intelligence · ${fmtDateTime(Date.now())}`, [{ label: "Metric", value: (x) => x.metric }, { label: "Value", value: (x) => x.value }], Object.entries(health).map(([metric, value]) => ({ metric, value })));
      }
      await load(); emitToast(`${data?.title || "AI report"} generated.`, "success");
    } catch (e) { setError(e.message || "Report generation failed."); }
    finally { setBusy(false); }
  };
  const automationRules = useMemo(() => [
    { id: "stale-leads", title: "Stale lead recovery", condition: `${crmCount(db, "crm_leads", (x) => !["Won","Lost","Cancelled","Converted","Closed"].includes(x.status) && Date.now() - new Date(x.updated_at || x.created_at || 0).getTime() > 7 * 86400000)} stale active lead(s)`, level: "Important", body: "AI automation found active leads with no meaningful update for 7+ days. Review CRM and schedule the next action." },
    { id: "overdue-followups", title: "Overdue follow-up recovery", condition: `${crmCount(db, "crm_follow_ups", (x) => x.status === "Open" && x.follow_up_date < todayISO)} overdue follow-up(s)`, level: "Urgent", body: "AI automation found open CRM follow-ups past their due date. Review and complete or reschedule them." },
    { id: "quote-risk", title: "Quotation risk review", condition: `${crmCount(db, "crm_quotations", (x) => !["Accepted","Converted","Rejected","Expired"].includes(x.status) && x.validity_until && x.validity_until < todayISO)} active quote(s) past validity`, level: "Important", body: "AI automation found active quotations whose validity date has passed. Review before the opportunity is lost." },
  ], [db, todayISO]);
  const runAutomation = async () => {
    if (!mutate) return;
    setAutomationBusy(true);
    try {
      const now = Date.now();
      const additions = automationRules.filter((r) => !/^0 /.test(r.condition)).map((r) => ({ id: `ai-auto:${r.id}:${todayISO}`, createdAt: now, title: r.title, body: `${r.condition}. ${r.body}`, level: r.level, audience: "all", reads: [], by: "ALLBEE AI" }));
      if (additions.length) mutate((d) => ({ ...d, notifications: [...(d.notifications || []), ...additions.filter((n) => !(d.notifications || []).some((x) => x.id === n.id))] }), { name: "AI automation", audit: `ran AI automation rules (${additions.length} notification(s))` });
      emitToast(additions.length ? `Automation created ${additions.length} review notification(s).` : "No automation conditions are currently active.", "success");
    } finally { setAutomationBusy(false); }
  };

  const generateTimeline = async (period) => {
    setBusy(true); setError("");
    try { const { data, error: rpcError } = await sb.rpc("ai_generate_timeline", { p_period: period }); if (rpcError) throw new Error(rpcError.message); await load(); emitToast(data?.summary || "AI timeline generated.", "success"); }
    catch (e) { setError(e.message || "Timeline generation failed."); }
    finally { setBusy(false); }
  };

  const h = snapshot?.health || {};
  const leads = snapshot?.lead_scores || [];
  const partners = snapshot?.partner_scores || [];
  const employees = snapshot?.employee_scores || [];
  const forecasts = snapshot?.forecasts || [];
  const insights = snapshot?.insights || [];
  const recommendations = snapshot?.recommendations || [];
  const healthCards = [["Company health", h.company_health, GaugeCircle], ["Sales health", h.sales_health, TrendingUp], ["Finance health", h.finance_health, Coins], ["Employee health", h.employee_health, Users], ["APN health", h.apn_health, UserCheck], ["CRM health", h.crm_health, Target], ["Profitability", `${Number(h.profitability || 0).toFixed(1)}%`, Wallet], ["Risk score", h.risk_score, ShieldAlert], ["Growth score", h.growth_score, TrendingUp]];
  const topLeads = leads.slice(0, 8);
  const topPartners = partners.slice(0, 8);
  const topEmployees = employees.slice(0, 8);
  const commands = ["Open CRM", "Open Finance", "Open APN", "Create Lead", "Create Quotation", "Create Project", "Open Client", "Search Partner", "Search Employee"];
  const tabs = [["overview", "Overview"], ["automation", "Automation"], ["leads", "Lead AI"], ["partners", "Partner AI"], ["employees", "Employee AI"], ["finance", "Finance AI"], ["search", "Natural search"], ["reports", "Reports"], ["settings", "Settings"]];
  return (
    <div className="content">
      <div className="page-head"><div><h3>AI Intelligence Center</h3><div className="hint-line">Deterministic business intelligence across CRM, finance, employees, APN, revenue, risk and growth.</div></div><span className="spacer" /><button className="btn" onClick={refresh} disabled={busy}><RefreshCw size={15} className={busy ? "spin" : ""} />Refresh intelligence</button></div>
      {error && <div className="auth-msg err" role="alert"><AlertTriangle size={15} />{error}<button className="iconbtn" style={{ marginLeft: "auto", width: 26, height: 26 }} onClick={() => setError("")} aria-label="Dismiss AI error"><X size={14} /></button></div>}
      {!snapshot ? <div className="cards-grid"><div className="card" aria-busy="true"><div className="skeleton skeleton-line" style={{ width: "38%" }} /><div className="skeleton" style={{ height: 90, marginTop: 12 }} /></div><div className="card" aria-busy="true"><div className="skeleton skeleton-line" style={{ width: "55%" }} /><div className="skeleton" style={{ height: 90, marginTop: 12 }} /></div></div> : <>
        <div className="card" style={{ marginBottom: 14, background: "linear-gradient(135deg,var(--surface),var(--surface-2))" }}><div className="item-row" style={{ padding: 0, alignItems: "flex-start" }}><div className="item-main"><div className="item-title" style={{ fontSize: 18 }}><Sparkles size={18} color="var(--primary)" style={{ verticalAlign: -3, marginRight: 7 }} />Company intelligence at a glance</div><div className="item-meta">Scores are explainable rules over current ERP data. No external AI provider is called.</div></div><span className={`badge ${settings.enabled ? "pos" : "neg"}`}>{settings.enabled ? "Enabled" : "Disabled"}</span></div></div>
        <div className="seg" style={{ marginBottom: 16, overflowX: "auto" }}>{tabs.map(([key, label]) => <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}{key === "search" && results.length > 0 ? ` · ${results.length}` : ""}</button>)}</div>
        {tab === "overview" && <>
          <div className="ai-health-grid" style={{ marginBottom: 14 }}>{healthCards.map(([label, value, Icon]) => <div className="card stat" key={label}><div className="lbl"><Icon size={14} />{label}</div><div className="num mono">{typeof value === "number" ? value : (value || "—")}</div>{typeof value === "number" && <div className="ai-score-bar" style={{ marginTop: 9 }}><i style={{ width: `${Math.max(0,Math.min(100,value))}%` }} /></div>}</div>)}</div>
          <div className="cards-grid" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
            <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Today's AI alerts</div><div className="item-meta">Risk signals generated from live ERP records.</div></div><AlertTriangle size={16} color="var(--accent)" /></div>{insights.length ? insights.slice(0, 6).map((i) => <div className={`item-row ai-alert ${(i.severity || "").toLowerCase()}`} key={i.id}><div className="item-main"><div className="item-title">{i.title} <span className={`badge ${i.severity === "High" || i.severity === "Urgent" ? "neg" : i.severity === "Medium" ? "accent" : "pri"}`} style={{ marginLeft: 6 }}>{i.severity}</span></div><div className="item-meta">{i.message}</div>{i.recommendation && <div className="hint-line" style={{ marginTop: 5 }}><Lightbulb size={12} style={{ verticalAlign: -2 }} /> {i.recommendation}</div>}</div></div>) : <Empty icon={<CheckCircle2 size={22} />} title="No active alerts" text="The deterministic engine has not found a current high-priority signal." />}</div>
            <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Business recommendations</div><div className="item-meta">Actionable operating guidance.</div></div><Lightbulb size={16} color="var(--accent)" /></div>{recommendations.slice(0, 5).map((r) => <div className="item-row" key={r.id}><div className="item-main"><div className="item-title">{r.title}</div><div className="item-meta">{r.description}</div></div><span className={`badge ${r.priority === "High" || r.priority === "Urgent" ? "neg" : "accent"}`}>{r.priority}</span></div>)}{!recommendations.length && <Empty icon={<Lightbulb size={22} />} title="Recommendations will appear here" text="Refresh intelligence after CRM or finance activity changes." />}</div>
          </div>
          <div className="card" style={{ marginTop: 14 }}><div className="item-row"><div className="item-main"><div className="item-title">AI command bar</div><div className="item-meta">Use these shortcuts to move from insight to action.</div></div><span className="tag">Ctrl K for global search</span></div><div className="ai-command-grid">{commands.map((label) => <button className="ai-command" key={label} onClick={() => openCommand(label)}><ArrowRight size={14} color="var(--primary)" />{label}</button>)}</div></div>
        </>}
        {tab === "automation" && <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", alignItems: "start" }}><div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Business Automation Engine</div><div className="item-meta">Safe, deterministic review automations. They create notifications only; they never mutate CRM, finance, APN or customer records.</div></div><Sparkles size={16} color="var(--primary)" /></div>{automationRules.map((r) => <div className="item-row" key={r.id}><div className="item-main"><div className="item-title">{r.title}</div><div className="item-meta">{r.condition}</div></div><span className={`badge ${r.level === "Urgent" ? "neg" : "accent"}`}>{r.level}</span></div>)}<button className="btn primary" onClick={runAutomation} disabled={automationBusy}><RefreshCw size={14} />{automationBusy ? "Running…" : "Run review automations"}</button></div><div className="card"><div className="item-title">Approval boundary</div><div className="item-meta" style={{ marginTop: 6, lineHeight: 1.6 }}>Automation may surface a review notification. A human must open CRM and approve any real business action such as sending a message, changing a quote, scheduling a follow-up, or recording revenue.</div><div className="calc-box" style={{ marginTop: 14 }}><div className="calc-row"><span>Active rules</span><b className="mono">{automationRules.length}</b></div><div className="calc-row"><span>Auto-mutations</span><b className="mono">0</b></div></div></div></div>}
        {tab === "leads" && <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Lead AI scoring</div><div className="item-meta">Budget, timeline, follow-up, source, customer and partner history.</div></div><span className="badge pri">{leads.length} scored</span></div>{topLeads.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Lead</th><th>Score</th><th>Win probability</th><th>Lost risk</th><th>Reason</th><th>Next action</th></tr></thead><tbody>{topLeads.map((l) => <tr key={l.id}><td><button className="linkbtn" style={{ margin: 0 }} onClick={() => go("leads")}>{l.customer_name}</button><div className="hint-line">{l.lead_number} · {l.status}</div></td><td><b className="mono">{l.ai_lead_score}</b>/100<div className="ai-score-bar" style={{ width: 90, marginTop: 5 }}><i style={{ width: `${l.ai_lead_score}%` }} /></div></td><td className="mono">{l.win_probability}%</td><td className="mono" style={{ color: l.lost_risk >= 60 ? "var(--neg)" : "var(--ink)" }}>{l.lost_risk}%</td><td className="hint-line">{l.reasons || "—"}</td><td><span className="badge accent">{l.next_action}</span></td></tr>)}</tbody></table></div> : <Empty icon={<Target size={22} />} title="No normalized CRM leads" text="Create leads in Leads & pipeline to activate deterministic scoring." />}</div>}
        {tab === "partners" && <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">APN partner intelligence</div><div className="item-meta">Performance, growth, health, conversion, referrals and withdrawal risk.</div></div><span className="badge accent">{partners.length} partners</span></div>{topPartners.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Partner</th><th>Performance</th><th>Growth</th><th>Health</th><th>Conversion</th><th>Revenue</th><th>Risk</th></tr></thead><tbody>{topPartners.map((p) => <tr key={p.partner_id}><td><button className="linkbtn" style={{ margin: 0 }} onClick={() => go("apn")}>{p.partner_name}</button><div className="hint-line">{p.district} · {p.lead_count} leads</div></td><td className="mono">{p.performance_score}</td><td className="mono">{p.growth_score}</td><td className="mono">{p.health_score}</td><td>{p.conversion_pct}%<div className="hint-line">Follow-up {p.followup_pct}%</div></td><td className="mono">{money(p.revenue)}</td><td><span className={`badge ${p.risk_score >= 50 ? "neg" : p.risk_score >= 25 ? "accent" : "pos"}`}>{p.risk_score}</span></td></tr>)}</tbody></table></div> : <Empty icon={<Users size={22} />} title="No APN partner data" text="Active APN partners will receive deterministic health and growth scores." />}</div>}
        {tab === "employees" && <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Employee intelligence</div><div className="item-meta">Task completion, revenue, conversion, response activity and attendance.</div></div><span className="badge pri">{employees.length} employees</span></div>{topEmployees.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Employee</th><th>Score</th><th>Tasks</th><th>Lead conversion</th><th>Revenue</th><th>Summary</th></tr></thead><tbody>{topEmployees.map((e) => <tr key={e.employee_id}><td><button className="linkbtn" style={{ margin: 0 }} onClick={() => go("team")}>{e.name}</button><div className="hint-line">{e.designation || ROLE_LABEL[e.role] || e.role}</div></td><td className="mono">{e.performance_score}/100</td><td>{e.completed_tasks}/{e.task_count}<div className="hint-line">{e.task_completion_pct}% complete</div></td><td>{e.converted_leads}/{e.assigned_leads}<div className="hint-line">{e.lead_conversion_pct}%</div></td><td className="mono">{money(e.revenue)}</td><td className="hint-line">{e.performance_summary}</td></tr>)}</tbody></table></div> : <Empty icon={<Users size={22} />} title="No employee activity data" text="Assigned tasks and CRM ownership will appear here." />}</div>}
        {tab === "finance" && <div className="cards-grid" style={{ gridTemplateColumns: "1.35fr 1fr", alignItems: "start" }}><div className="card"><div className="item-row"><div className="item-main"><div className="item-title">Revenue and profit forecast</div><div className="item-meta">Three-month rolling deterministic forecast.</div></div><TrendingUp size={16} color="var(--primary)" /></div><div className="table-wrap"><table className="tbl"><thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Forecast</th><th>Pending revenue</th></tr></thead><tbody>{forecasts.map((f) => <tr key={f.month_start}><td className="mono">{fmtDate(f.month_start)}</td><td className="mono">{money(f.revenue)}</td><td className="mono">{money(f.expenses)}</td><td className="mono">{money(f.profit)}</td><td className="mono">{money(f.forecast_revenue)}</td><td className="mono">{money(f.pending_revenue)}</td></tr>)}</tbody></table></div></div><div className="card"><div className="item-title">CEO outlook</div><div className="item-meta" style={{ marginTop: 5 }}>Revenue forecast {money(h.forecast_revenue)} · Profit forecast {money(h.forecast_profit)}</div><div className="calc-box" style={{ marginTop: 14 }}><div className="calc-row"><span>Collections</span><b className="mono">{money(forecasts.at(-1)?.collections)}</b></div><div className="calc-row"><span>Outstanding</span><b className="mono">{money(forecasts.at(-1)?.pending_revenue)}</b></div><div className="calc-row"><span>Profitability</span><b className="mono">{Number(h.profitability || 0).toFixed(1)}%</b></div></div></div></div>}
        {tab === "search" && <div className="card"><form className="toolbar" onSubmit={search} style={{ marginBottom: 10 }}><div className="search"><Search size={16} color="var(--muted)" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try: today's revenue, pending withdrawals, top partner, lost leads, Chennai" aria-label="Natural language business search" /></div><button className="btn primary" type="submit" disabled={busy}><Search size={14} />Search</button></form>{results.length ? results.map((r) => <button className="item-row" key={`${r.result_type}-${r.result_id}`} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer" }} onClick={() => go(r.route)}><div className="item-main"><div className="item-title">{r.title}</div><div className="item-meta">{r.subtitle || r.result_type}</div></div>{r.value && <span className="badge pri">{r.value}</span>}<ArrowRight size={15} color="var(--muted)" /></button>) : <Empty icon={<Search size={22} />} title="Ask the business" text="Search revenue, withdrawals, earnings, partners, leads, employees, or locations using plain language." />}</div>}
        {tab === "reports" && <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}><div className="card"><div className="item-title">Generate AI report</div><div className="item-meta" style={{ margin: "5px 0 14px" }}>Reports use the deterministic snapshot and remain available in AI history.</div><Field label="Report"><select className="select" value={reportType} onChange={(e) => setReportType(e.target.value)}><option value="sales">Sales report</option><option value="finance">Finance report</option><option value="crm">CRM report</option><option value="employee">Employee report</option><option value="partner">Partner report</option></select></Field><Field label="Format"><select className="select" value={reportFormat} onChange={(e) => setReportFormat(e.target.value)}><option value="json">JSON</option><option value="pdf">PDF</option><option value="xlsx">Excel</option></select></Field><button className="btn primary" onClick={generateReport} disabled={busy}><FileText size={15} />Generate report</button></div><div className="card"><div className="item-title">AI timeline</div><div className="item-meta" style={{ margin: "5px 0 14px" }}>Generate a daily, weekly, or monthly operating summary.</div><div className="row-actions"><button className="btn" onClick={() => generateTimeline("daily")} disabled={busy}>Daily</button><button className="btn" onClick={() => generateTimeline("weekly")} disabled={busy}>Weekly</button><button className="btn" onClick={() => generateTimeline("monthly")} disabled={busy}>Monthly</button></div><div style={{ marginTop: 18 }}>{(db.ai_history || []).slice(0, 5).map((x) => <div className="item-row" key={x.id}><div className="item-main"><div className="item-title">{x.period} summary</div><div className="item-meta">{x.summary}</div></div><span className="hint-line">{fmtDate(x.created_at)}</span></div>)}</div></div></div>}
        {tab === "settings" && <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}><div className="card"><div className="item-title">Intelligence settings</div><div className="item-meta" style={{ margin: "5px 0 16px" }}>Controls deterministic analysis only. External AI providers are not connected.</div><Field label="Enable AI intelligence"><label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}><input type="checkbox" checked={!!settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />Enable deterministic insights, alerts and forecasts</label></Field><Field label="Sensitivity"><select className="select" value={settings.sensitivity || "balanced"} onChange={(e) => setSettings({ ...settings, sensitivity: e.target.value })}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="sensitive">Sensitive</option></select></Field><Field label="Forecast period"><select className="select" value={settings.forecast_period || 90} onChange={(e) => setSettings({ ...settings, forecast_period: Number(e.target.value) })}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">365 days</option></select></Field><Field label="Prediction model"><input className="input" value={settings.prediction_model || "deterministic-v1"} onChange={(e) => setSettings({ ...settings, prediction_model: e.target.value })} /></Field><button className="btn primary" onClick={saveSettings} disabled={busy}><Check size={15} />Save settings</button></div><div className="card"><div className="item-title">Website AI sales consultant</div><div className="item-meta" style={{ margin: "5px 0 16px" }}>Configure the public AllBee AI assistant. Pricing remains sourced from the official rules in the database.</div><Field label="Enable website consultant"><label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}><input type="checkbox" checked={!!webSettings.enabled} onChange={(e) => setWebSettings({ ...webSettings, enabled: e.target.checked })} />Show “Talk to AllBee AI” on the public sign-in screen</label></Field><Field label="Welcome message"><textarea className="textarea" value={webSettings.welcome_message || ""} onChange={(e) => setWebSettings({ ...webSettings, welcome_message: e.target.value.slice(0, 500) })} /></Field><Field label="Business hours"><input className="input" value={webSettings.business_hours || ""} onChange={(e) => setWebSettings({ ...webSettings, business_hours: e.target.value.slice(0, 120) })} /></Field><Field label="Fallback contact" hint="Shown as the email destination for estimate sharing."><input className="input" value={webSettings.fallback_contact || ""} onChange={(e) => setWebSettings({ ...webSettings, fallback_contact: e.target.value.slice(0, 160) })} placeholder="sales@allbee.in" /></Field><Field label="Conversation limit"><select className="select" value={webSettings.max_conversation_length || 18} onChange={(e) => setWebSettings({ ...webSettings, max_conversation_length: Number(e.target.value) })}><option value="12">12 turns</option><option value="18">18 turns</option><option value="24">24 turns</option><option value="36">36 turns</option></select></Field><Field label="Official pricing"><label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}><input type="checkbox" checked={!!webSettings.pricing_visibility} onChange={(e) => setWebSettings({ ...webSettings, pricing_visibility: e.target.checked })} />Show official estimate amounts when available</label></Field><button className="btn primary" onClick={saveWebSettings} disabled={busy}><Check size={15} />Save website AI settings</button></div></div>}
      </>}
    </div>
  );
}

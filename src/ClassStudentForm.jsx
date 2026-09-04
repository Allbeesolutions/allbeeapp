import React, { useState } from "react";
import * as Icons from "./icons.jsx";
const { Check, Plus, Lightbulb, ArrowRight, Pencil, Trash2 } = Icons;

export default function ClassStudentForm({ initial, onSave, onClose, runtime = {} }) {
  const { Modal, Field, uid, todayISO, CLASS_COURSES = [], CLASS_MODES = ["Offline", "Online"] } = runtime;
  const [f, setF] = useState(() => ({ name: "", phone: "", email: "", course: "", mode: "Offline", batch: "", joinDate: todayISO(), fee: "", paid: "", paymentStatus: "Unpaid", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = (f.name || "").trim().length > 0;
  const save = () => {
    if (!valid) return;
    onSave({
      ...initial,
      id: initial?.id || uid(),
      name: f.name.trim(), phone: (f.phone || "").trim(), email: (f.email || "").trim(),
      course: (f.course || "").trim(), mode: f.mode || "Offline", batch: (f.batch || "").trim(),
      joinDate: f.joinDate, fee: Number(f.fee) || 0, paid: Number(f.paid) || 0,
      paymentStatus: f.paymentStatus, notes: (f.notes || "").trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit class student" : "New class student"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save student</button></>}>
      <div className="grid2">
        <Field label="Student name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label="Phone number"><input className="input" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+91…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Course"><input className="input" list="class-course-list" value={f.course} onChange={(e) => up("course", e.target.value)} placeholder="MS Office, Tally, Python…" />
          <datalist id="class-course-list">{CLASS_COURSES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Class mode"><select className="select" value={f.mode} onChange={(e) => up("mode", e.target.value)}>{CLASS_MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Batch / timing"><input className="input" value={f.batch} onChange={(e) => up("batch", e.target.value)} placeholder="Morning 10–11" /></Field>
      </div>
      <div className="grid2">
        <Field label="Joining date"><input className="input" type="date" value={f.joinDate} onChange={(e) => up("joinDate", e.target.value)} /></Field>
        <Field label="Payment status"><select className="select" value={f.paymentStatus} onChange={(e) => up("paymentStatus", e.target.value)}>{["Unpaid", "Partial", "Paid"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Total fee"><input className="input mono" type="number" min="0" value={f.fee} onChange={(e) => up("fee", e.target.value)} /></Field>
        <Field label="Amount paid"><input className="input mono" type="number" min="0" value={f.paid} onChange={(e) => up("paid", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function Concepts({ db, mutate, openModal, removeItem }) {
  const list = [...db.concepts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (c) => removeItem("concepts", c, { name: c.title, audit: `deleted idea "${c.title}"` });
  const convert = (c) => openModal({ type: "task", initial: { title: c.title, desc: c.notes }, fromConcept: c.id });
  return (
    <div className="content">
      <div className="page-head"><h3>Concepts & ideas</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Lightbulb size={22} color="var(--muted)" />} title="No ideas saved" text="Park business ideas and future plans here. Turn any of them into a task with one tap." action={<button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button>} /></div>
          : list.map((c) => (
            <div key={c.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
              {c.notes && <div className="sub" style={{ lineHeight: 1.5 }}>{c.notes.length > 160 ? c.notes.slice(0, 160) + "…" : c.notes}</div>}
              {c.tags?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
              <div className="item-meta"><span>{fmtDate(c.date)}</span></div>
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn sm primary" onClick={() => convert(c)}><ArrowRight size={13} />Convert to task</button>
                <button className="btn sm" onClick={() => openModal({ type: "concept", initial: c })}><Pencil size={13} /></button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete idea?", body: `Delete "${c.title}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(c) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const AUDIT_FILTER_SESSION_KEY = "allbee_audit_filters";
function sessionAuditFilter(key) {
  try { return JSON.parse(sessionStorage.getItem(AUDIT_FILTER_SESSION_KEY) || "{}")[key]; } catch { return undefined; }
}
function activityValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function activityTimelineLabel(activity) {
  const text = `${activity.action || ""} ${activity.description || ""}`.toLowerCase();
  if (/delete|removed|archived|rejected/.test(text)) return "Deleted";
  if (/complete|paid|converted|closed/.test(text)) return "Completed";
  if (/approv|accept|reactivat/.test(text)) return "Approved";
  if (/edit|updated|changed|modified|reset|transfer|assigned/.test(text)) return "Edited";
  if (/creat|add|register|received|submitted|upload|logged|recorded/.test(text)) return "Created";
  return activity.action || "Activity";
}
function activityRelated(db, activity) {
  const id = activity?.entityId;
  if (!id) return null;
  const module = activityModuleOf(activity.module);
  const table = module === "Tasks" ? "tasks" : module === "APN" ? "apn_users" : module === "Leads" ? "leads" : module === "Clients" ? "clients" : module === "Invoices" ? "invoices" : module === "Quotations" ? "quotations" : module === "Finance" ? (activity.entity === "Withdrawals" ? "withdrawals" : "transactions") : null;
  const record = table ? (db[table] || []).find((x) => x.id === id) : null;
  if (!record) return null;
  return { module, table, record, label: module === "APN" ? "Open partner profile" : `Open ${module.slice(0, -1).toLowerCase() || "record"}` };
}
function downloadActivityCsv(rows) {
  const columns = ["Event ID", "Timestamp", "User", "Module", "Action", "Entity", "Entity ID", "Description", "Previous Value", "New Value"];
  const cell = (value) => `"${String(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value).replace(/"/g, '""')}"`;
  const csv = [columns, ...rows.map((a) => [a.id, a.ts ? new Date(a.ts).toISOString() : "", a.user || "System", activityModuleOf(a.module), a.action || "", a.entity || "", a.entityId || "", a.description || "", activityValue(a.previousValue), activityValue(a.newValue)])].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `allbee-audit-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
}

function ActivityDetailsDrawer({ activity, db, isSuper, onClose, onRelated }) {
  const drawerRef = useRef(null);
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!activity) return undefined;
    const previous = document.activeElement;
    const drawer = drawerRef.current;
    const first = drawer?.querySelector("button:not(:disabled), [href], [tabindex]:not([tabindex=\"-1\"])");
    first?.focus();
    return () => { if (previous && typeof previous.focus === "function") previous.focus(); };
  }, [activity, onClose]);
  if (!activity) return null;
  const related = activityRelated(db, activity);
  const module = activityModuleOf(activity.module);
  const timelineRows = [...(db.audit || [])].filter((x) => activity.entityId && x.entityId === activity.entityId && activityModuleOf(x.module) === module).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const sequence = timelineRows.length ? timelineRows : [activity];
  return (
    <div className="activity-drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={drawerRef} className={`activity-drawer${maximized ? " maximized" : ""}`} role="dialog" aria-modal="true" aria-labelledby="activity-drawer-title" tabIndex={-1} onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key !== "Tab") return;
        const nodes = Array.from(drawerRef.current?.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex=\"-1\"])") || []);
        if (!nodes.length) return;
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}>
        <div className="activity-drawer-head"><div><h3 id="activity-drawer-title">Activity details</h3><div className="hint-line">{activity.description || activity.action || "Activity event"}</div></div><span style={{ flex: 1 }} /><button className="iconbtn" onClick={() => setMaximized((current) => !current)} aria-label={maximized ? "Restore activity details" : "Maximize activity details"} title={maximized ? "Restore" : "Maximize"}>{maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button><button className="iconbtn" onClick={onClose} aria-label="Close activity details" title="Close activity details"><X size={18} /></button></div>
        <div className="activity-drawer-body">
          <div className="activity-detail-grid">
            {[['Event ID', activity.id], ['Timestamp', activity.ts ? fmtDateTime(activity.ts) : "—"], ['User', activity.user || "System"], ['Module', module], ['Action', activity.action], ['Entity', activity.entity], ['Entity ID', activity.entityId]].map(([label, value]) => <div key={label}><div className="k">{label}</div><div className="activity-detail-value">{activityValue(value)}</div></div>)}
          </div>
          <div className="activity-detail-block"><div className="k">Human-readable description</div><div>{activity.description || `${activity.user || "System"} ${activity.action || "performed an action"}`}</div></div>
          <div className="activity-detail-grid">
            {[['Previous value', activity.previousValue], ['New value', activity.newValue], ['Device information', activity.device || "Future-ready"], ['IP address', activity.ip || "Future-ready"], ['Browser', activity.browser || "Future-ready"]].map(([label, value]) => <div key={label}><div className="k">{label}</div><pre className="activity-detail-value activity-detail-pre">{activityValue(value)}</pre></div>)}
          </div>
          {related && <div className="activity-detail-block"><div className="k">Related link</div><button className="btn sm" onClick={() => onRelated(related, activity)}><ExternalLink size={13} />{related.label}</button></div>}
          <div className="activity-detail-block"><div className="k">Timeline</div><div className="activity-timeline">{sequence.map((x, i) => <div className="activity-timeline-item" key={x.id || i}><span className="activity-timeline-dot" /><div><b>{activityTimelineLabel(x)}</b><div className="hint-line">{x.description || x.action || "Activity"}</div><div className="activity-detail-meta">{x.ts ? fmtDateTime(x.ts) : "—"} · {x.user || "System"}</div></div>{i < sequence.length - 1 && <span className="activity-timeline-line" />}</div>)}</div></div>
          {isSuper && <div className="hint-line">This activity record is immutable. Export is available from the filtered Audit Log.</div>}
        </div>
      </aside>
    </div>
  );
}

function AuditLog({ db, isSuper, onOpenActivity }) {
  const [user, setUser] = useState(() => sessionAuditFilter("user") || "all");
  const [module, setModule] = useState(() => sessionAuditFilter("module") || "all");
  const [date, setDate] = useState(() => sessionAuditFilter("date") || "");
  const [search, setSearch] = useState(() => sessionAuditFilter("search") || "");
  const [page, setPage] = useState(0);
  const users = useMemo(() => Array.from(new Set(["Haji", "Alim", ...db.audit.map((a) => a.user).filter(Boolean)])), [db.audit]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...db.audit].sort((a, b) => (b.ts || 0) - (a.ts || 0)).filter((a) => {
      const day = a.ts ? new Date(a.ts).toLocaleDateString("en-CA") : "";
      const haystack = [a.user, a.module, a.action, a.description, a.entity, a.entityId].filter(Boolean).join(" ").toLowerCase();
      return (user === "all" || a.user === user)
        && (module === "all" || activityModuleOf(a.module) === module)
        && (!date || day === date)
        && (!q || haystack.includes(q));
    });
  }, [db.audit, user, module, date, search]);
  useEffect(() => { try { sessionStorage.setItem(AUDIT_FILTER_SESSION_KEY, JSON.stringify({ user, module, date, search })); } catch { /* session storage is optional */ } }, [user, module, date, search]);
  useEffect(() => setPage(0), [user, module, date, search]);
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const list = filtered.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div className="content">
      <div className="page-head"><h3>Audit log</h3></div>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="audit-filter-grid">
          <SearchableSelect value={user} onChange={setUser} ariaLabel="Filter audit log by user" options={[{ value: "all", label: "All users" }, ...users.map((x) => ({ value: x, label: x }))]} />
          <select className="select" value={module} onChange={(e) => setModule(e.target.value)} aria-label="Filter audit log by module">
            <option value="all">All modules</option>{ACTIVITY_MODULES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter audit log by date" />
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity…" aria-label="Search audit log" />
          {isSuper && <><button className="btn sm" onClick={() => downloadActivityCsv(filtered)}><Download size={13} />CSV</button><button className="btn sm" onClick={() => exportRowsToExcel(`allbee-audit-${todayISO()}.xlsx`, "Audit Log", [{ label: "Event ID", value: (a) => a.id }, { label: "Timestamp", value: (a) => a.ts ? fmtDateTime(a.ts) : "" }, { label: "User", value: (a) => a.user || "System" }, { label: "Module", value: (a) => activityModuleOf(a.module) }, { label: "Action", value: (a) => a.action || "" }, { label: "Entity", value: (a) => a.entity || "" }, { label: "Entity ID", value: (a) => a.entityId || "" }, { label: "Description", value: (a) => a.description || "" }, { label: "Previous Value", value: (a) => activityValue(a.previousValue) }, { label: "New Value", value: (a) => activityValue(a.newValue) }], filtered)}><Download size={13} />Excel</button></>}
        </div>
      </div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<ScrollText size={22} color="var(--muted)" />} title={filtered.length ? "No activity on this page" : "No matching activity"} text="Every action — edits, share changes, expenses, withdrawals — is logged here permanently." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>When</th><th>User</th><th>Activity</th><th>Module</th><th>Entity</th></tr></thead>
            <tbody>{list.map((a) => (
              <tr key={a.id} className="activity-table-row" role="button" tabIndex={0} aria-label={`View activity details: ${a.description || a.action || "activity"}`} onClick={() => onOpenActivity?.(a)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenActivity?.(a); } }}><td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtTime(a.ts)}</td>
                <td><span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Avatar name={a.user || "System"} url={a.avatar} size={20} fontSize={9} />{a.user || "System"}</span></td>
                <td>{a.description || `${a.user || "System"} ${a.action || "performed an action"}`}</td><td><span className="tag">{activityModuleOf(a.module)}</span></td><td>{a.entity || "—"}{a.entityId ? ` · ${a.entityId}` : ""}</td></tr>
            ))}</tbody>
          </table></div>}
        {pages > 1 && <div className="apn-pagination" style={{ padding: "12px 14px" }}><button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="hint-line">Page {page + 1} of {pages} · {filtered.length} records</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
      </div>
    </div>
  );
}

const LazyAllbeeAI = React.lazy(() => import("./AllbeeAI.jsx"));

function AllbeeAI({ db, config, me, role, isAdmin, go }) {
  return (
    <LazyAllbeeAI
      db={db}
      config={config}
      me={me}
      role={role}
      isAdmin={isAdmin}
      go={go}
      runtime={{ aiConfigOf, companyOf, aiConfigured, buildAIContext, callAI, ROLE_LABEL, AI_QUICK_PROMPTS, renderAIText, supabase }}
    />
  );
}
function AISettings({ config, saveAI }) {
  const init = aiConfigOf(config);
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDone(false); };
  const save = async () => { setBusy(true); try { await saveAI({ ...f, enabled: !!f.enabled, mode: "function", functionName: "ai-chat-v2", model: AI_RUNTIME_MODEL, apiKey: "" }); setDone(true); } finally { setBusy(false); } };
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
        <Sparkles size={14} color="var(--primary)" /> ALLBEE AI assistant
      </div>
      <p className="hint-line" style={{ lineHeight: 1.6, marginBottom: 14 }}>
        Adds a built-in AI on the <b style={{ color: "var(--ink)" }}>ALLBEE AI</b> screen that staff can ask to draft quotations, reply to clients and summarise work — grounded in your live data.
      </p>

      <label className="perm-item" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        <span>Turn ALLBEE AI on for the team</span>
      </label>

      <Field label="How the app reaches the AI">
        <div className="input mono" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>Supabase Edge Function · server-side · secure</div>
      </Field>

      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 12, background: "var(--primary-soft)" }}>
        <Sparkles size={15} /> Production AI is routed through the <b>ai-chat-v2</b> Supabase Edge Function. The API key never reaches the browser.
      </div>

      <Field label="Model" hint="Production model is fixed server-side so legacy model settings cannot break ALLBEE AI.">
        <div className="input mono" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>OpenAI GPT-OSS 120B · Groq</div>
      </Field>

      <button className="btn primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}{done ? "Saved" : "Save AI settings"}</button>
    </div>
  );
}

function Settings({ db, mutate, replaceDB, syncError, currentUser, role, teamCount, sessionEmail, config, saveTnc, saveRoleTnc, saveCompany, saveAI }) {
  const fileRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const exportJSON = async () => {
    try {
      const snapshot = await buildBackupSnapshot(db);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `allbee-backup-${todayISO()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      emitToast("Couldn't build the JSON backup — check your connection and try again.", "error");
    }
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || typeof d !== "object" || Array.isArray(d) || !Array.isArray(d.transactions)) {
          throw new Error("Invalid ALLBEE backup: the transactions collection is missing or malformed.");
        }
        const ok = window.confirm("Import this ALLBEE backup? This will replace the current workspace data. The restore is transactional and will roll back automatically if anything fails.");
        if (!ok) return;
        await replaceDB(d);
      } catch (err) {
        emitToast(err?.message || "That file couldn't be read as an ALLBEE backup.", "error");
      }
    };
    r.onerror = () => emitToast("That backup file could not be read.", "error");
    r.readAsText(file); e.target.value = "";
  };
  const counts = { "Team members": teamCount || 0, Transactions: db.transactions.length, Withdrawals: db.withdrawals.length, Tasks: db.tasks.length, Projects: db.projects.length, Students: db.students.length, "Marketing clients": db.marketing.length, "Leave requests": db.leave.length, "Daily updates": db.updates.length };
  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div className="page-head"><h3>Settings</h3></div>

      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Backup & restore</div>
        <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 14 }}>
          Export a full copy of your ALLBEE workspace data. <b>Excel backup</b> writes one sheet per module — open it in Excel or import it into Google Sheets (File → Import) for a spreadsheet backup. <b>JSON backup</b> is for re-importing here later. JSON restore is performed atomically on the server, so a failed restore leaves the existing data unchanged.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => exportFullBackupXLSX(db)}><Sheet size={16} />Excel backup (workspace)</button>
          <button className="btn" onClick={exportJSON}><Download size={16} />JSON backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} />Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} style={{ display: "none" }} />
        </div>
      </div>

      <TncManager config={config} saveTnc={saveTnc} saveRoleTnc={saveRoleTnc} />

      <CompanySettings config={config} saveCompany={saveCompany} />

      <AISettings config={config} saveAI={saveAI} />


      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Import from Excel / Google Sheets</div>
        <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 14 }}>
          Bring in existing records — income, expenses, withdrawals, projects, students, marketing clients, ideas or tasks — from a spreadsheet. Upload an <b>.xlsx</b> or <b>.csv</b> file (from Google Sheets use <b>File → Download</b>). Imported rows are <b>added</b> to what's already here; they don't replace anything.
        </p>
        <button className="btn primary" onClick={() => setImportOpen(true)}><Sheet size={16} />Import a spreadsheet</button>
      </div>

      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Your data</div>
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="hint-line">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stat">
        <div className="lbl" style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>About this build</div>
        <p className="hint-line" style={{ lineHeight: 1.6, margin: 0 }}>
          Signed in as <b style={{ color: avatarColor(currentUser) }}>{currentUser}</b>{sessionEmail ? ` (${sessionEmail})` : ""} · <b>{ROLE_LABEL[role] || "Staff"}</b>. Records live in a shared Postgres database and sync across the team in real time{syncError ? " — but the last sync failed, so some changes may not have saved yet" : ""}. Share &amp; accounts and Withdrawals are limited to the two partners and an accountant; module access for staff is set per person on the Team screen. All of this is enforced by the database, not just hidden. File attachments and an installable Android version are optional add-ons documented in the project README.
        </p>
      </div>

      {importOpen && <ImportData mutate={mutate} currentUser={currentUser} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function TncManager({ config, saveTnc, saveRoleTnc }) {
  const TARGETS = [["all", "All users (general)"], ["admin", "Admins"], ["accountant", "Accountants"], ["staff", "Staff"], ["intern", "Interns"]];
  const [target, setTarget] = useState("all");
  const roleMap = roleTncOf(config);
  const bodyFor = (t) => t === "all" ? (config?.tnc_body || "") : (roleMap[t]?.body || "");
  const versionFor = (t) => t === "all" ? Number(config?.tnc_version || 0) : Number(roleMap[t]?.version || 0);
  const [body, setBody] = useState(bodyFor("all"));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // load the selected agreement's text when the target or stored config changes
  useEffect(() => { setBody(target === "all" ? (config?.tnc_body || "") : (roleTncOf(config)[target]?.body || "")); setDone(false); }, [target, config?.tnc_body, config?.tnc_roles]);
  const version = versionFor(target);
  const targetLabel = (TARGETS.find((t) => t[0] === target) || ["", ""])[1];
  const publish = async () => {
    setSaving(true); setDone(false);
    try { if (target === "all") await saveTnc(body); else await saveRoleTnc(target, body); setDone(true); }
    catch { /* surfaced via the sync banner */ } finally { setSaving(false); }
  };
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Terms &amp; conditions</div>
      <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 12 }}>
        Publish a <b>general</b> agreement everyone signs, plus optional <b>role-specific</b> agreements. On sign-in each person accepts the general terms <i>and</i> the terms for their role. Publishing a change asks the affected people to re-accept before they carry on.
      </p>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <Field label="Agreement"><select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>{TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}><span className="hint-line">{version > 0 ? <>Current: <b style={{ color: "var(--ink)" }}>version {version}</b></> : "Not published yet"}</span></div>
      </div>
      <textarea className="textarea" style={{ minHeight: 150 }} value={body} onChange={(e) => { setBody(e.target.value); setDone(false); }} placeholder={target === "all" ? "Terms every employee accepts…" : `Terms specific to ${targetLabel}…`} />
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" onClick={publish} disabled={saving || !body.trim()}>
          {saving ? <RefreshCw size={16} className="spin" /> : <ScrollText size={16} />}{version > 0 ? "Publish update" : "Publish terms"}
        </button>
        {done && <span className="hint-line" style={{ color: "var(--pos)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Published — affected people re-accept on next sign-in.</span>}
      </div>
    </div>
  );
}


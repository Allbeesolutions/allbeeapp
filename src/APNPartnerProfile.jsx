import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

function APNPartnerProfileShell({ fullPage, title, onClose, onSave, onOpenFullPage, children, runtime = {} }) {
  const { Modal, Check, ArrowLeft } = runtime;
  if (!fullPage) return <Modal title={title} onClose={onClose} onMaximize={onOpenFullPage} footer={<><button className="btn" onClick={onClose}>Close</button>{onSave && <button className="btn primary" onClick={onSave}><Check size={15} />Save changes</button>}</>}>{children}</Modal>;
  return <div className="content" style={{ maxWidth: 1120, margin: "0 auto", paddingBottom: 40 }}>
    <div className="page-head" style={{ position: "sticky", top: 0, zIndex: 4, background: "var(--bg)", paddingTop: 12, paddingBottom: 12 }}>
      <button className="backlink" onClick={onClose}><ArrowLeft size={15} />Back to Partners</button><h3 style={{ margin: 0 }}>{title}</h3><span className="spacer" />
      <button className="btn" onClick={onClose}>Close</button>{onSave && <button className="btn primary" onClick={onSave}><Check size={15} />Save changes</button>}
    </div>
    {children}
  </div>;
}

export function APNTagForm({ partner, onSave, onClose, runtime = {} }) {
  const { Modal, Check, APN_TAG_OPTIONS = ["High potential", "Top performer", "Follow-up", "Training", "At risk"] } = runtime;
  const [tags, setTags] = useState(partner.tags || []);
  const toggle = (tag) => setTags((prev) => prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]);
  return <Modal title={`Tags · ${partner.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(tags)}><Check size={15} />Save tags</button></>}><div className="apn-tag-picker">{APN_TAG_OPTIONS.map((tag) => <button type="button" className={tags.includes(tag) ? "on" : ""} key={tag} onClick={() => toggle(tag)}>{tag}</button>)}</div></Modal>;
}

export function APNPartnerDocumentForm({ partner, initial, onSave, onClose, runtime = {} }) {
  const { Modal, Field, Upload, Check, APN_DOCUMENT_TYPES = ["Agreement", "KYC", "Bank details", "Other"] } = runtime;
  const [type, setType] = useState(initial?.type || APN_DOCUMENT_TYPES[0]); const [version, setVersion] = useState(initial?.version || 1); const [file, setFile] = useState(null); const [notes, setNotes] = useState(initial?.notes || "");
  return <Modal title={`${initial ? "Update" : "Add"} partner document · ${partner.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave({ type, version: Number(version) || 1, file, notes })}><Upload size={15} />Save document</button></>}><Field label="Document type" required><select className="select" value={type} onChange={(e) => setType(e.target.value)}>{APN_DOCUMENT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Version"><input className="input" type="number" min="1" value={version} onChange={(e) => setVersion(e.target.value)} /></Field><Field label={initial ? "Replace file (optional)" : "Private file"} required={!initial}><input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field><Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></Modal>;
}

export function APNCommunicationForm({ partner, onSave, onClose, runtime = {} }) {
  const { Modal, Field, Send, APN_COMMUNICATION_TYPES = ["Call", "Email", "Meeting", "Notification", "Other"] } = runtime;
  const [type, setType] = useState(APN_COMMUNICATION_TYPES[0]); const [receiver, setReceiver] = useState(partner.name || "Partner"); const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [status, setStatus] = useState("Logged");
  return <Modal title={`Communication · ${partner.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!subject.trim() && !message.trim()} onClick={() => onSave({ type, receiver, subject: subject.trim(), message: message.trim(), status })}><Send size={15} />Save log</button></>}><Field label="Type"><select className="select" value={type} onChange={(e) => setType(e.target.value)}>{APN_COMMUNICATION_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Receiver"><input className="input" value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field><Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field><Field label="Message"><textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} /></Field><Field label="Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option>Logged</option><option>Sent</option><option>Delivered</option><option>Failed</option></select></Field></Modal>;
}

function APNActionMenu({ partner, isSuper, canManage, onAction, runtime = {} }) {
  const { apnEffectiveStatus: effectiveStatus, MoreVertical } = runtime;
  const [open, setOpen] = useState(false);
  const options = [
    ["Approve", canManage && partner.status === "pending"], ["Reject", canManage && partner.status === "pending"], ["View details", true],
    ["Edit Profile", true], ["View Timeline", true], ["View Activity", true],
    ["Reset Password", isSuper], ["Send Notification", isSuper], ["Generate Report", isSuper], ["Promote", isSuper && partner.role !== "state_head"], ["Demote", isSuper && (partner.role === "district_head" || partner.role === "state_head")],
    ["Transfer District", isSuper], ["Reset Quiz", isSuper], ["Reset Training", isSuper], ["Reset Attendance", isSuper], ["Reset Target", isSuper],
    ["Suspend", isSuper && !["suspended", "deleted"].includes(effectiveStatus ? effectiveStatus(partner) : partner.status)], ["Deactivate", isSuper && effectiveStatus ? effectiveStatus(partner) : partner.status === "active"],
    ["Ban", isSuper && partner.status !== "banned" && partner.status !== "deleted"],
    ["Reactivate", isSuper && ["inactive", "suspended"].includes(effectiveStatus ? effectiveStatus(partner) : partner.status)], ["Delete Partner", isSuper && partner.status !== "deleted"], ["Permanent Delete", isSuper && partner.status !== "deleted"],
    ["View as Partner (Coming Soon)", false],
  ];
  return <div className="apn-action-wrap" onClick={(e) => e.stopPropagation()}>
    <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label={`Actions for ${partner.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><MoreVertical size={16} /></button>
    {open && <div className="apn-action-menu" role="menu">{options.map(([label, enabled]) => <button key={label} type="button" role="menuitem" disabled={!enabled} onClick={() => { setOpen(false); if (enabled) onAction(label, partner); }}>{label}</button>)}</div>}
  </div>;
}

function apnPartnerProfileForm(partner, stats, target) {
  return {
    name: partner.name || "", username: partner.username || "", email: partner.email || "", mobile: partner.mobile || "",
    alternateNumber: partner.alternateNumber || "", gender: partner.gender || "", dob: partner.dob || "",
    country: partner.country || "India", state: partner.state || "Tamil Nadu", district: partner.district || "", taluk: partner.taluk || "",
    city: partner.city || "", pincode: partner.pincode || "", address: partner.address || "",
    status: partner.status || "pending", level: apnAdminLevel(partner, stats), target: partner.target ?? target?.goal ?? "",
    targetMetric: partner.targetMetric || target?.metric || "leads", commissionPct: stats.level.rate,
    attendanceScore: partner.attendanceScore ?? "", notes: partner.notes || partner.reason || "", kycStatus: partner.kycStatus || "Not started",
  };
}

export function APNPartnerProfile({ partner, db, people = [], isSuper, fullPage = false, initialSection = "summary", onSave, onAction, onWarning, onResolveWarning, onDeleteWarning, onNote, onEditNote, onTags, onDocuments, onDocumentDownload, onCommunication, onExport, onClose, onOpenFullPage, runtime = {} }) {
  const { APNPartnerDashboard: PartnerDashboard, APNPartnerAnalytics: PartnerAnalytics, APNPartnerDocuments: PartnerDocuments, APNPartnerCommunications: PartnerCommunications, APNPartnerActivity: PartnerActivity, apnPartnerStats, apnTargetFor, apnHealthScore, todayISO, apnAttendanceScore, apnMonthlyAnalytics, apnActivityHistory, apnMilestones, apnRecommendations, apnRiskIndicators, apnDerivedTimeline, apnPartnerProfileForm, apnPercent, apnLastActivity, apnAvatarUrl, apnTimelineEntry, APN_ADMIN_LEVELS, APN_ADMIN_STATUSES, APN_LEAD_REJECTED, APN_TARGET_METRICS, apnAdminLevel, apnEffectiveStatus, apnIdFor, apnLastSeenAt, apnLastSeenLabel, apnLeadTone, apnSafeHtml, apnStatusClass, apnStatusLabel, Avatar, AlertTriangle, Empty, Plus, Sparkles, Tag, Trash2, Field, fmtDateTime, emitToast, Search, Pencil, Save, Check, X, ChevronRight, ChevronDown, ArrowRight, Download, FileText, Activity, Filter, Send, Eye, MoreVertical, Modal, Confirm, uid, supabase, TN_DISTRICTS, APN_SERVICE_LABEL, money } = runtime;
  const stats = apnPartnerStats(db, partner.id);
  const target = apnTargetFor(db, partner.id, partner.targetResetAt);
  const profile = people.find((x) => x.id === partner.id);
  const health = apnHealthScore(db, partner, profile);
  const activeTargets = (db.apn_targets || []).filter((t) => t.partnerId === partner.id && (!t.endDate || t.endDate >= todayISO()) && (t.createdAt || 0) > (partner.targetResetAt || 0));
  const summary = { leads: stats.submitted, converted: stats.converted, conv: stats.conv, revenue: stats.revenue, earned: stats.commission.earned, paid: stats.commission.paid, pending: stats.commission.pending + stats.commission.payable, activeTargets: activeTargets.length, attendance: apnAttendanceScore(db, partner.id, partner.attendanceScore) };
  const analytics = apnMonthlyAnalytics(db, partner.id);
  const activityRows = apnActivityHistory(db, partner, profile);
  const milestones = apnMilestones(db, partner);
  const recommendations = apnRecommendations(db, partner, profile);
  const risks = apnRiskIndicators(db, partner, profile);
  const partnerDocuments = (db.apn_documents || []).filter((x) => x.partnerId === partner.id);
  const communications = (db.apn_communications || []).filter((x) => x.partnerId === partner.id);
  const [showAllActivity, setShowAllActivity] = useState(initialSection === "activity");
  const profileFormRef = useRef(null);
  const nameInputRef = useRef(null);
  const timelineRef = useRef(null);
  const activityRef = useRef(null);
  const pendingActivityScrollRef = useRef(false);
  useEffect(() => {
    if (!pendingActivityScrollRef.current || !showAllActivity) return;
    pendingActivityScrollRef.current = false;
    requestAnimationFrame(() => activityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [showAllActivity]);
  const [timelinePage, setTimelinePage] = useState(0);
  const warnings = (db.apn_warnings || []).filter((x) => x.partnerId === partner.id).sort((a, b) => (b.issuedAt || b.createdAt || 0) - (a.issuedAt || a.createdAt || 0));
  const notes = (db.apn_notes || []).filter((x) => x.partnerId === partner.id).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const persistedTimeline = (db.apn_timeline || []).filter((x) => x.partnerId === partner.id);
  const timeline = [...new Map([...apnDerivedTimeline(db, partner), ...persistedTimeline].map((x) => [x.id, x])).values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const timelinePageSize = 8;
  const timelinePages = Math.max(1, Math.ceil(timeline.length / timelinePageSize));
  const visibleTimeline = timeline.slice(timelinePage * timelinePageSize, timelinePage * timelinePageSize + timelinePageSize);
  const [f, setF] = useState(() => apnPartnerProfileForm(partner, stats, target));
  const canEdit = isSuper && partner.status !== "deleted";
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => {
    setF(apnPartnerProfileForm(partner, stats, target));
    setErr("");
    setShowAllActivity(initialSection === "activity");
    setTimelinePage(0);
    setAuditPage(0);
  }, [partner.id, partner.updatedAt, target?.id, target?.goal, target?.metric, initialSection]);
  const save = () => {
    if (!f.name.trim()) { setErr("Enter the partner's name."); return; }
    if (!f.email.trim()) { setErr("Enter an email address."); return; }
    if (!f.district) { setErr("Choose a district."); return; }
    if (f.status === "suspended" && partner.status !== "suspended") { setErr("Use the Suspend action so a reason and suspension audit record are captured."); return; }
    if (partner.status === "suspended" && f.status === "active") { setErr("Use the Reactivate action to restore login access and record the change."); return; }
    try { apnPercent(f.commissionPct, "Commission %"); apnPercent(f.attendanceScore, "Attendance score"); } catch (e) { setErr(e.message); return; }
    onSave({
      ...partner, ...f, name: f.name.trim(), username: f.username.trim().toLowerCase(), email: f.email.trim().toLowerCase(),
      mobile: f.mobile.trim(), alternateNumber: f.alternateNumber.trim(), target: Number(f.target) || 0,
      commissionPct: apnPercent(f.commissionPct, "Commission %") ?? 0, attendanceScore: apnPercent(f.attendanceScore, "Attendance score"),
      updatedAt: Date.now(), role: f.level === "State Head" ? "state_head" : f.level === "District Head" ? "district_head" : (["district_head", "state_head"].includes(partner.role) && !["District Head", "State Head"].includes(f.level) ? "partner" : partner.role),
    });
  };
  const actions = canEdit
    ? ["Edit Profile", "Reset Password", "Send Notification", "Generate Report", "Change Username", "Change Email", "Change Phone", "Promote", "Demote", "Transfer District", "Reset Quiz", "Reset Training", "Reset Attendance", "Reset Target", "Reset Commission", "Deactivate", "Reactivate", "Suspend", "Delete Partner", "Permanent Delete", "View Activity Log", "View as Partner (Coming Soon)"]
    : ["View Activity Log", "View as Partner (Coming Soon)"];
  const lastActivity = apnLastActivity(db, partner.id, partner);
  const kv = (k, v) => <div className="apn-profile-kv"><span>{k}</span><span>{v || "—"}</span></div>;
  const auditAll = (db.audit || []).filter((x) => x.module === "APN" && (x.partnerId === partner.id || String(x.action || "").toLowerCase().includes(String(partner.name || "").toLowerCase()))).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const [auditPage, setAuditPage] = useState(0);
  const auditPageSize = 12;
  const auditPages = Math.max(1, Math.ceil(auditAll.length / auditPageSize));
  const audit = auditAll.slice(auditPage * auditPageSize, auditPage * auditPageSize + auditPageSize);
  const handleQuickAction = (action) => {
    if (action === "Edit Profile") {
      profileFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    if (action === "View Timeline") {
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "View Activity") {
      pendingActivityScrollRef.current = true;
      setShowAllActivity(true);
      if (showAllActivity) requestAnimationFrame(() => activityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    onAction(action, partner);
  };
  return (
    <APNPartnerProfileShell runtime={runtime} fullPage={fullPage} title={`Partner profile · ${partner.name}`} onClose={onClose} onSave={canEdit ? save : null} onOpenFullPage={!fullPage ? onOpenFullPage : null}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Avatar name={partner.name} url={apnAvatarUrl(partner, profile)} size={42} fontSize={17} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{partner.name}</div><div className="hint-line">{apnIdFor(partner)} · {partner.email || "No email"}</div></div>
        <span className={"status-pill " + apnStatusClass(apnEffectiveStatus(partner))}>{apnStatusLabel(apnEffectiveStatus(partner))}</span>
        {(["district_head", "state_head"].includes(partner.role) || ["District Head", "State Head"].includes(partner.level)) && <span className="badge pri">{apnAdminLevel(partner, stats)}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>{(partner.tags || []).map((tag) => <span className="apn-tag" key={tag}>{tag}</span>)}{isSuper && <button className="btn sm" onClick={() => onTags(partner)}><Tag size={13} />Manage tags</button>}</div>
      <PartnerDashboard summary={summary} health={health} />
      {isSuper && <div className="apn-quick-actions" aria-label="Quick Actions"><b style={{ alignSelf: "center", marginRight: 3 }}>Quick Actions</b>{["Edit Profile", "View Timeline", "View Activity", "Reset Password", "Send Notification", "Promote", "Suspend", "Delete Partner"].map((action) => <button key={action} className="btn sm" onClick={() => handleQuickAction(action)} disabled={action === "Suspend" && ["suspended", "deleted"].includes(apnEffectiveStatus(partner)) || action === "Delete Partner" && partner.status === "deleted"}>{action}</button>)}<button className="btn sm" onClick={() => onExport?.(partner)}><Download size={13} />Generate Report</button></div>}
      {actions.length > 0 && <Field label="Actions"><select className="select" value="" onChange={(e) => { if (e.target.value && e.target.value !== "View as Partner (Coming Soon)") onAction(e.target.value, partner); }}><option value="">Choose an action…</option>{actions.map((a) => <option key={a} value={a} disabled={a === "View as Partner (Coming Soon)"}>{a}</option>)}</select></Field>}

      <div ref={profileFormRef} className="apn-profile-section"><h4>Basic information</h4><div className="apn-profile-grid">
        <Field label="Full name" required><input ref={nameInputRef} className="input" value={f.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Username"><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Email" required error={err}><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Mobile number"><input className="input" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Alternate number"><input className="input" value={f.alternateNumber} onChange={(e) => set("alternateNumber", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Gender"><select className="select" value={f.gender} onChange={(e) => set("gender", e.target.value)} disabled={!canEdit}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
        <Field label="Date of birth"><input className="input" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} disabled={!canEdit} /></Field>
      </div></div>

      <div className="apn-profile-section"><h4>Address</h4><div className="apn-profile-grid">
        <Field label="Country"><input className="input" value={f.country} onChange={(e) => set("country", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="State"><input className="input" value={f.state} onChange={(e) => set("state", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="District" required><select className="select" value={f.district} onChange={(e) => set("district", e.target.value)} disabled={!canEdit}><option value="">Choose…</option>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Taluk"><input className="input" value={f.taluk} onChange={(e) => set("taluk", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Pincode"><input className="input" value={f.pincode} onChange={(e) => set("pincode", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Full address"><textarea className="textarea" value={f.address} onChange={(e) => set("address", e.target.value)} disabled={!canEdit} /></Field>
      </div></div>

      <div className="apn-profile-section"><h4>APN information</h4><div className="apn-profile-grid">
        <div>{kv("Partner ID", apnIdFor(partner))}{kv("Registration date", partner.createdAt ? fmtDate(new Date(partner.createdAt).toISOString().slice(0, 10)) : "—")}{kv("Current level", apnAdminLevel(partner, stats))}{kv("Quiz status", Object.keys(partner.quizPasses || {}).length ? "Passed" : "Not started")}{kv("Training status", Object.keys(partner.unlocked || {}).length ? "In progress" : "Not started")}</div>
        <div>{kv("Revenue generated", money(stats.revenue))}{kv("Total leads", stats.submitted)}{kv("Converted leads", stats.converted)}{kv("Rejected leads", (db.apn_leads || []).filter((l) => l.partnerId === partner.id && APN_LEAD_REJECTED.has(l.status)).length)}{kv("Commission earned", money(stats.commission.earned))}</div>
      </div><div className="apn-profile-grid" style={{ marginTop: 12 }}>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)} disabled={!canEdit}>{APN_ADMIN_STATUSES.map((s) => <option key={s} value={s} disabled={s === "deleted"}>{apnStatusLabel(s)}</option>)}</select></Field>
        <Field label="Level"><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)} disabled={!canEdit}>{APN_ADMIN_LEVELS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Target"><input className="input" type="number" min="0" value={f.target} onChange={(e) => set("target", e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Target metric"><select className="select" value={f.targetMetric} onChange={(e) => set("targetMetric", e.target.value)} disabled={!canEdit}>{APN_TARGET_METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Commission rate (progression)"><input className="input" type="number" min="0" max="100" value={f.commissionPct} readOnly disabled /></Field>
        <Field label="Attendance score"><input className="input" type="number" min="0" max="100" value={f.attendanceScore} onChange={(e) => set("attendanceScore", e.target.value)} disabled={!canEdit} placeholder={String(apnAttendanceScore(db, partner.id))} /></Field>
        <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} disabled={!canEdit} /></Field>
      </div><div className="apn-profile-stats" style={{ marginTop: 12 }}>
        <div className="apn-profile-stat"><div className="k">Commission paid</div><div className="v">{money(stats.commission.paid)}</div></div>
        <div className="apn-profile-stat"><div className="k">Pending commission</div><div className="v">{money(stats.commission.pending)}</div></div>
        <div className="apn-profile-stat"><div className="k">Wallet balance</div><div className="v">{money(stats.commission.approved + stats.commission.payable)}</div></div>
        <div className="apn-profile-stat"><div className="k">Current target</div><div className="v">{target ? `${target.raw || 0}/${target.goal || 0}` : (f.target || "—")}</div></div>
      </div></div>

      <div className="apn-profile-section"><h4>Partner health score</h4><div className="apn-health"><div className="apn-health-ring">{health.score}</div><div><div style={{ fontWeight: 800 }}>{health.band}</div><div className="hint-line">System-generated from attendance, activity, training, quiz, lead quality, conversions, warnings, and login activity.</div></div></div><div className="apn-health-parts">{Object.entries(health.parts).map(([k, v]) => <div className="apn-health-part" key={k}>{k.replace(/[A-Z]/g, (m) => ` ${m}`).replace(/^./, (m) => m.toUpperCase())}<b>{v}</b></div>)}</div></div>

      <PartnerAnalytics rows={analytics} />
      <div className="apn-profile-section"><div className="apn-section-head"><h4>Partner milestones</h4></div><div className="apn-milestones">{milestones.map((m) => <div className={"apn-milestone " + (m.done ? "done" : "")} key={m.id}><span>{m.done ? "✓" : "○"}</span><div><b>{m.label}</b>{m.at && <div className="hint-line">{fmtDateTime(m.at)}</div>}</div></div>)}</div></div>
      {recommendations.length > 0 && <div className="apn-profile-section"><h4>Smart recommendations</h4><div className="apn-alert-list">{recommendations.map((x) => <div className="apn-alert" key={x}><Sparkles size={14} color="var(--accent)" />{x}</div>)}</div></div>}
      {risks.length > 0 && <div className="apn-profile-section"><h4>Risk indicators</h4><div className="apn-alert-list">{risks.map(([x, tone]) => <div className="apn-alert" key={x}><AlertTriangle size={14} color={`var(--${tone})`} />{x}</div>)}</div></div>}

      <div className="apn-profile-section"><h4>Last Seen</h4>{kv("Presence", apnLastSeenLabel(partner, profile))}{kv("Last seen at", apnLastSeenAt(partner, profile) ? fmtDateTime(apnLastSeenAt(partner, profile)) : "Never")}{kv("Last activity", lastActivity ? fmtDateTime(lastActivity) : "—")}</div>

      <PartnerDocuments documents={partnerDocuments} isSuper={isSuper && !partner.deletedAt} onAdd={() => onDocuments?.(partner)} onDownload={onDocumentDownload} />
      <PartnerCommunications rows={communications} isSuper={isSuper && !partner.deletedAt} onAdd={() => onCommunication?.(partner)} />

      <div className="apn-profile-section"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h4 style={{ margin: 0 }}>Warnings</h4><span className="spacer" />{!partner.deletedAt && <button className="btn sm" onClick={() => onWarning(partner)}><Plus size={13} />Add warning</button>}</div>{warnings.length ? warnings.map((w) => <div className="apn-warning" key={w.id}><AlertTriangle size={15} color={w.status === "Active" ? "var(--neg)" : "var(--muted)"} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{w.type} <span className={"badge " + (w.status === "Active" ? "neg" : "pos")} style={{ marginLeft: 5 }}>{w.status}</span></div><div style={{ marginTop: 3, whiteSpace: "pre-wrap", fontSize: 12.5 }}>{w.notes || w.reason}</div><div className="hint-line" style={{ marginTop: 4 }}>{w.issuedBy || "—"} · {fmtDateTime(w.issuedAt || w.createdAt)}{w.resolvedAt ? ` · resolved ${fmtDateTime(w.resolvedAt)}` : ""}</div></div><div style={{ display: "flex", gap: 4 }}>{w.status === "Active" && <button className="btn sm" onClick={() => onResolveWarning(w)}>Resolve</button>}{isSuper && <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Delete warning" onClick={() => onDeleteWarning(w)}><Trash2 size={13} /></button>}</div></div>) : <div className="hint-line">No warnings recorded.</div>}</div>

      <div className="apn-profile-section"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h4 style={{ margin: 0 }}>Internal Notes</h4><span className="spacer" />{!partner.deletedAt && <button className="btn sm" onClick={() => onNote(partner)}><Plus size={13} />Add note</button>}</div>{notes.length ? notes.map((n) => <div className="apn-note" key={n.id}><div dangerouslySetInnerHTML={{ __html: apnSafeHtml(n.bodyHtml || n.body) }} /><div className="hint-line" style={{ marginTop: 7 }}>{n.author || "—"} · {fmtDateTime(n.updatedAt || n.createdAt)}{n.history?.length ? ` · ${n.history.length} edit${n.history.length === 1 ? "" : "s"}` : ""}<button className="btn sm" style={{ marginLeft: 8 }} onClick={() => onEditNote(n)}>Edit</button></div></div>) : <div className="hint-line">No internal notes recorded.</div>}</div>

      <div ref={timelineRef} className="apn-profile-section"><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><h4 style={{ margin: 0 }}>Partner Timeline</h4><span className="spacer" />{onExport && isSuper && <button className="btn sm" onClick={() => onExport(partner)}><Download size={13} />Export report</button>}</div><div className="apn-timeline">{visibleTimeline.length ? visibleTimeline.map((x) => <div className="apn-timeline-item" key={x.id}><div className="apn-timeline-dot" /><div><div className="apn-timeline-title">{x.title}</div><div style={{ fontSize: 12.5, marginTop: 2 }}>{x.description}</div><div className="apn-timeline-meta">{fmtDateTime(x.createdAt)} · {x.performedBy || "System"}</div></div></div>) : <div className="hint-line">No timeline events recorded yet.</div>}</div>{timelinePages > 1 && <div className="apn-pagination"><button className="btn sm" disabled={timelinePage === 0} onClick={() => setTimelinePage((p) => p - 1)}>Previous</button><span className="hint-line">Page {timelinePage + 1} of {timelinePages}</span><button className="btn sm" disabled={timelinePage >= timelinePages - 1} onClick={() => setTimelinePage((p) => p + 1)}>Next</button></div>}</div>

      <div className="apn-profile-section"><h4>Account information</h4>{kv("Username", f.username)}{kv("Email", f.email)}{kv("Phone", f.mobile)}{kv("Created at", partner.createdAt ? fmtDateTime(partner.createdAt) : "—")}{kv("Updated at", partner.updatedAt ? fmtDateTime(partner.updatedAt) : "—")}{kv("Terms accepted", partner.termsAccepted || (partner.tncAccepted ? "Yes" : "Not recorded"))}{kv("KYC status", f.kycStatus)}{kv("Documents", Array.isArray(partner.documents) ? `${partner.documents.length} document(s)` : "Future-ready")}{kv("Last login", partner.lastLogin ? fmtDateTime(partner.lastLogin) : "—")}{kv("Last Seen", apnLastSeenLabel(partner, profile))}</div>
      <div className="apn-profile-section"><h4>Audit log</h4>{audit.length ? audit.map((x) => <div key={x.id} className="apn-profile-kv"><span>{fmtDateTime(x.ts)} · {x.user || "—"}</span><span>{x.action}</span></div>) : <div className="hint-line">No APN audit entries recorded yet.</div>}{auditPages > 1 && <div className="apn-pagination"><button className="btn sm" disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)}>Previous</button><span className="hint-line">Page {auditPage + 1} of {auditPages}</span><button className="btn sm" disabled={auditPage >= auditPages - 1} onClick={() => setAuditPage((p) => p + 1)}>Next</button></div>}</div>
      <div className="apn-profile-section"><h4>Recent activity</h4>{[
        ...(db.apn_leads || []).filter((x) => x.partnerId === partner.id).map((x) => ({ ts: x.createdAt, text: `Lead submitted · ${x.clientName || "Unnamed client"}` })),
        ...(db.apn_quotations || []).filter((x) => x.partnerId === partner.id).map((x) => ({ ts: x.createdAt, text: `Quotation created · ${x.clientName || "Unnamed client"}` })),
        ...(db.apn_commissions || []).filter((x) => x.partnerId === partner.id).map((x) => ({ ts: x.createdAt, text: `Commission ${x.status || "recorded"} · ${money(x.amount)}` })),
      ].filter((x) => x.ts).sort((a, b) => b.ts - a.ts).slice(0, 8).map((x, i) => <div key={i} className="apn-profile-kv"><span>{fmtDateTime(x.ts)}</span><span>{x.text}</span></div>)}{!(db.apn_leads || []).some((x) => x.partnerId === partner.id) && !(db.apn_quotations || []).some((x) => x.partnerId === partner.id) && !(db.apn_commissions || []).some((x) => x.partnerId === partner.id) && <div className="hint-line">No activity recorded yet.</div>}</div>
      <div ref={activityRef}>{showAllActivity ? <PartnerActivity rows={activityRows} /> : <button className="btn" style={{ width: "100%" }} onClick={() => { pendingActivityScrollRef.current = true; setShowAllActivity(true); }}><Activity size={14} />View complete activity history</button>}</div>
    </APNPartnerProfileShell>
  );
}

export function APNAdminHub({ db = {}, mutate, currentUser, isAdmin, runtime = {} }) {
  const { apnConsoleRow: getConsoleRow, apnCampaignOf: getCampaign, apnLivePartners: getLivePartners, round2: round, uid: makeUid, supabase: sb, emitToast: toast, Users, Check, Hourglass, Ban, Lightbulb, TrendingUp, Megaphone, Globe2, Field, ShieldHalf, Empty, X, apnEffectiveStatus: effectiveStatus, money: formatMoney, fmtDateTime: formatDateTime } = runtime;
  const [campaign, setCampaign] = useState(() => null);
  const requests = (Array.isArray(db.apn_zone_requests) ? db.apn_zone_requests : []).filter(Boolean).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const openRequests = requests.filter((r) => ["pending", "requested"].includes(r.status));
  const consoleRow = getConsoleRow ? getConsoleRow(db) : {};
  const camp = getCampaign ? getCampaign(db) : { active: false, message: "inactive", memberCount: 0, targetCount: 0, joined: 0, under: false };
  const live = getLivePartners ? getLivePartners(db) : (Array.isArray(db.apn_users) ? db.apn_users : []);
  const todayLeads = (db.apn_leads || []).filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const todayRevenue = (round || ((n) => Number(n) || 0))((db.apn_leads || []).filter((l) => l.status === "Converted" && l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString()).reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const pendingApprovals = (db.apn_users || []).filter((u) => u.status === "pending").length;
  const bans = (db.apn_users || []).filter((u) => u.status === "banned").length;
  const saveConsole = (next) => mutate((d) => {
    const existing = getConsoleRow ? getConsoleRow(d) : {};
    const row = { ...existing, id: existing.id || (makeUid ? makeUid() : `console-${Date.now()}`), kind: "console", ...next, updatedAt: Date.now() };
    return { ...d, apn_admin_consoles: [...(d.apn_admin_consoles || []).filter((c) => c.kind !== "console"), row] };
  }, { action: "updated hub console settings", module: "APN" });
  const handleZone = async (req, approve) => {
    const status = approve ? "approved" : "rejected";
    mutate((d) => ({ ...d, apn_zone_requests: (d.apn_zone_requests || []).map((r) => r.id === req.id ? { ...r, status, handledAt: Date.now(), handledBy: currentUser } : r), apn_users: approve ? (d.apn_users || []).map((u) => u.id === req.partnerId ? { ...u, zone: req.zone, zoneApprovedAt: Date.now() } : u) : d.apn_users }), { action: `${approve ? "approved" : "rejected"} ${req.partnerName}'s ${req.zone} zone request`, module: "APN", partnerId: req.partnerId });
    try {
      if (!sb?.rpc) return;
      const { error } = await sb.rpc(approve ? "apn_zone_requests_approve" : "apn_zone_requests_reject", { p_request_id: req.id, p_note: null });
      if (error) throw error;
      toast?.(approve ? "Zone request approved." : "Zone request rejected.", "success");
    } catch (err) { console.warn("zone request RPC", err); }
  };
  return (
    <div>
      <div className="sumrow">
        <div className="card"><div className="k"><Users size={14} /> Members</div><div className="v mono">{live.length}</div></div>
        <div className="card"><div className="k"><Check size={14} color="var(--pos)" /> Active partners</div><div className="v mono">{live.filter((u) => (effectiveStatus ? effectiveStatus(u) : u.status) === "active").length}</div></div>
        <div className="card"><div className="k"><Hourglass size={14} /> Pending approvals</div><div className="v mono">{pendingApprovals}</div></div>
        <div className="card"><div className="k"><Ban size={14} color="var(--neg)" /> Bans</div><div className="v mono">{bans}</div></div>
        <div className="card"><div className="k"><Lightbulb size={14} /> Leads today</div><div className="v mono">{todayLeads}</div></div>
        <div className="card"><div className="k"><TrendingUp size={14} /> Revenue today</div><div className="v mono">{(formatMoney ? formatMoney(todayRevenue) : todayRevenue)}</div></div>
      </div>

      <div className="apn-rowcard" style={{ margin: "14px 0" }}>
        <div className="lbl"><Megaphone size={14} /> Worldwide campaign</div>
        <div className="hint-line" style={{ marginTop: 4 }}>The banner partners see says "{camp.active ? camp.message : "inactive"}". Campaign turns on when the flag is set and the member count is below the target count.</div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <Field label="Members joined"><input className="input mono" type="number" min="0" value={campaign?.apnMemberCount ?? (consoleRow.apnMemberCount ?? camp.memberCount)} onChange={(e) => setCampaign((s) => ({ ...s, ...consoleRow, apnMemberCount: Number(e.target.value) || 0 }))} /></Field>
          <Field label="Target member count"><input className="input mono" type="number" min="0" value={campaign?.apnTargetCount ?? (consoleRow.apnTargetCount ?? camp.targetCount)} onChange={(e) => setCampaign((s) => ({ ...s, ...consoleRow, apnTargetCount: Number(e.target.value) || 0 }))} /></Field>
        </div>
        <Field label="Campaign message"><input className="input" value={campaign?.apnCampaignMessage ?? (consoleRow.apnCampaignMessage ?? "")} onChange={(e) => setCampaign((s) => ({ ...s, ...consoleRow, apnCampaignMessage: e.target.value }))} placeholder="WORLDWIDE CAMPAIGN — X of Y partners have joined" /></Field>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label className="apn-check" style={{ marginRight: 10 }}><input type="checkbox" checked={campaign?.apnCampaignActive ?? !!consoleRow.apnCampaignActive} onChange={(e) => setCampaign((s) => ({ ...s, ...consoleRow, apnCampaignActive: e.target.checked }))} /> Campaign active</label>
          <button className="btn sm primary" disabled={!isAdmin} onClick={() => { saveConsole(campaign || {}); setCampaign(null); }}><Check size={13} />Save campaign</button>
        </div>
        {camp.active && camp.under && <div className="banner" style={{ margin: "10px 0 0" }}><Globe2 size={15} />{camp.message} — <b>Target: {camp.targetCount}</b> · {camp.joined}% filled</div>}
      </div>

      <div className="apn-rowcard" style={{ padding: 0, marginBottom: 12 }}>
        <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Zone requests <span className="badge pri" style={{ marginLeft: 5 }}>{openRequests.length || 0}</span></div>
        {requests.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Globe2 size={22} color="var(--muted)" />} title="No zone requests" text="Partners auto-join the current apex zone when they sign in; manual zone changes land here for your approval." /></div>
          : requests.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}>
              <div className="cmdk-ic"><Globe2 size={15} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.partnerName} <span className={"badge " + ({ zone1: "pri", zone2: "pos", zone3: "accent", zone4: "pri", zone5: "pos", zone6: "accent" }[r.zone] || "")} style={{ marginLeft: 5 }}>{String(r.zone || "").toUpperCase()}</span>{r.auto && <span className="badge" style={{ marginLeft: 5 }}>auto</span>}</div>
                <div className="hint-line" style={{ fontSize: 11 }}>{r.notes || (r.auto ? "Auto-joined the current apex zone" : "Manual zone change request")} · {(formatDateTime ? formatDateTime(r.createdAt) : "—")}{r.handledBy ? ` · handled by ${r.handledBy}` : ""}</div>
              </div>
              {["pending", "requested"].includes(r.status) && isAdmin ? <><button className="btn sm primary" onClick={() => handleZone(r, true)}><Check size={13} />Approve</button><button className="btn sm" onClick={() => handleZone(r, false)}><X size={13} />Reject</button></> : <span className={"status-pill " + ({ zone1: "pri", zone2: "pos", zone3: "accent", zone4: "pri", zone5: "pos", zone6: "accent" }[r.status === "approved" ? "zone1" : r.status === "rejected" ? "zone6" : "zone3"] || "")}>{r.status}</span>}
            </div>
          ))}
      </div>
      <div className="hint-line" style={{ fontSize: 12 }}><ShieldHalf size={12} style={{ verticalAlign: -2 }} /> Approvals write a hub note and notify the partner server-side; requesting the RPC twice is safe (idempotent).</div>
    </div>
  );
}

export function APNAdminPartners({ db, people = [], isSuper, canManage, act, openModal, onOpenProfile, runtime = {} }) {
  const { apnEffectiveStatus, apnIdFor, apnStatusLabel, apnPartnerStats, apnAvatarUrl, apnHealthScore, apnLastSeenLabel, apnAdminLevel, apnStatusClass, money, fmtDateTime, Avatar, ActionBadge, Search, Hourglass, Check, XCircle, ShieldCheck, UserPlus, Ban } = runtime;
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const users = (db.apn_users || []).filter((u) => view === "archived" ? u.status === "deleted" : u.status !== "deleted");
  const counts = { pending: users.filter((u) => u.status === "pending").length, active: users.filter((u) => (apnEffectiveStatus ? apnEffectiveStatus(u) : u.status) === "active").length, inactive: users.filter((u) => apnEffectiveStatus(u) === "inactive").length, heads: users.filter((u) => u.role === "district_head" || u.level === "District Head").length, stateHeads: users.filter((u) => u.role === "state_head" || u.level === "State Head").length };
  const query = q.trim().toLowerCase();
  const relatedIndex = useMemo(() => {
    const map = new Map(); const add = (pid, ...values) => { if (!pid) return; const next = map.get(pid) || []; next.push(...values.flat().filter(Boolean)); map.set(pid, next); };
    (db.apn_timeline || []).forEach((x) => add(x.partnerId, x.title, x.description, x.performedBy));
    (db.apn_warnings || []).forEach((x) => add(x.partnerId, x.type, x.reason, x.notes));
    (db.apn_notes || []).forEach((x) => add(x.partnerId, x.bodyHtml, x.body));
    (db.apn_transfer_history || []).forEach((x) => add(x.partnerId, x.previousDistrict, x.newDistrict, x.reason, x.changedBy));
    (db.apn_documents || []).forEach((x) => add(x.partnerId, x.type, x.notes, x.uploadedBy));
    return map;
  }, [db.apn_timeline, db.apn_warnings, db.apn_notes, db.apn_transfer_history, db.apn_documents]);
  const searchIndex = useMemo(() => new Map(users.map((u) => [u.id, [u.name, u.username, apnIdFor(u), u.mobile, u.alternateNumber, u.email, u.district, u.taluk, u.tags, apnStatusLabel(apnEffectiveStatus(u)), ...(relatedIndex.get(u.id) || [])].flat().filter(Boolean).join(" ").toLowerCase()])), [users, relatedIndex]);
  const matches = (u) => !query || searchIndex.get(u.id)?.includes(query);
  const filtered = users.filter((u) => {
    const status = apnEffectiveStatus(u);
    const filterMatch = ["all", "archived"].includes(view) ? true : view === "heads" ? u.role === "district_head" || u.level === "District Head" : view === "state_heads" ? u.role === "state_head" || u.level === "State Head" : status === view;
    return filterMatch && matches(u);
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const list = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pageIds = list.map((p) => p.id);
  const selectedPartners = filtered.filter((p) => selected.has(p.id));
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setSelected((prev) => { const next = new Set(prev); const all = pageIds.every((id) => next.has(id)); pageIds.forEach((id) => all ? next.delete(id) : next.add(id)); return next; });
  const changeView = (next) => { setView(next); setPage(0); setSelected(new Set()); };
  return (
    <div>
      <div className="sumrow">
        <div className="card"><div className="k"><Hourglass size={14} /> Pending</div><div className="v mono">{counts.pending}</div></div>
        <div className="card"><div className="k"><Check size={14} color="var(--pos)" /> Active</div><div className="v mono">{counts.active}</div></div>
        <div className="card"><div className="k"><XCircle size={14} /> Inactive</div><div className="v mono">{counts.inactive}</div></div>
        <div className="card"><div className="k"><ShieldCheck size={14} /> District heads</div><div className="v mono">{counts.heads}</div></div>
        <div className="card"><div className="k"><ShieldCheck size={14} /> State heads</div><div className="v mono">{counts.stateHeads}</div></div>
      </div>
      <div className="toolbar"><div className="search" style={{ flex: 1, maxWidth: 560 }}><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, APN ID, phone, email, tags, timeline, warnings, notes, documents…" /></div></div>
      <div className="apn-seg-scroll">{[["all", "All"], ["active", "Active"], ["pending", "Pending"], ["inactive", "Inactive"], ["heads", "District Heads"], ["state_heads", "State Heads"], ...(isSuper ? [["archived", "Archived Partners"]] : [])].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => changeView(k)}>{l}{k === "pending" && <ActionBadge count={counts.pending} label="pending partner action" />}</button>)}</div>
      {selectedPartners.length > 0 && <div className="toolbar" style={{ marginTop: 0 }}><span className="hint-line">{selectedPartners.length} selected</span><span className="spacer" /><select className="select" style={{ width: "auto" }} defaultValue="" onChange={(e) => { if (e.target.value) { act.bulk(e.target.value, selectedPartners); e.target.value = ""; } }}><option value="">Bulk actions…</option><option>Activate</option><option>Deactivate</option><option>Suspend</option><option>Transfer District</option><option>Assign District Head</option><option>Import Partners (CSV)</option><option>Import Targets (CSV)</option><option>Export</option><option>Delete</option><option>Send Notification</option></select><button className="btn sm" onClick={() => setSelected(new Set())}>Clear</button></div>}
      <div className="card">
        {list.length === 0 ? <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No partners here" text="Applications and partners show up in these tabs." action={canManage ? <button className="btn primary" onClick={() => openModal({ type: "apnCreatePartner" })}><Plus size={16} />Add partner</button> : undefined} />
          : <div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards">
            <thead><tr><th><input type="checkbox" checked={pageIds.length > 0 && pageIds.every((id) => selected.has(id))} onChange={togglePage} aria-label="Select visible partners" /></th><th>Partner</th><th>District</th><th>Level</th><th>Status</th><th>Health</th><th>Last Seen</th><th></th></tr></thead>
            <tbody>{list.map((p) => { const s = apnPartnerStats(db, p.id); const eff = apnEffectiveStatus(p); return (
              <tr key={p.id} className="apn-admin-row" tabIndex={0} role="button" aria-label={`Open partner profile for ${p.name}`} onClick={() => onOpenProfile(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProfile(p); } }}>
                <td className="apn-check-td" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                <td data-label="Partner"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={p.name} url={apnAvatarUrl(p, people.find((x) => x.id === p.id))} size={28} /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p.name}{(["district_head", "state_head"].includes(p.role) || ["District Head", "State Head"].includes(p.level)) && <span className="badge pri" style={{ marginLeft: 6 }}>{apnAdminLevel(p, s)}</span>}</div><div className="hint-line" style={{ fontSize: 11 }}>{apnIdFor(p)} · {p.mobile || "—"}{p.reactivationRequested || p.reactivationRecommended ? " · ⟳ reactivation requested" : ""}</div>{p.tags?.slice(0, 2).map((tag) => <span className="apn-tag" style={{ margin: "3px 3px 0 0" }} key={tag}>{tag}</span>)}</div></div>{view === "archived" && <div className="hint-line" style={{ fontSize: 11 }}>Deleted by {p.deletedBy || "—"} · {p.deletedAt ? fmtDateTime(p.deletedAt) : "—"} · {p.deleteReason || p.archiveReason || "No reason recorded"}</div>}</td>
                <td data-label="District">{p.district || "—"}<div className="hint-line" style={{ fontSize: 11 }}>{p.taluk || ""}</div></td>
                <td data-label="Level"><span className="tag">{apnAdminLevel(p, s)}</span><div className="hint-line" style={{ fontSize: 11 }}>{money(s.revenue)} · {s.completed} done</div></td>
                <td data-label="Status"><span className={"status-pill " + apnStatusClass(eff)}>{apnStatusLabel(eff)}</span>{(p.approvedAt && Date.now() - p.approvedAt < 30 * 864e5) && <span className="badge pos" style={{ marginLeft: 5 }}>New Partner</span>}{p.status === "banned" && <span className="badge neg" style={{ marginLeft: 5 }}><Ban size={11} style={{ verticalAlign: -2 }} />Banned</span>}{(p.suspensionReason || p.suspendedAt) && eff === "suspended" && <div className="hint-line" style={{ fontSize: 11 }}>{p.suspensionReason || "Suspended"}</div>}{p.status === "banned" && p.banReason && <div className="hint-line" style={{ fontSize: 11 }}>{p.banReason}</div>}</td>
                <td data-label="Health"><span className="badge pri">{apnHealthScore(db, p, people.find((x) => x.id === p.id)).score}</span></td>
                <td data-label="Last Seen" className="hint-line">{apnLastSeenLabel(p, people.find((x) => x.id === p.id))}</td>
                <td className="apn-card-act"><APNActionMenu partner={p} isSuper={isSuper} canManage={canManage} onAction={act.run} runtime={runtime} /></td>
              </tr>
            ); })}</tbody>
          </table></div>}
        {filtered.length > 0 && <div className="apn-pagination"><button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="hint-line">Page {page + 1} of {pages} · {filtered.length} partners</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
      </div>
    </div>
  );
}
export function APNAdminLeads({ db, openModal, runtime = {} }) {
  const { APN_SERVICE_LABEL, money, Empty, UserPlus, Pencil } = runtime;
  const [view, setView] = useState("Submitted");
  const list = (db.apn_leads || []).filter((l) => view === "all" ? true : l.status === view).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-seg-scroll">{["Submitted", "Approved", "Quotation Sent", "Converted", "all"].map((k) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{k === "all" ? "All" : k}</button>)}</div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No leads" text="Partner-submitted leads appear here for review." />
          : <div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards">
            <thead><tr><th>Lead</th><th>Partner</th><th>Service</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((l) => (
              <tr key={l.id}>
                <td data-label="Lead"><div style={{ fontWeight: 600 }}>{l.clientName}</div><div className="hint-line" style={{ fontSize: 11 }}>{l.business || "—"} · {l.mobile} · {l.leadId}</div></td>
                <td data-label="Partner">{l.partnerName}</td>
                <td data-label="Service"><span className="tag">{APN_SERVICE_LABEL[l.service]}</span>{l.status === "Converted" && <div className="hint-line" style={{ fontSize: 11 }}>{money(l.revenue)}{l.projectCompleted ? " · done" : ""}</div>}</td>
                <td data-label="Status"><span className={"badge " + apnLeadTone(l.status)}>{l.status}</span></td>
                <td className="apn-card-act"><button className="btn sm" onClick={() => openModal({ type: "apnLeadManage", lead: l })}><Pencil size={13} />Manage</button></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

export function APNCommissionReverseModal({ commission, partnerName, isSuper, onClose, onSave, runtime = {} }) {
  const { Modal, Undo2, AlertTriangle, money, apnCommTone, LockIcon, Field } = runtime;
  const [reason, setReason] = useState("");
  const [unlockPaid, setUnlockPaid] = useState(false);
  const paid = commission.status === "Paid";
  const valid = reason.trim().length > 0 && (!paid || (isSuper && unlockPaid));
  const submit = () => { if (valid) onSave(reason, paid && unlockPaid); };
  return <Modal title="Reverse commission" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={submit}><Undo2 size={15} />Reverse commission</button></>}>
    <div className="banner" style={{ margin: 0 }}><AlertTriangle size={15} />This permanently marks the commission as reversed, removes it from wallet, withdrawal and report totals, and writes an audit entry.</div>
    <div className="apn-profile-kv"><span>Partner</span><b>{partnerName}</b></div>
    <div className="apn-profile-kv"><span>Project</span><b>{commission.project}</b></div>
    <div className="apn-profile-kv"><span>Amount</span><b className="mono">{money(commission.amount)}</b></div>
    <div className="apn-profile-kv"><span>Current status</span><span className={"badge " + apnCommTone(commission.status)}>{commission.status}</span></div>
    {paid && <div className="banner" style={{ marginTop: 10 }}><LockIcon size={15} />This commission is already Paid. Reversing requires a super admin unlock and will not claw back funds already settled.</div>}
    <Field label="Reversal reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this commission being reversed?" /></Field>
    {paid && isSuper && <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}><input type="checkbox" checked={unlockPaid} onChange={(e) => setUnlockPaid(e.target.checked)} />I confirm this Paid amount may be reversed (super admin unlock)</label>}
  </Modal>;
}

export { APNPartnerProfile as default };

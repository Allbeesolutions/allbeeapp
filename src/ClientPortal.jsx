import React, { useRef, useState } from "react";
import { AllbeeAIFloatingAssistant } from "./ui/AllbeeMascot.jsx";
import { Sparkles, User, Upload, Check, ShieldCheck, FileText, Banknote, FileCheck2, FolderKanban, ArrowRight, RefreshCw } from "./icons.jsx";
const LazyAllbeeAI = React.lazy(() => import("./AllbeeAI.jsx"));

export default function ClientPortal({ db, profile, signOut, isDark, config, reload, saveMyProfile, runtime }) {
  const { companyOf, supabase, emitToast, ToastHost, GlobalPullToRefresh, FounderTap, PortalRefreshButton, Avatar, LogOut, Home, Headset, Link2, Download, ExternalLink, Mail, MessageCircle, LazyPortalHelpdesk, aiConfigOf, aiConfigured, buildAIContext, callAI, ROLE_LABEL, AI_QUICK_PROMPTS, renderAIText, fmtDate, fmtDateTime, money, LOGO_ICON, uploadAttachment } = runtime;
  const myId = profile?.id;
  const co = companyOf(config);
  const posts = [...db.portal_posts].filter((p) => p.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const updates = posts.filter((p) => (p.kind || "update") !== "deliverable");
  const deliverables = posts.filter((p) => (p.kind || "update") === "deliverable");
  const files = [...db.documents].filter((d) => d.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const quotes = [...db.quotations].filter((q) => q.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const invoices = [...db.invoices].filter((iv) => iv.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Never hand the client assistant the wider workspace snapshot. Its AI context
  // is built only from rows already scoped to this signed-in client.
  const clientAIDb = {
    clients: [], leads: [], quotations: quotes, invoices, projects: [], tasks: [], class_students: [], students: [], marketing: [], concepts: [], inhouse: [], planned: [],
    apn_users: [], transactions: [], withdrawals: [], audit: [], attendance: [], leave: [], updates: [], team_chat: [], notifications: [], rewards: [], agreements: [], materials: [], targets: [],
    portal_posts: posts, documents: files,
  };
  const statusTone = (s) => s === "Completed" ? "pos" : s === "On hold" ? "neg" : s === "Review" ? "accent" : "pri";
  const [portalView, setPortalView] = useState("home");
  const [profileDraft, setProfileDraft] = useState({ name: profile?.name || "", mobile: profile?.mobile || "", dob: profile?.dob || "", username: profile?.username || "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const photoRef = useRef(null);
  const openProfile = () => { setProfileDraft({ name: profile?.name || "", mobile: profile?.mobile || "", dob: profile?.dob || "", username: profile?.username || "" }); setPortalView("profile"); };
  const saveClientProfile = async () => { setProfileBusy(true); try { await saveMyProfile?.({ ...profileDraft, name: profileDraft.name.trim(), mobile: profileDraft.mobile.trim(), username: profileDraft.username.trim().toLowerCase() || null }); emitToast("Profile updated.", "success"); await reload(); } catch(e) { emitToast(e.message || "Could not update profile.", "error"); } finally { setProfileBusy(false); } };
  const uploadClientPhoto = async (e) => { const file=e.target.files?.[0]; if(!file) return; setProfileBusy(true); try { const up=await uploadAttachment(file,{publicMedia:true}); await saveMyProfile?.({photo_url:up.url}); emitToast("Profile photo updated.","success"); await reload(); } catch(er) { emitToast(er.message || "Could not upload photo.","error"); } finally { setProfileBusy(false); e.target.value=""; } };
  const [helpFormOpen, setHelpFormOpen] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);
  const myTickets = [...(db.support_tickets || [])].filter((t) => t.client_id === myId).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const openTickets = myTickets.filter((t) => !["resolved", "closed"].includes(t.status)).length;
  const createSupportTicket = async (f) => {
    setHelpBusy(true);
    try {
      const { data: ticketId, error } = await supabase.rpc("apn_create_support_ticket", { p_subject: f.subject, p_description: f.description || "", p_category: f.category || "Other", p_priority: f.priority || "Normal" });
      if (error) throw error;
      setHelpFormOpen(false);
      const { data: created } = await supabase.from("support_tickets").select("ticket_no").eq("id", ticketId).maybeSingle();
      emitToast(created?.ticket_no ? `Support ticket ${created.ticket_no} raised — our team will follow up here.` : "Support ticket raised. Our team will follow up here.", "success");
      await reload();
    } catch (e) { emitToast(e.message || "Could not create the ticket.", "error"); }
    finally { setHelpBusy(false); }
  };
  const sendSupportMessage = async (ticketId, body) => {
    if (!(body || "").trim()) return false;
    const { error } = await supabase.rpc("apn_helpdesk_client_message", { p_ticket_id: ticketId, p_message: body.trim() });
    if (error) { emitToast(error.message || "Could not send your message.", "error"); return false; }
    emitToast("Message sent.", "success");
    await reload();
    return true;
  };
  return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ minHeight: "100vh" }}>
      <ToastHost />
      <GlobalPullToRefresh onRefresh={reload} />
      <header className="topbar" style={{ position: "sticky", top: 0 }}>
        <FounderTap className="brand-logo" src={co.logoUrl || LOGO_ICON} alt={co.name || "ALLBEE"} style={{ height: 30 }} />
        <div><h2 style={{ fontSize: 16 }}>{co.name || "ALLBEE Solutions"}</h2><div className="topbar-sub">Client portal</div></div>
        <span className="spacer" style={{ flex: 1 }} />
        <PortalRefreshButton onRefresh={reload} />
        <button type="button" className="userchip" onClick={openProfile} aria-label="Open my profile"><Avatar name={profile?.name || "C"} url={profile?.photo_url} size={30} /><span className="userchip-name">{profile?.name}</span><User size={15} /></button>
      </header>
      <div className="content page-enter client-portal-content" style={{ maxWidth: 820, margin: "0 auto" }}>
        <section className="client-hero"><div><span className="client-eyebrow">CLIENT WORKSPACE</span><h1>Welcome back, {profile?.name?.split(" ")[0] || "there"}</h1><p>Everything ALLBEE is working on for you, in one clear place.</p></div><button className="btn client-profile-cta" onClick={openProfile}><Avatar name={profile?.name || "C"} url={profile?.photo_url} size={34}/><span><b>My profile</b><small>Account & preferences</small></span><ArrowRight size={16}/></button></section>
        <div className="seg" style={{ margin: "0 0 16px", width: "max-content" }}>
          <button className={portalView === "home" ? "on" : ""} onClick={() => setPortalView("home")}><Home size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Overview</button>
          <button className={portalView === "support" ? "on" : ""} onClick={() => setPortalView("support")}><Headset size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Support{openTickets > 0 && <span className="badge accent" style={{ marginLeft: 6 }}>{openTickets}</span>}</button>
          <button className={portalView === "ai" ? "on" : ""} onClick={() => setPortalView("ai")}><Sparkles size={14} style={{ verticalAlign: -2, marginRight: 5 }} />ALLBEE AI</button><button className={portalView === "profile" ? "on" : ""} onClick={openProfile}><User size={14} style={{ verticalAlign: -2, marginRight: 5 }} />My profile</button>
        </div>

        {portalView === "home" && (<>
        <div className="client-kpi-grid">
          <button onClick={() => document.getElementById("client-updates")?.scrollIntoView({behavior:"smooth"})}><span><FileText size={18}/></span><b>{updates.length}</b><small>Project updates</small></button>
          <button onClick={() => document.getElementById("client-quotes")?.scrollIntoView({behavior:"smooth"})}><span><FileCheck2 size={18}/></span><b>{quotes.length}</b><small>Quotations</small></button>
          <button onClick={() => document.getElementById("client-invoices")?.scrollIntoView({behavior:"smooth"})}><span><Banknote size={18}/></span><b>{invoices.length}</b><small>Invoices</small></button>
          <button onClick={() => document.getElementById("client-files")?.scrollIntoView({behavior:"smooth"})}><span><FolderKanban size={18}/></span><b>{files.length + deliverables.length}</b><small>Shared files</small></button>
        </div>
        <div id="client-updates" className="card stat client-section" style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your project updates</div>
          {updates.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No updates yet. We'll post progress here as we go.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>{updates.map((p) => (
              <div key={p.id} style={{ borderLeft: "3px solid var(--primary)", paddingLeft: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontWeight: 700 }}>{p.title}</span><span className={"badge " + statusTone(p.status)}>{p.status}</span></div>
                {p.body && <div style={{ marginTop: 5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{p.body}</div>}
                {p.meetingLink && <div style={{ marginTop: 8 }}><a className="btn sm primary" href={p.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
                <div className="hint-line" style={{ fontSize: 11.5, marginTop: 5 }}>{fmtDateTime(p.createdAt)}</div>
              </div>
            ))}</div>}
        </div>

        <div id="client-quotes" className="card stat client-section">
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your quotations</div>
          {quotes.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No quotations shared with you yet.</p>
            : <div style={{ overflowX: "auto", marginTop: 10 }}><table className="tbl">
              <thead><tr><th>Quotation</th><th>Status</th><th className="num-cell">Total</th></tr></thead>
              <tbody>{quotes.map((q) => (
                <tr key={q.id}><td><div style={{ fontWeight: 600 }}>{q.title || "Quotation"}</div><div className="hint-line" style={{ fontSize: 11 }}>{(q.items || []).length} item{(q.items || []).length === 1 ? "" : "s"}{q.pdfUrl && <> · <a href={q.pdfUrl} target="_blank" rel="noreferrer">PDF</a></>}</div></td>
                  <td><span className={"badge " + (q.status === "Accepted" ? "pos" : q.status === "Rejected" ? "neg" : "pri")}>{q.status}</span></td>
                  <td className="num-cell mono">{money(q.total)}</td></tr>
              ))}</tbody>
            </table></div>}
          <p className="hint-line" style={{ marginTop: 12 }}>Questions about a quote? Reply to the email from your ALLBEE contact.</p>
        </div>

        <div id="client-invoices" className="card stat client-section" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your invoices</div>
          {invoices.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No invoices yet.</p>
            : <div style={{ overflowX: "auto", marginTop: 10 }}><table className="tbl">
              <thead><tr><th>Invoice</th><th>Payment</th><th>Due</th><th className="num-cell">Amount</th></tr></thead>
              <tbody>{invoices.map((iv) => (
                <tr key={iv.id}><td><div style={{ fontWeight: 600 }}>{iv.number || "Invoice"}</div><div className="hint-line" style={{ fontSize: 11 }}>{iv.title || ""}</div></td>
                  <td><span className={"badge " + (iv.status === "Paid" ? "pos" : iv.status === "Overdue" ? "neg" : "pri")}>{iv.status === "Paid" ? "Paid" : iv.status === "Overdue" ? "Overdue" : "Due"}</span></td>
                  <td className="mono">{iv.dueDate ? fmtDate(iv.dueDate) : "—"}</td>
                  <td className="num-cell mono">{money(iv.amount)}</td></tr>
              ))}</tbody>
            </table></div>}
        </div>

        <div className="card stat" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Deliverables</div>
          {deliverables.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No deliverables shared yet.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>{deliverables.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 700 }}>{p.title}</div>{p.body && <div className="hint-line" style={{ fontSize: 12.5, marginTop: 2 }}>{p.body}</div>}</div>
                <span className={"badge " + statusTone(p.status)}>{p.status}</span>
                {p.fileUrl && <a className="btn sm primary" href={p.fileUrl} target="_blank" rel="noreferrer"><Download size={13} />Download</a>}
              </div>
            ))}</div>}
        </div>

        <div id="client-files" className="card stat client-section" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Files</div>
          {files.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No files shared yet.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>{files.map((d) => (
              <div key={d.id} className="item-row" style={{ padding: "10px 0" }}>
                <div className="item-main"><div className="item-title" style={{ fontSize: 14 }}>{d.title}</div><div className="item-meta"><span className="tag">{d.category}</span><span>{fmtDate(new Date(d.createdAt).toISOString().slice(0, 10))}</span></div></div>
                <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open</a>
              </div>
            ))}</div>}
        </div>

        {(co.name || co.address || co.email || co.phone || co.website) && (
          <div className="hint-line" style={{ marginTop: 20, textAlign: "center", lineHeight: 1.6 }}>
            {co.name && <div style={{ fontWeight: 700, color: "var(--ink)" }}>{co.name}</div>}
            {co.address && <div>{co.address}</div>}
            {[co.phone, co.email, co.website].filter(Boolean).length > 0 && <div>{[co.phone, co.email, co.website].filter(Boolean).join("  ·  ")}</div>}
          </div>
        )}
        </>)}

        {portalView === "profile" && <div className="client-profile-grid">
          <section className="card client-profile-card"><div className="client-profile-cover"></div><div className="client-profile-avatar"><Avatar name={profile?.name || "C"} url={profile?.photo_url} size={86}/><button className="btn sm" onClick={() => photoRef.current?.click()} disabled={profileBusy}><Upload size={14}/>Change photo</button><input ref={photoRef} type="file" accept="image/*" hidden onChange={uploadClientPhoto}/></div><h2>{profile?.name}</h2><p>{profile?.email}</p><span className="badge pos"><ShieldCheck size={12}/> Verified client account</span></section>
          <section className="card client-profile-form"><div className="client-section-head"><div><span className="client-eyebrow">PERSONAL DETAILS</span><h3>My profile</h3></div></div><div className="grid2"><label>Full name<input className="input" value={profileDraft.name} onChange={e=>setProfileDraft(x=>({...x,name:e.target.value}))}/></label><label>Mobile<input className="input" type="tel" value={profileDraft.mobile} onChange={e=>setProfileDraft(x=>({...x,mobile:e.target.value}))}/></label><label>Date of birth<input className="input" type="date" value={profileDraft.dob || ""} onChange={e=>setProfileDraft(x=>({...x,dob:e.target.value}))}/></label><label>Username<input className="input" value={profileDraft.username} onChange={e=>setProfileDraft(x=>({...x,username:e.target.value}))}/></label></div><label>Sign-in email<input className="input" value={profile?.email || ""} disabled/></label><div className="client-profile-actions"><button className="btn primary" onClick={saveClientProfile} disabled={profileBusy}>{profileBusy?<RefreshCw size={15} className="spin"/>:<Check size={15}/>}Save changes</button><button className="btn" onClick={()=>saveMyProfile?.({photo_url:null}).then(reload)} disabled={!profile?.photo_url}>Remove photo</button><button className="btn" onClick={signOut}><LogOut size={15}/>Sign out</button></div><div className="client-security-note"><ShieldCheck size={18}/><div><b>Account security</b><span>Your email and client access are protected by ALLBEE authentication. Contact support if you need your sign-in email changed.</span></div></div></section>
        </div>}

        {portalView === "support" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading support…</div>}><LazyPortalHelpdesk myId={myId} tickets={myTickets} messages={db.support_ticket_messages || []} onCreate={createSupportTicket} onSend={sendSupportMessage} helpFormOpen={helpFormOpen} setHelpFormOpen={setHelpFormOpen} helpBusy={helpBusy} co={co} runtime={runtime} /></React.Suspense>}

        {portalView === "ai" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading ALLBEE AI…</div>}><LazyAllbeeAI db={clientAIDb} config={config} me={{ id: myId, name: profile?.name || "Client" }} role="client" isAdmin={false} go={(target) => { if (target === "support") setPortalView("support"); }} runtime={{ aiConfigOf, companyOf, aiConfigured, buildAIContext, callAI, ROLE_LABEL, AI_QUICK_PROMPTS, renderAIText, supabase }} /></React.Suspense>}
      </div>
      <AllbeeAIFloatingAssistant onOpen={() => setPortalView("ai")} displayName={profile?.name} context={portalView} surface="client" collisionRootSelector=".client-portal-content" hidden={helpFormOpen} />
    </div>
  );
}



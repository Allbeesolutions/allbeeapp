import React, { useState } from "react";

export default function ClientPortal({ db, profile, signOut, isDark, config, reload, runtime }) {
  const { companyOf, supabase, emitToast, ToastHost, GlobalPullToRefresh, FounderTap, PortalRefreshButton, Avatar, LogOut, Home, Headset, Link2, Download, ExternalLink, Mail, MessageCircle, PortalHelpdesk, fmtDate, fmtDateTime, money, LOGO_ICON } = runtime;
  const myId = profile?.id;
  const co = companyOf(config);
  const posts = [...db.portal_posts].filter((p) => p.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const updates = posts.filter((p) => (p.kind || "update") !== "deliverable");
  const deliverables = posts.filter((p) => (p.kind || "update") === "deliverable");
  const files = [...db.documents].filter((d) => d.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const quotes = [...db.quotations].filter((q) => q.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const invoices = [...db.invoices].filter((iv) => iv.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const statusTone = (s) => s === "Completed" ? "pos" : s === "On hold" ? "neg" : s === "Review" ? "accent" : "pri";
  const [portalView, setPortalView] = useState("home");
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
        <div className="userchip" onClick={signOut} style={{ cursor: "pointer" }}><Avatar name={profile?.name || "C"} url={profile?.photo_url} size={26} /><span className="userchip-name">{profile?.name}</span><LogOut size={15} /></div>
      </header>
      <div className="content page-enter" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div className="page-head"><h3>Welcome, {profile?.name?.split(" ")[0] || "there"}</h3></div>
        <div className="seg" style={{ margin: "0 0 16px", width: "max-content" }}>
          <button className={portalView === "home" ? "on" : ""} onClick={() => setPortalView("home")}><Home size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Overview</button>
          <button className={portalView === "support" ? "on" : ""} onClick={() => setPortalView("support")}><Headset size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Support{openTickets > 0 && <span className="badge accent" style={{ marginLeft: 6 }}>{openTickets}</span>}</button>
        </div>

        {portalView === "home" && (<>
        <div className="card stat" style={{ marginBottom: 16 }}>
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

        <div className="card stat">
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

        <div className="card stat" style={{ marginTop: 16 }}>
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

        <div className="card stat" style={{ marginTop: 16 }}>
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

        {portalView === "support" && <PortalHelpdesk myId={myId} tickets={myTickets} messages={db.support_ticket_messages || []} onCreate={createSupportTicket} onSend={sendSupportMessage} helpFormOpen={helpFormOpen} setHelpFormOpen={setHelpFormOpen} helpBusy={helpBusy} co={co} />}
      </div>
    </div>
  );
}



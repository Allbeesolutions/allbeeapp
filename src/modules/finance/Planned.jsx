import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";

export default function Planned({ db, mutate, openModal, removeItem, openIncome, canFinance, helpers }) {
  const { money, fmtDate, todayISO, Empty } = helpers;
  const list = [...db.planned].sort((a, b) => (a.nextDue || "").localeCompare(b.nextDue || ""));
  const del = (p) => removeItem("planned", p, { name: p.title, audit: `deleted planned expense "${p.title}"` });
  const monthlyTotal = list.filter((p) => p.recurrence === "Monthly").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const dueTone = (p) => { if (!p.nextDue) return "muted"; const today = todayISO(); return p.nextDue < today ? "neg" : p.nextDue <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) ? "accent" : "muted"; };
  const recordPaid = (p) => {
    openIncome({ kind: "expense", category: p.category, amount: p.amount, notes: p.title, source: { kind: "planned", id: p.id } });
  };
  return (
    <div className="content">
      <div className="page-head"><h3>Planned & recurring expenses</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "planned" })}><Plus size={16} />New</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><CalendarClock size={14} /> Recurring monthly</div><div className="v mono">{money(monthlyTotal)}</div></div>
        <div className="card"><div className="k"><Banknote size={14} /> Items tracked</div><div className="v mono">{list.length}</div></div>
      </div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<CalendarClock size={22} color="var(--muted)" />} title="Nothing planned yet" text="Track rent, subscriptions and other regular costs, and log them as expenses when paid." action={<button className="btn primary" onClick={() => openModal({ type: "planned" })}><Plus size={16} />New planned expense</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Expense</th><th>Repeats</th><th>Next due</th><th className="num-cell">Amount</th><th></th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{p.title}{p.status && <span className={"badge " + (p.status === "Purchased" ? "pos" : p.status === "Cancelled" ? "neg" : p.status === "Approved" ? "accent" : "pri")} style={{ fontSize: 10 }}>{p.status}</span>}</div><div className="hint-line" style={{ fontSize: 11 }}>{p.category}</div></td>
                <td>{p.recurrence}</td>
                <td><span className={"badge " + dueTone(p)}>{p.nextDue ? fmtDate(p.nextDue) : "—"}</span></td>
                <td className="num-cell mono">{money(p.amount)}</td>
                <td><div className="row-actions">
                  <select className="select" style={{ width: "auto", padding: "4px 6px" }} value={p.status || "Planned"} onChange={(e) => mutate((d) => ({ ...d, planned: d.planned.map((x) => x.id === p.id ? { ...x, status: e.target.value } : x) }), { action: `set planned "${p.title}" to ${e.target.value}`, module: "Planned expenses" })}>{PLANNED_STATUS.map((x) => <option key={x}>{x}</option>)}</select>
                  {canFinance && <button className="btn sm primary" onClick={() => recordPaid(p)}>Log expense</button>}
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "planned", initial: p })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

function Announcements({ db, mutate, openModal, removeItem, isAdmin, me }) {
  const list = [...db.announcements].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (a) => removeItem("announcements", a, { name: a.title, audit: `deleted announcement "${a.title}"` });
  const ack = (a) => { haptic(10); mutate((d) => ({ ...d, announcements: d.announcements.map((x) => x.id === a.id ? { ...x, acks: Array.from(new Set([...(x.acks || []), me.id])) } : x) }), null); };
  return (
    <div className="content">
      <div className="page-head"><h3>Announcements</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "announcement" })}><Plus size={16} />New announcement</button>}</div>
      {list.length === 0 ? <div className="card"><Empty icon={<MegaphoneIcon size={22} color="var(--muted)" />} title="Nothing announced yet" text={isAdmin ? "Post company-wide news here — everyone sees it and gets a bell." : "Company news from your admins will show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "announcement" })}><Plus size={16} />New announcement</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{list.map((a) => (
          <div key={a.id} className="card stat">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{a.title}</div>
                {a.body && <div style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.body}</div>}
                <div className="item-meta" style={{ marginTop: 8 }}><span>{a.by || "Admin"}</span><span>{fmtDateTime(a.createdAt)}</span>{isAdmin && <span><BadgeCheck size={12} style={{ verticalAlign: -2 }} /> {(a.acks || []).length} acknowledged</span>}</div>
                {a.meetingLink && <div style={{ marginTop: 8 }}><a className="btn sm primary" href={a.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
                {!isAdmin && ((a.acks || []).includes(me.id)
                  ? <div className="hint-line" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pos)" }}><BadgeCheck size={13} />You acknowledged this</div>
                  : <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => ack(a)}><Check size={13} />Acknowledge</button></div>)}
              </div>
              {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "announcement", initial: a })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete announcement?", body: `Delete "${a.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(a) })}><Trash2 size={14} /></button></div>}
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

export function AdminAPNChat({ me, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const mounted = useRef(true);
  const scrollRef = useRef(null);
  const openRequestRef = useRef(0);

  useEffect(() => () => { mounted.current = false; }, []);

  // APN chat is event-driven. The old implementation polled every 10 seconds
  // and then reloaded conversations + contacts + messages again, even though
  // Realtime was already subscribed. That multiplied egress and database calls
  // dramatically. Keep contacts on their own slower-changing path and refresh
  // conversations/messages only when a relevant database event arrives.
  const loadConversations = useCallback(async (quiet = false) => {
    try {
      const { data, error } = await supabase.rpc("apn_list_conversations");
      if (error) throw new Error(error.message);
      if (!mounted.current) return;
      const rows = data || [];
      setConversations(rows);
      const unread = rows.reduce((n, c) => n + Number(c.unread_count || 0), 0);
      onUnreadChange?.(unread);
    } catch (e) {
      if (mounted.current && !quiet) setErr(e.message || "Could not load APN chats.");
    }
  }, [onUnreadChange]);

  const loadContacts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("apn_list_chat_contacts");
      if (error) throw new Error(error.message);
      if (!mounted.current) return;
      setContacts(data || []);
    } catch (e) {
      if (mounted.current) setErr(e.message || "Could not load APN contacts.");
    }
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      await Promise.all([loadConversations(quiet), loadContacts()]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loadConversations, loadContacts]);

  const open = useCallback(async (conv) => {
    const requestId = ++openRequestRef.current;
    setSelected(conv); setErr("");
    const { data, error } = await supabase.rpc("apn_list_messages", { p_conversation_id: conv.conversation_id || conv.id });
    if (error) { if (requestId === openRequestRef.current) setErr(error.message); return; }
    if (!mounted.current || requestId !== openRequestRef.current) return;
    const rows = data || [];
    setMessages(rows);
    const last = rows[rows.length - 1];
    if (last) await supabase.rpc("apn_admin_mark_read", { p_conversation_id: conv.conversation_id || conv.id, p_message_id: last.id });
    await loadConversations(true);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }, [loadConversations]);

  useEffect(() => { load(); }, [load]);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    const ch = supabase.channel(`admin-apn-team-chat:${me.id}`);
    let timerId = null;
    let inFlight = null;
    let queued = false;
    const refreshChat = () => {
      queued = true;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued || !mounted.current) return;
        queued = false;
        const current = selectedRef.current;
        inFlight = (current ? open(current) : loadConversations(true)).catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat();
        });
      }, 120);
    };
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "apn_chat_messages" }, refreshChat);
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "apn_chat_messages" }, refreshChat);
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "apn_chat_messages" }, refreshChat);
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "apn_friend_requests" }, () => { loadContacts(); loadConversations(true); });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "apn_friend_requests" }, () => { loadContacts(); loadConversations(true); });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "apn_friend_requests" }, () => { loadContacts(); loadConversations(true); });
    ch.subscribe();
    return () => {
      if (timerId) clearTimeout(timerId);
      queued = false;
      supabase.removeChannel(ch);
    };
  }, [loadConversations, loadContacts, open, me.id]);

  const send = async () => {
    const body = text.trim(); if (!body || !selected) return;
    setText(""); setErr("");
    const { error } = await supabase.rpc("apn_admin_send_message", { p_conversation_id: selected.conversation_id || selected.id, p_body: body });
    if (error) { setText(body); setErr(error.message); return; }
    await open(selected);
  };

  const startPartnerChat = async (contact) => {
    const apnId = contact?.apn_id;
    if (!apnId) return;
    const { data, error } = await supabase.rpc("apn_admin_open_partner_chat", { p_partner_apn_id: apnId });
    if (error) { setErr(error.message); return; }
    if (data?.[0]) await open({ conversation_id: data[0].conversation_id, conv_type: "person", subject: data[0].subject, participant_apn_id: apnId });
  };

  const filtered = conversations.filter((c) => filter === "all" || c.conv_type === filter)
    .filter((c) => `${c.subject || ""} ${c.last_message || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  const partners = contacts.filter((c) => c.contact_type === "partner").filter((c) => `${c.name} ${c.apn_id} ${c.district || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  const unread = conversations.reduce((n, c) => n + Number(c.unread_count || 0), 0);

  return (
    <div className="content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
      <div className="page-head"><h3>APN chat</h3><span className="spacer" />{unread > 0 && <span className="badge action-badge" style={{ marginRight: 8 }}>{unread > 99 ? "99+" : unread} new</span>}<button className="btn sm" onClick={() => load()}><RefreshCw size={14} />Refresh</button></div>
      {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} />{err}</div>}
      <div className={`card apn-admin-chat-shell${selected ? " has-selection" : ""}`} style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: selected ? "330px 1fr" : "1fr", overflow: "hidden" }}>
        <aside style={{ overflowY: "auto", padding: 12, borderRight: selected ? "1px solid var(--border)" : "none" }}>
          <div className="seg" style={{ marginBottom: 10 }}>
            {[['all','All'],['person','Partner chats'],['district','District'],['state','State']].map(([k,l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search APN chats or partners…" />
          {loading && <div className="hint-line" style={{ padding: 10 }}>Loading APN chats…</div>}
          {filtered.map(c => <button key={c.conversation_id} className="apn-tc-recent-row" style={{ width: "100%", marginTop: 6 }} onClick={() => open(c)}>
            <div className="apn-tc-recent-avatar"><MessageCircle size={15} /></div><div className="apn-tc-recent-copy"><b>{c.subject || "APN chat"}</b><span>{c.last_message || "No messages yet"}</span></div>{Number(c.unread_count || 0) > 0 && <span className="apn-tc-unread">{c.unread_count}</span>}
          </button>)}
          {!loading && filtered.length === 0 && <div className="hint-line" style={{ padding: 10 }}>No APN conversations found.</div>}
          <div className="apn-tc-card" style={{ marginTop: 12 }}><div className="apn-tc-card-title">Start partner chat</div>
            {partners.slice(0, 12).map(c => <div key={c.contact_id} className="apn-tc-partner-row"><Avatar name={c.name} url={c.photo_url} size={32} fontSize={11}/><div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{c.name}</div><div className="apn-tc-partner-location">{c.apn_id || "APN partner"}{c.district ? ` · ${c.district}` : ""}</div></div><button className="btn sm" onClick={() => startPartnerChat(c)}>Chat</button></div>)}
          </div>
        </aside>
        {selected ? <main className="apn-tc-chat" ref={scrollRef}>
          <div className="apn-tc-chathead"><button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }}><ArrowLeft size={17}/></button><div style={{fontWeight:700,flex:1}}>{selected.subject || "APN chat"}<div className="apn-tc-presence">{selected.conv_type === "person" ? "Partner conversation" : `${selected.conv_type || "APN"} conversation`}</div></div></div>
          <div className="apn-tc-messages">
            {messages.map(m => { const mine = String(m.sender_id) === String(me.id); return <div key={m.id} className={`apn-tc-msg ${mine ? "mine" : "theirs"}`}><div className="apn-tc-bubble-wrap"><div className="apn-tc-bubble"><div className="apn-tc-text">{m.body}</div><div className="apn-tc-time">{m.created_at ? fmtDateTime(new Date(m.created_at)) : ""}</div></div></div></div>; })}
            {messages.length === 0 && <Empty icon={<MessageSquare size={20}/>} title="No messages yet" text="Send the first message."/>}
          </div>
          <div className="apn-tc-compose"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Message the APN partner…" rows={2} maxLength={2000} onKeyDown={e => { if(e.key === "Enter" && !e.shiftKey){e.preventDefault();send();} }}/><button className="btn primary" onClick={send} disabled={!text.trim()}>Send</button></div>
        </main> : <div className="apn-tc-main-empty"><div><MessageSquare size={30} color="var(--muted)"/><div className="apn-tc-main-title">APN conversations</div><div className="hint-line">Select a partner conversation, district chat, or state chat.</div></div></div>}
      </div>
    </div>
  );
}



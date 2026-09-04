import React from "react";

export default function APNTeamChat({ db, meRow, pid, profile, isDark, isOpen, refreshTick, go, runtime = {} }) {
  const { useState, useEffect, useRef, useCallback, useReducedMotion, supabase, emitToast, Empty, Avatar, apnIdFor, fmtDateTime, Search, Trash2, ChevronRight, ArrowLeft, Send, MessageSquare, MessageCircle, AlertTriangle, CHAT_SECTIONS, CHAT_SECTION_LABEL } = runtime;
  const [section, setSection] = useState("person");
  const [conversations, setConversations] = useState([]);          // from apn_list_conversations
  const [friends, setFriends] = useState([]);                        // accepted friend pairs -> {otherId, otherName, otherApnId}
  const [contacts, setContacts] = useState([]);                      // all active APN partners + always-available admins
  const [contactSearch, setContactSearch] = useState("");
  const [requests, setRequests] = useState([]);                      // from apn_list_friend_requests
  const [selected, setSelected] = useState(null);                    // {id, subject, participants}
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [reactionBusy, setReactionBusy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busyRequests, setBusyRequests] = useState(new Set());
  const [messageInfo, setMessageInfo] = useState(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [chatNow, setChatNow] = useState(Date.now());
  const reduced = useReducedMotion();
  const scrollRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const me = meRow || { id: pid, name: profile?.name || "Partner" };
  const myApnId = apnIdFor(meRow) || "-";

  // Truthful presence: heartbeat while this chat is open and mark offline on cleanup.
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    const beat = async (online) => {
      if (!active) return;
      try {
        await supabase.rpc("apn_presence_heartbeat", { p_online: online });
      } catch (e) {
        // ignore
      }
    };
    beat(true);
    const timer = setInterval(() => beat(true), 15000);
    return () => {
      active = false;
      clearInterval(timer);
      (async () => {
        try {
          await supabase.rpc("apn_presence_heartbeat", { p_online: false });
        } catch (e) {
          // ignore
        }
      })();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selected) return undefined;
    const timer = setInterval(() => setChatNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [selected]);

  // Switching to District/State auto-opens the group chat (no extra click).
  useEffect(() => {
    if (!isOpen) return;
    if (section === "district") { setSelected(null); openDistrict(); }
    else if (section === "state") { setSelected(null); openState(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, isOpen]);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) { setLoading(true); setErr(""); }
    try {
      const { data, error } = await supabase.rpc("apn_list_conversations");
      if (error) throw new Error(error.message);
      if (!mountedRef.current) return;
      setConversations(Array.isArray(data) ? data : []);
      const contactsRes = await supabase.rpc("apn_list_chat_contacts");
      if (!mountedRef.current) return;
      let contactRows = Array.isArray(contactsRes.data) ? contactsRes.data : [];
      if (contactsRes.error) {
        // Production-safe fallback: an older PostgREST schema cache can retain the
        // UNION ORDER BY error. Keep Team Chat usable while the database function
        // cache catches up by reading the same source tables directly.
        const [partnersRes, adminsRes, presenceRes] = await Promise.all([
          supabase.from("apn_users").select("id,data").neq("id", pid),
          supabase.from("profiles").select("id,name,role,photo_url,active,status").neq("id", pid).in("role", ["admin", "superadmin"]),
          supabase.from("apn_chat_presence").select("user_id,online,last_seen,updated_at")
        ]);
        if (!mountedRef.current) return;
        if (partnersRes.error) throw new Error(contactsRes.error.message);
        const presenceByUser = new Map((presenceRes.data || []).map((r) => [String(r.user_id), r]));
        const fallbackPartners = (partnersRes.data || []).filter((u) => u?.data?.status === "active").map((u) => {
          const d = u.data || {}; const pr = presenceByUser.get(String(u.id));
          const availability = pr?.online && pr?.updated_at && (Date.now() - new Date(pr.updated_at).getTime() < 45000) ? "online" : "offline";
          return { contact_id: String(u.id), contact_type: "partner", name: d.name || "Partner", apn_id: d.apnId || null, district: d.district || null, state: d.state || null, photo_url: d.profilePicture || d.photo_url || d.photoUrl || null, availability, last_seen: pr?.last_seen || null, relationship: "none" };
        });
        const fallbackAdmins = (adminsRes.data || []).filter((a) => a.active && a.status === "active").map((a) => ({ contact_id: String(a.id), contact_type: a.role === "superadmin" ? "superadmin" : "admin", name: a.name || (a.role === "superadmin" ? "Super Admin" : "Admin"), apn_id: null, district: null, state: null, photo_url: a.photo_url || null, availability: "always_available", last_seen: null, relationship: "pre_enabled" }));
        contactRows = [...fallbackAdmins, ...fallbackPartners];
      }
      // profiles.photo_url is the authoritative app-wide avatar. The APN contact
      // RPC can still return the older apn_users.data.profilePicture value, so
      // always overlay the live profile photo when it is available.
      const contactIds = contactRows.map((c) => String(c.contact_id || "")).filter(Boolean);
      if (contactIds.length) {
        const profileRes = await supabase.from("profiles").select("id,photo_url").in("id", contactIds);
        if (!mountedRef.current) return;
        if (!profileRes.error) {
          const photos = new Map((profileRes.data || []).map((r) => [String(r.id), r.photo_url || null]));
          contactRows = contactRows.map((c) => ({ ...c, photo_url: photos.get(String(c.contact_id)) || c.photo_url || null }));
        }
      }
      if (!mountedRef.current) return;
      setContacts(contactRows);
      const fr = await supabase.rpc("apn_list_friend_requests");
      if (!mountedRef.current) return;
      if (fr.error) throw new Error(fr.error.message);
      const requestRows = Array.isArray(fr.data) ? fr.data : [];
      setRequests(requestRows);
      const accepted = requestRows.filter((r) => r.status === "accepted");
      setFriends(accepted.map((r) => ({ id: r.other_id, name: r.other_name, apnId: r.other_apn_id })));
      setContacts((rows) => rows.map((c) => {
        if (c.contact_type !== "partner") return c;
        const rel = requestRows.find((r) => String(r.other_id) === String(c.contact_id));
        return rel ? { ...c, relationship: rel.status === "accepted" ? "friend" : rel.direction === "incoming" ? "incoming" : rel.direction === "outgoing" ? "outgoing" : c.relationship } : c;
      }));
    } catch (e) {
      if (!mountedRef.current) return;
      if (/does not exist|not exist|42P01|PGRST|relation/.test(e.message || "")) {
        setConversations([]); setRequests([]); setFriends([]); setContacts([]);
      } else { setErr(e.message || String(e)); }
    } finally { if (showLoading && mountedRef.current) setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conv, { open = true } = {}) => {
    // Opening a conversation may clear the old thread while it loads. Refreshing
    // an already-open thread must never clear it first: that blank frame is the
    // visible flicker users were seeing after every send/realtime event.
    if (open) {
      setSelected(conv);
      setMessages([]);
    }
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_list_messages", { p_conversation_id: conv.id });
      if (!mountedRef.current) return;
      if (error) throw new Error(error.message);
      const msgs = Array.isArray(data) ? data : [];
      setMessages(msgs);
      await Promise.all(msgs.filter((m) => m.sender_id !== pid && !m.delivered_at).map((m) => supabase.rpc("apn_mark_delivered", { p_message_id: m.id })));
      // advance the caller's read cursor to the latest message so the badge clears
      if (msgs.length) await supabase.rpc("apn_mark_read", { p_conversation_id: conv.id, p_message_id: msgs[msgs.length - 1].id });
    } catch (e) {
      if (mountedRef.current) setErr(e.message || String(e));
    }
  }, []);

  const openConversation = useCallback(async (conv) => {
    await loadMessages(conv);
    // scroll to bottom after messages render
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  }, [loadMessages]);

  // Load conversations when the tab opens / on refresh ticks.
  useEffect(() => {
    if (isOpen) { loadConversations(); setSelected(null); setMessages([]); }
  }, [isOpen, refreshTick, loadConversations]);

  // Realtime: subscribe to the chat tables (RLS still gates reads). On any
  // change, refetch the relevant slice rather than trusting client-only updates.
  // Use a pid-namespaced name to prevent duplicate-channel errors on rapid remounts.
  useEffect(() => {
    if (!isOpen) return;
    const chName = `apn-team-chat:${pid}`;
    const ch = supabase.channel(chName);
    let timerId = null;
    let inFlight = null;
    let queued = false;
    const refreshChat = (table) => {
      queued = true;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued || !mountedRef.current) return;
        queued = false;
        const selectedNow = selectedRef.current;
        const refresh = table === "apn_chat_messages" && selectedNow
          ? loadMessages(selectedNow, { open: false })
          : loadConversations(false);
        inFlight = refresh.catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat(table);
        });
      }, 180);
    };
    ["apn_chat_messages", "apn_chat_conversations", "apn_chat_read_states", "apn_friend_requests", "apn_chat_presence"].forEach((table) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, () => refreshChat(table)));
    ch.subscribe();
    return () => {
      if (timerId) clearTimeout(timerId);
      queued = false;
      supabase.removeChannel(ch);
    };
  }, [isOpen, loadConversations, loadMessages]);

  const sendFriendRequest = async (otherApnId) => {
    setErr("");
    try {
      const { error } = await supabase.rpc("apn_send_friend_request", { p_recipient_apn_id: otherApnId });
      if (error) throw new Error(error.message);
      loadConversations();
    } catch (e) { setErr(e.message || String(e)); }
  };

  const acceptRequest = async (requestId) => {
    setBusyRequests((prev) => new Set(prev).add(requestId));
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_accept_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
      const convId = data && data[0] && data[0].conversation_id;
      await loadConversations();
      if (convId) {
        const other = (requests.find((r) => r.request_id === requestId) || {}).other_apn_id;
        openConversation({ id: convId, subject: "Friend chat", conv_type: "person", participant_apn_id: other });
      }
      emitToast("Friend request accepted.", "success");
    } catch (e) {
      setErr(e.message || String(e));
      emitToast(e.message || "Could not accept request.", "error");
    } finally {
      setBusyRequests((prev) => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const rejectRequest = async (requestId) => {
    setBusyRequests((prev) => new Set(prev).add(requestId));
    setErr("");
    try {
      const { error } = await supabase.rpc("apn_reject_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
      await loadConversations();
      emitToast("Request removed.", "success");
    } catch (e) {
      setErr(e.message || String(e));
      emitToast(e.message || "Could not reject request.", "error");
    } finally {
      setBusyRequests((prev) => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const filteredMessages = React.useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => [m.body, m.sender_name, m.sender_apn_id].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [messages, messageSearch]);

  const sendMessage = async () => {
    const body = (composer || "").trim();
    if (!body || !selected) return;
    const convId = selected.id;
    setComposer("");
    setReplyTo(null);
    setErr("");
    try {
      const { data, error } = replyTo?.id
        ? await supabase.rpc("apn_send_message_v2", { p_conversation_id: convId, p_body: body, p_reply_to_id: replyTo.id })
        : await supabase.rpc("apn_send_message", { p_conversation_id: convId, p_body: body });
      if (error) throw new Error(error.message);
      await loadMessages(selected, { open: false });
      await loadConversations(false);
    } catch (e) {
      setComposer(body);
      setErr(e.message || String(e));
    }
  };

  const editNow = async () => {
    const body = (composer || "").trim();
    if (!body || !editMessage) return;
    try {
      const { error } = await supabase.rpc("apn_edit_message", { p_message_id: editMessage.id, p_body: body });
      if (error) throw new Error(error.message);
      setComposer(""); setEditMessage(null);
      await loadMessages(selected, { open: false });
      emitToast("Message edited.", "success");
    } catch (e) { setErr(e.message || String(e)); }
  };

  const toggleReaction = async (message, emoji) => {
    const key = `${message.id}:${emoji}`;
    setReactionBusy(key);
    try {
      const { error } = await supabase.rpc("apn_toggle_reaction", { p_message_id: message.id, p_emoji: emoji });
      if (error) throw new Error(error.message);
      await loadMessages(selected, { open: false });
    } catch (e) { setErr(e.message || String(e)); }
    finally { setReactionBusy(null); }
  };

  const deleteMessage = async (message) => {
    try {
      const { error } = await supabase.rpc("apn_delete_message", { p_message_id: message.id });
      if (error) throw new Error(error.message);
      setContextMessage(null);
      await loadMessages(selected, { open: false });
      await loadConversations(false);
      emitToast("Message deleted.", "success");
    } catch (e) { setErr(e.message || String(e)); }
  };

  const showMessageInfo = async (message) => {
    setContextMessage(null);
    try {
      const { data, error } = await supabase.rpc("apn_message_info", { p_message_id: message.id });
      if (error) throw new Error(error.message);
      setMessageInfo(data?.[0] || message);
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openAdminChat = async (admin) => {
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_get_or_create_admin_conversation", { p_admin_id: admin.contact_id });
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "person" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openPersonChat = async (other) => {
    setErr("");
    const otherApnId = other?.apnId || other?.apn_id || "";
    if (!otherApnId) { setErr("This partner is missing a valid APN ID."); return; }
    try {
      // Use the hardened RPC first. The previous RPC name had accumulated
      // PostgREST overload/cache drift in production even though the database
      // itself contained the correct text signature.
      const primary = await supabase.rpc("apn_open_person_chat", { p_other_apn_id: otherApnId });
      if (!primary.error && primary.data?.[0]?.conversation_id) {
        openConversation({
          id: primary.data[0].conversation_id,
          subject: primary.data[0].subject || other.name,
          conv_type: "person",
          participant_apn_id: primary.data[0].participant_apn_id || otherApnId,
        });
        return;
      }

      // Compatibility path for databases that have not yet received the
      // hardening migration. Never expose raw PostgREST internals to the user.
      const legacy = await supabase.rpc("apn_get_or_create_person_conversation", { p_other_apn_id: otherApnId });
      if (!legacy.error && legacy.data?.[0]?.conversation_id) {
        openConversation({
          id: legacy.data[0].conversation_id,
          subject: legacy.data[0].subject || other.name,
          conv_type: "person",
          participant_apn_id: legacy.data[0].participant_apn_id || otherApnId,
        });
        return;
      }
      throw new Error(primary.error?.message || legacy.error?.message || "Could not open this friend chat.");
    } catch (e) {
      setErr(/schema cache|without parameters|PGRST202/i.test(e.message || "")
        ? "Chat service is refreshing. Please try again in a moment."
        : (e.message || "Could not open this friend chat."));
    }
  };

  const openDistrict = async () => {
    try {
      const { data, error } = await supabase.rpc("apn_get_district_conversation");
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "district" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openState = async () => {
    try {
      const { data, error } = await supabase.rpc("apn_get_state_conversation");
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "state" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0)
    + requests.filter((r) => r.direction === "incoming" && r.status === "pending").length;

  return (
    <div className="apn apn-teamchat" data-theme={isDark ? "dark" : "light"} style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <div className="apn-tc-header">
        <div className="seg" style={{ flex: "none" }}>{CHAT_SECTIONS.map((s) => <button key={s} className={section === s ? "on" : ""} onClick={() => { setSection(s); setSelected(null); }}>{CHAT_SECTION_LABEL[s]}{s === "person" && totalUnread > 0 && <span className="badge action-badge" style={{ marginLeft: 5 }}>{totalUnread > 99 ? "99+" : totalUnread}</span>}</button>)}</div>
      </div>
      <div className="apn-tc-body">
        {section === "person" && (
          <div className={`apn-tc-shell ${selected ? "has-selection" : ""}`}>
            <aside className="apn-tc-sidebar">
              <div className="apn-tc-sidebar-title">Team Chat</div>
              <div className="apn-tc-sidebar-subtitle">Connect with partners in your network</div>
              {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} />{err}</div>}

              {conversations.filter((c) => c.conv_type === "person").length > 0 && (
                <div className="apn-tc-card">
                  <div className="apn-tc-card-title">Recent Chats</div>
                  <div className="apn-tc-recent-list">
                    {conversations.filter((c) => c.conv_type === "person").slice(0, 8).map((c) => (
                      <button key={c.conversation_id} className="apn-tc-recent-row" onClick={() => openConversation({ id: c.conversation_id, subject: c.subject || "Chat", conv_type: "person" })}>
                        <div className="apn-tc-recent-avatar"><MessageCircle size={15} /></div>
                        <div className="apn-tc-recent-copy"><b>{c.subject || "Chat"}</b><span>{c.last_message || "No messages yet"}</span></div>
                        {Number(c.unread_count || 0) > 0 && <span className="apn-tc-unread">{Number(c.unread_count) > 99 ? "99+" : c.unread_count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="apn-tc-card">
                <div className="apn-tc-card-title">AllBee Support</div>
                {contacts.filter((c) => c.contact_type === "admin" || c.contact_type === "superadmin").map((a) => {
                  const supportLabel = /mohamed\s+backer\s+alim/i.test(a.name || "")
                    ? "Chat with AllBee Founder and CEO"
                    : /^haji$/i.test((a.name || "").trim())
                      ? "Chat with AllBee Cofounder and CFO"
                      : "Chat with AllBee Admins";
                  return (
                    <button key={a.contact_id} className="apn-tc-item apn-tc-contact" onClick={() => openAdminChat(a)}>
                      <Avatar name={a.name} url={a.photo_url} size={36} fontSize={13} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div className="hint-line">{supportLabel}</div></div>
                      <span className="apn-tc-available">Always available</span><ChevronRight size={16} color="var(--muted)" />
                    </button>
                  );
                })}
                {!contacts.some((c) => c.contact_type === "admin" || c.contact_type === "superadmin") && !loading && <div className="hint-line">No management contacts available.</div>}
              </div>

              <div className="apn-tc-card">
                <div className="apn-tc-card-title">Available Partners</div>
                <div className="hint-line" style={{ marginBottom: 8 }}>Send a friend request to start chatting</div>
                <input className="input" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search partner by name, code or district…" aria-label="Search APN partners" />
                <div className="apn-tc-partner-list">
                  {loading && <div className="hint-line" style={{ padding: 10 }}>Loading partners…</div>}
                  {!loading && contacts.filter((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())).map((c) => {
                    const action = c.relationship === "friend" ? "Chat" : c.relationship === "outgoing" ? "Pending" : c.relationship === "incoming" ? "Accept" : "Add Friend";
                    return <div key={c.contact_id} className="apn-tc-partner-row">
                      <Avatar name={c.name} url={c.photo_url} size={34} fontSize={12} />
                      <div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{c.name}</div><div className="apn-tc-partner-location">{c.apn_id || "APN partner"}{c.district ? ` · ${c.district}` : ""}</div></div>
                      <span className={`apn-tc-status ${c.availability === "online" ? "online" : "offline"}`}>{c.contact_type !== "partner" ? "Always available" : c.availability === "online" ? "Online" : `Last seen ${c.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}`}</span>
                      {c.relationship === "friend" ? <button className="btn sm" onClick={() => openPersonChat(c)}>Chat</button> : c.relationship === "incoming" ? <button className="btn sm primary" onClick={() => { const r = requests.find((x) => x.other_id === c.contact_id && x.direction === "incoming" && x.status === "pending"); if (r) acceptRequest(r.request_id); }}>Accept</button> : <button className="btn sm primary" disabled={c.relationship === "outgoing"} onClick={() => sendFriendRequest(c.apn_id)}>{action}</button>}
                    </div>;
                  })}
                  {!loading && !contacts.some((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())) && <div className="hint-line" style={{ padding: 10 }}>No partners found.</div>}
                </div>
              </div>

              {requests.filter((r) => r.status === "pending").length > 0 && <div className="apn-tc-card">
                <div className="apn-tc-card-title">Friend Requests</div>
                {requests.filter((r) => r.status === "pending").map((r) => <div key={r.request_id} className="apn-tc-partner-row">
                  <Avatar name={r.other_name} url={contacts.find((c) => String(c.contact_id) === String(r.other_id))?.photo_url} size={32} fontSize={11} /><div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{r.other_name}</div><div className="apn-tc-partner-location">{r.other_apn_id}</div></div>
                  {r.direction === "incoming" ? <div style={{ display: "flex", gap: 5 }}><button className="btn sm primary" onClick={() => acceptRequest(r.request_id)}>Accept</button><button className="btn sm" onClick={() => rejectRequest(r.request_id)}>Reject</button></div> : <span className="hint-line">Pending</span>}
                </div>)}
              </div>}
            </aside>

            <main className="apn-tc-main">
              {selected ? (
                <div className="apn-tc-chat" ref={scrollRef}>
                  <div className="apn-tc-chathead">
                    <button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }} aria-label="Back to chats"><ArrowLeft size={17} /></button>
                    <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{selected.subject}
                      {selected.participant_apn_id && (() => { const c = contacts.find((x) => x.apn_id === selected.participant_apn_id); return <div className="apn-tc-presence">{c?.availability === "online" ? <><span className="apn-tc-online-dot" />Online</> : <>Last seen {c?.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}</>}</div>; })()}
                    </div>
                  </div>
                  <div className="apn-tc-messages" onClick={() => setContextMessage(null)}>
                    {filteredMessages.map((m) => {
                      const isMe = m.sender_id === pid;
                      const ts = m.created_at ? new Date(m.created_at) : null;
                      const remaining = ts ? Math.max(0, 300000 - (chatNow - ts.getTime())) : 0;
                      const canDelete = isMe && remaining > 0 && !String(m.id).startsWith("tmp-");
                      const status = isMe ? (m.read_at ? "✓✓" : m.delivered_at ? "✓✓" : "✓") : "";
                      return <div key={m.id || m.created_at} className={`apn-tc-msg ${isMe ? "mine" : "theirs"}`} onDoubleClick={(e) => { e.stopPropagation(); setContextMessage(m); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMessage(m); }}>
                        {!isMe && <Avatar name={m.sender_name || "?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9} />}
                        <div className="apn-tc-bubble-wrap">
                          <div className="apn-tc-bubble">
                            {m.reply_to_id && (() => { const parent = messages.find((x) => x.id === m.reply_to_id); return <div className="apn-tc-reply-preview">↳ {parent ? `${parent.sender_name || "Message"}: ${String(parent.body || "").slice(0, 90)}` : "Reply"}</div>; })()}
                            <div className="apn-tc-text">{m.body}</div>
                            <div className="apn-tc-time">{ts ? fmtDateTime(ts) : ""}{m.edited_at ? " · edited" : ""} {status && <span className={`apn-tc-ticks ${m.read_at ? "read" : ""}`}>{status}</span>}</div>
                          </div>
                          {Array.isArray(m.reactions) && m.reactions.length > 0 && <div className="apn-tc-reactions">{m.reactions.map((r) => <button key={r.emoji} className={`apn-tc-reaction ${r.mine ? "mine" : ""}`} disabled={reactionBusy === `${m.id}:${r.emoji}`} onClick={() => toggleReaction(m, r.emoji)}>{r.emoji} {r.count}</button>)}</div>}
                          {isMe && remaining > 0 && <div className="apn-tc-delete-timer">Edit/Delete available {Math.floor(remaining/60000)}:{String(Math.floor((remaining%60000)/1000)).padStart(2,"0")}</div>}
                          {contextMessage?.id === m.id && <div className="apn-tc-msg-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => { setReplyTo(m); setContextMessage(null); }}>Reply</button><button onClick={() => toggleReaction(m, "👍")}>👍</button><button onClick={() => toggleReaction(m, "❤️")}>❤️</button><button onClick={() => toggleReaction(m, "😂")}>😂</button><button onClick={() => showMessageInfo(m)}>INFO</button>{isMe && remaining > 0 && <button onClick={() => { setEditMessage(m); setComposer(m.body || ""); setContextMessage(null); }}>Edit</button>}{canDelete && <button className="danger" onClick={() => deleteMessage(m)}><Trash2 size={13}/>Delete</button>}</div>}
                        </div>
                      </div>;
                    })}
                    {messages.length === 0 && !loading && <Empty icon={<MessageSquare size={20} />} title="No messages yet" text="Send the first message." />}
                  </div>
                  <div className="apn-tc-compose">
                    {(replyTo || editMessage) && <div className="apn-tc-compose-mode"><span>{editMessage ? "Editing message" : `Replying to ${replyTo?.sender_name || "message"}`}</span><button className="linkbtn" onClick={() => { setReplyTo(null); setEditMessage(null); setComposer(""); }}>×</button></div>}
                    <textarea className="textarea" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder={editMessage ? "Edit message…" : replyTo ? "Write your reply…" : "Type a message…"} rows={2} maxLength={2000} aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editMessage ? editNow() : sendMessage(); } }} />
                    <button className="btn primary" onClick={editMessage ? editNow : sendMessage} disabled={!composer.trim() || !selected}>{editMessage ? "Save" : "Send"}</button>
                  </div>
                </div>
              ) : <div className="apn-tc-main-empty"><div><MessageSquare size={30} color="var(--muted)" /><div className="apn-tc-main-title">Friend chats</div><div className="hint-line">Select a partner from the list to start messaging.</div></div></div>}
            </main>
          </div>
        )}
        {section === "district" && !selected && (
          <div className="apn-tc-group-pane">
            {loading && <div className="hint-line">Opening district chat…</div>}
            {err && <div className="auth-msg err"><AlertTriangle size={14} />{err}</div>}
            {!loading && !err && <button className="btn primary" style={{ marginBottom: 12 }} onClick={openDistrict}>Open {me.district || "District"} Chat</button>}
          </div>
        )}
        {section === "state" && !selected && (
          <div className="apn-tc-group-pane">
            {loading && <div className="hint-line">Opening state chat…</div>}
            {err && <div className="auth-msg err"><AlertTriangle size={14} />{err}</div>}
            {!loading && !err && <button className="btn primary" style={{ marginBottom: 12 }} onClick={openState}>Open {me.state || "State"} Chat</button>}
          </div>
        )}
        {selected && section !== "person" && (
          <div className="apn-tc-chat" ref={scrollRef}>
            <div className="apn-tc-chathead"><button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }} aria-label="Back to chats"><ArrowLeft size={17} /></button><div style={{ fontWeight: 700, flex: 1 }}>{selected.subject}</div></div>
            <div className="apn-tc-messages">
              {filteredMessages.map((m) => { const isMe=m.sender_id===pid; const ts=m.created_at?new Date(m.created_at):null; return <div key={m.id||m.created_at} className={`apn-tc-msg ${isMe?"mine":"theirs"}`}>{!isMe&&<Avatar name={m.sender_name||"?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9}/>}<div className="apn-tc-bubble"><div>{m.body}</div><div className="apn-tc-time">{ts?fmtDateTime(ts):""}</div></div></div>; })}
              {messages.length===0&&!loading&&<Empty icon={<MessageSquare size={20}/>} title="No messages yet" text="Send the first message."/>}
            </div>
            <div className="apn-tc-compose"><textarea className="textarea" value={composer} onChange={e=>setComposer(e.target.value)} placeholder="Type a message…" rows={2} maxLength={2000} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}/><button className="btn primary" onClick={sendMessage} disabled={!composer.trim()||!selected}>Send</button></div>
          </div>
        )}
      </div>
      {messageInfo && <div className="apn-tc-info-overlay" onClick={() => setMessageInfo(null)}>
        <div className="apn-tc-info-card" onClick={(e) => e.stopPropagation()}>
          <div className="apn-tc-info-head"><b>Message info</b><button className="linkbtn" onClick={() => setMessageInfo(null)}>×</button></div>
          <div className="apn-tc-info-row"><span>Sender</span><b>{messageInfo.sender_name || messageInfo.sender_id || "—"}</b></div>
          <div className="apn-tc-info-row"><span>Sent</span><b>{messageInfo.created_at ? fmtDateTime(new Date(messageInfo.created_at)) : "—"}</b></div>
          <div className="apn-tc-info-row"><span>Delivered</span><b>{messageInfo.delivered_at ? fmtDateTime(new Date(messageInfo.delivered_at)) : "Not delivered"}</b></div>
          <div className="apn-tc-info-row"><span>Read</span><b>{messageInfo.read_at ? fmtDateTime(new Date(messageInfo.read_at)) : "Not read"}</b></div>
        </div>
      </div>}
    </div>
  );
}

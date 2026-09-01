import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import * as Icons from "./icons.jsx";

const CHAT_SECTIONS = ["person", "district", "state"];
const CHAT_SECTION_LABEL = { person: "Friends", district: "District", state: "State" };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export default function APNTeamChat(props) {
  const { db, meRow, pid, profile, isDark, isOpen, refreshTick, go } = props;
  const { fmtDateTime, uid, emitToast, Empty, Avatar, apnIdFor, ...rest } = props.runtime || {};
  const { Search, Plus, Trash2, ChevronRight, ArrowLeft, FileText, Send, Bell, MessageSquare } = { ...Icons, ...rest };
  const [section, setSection] = useState("person");
  const [conversations, setConversations] = useState([]);          // from apn_list_conversations
  const [friends, setFriends] = useState([]);                        // accepted friend pairs -> {otherId, otherName, otherApnId}
  const [contacts, setContacts] = useState([]);                      // all active APN partners + always-available admins
  const [contactSearch, setContactSearch] = useState("");
  const [requests, setRequests] = useState([]);                      // from apn_list_friend_requests
  const [selected, setSelected] = useState(null);                    // {id, subject, participants}
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
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
      setConversations(data || []);
      const contactsRes = await supabase.rpc("apn_list_chat_contacts");
      if (!mountedRef.current) return;
      let contactRows = contactsRes.data || [];
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
      setRequests(fr.data || []);
      const accepted = (fr.data || []).filter((r) => r.status === "accepted");
      setFriends(accepted.map((r) => ({ id: r.other_id, name: r.other_name, apnId: r.other_apn_id })));
      const requestRows = fr.data || [];
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
      const msgs = data || [];
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
    const refreshChat = () => {
      queued = true;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued || !mountedRef.current) return;
        queued = false;
        inFlight = loadConversations(false).then(async () => {
          if (mountedRef.current && selectedRef.current) await loadMessages(selectedRef.current, { open: false });
        }).catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat();
        });
      }, 120);
    };
    ["apn_chat_messages", "apn_chat_conversations", "apn_chat_read_states", "apn_friend_requests", "apn_chat_presence"].forEach((t) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refreshChat));
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

  const sendMessage = async () => {
    const body = (composer || "").trim();
    if (!body || !selected) return;
    const convId = selected.id;
    setComposer("");
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_send_message", { p_conversation_id: convId, p_body: body });
      if (error) throw new Error(error.message);
      await loadMessages(selected, { open: false });
      await loadConversations(false);
    } catch (e) {
      setComposer(body);
      setErr(e.message || String(e));
    }
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
                    {messages.map((m) => {
                      const isMe = m.sender_id === pid;
                      const ts = m.created_at ? new Date(m.created_at) : null;
                      const remaining = ts ? Math.max(0, 300000 - (chatNow - ts.getTime())) : 0;
                      const canDelete = isMe && remaining > 0 && !String(m.id).startsWith("tmp-");
                      const status = isMe ? (m.read_at ? "✓✓" : m.delivered_at ? "✓✓" : "✓") : "";
                      return <div key={m.id || m.created_at} className={`apn-tc-msg ${isMe ? "mine" : "theirs"}`} onDoubleClick={(e) => { e.stopPropagation(); setContextMessage(m); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMessage(m); }}>
                        {!isMe && <Avatar name={m.sender_name || "?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9} />}
                        <div className="apn-tc-bubble-wrap">
                          <div className="apn-tc-bubble"><div className="apn-tc-text">{m.body}</div><div className="apn-tc-time">{ts ? fmtDateTime(ts) : ""} {status && <span className={`apn-tc-ticks ${m.read_at ? "read" : ""}`}>{status}</span>}</div></div>
                          {isMe && remaining > 0 && <div className="apn-tc-delete-timer">Delete available {Math.floor(remaining/60000)}:{String(Math.floor((remaining%60000)/1000)).padStart(2,"0")}</div>}
                          {contextMessage?.id === m.id && <div className="apn-tc-msg-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => showMessageInfo(m)}>INFO</button>{canDelete && <button className="danger" onClick={() => deleteMessage(m)}><Trash2 size={13}/>Delete</button>}</div>}
                        </div>
                      </div>;
                    })}
                    {messages.length === 0 && !loading && <Empty icon={<MessageSquare size={20} />} title="No messages yet" text="Send the first message." />}
                  </div>
                  <div className="apn-tc-compose">
                    <textarea className="textarea" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Type a message…" rows={2} maxLength={2000} aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                    <button className="btn primary" onClick={sendMessage} disabled={!composer.trim() || !selected}>Send</button>
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
              {messages.map((m) => { const isMe=m.sender_id===pid; const ts=m.created_at?new Date(m.created_at):null; return <div key={m.id||m.created_at} className={`apn-tc-msg ${isMe?"mine":"theirs"}`}>{!isMe&&<Avatar name={m.sender_name||"?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9}/>}<div className="apn-tc-bubble"><div>{m.body}</div><div className="apn-tc-time">{ts?fmtDateTime(ts):""}</div></div></div>; })}
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

/* ── tab error boundary ──────────────────────────────────────────────── */
class APNTabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("[APN] Tab render error:", error, info?.componentStack?.slice(0, 400)); }
  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "An unexpected error occurred.";
      return (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--neg)", marginBottom: 12 }}><AlertTriangle size={32} /></div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>{msg}</div>
          <button className="btn primary" onClick={() => this.setState({ hasError: false, error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── portal shell ────────────────────────────────────────────────────── */
export function APNPortal({ db, profile, session, signOut, isDark, mutate, patchDb = () => {}, reload }) {
  const pid = profile.id;
  const meRow = apnMe(db, pid);
  const [tab, setTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [finSnap, setFinSnap] = useState(null);
  const [snapTick, setSnapTick] = useState(0);
  const [agr, setAgr] = useState(null);

  // The agreement gate answer comes from the server-side apn_agreement_status
  // RPC (single source of truth). While it says REQUIRED, the whole portal is
  // replaced by APNAgreementGate; acceptance there triggers this refetch.
  const refreshAgreements = useCallback(async () => {
    const { data, error } = await supabase.rpc("apn_agreement_status");
    setAgr(error || !data ? null : data);
  }, []);
  useEffect(() => {
    refreshAgreements().catch(() => {});
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  // The portal's ONE refresh operation: reload the shared store (which every
  // APN page reads from) and bump the snapshot tick so the wallet facts and
  // any page-owned loaders (network, support tickets) refetch. Used by BOTH
  // the header refresh button and the global pull-to-refresh — one pull, one
  // refresh, no duplicated pipelines.
  const refreshPortal = useCallback(async () => {
    await reload();
    setSnapTick((t) => t + 1);
  }, [reload]);

  // WP7 — authoritative financial facts for the portal: refetch on mount, on
  // tab switch, and after a refresh so wallet values stay current, while
  // staying a read-only projection (no client-side recomputation). Never
  // blocks the portal: on failure legacy figures remain.
  useEffect(() => {
    let cancelled = false;
    fetchPartnerFinancialSnapshot().then((s) => { if (!cancelled) setFinSnap(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pid, tab, snapTick]);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setSearchOpen((v) => !v); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Deep links: #/apn/<tab>, and bare #/targets/<id> lands partners on their
  // targets tab so a notification tap acknowledges the right target.
  useEffect(() => {
    const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const route = parts[0] === "apn" ? parts[1] : parts[0];
    if (route && ["home", "leads", "quotations", "wallet", "withdrawals", "network", "chat", "learn", "targets", "documents", "agreements", "notifications", "achievements", "leaderboard", "district", "profile", "ai", "support"].includes(route)) setTab(route);
  }, []);

  const markNotificationsSeen = useCallback(async () => {
    const seenAt = new Date().toISOString();
    const { error } = await supabase.rpc("mark_apn_action_badge_seen", { p_action_type: "notification_unread" });
    if (error) { console.warn("[ALLBEE] notification read state could not be saved:", error.message); return; }
    patchDb((d) => ({ ...d, apn_action_badge_reads: [...(d.apn_action_badge_reads || []).filter((r) => !(r.user_id === pid && r.action_type === "notification_unread")), { user_id: pid, action_type: "notification_unread", seen_at: seenAt, updated_at: seenAt }] }));
  }, [pid, patchDb]);

  if (!meRow) return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div className="loading-card">
          <PrismFluxLoader status="Setting up your APN account…" statusList={["Loading your network", "Syncing data", "Almost ready"]} />
        </div>
      </div>
    </div>
  );

  const eff = meRow.status === "rejected" ? "rejected" : (profile.active === false && profile.status !== "pending") ? "suspended" : apnEffectiveStatus(meRow);
  if (eff === "pending") return <APNGate isDark={isDark} icon={<Hourglass size={26} />} title="Waiting for Approval" body={`Thanks ${meRow.name}. Your APN partner application (${apnIdFor(meRow)}) was successfully submitted and is awaiting admin approval. You'll get full access as soon as it's approved.`} onSignOut={signOut} onRefresh={refreshPortal} />;
  if (eff === "rejected") return <APNGate isDark={isDark} tone="neg" icon={<XCircle size={26} />} title="Application not approved" body={meRow.rejectReason ? `Reason: ${meRow.rejectReason}` : "Your APN partner application was not approved. Contact ALLBEE for details."} onSignOut={signOut} />;
  if (eff === "suspended") return <APNGate isDark={isDark} tone="neg" icon={<ShieldAlert size={26} />} title="Account suspended" body={`Your APN account is suspended${meRow.suspensionReason ? ` because of ${meRow.suspensionReason.toLowerCase()}` : ""}. Contact an administrator if you believe this is incorrect.`} onSignOut={signOut} onRefresh={refreshPortal} />;
  if (eff === "inactive") return <APNInactive meRow={meRow} db={db} mutate={mutate} onSignOut={signOut} isDark={isDark} pid={pid} />;
  // AGREE-MENT GATE: while any required document is unaccepted the server's
  // apn_agreement_status says required=true and the portal is fully replaced
  // by the review screen (visually distinct from account-suspended).
  if (agr && agr.required) return <APNAgreementGate isDark={isDark} onSignOut={signOut} required={agr.requiredList || []} onAccepted={refreshAgreements} />;

  const stats = apnPartnerStats(db, pid);
  const isHead = meRow.role === "district_head";
  const isStateHead = meRow.role === "state_head";
  const go = (t) => {
    if (t === "notifications") markNotificationsSeen().catch(() => {});
    setTab(t);
    setSidebarOpen(false);
  };
  const unreadNotif = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow) && apnActionRowTime(n) > apnActionReadTime(db, pid, "notification_unread")).length;
  const unackTargets = (db.apn_targets || []).filter((t) => t.partnerId === pid && !t.acknowledged).length;
  const withdrawalOpenCount = (db.apn_withdrawal_requests || []).filter((row) => row.partner_id === pid && ["pending", "under_review", "approved", "processing"].includes(row.status)).length;

  const section = () => {
    switch (tab) {
      case "home": return <APNHome db={db} meRow={meRow} stats={stats} snap={finSnap} pid={pid} go={go} openModal={setModal} mutate={mutate} profile={profile} onOpenProfile={() => go("profile")} />;
      case "leads": return <APNLeads db={db} meRow={meRow} pid={pid} openModal={setModal} mutate={mutate} />;
      case "wallet": return <APNWallet db={db} pid={pid} stats={stats} snap={finSnap} />;
      case "network": return <APNNetwork db={db} meRow={meRow} pid={pid} reload={reload} onOpenWithdrawals={() => go("withdrawals")} refreshTick={snapTick} />;
      case "chat": return <APNTeamChat db={db} meRow={meRow} pid={pid} profile={profile} isDark={isDark} isOpen={tab === "chat"} refreshTick={snapTick} go={go} />;
      case "withdrawals": return <APNWithdrawalCenter db={db} pid={pid} goProfile={() => go("profile")} reload={reload} />;
      case "learn": return <APNTraining db={db} meRow={meRow} pid={pid} mutate={mutate} />;
      case "targets": return <APNTargets db={db} pid={pid} mutate={mutate} go={go} />;
      case "quotations": return <APNQuotations db={db} meRow={meRow} pid={pid} openModal={setModal} />;
      case "documents": return <APNDocuments db={db} />;
      case "agreements": return <APNAgreementCenter db={db} pid={pid} onRefresh={refreshPortal} />;
      case "ai": return <APNAI meRow={meRow} go={go} mutate={mutate} pid={pid} />;
      case "support": return <APNSupportTickets pid={pid} refreshTick={snapTick} />;
      case "notifications": return <APNNotifications db={db} meRow={meRow} />;
      case "achievements": return <APNAchievements db={db} pid={pid} />;
      case "leaderboard": return <APNLeaderboard db={db} meRow={meRow} pid={pid} />;
      case "district": return isHead ? <APNDistrict db={db} meRow={meRow} mutate={mutate} /> : isStateHead ? <APNStateHead db={db} meRow={meRow} mutate={mutate} patchDb={patchDb} openModal={setModal} /> : <APNHome db={db} meRow={meRow} stats={stats} snap={finSnap} pid={pid} go={go} openModal={setModal} mutate={mutate} profile={profile} onOpenProfile={() => go("profile")} />;
      case "profile": return <APNProfile db={db} meRow={meRow} stats={stats} snap={finSnap} profile={profile} sessionEmail={session?.user?.email} mutate={mutate} onSignOut={signOut} reload={reload} isHead={isHead} go={go} />;
      default: return null;
    }
  };

  const moreItems = [
    ["targets", "Targets", <Target size={20} color="var(--primary)" />, unackTargets],
    ["quotations", "Quotations", <FileText size={20} color="var(--primary)" />, 0],
    ["documents", "Materials", <BookOpen size={20} color="var(--primary)" />, 0],
    ["agreements", "Agreements", <ScrollText size={20} color="var(--primary)" />, agr?.requiredCount || 0],
    ["notifications", "Notifications", <Bell size={20} color="var(--primary)" />, unreadNotif],
    ["learn", "Learn", <GraduationCap size={20} color="var(--primary)" />, 0],
    ["withdrawals", "Withdrawal Center", <Wallet size={20} color="var(--primary)" />, withdrawalOpenCount],
    ["ai", "ALLBEE AI", <Sparkles size={20} color="var(--primary)" />, 0],
    ["support", "My Tickets", <MessageCircle size={20} color="var(--primary)" />, 0],
    ["achievements", "Achievements", <Award size={20} color="var(--primary)" />, 0],
    ["leaderboard", "Leaderboard", <Trophy size={20} color="var(--primary)" />, 0],
    ...(isHead ? [["district", "District", <MapPin size={20} color="var(--primary)" />, 0]] : []),
    ...(isStateHead ? [["district", "State Command", <MapPin size={20} color="var(--primary)" />, 0]] : []),
    ["profile", "Profile", <User size={20} color="var(--primary)" />, 0],
  ];
  const primary = [["home", "Home", Home], ["leads", "Leads", UserPlus], ["wallet", "Wallet", Wallet], ["network", "My Network", Users], ["chat", "Team Chat", MessageSquare]];
  const showFab = tab === "leads" || tab === "quotations";
  return (
    <div className={`allbee apn apn-nav-shell${sidebarOpen ? " menu-open" : ""}`} data-theme={isDark ? "dark" : "light"}>
      <aside className="apn-desktop-sidebar" aria-label="APN navigation">
        <div className="apn-side-brand" role="button" tabIndex={0} onClick={() => go("home")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("home"); } }}>
          <FounderTap className="brand-logo" src={LOGO_ICON} alt="ALLBEE" />
          <div><div className="apn-side-title">ALLBEE</div><div className="apn-side-sub">Partner Network</div></div>
        </div>
        <div className="apn-side-section">MAIN</div>
        <div className="apn-side-links">
          {primary.map(([k, l, Icon]) => <button key={k} className={"apn-side-link" + (tab === k ? " active" : "")} onClick={() => go(k)}><Icon size={17} /><span>{l}</span>{k === "chat" && unreadNotif > 0 ? <span className="badge action-badge">{unreadNotif > 99 ? "99+" : unreadNotif}</span> : null}</button>)}
        </div>
        <div className="apn-side-section">WORKSPACE</div>
        <div className="apn-side-links">
          {moreItems.map(([k, l, ic, badge]) => <button key={k} className={"apn-side-link" + (tab === k ? " active" : "")} onClick={() => go(k)}>{ic}<span>{l}</span>{badge > 0 && <span className="badge action-badge">{badge > 99 ? "99+" : badge}</span>}</button>)}
        </div>
        <div className="apn-side-foot">
          <button className="apn-side-link" onClick={signOut}><LogOut size={17} color="var(--neg)" /><span style={{ color: "var(--neg)" }}>Sign out</span></button>
        </div>
      </aside>
      <div className="apn-main">
      <style>{CSS}</style><ToastHost />
       <header className="apn-top">
         <button type="button" className="brand-logo-button" onClick={() => go("home")} aria-label="Go to APN home" title="Go to APN home"><FounderTap className="brand-logo" src={LOGO_ICON} alt="APN" /></button>
         <button type="button" className="iconbtn" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? "Close menu" : "Open menu"} title="Menu" aria-expanded={sidebarOpen}><Menu size={19} /></button>
         <div style={{ flex: 1, minWidth: 0 }}><h1>APN</h1><div className="apn-id">{apnIdFor(meRow)} · {meRow.district || "Tamil Nadu"}{meRow.role === "state_head" && " · State Head"}</div></div>
        <PortalRefreshButton onRefresh={refreshPortal} />
        <button className="iconbtn" onClick={() => setSearchOpen(true)} title="Search"><Search size={17} /></button>
        <button className="iconbtn" style={{ position: "relative" }} onClick={() => go("notifications")}><Bell size={17} />{unreadNotif > 0 && <span className="badge action-badge" style={{ position: "absolute", top: -5, right: -5 }}>{unreadNotif > 99 ? "99+" : unreadNotif}</span>}</button>
        <button className="iconbtn" style={{ width: 36, height: 36, padding: 0, borderRadius: "50%" }} onClick={() => go("profile")} aria-label="Open APN profile" title="Profile"><Avatar name={meRow.name} url={apnAvatarUrl(meRow, profile)} size={30} fontSize={12} /></button>
      </header>

      <div className="apn-body"><div className="page-enter" key={tab}><APNTabErrorBoundary key={tab}>{section()}</APNTabErrorBoundary></div></div>

      {showFab && <button className="apn-fab" onClick={() => setModal({ type: tab === "leads" ? "apnLead" : "apnQuote" })}><Plus size={24} /></button>}

      {/* one global pull-to-refresh for every APN tab; overlays/sheets guard themselves */}
      <GlobalPullToRefresh enabled={!modal && !searchOpen && !sidebarOpen} onRefresh={refreshPortal} />

      <nav className="apn-bottomnav">
        {primary.map(([k, l, Icon]) => (
          <button key={k} className={"apn-tab" + (tab === k ? " on" : "") + (k === "network" ? " net" : "")} onClick={() => go(k)}><Icon size={k === "chat" ? 22 : 20} strokeWidth={k === "chat" ? 1.6 : 2} /><span>{l}</span></button>
        ))}
      </nav>
      </div>

      {searchOpen && <APNSearch db={db} meRow={meRow} pid={pid} go={go} onClose={() => setSearchOpen(false)} />}
      {modal?.type === "apnLead" && <APNLeadForm meRow={meRow} db={db} onSave={(l) => mutate((d) => ({ ...d, apn_leads: [...(d.apn_leads || []), l] }), { action: "submitted APN lead", module: "APN", entity: "APN Lead", entityId: l.id, partnerId: pid })} onClose={() => setModal(null)} />}
      {modal?.type === "apnQuote" && <APNQuoteForm meRow={meRow} initial={modal.initial} onSave={(qq) => mutate((d) => ({ ...d, apn_quotations: (d.apn_quotations || []).some((x) => x.id === qq.id) ? d.apn_quotations.map((x) => x.id === qq.id ? qq : x) : [...(d.apn_quotations || []), qq] }), { action: modal.initial ? "updated APN quotation" : "generated APN quotation", module: "APN", entity: "APN Quotation", entityId: qq.id, partnerId: pid })} onClose={() => setModal(null)} />}
      {modal?.type === "apnReject" && <APNRejectForm partner={modal.partner} onSave={async (reason) => { try { const { error } = await supabase.rpc("apn_state_head_reject_partner", { p_partner_id: modal.partner.id, p_reason: reason || null }); if (error) throw error; const at = Date.now(); patchDb((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === modal.partner.id ? { ...u, status: "rejected", rejectReason: reason || null, rejectedBy: meRow.name, rejectedAt: at } : u) })); emitToast(`Rejected ${modal.partner.name}.`, "success"); } catch (e) { emitToast(e?.message || "Could not reject partner.", "error"); } finally { setModal(null); } }} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APN ADMIN (internal) — run by Haji / Alim / admins. Approvals, District Head
   appointment and reactivation are partner-only (superadmin) actions.
══════════════════════════════════════════════════════════════════════ */
const APN_APPROVERS = [
  { name: "Syed Hasan Kuddos Sahib", designation: "Co-Founder & CFO" },
  { name: "Mohamed Backer Alim Sahib", designation: "Founder & CEO" },
];
const apnApproverFor = (actor) => /syed|haji/i.test(String(actor || "")) ? APN_APPROVERS[0] : APN_APPROVERS[1];
const apnNotificationSender = (n) => {
  const approvedBy = n?.approvedBy || {};
  return { name: n?.senderName || approvedBy.name || n?.createdBy || "ALLBEE", designation: n?.senderDesignation || approvedBy.designation || n?.senderRole || "Admin", avatar: n?.senderAvatar || approvedBy.avatar || approvedBy.photo_url || "" };
};
const apnApprovalNotification = (partner, actor) => {
  const approvedBy = apnApproverFor(actor);
  return { title: "Welcome to APN 🎉", body: `Your partner account has been approved.\n\nApproved by\n${approvedBy.name}\n${approvedBy.designation}`, approvedBy, senderName: approvedBy.name, senderRole: approvedBy.designation, senderDesignation: approvedBy.designation, partnerId: partner.id, audience: `partner:${partner.id}` };
};
const apnNotify = (n) => {
  const createdAt = Date.now();
  return { id: uid(), title: n.title || "", body: n.body || "", audience: n.audience || "all", level: n.level || "General", reads: [], createdAt, createdDate: new Date(createdAt).toISOString().slice(0, 10), createdTime: new Date(createdAt).toTimeString().slice(0, 8), ...(n.approvedBy ? { approvedBy: n.approvedBy } : {}), ...(n.partnerId ? { partnerId: n.partnerId } : {}), ...(n.metadata ? { metadata: n.metadata } : {}), ...(n.senderName ? { senderName: n.senderName } : {}), ...(n.senderRole ? { senderRole: n.senderRole } : {}), ...(n.senderDesignation ? { senderDesignation: n.senderDesignation } : {}), ...(n.senderAvatar ? { senderAvatar: n.senderAvatar } : {}) };
};

/* ── admin forms ─────────────────────────────────────────────────────── */

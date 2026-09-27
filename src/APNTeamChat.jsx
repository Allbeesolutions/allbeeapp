import React from "react";
import { MoreHorizontal, Users, X, ArrowDown, Send as SendIcon } from "lucide-react";
import "./ui/team-chat.css";

export default function APNTeamChat({ db, meRow, pid, profile, isDark, isOpen, refreshTick, go, runtime = {} }) {
  const { useState, useEffect, useRef, useCallback, useReducedMotion, supabase, emitToast, Empty, Avatar, apnIdFor, fmtDateTime, Search, Trash2, ChevronRight, ArrowLeft, Send, MessageSquare, MessageCircle, AlertTriangle, CHAT_SECTIONS, CHAT_SECTION_LABEL } = runtime;
  const Paperclip = runtime.Paperclip || MessageCircle;
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const fileRef = useRef(null);
  const composerRef = useRef(null);
  const nearBottom = useRef(true);
  const [newMessages, setNewMessages] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [section, setSection] = useState("person");
  const [conversations, setConversations] = useState([]);          // from apn_list_conversations
  const [friends, setFriends] = useState([]);                        // accepted friend pairs -> {otherId, otherName, otherApnId}
  const [contacts, setContacts] = useState([]);                      // all active APN partners + always-available admins
  const [contactSearch, setContactSearch] = useState("");
  const [requests, setRequests] = useState([]);                      // from apn_list_friend_requests
  const [selected, setSelected] = useState(null);                    // {id, subject, participants}
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [composerFile, setComposerFile] = useState(null);
  const [messageSearch, setMessageSearch] = useState("");
  const [searchedMessages, setSearchedMessages] = useState(null);
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
    const timer = setInterval(() => beat(true), 30000);
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
          supabase.from("apn_users").select("id,data").neq("id", pid).limit(500),
          supabase.from("profiles").select("id,name,role,photo_url,active,status").neq("id", pid).in("role", ["admin", "superadmin"]).limit(200),
          supabase.from("apn_chat_presence").select("user_id,online,last_seen,updated_at").limit(500)
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
        const photos = new Map();
        for (let i = 0; i < contactIds.length; i += 100) {
          const batch = contactIds.slice(i, i + 100);
          const profileRes = await supabase.from("profiles").select("id,photo_url").in("id", batch);
          if (!mountedRef.current) return;
          if (!profileRes.error) (profileRes.data || []).forEach((r) => photos.set(String(r.id), r.photo_url || null));
        }
        contactRows = contactRows.map((c) => ({ ...c, photo_url: photos.get(String(c.contact_id)) || c.photo_url || null }));
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
      selectedRef.current = conv;
      setSelected(conv);
      setMessages([]);
    }
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_list_messages", { p_conversation_id: conv.id });
      if (!mountedRef.current || selectedRef.current?.id !== conv.id) return;
      if (error) throw new Error(error.message);
      const msgs = Array.isArray(data) ? data : [];
      setMessages(msgs);
      await Promise.all(msgs.filter((m) => m.sender_id !== pid && !m.delivered_at).map((m) => supabase.rpc("apn_mark_delivered", { p_message_id: m.id })));
      // advance the caller's read cursor to the latest message so the badge clears
      if (msgs.length) await supabase.rpc("apn_mark_read", { p_conversation_id: conv.id, p_message_id: msgs[msgs.length - 1].id });
    } catch (e) {
      if (mountedRef.current && selectedRef.current?.id === conv.id) setErr(e.message || String(e));
    }
  }, []);

  const openConversation = useCallback(async (conv) => {
    setComposer("");setComposerFile(null);setReplyTo(null);setEditMessage(null);setMessageSearch("");setSearchedMessages(null);setContextMessage(null);nearBottom.current=true;setNewMessages(false);
    await loadMessages(conv);
    // scroll to bottom after messages render
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  }, [loadMessages]);

  // Load conversations when the tab opens / on refresh ticks.
  useEffect(() => {
    if (isOpen) { loadConversations(); setSelected(null); setMessages([]); }
  }, [isOpen, refreshTick, loadConversations]);

  // Read state remains authoritative in apn_chat_read_states; read/write RPCs
  // update it, but it does not need a realtime subscription that would trigger
  // a full contact reload for every read receipt.
  // Realtime is the source of truth. Do not refetch the entire contact list on
  // every presence/read-state heartbeat: presence is a 15-second write while this
  // screen is open, so treating it as a full chat refresh creates a hidden egress
  // multiplier. Message events refresh the open thread; friend-request events
  // refresh the conversation/contact lists; presence is applied locally.
  useEffect(() => {
    if (!isOpen) return;
    const chName = `apn-team-chat:${pid}`;
    const ch = supabase.channel(chName);
    let timerId = null;
    let inFlight = null;
    let queued = false;
    let queuedTable = null;
    const refreshChat = (table) => {
      queued = true;
      queuedTable = table || queuedTable;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued || !mountedRef.current) return;
        queued = false;
        const tableNow = queuedTable;
        queuedTable = null;
        const selectedNow = selectedRef.current;
        const refresh = tableNow === "apn_chat_messages" && selectedNow
          ? loadMessages(selectedNow, { open: false })
          : loadConversations(false);
        inFlight = refresh.catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat(queuedTable);
        });
      }, 180);
    };
    const applyPresence = (payload) => {
      const row = payload?.new || payload?.old;
      if (!row?.user_id || !mountedRef.current) return;
      const userId = String(row.user_id);
      setContacts((rows) => rows.map((c) => String(c.contact_id) === userId
        ? { ...c, availability: row.online && row.updated_at && (Date.now() - new Date(row.updated_at).getTime() < 45000) ? "online" : "offline", last_seen: row.last_seen || c.last_seen }
        : c));
    };
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "apn_chat_messages" }, () => refreshChat("apn_chat_messages"));
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "apn_chat_messages" }, () => refreshChat("apn_chat_messages"));
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "apn_chat_messages" }, () => refreshChat("apn_chat_messages"));
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "apn_friend_requests" }, () => refreshChat("apn_friend_requests"));
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "apn_friend_requests" }, () => refreshChat("apn_friend_requests"));
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "apn_friend_requests" }, () => refreshChat("apn_friend_requests"));
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "apn_chat_presence" }, applyPresence);
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "apn_chat_presence" }, applyPresence);
    ch.subscribe();
    return () => {
      if (timerId) clearTimeout(timerId);
      queued = false;
      queuedTable = null;
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

  useEffect(() => {
    let cancelled = false;
    const q = messageSearch.trim();
    if (!q || !selected) { setSearchedMessages(null); return undefined; }
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("apn_chat_search", { p_conversation_id: selected.id, p_query: q, p_limit: 100 });
      if (!cancelled) setSearchedMessages(error ? [] : (Array.isArray(data) ? data : []));
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [messageSearch, selected]);

  const revokeRequest = async (requestId) => {
    setBusyRequests((prev) => new Set(prev).add(requestId)); setErr("");
    try {
      const { error } = await supabase.rpc("apn_revoke_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
      await loadConversations(); emitToast("Friend request revoked.", "success");
    } catch (e) { setErr(e.message || String(e)); emitToast(e.message || "Could not revoke request.", "error"); }
    finally { setBusyRequests((prev) => { const n=new Set(prev); n.delete(requestId); return n; }); }
  };

  const unfriend = async (otherId) => {
    setErr("");
    try {
      const { error } = await supabase.rpc("apn_unfriend", { p_other_id: String(otherId) });
      if (error) throw new Error(error.message);
      setSelected(null); setMessages([]);
      await loadConversations(); emitToast("Friend removed.", "success");
    } catch (e) { setErr(e.message || String(e)); emitToast(e.message || "Could not remove friend.", "error"); }
  };

  const filteredMessages = searchedMessages ?? messages;

  const sendMessage = async () => {
    const body = (composer || "").trim();
    if ((!body && !composerFile) || !selected || sendingRef.current) return;
    if (composerFile && composerFile.size > 10 * 1024 * 1024) { setErr("Attachments must be 10 MB or smaller."); return; }
    sendingRef.current=true;setSending(true);
    let messageCreated=false;
    const originalReply=replyTo;
    const convId = selected.id;
    const file = composerFile;
    setComposer(""); setComposerFile(null); setReplyTo(null); setErr("");
    try {
      const mentions = Array.from(new Set((body.match(/@[A-Za-z0-9_.-]+/g) || []).map((x) => x.slice(1))));
      const { data, error } = await supabase.rpc("apn_send_message_v3", { p_conversation_id: convId, p_body: body || (file ? `📎 ${file.name}` : "Attachment"), p_reply_to_id: replyTo?.id || null, p_mentions: mentions });
      if (error) throw new Error(error.message);
      messageCreated=true;
      const messageId = data?.[0]?.message_id;
      if (file && messageId) {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-160);
        const path = `${convId}/${messageId}/${safeName}`;
        const upload = await supabase.storage.from("apn-chat").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upload.error) throw new Error(`Message sent, but attachment upload failed: ${upload.error.message}`);
        const { error: attachError } = await supabase.rpc("apn_chat_attach", { p_message_id: messageId, p_conversation_id: convId, p_file_name: file.name, p_storage_path: path, p_mime_type: file.type || null, p_size_bytes: file.size });
        if (attachError) throw new Error(`Message sent, but attachment could not be linked: ${attachError.message}`);
      }
      await loadMessages(selected, { open: false });
      await loadConversations(false);
    } catch (e) { if(!messageCreated){setComposer(body);setComposerFile(file);setReplyTo(originalReply);}setErr(e.message || String(e)); }
    finally { sendingRef.current=false;setSending(false); }
  };

  const openAttachment = async (attachment) => {
    try {
      const { data, error } = await supabase.storage.from("apn-chat").createSignedUrl(attachment.storage_path, 600);
      if (error || !data?.signedUrl) throw new Error(error?.message || "Attachment link unavailable.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setErr(e.message || "Could not open attachment."); }
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

  const dayLabel = (value) => {
    const date=new Date(value); if(!Number.isFinite(date.getTime()))return "Messages";
    const today=new Date(); if(date.toDateString()===today.toDateString())return "Today";
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
    return date.toDateString()===yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString([], {day:"numeric",month:"short",year:"numeric"});
  };
  const scrollToLatest = () => { const el=scrollRef.current; if(el)el.scrollTo?.({top:el.scrollHeight,behavior:reduced?"auto":"smooth"});nearBottom.current=true;setNewMessages(false); };
  useEffect(()=>{ const el=scrollRef.current;if(!el)return;if(nearBottom.current){el.scrollTop=el.scrollHeight;}else{setNewMessages(true);} },[messages.length]);
  const matchesContact = (value) => String(value||"").toLowerCase().includes(contactSearch.trim().toLowerCase());
  const recentChats = conversations.filter(c=>c.conv_type==="person"&&matchesContact([c.subject,c.last_message].join(" "))&&(!unreadOnly||Number(c.unread_count)>0));
  const renderConversation = () => (
<div className="apn-tc-chat">
                  <div className="apn-tc-chathead">
                    <button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }} aria-label="Back to chats"><ArrowLeft size={17} /></button>
                    <Avatar name={selected.subject || "Chat"} size={40} fontSize={15} />
                    <div className="tc-thread-title">{selected.subject}
                      {selected.participant_apn_id && (() => { const c = contacts.find((x) => x.apn_id === selected.participant_apn_id); return <div className="apn-tc-presence">{c?.availability === "online" ? <><span className="apn-tc-online-dot" />Online</> : <>Last seen {c?.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}</>}</div>; })()}
                    </div>
                    <button className="iconbtn" aria-label="Search this conversation" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setMessageSearch(""); }}><Search size={18}/></button>
                  </div>
                  {searchOpen && <div className="tc-message-search">
                    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                      <Search size={15} />
                      <input className="input" value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="Search messages, mentions, or senders…" aria-label="Search messages" />
                      {messageSearch && <button className="linkbtn" onClick={() => setMessageSearch("")} aria-label="Clear message search">×</button>}
                    </div>
                  </div>}
                  {err && <div className="auth-msg err tc-thread-error" role="alert">{err}</div>}
                  <div ref={scrollRef} className="apn-tc-messages" role="log" aria-label="Conversation messages" onScroll={() => { const el=scrollRef.current; nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<90; if(nearBottom.current)setNewMessages(false); }} onClick={() => setContextMessage(null)}>
                    {filteredMessages.map((m, index) => {
                      const isMe = m.sender_id === pid;
                      const ts = m.created_at ? new Date(m.created_at) : null;
                      const remaining = ts ? Math.max(0, 300000 - (chatNow - ts.getTime())) : 0;
                      const canDelete = isMe && remaining > 0 && !String(m.id).startsWith("tmp-");
                      const status = isMe ? (m.read_at ? "✓✓" : m.delivered_at ? "✓✓" : "✓") : "";
                      return <React.Fragment key={m.id || m.created_at}>{(index===0 || dayLabel(filteredMessages[index-1].created_at)!==dayLabel(m.created_at)) && <div className="tc-date"><span>{dayLabel(m.created_at)}</span></div>}<div className={`apn-tc-msg ${isMe ? "mine" : "theirs"}`} onDoubleClick={(e) => { e.stopPropagation(); setContextMessage(m); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMessage(m); }}>
                        {!isMe && <Avatar name={m.sender_name || "?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9} style={{flexShrink:0}} />}
                        <div className="apn-tc-bubble-wrap">
                          {!isMe && <div className="tc-sender">{m.sender_name || "Partner"}</div>}
                          <div className="apn-tc-bubble">
                            {m.reply_to_id && (() => { const parent = messages.find((x) => x.id === m.reply_to_id); return <div className="apn-tc-reply-preview">↳ {parent ? `${parent.sender_name || "Message"}: ${String(parent.body || "").slice(0, 90)}` : "Reply"}</div>; })()}
                            <div className="apn-tc-text">{m.body}</div>{Array.isArray(m.mentions) && m.mentions.length > 0 && <div className="hint-line" style={{ fontSize: 11, marginTop: 4 }}>Mentioned: {m.mentions.map((x) => `@${x}`).join(" ")}</div>}{Array.isArray(m.attachments) && m.attachments.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>{m.attachments.map((a) => <button key={a.id} className="btn sm" onClick={(e) => { e.stopPropagation(); openAttachment(a); }}><Paperclip size={12} />{a.file_name}</button>)}</div>}
                            <div className="apn-tc-time" title={ts ? fmtDateTime(ts) : ""}>{ts ? ts.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}{m.edited_at ? " · edited" : ""} {status && <span className={`apn-tc-ticks ${m.read_at ? "read" : ""}`}>{status}</span>}</div>
                          </div>
                          {Array.isArray(m.reactions) && m.reactions.length > 0 && <div className="apn-tc-reactions">{m.reactions.map((r) => <button key={r.emoji} className={`apn-tc-reaction ${r.mine ? "mine" : ""}`} disabled={reactionBusy === `${m.id}:${r.emoji}`} onClick={() => toggleReaction(m, r.emoji)}>{r.emoji} {r.count}</button>)}</div>}
                          {isMe && remaining > 0 && <div className="apn-tc-delete-timer">Edit/Delete available {Math.floor(remaining/60000)}:{String(Math.floor((remaining%60000)/1000)).padStart(2,"0")}</div>}
                          <button className="tc-message-more" aria-label={"Actions for message from " + (isMe ? "you" : m.sender_name || "partner")} aria-expanded={contextMessage?.id===m.id} onClick={(e)=>{e.stopPropagation();setContextMessage(contextMessage?.id===m.id ? null : m);}}><MoreHorizontal size={17}/></button>
                          {contextMessage?.id === m.id && <div role="group" aria-label="Message actions" className="apn-tc-msg-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => { setReplyTo(m); setContextMessage(null); }}>Reply</button><button aria-label="React with thumbs up" onClick={() => toggleReaction(m, "👍")}>👍</button><button aria-label="React with heart" onClick={() => toggleReaction(m, "❤️")}>❤️</button><button aria-label="React with laughter" onClick={() => toggleReaction(m, "😂")}>😂</button><button onClick={() => showMessageInfo(m)}>INFO</button>{isMe && remaining > 0 && <button onClick={() => { setEditMessage(m); setComposer(m.body || ""); setContextMessage(null); }}>Edit</button>}{canDelete && <button className="danger" onClick={() => deleteMessage(m)}><Trash2 size={13}/>Delete</button>}</div>}
                        </div>
                      </div></React.Fragment>;
                    })}
                    {filteredMessages.length === 0 && !loading && <Empty icon={<MessageSquare size={20} />} title={messageSearch ? "No matching messages" : "No messages yet"} text={messageSearch ? "Try another search." : "Send the first message."} />}
                  </div>
                  {newMessages && <button className="tc-new-messages" onClick={scrollToLatest}><ArrowDown size={14}/>New messages</button>}
                  <div className="apn-tc-compose">
                    {(replyTo || editMessage) && <div className="apn-tc-compose-mode"><span>{editMessage ? "Editing message" : `Replying to ${replyTo?.sender_name || "message"}`}</span><button className="linkbtn" aria-label="Cancel reply or edit" onClick={() => { setReplyTo(null); setEditMessage(null); setComposer(""); }}>×</button></div>}
                    {composerFile && <div className="hint-line" style={{ marginBottom: 6 }}>Attachment: <b>{composerFile.name}</b> · {Math.round(composerFile.size / 1024)} KB <button className="linkbtn" onClick={() => setComposerFile(null)}>remove</button></div>}
                    <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                      <button className="iconbtn tc-attach" aria-label="Attach file" disabled={sending} onClick={()=>fileRef.current?.click()}><Paperclip size={20}/></button><input ref={fileRef} type="file" hidden onChange={(e)=>{setComposerFile(e.target.files?.[0]||null);e.target.value="";}} />
                      <div className="tc-composer-field"><textarea ref={composerRef} disabled={sending} className="textarea" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder={editMessage ? "Edit message…" : replyTo ? "Write your reply…" : "Type a message…"} rows={1} maxLength={2000} aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); editMessage ? editNow() : sendMessage(); } }} /></div>
                      <button className="btn primary" onClick={editMessage ? editNow : sendMessage} aria-label={editMessage ? "Save message" : "Send"} disabled={sending || (!composer.trim() && !composerFile) || !selected}><SendIcon size={19}/><span>{sending ? "Sending…" : editMessage ? "Save" : "Send"}</span></button>
                    </div>
                    <div className="tc-composer-hint">Shift + Enter for a new line · @APNID to mention · Files up to 10 MB</div>
                  </div>
                </div>
  );

  return (
    <div className="apn apn-teamchat" data-theme={isDark ? "dark" : "light"} onKeyDown={(e)=>{if(e.key==="Escape"){setContextMessage(null);setSearchOpen(false);setMessageSearch("");}}}>
      <div className="apn-tc-header"><div className="tc-brand"><span className="tc-brand-icon"><MessageCircle size={22}/></span><div><span className="tc-eyebrow">ALLBEE CONNECT</span><h2>Team Chat</h2></div></div>
        <div className="seg" style={{ flex: "none" }}>{CHAT_SECTIONS.map((s) => <button key={s} aria-pressed={section === s} className={section === s ? "on" : ""} onClick={() => { setSection(s); setSelected(null); }}>{CHAT_SECTION_LABEL[s]}{s === "person" && totalUnread > 0 && <span className="badge action-badge" style={{ marginLeft: 5 }}>{totalUnread > 99 ? "99+" : totalUnread}</span>}</button>)}</div>
      </div>
      <div className="apn-tc-body">
        {section === "person" && (
          <div className={`apn-tc-shell ${selected ? "has-selection" : ""}`}>
            <aside className="apn-tc-sidebar">
              <div className="tc-inbox-heading"><div><div className="apn-tc-sidebar-title">Conversations</div><div className="apn-tc-sidebar-subtitle">A little closer. A lot more connected.</div></div><Avatar name={me.name} size={36}/></div>
              <div className="apn-tc-search"><Search size={17}/><input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search chats or people" aria-label="Search chats or people"/>{contactSearch && <button className="linkbtn" aria-label="Clear chat search" onClick={()=>setContactSearch("")}><X size={15}/></button>}</div>
              <div className="tc-inbox-filters"><button aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>All chats</button><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Unread</button></div>
              {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} />{err}</div>}

              {(recentChats.length>0 || unreadOnly || contactSearch) && (
                <div className="apn-tc-card">
                  <div className="apn-tc-card-title">Recent Chats</div>
                  <div className="apn-tc-recent-list">{!recentChats.length && <p className="tc-list-empty">{unreadOnly ? "You’re all caught up." : "No conversations match your search."}</p>}
                    {recentChats.map((c) => (
                      <button key={c.conversation_id} className={"apn-tc-recent-row"+(selected?.id===c.conversation_id?" active":"")} aria-current={selected?.id===c.conversation_id ? "true" : undefined} onClick={() => openConversation({ id: c.conversation_id, subject: c.subject || "Chat", conv_type: "person" })}>
                        <Avatar name={c.subject || "Chat"} size={42} fontSize={15}/>
                        <div className="apn-tc-recent-copy"><b>{c.subject || "Chat"}</b><span>{c.last_message || "No messages yet"}</span></div>
                        {Number(c.unread_count || 0) > 0 && <span className="apn-tc-unread">{Number(c.unread_count) > 99 ? "99+" : c.unread_count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="apn-tc-card">
                <div className="apn-tc-card-title">AllBee Support</div>
                {contacts.filter((c) => (c.contact_type === "admin" || c.contact_type === "superadmin") && matchesContact(c.name)).sort((a, b) => {
                  const supportRank = (name = "") => {
                    const n = String(name).trim().toLowerCase();
                    if (n === "saranya") return 1;
                    if (n === "haji") return 2;
                    if (/mohamed\s+backer\s+alim/i.test(n)) return 3;
                    return 100;
                  };
                  return supportRank(a.name) - supportRank(b.name) || String(a.name || "").localeCompare(String(b.name || ""));
                }).map((a) => {
                  const supportLabel = /mohamed\s+backer\s+alim/i.test(a.name || "")
                    ? "Chat with AllBee Founder and CEO"
                    : /^haji$/i.test((a.name || "").trim())
                      ? "Chat with AllBee Cofounder and CFO"
                      : "Chat with AllBee Admins";
                  return (
                    <button key={a.contact_id} className="apn-tc-item apn-tc-contact" onClick={() => openAdminChat(a)}>
                      <Avatar name={a.name} url={a.photo_url} size={36} fontSize={13} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div className="hint-line">{supportLabel}</div></div>
                      <span className="apn-tc-available">Support</span><ChevronRight size={16} color="var(--muted)" />
                    </button>
                  );
                })}
                {!contacts.some((c) => c.contact_type === "admin" || c.contact_type === "superadmin") && !loading && <div className="hint-line">No management contacts available.</div>}
              </div>

              <details className="apn-tc-card tc-discover" open={conversations.length===0 || !!contactSearch}>
                <summary><Users size={16}/>Find partners<span>{contacts.filter(c=>c.contact_type==="partner").length}</span></summary>
                <div className="hint-line" style={{ marginBottom: 8 }}>Send a friend request to start chatting</div>

                <div className="apn-tc-partner-list">
                  {loading && <div className="hint-line" style={{ padding: 10 }}>Loading partners…</div>}
                  {!loading && contacts.filter((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())).map((c) => {
                    const action = c.relationship === "friend" ? "Chat" : c.relationship === "outgoing" ? "Pending" : c.relationship === "incoming" ? "Accept" : "Add Friend";
                    return <div key={c.contact_id} className="apn-tc-partner-row">
                      <Avatar name={c.name} url={c.photo_url} size={34} fontSize={12} />
                      <div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{c.name}</div><div className="apn-tc-partner-location">{c.apn_id || "APN partner"}{c.district ? ` · ${c.district}` : ""}</div></div>
                      <span className={`apn-tc-status ${c.availability === "online" ? "online" : "offline"}`}>{c.contact_type !== "partner" ? "Always available" : c.availability === "online" ? "Online" : `Last seen ${c.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}`}</span>
                      {c.relationship === "friend" ? <div style={{display:"flex",gap:5}}><button className="btn sm" onClick={() => openPersonChat(c)}>Chat</button><button className="btn sm" onClick={() => unfriend(c.contact_id)}>Unfriend</button></div> : c.relationship === "incoming" ? <button className="btn sm primary" onClick={() => { const r = requests.find((x) => x.other_id === c.contact_id && x.direction === "incoming" && x.status === "pending"); if (r) acceptRequest(r.request_id); }}>Accept</button> : c.relationship === "outgoing" ? <button className="btn sm" onClick={() => { const r=requests.find((x)=>String(x.other_id)===String(c.contact_id)&&x.direction==="outgoing"&&x.status==="pending"); if(r) revokeRequest(r.request_id); }}>Revoke</button> : <button className="btn sm primary" onClick={() => sendFriendRequest(c.apn_id)}>{action}</button>}
                    </div>;
                  })}
                  {!loading && !contacts.some((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())) && <div className="hint-line" style={{ padding: 10 }}>No partners found.</div>}
                </div>
              </details>

              {requests.filter((r) => r.status === "pending").length > 0 && <div className="apn-tc-card">
                <div className="apn-tc-card-title">Friend Requests</div>
                {requests.filter((r) => r.status === "pending").map((r) => <div key={r.request_id} className="apn-tc-partner-row">
                  <Avatar name={r.other_name} url={contacts.find((c) => String(c.contact_id) === String(r.other_id))?.photo_url} size={32} fontSize={11} /><div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{r.other_name}</div><div className="apn-tc-partner-location">{r.other_apn_id}</div></div>
                  {r.direction === "incoming" ? <div style={{ display: "flex", gap: 5 }}><button className="btn sm primary" disabled={busyRequests.has(r.request_id)} onClick={() => acceptRequest(r.request_id)}>Accept</button><button className="btn sm" disabled={busyRequests.has(r.request_id)} onClick={() => rejectRequest(r.request_id)}>Reject</button></div> : <button className="btn sm" disabled={busyRequests.has(r.request_id)} onClick={() => revokeRequest(r.request_id)}>Revoke</button>}
                </div>)}
              </div>}
            </aside>

            <main className="apn-tc-main">
              {selected ? (
                renderConversation()
              ) : <div className="apn-tc-main-empty"><div className="tc-welcome"><div className="tc-welcome-art" aria-hidden="true"><MessageCircle size={48}/><span>Let’s make things happen.</span><i>Great idea ✨</i></div><span className="tc-eyebrow">YOUR PEOPLE. YOUR WORKSPACE.</span><h3>Good work starts with<br/>a conversation.</h3><p>Share an update, ask a question, or celebrate a win.<br/>Choose a chat to get started.</p><div className="tc-welcome-note"><Users size={15}/>Connected through ALLBEE</div></div></div>}
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
        {selected && section !== "person" && renderConversation()}
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
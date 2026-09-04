import React from "react";

export default function Chat({ db, mutate, me, team, onRefresh, isAdmin, runtime }) {
  const { useState, useEffect, useRef, supabase, uid, Avatar, Empty, emitToast, fmtDateTime, isOnline, withinMinutes, uploadAttachment, AlertTriangle, ArrowLeft, Check, MessageCircle, MessageSquare, Paperclip, RefreshCw, Send, Trash2, X, AdminAPNChat } = runtime;
  const [chatChannel, setChatChannel] = useState("employee");
  const [apnUnread, setApnUnread] = useState(0);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const list = [...db.chat].filter((m) => !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [list.length]);
  // Realtime can lag on mobile/background tabs — gently re-pull while the chat is
  // open so new messages show up without a manual refresh.
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") onRefresh(); }, 12000);
    return () => clearInterval(t);
  }, [onRefresh]);
  const refresh = async () => { if (!onRefresh) return; setRefreshing(true); try { await onRefresh(); } finally { setTimeout(() => setRefreshing(false), 400); } };
  // Read receipts: mark messages from others as seen by me (converges once all seen).
  useEffect(() => {
    const unseen = db.chat.filter((m) => m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id));
    if (!unseen.length) return;
    const ids = new Set(unseen.map((m) => m.id));
    mutate((d) => ({ ...d, chat: d.chat.map((m) => ids.has(m.id) ? { ...m, seenBy: Array.from(new Set([...(m.seenBy || []), me.id])) } : m) }), null);
  }, [db.chat, me.id, mutate]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    setText("");
    mutate((d) => ({ ...d, chat: [...d.chat, { id: uid(), userId: me.id, userName: me.name, text: t, createdAt: Date.now() }] }), null);
  };
  const attach = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try { const up = await uploadAttachment(file); mutate((d) => ({ ...d, chat: [...d.chat, { id: uid(), userId: me.id, userName: me.name, text: "", attachment: up, createdAt: Date.now() }] }), null); }
    catch (er) { emitToast(er.message || "Upload failed.", "error"); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const onlineCount = (team || []).filter((p) => p.id !== me.id && isOnline(p)).length;
  const startEdit = (m) => { setEditId(m.id); setEditText(m.text); };
  const saveEdit = (m) => { const t = editText.trim(); if (!t) { setEditId(null); return; } mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === m.id ? { ...x, text: t, editedAt: Date.now() } : x) }), null); setEditId(null); setEditText(""); };
  // Delete = tombstone (keeps message order, works under existing chat RLS).
  // Admins can delete anyone's; everyone else only their own.
  const del = (m) => setConfirmDelete(m);
  const deleteNow = () => { if (!confirmDelete) return; mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === confirmDelete.id ? { ...x, deleted: true, text: "", attachment: null, deletedBy: me.name } : x) }), null); setConfirmDelete(null); };
  // Names of teammates who've seen one of my messages.
  const seenNames = (m) => (m.seenBy || []).filter((u) => u !== me.id).map((u) => ((team || []).find((p) => p.id === u)?.name) || "Someone").filter(Boolean);
  const employeeView = (<>
    <div className="content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
      <div className="page-head"><h3>Team chat</h3><span className="spacer" />{onlineCount > 0 && <span className="hint-line" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 10 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pos)", display: "inline-block" }} />{onlineCount} online</span>}<button className="btn sm" onClick={refresh} disabled={refreshing} title="Refresh messages"><RefreshCw size={14} className={refreshing ? "spin" : ""} />Refresh</button></div>
      <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? <Empty icon={<Send size={22} color="var(--muted)" />} title="Say hello 👋" text="This channel is shared with the whole internal team." />
          : list.map((m) => {
            const mine = m.userId === me.id;
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <div style={{ position: "relative", flex: "none" }}><Avatar name={m.userName} url={(team || []).find((p) => p.id === m.userId)?.photo_url} size={30} />{isOnline((team || []).find((p) => p.id === m.userId)) && <span title="Online" style={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", background: "var(--pos)", border: "2px solid var(--surface, #fff)" }} />}</div>
                <div style={{ maxWidth: "72%" }}>
                  {editId === m.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <textarea className="textarea" style={{ minHeight: 44 }} value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(m); } }} autoFocus />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button className="btn sm" onClick={() => { setEditId(null); setEditText(""); }}>Cancel</button><button className="btn sm primary" onClick={() => saveEdit(m)}><Check size={13} />Save</button></div>
                    </div>
                  ) : m.deleted ? (
                    <div style={{ background: "var(--surface-2)", color: "var(--muted)", padding: "9px 13px", borderRadius: 12, fontSize: 13, fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: 6 }}><X size={13} />This message was deleted</div>
                  ) : (
                    <div style={{ background: mine ? "var(--primary)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", padding: "9px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}{m.attachment && ((m.attachment.type || "").startsWith("image/")
                      ? <a href={m.attachment.url} target="_blank" rel="noreferrer"><img src={m.attachment.url} alt={m.attachment.name || ""} style={{ display: "block", maxWidth: 220, maxHeight: 220, borderRadius: 8, marginTop: m.text ? 8 : 0 }} /></a>
                      : <a href={m.attachment.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: m.text ? 8 : 0, color: mine ? "#fff" : "var(--primary)", textDecoration: "underline" }}><Paperclip size={13} />{m.attachment.name || "Attachment"}</a>)}</div>
                  )}
                  {!m.deleted && <div className="hint-line" style={{ fontSize: 11, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.userName} · {fmtDateTime(m.createdAt)}{m.editedAt ? " · edited" : ""}{mine && seenNames(m).length > 0 ? " · Seen by " + (seenNames(m).length <= 2 ? seenNames(m).join(", ") : `${seenNames(m).slice(0, 2).join(", ")} +${seenNames(m).length - 2}`) : ""}{mine && editId !== m.id && withinMinutes(m.createdAt, 5) && <button onClick={() => startEdit(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Edit</button>}{mine && editId !== m.id && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}{!mine && isAdmin && editId !== m.id && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}</div>}
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginTop: 12 }}>
        <textarea className="textarea" style={{ minHeight: 44 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message the team… (Enter to send)" />
        <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a file">{busy ? <RefreshCw size={16} className="spin" /> : <Paperclip size={16} />}</button>
        <input ref={fileRef} type="file" onChange={attach} style={{ display: "none" }} />
        <button className="btn primary" onClick={send} disabled={!text.trim()}><Send size={16} />Send</button>
      </div>
    </div>
    {confirmDelete && <Confirm title="Delete message?" body={`Delete ${confirmDelete.userId === me.id ? "your message" : `${confirmDelete.userName}'s message`} for everyone?`} onConfirm={deleteNow} onClose={() => setConfirmDelete(null)} />}
    </>
  );

  return (<>{isAdmin && <div className="content" style={{ paddingBottom: 10 }}>
    <div className="seg" style={{ maxWidth: 430 }}>
      <button className={chatChannel === "employee" ? "on" : ""} onClick={() => setChatChannel("employee")}>Employee</button>
      <button className={chatChannel === "apn" ? "on" : ""} onClick={() => setChatChannel("apn")}>APN{apnUnread > 0 && <span className="badge action-badge" style={{ marginLeft: 6 }}>{apnUnread > 99 ? "99+" : apnUnread}</span>}</button>
    </div>
  </div>}
  {isAdmin && chatChannel === "apn" ? <AdminAPNChat me={me} onUnreadChange={setApnUnread} /> : employeeView}</>);
}

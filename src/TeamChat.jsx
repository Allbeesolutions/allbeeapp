import React from "react";
import ChatProfileCard from "./ui/ChatProfileCard.jsx";
import {X} from "./icons.jsx";
import {resolveChatPerson} from "./identity/chatIdentity.js";
import ExpandableChatButton from "./ui/ExpandableChatButton.jsx";

export default function TeamChat({ db, mutate, me, members, teamId, onRefresh, runtime = {} }) {
  const { Empty, Send, Avatar, Confirm, fmtDateTime, uid, useState, useRef, useEffect, supabase, emitToast } = runtime;
  const [text, setText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [contactProfile,setContactProfile]=useState(null);
  const endRef = useRef(null);
  const list = [...(db.team_chat || [])].filter((m) => m.teamId === teamId && !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [list.length]);
  // The app-level Supabase Realtime channel already watches team_chat and
  // performs scoped reloads on actual database changes. Avoid a 12-second polling
  // loop here; it created continuous egress even when nobody was sending messages.
  useEffect(() => {
    const unseen = (db.team_chat || []).filter((m) => m.teamId === teamId && m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id));
    if (!unseen.length) return;
    supabase?.rpc("team_chat_mark_seen", { p_ids: unseen.map((m) => m.id) }).catch((e) => emitToast?.(e?.message || "Could not save chat read state.", "error"));
  }, [db.team_chat, me.id, teamId, supabase, emitToast]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    setText("");
    mutate((d) => ({ ...d, team_chat: [...(d.team_chat || []), { id: uid(), teamId, userId: me.id, userName: me.name, text: t, createdAt: Date.now() }] }), null);
  };
  const del = (m) => setConfirmDelete(m);
  const deleteNow = async () => {
    if (!confirmDelete) return;
    try {
      const { data, error } = await supabase.rpc("team_chat_delete_message", { p_id: confirmDelete.id });
      if (error) throw error;
      mutate((d) => ({ ...d, team_chat: d.team_chat.map((x) => x.id === confirmDelete.id ? data : x) }), null, { localOnly: true });
      setConfirmDelete(null);
    } catch (e) { emitToast?.(e?.message || "Could not delete message.", "error"); }
  };
  return (<>
    <div className={`chat-surface-expandable${expanded ? " chat-expanded" : ""}`} style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 360 }}>
      <div className="chat-expand-corner"><ExpandableChatButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} /></div>
      <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? <Empty icon={<Send size={22} color="var(--muted)" />} title="No messages yet" text="This chat is private to your team." />
          : list.map((m) => {
            const mine = String(m.userId) === String(me.id);
            const person=resolveChatPerson(members,{id:m.userId,name:m.userName});
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <button type="button" className="chat-avatar-profile-trigger" aria-label={`View ${person.name} profile`} onClick={()=>setContactProfile(person)}><Avatar name={person.name} url={person.photo_url} size={30}/></button>
                <div style={{ maxWidth: "72%" }}>
                  <div style={{ background: mine ? "var(--primary)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", padding: "9px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>
                  <div className="hint-line" style={{ fontSize: 11, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : person.name} · {fmtDateTime(m.createdAt)}{mine && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}</div>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginTop: 12 }}>
        <textarea className="textarea" style={{ minHeight: 44 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message your team… (Enter to send)" />
        <button className="btn primary" onClick={send} disabled={!text.trim()}><Send size={16} />Send</button>
      </div>
    </div>
    {contactProfile && <ChatProfileCard person={contactProfile} Avatar={Avatar} X={X} onClose={()=>setContactProfile(null)}/>}
    {confirmDelete && <Confirm title="Delete message?" body="Delete your message for the team?" onConfirm={deleteNow} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}

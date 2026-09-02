export default function TeamChat({ db, mutate, me, members, teamId, onRefresh, runtime = {} }) {
  const { Empty, Send, Avatar, Confirm, fmtDateTime, uid, useState, useRef, useEffect } = runtime;
  const [text, setText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const endRef = useRef(null);
  const list = [...(db.team_chat || [])].filter((m) => m.teamId === teamId && !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [list.length]);
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") onRefresh(); }, 12000);
    return () => clearInterval(t);
  }, [onRefresh]);
  useEffect(() => {
    const unseen = (db.team_chat || []).filter((m) => m.teamId === teamId && m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id));
    if (!unseen.length) return;
    const ids = new Set(unseen.map((m) => m.id));
    mutate((d) => ({ ...d, team_chat: d.team_chat.map((m) => ids.has(m.id) ? { ...m, seenBy: Array.from(new Set([...(m.seenBy || []), me.id])) } : m) }), null);
  }, [db.team_chat, me.id, teamId, mutate]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    setText("");
    mutate((d) => ({ ...d, team_chat: [...(d.team_chat || []), { id: uid(), teamId, userId: me.id, userName: me.name, text: t, createdAt: Date.now() }] }), null);
  };
  const del = (m) => setConfirmDelete(m);
  const deleteNow = () => { if (!confirmDelete) return; mutate((d) => ({ ...d, team_chat: d.team_chat.map((x) => x.id === confirmDelete.id ? { ...x, deleted: true, text: "", deletedBy: me.name } : x) }), null); setConfirmDelete(null); };
  const photo = (id) => members.find((p) => p.id === id)?.photo_url;
  return (<>
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 360 }}>
      <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? <Empty icon={<Send size={22} color="var(--muted)" />} title="No messages yet" text="This chat is private to your team." />
          : list.map((m) => {
            const mine = m.userId === me.id;
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <div style={{ flex: "none" }}><Avatar name={m.userName} url={photo(m.userId)} size={30} /></div>
                <div style={{ maxWidth: "72%" }}>
                  <div style={{ background: mine ? "var(--primary)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", padding: "9px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>
                  <div className="hint-line" style={{ fontSize: 11, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.userName} · {fmtDateTime(m.createdAt)}{mine && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}</div>
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
    {confirmDelete && <Confirm title="Delete message?" body="Delete your message for the team?" onConfirm={deleteNow} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}

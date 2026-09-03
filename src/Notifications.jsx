import React from "react";

export default function Notifications({ db, mutate, openModal, removeItem, isAdmin, me, profile, team, runtime = {} }) {
  const { useEffect, notifVisibleTo, NOTIF_AUDIENCES, ROLE_LABEL, Avatar, Empty, Bell, Users, Check, BadgeCheck, Trash2, fmtDateTime } = runtime;
  const visible = [...db.notifications].filter((n) => isAdmin || notifVisibleTo(n, profile)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const levelTone = (l) => l === "Urgent" ? "neg" : l === "Important" ? "accent" : "pri";
  const audienceLabel = (a) => {
    if (!a || a === "all") return "Everyone";
    if (a.startsWith("user:")) {
      const u = (team || []).find((x) => x.id === a.slice(5));
      return u ? "Only " + u.name : "One person";
    }
    return (NOTIF_AUDIENCES.find((x) => x[0] === a) || [a, a])[1];
  };
  const senderFor = (n) => {
    const person = (team || []).find((x) => x.id === n.senderId || x.name === n.by);
    return {
      name: n.senderName || n.by || person?.name || "Admin",
      designation: n.senderDesignation || person?.designation || ROLE_LABEL[person?.role] || "Administrator",
      avatar: n.senderAvatar || person?.photo_url || "",
    };
  };
  useEffect(() => {
    if (!me?.id) return;
    const unread = visible.filter((n) => !(n.reads || []).includes(me.id)).map((n) => n.id);
    if (!unread.length) return;
    mutate((d) => ({ ...d, notifications: d.notifications.map((x) => unread.includes(x.id)
      ? { ...x, reads: Array.from(new Set([...(x.reads || []), me.id])) } : x) }), null);
  }, [visible.length, me?.id, isAdmin]);
  const markRead = (n) => {
    if ((n.reads || []).includes(me.id)) return;
    mutate((d) => ({ ...d, notifications: d.notifications.map((x) => x.id === n.id
      ? { ...x, reads: Array.from(new Set([...(x.reads || []), me.id])) } : x) }), null);
  };
  const del = (n) => removeItem("notifications", n, { name: n.title, audit: `deleted notification "${n.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Notifications</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>}</div>
      {visible.length === 0 ? <div className="card"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text={isAdmin ? "Broadcast an update to everyone, a role, or one person — with a priority level." : "Notifications from your admins show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>} /></div>
        : <div className="notifications-list">{visible.map((n) => {
          const seen = (n.reads || []).includes(me.id);
          const sender = senderFor(n);
          return (
            <div key={n.id} className="card stat notification-card" style={{ borderLeft: `3px solid var(${n.level === "Urgent" ? "--neg" : "--primary"})`, position: "relative" }}>
              {!seen && !isAdmin && <span aria-label="Unread notification" title="Unread" style={{ position: "absolute", top: 18, right: 18, width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />}
              <div className="notification-card-inner">
                <div className="notification-avatar"><Avatar name={sender.name} url={sender.avatar} size={38} fontSize={14} /></div>
                <div className="notification-main">
                  <div className="notification-title-row"><span style={{ fontWeight: 700, fontSize: 15 }}>{n.title}</span><span className={"badge " + levelTone(n.level)}>{n.level || "General"}</span>{!seen && !isAdmin && <span className="badge pri">New</span>}</div>
                  {n.body && <div style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                  <div className="item-meta" style={{ marginTop: 8 }}><span>{sender.name}</span><span>{sender.designation}</span><span>{fmtDateTime(n.createdAt)}</span>{isAdmin && <span><Users size={12} style={{ verticalAlign: -2 }} /> {audienceLabel(n.audience)}</span>}{isAdmin && <span><Check size={12} style={{ verticalAlign: -2 }} /> {(n.reads || []).length} read</span>}</div>
                  {!isAdmin && !seen && <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => markRead(n)}><Check size={13} />Mark as read</button></div>}
                  {!isAdmin && seen && <div className="hint-line" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pos)" }}><BadgeCheck size={13} />Read</div>}
                </div>
                {isAdmin && <div className="row-actions notification-actions"><button className="iconbtn" aria-label={`Delete notification ${n.title}`} title="Delete notification" onClick={() => del(n)}><Trash2 size={18} /></button></div>}
              </div>
            </div>
          );
        })}</div>}
    </div>
  );
}

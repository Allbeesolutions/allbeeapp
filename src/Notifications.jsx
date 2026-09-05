import React, { useMemo, useState } from "react";
import { enableAllBeePush } from "./pushNotifications";

export default function Notifications({ db, mutate, openModal, removeItem, isAdmin, me, profile, team, runtime = {} }) {
  const { useEffect, notifVisibleTo, NOTIF_AUDIENCES, Search: SearchIcon, ROLE_LABEL, Avatar, Empty, Bell, Users, Check, BadgeCheck, Trash2, ArrowRight, fmtDateTime } = runtime;
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [preferences, setPreferences] = useState({ enabled: true, urgent_enabled: true, important_enabled: true, general_enabled: true });
  const [prefBusy, setPrefBusy] = useState(false);
  const [userState, setUserState] = useState({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [snoozing, setSnoozing] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushState, setPushState] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const preferenceAllows = (n) => preferences.enabled && (n.level === "Urgent" ? preferences.urgent_enabled : n.level === "Important" ? preferences.important_enabled : preferences.general_enabled);
  const visible = useMemo(() => [...db.notifications].filter((n) => {
    if (!(isAdmin || notifVisibleTo(n, profile))) return false;
    if (level !== "All" && (n.level || "General") !== level) return false;
    if (!preferenceAllows(n)) return false;
    const state = userState[n.id];
    if (state?.snoozed_until && new Date(state.snoozed_until).getTime() > nowTick) return false;
    if (onlyUnread && (userState[n.id]?.read_at ? true : (n.reads || []).includes(me?.id))) return false;
    const q = query.trim().toLowerCase();
    return !q || [n.title, n.body, n.by, n.senderName, n.audience].filter(Boolean).join(" ").toLowerCase().includes(q);
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [db.notifications, isAdmin, profile, level, onlyUnread, query, me?.id, preferences, userState, nowTick]);
  const unreadCount = useMemo(() => [...db.notifications].filter((n) => (isAdmin || notifVisibleTo(n, profile)) && !(userState[n.id]?.read_at || (!isAdmin && (n.reads || []).includes(me?.id)))).length, [db.notifications, isAdmin, profile, me?.id, userState]);
  useEffect(() => { let alive = true; runtime.supabase?.rpc("notification_preferences_get").then(({ data }) => { if (alive && data) setPreferences((p) => ({ ...p, ...data })); }).catch(() => {}); runtime.supabase?.rpc("notification_user_state_get").then(({ data }) => { if (!alive || !Array.isArray(data)) return; setUserState(Object.fromEntries(data.map((x) => [x.notification_id, x]))); }).catch(() => {}); return () => { alive = false; }; }, [me?.id]);
  useEffect(() => { const timer = window.setInterval(() => setNowTick(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const savePreferences = async (patch) => { const previous = preferences; const next = { ...preferences, ...patch }; setPreferences(next); setPrefBusy(true); try { const { data, error } = await runtime.supabase.rpc("notification_preferences_save", { p_enabled: !!next.enabled, p_urgent: !!next.urgent_enabled, p_important: !!next.important_enabled, p_general: !!next.general_enabled }); if (error) throw error; if (data) setPreferences(data); } catch (e) { setPreferences(previous); runtime.emitToast?.(e?.message || "Notification preferences could not be saved.", "error"); } finally { setPrefBusy(false); } };
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
  const markRead = async (n) => {
    if (!me?.id || isAdmin || userState[n.id]?.read_at) return;
    const previous = userState[n.id];
    setUserState((s) => ({ ...s, [n.id]: { ...(s[n.id] || {}), notification_id: n.id, read_at: new Date().toISOString() } }));
    try {
      const { error } = await runtime.supabase.rpc("notification_mark_read", { p_id: n.id });
      if (error) throw error;
    } catch (e) {
      setUserState((s) => ({ ...s, [n.id]: previous || { notification_id: n.id } }));
      runtime.emitToast?.(e?.message || "Could not mark notification as read.", "error");
    }
  };
  const del = (n) => removeItem("notifications", n, { name: n.title, audit: `deleted notification "${n.title}"` });
  const enablePush = async () => { setPushBusy(true); try { await enableAllBeePush(); setPushEnabled(true); } catch (e) { setPushEnabled(false); runtime.emitToast?.(e?.message || "Push notifications could not be enabled.", "error"); } finally { setPushBusy(false); } };
  const snooze = async (n, minutes) => { setSnoozing(n.id); const previous = userState[n.id]; try { const { data, error } = await runtime.supabase.rpc("notification_snooze", { p_id: n.id, p_minutes: minutes }); if (error) throw error; setUserState((s) => ({ ...s, [n.id]: { ...(s[n.id] || {}), notification_id: n.id, snoozed_until: data?.snoozed_until } })); setNowTick(Date.now()); } catch (e) { setUserState((s) => ({ ...s, [n.id]: previous || { notification_id: n.id } })); runtime.emitToast?.(e?.message || "Could not snooze notification.", "error"); } finally { setSnoozing(null); } };
  return (
    <div className="content">
      <div className="page-head"><h3>Notifications {unreadCount > 0 && <span className="badge pri" style={{ marginLeft: 7 }}>{unreadCount} unread</span>}</h3><span className="spacer" /><button className="btn sm" onClick={enablePush} disabled={pushBusy}>{pushBusy ? "Enabling…" : pushEnabled ? "Push enabled" : "Enable browser push"}</button>{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>}</div>
      <div className="toolbar" style={{ marginBottom: 12 }}><div className="search" style={{ flex: 1 }}><SearchIcon size={16} color="var(--muted)" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notifications…" aria-label="Search notifications" /></div><select className="select" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: "auto" }}><option>All</option><option>Urgent</option><option>Important</option><option>General</option></select><label className="tag" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />Unread only</label><details className="tag" style={{ marginLeft: "auto" }}><summary style={{ cursor: "pointer" }}>Notification preferences</summary><div style={{ position: "absolute", zIndex: 5, marginTop: 8, padding: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", display: "grid", gap: 7 }}><label><input type="checkbox" disabled={prefBusy} checked={preferences.enabled} onChange={(e) => savePreferences({ enabled: e.target.checked })} /> Notifications enabled</label><label><input type="checkbox" disabled={prefBusy || !preferences.enabled} checked={preferences.urgent_enabled} onChange={(e) => savePreferences({ urgent_enabled: e.target.checked })} /> Urgent</label><label><input type="checkbox" disabled={prefBusy || !preferences.enabled} checked={preferences.important_enabled} onChange={(e) => savePreferences({ important_enabled: e.target.checked })} /> Important</label><label><input type="checkbox" disabled={prefBusy || !preferences.enabled} checked={preferences.general_enabled} onChange={(e) => savePreferences({ general_enabled: e.target.checked })} /> General</label></div></details></div>
      {visible.length === 0 ? <div className="card"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text={isAdmin ? "Broadcast an update to everyone, a role, or one person — with a priority level." : "Notifications from your admins show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>} /></div>
        : <div className="notifications-list">{visible.map((n) => {
          const seen = isAdmin || !!userState[n.id]?.read_at || (n.reads || []).includes(me.id);
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
                  <div className="row-actions" style={{ marginTop: 10 }}><span className="tag">{n.groupKey || n.group_key || "Notification"}</span><select className="select" style={{ width: "auto" }} value="" disabled={snoozing === n.id} onChange={(e) => { const v=Number(e.target.value); if(v) snooze(n,v); }} aria-label={`Snooze ${n.title}`}><option value="">Snooze…</option><option value="15">15 min</option><option value="60">1 hour</option><option value="240">4 hours</option><option value="1440">Tomorrow</option></select></div>
                  {n.action?.route && <div style={{ marginTop: 10 }}><button className="btn sm" onClick={() => { markRead(n); openModal?.({ type: "navigate", route: n.action.route }); }}><ArrowRight size={13} />Open {n.action.label || n.action.route}</button></div>}
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

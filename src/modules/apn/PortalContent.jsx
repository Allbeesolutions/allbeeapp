import React from "react";
import { Download, FileText, Bell } from "lucide-react";
import { apnNotifVisible } from "./notifications.js";
import { apnNotificationSender } from "./admin-notifications.js";

export function APNDocuments({ db, Empty }) {
  const list = (db.apn_documents || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-section-h">Sales materials</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<FileText size={22} color="var(--muted)" />} title="No materials yet" text="Scripts, price lists, brochures and posters uploaded by admin appear here." /></div>
        : <div className="apn-list">{list.map((d) => (
          <div key={d.id} className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cmdk-ic"><FileText size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{d.title}</div><div className="hint-line" style={{ fontSize: 12 }}>{d.category || "Material"}{d.notes ? " · " + d.notes : ""}</div></div>
            <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><Download size={13} />Open</a>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── notifications ───────────────────────────────────────────────────── */

export function APNNotifications({ db, meRow, Empty, Avatar, fmtDateTime }) {
  const list = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow)).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-section-h">Notifications</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text="Training, commission and target updates will appear here." /></div>
        : <div className="apn-list">{list.map((n) => (
          <div key={n.id} className="apn-rowcard">
            {(() => { const sender = apnNotificationSender(n); return <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={sender.name} url={sender.avatar} size={26} fontSize={10} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{n.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{sender.name} · {sender.designation}</div></div>{n.level && n.level !== "General" && <span className={"badge " + (n.level === "Urgent" ? "neg" : "accent")}>{n.level}</span>}</div>; })()}
            {n.body && <div style={{ marginTop: 5, fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>{n.body}</div>}
            <div className="hint-line" style={{ fontSize: 11, marginTop: 6 }}>{fmtDateTime(n.createdAt)}</div>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── achievements ────────────────────────────────────────────────────── */

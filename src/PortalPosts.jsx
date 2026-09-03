import React, { useMemo, useState } from "react";

function PortalPosts({ db, mutate, openModal, removeItem, portalClients, runtime }) {
  const { Empty, Plus, Trash2, ExternalLink, Building2, Link2, Pencil, fmtDateTime } = runtime;
  const list = [...db.portal_posts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (p) => removeItem("portal_posts", p, { name: p.title, audit: `deleted client update "${p.title}"` });
  const statusTone = (s) => s === "Completed" ? "pos" : s === "On hold" ? "neg" : s === "Review" ? "accent" : "pri";
  return (
    <div className="content">
      <div className="page-head"><h3>Client updates</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "portalPost" })}><Plus size={16} />Post update</button></div>
      <p className="hint-line" style={{ marginTop: -4 }}>Updates you post here appear in that client's portal when they sign in.</p>
      <div className="card" style={{ marginTop: 12 }}>
        {list.length === 0 ? <Empty icon={<ExternalLink size={22} color="var(--muted)" />} title="No client updates yet" text={portalClients.length === 0 ? "No client portal accounts yet — a client signs up from the login screen (choose Client)." : "Post a status update and your client will see it in their portal."} action={portalClients.length > 0 && <button className="btn primary" onClick={() => openModal({ type: "portalPost" })}><Plus size={16} />Post update</button>} />
          : list.map((p) => (
            <div key={p.id} className="item-row">
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span className="item-title">{p.title}</span><span className={"badge " + statusTone(p.status)}>{p.status}</span></div>
                <div className="item-meta"><span><Building2 size={12} style={{ verticalAlign: -2 }} /> {p.clientName}</span><span>{fmtDateTime(p.createdAt)}</span></div>
                {p.body && <div className="sub" style={{ marginTop: 4 }}>{p.body}</div>}
                {p.meetingLink && <div style={{ marginTop: 6 }}><a className="btn sm primary" href={p.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
              </div>
              <div className="row-actions">
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "portalPost", initial: p })}><Pencil size={14} /></button>
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete update?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}


export default PortalPosts;

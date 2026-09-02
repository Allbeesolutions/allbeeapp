import React from "react";

function Rewards({ db, mutate, openModal, removeItem, me, isAdmin, team, runtime }) {
  const { Empty, fmtDate, sameMonth, sumHours, UserPlus, Clock, Check, X, Gift } = runtime;
  const all = [...db.rewards].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((r) => r.userId === me.id);
  const del = (r) => removeItem("rewards", r, { name: r.userName, audit: `removed recognition for ${r.userName}` });
  const myPoints = db.rewards.filter((r) => r.userId === me.id).reduce((s, r) => s + (Number(r.points) || 0), 0);

  // Suggested recognition this month — computed from real activity so admins can
  // award the obvious wins in one tap (PRD: top lead generator / best attendance /
  // project closer). Each leader, only when there's a clear non-zero standout.
  const month = new Date();
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role) && p.active !== false);
  const lead = (metric) => { let best = null; for (const p of staff) { const v = metric(p); if (v > 0 && (!best || v > best.v)) best = { p, v }; } return best; };
  const leadGen = lead((p) => db.leads.filter((l) => (l.ownerId === p.id || l.leadOwner === p.name) && l.stage === "Converted" && sameMonth(new Date(l.createdAt || 0).toISOString().slice(0, 10), month)).length);
  const attend = lead((p) => round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month)))));
  const closer = lead((p) => db.projects.filter((pr) => pr.stage === "Completed" && (pr.ownerName === p.name || pr.createdById === p.id)).length);
  const nominees = [
    leadGen && { p: leadGen.p, kind: "Goal smashed", points: 20, note: `Top lead generator — ${leadGen.v} converted this month`, badge: "Top lead generator", icon: <UserPlus size={13} /> },
    attend && { p: attend.p, kind: "On-time hero", points: 15, note: `Best attendance — ${attend.v}h this month`, badge: "Best attendance", icon: <Clock size={13} /> },
    closer && { p: closer.p, kind: "Star performer", points: 20, note: `Project closer — ${closer.v} completed`, badge: "Project closer", icon: <FolderKanban size={13} /> },
  ].filter(Boolean);
  const recognize = (n) => openModal({ type: "reward", initial: { userId: n.p.id, kind: n.kind, points: n.points, note: n.note, date: todayISO() } });

  return (
    <div className="content">
      <div className="page-head"><h3>Recognition & rewards</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "reward" })}><Award size={16} />Give recognition</button>}</div>
      {!isAdmin && <div className="sumrow"><div className="card"><div className="k"><Star size={14} /> Your points</div><div className="v mono">{myPoints}</div></div></div>}
      {isAdmin && nominees.length > 0 && (
        <div className="card stat" style={{ marginBottom: 14 }}>
          <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><Award size={14} /> Suggested recognition this month</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {nominees.map((n) => (
              <div key={n.badge} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="avatar" style={{ background: avatarColor(n.p.name), width: 28, height: 28, fontSize: 11 }}>{n.p.name[0]}</span>
                <span style={{ fontWeight: 600 }}>{n.p.name}</span>
                <span className="badge accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{n.icon}{n.badge}</span>
                <span className="hint-line" style={{ flex: 1, minWidth: 120, fontSize: 12 }}>{n.note}</span>
                <button className="btn sm primary" onClick={() => recognize(n)}><Award size={13} />Recognize</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {list.length === 0 ? <Empty icon={<Award size={22} color="var(--muted)" />} title={isAdmin ? "No recognition given yet" : "No recognition yet"} text={isAdmin ? "Celebrate good work — points feed the performance leaderboard." : "When an admin recognises your work, it shows up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "reward" })}><Award size={16} />Give recognition</button>} />
          : list.map((r) => (
            <div key={r.id} className="item-row">
              <div className="avatar" style={{ background: avatarColor(r.userName), width: 34, height: 34, fontSize: 14 }}>{(r.userName || "?")[0]}</div>
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span className="item-title">{r.userName}</span><span className="badge accent">{r.kind}</span><span className="badge pos">+{r.points} pts</span></div>
                {r.note && <div className="item-meta" style={{ marginTop: 4 }}>{r.note}</div>}
                <div className="item-meta"><span>{fmtDate(r.date || new Date(r.createdAt).toISOString().slice(0, 10))}</span></div>
              </div>
              {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove recognition?", body: `Remove this for ${r.userName}?`, note: "Moves to Recently deleted.", onConfirm: () => del(r) })}><Trash2 size={14} /></button></div>}
            </div>
          ))}
      </div>
    </div>
  );
}

export default Rewards;

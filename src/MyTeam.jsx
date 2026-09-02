import React from "react";

export default function MyTeam({ db, team, me, mutate, onRefresh, runtime }) {
  const { useState, todayISO, teamOfUser, Empty, Users, Avatar, isTaskAssignee, sameMonth, round2, sumHours, ROLE_LABEL, attStatus, fmtDate, attendanceFor, clockTime, ListTodo, priorityTone, assigneeText, CalendarClock, ContactButtons, TeamChat, teamRosterIds } = runtime;
  const [tab, setTab] = useState("overview");
  const [date, setDate] = useState(todayISO());
  const myTeam = teamOfUser(db.teams, me.id);
  if (!myTeam) {
    return (
      <div className="content">
        <div className="page-head"><h3>My team</h3></div>
        <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="You're not on a team yet" text="Once a super admin adds you to a team, you'll see your teammates' attendance, tasks and a private team chat here." /></div>
      </div>
    );
  }
  const amLead = myTeam.leadId === me.id;
  const members = teamRosterIds(myTeam).map((id) => team.find((p) => p.id === id)).filter(Boolean);
  const month = new Date();
  const memberStats = (p) => {
    const open = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status !== "Completed").length;
    const done = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status === "Completed").length;
    const presentDays = new Set(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month)).map((a) => a.date)).size;
    const hours = round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month))));
    return { open, done, presentDays, hours };
  };
  const teamTasks = db.tasks.filter((t) => members.some((p) => isTaskAssignee(t, p))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const TABS = [["overview", "Overview"], ["attendance", "Attendance"], ["tasks", "Tasks"], ["chat", "Team chat"]];
  return (
    <div className="content">
      <div className="page-head">
        <h3>{myTeam.name}</h3>
        <span className="badge accent">{amLead ? "You lead this team" : "Member"}</span>
        <span className="spacer" />
        <span className="hint-line">{members.length} member{members.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="toolbar"><div className="seg">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div></div>
      {tab === "overview" && (
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {members.map((p) => {
            const s = memberStats(p);
            const att = attStatus(db, p.id, todayISO());
            return (
              <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="who-cell">
                  <Avatar name={p.name} url={p.photo_url} size={32} />
                  <span style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{p.name}{p.id === myTeam.leadId ? <span className="badge accent" style={{ marginLeft: 6 }}>Lead</span> : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[p.role] || p.role}</div></span>
                  <span className={"badge " + att.tone}>{att.label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Open tasks</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.open}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Completed</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.done}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Days present</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.presentDays}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Hours (mo)</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.hours}</div></div>
                </div>
                {p.id !== me.id && <div><ContactButtons person={p} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "attendance" && (
        <div className="card">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Attendance</span>
            <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Member</th><th>{fmtDate(date)}</th><th>Check in</th><th>Check out</th><th className="num-cell">Days this month</th></tr></thead>
              <tbody>{members.map((p) => {
                const st = attStatus(db, p.id, date);
                const a = attendanceFor(db, p.id, date);
                const presentDays = new Set(db.attendance.filter((x) => x.userId === p.id && sameMonth(x.date, month)).map((x) => x.date)).size;
                return (
                  <tr key={p.id}>
                    <td><span className="who-cell"><Avatar name={p.name} url={p.photo_url} size={26} /><span style={{ fontWeight: 600 }}>{p.name}</span></span></td>
                    <td><span className={"badge " + st.tone}>{st.label}</span></td>
                    <td className="mono">{a ? clockTime(a.checkIn) : "—"}</td>
                    <td className="mono">{a && a.checkOut ? clockTime(a.checkOut) : "—"}</td>
                    <td className="num-cell mono">{presentDays}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="card">
          {teamTasks.length === 0 ? <Empty icon={<ListTodo size={22} color="var(--muted)" />} title="No tasks for the team yet" text="Tasks assigned to anyone on the team show up here." />
            : teamTasks.map((t) => (
              <div key={t.id} className="item-row">
                <div className="item-main">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    {t.num != null && <span className="badge mono" style={{ fontWeight: 700 }}>#{t.num}</span>}
                    <span className="item-title">{t.title}</span>
                    <span className={"badge " + (t.status === "Completed" ? "pos" : t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
                    {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
                  </div>
                  <div className="item-meta" style={{ marginTop: 6 }}>
                    <span>{t.assignedBy} → <b>{assigneeText(t)}</b></span>
                    {t.due && <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {fmtDate(t.due)}</span>}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "chat" && <TeamChat db={db} mutate={mutate} me={me} members={members} teamId={myTeam.id} onRefresh={onRefresh} />}
    </div>
  );
}

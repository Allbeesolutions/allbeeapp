import React from "react";

function Performance({ db, team, runtime }) {
  const { Empty, money, sameMonth, sumHours, isTaskAssignee, ROLE_LABEL } = runtime;
  const month = new Date();
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role) && p.active !== false);
  const rows = staff.map((p) => {
    const done = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status === "Completed").length;
    const open = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status !== "Completed").length;
    const myLeads = db.leads.filter((l) => l.ownerId === p.id || l.leadOwner === p.name);
    const leadsGen = myLeads.length;
    const leadsWon = myLeads.filter((l) => l.stage === "Converted").length;
    const hours = round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month))));
    const updateDays = new Set(db.updates.filter((u) => u.userId === p.id && sameMonth(u.date, month)).map((u) => u.date)).size;
    const points = db.rewards.filter((r) => r.userId === p.id).reduce((s, r) => s + (Number(r.points) || 0), 0);
    const score = done * 10 + leadsWon * 15 + Math.round(hours) + updateDays * 3 + points;
    return { p, done, open, leadsGen, leadsWon, hours, updateDays, points, score };
  }).sort((a, b) => b.score - a.score);
  const medal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
  return (
    <div className="content">
      <div className="page-head"><h3>Performance</h3></div>
      <div className="sumrow" style={{ marginBottom: 14 }}>
        <div className="card"><div className="k"><TrendingUp size={14} /> Revenue this month</div><div className="v mono">{money(db.transactions.filter((t) => t.kind === "income" && sameMonth(t.date, month)).reduce((s, t) => s + (Number(t.amount) || 0), 0))}</div></div>
        <div className="card"><div className="k"><UserPlus size={14} /> Leads this month</div><div className="v mono">{db.leads.filter((l) => sameMonth(new Date(l.createdAt || 0).toISOString().slice(0, 10), month)).length}</div></div>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty icon={<TrendingUp size={22} color="var(--muted)" />} title="No team data yet" text="As people complete tasks, check in and earn recognition, the leaderboard fills up." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>#</th><th>Member</th><th className="num-cell">Tasks</th><th className="num-cell">Leads</th><th className="num-cell">Won</th><th className="num-cell">Hours</th><th className="num-cell">Updates</th><th className="num-cell">Points</th><th className="num-cell">Score</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.p.id}>
                <td style={{ fontSize: 16 }}>{medal(i)}</td>
                <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(r.p.name), width: 26, height: 26, fontSize: 11 }}>{r.p.name[0]}</span><span><div style={{ fontWeight: 600 }}>{r.p.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[r.p.role]}</div></span></span></td>
                <td className="num-cell mono">{r.done}</td><td className="num-cell mono">{r.leadsGen}</td><td className="num-cell mono">{r.leadsWon}</td><td className="num-cell mono">{r.hours}</td><td className="num-cell mono">{r.updateDays}</td><td className="num-cell mono">{r.points}</td>
                <td className="num-cell mono" style={{ fontWeight: 700 }}>{r.score}</td>
              </tr>
            ))}</tbody>
          </table></div>}
        <div className="hint-line" style={{ padding: "12px 16px" }}>Score = tasks completed ×10 + days present this month ×2 + recognition points.</div>
      </div>
    </div>
  );
}

export default Performance;

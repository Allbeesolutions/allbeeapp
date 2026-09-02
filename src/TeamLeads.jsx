import React from "react";

function TeamLeads({ team, db, openModal, removeItem, me, runtime }) {
  const { Empty, Avatar, Users, Plus, ShieldCheck, Pencil, Trash2, ROLE_LABEL, teamRosterIds } = runtime;
  const teams = [...(db.teams || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const roster = team.filter((p) => p.role !== "client" && p.active !== false);
  const byId = (id) => team.find((p) => p.id === id);
  const del = (t) => removeItem("teams", t, { name: t.name, audit: `deleted team "${t.name}"` });
  const assigned = new Set(teams.flatMap((t) => teamRosterIds(t)));
  const unassigned = roster.filter((p) => !assigned.has(p.id) && p.role !== "superadmin");
  return (
    <div className="content">
      <div className="page-head"><h3>Team leads</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "teamcfg" })}><Plus size={16} />New team</button></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><ShieldCheck size={15} /> Group people under a team lead. Leads (and their members) get a My team screen with the team's attendance, tasks, performance and a private team chat.</div>
      {teams.length === 0 ? <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="No teams yet" text="Create a team, pick a lead, and assign the members who report to them." action={<button className="btn primary" onClick={() => openModal({ type: "teamcfg" })}><Plus size={16} />New team</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
          {teams.map((t) => {
            const members = (t.memberIds || []).map(byId).filter(Boolean);
            const lead = byId(t.leadId);
            return (
              <div key={t.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div><div className="sub">{members.length + 1} member{members.length ? "s" : ""}</div></div>
                  <div className="row-actions">
                    <button className="iconbtn" style={{ width: 30, height: 30 }} title="Edit" onClick={() => openModal({ type: "teamcfg", initial: t })}><Pencil size={14} /></button>
                    <button className="iconbtn" style={{ width: 30, height: 30 }} title="Delete" onClick={() => openModal({ type: "deleteConfirm", title: "Delete team?", body: `Delete "${t.name}"?`, note: "Members keep their accounts — only the grouping is removed.", onConfirm: () => del(t) })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div>
                  <div className="hint-line" style={{ marginBottom: 6 }}>Team lead</div>
                  <span className="who-cell"><Avatar name={lead?.name || "?"} url={lead?.photo_url} size={28} /><span><div style={{ fontWeight: 600 }}>{lead?.name || "—"} <span className="badge accent" style={{ marginLeft: 4 }}>Lead</span></div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[lead?.role] || ""}</div></span></span>
                </div>
                <div>
                  <div className="hint-line" style={{ marginBottom: 6 }}>Members</div>
                  {members.length === 0 ? <div className="hint-line">No members yet.</div>
                    : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{members.map((m) => <span key={m.id} className="who-cell" style={{ background: "var(--surface-2)", borderRadius: 999, padding: "3px 10px 3px 3px" }}><Avatar name={m.name} url={m.photo_url} size={22} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span></span>)}</div>}
                </div>
              </div>
            );
          })}
        </div>}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>Not on a team yet ({unassigned.length})</div>
          <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>{unassigned.map((p) => <span key={p.id} className="who-cell"><Avatar name={p.name} url={p.photo_url} size={22} /><span style={{ fontSize: 12.5 }}>{p.name}</span></span>)}</div>
        </div>
      )}
    </div>
  );
}

export default TeamLeads;

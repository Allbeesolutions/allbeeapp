import React, { useState } from "react";
import { Check, AlertTriangle, Users } from "./icons.jsx";

export default function StaffSalary(props) {
  const { db, team, mutate, me } = props;
  const { money, fmtDate, Modal, Field, Empty, Avatar, emitToast, ROLE_LABEL, Banknote, Coins, Gift, SalaryRow, staffEarnings, uid } = props.runtime || {};
  const roster = team.filter((p) => p.role !== "client" && p.role !== "superadmin");
  const setPay = (person, patch, action) => mutate((d) => {
    const exists = (d.payroll || []).some((r) => r.userId === person.id);
    const payroll = exists
      ? d.payroll.map((r) => r.userId === person.id ? { ...r, ...patch, updatedAt: Date.now() } : r)
      : [...(d.payroll || []), { id: uid(), userId: person.id, userName: person.name, fixedMonthly: 0, commissionPct: 0, createdAt: Date.now(), ...patch }];
    return { ...d, payroll };
  }, { action: action || `updated ${person.name}'s pay settings`, module: "Staff salary" });
  const totalCommission = roster.reduce((s, p) => s + staffEarnings(db, db.payroll, { id: p.id, name: p.name }, p.created_at).realisedComm, 0);
  const totalMonthly = (db.payroll || []).reduce((s, r) => s + (Number(r.fixedMonthly) || 0), 0);
  const totalIncentives = (db.payroll || []).reduce((s, r) => s + (Array.isArray(r.incentives) ? r.incentives.reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0), 0);
  return (
    <div className="content">
      <div className="page-head"><h3>Staff salary</h3></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><Coins size={15} /> Set each person's fixed monthly salary, a commission rate, or both — and add one-off incentives (bonuses) any time. Commission is a share of the value of every student, project or client they bring in.</div>
      <div className="sumrow">
        <div className="card"><div className="k"><Users size={14} /> People</div><div className="v">{roster.length}</div></div>
        <div className="card"><div className="k"><Banknote size={14} /> Monthly salaries</div><div className="v mono">{money(totalMonthly)}</div></div>
        <div className="card"><div className="k"><Coins size={14} /> Commission earned</div><div className="v mono">{money(totalCommission)}</div></div>
        <div className="card"><div className="k"><Gift size={14} /> Incentives paid</div><div className="v mono">{money(totalIncentives)}</div></div>
      </div>
      {roster.length === 0 ? <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="No team members yet" text="Add staff on the Team screen, then set their pay here." /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {roster.map((p) => <SalaryRow key={p.id} person={p} db={db} payroll={db.payroll} onSave={setPay} />)}
        </div>}
      <div className="hint-line" style={{ marginTop: 14, lineHeight: 1.5 }}>
        Commission is "earned" once an item is actually paying — a student fee marked Paid, a project marked Completed, or a client set to Active. Until then it sits in the pipeline. Everyone can see their own breakdown on the My earnings screen.
      </div>
    </div>
  );
}

/* ── My earnings (every member sees their own) ─────────────────────────── */
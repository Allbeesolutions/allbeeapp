import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Courses(props) {
  const {  db, mutate, openModal, openIncome, removeItem, canFinance  } = props;
  const { Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts } = props.runtime || {};
  const { GraduationCap, Pencil, Plus, Sheet, Trash2 } = Icons;

  const list = [...db.students].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (s) => removeItem("students", s, { name: s.name, audit: `removed student ${s.name}` });
  return (
    <div className="content">
      <div className="page-head"><h3>Courses & students</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "student" })}><Plus size={16} />New student</button></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<GraduationCap size={22} color="var(--muted)" />} title="No students yet" text="Register students and record their fees — paid fees flow straight into Accounts." action={<button className="btn primary" onClick={() => openModal({ type: "student" })}><Plus size={16} />New student</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Student</th><th>Course</th><th>Joined</th><th className="num-cell">Fee</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id}>
                <td><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone}</div></td>
                <td>{s.course || "—"}</td><td className="mono">{fmtDate(s.joinDate)}</td>
                <td className="num-cell mono">{money(s.fee)}</td>
                <td><span className={"badge " + (s.paymentStatus === "Paid" ? "pos" : s.paymentStatus === "Partial" ? "accent" : "neg")}>{s.paymentStatus}</span></td>
                <td><div className="row-actions">
                  {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: s.name, project: s.course || "Course fee", amount: s.fee, category: "Course", source: { kind: "student", id: s.id } })}>Record fee</button>}
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "student", initial: s })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove student?", body: `Remove ${s.name}?`, note: "They move to Recently deleted — restore within 60 days.", onConfirm: () => del(s) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

/* ── Class students (training institute roster) — admin/superadmin only ─────
   Own module, own table (class_students). Import from an existing Excel/CSV/
   Google Sheet, export back out any time, and — if a Google Sheet webhook is
   connected — every add/edit is mirrored into that sheet automatically. */
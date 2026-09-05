import React, { useState, useMemo, useEffect } from "react";
import * as Icons from "./icons.jsx";

export default function Attendance(props) {
  const {  db, mutate, me, isAdmin, isSuper, team, openModal  } = props;
  const { Empty, Team, attStatus, attendanceFor, avatarColor, clockTime, fmtDate, haptic, hoursBetween, onApprovedLeave, sameMonth, startOfWeek, sumHours, todayISO, uid, AttendanceEditModal, useState, Modal, Field, Trash2, emitToast } = props.runtime || {};
  const { CalendarDays, Check, CheckCircle2, Clock, LogIn, Pencil, Plane, UserCheck, Users, XCircle } = Icons;

  const today = todayISO();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(null); // super-admin attendance edit: { p, a }

  // ── Personal attendance — available to EVERYONE, admins included, so a
  // partner/admin can check themselves in and out just like the rest of the team.
  const mineAll = db.attendance.filter((a) => a.userId === me.id);
  const todays = mineAll.filter((a) => a.date === today);
  const openSess = todays.find((a) => !a.checkOut);
  const leaveToday = onApprovedLeave(db, me.id, today);
  const mine = [...mineAll].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  const weekStart = startOfWeek();
  const todayH = sumHours(todays);
  const weekH = sumHours(mineAll.filter((a) => new Date(a.date + "T00:00:00") >= weekStart));
  const monthH = sumHours(mineAll.filter((a) => sameMonth(a.date)));
  const doCheckIn = () => mutate((d) => ({ ...d, attendance: [...d.attendance, { id: uid(), userId: me.id, userName: me.name, date: today, checkIn: new Date().toISOString(), checkOut: null, createdAt: Date.now() }] }), { action: "checked in", module: "Attendance" });
  const doCheckOut = () => { if (!openSess) return; mutate((d) => ({ ...d, attendance: d.attendance.map((a) => a.id === openSess.id ? { ...a, checkOut: new Date().toISOString() } : a) }), { action: "checked out", module: "Attendance" }); };
  const checkIn = () => openModal({ type: "okConfirm", title: "Check in?", body: "Type OK to confirm your check-in.", actionLabel: "Check in", icon: <LogIn size={15} />, onConfirm: () => { haptic(12); doCheckIn(); } });
  const checkOut = () => openModal({ type: "okConfirm", title: "Check out?", body: "Type OK to confirm your check-out.", actionLabel: "Check out", icon: <CheckCircle2 size={15} />, onConfirm: () => { haptic(12); doCheckOut(); } });

  const myCheckInCard = (
    <div className="card stat" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="lbl"><Clock size={14} /> {fmtDate(today)}{isAdmin ? " · You" : ""}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
          {leaveToday ? "You're on approved leave today" : openSess ? `Checked in at ${clockTime(openSess.checkIn)}` : todays.length ? `${todays.length} session${todays.length > 1 ? "s" : ""} · ${todayH.toFixed(1)}h today` : "Not checked in yet"}
        </div>
      </div>
      {!leaveToday && !openSess && <button className="btn primary" onClick={checkIn}><LogIn size={16} />Check in</button>}
      {!leaveToday && openSess && <button className="btn primary" onClick={checkOut}><CheckCircle2 size={16} />Check out</button>}
    </div>
  );

  const myStatsRow = (
    <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", marginBottom: 16 }}>
      <div className="card stat"><div className="lbl"><Clock size={14} /> Today</div><div className="num">{todayH.toFixed(1)}h</div></div>
      <div className="card stat"><div className="lbl"><CalendarDays size={14} /> This week</div><div className="num">{weekH.toFixed(1)}h</div></div>
      <div className="card stat"><div className="lbl"><CalendarDays size={14} /> This month</div><div className="num">{monthH.toFixed(1)}h</div></div>
    </div>
  );

  const myRecentCard = (
    <div className="card">
      <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>My recent attendance</div>
      {mine.length === 0 ? <Empty icon={<UserCheck size={22} color="var(--muted)" />} title="No records yet" text="Check in each day and your history builds up here." /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th className="num-cell">Hours</th></tr></thead>
            <tbody>{mine.map((a) => (
              <tr key={a.id}><td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
                <td className="mono">{clockTime(a.checkIn)}</td><td className="mono">{clockTime(a.checkOut)}</td>
                <td className="num-cell mono">{a.checkOut ? hoursBetween(a.checkIn, a.checkOut)?.toFixed(1) : "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="content">
        <div className="page-head"><h3>Attendance</h3></div>
        {myCheckInCard}
        {myStatsRow}
        {myRecentCard}
      </div>
    );
  }

  // admin roster — only real, active team members (no client portal accounts,
  // no suspended/resigned/terminated people).
  const roster = team
    .filter((p) => p.role !== "client" && p.active !== false)
    .map((p) => ({ p, a: attendanceFor(db, p.id, date), st: attStatus(db, p.id, date) }));
  const present = roster.filter((r) => r.st.label === "Present" || r.st.label === "Checked out").length;
  const onLeave = roster.filter((r) => r.st.label === "On leave").length;
  const absent = roster.filter((r) => r.st.label === "Absent").length;
  // Super-admins can correct or fill in attendance for any member on the chosen
  // date: editing the matching record if there is one, otherwise creating it.
  const saveAttendance = (member, record, checkInISO, checkOutISO) => {
    mutate((d) => record
      ? { ...d, attendance: d.attendance.map((x) => x.id === record.id ? { ...x, checkIn: checkInISO, checkOut: checkOutISO } : x) }
      : { ...d, attendance: [...d.attendance, { id: uid(), userId: member.id, userName: member.name, date, checkIn: checkInISO, checkOut: checkOutISO, createdAt: Date.now() }] },
      { action: `edited ${member.name}'s attendance for ${fmtDate(date)}`, module: "Attendance" });
    setEditing(null);
  };
  // Mark absent: drop every session that member has on the chosen date.
  const clearAttendance = (member) => {
    mutate((d) => ({ ...d, attendance: d.attendance.filter((x) => !(x.userId === member.id && x.date === date)) }),
      { action: `cleared ${member.name}'s attendance for ${fmtDate(date)}`, module: "Attendance" });
    setEditing(null);
  };
  return (
    <div className="content">
      <div className="page-head"><h3>Attendance</h3><span className="spacer" />
        <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} /></div>
      {/* Admins & partners mark their own attendance too */}
      {myCheckInCard}
      <div className="lbl" style={{ margin: "4px 2px 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
        <Users size={14} /> Team · {fmtDate(date)}
      </div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="card stat"><div className="lbl"><UserCheck size={14} /> Present</div><div className="num pos-txt">{present}</div></div>
        <div className="card stat"><div className="lbl"><Plane size={14} /> On leave</div><div className="num">{onLeave}</div></div>
        <div className="card stat"><div className="lbl"><XCircle size={14} /> Absent</div><div className="num neg-txt">{absent}</div></div>
      </div>
      <div className="card">
        {roster.length === 0 ? <Empty icon={<Users size={22} color="var(--muted)" />} title="No team members yet" text="Staff who create accounts will appear here." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Member</th><th>Status</th><th>In</th><th>Out</th><th className="num-cell">Hours</th>{isSuper && <th></th>}</tr></thead>
              <tbody>{roster.map(({ p, a, st }) => (
                <tr key={p.id}>
                  <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(p.name), width: 24, height: 24, fontSize: 10 }}>{p.name[0]}</span>{p.name}</span></td>
                  <td><span className={"badge " + (st.tone === "muted" ? "" : st.tone)} style={st.tone === "muted" ? { background: "var(--surface-2)", color: "var(--muted)" } : undefined}>{st.label}</span></td>
                  <td className="mono">{clockTime(a?.checkIn)}</td><td className="mono">{clockTime(a?.checkOut)}</td>
                  <td className="num-cell mono">{a?.checkOut ? hoursBetween(a.checkIn, a.checkOut)?.toFixed(1) : "—"}</td>
                  {isSuper && <td><div className="row-actions"><button className="btn sm" onClick={() => setEditing({ p, a })}><Pencil size={13} />Edit</button></div></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading editor…</div></div>}><AttendanceEditModal member={editing.p} record={editing.a} date={date}
        onClose={() => setEditing(null)}
        onSave={(ci, co) => saveAttendance(editing.p, editing.a, ci, co)}
        onClear={() => clearAttendance(editing.p)} runtime={{ useState, Modal, Field, Check, Trash2, emitToast, fmtDate }} /></React.Suspense>}
    </div>
  );
}

// Super-admin: set/correct a member's check-in & check-out for one date. Times
// are entered and shown in local time; an empty check-out means still on the clock.
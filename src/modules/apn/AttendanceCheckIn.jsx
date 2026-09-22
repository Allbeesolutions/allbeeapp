import React, { useState } from "react";
import { Check, UserCheck } from "lucide-react";
import { todayISO, localISODate } from "../../utils/dateFormat.js";
import { apnCheckedInToday, apnAttendanceStreak } from "./attendance.js";

export function APNCheckIn({ db, pid, mutate, haptic: hapticFn }) {
  const [step, setStep] = useState("idle");
  const [word, setWord] = useState("");
  const done = apnCheckedInToday(db, pid, todayISO);
  const streak = apnAttendanceStreak(db, pid, localISODate);
  const check = () => {
    if (word.trim().toUpperCase() !== "OK") return;
    hapticFn?.([10, 30, 10]);
    mutate((d) => ({
      ...d,
      apn_attendance: [...(d.apn_attendance || []), { id: uid(), partnerId: pid, date: todayISO(), at: Date.now() }],
      apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, lastCheckIn: Date.now() } : u),
    }), { action: "checked in for APN attendance", module: "APN", entity: "APN Attendance", entityId: todayISO(), partnerId: pid });
    setStep("idle"); setWord("");
  };
  return (
    <div className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><UserCheck size={16} color={done ? "var(--pos)" : "var(--muted)"} />Daily attendance</div>
        <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>{done ? `Checked in today · ${streak}-day streak` : "Check in daily to stay active. 30 days missed = inactive."}</div>
      </div>
      {done ? <span className="badge pos">Present</span>
        : step === "idle" ? <button className="btn primary" onClick={() => setStep("typing")}><UserCheck size={15} />Check in</button>
          : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
              <input className="input" autoFocus value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") check(); }} placeholder='Type "OK" to confirm' style={{ flex: 1 }} />
              <button className="btn primary" onClick={check} disabled={word.trim().toUpperCase() !== "OK"}><Check size={15} />Confirm</button>
            </div>
          )}
    </div>
  );
}

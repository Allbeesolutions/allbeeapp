import React, { useState } from "react";
import { Check, Hourglass, LogOut, Pencil, RefreshCw } from "lucide-react";

export function APNInactive({ meRow, db, mutate, onSignOut, isDark, pid, Field }) {
  const [f, setF] = useState(() => ({ mobile: meRow.mobile || "", email: meRow.email || "", address: meRow.address || "" }));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const recommend = () => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, reactivationRequested: Date.now() } : u) }), null);
  const saveContact = () => {
    setErr(""); setSaved(false);
    if (f.mobile.replace(/\D/g, "").length < 7) return setErr("Enter a valid mobile number.");
    if (!f.email.trim()) return setErr("Enter an email address.");
    mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, mobile: f.mobile.trim(), email: f.email.trim(), address: f.address.trim(), updatedAt: Date.now() } : u) }), { action: "updated contact details while inactive", module: "APN", partnerId: pid });
    setSaved(true);
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>

      <div className="lock-card gate-card" style={{ width: "min(92vw, 480px)" }}>
        <div className="lock-badge" style={{ background: "linear-gradient(135deg,var(--accent),#d98c00)" }}><Hourglass size={26} /></div>
        <h1>Account inactive</h1>
        <p>You've been marked inactive due to 30 days without attendance. Only an admin can reactivate your account — your district head can recommend it. Keep your contact details current so we can reach you.</p>
        {meRow.reactivationRequested ? <div className="auth-msg ok"><Check size={14} />Reactivation requested — waiting on approval.</div>
          : <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={recommend}><RefreshCw size={15} />Request reactivation</button>}
        <div className="apn-rowcard" style={{ marginTop: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="lbl"><Pencil size={14} /> Self-serve contact details</div>
          <div className="grid2" style={{ marginTop: 8 }}><Field label="Mobile number"><input className="input" value={f.mobile} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, mobile: e.target.value })); }} /></Field><Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, email: e.target.value })); }} /></Field></div>
          <Field label="Full address"><textarea className="textarea" value={f.address} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, address: e.target.value })); }} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn primary" onClick={saveContact}><Check size={14} />Save details</button></div>
          {err && <div className="auth-msg err">{err}</div>}{saved && <div className="auth-msg ok"><Check size={14} />Contact details saved.</div>}
        </div>
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}

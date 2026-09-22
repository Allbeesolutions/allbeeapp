import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

export function APNBankDetails({ db, pid, reload, supabase, Field }) {
  const existing = (db.apn_withdrawal_bank_accounts || []).find((row) => row.partner_id === pid);
  const [f, setF] = useState(() => ({ accountHolder: existing?.account_holder || "", bankName: existing?.bank_name || "", accountNumber: existing?.account_number || "", confirmAccountNumber: existing?.account_number || "", ifsc: existing?.ifsc || "", upiId: existing?.upi_id || "", branch: existing?.branch || "" }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  useEffect(() => setF({ accountHolder: existing?.account_holder || "", bankName: existing?.bank_name || "", accountNumber: existing?.account_number || "", confirmAccountNumber: existing?.account_number || "", ifsc: existing?.ifsc || "", upiId: existing?.upi_id || "", branch: existing?.branch || "" }), [existing?.id, existing?.updated_at]);
  const set = (key, value) => { setMessage(null); setF((prev) => ({ ...prev, [key]: value })); };
  const save = async () => {
    setMessage(null);
    if (f.accountNumber && f.accountNumber !== f.confirmAccountNumber) return setMessage({ type: "err", text: "Account number confirmation does not match." });
    setBusy(true);
    try {
      const { error } = await supabase.rpc("apn_upsert_withdrawal_bank_account", { p_partner_id: pid, p_account_holder: f.accountHolder.trim() || null, p_bank_name: f.bankName.trim() || null, p_account_number: f.accountNumber.trim() || null, p_confirm_account_number: f.confirmAccountNumber.trim() || null, p_ifsc: f.ifsc.trim() || null, p_upi_id: f.upiId.trim() || null, p_branch: f.branch.trim() || null });
      if (error) throw error;
      setMessage({ type: "ok", text: "Payout details saved. Verification is pending." }); await reload?.();
    } catch (err) { setMessage({ type: "err", text: err?.message || "Couldn’t save payout details." }); }
    finally { setBusy(false); }
  };
  return <div className="apn-rowcard" style={{ marginTop: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><Building2 size={16} color="var(--primary)" /><div style={{ fontWeight: 800, flex: 1 }}>Bank details</div>{existing && <span className={`badge ${existing.verification_status === "verified" ? "pos" : existing.verification_status === "rejected" ? "neg" : "pri"}`}>{existing.verification_status}</span>}</div><div className="hint-line" style={{ marginBottom: 12 }}>Use either UPI or complete bank-transfer details. Every change is recorded in the financial audit log.</div><div className="grid2"><Field label="Account holder"><input className="input" value={f.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} /></Field><Field label="Bank name"><input className="input" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field></div><div className="grid2"><Field label="Account number"><input className="input mono" inputMode="numeric" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field><Field label="Confirm account number"><input className="input mono" inputMode="numeric" value={f.confirmAccountNumber} onChange={(e) => set("confirmAccountNumber", e.target.value)} /></Field></div><div className="grid2"><Field label="IFSC"><input className="input mono" value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} /></Field><Field label="Branch"><input className="input" value={f.branch} onChange={(e) => set("branch", e.target.value)} /></Field></div><Field label="UPI ID"><input className="input" value={f.upiId} onChange={(e) => set("upiId", e.target.value.toLowerCase())} placeholder="name@bank" /></Field><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}><button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save payout details"}</button></div>{message && <div className={`auth-msg ${message.type === "ok" ? "ok" : "err"}`} style={{ marginTop: 10 }}>{message.text}</div>}</div>;
}

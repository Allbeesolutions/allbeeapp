import React, { useEffect, useState } from "react";
import { AlertTriangle, MessageCircle } from "lucide-react";

export function APNSupportTickets({ pid, refreshTick = 0, supabase, APNStatusBadge, fmtDateTime }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("apn_support_tickets_list", { p_limit: 100 });
      if (error) { setErr(error.message); return; }
      setRows(Array.isArray(data) ? data : []);
    })();
  }, [pid, refreshTick, supabase]);

  return (
    <div className="apn-ai">
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={16} color="var(--primary)" /><div style={{ fontWeight: 800, flex: 1 }}>My support tickets</div></div>
        <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Official responses here are final — ALLBEE AI explains them, never overrides them.</div>
      </div>
      {err && <div className="banner" style={{ marginBottom: 12, borderColor: "var(--neg)" }}><AlertTriangle size={15} />{err}</div>}
      {!rows ? <div className="hint-line" style={{ padding: "16px 4px" }}>Loading tickets…</div>
        : rows.length === 0 ? <div className="apn-rowcard"><div className="hint-line" style={{ padding: "12px 4px", fontSize: 13 }}>You don't have any support tickets yet. Ask ALLBEE AI anything — if it can't find the answer, it will offer to create one for you.</div></div>
          : rows.map((t) => (
            <div key={t.id} className="apn-rowcard" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{t.ticket_no}</span>
                <span className="badge">{t.category}</span>
                <APNStatusBadge status={t.status} />
                <span className="hint-line" style={{ marginLeft: "auto", fontSize: 11 }}>{fmtDateTime(t.created_at)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13.5 }}>{t.question}</div>
              {t.ai_summary && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>AI summary: {String(t.ai_summary).slice(0, 220)}{t.ai_summary.length > 220 ? "…" : ""}</div>}
              {(t.admin_response || t.superadmin_response) && (
                <div style={{ marginTop: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Official response — {t.superadmin_response ? "Super Admin" : "Admin"}{t.admin_responded_at && <span className="hint-line" style={{ fontWeight: 500, marginLeft: 8 }}>{fmtDateTime(t.admin_responded_at)}</span>}</div>
                  <div style={{ fontSize: 13 }}>{t.superadmin_response || t.admin_response}</div>
                </div>
              )}
            </div>
          ))}
    </div>
  );
}

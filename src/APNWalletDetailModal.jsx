export default function APNWalletDetailModal({ detail, onClose, onEntryClick, runtime }) {
  const { Empty, Coins, fmtDate, fmtDateTime, money } = runtime;
  const safeFmtDate = fmtDate || ((value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); });
  const safeFmtDateTime = fmtDateTime || ((value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); });
  const safeMoney = money || ((value) => `₹${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  if (!detail) return null;
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="apn-rowcard" style={{ width: "min(760px, 96vw)", maxHeight: "82vh", overflow: "auto", padding: 0, background: "var(--surface, #fff)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{detail.title}</div><div className="hint-line" style={{ marginTop: 3 }}>Live commission-engine breakdown</div></div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>{detail.value}</div>
        <button className="btn" onClick={onClose} aria-label="Close details">Close</button>
      </div>
      {detail.note && <div className="banner" style={{ margin: 12 }}>{detail.note}</div>}
      {detail.entry && <div style={{ padding: "0 12px 12px" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface-2, var(--surface, #fff))" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Source APN partner</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--primary-soft, rgba(14,165,233,.10))", fontWeight: 800 }}>{String(detail.entry.sourcePartnerName || "A").trim().slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 750 }}>{detail.entry.sourcePartnerName || "APN partner"}</div><div className="hint-line" style={{ marginTop: 2 }}>{detail.entry.sourceApnId !== "—" ? detail.entry.sourceApnId : detail.entry.sourcePartnerId || "Partner ID unavailable"} · {String(detail.entry.sourcePartnerRole || "partner").replace(/_/g, " ")}</div></div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 10 }}>
          {[['Project', detail.entry.projectName], ['Client', detail.entry.clientName], ['Revenue collected', safeMoney(detail.entry.collectionAmount)], ['Collection date', detail.entry.collectionDate ? safeFmtDateTime(detail.entry.collectionDate) : "—"], ['Commission earned', safeMoney(detail.entry.commissionAmount)], ['Commission rate', detail.entry.rate != null ? `${detail.entry.rate}%` : "—"], ['Project value', detail.entry.projectValue ? safeMoney(detail.entry.projectValue) : "—"], ['Project commission rate', detail.entry.projectCommissionRate != null ? `${detail.entry.projectCommissionRate}%` : "—"], ['Collection ID', detail.entry.collectionId || "—"], ['Project ID', detail.entry.projectId || "—"], ['District', detail.entry.district || "—"], ['State', detail.entry.state || "—"]].map(([label,value]) => <div key={label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>{label}</div><div style={{ fontWeight: 650, marginTop: 3, wordBreak: "break-word" }}>{value}</div></div>)}
        </div>
        <div className="hint-line" style={{ marginTop: 10, fontSize: 11 }}>Ledger event: {detail.entry.eventAt ? safeFmtDateTime(detail.entry.eventAt) : "—"} · Eligible: {detail.entry.eligibleFrom ? safeFmtDate(detail.entry.eligibleFrom) : "Recorded"} · Source: {detail.entry.sourceType || "—"}</div>
      </div>}
      {!detail.entry && (rows.length === 0 ? <Empty icon={<Coins size={22} color="var(--muted)" />} title="No matching records" text="There are no ledger records for this category yet." /> : <div>
        {rows.map((r, i) => <div key={r.id || i} role={r.commissionDetail && onEntryClick ? "button" : undefined} tabIndex={r.commissionDetail && onEntryClick ? 0 : undefined} onClick={() => r.commissionDetail && onEntryClick?.(r.commissionDetail)} onKeyDown={(e) => { if (r.commissionDetail && onEntryClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onEntryClick(r.commissionDetail); } }} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 18px", borderTop: i ? "1px solid var(--border)" : undefined, cursor: r.commissionDetail && onEntryClick ? "pointer" : undefined }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{r.title || "Ledger entry"}</div><div className="hint-line" style={{ marginTop: 3 }}>{r.detail || ""}</div>{r.date && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>{safeFmtDateTime(r.date)}</div>}</div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><div className="mono" style={{ fontWeight: 800, color: Number(r.amount) < 0 ? "var(--neg)" : "var(--pos)" }}>{Number(r.amount) < 0 ? safeMoney(r.amount) : `+${safeMoney(r.amount)}`}</div>{r.status && <span className={"badge " + (r.statusTone || "")} style={{ marginTop: 4 }}>{r.status}</span>}{r.commissionDetail && onEntryClick && <div className="hint-line" style={{ fontSize: 10, marginTop: 4 }}>View details →</div>}</div>
        </div>)}
      </div>)}
    </div>
  </div>;
}

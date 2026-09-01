export default function APNWalletDetailModal({ detail, onClose, runtime }) {
  const { Empty, Coins, fmtDateTime, money } = runtime;
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
      {rows.length === 0 ? <Empty icon={<Coins size={22} color="var(--muted)" />} title="No matching records" text="There are no ledger records for this category yet." /> : <div>
        {rows.map((r, i) => <div key={r.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 18px", borderTop: i ? "1px solid var(--border)" : undefined }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{r.title || "Ledger entry"}</div><div className="hint-line" style={{ marginTop: 3 }}>{r.detail || ""}</div>{r.date && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>{fmtDateTime(r.date)}</div>}</div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><div className="mono" style={{ fontWeight: 800, color: Number(r.amount) < 0 ? "var(--neg)" : "var(--pos)" }}>{Number(r.amount) < 0 ? money(r.amount) : `+${money(r.amount)}`}</div>{r.status && <span className={"badge " + (r.statusTone || "")} style={{ marginTop: 4 }}>{r.status}</span>}</div>
        </div>)}
      </div>}
    </div>
  </div>;
}

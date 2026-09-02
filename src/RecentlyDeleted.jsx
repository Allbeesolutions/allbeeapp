import React, { useMemo, useState } from "react";

function RecentlyDeleted({ db, openModal, restoreItem, runtime }) {
  const { Empty, Trash2, RotateCcw, avatarColor, fmtDateTime, RECYCLE_TTL_DAYS } = runtime;
  const [open, setOpen] = useState({});
  const list = useMemo(() => [...(db.recycle || [])].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), [db.recycle]);
  const daysLeft = (r) => Math.max(0, RECYCLE_TTL_DAYS - Math.floor((Date.now() - (r.deletedAt || 0)) / 86400000));
  const askRestore = (r) => openModal({
    type: "restoreConfirm", title: "Restore item?",
    body: `Restore ${r.module.toLowerCase()} "${r.name}" to its original module?`, note: "It will reappear where it was before.",
    onConfirm: () => restoreItem(r),
  });
  // Turn a stored field name into a readable label ("assignedTo" → "Assigned To").
  const humanizeKey = (k) => k.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  // Every meaningful field of the deleted record, formatted for display. Arrays
  // are joined, timestamps are made readable, booleans become Yes/No. Only the
  // internal id is hidden.
  const detailsOf = (r) => {
    const it = r.item || {};
    const skip = new Set(["id"]);
    const out = [];
    for (const [k, v] of Object.entries(it)) {
      if (skip.has(k) || v === "" || v == null) continue;
      let text;
      if (Array.isArray(v)) {
        if (!v.length) continue;
        text = v.map((x) => (x && typeof x === "object" ? (x.title || x.name || x.status || x.text || JSON.stringify(x)) : String(x))).join(", ");
      } else if (typeof v === "boolean") {
        text = v ? "Yes" : "No";
      } else if (typeof v === "object") {
        text = JSON.stringify(v);
      } else if (typeof v === "number" && v > 1e12 && /(at|At|ts)$/.test(k)) {
        text = fmtTime(v); // millisecond timestamp
      } else {
        text = String(v);
      }
      out.push([humanizeKey(k), text]);
    }
    return out;
  };

  return (
    <div className="content">
      <div className="page-head"><h3>Recently deleted</h3></div>
      <div className="hint-line" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <AlertTriangle size={13} /> Deleted items are kept here for {RECYCLE_TTL_DAYS} days, then removed automatically. There is no permanent-delete option.
      </div>
      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Trash2 size={22} color="var(--muted)" />} title="Nothing deleted" text="When you delete a task, project, entry or any other record, it lands here first so you can restore it." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Item</th><th>Module</th><th>Deleted by</th><th>Deleted</th><th>Auto-removes in</th><th></th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const left = daysLeft(r);
                  const rows = detailsOf(r);
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td><div style={{ fontWeight: 600 }}>{r.name}</div>
                          {rows.length > 0 && <button className="ttl-link" style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>{open[r.id] ? "Hide" : "View"} original details</button>}
                        </td>
                        <td><span className="tag">{r.module}</span></td>
                        <td><span className="badge"><span className="dot" style={{ background: avatarColor(r.deletedBy), display: "inline-block", marginRight: 5 }} />{r.deletedBy}</span></td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtTime(r.deletedAt)}</td>
                        <td><span className={"ttl-pill " + (left <= 7 ? "ttl-soon" : "ttl-ok")}>{left} {left === 1 ? "day" : "days"}</span></td>
                        <td><button className="btn sm primary" onClick={() => askRestore(r)}><RotateCcw size={13} />Restore</button></td>
                      </tr>
                      {open[r.id] && rows.length > 0 && (
                        <tr><td colSpan={6} style={{ background: "var(--surface-2)" }}>
                          <div className="detail-json">
                            {rows.map(([k, v]) => <div key={k}><span className="k">{k}:</span> {v}</div>)}
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


export default RecentlyDeleted;

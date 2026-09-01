import React, { useEffect, useMemo, useState } from "react";

export default function APNAdminLeaderboard({ db }) {
  const [scope, setScope] = useState("company");
  const [district, setDistrict] = useState(TN_DISTRICTS[0]);
  const [metric, setMetric] = useState("revenue");
  const rows = apnLeaderboard(db, scope, district, metric);
  const fmtVal = (v) => (metric === "projects" ? String(v) : money(v));
  return (
    <div>
      <div className="filterbar">
        <Field label="Scope"><select className="select" value={scope} onChange={(e) => setScope(e.target.value)}><option value="company">Company-wide</option><option value="district">District</option></select></Field>
        {scope === "district" && <Field label="District"><select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>}
        <Field label="Rank by"><select className="select" value={metric} onChange={(e) => setMetric(e.target.value)}><option value="revenue">Top revenue</option><option value="leads">Top leads</option><option value="conversion">Top conversion rate</option><option value="commission">Top commission</option><option value="attendance">Top attendance</option><option value="health">Top health score</option><option value="projects">Top projects</option></select></Field>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty icon={<Trophy size={22} color="var(--muted)" />} title="No ranking yet" text="Rankings appear as partners close deals." />
          : rows.map((r, i) => (
            <div key={r.u.id} className="apn-rank">
              <div className={"pos" + (i === 0 ? " g1" : i === 1 ? " g2" : i === 2 ? " g3" : "")}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{r.u.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{apnIdFor(r.u)} · {r.u.district || "—"}</div></div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmtVal(r.v)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── admin shell ─────────────────────────────────────────────────────── */

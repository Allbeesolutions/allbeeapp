import React, { useState } from "react";
import { BadgeCheck, GaugeCircle, Lightbulb, Search, ShieldCheck, TrendingUp, UserCheck, Users } from "lucide-react";
import { apnDistrictHeadMembers } from "./scope.js";
import { apnEffectiveStatus } from "./attendance.js";
import { apnIdFor } from "./ids.js";

export function APNDistrict({
  db, meRow, mutate, APN_INACTIVE_DAYS, APNMetric, Empty, APNHeadPartnerCard, Avatar, money, round2,
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [focus, setFocus] = useState("overview");
  const members = apnDistrictHeadMembers(db, meRow);
  const visible = members.filter(
    (p) =>
      (!query || (p.name + " " + p.email + " " + apnIdFor(p) + " " + p.mobile).toLowerCase().includes(query.toLowerCase())) &&
      (status === "all" || apnEffectiveStatus(p, APN_INACTIVE_DAYS) === status),
  );
  const leads = (db.apn_leads || []).filter((l) => members.some((p) => p.id === l.partnerId));
  const converted = leads.filter((l) => l.status === "Converted");
  const revenue = round2(converted.reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const heads = (db.apn_users || []).filter((u) => u.role === "district_head");

  return (
    <div className="apn-head-cockpit">
      <div className="apn-section-h">
        <div><b>District Command</b><div className="hint-line">{meRow.district || "Unassigned district"} · {meRow.name}</div></div>
        <span className="badge pri">District Head</span>
      </div>
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Partners" v={members.length} icon={<Users size={13} />} />
        <APNMetric k="Active" v={members.filter((p) => apnEffectiveStatus(p, APN_INACTIVE_DAYS) === "active").length} icon={<UserCheck size={13} />} />
        <APNMetric k="Revenue" v={money(revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Leads" v={leads.length} icon={<Lightbulb size={13} />} />
        <APNMetric k="Conversions" v={converted.length} icon={<BadgeCheck size={13} />} />
      </div>
      <div className="apn-head-tabs">
        <button className={focus === "overview" ? "on" : ""} onClick={() => setFocus("overview")}>Overview</button>
        <button className={focus === "partners" ? "on" : ""} onClick={() => setFocus("partners")}>Partners ({members.length})</button>
      </div>
      {focus === "overview" ? (
        <div className="apn-head-overview-grid">
          <div className="apn-rowcard">
            <div className="lbl"><GaugeCircle size={14} />District performance</div>
            <div className="apn-head-statline"><span>Conversion rate</span><b>{leads.length ? Math.round((converted.length / leads.length) * 100) : 0}%</b></div>
            <div className="apn-head-statline"><span>Inactive / attention</span><b>{members.filter((p) => ["inactive", "suspended"].includes(apnEffectiveStatus(p, APN_INACTIVE_DAYS))).length}</b></div>
            <div className="apn-head-statline"><span>Partners with targets</span><b>{members.filter((p) => (db.apn_targets || []).some((t) => t.partnerId === p.id)).length}</b></div>
          </div>
          <div className="apn-rowcard">
            <div className="lbl"><ShieldCheck size={14} />Your authority</div>
            <p className="hint-line" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>Monitor and support your assigned partners, log calls, and recommend reactivation. Financial settings, hierarchy changes and final lifecycle decisions remain with administration.</p>
          </div>
          <div className="apn-rowcard">
            <div className="lbl"><Users size={14} />District Head directory</div>
            {heads.filter((h) => h.district === meRow.district).map((h) => <div className="apn-head-statline" key={h.id}><span>{h.name}</span><b>{h.id === meRow.id ? "You" : "District Head"}</b></div>)}
          </div>
        </div>
      ) : (
        <div>
          <div className="apn-head-toolbar">
            <div className="searchbox"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partner, APN ID, phone…" /></div>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="apn-list">
            {visible.length ? visible.map((p) => <APNHeadPartnerCard key={p.id} db={db} partner={p} mutate={mutate} viewer={meRow} Avatar={Avatar} money={money} APN_INACTIVE_DAYS={APN_INACTIVE_DAYS} />) : <div className="apn-rowcard"><Empty icon={<Users size={22} />} title="No partners found" text="No partner matches this district and filter." /></div>}
          </div>
        </div>
      )}
    </div>
  );
}

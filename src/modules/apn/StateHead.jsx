import React, { useState } from "react";
import { BadgeCheck, GaugeCircle, MapPin, Search, ShieldCheck, TrendingUp, UserCheck, Users } from "lucide-react";
import { apnStateScope } from "./scope.js";
import { apnEffectiveStatus } from "./attendance.js";
import { apnIdFor } from "./ids.js";
import { apnApprovalNotification, apnNotify } from "./admin-notifications.js";

export function APNStateHead({
  db,
  meRow,
  mutate,
  patchDb,
  openModal,
  supabase,
  uid,
  emitToast,
  round2,
  APN_INACTIVE_DAYS,
  APNMetric,
  Empty,
  APNHeadPartnerCard,
  Avatar,
  money,
}) {
  const [query, setQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [focus, setFocus] = useState("overview");
  const members = apnStateScope(db, meRow);
  const districts = [...new Set(members.map((p) => p.district).filter(Boolean))].sort();
  const filtered = members.filter(
    (p) =>
      (!query || (p.name + " " + p.email + " " + apnIdFor(p) + " " + p.mobile + " " + p.district).toLowerCase().includes(query.toLowerCase())) &&
      (districtFilter === "all" || p.district === districtFilter),
  );
  const heads = (db.apn_users || []).filter((u) => u.role === "district_head" && districts.includes(u.district));

  const approvePartner = async (partner) => {
    try {
      const { data, error } = await supabase.rpc("apn_state_head_approve_partner", { p_partner_id: partner.id });
      if (error) throw error;
      const at = Date.now();
      patchDb((d) => ({
        ...d,
        apn_users: (d.apn_users || []).map((u) =>
          u.id === partner.id ? { ...u, status: "active", approvedAt: at, approvedBy: meRow.name, rejectedAt: null, rejectReason: null } : u,
        ),
        apn_notifications: [...(d.apn_notifications || []), apnNotify(apnApprovalNotification(partner, meRow), uid)],
      }));
      emitToast("Approved " + (data?.name || partner.name) + ".", "success");
    } catch (e) {
      emitToast(e?.message || "Could not approve partner.", "error");
    }
  };

  const stateHeadAction = async (partner, action) => {
    try {
      const { data, error } = await supabase.rpc("apn_state_head_partner_action", { p_partner_id: partner.id, p_action: action });
      if (error) throw error;
      patchDb((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, ...(data || {}) } : u) }));
      emitToast(action === "log_call" ? "Call logged for " + partner.name + "." : "Reactivation recommended for " + partner.name + ".", "success");
    } catch (e) {
      emitToast(e?.message || "Could not complete State Head action.", "error");
    }
  };

  const logCall = (partner) => stateHeadAction(partner, "log_call");
  const recommend = (partner) => stateHeadAction(partner, "recommend_reactivation");
  const rejectPartner = (partner) => openModal?.({ type: "apnReject", partner, stateHead: true });
  const leads = (db.apn_leads || []).filter((l) => members.some((p) => p.id === l.partnerId));
  const converted = leads.filter((l) => l.status === "Converted");
  const revenue = round2(converted.reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const districtRows = districts.map((district) => {
    const ps = members.filter((p) => p.district === district);
    const ls = (db.apn_leads || []).filter((l) => ps.some((p) => p.id === l.partnerId));
    const cs = ls.filter((l) => l.status === "Converted");
    return {
      district,
      partners: ps.length,
      active: ps.filter((p) => apnEffectiveStatus(p, APN_INACTIVE_DAYS) === "active").length,
      leads: ls.length,
      converted: cs.length,
      revenue: round2(cs.reduce((s, l) => s + (Number(l.revenue) || 0), 0)),
      head: heads.find((h) => h.district === district)?.name || "Unassigned",
    };
  });

  return (
    <div className="apn-head-cockpit">
      <div className="apn-section-h">
        <div><b>State Command</b><div className="hint-line">{meRow.state || meRow.zone || "State-wide APN network"} · {meRow.name}</div></div>
        <span className="badge pri">State Head</span>
      </div>
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Partners" v={members.length} icon={<Users size={13} />} />
        <APNMetric k="Districts" v={districts.length} icon={<MapPin size={13} />} />
        <APNMetric k="District Heads" v={heads.length} icon={<UserCheck size={13} />} />
        <APNMetric k="Revenue" v={money(revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Conversions" v={converted.length} icon={<BadgeCheck size={13} />} />
      </div>
      <div className="apn-head-tabs">
        <button className={focus === "overview" ? "on" : ""} onClick={() => setFocus("overview")}>Overview</button>
        <button className={focus === "districts" ? "on" : ""} onClick={() => setFocus("districts")}>Districts ({districts.length})</button>
        <button className={focus === "partners" ? "on" : ""} onClick={() => setFocus("partners")}>Partners ({members.length})</button>
      </div>
      {focus === "overview" && (
        <div className="apn-head-overview-grid">
          <div className="apn-rowcard">
            <div className="lbl"><GaugeCircle size={14} />State performance</div>
            <div className="apn-head-statline"><span>Conversion rate</span><b>{leads.length ? Math.round((converted.length / leads.length) * 100) : 0}%</b></div>
            <div className="apn-head-statline"><span>Active partners</span><b>{members.filter((p) => apnEffectiveStatus(p, APN_INACTIVE_DAYS) === "active").length}</b></div>
            <div className="apn-head-statline"><span>Attention required</span><b>{members.filter((p) => ["inactive", "suspended"].includes(apnEffectiveStatus(p, APN_INACTIVE_DAYS))).length}</b></div>
          </div>
          <div className="apn-rowcard">
            <div className="lbl"><ShieldCheck size={14} />State Head authority</div>
            <p className="hint-line" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>State-wide oversight is read from the APN hierarchy. You can inspect district and partner performance without bypassing administrator-only financial or lifecycle controls.</p>
          </div>
        </div>
      )}
      {focus === "districts" && (
        <div className="apn-rowcard" style={{ overflowX: "auto" }}>
          <table className="tbl apn-mobile-cards"><thead><tr><th>District</th><th>Head</th><th>Partners</th><th>Active</th><th>Leads</th><th>Converted</th><th>Revenue</th></tr></thead>
            <tbody>{districtRows.length ? districtRows.map((r) => <tr key={r.district}><td data-label="District"><b>{r.district}</b></td><td data-label="Head">{r.head}</td><td data-label="Partners">{r.partners}</td><td data-label="Active">{r.active}</td><td data-label="Leads">{r.leads}</td><td data-label="Converted">{r.converted}</td><td data-label="Revenue" className="mono">{money(r.revenue)}</td></tr>) : <tr><td colSpan="7">No districts are assigned to this State Head yet.</td></tr>}</tbody>
          </table>
        </div>
      )}
      {focus === "partners" && (
        <div>
          <div className="apn-head-toolbar">
            <div className="searchbox"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partner, district, APN ID…" /></div>
            <select className="select" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}><option value="all">All districts</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </div>
          <div className="apn-list">{filtered.length ? filtered.map((p) => <APNHeadPartnerCard key={p.id} db={db} partner={p} mutate={mutate} viewer={meRow} allowActions={true} onApprove={approvePartner} onReject={rejectPartner} onLogCall={logCall} onRecommend={recommend} Avatar={Avatar} money={money} APN_INACTIVE_DAYS={APN_INACTIVE_DAYS} />) : <div className="apn-rowcard"><Empty icon={<Users size={22} />} title="No partners found" text="No partner matches this state and filter." /></div>}</div>
        </div>
      )}
    </div>
  );
}

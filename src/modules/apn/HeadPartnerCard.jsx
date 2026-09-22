import React from "react";
import { Check, PhoneCall, RefreshCw, X } from "lucide-react";
import { apnPartnerStats, apnTargetProgress } from "./analytics.js";
import { apnEffectiveStatus } from "./attendance.js";
import { apnIdFor } from "./ids.js";

export function APNHeadPartnerCard({
  db,
  partner,
  mutate,
  viewer,
  allowActions = true,
  onApprove,
  onReject,
  onLogCall,
  onRecommend,
  Avatar,
  money,
  APN_INACTIVE_DAYS,
}) {
  const stats = apnPartnerStats(db, partner.id);
  const status = apnEffectiveStatus(partner, APN_INACTIVE_DAYS);
  const target = (db.apn_targets || []).find((t) => t.partnerId === partner.id);
  const progress = target ? apnTargetProgress(db, target) : null;
  const recommend = () =>
    onRecommend
      ? onRecommend(partner)
      : mutate(
          (d) => ({
            ...d,
            apn_users: (d.apn_users || []).map((u) =>
              u.id === partner.id
                ? { ...u, reactivationRecommended: Date.now(), reactivationRecommendedBy: viewer.name }
                : u,
            ),
          }),
          { action: "recommended partner reactivation", module: "APN", entity: "Partner", entityId: partner.id, partnerId: viewer.id },
        );
  const logCall = () =>
    onLogCall
      ? onLogCall(partner)
      : mutate(
          (d) => ({
            ...d,
            apn_users: (d.apn_users || []).map((u) =>
              u.id === partner.id ? { ...u, lastHeadCallAt: Date.now(), lastHeadCallBy: viewer.name } : u,
            ),
          }),
          { action: "logged head call", module: "APN", entity: "Partner", entityId: partner.id, partnerId: viewer.id },
        );

  return (
    <div className="apn-rowcard apn-head-partner-card">
      <div className="apn-head-partner-main">
        <Avatar name={partner.name} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 750 }}>
            {partner.name} <span className="badge pri" style={{ marginLeft: 5 }}>{stats.level.name}</span>
          </div>
          <div className="hint-line">{apnIdFor(partner)} · {partner.district || "Unassigned"} · {partner.mobile || "No phone"}</div>
        </div>
        <span className={"badge " + (status === "active" ? "pos" : status === "inactive" ? "neg" : "pri")}>{status}</span>
      </div>
      <div className="apn-head-mini-grid">
        <div><span>Revenue</span><b>{money(stats.revenue)}</b></div>
        <div><span>Leads</span><b>{stats.submitted}</b></div>
        <div><span>Converted</span><b>{stats.converted}</b></div>
        <div><span>Commission</span><b>{money(stats.commission.earned)}</b></div>
        {progress && <div><span>Target</span><b>{progress.pct}%</b></div>}
      </div>
      {progress && <div className="progress-track" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: Math.min(100, Math.max(0, progress.pct)) + "%" }} /></div>}
      {allowActions && (
        <div className="apn-head-actions">
          {viewer.role === "state_head" && status === "pending" && (
            <>
              <button className="btn sm primary" onClick={() => onApprove?.(partner)}><Check size={13} />Approve</button>
              <button className="btn sm danger" onClick={() => onReject?.(partner)}><X size={13} />Reject</button>
            </>
          )}
          <button className="btn sm" onClick={logCall}><PhoneCall size={13} />Log call</button>
          {status === "inactive" && !partner.reactivationRecommended && (
            <button className="btn sm" onClick={recommend}><RefreshCw size={13} />Recommend reactivation</button>
          )}
        </div>
      )}
    </div>
  );
}

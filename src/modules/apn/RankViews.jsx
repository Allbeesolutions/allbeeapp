import React, { useState } from "react";
import { BadgeCheck as BadgeCheckIcon, Trophy as TrophyIcon } from "lucide-react";
import { apnRankBy, apnLeaderboard, apnAchievementsFor } from "./leaderboard.js";
import { apnLivePartners, apnMe } from "./partner.js";
import { apnPartnerStats } from "./analytics.js";
import { apnAttendanceScore } from "./helpers.js";
import { apnHealthScore } from "./health.js";
import { apnAvatarUrl } from "./partner.js";

export function APNAchievements({ db, pid, BadgeCheck }) {
  const list = apnAchievementsFor(db, pid, apnPartnerStats, (d,p,s,m) => apnRankBy(d,p,s,m,apnLivePartners,apnMe,apnPartnerStats,apnAttendanceScore,apnHealthScore));
  return (
    <div>
      <div className="apn-section-h">Achievements</div>
      <div className="apn-list">{list.map((a) => (
        <div key={a.id} className={"apn-ach" + (a.done ? "" : " lock")}>
          <span className="em">{a.em}</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{a.label}</div><div className="hint-line" style={{ fontSize: 12 }}>{a.done ? "Unlocked" : "Locked"}</div></div>
          {a.done && <BadgeCheckIcon size={18} color="var(--pos)" />}
        </div>
      ))}</div>
    </div>
  );
}

/* ── leaderboard ─────────────────────────────────────────────────────── */
export function APNLeaderboard({ db, meRow, pid, Empty, Trophy, Avatar, apnAvatarUrl, money }) {
  const [scope, setScope] = useState("company");
  const [metric, setMetric] = useState("revenue");
  const rows = apnLeaderboard(db, scope, meRow?.district, metric, apnLivePartners, apnPartnerStats, apnAttendanceScore, apnHealthScore);
  const fmtVal = (v) => (["projects", "leads"].includes(metric) ? String(v) : ["conversion", "attendance", "health"].includes(metric) ? `${v}%` : money(v));
  return (
    <div>
      <div className="apn-section-h">Leaderboard</div>
      <div className="apn-seg-scroll">
        <button className={scope === "company" ? "on" : ""} onClick={() => setScope("company")}>Company</button>
        <button className={scope === "district" ? "on" : ""} onClick={() => setScope("district")}>My district</button>
      </div>
      <div className="apn-seg-scroll">
        {[["revenue", "Top revenue"], ["commission", "Top commission"], ["projects", "Top projects"]].map(([k, l]) => <button key={k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{l}</button>)}
      </div>
      <div className="apn-rowcard">
        {rows.length === 0 ? <Empty icon={<TrophyIcon size={22} color="var(--muted)" />} title="No ranking yet" text="Close deals to climb the leaderboard." />
          : rows.map((r, i) => (
            <div key={r.u.id} className="apn-rank" style={r.u.id === pid ? { background: "var(--primary-soft)", borderRadius: 10 } : undefined}>
              <div className={"pos" + (i === 0 ? " g1" : i === 1 ? " g2" : i === 2 ? " g3" : "")}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.u.name} url={apnAvatarUrl(r.u)} size={30} /><div><div style={{ fontWeight: 600 }}>{r.u.name}{r.u.id === pid ? " (you)" : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{r.u.district || "—"}</div></div></div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmtVal(r.v)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";
import { Check, ListChecks, ShieldCheck, Target } from "lucide-react";
import { apnTargetProgress } from "./analytics.js";
import { apnCalculatedGovernedExplanation, apnGovernedLimit } from "./network.js";

export function APNTargets({
  db,
  pid,
  mutate,
  go,
  Empty,
  APN_GOVERNED_TARGETS_LIMIT,
  apnMetricLabel,
}) {
  const list = (db.apn_targets || [])
    .filter((t) => t.partnerId === pid)
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const ack = (t) =>
    mutate(
      (d) => ({
        ...d,
        apn_targets: (d.apn_targets || []).map((x) =>
          x.id === t.id
            ? { ...x, acknowledged: true, acknowledgedAt: Date.now() }
            : x,
        ),
      }),
      null,
    );

  const ackRef = useRef(null);

  useEffect(() => {
    const raw = String(window.location.hash || "")
      .replace(/^#\/?/, "")
      .split("?")[0]
      .split("/");
    if (raw[0] !== "targets" || !raw[1]) return;
    const target = list.find((t) => t.id === decodeURIComponent(raw[1]));
    if (!target) return;
    if (!target.acknowledged && !ackRef.current) {
      ackRef.current = target.id;
      ack(target);
      window.history.replaceState(null, "", "#/apn/targets");
    }
  }, [list]);

  const governed = apnGovernedLimit(db, pid);
  const explanation = apnCalculatedGovernedExplanation(db, pid);

  return (
    <div>
      <div className="apn-section-h">My targets</div>
      <div className="banner" style={{ margin: "0 0 12px" }}>
        <ShieldCheck size={15} />
        {explanation}
        {governed.full && (
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => go("home")}>
            Back to overview
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="apn-rowcard">
          <Empty
            icon={<Target size={22} color="var(--muted)" />}
            title="No targets assigned"
            text="Targets from your admin or district head will show up here."
          />
        </div>
      ) : (
        <div className="apn-list">
          {list.map((t) => {
            const p = apnTargetProgress(db, t);
            return (
              <div key={t.id} className="apn-rowcard">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{t.title}</div>
                    <div className="hint-line" style={{ fontSize: 12 }}>
                      {t.goal} {apnMetricLabel(t.metric).toLowerCase()} · by {t.assignedByName || "Admin"}
                      {t.selfCreated ? " · self-assigned" : " · governed"}
                      {t.parValue ? ` · par ${t.parValue}%` : ""}
                    </div>
                    {t.parentName && <div className="hint-line" style={{ fontSize: 12 }}>Parent: {t.parentName}</div>}
                    {t.prescriptionIds && (
                      <div className="hint-line" style={{ fontSize: 12 }}>
                        Prescriptions: {String(t.prescriptionIds).replace(/[;,]\s*/g, ", ")}
                      </div>
                    )}
                  </div>
                  <span className={"badge " + (p.pct >= 100 ? "pos" : "pri")}>{p.raw}/{p.goal}</span>
                </div>
                <div className="progress-track" style={{ marginTop: 10 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: p.pct + "%",
                      background: p.pct >= 100 ? "var(--pos)" : "var(--primary)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  {t.acknowledged ? (
                    <span className="badge pos">
                      <Check size={11} style={{ marginRight: 3 }} />Acknowledged
                    </span>
                  ) : (
                    <button className="btn sm primary" onClick={() => ack(t)}>
                      <Check size={13} />Acknowledge target
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="apn-rowcard" style={{ marginTop: 14 }}>
        <div className="lbl"><ListChecks size={14} /> Data guide</div>
        <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>
          Progress is calculated from leads submitted after the target was created. Admin-assigned targets are governed: at most {APN_GOVERNED_TARGETS_LIMIT} at a time, acknowledged by you here. Your own self-set targets never count against the limit.
        </div>
      </div>
    </div>
  );
}

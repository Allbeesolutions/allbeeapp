import React, { useEffect, useState } from "react";
import * as Icons from "./icons.jsx";

const { ScrollText, RefreshCw, Check } = Icons;
const TARGETS = [
  ["all", "All users (general)"],
  ["admin", "Admins"],
  ["accountant", "Accountants"],
  ["staff", "Staff"],
  ["intern", "Interns"],
];

function roleTncOf(config) {
  try { return JSON.parse(config?.tnc_roles || "{}") || {}; } catch { return {}; }
}

export default function TncManager({ config, saveTnc, saveRoleTnc }) {
  const [target, setTarget] = useState("all");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const roleMap = roleTncOf(config);
  const bodyFor = (key) => key === "all" ? (config?.tnc_body || "") : (roleMap[key]?.body || "");
  const versionFor = (key) => key === "all" ? Number(config?.tnc_version || 0) : Number(roleMap[key]?.version || 0);

  useEffect(() => {
    setBody(bodyFor(target));
    setDone(false);
  }, [target, config?.tnc_body, config?.tnc_roles]);

  const version = versionFor(target);
  const targetLabel = TARGETS.find(([key]) => key === target)?.[1] || target;
  const publish = async () => {
    setSaving(true);
    setDone(false);
    try {
      if (target === "all") await saveTnc(body);
      else await saveRoleTnc(target, body);
      setDone(true);
    } catch (error) {
      console.error("Terms publish failed", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
        Terms &amp; conditions
      </div>
      <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 12 }}>
        Publish a <b>general</b> agreement everyone signs, plus optional <b>role-specific</b> agreements. On sign-in each person accepts the general terms <i>and</i> the terms for their role. Publishing a change asks the affected people to re-accept before they carry on.
      </p>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <label className="field">
          <span className="field-label">Agreement</span>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {TARGETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
          <span className="hint-line">{version > 0 ? <>Current: <b style={{ color: "var(--ink)" }}>version {version}</b></> : "Not published yet"}</span>
        </div>
      </div>
      <textarea className="textarea" style={{ minHeight: 150 }} value={body} onChange={(e) => { setBody(e.target.value); setDone(false); }} placeholder={target === "all" ? "Terms every employee accepts…" : `Terms specific to ${targetLabel}…`} />
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" onClick={publish} disabled={saving || !body.trim()}>
          {saving ? <RefreshCw size={16} className="spin" /> : <ScrollText size={16} />}{version > 0 ? "Publish update" : "Publish terms"}
        </button>
        {done && <span className="hint-line" style={{ color: "var(--pos)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Published — affected people re-accept on next sign-in.</span>}
      </div>
    </div>
  );
}

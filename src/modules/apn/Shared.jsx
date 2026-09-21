import React, { useState } from "react";
import { RefreshCw, LogOut } from "../../icons.jsx";

export function APNGate({ isDark, icon, title, body, name, tone, onSignOut, onRefresh, ToastHost, emitToast }) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      emitToast("Status checked successfully", "success");
    } catch (e) {
      emitToast("Failed to check status", "error");
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card gate-card">
        <div className="lock-badge" style={tone === "neg" ? { background: "linear-gradient(135deg,var(--neg),#a92a2a)" } : undefined}>{icon}</div>
        <h1>{title}</h1>
        <p>{body}</p>
        {onRefresh && (
          <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            {refreshing ? "Checking status…" : "Check status"}
          </button>
        )}
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}

export function APNMetric({ k, v, icon, tone, onClick }) {
  return <div className="apn-metric" role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined} style={onClick ? { cursor: "pointer" } : undefined}>
    <div className="k">{icon}{k}{onClick && <span className="hint-line" style={{ marginLeft: "auto", fontSize: 11 }}>View</span>}</div>
    <div className="v" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</div>
  </div>;
}

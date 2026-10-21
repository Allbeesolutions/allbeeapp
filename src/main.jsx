import React from "react";
import { createRoot } from "react-dom/client";
import App from "./AllbeeApp.jsx";
import CustomerUsageTelemetry from "./CustomerUsageTelemetry.jsx";
import { supabase } from "./supabaseClient";
import { installChunkRecovery } from "./chunkRecovery.js";
import { installAppUpdateGuard, CURRENT_BUILD_ID } from "./appUpdateGuard.js";
import { pageErrorPayload, sanitizeCrashText, shouldSendCrashReport } from "./utils/errorTelemetry.js";

installChunkRecovery();
installAppUpdateGuard();

// App itself owns a large hook/render tree, so the boundary inside App cannot
// catch an exception thrown while App is rendering. Keep a final boundary at
// the root so one bad admin record/module can never turn the entire product into
// a silent white screen. The user gets a recoverable diagnostic instead.
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error("[ALLBEE] unrecoverable app render error", sanitizeCrashText(error?.message || error), sanitizeCrashText(info?.componentStack, 400));
    // Best-effort production telemetry. Never let monitoring itself prevent the
    // recovery UI from rendering if auth/network/database is unavailable.
    try {
      const buildId = CURRENT_BUILD_ID;
      const payload = pageErrorPayload(error, info, window.location.pathname + window.location.hash, buildId, "RootErrorBoundary");
      if (shouldSendCrashReport(payload)) Promise.resolve(supabase.rpc("app_record_error", payload)).catch(() => {});
    } catch { /* monitoring must never mask the original error */ }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="allbee" data-theme="light" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div className="card" style={{ width: "min(720px, 100%)", padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>ALLBEE could not render this screen</h2>
            <p className="hint-line">Your data is safe. A single module or malformed runtime value caused a render failure. Refresh the app to recover.</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, maxHeight: 220, overflow: "auto" }}>{sanitizeCrashText(this.state.error?.message || this.state.error)}</pre>
            <button className="btn primary" onClick={() => window.location.reload()}>Reload ALLBEE</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
    <CustomerUsageTelemetry />
  </React.StrictMode>
);

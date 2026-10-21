import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient.js";
import { isChunkLoadError, recoverFromChunkError } from "../chunkRecovery.js";
import { pageErrorPayload, sanitizeCrashText, shouldSendCrashReport } from "../utils/errorTelemetry.js";
import { CURRENT_BUILD_ID } from "../appUpdateGuard.js";

// Render inside the boundary: evaluating renderPage() in the parent JSX would
// throw before an error boundary has a chance to intercept it.
export function SafePageRenderer({ renderPage }) { return renderPage(); }

// Keep the navigation and the rest of the workspace alive if one route fails.
// Unlike the root boundary, this can recover without logging users out.
export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempts: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ALLBEE] Isolated page error", sanitizeCrashText(error?.message || error), sanitizeCrashText(info?.componentStack, 400));
    if (isChunkLoadError(error)) recoverFromChunkError(error);
    // Best-effort, bounded telemetry matching the root error boundary.
    // Never prevent the recovery UI if logging or the network is unavailable.
    try {
      const buildId = CURRENT_BUILD_ID;
      const path = window.location.pathname + window.location.hash;
      const payload = pageErrorPayload(error, info, path, buildId);
      if (shouldSendCrashReport(payload)) Promise.resolve(supabase.rpc("app_record_error", payload)).catch(() => {});
    } catch { /* telemetry is nonblocking */ }
    this.props.onError?.(error, info);
  }

  render() {
    const { error, attempts } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    return (
      <section className="content" role="alert" aria-label="Page recovery" style={{ padding: "24px 12px" }}>
        <div className="card" style={{ maxWidth: 650, margin: "auto", padding: 24 }}>
          <AlertTriangle size={24} color="var(--neg)" />
          <h3>{stale ? "This page needs an update" : "This page could not load"}</h3>
          <p className="hint-line">{stale ? "This tab is using an outdated app module. Reload to open the latest version." : "The rest of your ALLBEE workspace is still available. You can retry this page or move to another section."}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={() => stale ? window.location.reload() : this.setState({ error: null, attempts: attempts + 1 })}>
              <RefreshCw size={15} />{stale ? "Reload app" : "Retry page"}
            </button>
            {this.props.onNavigateHome && <button className="btn" type="button" onClick={this.props.onNavigateHome}>Go to overview</button>}
          </div>
          {attempts >= 2 && <p className="hint-line">If this keeps happening, contact support with the section name; no records were deleted by this screen.</p>}
        </div>
      </section>
    );
  }
}

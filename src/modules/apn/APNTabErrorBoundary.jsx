import React from "react";
import { AlertTriangle } from "lucide-react";
import { isChunkLoadError, recoverFromChunkError } from "../../chunkRecovery.js";

export class APNTabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[APN] Tab render error:", error, info?.componentStack?.slice(0, 400));
    recoverFromChunkError(error);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "An unexpected error occurred.";
      const staleChunk = isChunkLoadError(this.state.error);
      return (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--neg)", marginBottom: 12 }}><AlertTriangle size={32} /></div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>{staleChunk ? "ALLBEE was updated" : "Something went wrong"}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
            {staleChunk ? "This screen was still using an older deployed module. Reload ALLBEE to continue on the latest version." : msg}
          </div>
          <button className="btn primary" onClick={() => staleChunk ? window.location.reload() : this.setState({ hasError: false, error: null })}>
            {staleChunk ? "Reload ALLBEE" : "Try again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

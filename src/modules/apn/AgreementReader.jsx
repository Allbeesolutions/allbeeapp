import React from "react";
import { X, ScrollText } from "../../icons.jsx";

export default function APNAgreementReader({ doc, onClose, footer, simple = false, onToggleSimple, formatDate }) {
  const simpleBody = doc.body_simple || doc.simpleBody || "";
  const body = (simple ? simpleBody : (doc.body || simpleBody)) || "";
  const simpleAvailable = !!(doc.body_simple || doc.simpleBody);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "min(94vw, 720px)", maxHeight: "88vh", overflow: "auto", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div className="cmdk-ic" style={{ flexShrink: 0 }}><ScrollText size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{doc.title}</div>
            <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>
              {doc.category} · Version {doc.version} · {doc.mandatory ? "Required document" : "Optional"} · Effective {formatDate(doc.effectiveFrom || doc.effective_from)}
              {doc.material === undefined || doc.material === null ? "" : doc.material === false ? " · Editorial change" : " · Material change"}
              {doc.changeSummary || doc.change_summary ? ` · ${doc.changeSummary || doc.change_summary}` : ""}
            </div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close document" title="Close document"><X size={16} /></button>
        </div>
        {simpleAvailable && onToggleSimple && (
          <div style={{ display: "flex", gap: 6, margin: "10px 0 2px" }}>
            <button className={"btn xs" + (simple ? "" : " primary")} onClick={() => onToggleSimple(false)}>Full text</button>
            <button className={"btn xs" + (simple ? " primary" : "")} onClick={() => onToggleSimple(true)}>Simple English</button>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{body || "This document has no readable text yet."}</div>
        {footer}
      </div>
    </div>
  );
}


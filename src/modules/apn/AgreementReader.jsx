import React, { useEffect, useRef } from "react";
import { X, ScrollText } from "../../icons.jsx";

export default function APNAgreementReader({ doc, onClose, footer, simple = false, onToggleSimple, formatDate }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const trap = e => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key !== "Tab") return;
    const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled)')];
    if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
  };
  const simpleBody = doc.body_simple || doc.simpleBody || "";
  const body = (simple ? simpleBody : (doc.body || simpleBody)) || "";
  const simpleAvailable = !!(doc.body_simple || doc.simpleBody);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={doc.title} onKeyDown={trap} style={{ width: "min(94vw, 720px)", maxHeight: "88vh", overflow: "auto", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
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
            <button aria-pressed={!simple} className={"btn xs" + (simple ? "" : " primary")} onClick={() => onToggleSimple(false)}>Full text</button>
            <button aria-pressed={simple} className={"btn xs" + (simple ? " primary" : "")} onClick={() => onToggleSimple(true)}>Simple English</button>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{body || "This document has no readable text yet."}</div>
        {footer}
      </div>
    </div>
  );
}


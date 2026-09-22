import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apnLeadsOf } from "./analytics.js";
import { apnMetricLabel } from "./helpers.js";
import { apnNotifVisible } from "./notifications.js";
import { searchHay } from "../../utils/search.js";

export function APNSearch({
  db, meRow, pid, go, onClose, APN_SERVICE_LABEL, money, SearchHighlight,
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);

  const index = useMemo(() => {
    const out = [];
    for (const l of apnLeadsOf(db, pid)) out.push({ id: "l" + l.id, tab: "leads", module: "Lead", title: l.clientName, sub: APN_SERVICE_LABEL[l.service] + " · " + l.status, text: searchHay(l) });
    for (const qt of (db.apn_quotations || []).filter((x) => x.partnerId === pid)) out.push({ id: "q" + qt.id, tab: "quotations", module: "Quotation", title: qt.clientName, sub: money(qt.total), text: searchHay(qt) });
    for (const d of (db.apn_documents || [])) out.push({ id: "d" + d.id, tab: "documents", module: "Material", title: d.title, sub: d.category || "", text: searchHay(d) });
    for (const t of (db.apn_training || [])) out.push({ id: "t" + t.id, tab: "learn", module: "Training", title: t.title, sub: APN_SERVICE_LABEL[t.category] || "", text: searchHay(t) });
    for (const t of (db.apn_targets || []).filter((x) => x.partnerId === pid)) out.push({ id: "tg" + t.id, tab: "targets", module: "Target", title: t.title, sub: apnMetricLabel(t.metric), text: searchHay(t) });
    for (const n of (db.apn_notifications || []).filter((x) => apnNotifVisible(x, meRow))) out.push({ id: "n" + n.id, tab: "notifications", module: "Notification", title: n.title, sub: "", text: searchHay(n) });
    return out;
  }, [db, pid, meRow, APN_SERVICE_LABEL, money]);

  const results = useMemo(() => {
    const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    return index.filter((r) => toks.every((t) => r.text.includes(t))).slice(0, 40);
  }, [q, index]);

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="cmdk" role="dialog" aria-modal="true" aria-label="Search APN" onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key !== "Tab") return;
        const nodes = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || []);
        if (!nodes.length) return;
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}>
        <div className="cmdk-input">
          <Search size={20} color="var(--muted)" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads, quotations, materials…" aria-label="Search APN records" />
          <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Close search" title="Close search"><X size={16} /></button>
        </div>
        <div className="cmdk-results">
          {!q.trim() ? <div className="cmdk-empty">Search your leads, quotations, targets, training and materials.</div>
            : results.length === 0 ? <div className="cmdk-empty">No matches for “{q}”.</div>
              : results.map((r) => (
                <div key={r.id} className="cmdk-item" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(r.tab); onClose(); } }} onMouseDown={(e) => { e.preventDefault(); go(r.tab); onClose(); }}>
                  <div className="cmdk-ic"><Search size={15} /></div>
                  <div className="cmdk-main"><div className="cmdk-title"><SearchHighlight text={r.title} q={q} /></div><div className="cmdk-path">{r.sub}</div></div>
                  <span className="tag">{r.module}</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

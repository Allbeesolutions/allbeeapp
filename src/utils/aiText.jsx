import React from "react";

export function maskEmail(e) {
  const s = String(e || "").trim(); const at = s.indexOf("@");
  if (!s) return ""; if (at <= 1) return s.slice(0, 1) + "***";
  return s.slice(0, 1) + "***@" + s.slice(at + 1);
}
export function maskPhone(p) {
  const digits = String(p || "").replace(/\D/g, "");
  if (!digits) return ""; if (digits.length < 5) return "***";
  return "****" + digits.slice(-4);
}
export function scrubText(v) {
  const s = String(v ?? ""); if (!s) return s;
  const out = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, maskEmail);
  return out.replace(/\+?\d[\d\s().-]{7,}\d/g, (token) => {
    const digits = (token.match(/\d/g) || []).join("");
    return digits.length >= 10 ? "****" + digits.slice(-4) : token;
  });
}
export function renderAIInline(text, keyPrefix = "ai") {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${keyPrefix}-b-${i}`} style={{ color: "var(--ink)", fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={`${keyPrefix}-c-${i}`} style={{ padding: "2px 5px", borderRadius: 5, background: "var(--primary-soft)", color: "var(--primary)", fontSize: "0.92em" }}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

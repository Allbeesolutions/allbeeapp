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
export function friendlyAIErrorText(error) {
  const raw = String(error?.message || error || "ALLBEE AI returned an error.");
  const retry = raw.match(/please\s+try\s+again\s+in\s+([0-9.]+)s/i) || raw.match(/try\s+again\s+in\s+([0-9.]+)\s*s/i);
  if (retry) return `ALLBEE AI is currently busy due to high usage. Please try again in ${retry[1]}s.`;
  return raw;
}

export function stripInternalRecordIds(text) {
  const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1] || "";
    const isTableHeader = /^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}/.test(next);
    if (!isTableHeader) {
      out.push(line.replace(uuid, "").replace(/\b(?:record|internal)\s+id\s*[:#-]?\s*/gi, ""));
      continue;
    }
    const block = [];
    while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { block.push(lines[i]); i += 1; }
    i -= 1;
    const header = cells(block[0]);
    const remove = new Set(header.map((h, idx) => (/^(?:record\s*)?id$|^internal\s*id$/i.test(h) ? idx : -1)).filter((idx) => idx >= 0));
    for (const row of block) {
      const kept = cells(row).filter((_, idx) => !remove.has(idx)).map((x) => x.replace(uuid, ""));
      out.push(`| ${kept.join(" | ")} |`);
    }
  }
  return out.join("\n").replace(uuid, "").replace(/[ \t]+\n/g, "\n").trim();
}

export function renderAIInline(text, keyPrefix = "ai") {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${keyPrefix}-b-${i}`} style={{ color: "var(--ink)", fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={`${keyPrefix}-c-${i}`} style={{ padding: "2px 5px", borderRadius: 5, background: "var(--primary-soft)", color: "var(--primary)", fontSize: "0.92em" }}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

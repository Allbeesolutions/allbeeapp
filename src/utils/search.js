export const testProgress = (s) => {
  const list = Array.isArray(s.checklist) ? s.checklist : [];
  return { done: list.filter((i) => i.done).length, total: list.length };
};

export const testResultTone = (r) => (r === "Passed" ? "pos" : r === "Failed" ? "neg" : "pri");

export function collectText(v, out = []) {
  if (v == null) return out;
  if (typeof v === "string") { out.push(v); return out; }
  if (Array.isArray(v)) { for (const x of v) collectText(x, out); return out; }
  if (typeof v === "object") { for (const k of Object.keys(v)) { if (k !== "password") collectText(v[k], out); } return out; }
  return out;
}

export const searchHay = (obj) => collectText(obj).join(" ").toLowerCase();
export const msToISO = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");

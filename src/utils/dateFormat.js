export const localISODate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
export const todayISO = () => localISODate();
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function money(n, { sign = false } = {}) {
  const v = round2(n || 0);
  const neg = v < 0;
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(v));
  const core = "₹" + s;
  if (neg) return "−" + core;
  if (sign) return "+" + core;
  return core;
}
export function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const text = String(value);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
}
export function pad2(value) { return String(value).padStart(2, "0"); }
export function formatDateValue(value, withTime = false) {
  const d = dateValue(value);
  if (!d || Number.isNaN(d.getTime())) return value ? String(value) : "—";
  const date = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  if (!withTime) return date;
  const hours = d.getHours();
  const hour = hours % 12 || 12;
  return `${date} ${pad2(hour)}:${pad2(d.getMinutes())} ${hours >= 12 ? "PM" : "AM"}`;
}
export const fmtDate = (iso) => formatDateValue(iso);
export const fmtTime = (ts) => formatDateValue(ts, true);
export const sameMonth = (iso, ref = new Date()) => {
  const d = new Date(iso + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

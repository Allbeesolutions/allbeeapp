import { APN_ID_PREFIX, APN_RESERVED_NUMBERS, APN_MIN_DYNAMIC_NUMBER, APN_PERCENT_MIN, APN_PERCENT_MAX } from './constants.js';

export const apnPadId = (n) => APN_ID_PREFIX + String(n).padStart(4, '0');
export const apnLeadId = (n) => 'APN-L-' + String(n).padStart(4, '0');
export function apnNumberOf(value) { return Number(String(value || '').replace(/\D/g, '')) || 0; }
export function apnIdFor(partner) { return partner?.apnId || '—'; }
export function normalizeManualApnId(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  const match = raw.match(/^(?:APN-TN-)?(\d{4})$/);
  return match ? apnPadId(Number(match[1])) : null;
}
export function nextAvailableApnNumber(rows = [], requested) {
  const occupied = new Set((rows || []).map((row) => apnNumberOf(row.apnId)).filter(Boolean));
  let number = Math.max(Number(requested) || 0, APN_MIN_DYNAMIC_NUMBER);
  while (occupied.has(number) || APN_RESERVED_NUMBERS.has(number)) number += 1;
  return number;
}
export function resolveApnId(rows = [], requested) {
  const manual = normalizeManualApnId(requested);
  if (manual) {
    const duplicate = (rows || []).some((row) => apnIdFor(row) === manual || row.apnId === manual);
    if (duplicate) throw new Error(`${manual} is already assigned to another partner.`);
    return manual;
  }
  return apnPadId(nextAvailableApnNumber(rows));
}
export function apnPercent(value, label) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < APN_PERCENT_MIN || number > APN_PERCENT_MAX) throw new Error(`${label} must be between 0 and 100.`);
  return number;
}

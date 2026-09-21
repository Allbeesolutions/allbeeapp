const state = { startedAt: Date.now(), requests: 0, payloadBytes: 0, byTable: {} };
export function recordQueryMetric(table, rows, payloadBytes) {
  const bytes = Number(payloadBytes) || 0;
  state.requests += 1;
  state.payloadBytes += bytes;
  const item = state.byTable[table] || { requests: 0, rows: 0, payloadBytes: 0 };
  item.requests += 1; item.rows += Array.isArray(rows) ? rows.length : 0; item.payloadBytes += bytes;
  state.byTable[table] = item;
  if (typeof window !== "undefined") window.__ALLBEE_DATA_METRICS__ = snapshotQueryMetrics();
}
export function snapshotQueryMetrics() {
  return { startedAt: state.startedAt, requests: state.requests, payloadBytes: state.payloadBytes, byTable: { ...state.byTable } };
}
export function resetQueryMetrics() {
  state.startedAt = Date.now(); state.requests = 0; state.payloadBytes = 0; state.byTable = {};
  if (typeof window !== "undefined") window.__ALLBEE_DATA_METRICS__ = snapshotQueryMetrics();
}

export function normalizeRealtimeTableSet(tables) {
  if (!Array.isArray(tables) || tables.length === 0) return null;
  return [...new Set(tables.filter(Boolean))].sort();
}

export function mergeScopedRealtimeState(current, fresh, tables) {
  if (!Array.isArray(tables) || tables.length === 0) return fresh;
  const next = { ...(current || {}) };
  for (const table of tables) next[table] = fresh?.[table] || [];
  return next;
}

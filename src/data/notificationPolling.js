// Unread badge polling is opportunistic. Transient network errors must never
// crash the authenticated workspace or erase the last valid unread count.
export function startUnreadNotificationPolling({
  fetchCount, onCount, documentRef = document,
  everyMs = 30_000, setIntervalFn = setInterval, clearIntervalFn = clearInterval,
}) {
  let active = true;
  let pending = null;

  const refresh = () => {
    if (!active) return Promise.resolve();
    if (pending) return pending;
    pending = Promise.resolve().then(fetchCount).then(({ data, error } = {}) => {
      if (active && !error && Number.isFinite(data) && data >= 0) onCount(data);
    }).catch(() => {
      // Preserve the last known count. Future polls or visibility regain retry.
    }).finally(() => { pending = null; });
    return pending;
  };
  const timer = setIntervalFn(() => {
    if (documentRef.visibilityState !== "hidden") void refresh();
  }, everyMs);
  const onVisible = () => {
    if (documentRef.visibilityState === "visible") void refresh();
  };
  documentRef.addEventListener("visibilitychange", onVisible);
  void refresh();

  return () => {
    active = false;
    clearIntervalFn(timer);
    documentRef.removeEventListener("visibilitychange", onVisible);
  };
}

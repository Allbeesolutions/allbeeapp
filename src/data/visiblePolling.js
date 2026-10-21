// Shared background polling lifecycle for optional read-only data.
// Never overlap requests, update unmounted views, or poll inactive tabs.
export function startVisiblePolling({
  fetchValue,
  onValue,
  onError = () => {},
  documentRef = document,
  everyMs = 300_000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  let active = true;
  let pending = null;
  let queued = false;

  const refresh = () => {
    if (!active) return Promise.resolve();
    if (pending) {
      queued = true;
      return pending;
    }
    pending = Promise.resolve().then(fetchValue)
      .then((value) => {
        if (active && value != null) onValue(value);
      })
      .catch((error) => {
        if (active) onError(error);
      })
      .finally(() => {
        pending = null;
        if (active && queued && documentRef.visibilityState !== "hidden") {
          queued = false;
          void refresh();
        } else {
          queued = false;
        }
      });
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
    queued = false;
    clearIntervalFn(timer);
    documentRef.removeEventListener("visibilitychange", onVisible);
  };
}

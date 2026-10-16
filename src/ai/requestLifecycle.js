// Bound optional AI integrations so no slow promise can freeze the composer.
// A caller-owned AbortController cancels the actual request where supported.
export function awaitWithTimeout(task, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const onAbort = () => finish(Object.assign(new Error("AI request cancelled"), { name: "AbortError" }));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener?.("abort", onAbort, { once: true });
    timer = setTimeout(() => finish(new Error("AI service timed out")), Math.max(1, timeoutMs));
    Promise.resolve(task).then(value => finish(null, value), error => finish(error));
  });
}

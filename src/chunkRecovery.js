const CHUNK_ERROR_RE = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|vite:preloaderror/i;
const RELOAD_KEY = "allbee_chunk_reload_at";
const RELOAD_WINDOW_MS = 15000;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return CHUNK_ERROR_RE.test(message);
}

export function recoverFromChunkError(error, env = {}) {
  if (!isChunkLoadError(error)) return false;
  const locationLike = env.location || (typeof window !== "undefined" ? window.location : null);
  const storage = env.storage || (typeof window !== "undefined" ? window.sessionStorage : null);
  if (!locationLike?.reload) return false;

  const now = Date.now();
  try {
    const last = Number(storage?.getItem?.(RELOAD_KEY) || 0);
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    storage?.setItem?.(RELOAD_KEY, String(now));
  } catch { /* recovery must still work when storage is unavailable */ }

  locationLike.reload();
  return true;
}

export function installChunkRecovery() {
  if (typeof window === "undefined" || window.__allbeeChunkRecoveryInstalled) return;
  window.__allbeeChunkRecoveryInstalled = true;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault?.();
    recoverFromChunkError(event?.payload || event);
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event?.reason)) {
      event.preventDefault?.();
      recoverFromChunkError(event.reason);
    }
  });
}

const CURRENT_BUILD_ID = typeof __ALLBEE_BUILD_ID__ !== "undefined" ? String(__ALLBEE_BUILD_ID__) : "dev";
const RELOAD_KEY = "allbee-build-reload";

function editingNow() {
  const el = document.activeElement;
  return !!el && el.matches?.("input, textarea, select, [contenteditable='true']");
}

export function installAppUpdateGuard() {
  if (typeof window === "undefined" || CURRENT_BUILD_ID === "dev") return () => {};
  let stopped = false;
  let checking = false;
  let pendingBuild = "";

  const reloadTo = (buildId) => {
    if (!buildId || buildId === CURRENT_BUILD_ID || stopped) return;
    if (editingNow()) { pendingBuild = buildId; return; }
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === buildId) return;
      sessionStorage.setItem(RELOAD_KEY, buildId);
    } catch { /* session storage is optional */ }
    window.location.reload();
  };

  const check = async () => {
    if (checking || stopped || document.visibilityState === "hidden") return;
    checking = true;
    try {
      const response = await fetch(`/allbee-build.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const manifest = await response.json();
      reloadTo(String(manifest?.buildId || ""));
    } catch { /* offline: keep the current usable build */ }
    finally { checking = false; }
  };

  const onVisible = () => { if (document.visibilityState === "visible") { if (pendingBuild) reloadTo(pendingBuild); check(); } };
  const onFocusOut = () => { if (pendingBuild) window.setTimeout(() => reloadTo(pendingBuild), 50); };
  document.addEventListener("visibilitychange", onVisible);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("focus", check);
  const first = window.setTimeout(check, 1800);
  const timer = window.setInterval(check, 60000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
  }

  return () => {
    stopped = true;
    window.clearTimeout(first);
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    document.removeEventListener("focusout", onFocusOut, true);
    window.removeEventListener("focus", check);
  };
}

export { CURRENT_BUILD_ID };

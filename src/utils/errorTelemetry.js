// Small, privacy-reduced crash fingerprints for comparing pages and releases.
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const TOKEN = /\b[a-z0-9_-]{36,}\b/gi;

export function sanitizeCrashText(value, limit = 1800) {
  return String(value ?? "").replace(EMAIL, "[email]").replace(UUID, "[id]").replace(TOKEN, "[redacted]").slice(0, limit);
}

export function errorFingerprint(value) {
  const str = String(value);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function pageErrorPayload(error, info, path, buildId = "dev", source = "PageErrorBoundary") {
  const message = sanitizeCrashText(error?.message || error || "Unknown page error");
  const route = sanitizeCrashText(path || "/", 500);
  const stack = sanitizeCrashText(error?.stack, 4500);
  const componentStack = sanitizeCrashText(info?.componentStack, 3000);
  const fingerprint = errorFingerprint(route + "|" + String(error?.name || "Error") + "|" + message + "|" + componentStack.split("\n")[1]);
  return {
    p_message: message,
    p_stack: stack,
    p_component_stack: componentStack,
    p_path: route,
    p_metadata: { source, fingerprint, buildId: String(buildId).slice(0, 80) },
  };
}

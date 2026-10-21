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

// Avoid producing hundreds of identical telemetry writes during a render loop.
// This is an in-memory throttle, not a persistent client identifier.
const sentFingerprints = new Map();
export function shouldSendCrashReport(payload, now = Date.now(), windowMs = 60_000) {
  const fingerprint = payload?.p_metadata?.fingerprint;
  if (!fingerprint) return false;
  const previous = sentFingerprints.get(fingerprint);
  if (previous != null && now - previous >= 0 && now - previous < windowMs) return false;
  sentFingerprints.set(fingerprint, now);
  // Keep the map bounded even if many distinct crashes occur.
  if (sentFingerprints.size > 256) sentFingerprints.delete(sentFingerprints.keys().next().value);
  return true;
}
export function resetCrashThrottleForTests() {
  sentFingerprints.clear();
}

const taps = new Map();
export function isTouchDoubleTap(key, event, windowMs = 320) {
  if (event?.pointerType !== "touch") return false;
  const now = Date.now();
  const last = taps.get(String(key)) || 0;
  taps.set(String(key), now);
  if (now - last > 0 && now - last <= windowMs) {
    taps.delete(String(key));
    return true;
  }
  return false;
}

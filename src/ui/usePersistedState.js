import { useCallback, useState } from "react";

export default function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => {
    try { const saved = sessionStorage.getItem(key); return saved == null ? fallback : JSON.parse(saved); }
    catch { return fallback; }
  });
  const setPersisted = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      try { sessionStorage.setItem(key, JSON.stringify(resolved)); } catch { /* storage may be disabled */ }
      return resolved;
    });
  }, [key]);
  return [value, setPersisted];
}

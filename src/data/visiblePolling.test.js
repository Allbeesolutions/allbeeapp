import { describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "./visiblePolling.js";

function scenario(fetchValue, onValue = vi.fn(), onError = vi.fn()) {
  const handlers = new Map();
  const documentRef = {
    visibilityState: "visible",
    addEventListener: vi.fn((name, cb) => handlers.set(name, cb)),
    removeEventListener: vi.fn((name, cb) => {
      if (handlers.get(name) === cb) handlers.delete(name);
    }),
  };
  let pulse;
  const clearIntervalFn = vi.fn();
  const stop = startVisiblePolling({
    fetchValue, onValue, onError, documentRef,
    everyMs: 500,
    setIntervalFn: vi.fn(cb => { pulse = cb; return 42; }),
    clearIntervalFn,
  });
  const settle = async () => { for (let i = 0; i < 9; i++) await Promise.resolve(); };
  return { fetchValue, onValue, onError, documentRef, handlers, clearIntervalFn, stop, settle, get pulse() { return pulse; } };
}

describe("visible-only APN financial snapshot polling", () => {
  it("loads once on mount, pauses while hidden, then refreshes on return", async () => {
    const fetchValue = vi.fn().mockResolvedValueOnce({ balance: 100 }).mockResolvedValueOnce({ balance: 200 });
    const h = scenario(fetchValue);
    await h.settle();
    expect(h.onValue).toHaveBeenCalledWith({ balance: 100 });
    h.documentRef.visibilityState = "hidden";
    h.pulse(); h.pulse();
    await h.settle();
    expect(fetchValue).toHaveBeenCalledTimes(1);
    h.documentRef.visibilityState = "visible";
    h.handlers.get("visibilitychange")();
    await h.settle();
    expect(h.onValue).toHaveBeenLastCalledWith({ balance: 200 });
    h.stop();
    expect(h.clearIntervalFn).toHaveBeenCalledWith(42);
    expect(h.handlers.has("visibilitychange")).toBe(false);
  });

  it("coalesces overlapping network responses into one trailing refresh", async () => {
    let done;
    const fetchValue = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { done = resolve; }))
      .mockResolvedValueOnce({ amount: 2 });
    const h = scenario(fetchValue);
    await h.settle();
    h.pulse(); h.pulse();
    h.handlers.get("visibilitychange")();
    expect(fetchValue).toHaveBeenCalledTimes(1);
    done({ amount: 1 });
    await h.settle();
    expect(fetchValue).toHaveBeenCalledTimes(2);
    expect(h.onValue).toHaveBeenLastCalledWith({ amount: 2 });
    h.stop();
  });

  it("ignores stale responses after unmount and catches rejected snapshots", async () => {
    let done;
    const fetchValue = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    const h = scenario(fetchValue);
    await h.settle();
    expect(h.onError).toHaveBeenCalledTimes(1);
    h.pulse();
    await h.settle();
    h.stop();
    done({ amount: 999 });
    await h.settle();
    expect(h.onValue).not.toHaveBeenCalled();
    h.pulse();
    await h.settle();
    expect(fetchValue).toHaveBeenCalledTimes(2);
  });

  it("ignores null snapshots but accepts a valid zero-valued object", async () => {
    const fetchValue = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ amount: 0 });
    const h = scenario(fetchValue);
    await h.settle();
    expect(h.onValue).not.toHaveBeenCalled();
    h.pulse(); await h.settle();
    expect(h.onValue).toHaveBeenCalledWith({ amount: 0 });
    h.stop();
  });
});

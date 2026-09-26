import { describe, expect, it, vi } from "vitest";
import { coalesceRequest } from "./requestCoalescer.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe("scoped request coalescing", () => {
  it("reuses the first A through an A/B/A burst and allows a later refresh", async () => {
    const inFlight = new Map();
    const a = deferred(), b = deferred();
    const readA = vi.fn(() => a.promise), readB = vi.fn(() => b.promise);
    const first = coalesceRequest(inFlight, "apn_users", readA);
    const other = coalesceRequest(inFlight, "apn_training", readB);
    const again = coalesceRequest(inFlight, "apn_users", readA);
    expect(again).toBe(first);
    await Promise.resolve();
    expect(readA).toHaveBeenCalledTimes(1);
    expect(readB).toHaveBeenCalledTimes(1);
    b.resolve("B"); a.resolve("A");
    expect(await Promise.all([first, other, again])).toEqual(["A", "B", "A"]);
    await Promise.resolve();
    expect(inFlight.size).toBe(0);
    expect(await coalesceRequest(inFlight, "apn_users", readA)).toBe("A");
    expect(readA).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed read rather than caching the rejection", async () => {
    const inFlight = new Map();
    const read = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("fresh");
    await expect(coalesceRequest(inFlight, "transactions", read)).rejects.toThrow("offline");
    await Promise.resolve();
    await expect(coalesceRequest(inFlight, "transactions", read)).resolves.toBe("fresh");
    expect(read).toHaveBeenCalledTimes(2);
  });
});

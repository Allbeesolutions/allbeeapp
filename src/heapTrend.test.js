import { describe, expect, it } from "vitest";
import { heapRetentionResult } from "../scripts/ui/heapTrend.mjs";
const MiB = 1024 * 1024;
describe("Chromium SPA heap-retention guard", () => {
  it("passes stable retained heap after repeated route cycles", () => {
    const result = heapRetentionResult([14*MiB, 14.4*MiB, 14.2*MiB]);
    expect(result.pass).toBe(true);
    expect(result.checkpointsMiB).toEqual([14,14.4,14.2]);
  });
  it("flags a large sustained rise after the warmup checkpoint", () => {
    const result = heapRetentionResult([12*MiB, 19*MiB, 26*MiB]);
    expect(result.pass).toBe(false);
    expect(result.growthBytes).toBe(14*MiB);
  });
  it("uses conservative relative headroom for larger applications", () => {
    expect(heapRetentionResult([100*MiB, 110*MiB, 120*MiB]).pass).toBe(true);
    expect(heapRetentionResult([100*MiB, 125*MiB, 140*MiB]).pass).toBe(false);
  });
  it("rejects incomplete or non-finite measurements", () => {
    expect(() => heapRetentionResult([1,2])).toThrow();
    expect(() => heapRetentionResult([1,NaN,3])).toThrow();
  });
});

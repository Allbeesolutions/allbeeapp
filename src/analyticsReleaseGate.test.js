import { afterEach, describe, expect, it, vi } from "vitest";
import { customerAnalyticsEnabled } from "./analyticsReleaseGate.js";
afterEach(() => vi.unstubAllEnvs());
describe("staged AllBee customer analytics release", () => {
  it("defaults to disabled unless explicitly true", () => {
    expect(customerAnalyticsEnabled(undefined)).toBe(false);
    expect(customerAnalyticsEnabled("false")).toBe(false);
    expect(customerAnalyticsEnabled("1")).toBe(false);
    expect(customerAnalyticsEnabled(true)).toBe(false);
    expect(customerAnalyticsEnabled("true")).toBe(true);
  });
  it("uses the reviewed production release flag", () => {
    vi.stubEnv("VITE_CUSTOMER_ANALYTICS_ENABLED", "false");
    expect(customerAnalyticsEnabled()).toBe(false);
    vi.stubEnv("VITE_CUSTOMER_ANALYTICS_ENABLED", "true");
    expect(customerAnalyticsEnabled()).toBe(true);
  });
});

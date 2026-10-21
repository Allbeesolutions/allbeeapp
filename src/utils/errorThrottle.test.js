import { describe, expect, it, beforeEach } from "vitest";
import { pageErrorPayload, shouldSendCrashReport, resetCrashThrottleForTests } from "./errorTelemetry.js";

beforeEach(() => resetCrashThrottleForTests());

describe("privacy-safe crash telemetry throttling", () => {
  const make = (message, path = "/#/apn/chat") =>
    pageErrorPayload(new Error(message), { componentStack: "\n in ChatView" }, path, "build-A", "APNTabErrorBoundary");

  it("reports a unique failure once in a one-minute window", () => {
    const error = make("Render failed for example@example.org");
    expect(error.p_message).not.toContain("example@example.org");
    expect(shouldSendCrashReport(error, 10_000)).toBe(true);
    expect(shouldSendCrashReport(error, 10_005)).toBe(false);
    expect(shouldSendCrashReport(error, 69_999)).toBe(false);
    expect(shouldSendCrashReport(error, 70_000)).toBe(true);
  });

  it("does not suppress failures on different routes or with different fingerprints", () => {
    expect(shouldSendCrashReport(make("Broken list"), 50)).toBe(true);
    expect(shouldSendCrashReport(make("Broken list", "/#/client/chat"), 51)).toBe(true);
    expect(shouldSendCrashReport(make("Broken account"), 52)).toBe(true);
    expect(shouldSendCrashReport({ p_metadata: {} }, 53)).toBe(false);
  });

  it("does not grow an unbounded cache when many different components fail", () => {
    for (let i = 0; i < 350; i++) expect(shouldSendCrashReport(make("crash-" + i), 1000)).toBe(true);
    // Oldest record was pruned; new occurrence is eligible again.
    expect(shouldSendCrashReport(make("crash-0"), 1002)).toBe(true);
  });
});

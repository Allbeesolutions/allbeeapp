import { describe, expect, it } from "vitest";
import { sanitizeCrashText, pageErrorPayload, errorFingerprint } from "./errorTelemetry.js";

describe("safe page crash diagnostics", () => {
  it("groups repeat failures using a deterministic fingerprint", () => {
    const error = new TypeError("Cannot read properties of undefined");
    const x = pageErrorPayload(error, {componentStack:"\n in ChatScreen"}, "/#/apn/chat", "328a6a0");
    const y = pageErrorPayload(error, {componentStack:"\n in ChatScreen"}, "/#/apn/chat", "328a6a0");
    expect(x.p_metadata.fingerprint).toBe(y.p_metadata.fingerprint);
    expect(x.p_metadata.buildId).toBe("328a6a0");
    expect(x.p_metadata.source).toBe("PageErrorBoundary");
    expect(x.p_path).toBe("/#/apn/chat");
    expect(errorFingerprint("x")).not.toBe(errorFingerprint("y"));
  });
  it("redacts common private identifiers and limits payload size", () => {
    const x=pageErrorPayload(new Error("Failure for test.user@example.org ID 123e4567-e89b-12d3-a456-426614174000"),{componentStack:"\n in Admin"},"/#/chat/123e4567-e89b-12d3-a456-426614174000","release");
    expect(x.p_message).not.toContain("test.user@example.org");
    expect(x.p_path).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(x.p_message).toContain("[email]");
    expect(sanitizeCrashText("a ".repeat(2000)).length).toBe(1800);
  });
});

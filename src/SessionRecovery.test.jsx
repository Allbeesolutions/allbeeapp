import { describe, it, expect, vi } from "vitest";
import { createSessionRecovery } from "./sessionRecovery.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSessionRecovery", () => {
  it("coalesces concurrent refresh requests into one network call", async () => {
    let release;
    const refresh = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const recover = createSessionRecovery(refresh);
    const a = recover();
    const b = recover();
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    release("session");
    await expect(Promise.all([a, b])).resolves.toEqual(["session", "session"]);
  });

  it("allows a new refresh after the previous request settles", async () => {
    const refresh = vi.fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const recover = createSessionRecovery(refresh);
    await expect(recover()).resolves.toBe("first");
    await expect(recover()).resolves.toBe("second");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("reports refresh failure once and returns null", async () => {
    const error = new Error("expired");
    const refresh = vi.fn().mockRejectedValue(error);
    const onFailure = vi.fn();
    const recover = createSessionRecovery(refresh, onFailure);
    await expect(recover()).resolves.toBeNull();
    expect(onFailure).toHaveBeenCalledWith(error);
  });
});

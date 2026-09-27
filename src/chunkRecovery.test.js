import { describe, expect, it, vi } from "vitest";
import { isChunkLoadError, recoverFromChunkError } from "./chunkRecovery.js";

describe("chunk recovery", () => {
  it("recognizes stale dynamic import failures", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /assets/APNQuoteWizard-old.js"))).toBe(true);
    expect(isChunkLoadError(new Error("ordinary render failure"))).toBe(false);
  });

  it("reloads once for a stale deployed chunk and suppresses a reload loop", () => {
    const reload = vi.fn();
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
    const now = vi.spyOn(Date, "now").mockReturnValue(100000);
    const error = new TypeError("Failed to fetch dynamically imported module: /assets/APNQuoteWizard-old.js");

    expect(recoverFromChunkError(error, { location: { reload }, storage })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(recoverFromChunkError(error, { location: { reload }, storage })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });
});

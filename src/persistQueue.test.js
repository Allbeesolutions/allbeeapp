import { describe, expect, it, vi } from "vitest";
import { createPersistQueue } from "./persistQueue.js";

describe("persist queue race safety", () => {
  it("rebases after a failed write so the next mutation cannot overwrite server state", async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const rebase = vi.fn().mockResolvedValue({ value: 2 });
    const queue = createPersistQueue({ persist, rebase });
    await expect(queue({ value: 0 }, { value: 1 })).rejects.toThrow("network");
    await queue({ value: 1 }, { value: 3 });
    expect(rebase).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenNthCalledWith(2, { value: 2 }, { value: 3 });
  });

  it("serializes concurrent mutations in call order", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const queue = createPersistQueue({ persist, rebase: vi.fn() });
    await Promise.all([queue({ value: 0 }, { value: 1 }), queue({ value: 1 }, { value: 2 })]);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(persist.mock.invocationCallOrder[1]);
  });
});

import { describe, it, expect, vi } from "vitest";
import { createPersistQueue } from "./AllbeeApp.jsx";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createPersistQueue", () => {
  it("serializes rapid writes and preserves enqueue order", async () => {
    const order = [];
    let releaseFirst;
    const first = new Promise((resolve) => { releaseFirst = resolve; });
    const persist = vi.fn(async (_prev, next) => {
      order.push(`start:${next.value}`);
      if (next.value === "A") await first;
      order.push(`end:${next.value}`);
    });
    const rebase = vi.fn();
    const enqueue = createPersistQueue({ persist, rebase });

    const a = enqueue({ value: "base" }, { value: "A" });
    const b = enqueue({ value: "A" }, { value: "B" });
    await tick();
    expect(order).toEqual(["start:A"]);
    expect(persist).toHaveBeenCalledTimes(1);
    releaseFirst();
    await Promise.all([a, b]);
    expect(order).toEqual(["start:A", "end:A", "start:B", "end:B"]);
    expect(rebase).not.toHaveBeenCalled();
  });

  it("rebases the next queued write after a failed write", async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(undefined);
    const rebase = vi.fn().mockResolvedValue({ value: "committed" });
    const enqueue = createPersistQueue({ persist, rebase });

    const first = enqueue({ value: "base" }, { value: "A" });
    const second = enqueue({ value: "A" }, { value: "B" });
    await expect(first).rejects.toThrow("temporary failure");
    await expect(second).resolves.toBeUndefined();

    expect(rebase).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenNthCalledWith(1, { value: "base" }, { value: "A" });
    expect(persist).toHaveBeenNthCalledWith(2, { value: "committed" }, { value: "B" });
  });

  it("does not rebase after a successful write", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const rebase = vi.fn().mockResolvedValue({ value: "committed" });
    const enqueue = createPersistQueue({ persist, rebase });
    await enqueue({ value: "base" }, { value: "A" });
    await enqueue({ value: "A" }, { value: "B" });
    expect(rebase).not.toHaveBeenCalled();
  });
});

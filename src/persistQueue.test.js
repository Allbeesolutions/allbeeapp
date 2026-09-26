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
  it("rebases a partial multi-table save before an explicit retry", async () => {
    const server = { transactions: [], students: [{ id: "s1", paymentStatus: "Unpaid" }] };
    let failStudentOnce = true;
    const persist = vi.fn(async (base, next) => {
      // The transaction succeeds, then the related student update fails.
      server.transactions = next.transactions.map((row) => ({ ...row }));
      if (failStudentOnce) { failStudentOnce = false; throw new Error("Saving students: denied"); }
      server.students = next.students.map((row) => ({ ...row }));
    });
    const rebase = vi.fn(async () => structuredClone(server));
    const queue = createPersistQueue({ persist, rebase });
    const desired = { transactions: [{ id: "income-1", amount: 100 }], students: [{ id: "s1", paymentStatus: "Paid" }] };
    await expect(queue(structuredClone(server), desired)).rejects.toThrow("Saving students: denied");
    expect(server.transactions).toHaveLength(1);
    expect(server.students[0].paymentStatus).toBe("Unpaid");
    await queue({ transactions: [], students: [] }, desired);
    expect(rebase).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[1][0].transactions).toEqual(server.transactions);
    expect(server.transactions).toHaveLength(1);
    expect(server.students[0].paymentStatus).toBe("Paid");
  });
});

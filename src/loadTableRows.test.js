import { describe, expect, it } from "vitest";
import { loadTableRows } from "./loadTableRows.js";

function makeClient(dataset, failures = {}) {
  const calls = [];
  const attemptsByKey = {};
  const client = {
    calls,
    from(table) {
      let from = 0;
      let to = dataset.length - 1;
      const builder = {
        select() { return builder; },
        order() { return builder; },
        range(a, b) { from = a; to = b; calls.push([from, to]); return builder; },
        abortSignal() { return builder; },
        then(resolve, reject) {
          const key = `${table}:${from}`;
          attemptsByKey[key] = (attemptsByKey[key] || 0) + 1;
          const failCount = failures[key] || 0;
          if (attemptsByKey[key] <= failCount) return Promise.resolve({ data: null, error: { message: "transient" } }).then(resolve, reject);
          const end = calls.some(([start]) => start === from) ? to : Math.min(to, 999);
          return Promise.resolve({ data: dataset.slice(from, end + 1), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return client;
}

describe("loadTableRows pagination", () => {
  it.each([500, 1000, 1201])("loads all %i rows without loss or duplication", async (count) => {
    const rows = Array.from({ length: count }, (_, id) => ({ id }));
    const client = makeClient(rows);
    const result = await loadTableRows(client, "transactions", "id,data", "created_at", 1000, 0);
    expect(result).toEqual(rows);
    expect(client.calls).toEqual(
      count === 500 ? [[0, 499], [500, 999]] : [[0, 499], [500, 999], [1000, 1499]],
    );
  });

  it("stops on the final partial page", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const client = makeClient(rows);
    const result = await loadTableRows(client, "transactions", "id", undefined, 1000, 0);
    expect(result).toHaveLength(1201);
    expect(client.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("retries a failed page and preserves all rows", async () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const client = makeClient(rows, { "transactions:500": 1 });
    const result = await loadTableRows(client, "transactions", "id", undefined, 1000, 1);
    expect(result).toEqual(rows);
    expect(client.calls.filter(([from]) => from === 500)).toHaveLength(2);
  });

  it("keeps bootstrap first-page-only behavior when pagination is disabled", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const client = makeClient(rows);
    const result = await loadTableRows(client, "transactions", "id", undefined, 1000, 0, false);
    expect(result).toHaveLength(1000);
    expect(client.calls).toEqual([]);
  });
});

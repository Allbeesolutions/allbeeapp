import { describe, expect, it } from "vitest";
import { createDataReaders } from "./data/readers.js";

describe("route data reader contract", () => {
  it("returns scoped table names for every known route", () => {
    const { routeDataTables } = createDataReaders({
      supabase: {},
      emptyDB: () => ({}),
      loadTableRows: async () => [],
    });

    expect(routeDataTables("dashboard")).toContain("notifications");
    expect(routeDataTables("dashboard")).toContain("tasks");
    expect(routeDataTables("accounts")).toContain("notifications");
    expect(routeDataTables("accounts")).toContain("transactions");
    expect(routeDataTables("finance")).toContain("apn_withdrawal_requests");
    expect(routeDataTables("apnadmin")).toContain("apn_action_badge_reads");
    expect(routeDataTables("unknown-route")).toEqual(routeDataTables("dashboard"));
  });
});

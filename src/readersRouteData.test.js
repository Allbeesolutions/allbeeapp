import { describe, expect, it } from "vitest";
import { createDataReaders } from "./data/readers.js";
import { NAV } from "./app/navigation.js";

describe("route data reader contract", () => {
  it("returns scoped table names for every known route", () => {
    const { routeDataTables, knownRoutes } = createDataReaders({
      supabase: {},
      emptyDB: () => ({}),
      loadTableRows: async () => [],
    });

    expect(NAV.map(([key]) => key).filter((key) => !knownRoutes.includes(key))).toEqual([]);
    expect(routeDataTables("dashboard")).toContain("notifications");
    expect(routeDataTables("dashboard")).toContain("tasks");
    expect(routeDataTables("accounts")).toContain("notifications");
    expect(routeDataTables("accounts")).toContain("transactions");
    expect(routeDataTables("withdrawals")).toContain("withdrawals");
    expect(routeDataTables("planned")).toContain("planned");
    expect(routeDataTables("staff-salary")).toContain("payroll");
    expect(routeDataTables("recently-deleted")).toContain("recycle");
    expect(routeDataTables("audit")).toContain("audit");
    expect(routeDataTables("myteam")).toContain("teams");
    expect(routeDataTables("prompts")).toContain("prompts");
    expect(routeDataTables("finance")).toContain("apn_withdrawal_requests");
    expect(routeDataTables("apnadmin")).toContain("apn_action_badge_reads");
    expect(routeDataTables("unknown-route")).toEqual(routeDataTables("dashboard"));
    expect(routeDataTables("dashboard", "partner")).toContain("apn_users");
    expect(routeDataTables("dashboard", "partner")).toContain("apn_zone_requests");
    expect(routeDataTables("dashboard", "partner")).toContain("apn_commission_projects");
    expect(routeDataTables("dashboard", "partner")).not.toContain("transactions");
    expect(routeDataTables("dashboard", "staff")).not.toContain("apn_users");
  });
});

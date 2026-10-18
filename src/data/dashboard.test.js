import { describe, expect, it, vi } from "vitest";
import { fetchDashboardSnapshot, fetchFinanceAccountBalances } from "./dashboard.js";

const fake = (rpc) => ({ rpc: vi.fn(rpc) });

describe("independent dashboard RPC fallbacks", () => {
  it("keeps successful sections when an unrelated RPC rejects", async () => {
    const s = fake(async (name) => {
      if (name === "finance_v5_dashboard") throw new Error("temporary network outage");
      if (name === "crm_v5_dashboard") return { data: { clients: 4 }, error: null };
      return { data: { insights: [] }, error: null };
    });
    const result = await fetchDashboardSnapshot(s);
    expect(result.finance).toBeNull();
    expect(result.crm).toEqual({ clients: 4 });
    expect(result.ai).toEqual({ insights: [] });
    expect(s.rpc).toHaveBeenCalledTimes(3);
    expect(Number.isFinite(Date.parse(result.generatedAt))).toBe(true);
  });
  it("treats RPC error objects and missing data as unavailable, not valid dashboards", async () => {
    const s = fake(async (name) => {
      if (name === "finance_v5_dashboard") return { data: { untrusted: true }, error: { message: "forbidden" } };
      if (name === "crm_v5_dashboard") return null;
      return { data: { alerts: 2 }, error: null };
    });
    const result = await fetchDashboardSnapshot(s);
    expect(result).toMatchObject({ finance: null, crm: null, ai: { alerts: 2 } });
  });
  it("does not weaken the authoritative finance balance error path", async () => {
    await expect(fetchFinanceAccountBalances(fake(async () => ({ data: null, error: { message: "Permission denied" } })))).rejects.toThrow("Permission denied");
  });
});

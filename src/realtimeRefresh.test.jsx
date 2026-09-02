import { describe, expect, it } from "vitest";
import { mergeScopedRealtimeState, normalizeRealtimeTableSet } from "./realtimeRefresh.js";

describe("realtime scoped refresh helpers", () => {
  it("normalizes and deduplicates dirty table scopes", () => {
    expect(normalizeRealtimeTableSet(["crm_leads", "apn_users", "crm_leads"])).toEqual(["apn_users", "crm_leads"]);
    expect(normalizeRealtimeTableSet([])).toBeNull();
  });

  it("preserves unrelated state during a scoped refresh", () => {
    const current = { apn_users: [{ id: "old" }], clients: [{ id: "keep" }], crm_leads: [{ id: "old-lead" }] };
    const fresh = { apn_users: [{ id: "new" }], crm_leads: [{ id: "new-lead" }] };
    expect(mergeScopedRealtimeState(current, fresh, ["crm_leads", "apn_users"])).toEqual({
      apn_users: [{ id: "new" }], clients: [{ id: "keep" }], crm_leads: [{ id: "new-lead" }],
    });
  });
});

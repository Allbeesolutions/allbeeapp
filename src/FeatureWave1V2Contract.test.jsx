import { describe, it, expect } from "vitest";
import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
describe("Feature Wave 1/2 integration contracts", () => {
  it("provides a role-agnostic command center and mobile navigation", () => {
    const search = read("src/GlobalSearch.jsx");
    const app = read("src/AllbeeApp.jsx");
    expect(search).toContain("Open Dashboard");
    expect(search).toContain("Command center");
    expect(app).toContain("mobile-bottom-nav");
  });
  it("persists dashboard personalization", () => {
    const app = read("src/AllbeeApp.jsx");
    expect(app).toContain("allbee_dashboard_widgets");
    expect(app).toContain("Dashboard widgets");
  });
  it("has resilient offline/reconnect UX", () => {
    const app = read("src/AllbeeApp.jsx");
    expect(app).toContain("Back online — syncing ALLBEE");
    expect(app).toContain("Offline mode");
    expect(app).toContain("Retry sync");
  });
  it("keeps AI gateway invocation compatible across AI surfaces", () => {
    const gateway = read("src/ai/gateway.js");
    const crm = read("src/EnterpriseCRM.jsx");
    const ai = read("src/AllbeeAI.jsx");
    expect(gateway).toContain("client = supabase");
    expect(crm).toContain("callAI(cfg");
    expect(ai).toContain("callAI(cfg");
  });
  it("routes the AI automation surface correctly", () => {
    const ai = read("src/AIIntelligenceCenter.jsx");
    expect(ai).toContain('tab === "automation" && <AutomationV4');
  });
});

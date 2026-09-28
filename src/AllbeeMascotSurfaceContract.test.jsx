import { describe, it, expect } from "vitest";
import fs from "node:fs";
const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");
const client = fs.readFileSync("src/ClientPortal.jsx", "utf8");
const ai = fs.readFileSync("src/AllbeeAI.jsx", "utf8");
const mascot = fs.readFileSync("src/ui/AllbeeMascot.jsx", "utf8");

describe("ALLBEE mascot surface coverage", () => {
  it("uses the transparent canonical PNG artwork", () => {
    expect(mascot).toContain('/allbee-ai-mascot.png');
    expect(mascot).not.toContain('/allbee-ai-mascot.jpeg');
  });
  it("keeps the floating assistant on every APN tab while hiding only transient overlays", () => {
    expect(app).toContain('surface="apn"');
    expect(app).toContain('hidden={!!modal || searchOpen || sidebarOpen}');
    expect(app).not.toContain('["home", "ai", "leads", "quotations", "chat"].includes(tab)');
  });
  it("mounts the same actionable launcher across internal workspace and login", () => {
    expect(app).toContain('surface="workspace"');
    expect(app).toContain('onOpen={() => go("assistant")}');
    expect(app).toContain('surface="login"');
    expect(app).toContain('onOpen={() => setOpen(true)}');
  });
  it("gives clients a scoped ALLBEE AI surface instead of workspace memory", () => {
    expect(client).toContain('surface="client"');
    expect(client).toContain('role="client"');
    expect(client).toContain('clientAIDb');
    expect(ai).toContain('if (!configured || isClient) return;');
    expect(ai).toContain('if (!isClient) try');
    expect(ai).toContain('Never reveal or infer internal staff information');
  });
});

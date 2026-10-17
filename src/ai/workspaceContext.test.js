import { describe, expect, it } from "vitest";
import { buildAIContext } from "./workspaceContext.js";

describe("AI workspace snapshot isolated module", () => {
  it("keeps the existing task ownership context and masks contacts", () => {
    const text = buildAIContext({
      clients: [{ id: "c1", name: "Client One", email: "person@example.com", phone: "9876543210", notes: "Call 9876543210" }],
      tasks: [{ title: "Prepare proposal", status: "In Progress", assignees: ["Owner"] }],
      quotations: [{ client: "Client One", items: [{ desc: "Landing page", qty: 2, rate: 3000 }], total: 6000 }],
    }, { name: "AllBee" }, (task) => task.assignees?.join(", ") || "—");
    expect(text).toContain("COMPANY: AllBee");
    expect(text).toContain("Prepare proposal · Owner · In Progress");
    expect(text).toContain("Landing page x2");
    expect(text).not.toContain("person@example.com");
    expect(text).not.toContain("9876543210");
  });

  it("never crashes when partial databases or nested arrays are malformed", () => {
    expect(buildAIContext(null, null)).toContain("COMPANY: ALLBEE Solutions");
    const result = buildAIContext({
      clients: { malformed: true }, leads: "unavailable",
      quotations: [{ client: "Example", items: { wrong: true } }],
      tasks: [{ title: "Open", status: "Pending" }, null, "malformed"],
      documents: [null, { title: "Details", notes: "Email me at help@example.org" }],
    }, {});
    expect(result).toContain("Open");
    expect(result).toContain("Details");
    expect(result).not.toContain("help@example.org");
    expect(result.length).toBeLessThanOrEqual(12100);
  });

  it("stays bounded even with a huge workspace", () => {
    const result = buildAIContext({ audit: Array.from({ length: 150 }, (_, i) => ({
      ts: Date.now(), user: "System", description: "A".repeat(1000) + i
    })) }, { name: "AllBee" });
    expect(result.length).toBeLessThanOrEqual(12100);
    expect(result).toContain("snapshot truncated");
  });
});

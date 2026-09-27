import { describe, expect, it } from "vitest";
import { friendlyAIErrorText, stripInternalRecordIds } from "./aiText.jsx";

describe("AI response hygiene", () => {
  it("reduces provider TPM errors to the retry countdown only", () => {
    const raw = "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_secret` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 4916, Requested 5165. Please try again in 15.6075s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing";
    expect(friendlyAIErrorText(new Error(raw))).toBe("Please try again in 15.6075s.");
  });

  it("removes internal UUIDs and record-id labels from displayed answers", () => {
    const raw = "Record ID: d32be198-90e1-40d8-b23d-66aaf903e87e · ₹30 pending";
    const clean = stripInternalRecordIds(raw);
    expect(clean).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    expect(clean).not.toMatch(/record id/i);
    expect(clean).toContain("₹30 pending");
  });

  it("removes internal-id columns from Markdown tables", () => {
    const raw = "| Type | Record ID | Amount | Status |\n| --- | --- | ---: | --- |\n| State | d32be198-90e1-40d8-b23d-66aaf903e87e | ₹30 | Pending |";
    const clean = stripInternalRecordIds(raw);
    expect(clean).toBe("| Type | Amount | Status |\n| --- | ---: | --- |\n| State | ₹30 | Pending |");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createDataReaders } from "./data/readers.js";

const makeReaders = () => {
  const loadTableRows = vi.fn(async () => []);
  return { ...createDataReaders({ supabase: {}, emptyDB: () => ({}), loadTableRows }), loadTableRows };
};

describe("mocked role bootstrap request scopes", () => {
  it("loads client portal sources without finance or APN internals", async () => {
    const { fetchBootstrapData, loadTableRows } = makeReaders();
    await fetchBootstrapData({ role: "client", route: "dashboard" });
    const reads = loadTableRows.mock.calls.map(([, table]) => table);
    expect(reads).toContain("support_tickets");
    expect(reads).toContain("portal_posts");
    expect(reads).not.toContain("transactions");
    expect(reads).not.toContain("apn_users");
    expect(new Set(reads).size).toBe(reads.length);
  });

  it("loads the internal dashboard shell once and leaves APN to its route", async () => {
    const { fetchBootstrapData, loadTableRows } = makeReaders();
    await fetchBootstrapData({ role: "staff", route: "dashboard" });
    const reads = loadTableRows.mock.calls.map(([, table]) => table);
    expect(reads).toContain("tasks");
    expect(reads).toContain("attendance");
    expect(reads).not.toContain("apn_commission_projects");
    expect(reads).not.toContain("crm_leads");
    expect(new Set(reads).size).toBe(reads.length);
  });

  it("loads a partner direct link to Learn without the home commission data", async () => {
    const { fetchBootstrapData, loadTableRows } = makeReaders();
    await fetchBootstrapData({ role: "partner", route: "dashboard", tab: "learn" });
    const reads = loadTableRows.mock.calls.map(([, table]) => table);
    expect(reads).toContain("apn_training");
    expect(reads).not.toContain("apn_commission_projects");
    expect(reads).not.toContain("transactions");
    expect(new Set(reads).size).toBe(reads.length);
  });
});

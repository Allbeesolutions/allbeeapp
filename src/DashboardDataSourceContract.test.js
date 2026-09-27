import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard source-of-truth contracts", () => {
  it("finance v5 APN collection KPI reads the APN collection engine, not CRM-only receipts", () => {
    const sql = fs.readFileSync("supabase/migrations/20260927213000_fix_dashboard_data_truth.sql", "utf8");
    expect(sql).toContain("from public.apn_revenue_collections c");
    expect(sql).toContain("join public.apn_commission_projects p");
    expect(sql).not.toContain("from public.crm_revenue_collections where status<>'Cancelled'");
  });

  it("backup snapshots are rebuilt from a complete fetch instead of current route state", () => {
    const readers = fs.readFileSync("src/data/readers.js", "utf8");
    expect(readers).toMatch(/async function buildBackupSnapshot\(_db\)[\s\S]*?return fetchAll\(\);/);
  });
});

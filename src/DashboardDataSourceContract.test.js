import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard source-of-truth contracts", () => {
  it("finance v5 APN collection KPI reads the APN collection engine, not CRM-only receipts", () => {
    const sql = fs.readFileSync("supabase/migrations/20260927213000_fix_dashboard_data_truth.sql", "utf8");
    expect(sql).toContain("from public.apn_revenue_collections c");
    expect(sql).toContain("join public.apn_commission_projects p");
    expect(sql).not.toContain("from public.crm_revenue_collections where status<>'Cancelled'");
  });

  it("keeps the finance reconciliation response compatible with the Accounts UI", () => {
    const sql = fs.readFileSync("supabase/migrations/20260927214500_preserve_finance_v5_reconciliation_contract.sql", "utf8");
    expect(sql).toContain("'exceptions', exceptions");
    expect(sql).toContain("'commission_ledger_to_expense_gap'");
    expect(sql).toContain("from public.apn_revenue_collections c");
  });

  it("backup snapshots are rebuilt from a complete fetch instead of current route state", () => {
    const readers = fs.readFileSync("src/data/readers.js", "utf8");
    expect(readers).toMatch(/async function buildBackupSnapshot\(_db\)[\s\S]*?return fetchAll\(\);/);
  });
  it("never renders a route against an unloaded scoped snapshot", () => {
    const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");
    expect(app).toContain("unloaded arrays can never masquerade as legitimate 0 / empty business data");
    expect(app).toContain('if (routeDataLoading && safeRoute !== "apn" && !taskDetailId && !accountUser)');
    expect(app).toContain("setRouteDataLoading(scope.length > 0)");
  });

  it("hydrates authoritative APN sources before rendering income/expense forms", () => {
    const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");
    expect(app).toContain('FINANCE_INCOME_FORM_TABLES = Object.freeze(["transactions", "apn_users", "apn_leads", "apn_commissions", "apn_commission_projects", "apn_revenue_collections", "apn_referral_relationships"]');
    expect(app).toContain('fetchAll({ includeTables: tables })');
    expect(app).toContain('financeFormLoading ? <Modal title="Loading income"');
  });

  it("keeps APN payout wording distinct from future commission potential", () => {
    const admin = fs.readFileSync("src/APNAdminCommissions.jsx", "utf8");
    const entry = fs.readFileSync("src/APNCommissionEntry.jsx", "utf8");
    const health = fs.readFileSync("src/modules/apn/health.js", "utf8");
    expect(admin).toContain("remaining potential");
    expect(entry).toContain("Remaining commission potential");
    expect(health).toContain("s.commission.authoritative &&");
  });

});

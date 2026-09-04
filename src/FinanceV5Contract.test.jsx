import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sql = read("supabase/migrations/20260904162000_finance_v5_certification.sql");
const app = read("src/AllbeeApp.jsx");

describe("Finance v5 contracts", () => {
  it("provides authoritative transaction and APN reconciliation totals", () => {
    expect(sql).toContain("finance_v5_dashboard");
    expect(sql).toContain("apn_finance_expense_map");
    expect(sql).toContain("commission_ledger_to_expense_gap");
    expect(sql).toContain("paid_withdrawals");
  });
  it("provides explicit reconciliation exception classes", () => {
    expect(sql).toContain("missing_commission_expenses");
    expect(sql).toContain("orphan_finance_maps");
    expect(sql).toContain("duplicate_finance_transactions");
    expect(sql).toContain("negative_transaction_amounts");
  });
  it("keeps finance dashboard and reconciliation admin-only", () => {
    expect(sql).toContain("revoke execute on function public.finance_v5_dashboard() from public,anon");
    expect(sql).toContain("revoke execute on function public.finance_v5_reconciliation() from public,anon");
    expect(sql).toContain("if not public.is_admin() then raise exception 'Finance dashboard requires admin access.'");
  });
  it("surfaces Finance v5 controls in Share & accounts", () => {
    expect(app).toContain("finance_v5_dashboard");
    expect(app).toContain("Finance v5 control panel");
    expect(app).toContain("Reconciliation");
  });
});

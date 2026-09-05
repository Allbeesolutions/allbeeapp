import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sql = read("supabase/migrations/20260904162000_finance_v5_certification.sql");
const combinedSql = read("supabase/migrations/20260906010000_combine_apn_commission_finance_entries.sql");
const app = read("src/AllbeeApp.jsx");
const reconFinalSql = read("supabase/migrations/20260906030000_finance_reconciliation_final_scope.sql");

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
  it("uses one Finance deduction for the APN commission pool with component breakdown", () => {
    expect(combinedSql).toContain("apn_consolidate_finance_commission_expense");
    expect(combinedSql).toContain("apnCommissionCombined");
    expect(combinedSql).toContain("apnPartnerCommission");
    expect(combinedSql).toContain("apnReferralCommission");
    expect(combinedSql).toContain("apnDistrictCommission");
    expect(combinedSql).toContain("apnStateCommission");
    expect(combinedSql).toContain("single transaction");
  });
  it("keeps company balance separate and adds unwithdrawn APN commission to Account balance", () => {
    expect(app).toContain("const company = round2(Haji + Alim)");
    expect(app).toContain("Number(w.earned) || 0");
    expect(app).toContain("Number(w.withdrawn) || 0");
    expect(app).toContain("company + apnCommission");
    expect(app).toContain("Account balance");
    expect(app).toContain("bal.account");
  });
  it("ignores historical orphan APN ledger rows while checking live reconciliation", () => {
    expect(reconFinalSql).toContain("posted APN income");
    expect(reconFinalSql).toContain("missing_commission_expenses");
    expect(reconFinalSql).toContain("exceptions");
  });
  it("explains the forward forecast and keeps reconciliation text inside its card", () => {
    expect(app).toContain("Projected net cash · next 3 months");
    expect(app).toContain("Review Finance reconciliation");
    expect(app).toContain('whiteSpace: "normal"');
  });
});

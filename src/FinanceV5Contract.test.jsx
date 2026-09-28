import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sql = read("supabase/migrations/20260904162000_finance_v5_certification.sql");
const combinedSql = read("supabase/migrations/20260906010000_combine_apn_commission_finance_entries.sql");
const app = read("src/AllbeeApp.jsx");
const accounts = read("src/modules/finance/Accounts.jsx");
const planned = read("src/modules/finance/Planned.jsx");
const withdrawals = read("src/modules/finance/Withdrawals.jsx");
const reconFinalSql = read("supabase/migrations/20260906030000_finance_reconciliation_final_scope.sql");
const balanceAuthoritySql = read("supabase/migrations/20260927155000_finance_account_balances_authority.sql");
const walletTimeSql = read("supabase/migrations/20260927161500_finance_wallet_time_consistency.sql");
const paidRepairSql = read("supabase/migrations/20260927163000_paid_withdrawal_finance_reconciliation.sql");
const payoutGuardSql = read("supabase/migrations/20260927164000_apn_payout_double_count_guard.sql");
const liabilityStatusSql = read("supabase/migrations/20260927165000_finance_liability_status_integrity.sql");
const apnAiEdge = read("supabase/functions/apn-ai/index.ts");

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
    expect(accounts).toMatch(/import React, \{[^}]*useCallback[^}]*useEffect[^}]*useMemo[^}]*useState[^}]*\} from "react"/);
    expect(app).toContain("finance_v5_dashboard");
    expect(accounts).toContain("Finance v5 control panel");
    expect(accounts).toContain("Reconciliation");
  });
  it("keeps extracted finance screens bound to every React hook they use", () => {
    for (const source of [accounts, planned, withdrawals]) {
      expect(source).toMatch(/import React, \{[^}]*useState[^}]*\} from "react"/);
      for (const hook of ["useEffect", "useMemo", "useCallback", "useRef"]) {
        if (new RegExp("\\\\b" + hook + "\\\\b").test(source)) expect(source.split("\\n").slice(0, 12).join("\\n")).toContain(hook);
      }
    }
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
    expect(app).toContain("AccountBalanceDetail");
    expect(app).toContain("APN partner balances");
    expect(app).toContain("unwithdrawn");
  });
  it("provides one server-side account balance authority for finance users", () => {
    expect(balanceAuthoritySql).toContain("finance_account_balances");
    expect(balanceAuthoritySql).toContain("public.can_finance()");
    expect(balanceAuthoritySql).toContain("greatest(0,coalesce(w.earned,0)-coalesce(w.withdrawn,0))");
    expect(balanceAuthoritySql).toContain("'account',round(v_company+v_apn_unwithdrawn,2)");
    expect(balanceAuthoritySql).toContain("'partner_balances',v_partners");
    expect(app).toContain("fetchFinanceAccountBalances");
    expect(app).toContain("financeBalances.apn_unwithdrawn");
    expect(app).toContain("authoritative={financeBalances}");
  });
  it("refreshes date-derived APN wallet balances before finance, portal, and AI reads", () => {
    expect(walletTimeSql).toContain("v_current_eligible := greatest(0, v_gross_eligible - v_withdrawn)");
    expect(walletTimeSql).toContain("v_total_balance := greatest(0, v_earned - v_withdrawn)");
    expect(walletTimeSql).toContain("perform public.apn_consolidated_wallet_refresh(v_pid)");
    expect(walletTimeSql).toContain("perform public.apn_withdrawal_refresh_wallet(v_pid)");
    expect(walletTimeSql).toContain("language plpgsql volatile security definer");
    expect(app).toContain("window.setInterval(loadSnapshot, 5 * 60 * 1000)");
    expect(apnAiEdge).toContain('supabase.rpc("apn_partner_financial_snapshot")');
    expect(apnAiEdge).toContain("Financial data is refreshing. Please try again shortly.");
  });
  it("keeps paid APN settlements in the finance journal without double-expensing accrued commission", () => {
    expect(paidRepairSql).toContain("historicalReconciliation");
    expect(paidRepairSql).toContain("apn_withdrawal_finance_transactions");
    expect(payoutGuardSql).toContain("Paying that already-accrued liability is a cash/liability settlement, not a second expense");
    expect(payoutGuardSql).toContain("return new;");
    expect(payoutGuardSql).toContain("delete from public.transactions");
    expect(app).toContain('String(t.source || "").toLowerCase() === "apn-withdrawal"');
  });
  it("keeps unpaid APN liabilities in Account balance regardless of login status", () => {
    expect(liabilityStatusSql).toContain("Financial liabilities survive account-status changes");
    expect(liabilityStatusSql).toContain("for r in select u.id from public.apn_users u loop");
    expect(liabilityStatusSql).toContain("from public.apn_consolidated_wallets w");
    expect(liabilityStatusSql).not.toContain("not in ('inactive','suspended','deleted')");
    expect(app).toContain("Access status must");
    expect(app).toContain("unpaid APN partner balances");
  });
  it("ignores historical orphan APN ledger rows while checking live reconciliation", () => {
    expect(reconFinalSql).toContain("posted APN income");
    expect(reconFinalSql).toContain("missing_commission_expenses");
    expect(reconFinalSql).toContain("exceptions");
  });
  it("explains the forward forecast and keeps reconciliation text inside its card", () => {
    expect(accounts).toContain("Projected net cash · next 3 months");
    expect(accounts).toContain("Review Finance reconciliation");
    expect(accounts).toContain('whiteSpace: "normal"');
  });
});

describe("withdrawal internal RPC grants", () => {
  it("keeps privileged wallet helpers off the client Data API", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260929100500_harden_withdrawal_internal_rpc_grants.sql"), "utf8");
    expect(sql).toContain("apn_withdrawal_notify(text,text,text,text,text) from public, anon, authenticated");
    expect(sql).toContain("apn_withdrawal_refresh_wallet(text) from public, anon, authenticated");
    expect(sql).toContain("apn_withdrawal_source_totals(text,text) from public, anon, authenticated");
    expect(sql).toContain("alter default privileges for role postgres in schema public revoke execute on functions from public");
  });
});

import { describe, expect, it } from "vitest";
import { apnCommissionDashboardSummary, apnPartnerStats } from "./modules/apn/analytics.js";

describe("APN dashboard data truth", () => {
  const base = {
    apn_commission_projects: [{
      id: "p1", partnerId: "partner-1", projectName: "Python class", projectValue: 3000,
      commissionRate: 20, maximumCommission: 600, totalCommissionPaid: 0, status: "Completed",
    }],
    apn_revenue_collections: [{
      id: "c1", projectId: "p1", partnerId: "partner-1", receivedAmount: 3000,
      commissionGenerated: 600, commissionStatus: "Pending", receivedDate: "2026-08-08",
    }],
    apn_consolidated_wallets: [
      { partner_id: "partner-1", earned: 600, withdrawn: 600, total_balance: 0 },
      { partner_id: "head-1", earned: 60, withdrawn: 0, total_balance: 60 },
    ],
  };

  it("shows project collections plus authoritative earned, paid and unpaid wallet values", () => {
    expect(apnCommissionDashboardSummary(base)).toMatchObject({
      totalValue: 3000, totalReceived: 3000, outstanding: 0,
      commissionEarned: 660, commissionPaid: 600, pendingCommission: 60,
      processingProjects: 0, completedProjects: 1, projects: 1, collections: 1,
    });
  });

  it("does not mistake future commission potential for unpaid earned commission", () => {
    const db = {
      apn_commission_projects: [{ id: "p2", projectValue: 10000, commissionRate: 20, maximumCommission: 2000, totalCommissionPaid: 200, status: "Processing" }],
      apn_revenue_collections: [{ id: "c2", projectId: "p2", receivedAmount: 5000, commissionGenerated: 1000, commissionStatus: "Pending" }],
      apn_consolidated_wallets: [],
    };
    const summary = apnCommissionDashboardSummary(db);
    expect(summary.commissionEarned).toBe(1000);
    expect(summary.commissionPaid).toBe(200);
    expect(summary.pendingCommission).toBe(800);
    expect(summary.remainingCommissionPotential).toBe(1000);
  });

  it("uses the consolidated wallet for partner earned, payable and paid values", () => {
    const db = { ...base, apn_leads: [], apn_commissions: [] };
    expect(apnPartnerStats(db, "partner-1").commission).toMatchObject({
      earned: 600, pending: 0, payable: 0, paid: 600,
    });
  });

  it("does not call unearned future commission a pending payout in fallback mode", () => {
    const db = {
      apn_leads: [], apn_commissions: [], apn_consolidated_wallets: [],
      apn_commission_projects: [{ id: "p3", partnerId: "partner-3", projectValue: 10000, commissionRate: 20, maximumCommission: 2000, totalCommissionPaid: 200, status: "Processing" }],
      apn_revenue_collections: [{ id: "c3", projectId: "p3", partnerId: "partner-3", receivedAmount: 5000, commissionGenerated: 1000, commissionStatus: "Pending" }],
    };
    const stats = apnPartnerStats(db, "partner-3");
    expect(stats.commission).toMatchObject({ earned: 1000, paid: 200, pending: 800, authoritative: false });
  });

  it("excludes cancelled projects from operational totals", () => {
    const db = {
      ...base,
      apn_commission_projects: [...base.apn_commission_projects, { id: "cancelled", projectValue: 9999, commissionRate: 20, status: "Cancelled" }],
      apn_revenue_collections: [...base.apn_revenue_collections, { id: "cx", projectId: "cancelled", receivedAmount: 9999, commissionGenerated: 1999.8 }],
    };
    expect(apnCommissionDashboardSummary(db)).toMatchObject({ totalValue: 3000, totalReceived: 3000, projects: 1, collections: 1 });
  });
});

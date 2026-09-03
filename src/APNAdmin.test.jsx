import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import APNAdmin from "./APNAdmin.jsx";

const Child = ({ children }) => <div>{children}</div>;
const runtime = {
  supabase: { from: vi.fn(), rpc: vi.fn() }, todayISO: () => "2026-09-03", money: (n) => `₹${n || 0}`,
  fmtDate: () => "date", fmtDateTime: () => "date-time", uid: () => "id", emitToast: vi.fn(),
  Confirm: Child, Modal: Child, Field: Child, SelectOther: Child, Empty: Child, Avatar: Child,
  APNAdminActivityLog: Child, APNAdminHub: Child, APNAdminPartners: Child, APNAdminLeads: Child,
  APNAdminCommissions: Child, APNAdminWithdrawals: Child, APNAdminReferrals: Child, APNAdminSupport: Child,
  APNAdminContent: Child, APNAdminDocs: Child, APNAdminAgreements: Child, APNAdminLeaderboard: Child,
  Search: Child, Plus: Child, XCircle: Child, ShieldCheck: Child, UserPlus: Child, Hourglass: Child, Ban: Child, Trash2: Child, Pencil: Child, Save: Child, Check: Child, X: Child,
  ChevronRight: Child, ChevronDown: Child, ArrowRight: Child, Download: Child, FileText: Child,
  Activity: Child, Filter: Child, Send: Child, Eye: Child, MoreVertical: Child, AlertTriangle: Child,
  Target: Child, Bell: Child, Users: Child, Globe2: Child, Lightbulb: Child, TrendingUp: Child, Megaphone: Child, ShieldHalf: Child, Child, ActionBadge: ({ count }) => <span>{count}</span>,
  APN_ACTION_BADGE_MAP: [], APN_COMM_REVERSED: "Reversed",
  apnAdminActionCounts: () => ({ partners: 0, commissions: 0, withdrawals: 0, referrals: 0, targets: 0, content: 0, docs: 0, notify: 0, total: 0 }),
  apnApprovalNotification: vi.fn(), apnApproverFor: () => ({ designation: "Admin" }), apnBuildCommissions: vi.fn(),
  apnEffectiveStatus: (p) => p.status, apnAvatarUrl: () => "", apnAdminLevel: () => "Trainee", apnStatusClass: () => "", apnHealthScore: () => ({ score: 0 }), apnLastSeenLabel: () => "Never Logged In",
  apnMetricLabel: (x) => x || "", apnNotificationSender: () => ({ name: "Admin", designation: "Admin" }),
  apnNotify: (x) => x, apnPercent: vi.fn(), apnSafeHtml: (x) => x, apnStatusLabel: (x) => x || "Pending",
  apnTargetProgress: () => ({ raw: 0, goal: 0, pct: 0 }), apnTimelineEntry: vi.fn(), apnDerivedTimeline: () => [],
  apnRevenueCollectionsOf: () => [], apnPartnerStats: () => ({}), apnRateForPrior: () => 0, apnProjectStatus: () => "Processing",
  apnFinancePostedFor: () => ({}), apnIdFor: () => "APN-TEST", apnLeaderboard: () => [],
};

beforeEach(() => cleanup());

describe("APN Admin runtime contract", () => {
  it("renders the admin tabs without ReferenceError", async () => {
    const db = {
      apn_users: [{ id: "p1", name: "Partner", status: "active" }],
      apn_action_badge_reads: [], apn_revenue_collections: [], apn_commissions: [], apn_withdrawal_requests: [],
      apn_withdrawal_batches: [], apn_referral_earnings: [], apn_targets: [], apn_training: [], apn_quizzes: [],
      apn_documents: [], apn_notifications: [], apn_timeline: [], apn_transfer_history: [],
    };
    render(<APNAdmin db={db} people={db.apn_users} mutate={vi.fn()} isSuper={true} isAdmin={true}
      currentUser="Haji" currentUserId="p1" refreshPeople={vi.fn()} onFocusConsumed={vi.fn()} runtime={runtime} />);
    expect(screen.getByText("APN — Partner Network")).toBeTruthy();
    expect(screen.getByText("Partners")).toBeTruthy();
    for (const label of ["Hub", "Partners", "Leads", "Commissions", "Withdrawals", "Referrals", "Support", "Targets", "Training", "Materials", "Agreements", "Notify", "Leaderboard"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
      await waitFor(() => expect(screen.queryByText("Something went wrong rendering the app.")).toBeNull(), { timeout: 1500 });
    }
  });
});

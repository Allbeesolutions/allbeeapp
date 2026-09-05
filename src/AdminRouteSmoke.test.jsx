import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import * as Icons from "./icons.jsx";
import { APNAdminHub, APNAdminPartners, APNAdminLeads, APNPartnerProfile, APNCommissionReverseModal, APNTagForm, APNPartnerDocumentForm, APNCommunicationForm } from "./APNPartnerProfile.jsx";
import AIIntelligenceCenter from "./AIIntelligenceCenter.jsx";
import PricingKnowledgeCenter from "./PricingKnowledgeCenter.jsx";
import ProposalCenter from "./ProposalCenter.jsx";
import Attendance from "./Attendance.jsx";
import Leave from "./Leave.jsx";
import TeamLeads from "./TeamLeads.jsx";
import StaffSalary from "./StaffSalary.jsx";
import EnterpriseCRM from "./EnterpriseCRM.jsx";
import Clients from "./Clients.jsx";
import Quotations from "./Quotations.jsx";
import Invoices from "./Invoices.jsx";
import PortalPosts from "./PortalPosts.jsx";
import APNHelpdesk from "./APNHelpdesk.jsx";
import Courses from "./Courses.jsx";
import Marketing from "./Marketing.jsx";
import Projects from "./Projects.jsx";
import InHouse from "./InHouse.jsx";
import Testing from "./Testing.jsx";
import Documents from "./Documents.jsx";
import Knowledge from "./Knowledge.jsx";
import Prompts from "./Prompts.jsx";
import Sheets from "./Sheets.jsx";
import Performance from "./Performance.jsx";
import Rewards from "./Rewards.jsx";
import MyEarnings from "./MyEarnings.jsx";
import RecentlyDeleted from "./RecentlyDeleted.jsx";
import TestDetail from "./TestDetail.jsx";
import ClassStudentForm from "./ClassStudentForm.jsx";
import APNLeadForm from "./APNLeadForm.jsx";
import APNQuoteWizard from "./APNQuoteWizard.jsx";
import AttendanceEditModal from "./AttendanceEditModal.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import TeamConfigForm from "./TeamConfigForm.jsx";
import ClientForm from "./ClientForm.jsx";
import ConceptForm from "./ConceptForm.jsx";
import MarketingForm from "./MarketingForm.jsx";
import ProjectForm from "./ProjectForm.jsx";
import PlannedForm from "./PlannedForm.jsx";
import StudentForm from "./StudentForm.jsx";
import VaultForm from "./VaultForm.jsx";
import TncManager from "./TncManager.jsx";

const Child = ({ children }) => <div>{children}</div>;
const supabase = {
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })), removeChannel: vi.fn(),
  rpc: vi.fn(async () => ({ data: [], error: null })),
  from: vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) })),
  functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) },
  storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({ data: [], error: null })) })) },
};
const runtime = {
  ...Icons,
  supabase, useState: React.useState, Empty: Child, Modal: Child, Confirm: Child, Field: Child, SelectOther: Child, Avatar: Child,
  money: (n) => `₹${Number(n || 0)}`, fmtDate: () => "date", fmtDateTime: () => "date-time", fmtTime: () => "time",
  todayISO: () => "2026-09-03", startOfWeek: () => new Date("2026-09-01"), uid: () => "id", emitToast: vi.fn(), reload: vi.fn(),
  ROLE_LABEL: {}, PRIORITIES: ["Low", "Medium", "High", "Urgent"], CLIENT_STATUS: ["Prospect", "Active", "Inactive"],
  PROJECT_STAGES: ["Lead", "In progress", "Completed"], EXPENSE_CATEGORIES: ["Office Rent", "Utilities", "Other"],
  EXPENSE_RECURRENCE: ["Monthly", "Quarterly", "Yearly", "One-time"], PLANNED_STATUS: ["Planned", "Paid", "Cancelled"],
  CLASS_COURSES: ["MS Office", "Tally", "Python"], CLASS_MODES: ["Offline", "Online"], VAULT_CATEGORIES: ["Social", "Finance", "Work", "Other"],
  DOC_CATEGORIES: [], KB_CATEGORIES: [], INVOICE_STATUS: ["Draft", "Sent", "Paid"], QUOTE_STATUS: ["Draft", "Sent", "Accepted"],
  HELP_STATUS_LABEL: {}, HELP_STATUS_TONE: {}, NOTIF_AUDIENCES: [], TN_DISTRICTS: ["Chennai", "Coimbatore", "Madurai"],
  apnAdminLevel: () => "Trainee", apnEffectiveStatus: (p) => p?.status || "active", apnIdFor: (p) => p?.apnId || "APN-TEST",
  apnTargetFor: () => null, apnHealthScore: () => ({ score: 0, band: "Needs attention", parts: {} }), apnAttendanceScore: () => 0, apnMonthlyAnalytics: () => [], apnActivityHistory: () => [],
  apnMilestones: () => [], apnPartnerProfileForm: (p) => ({ name: p.name || "", username: "", email: "", mobile: "", alternateNumber: "", gender: "", dob: "", country: "India", state: "Tamil Nadu", district: p.district || "", taluk: "", city: "", pincode: "", address: "", status: p.status || "active", level: "Trainee", target: 0, targetMetric: "leads", commissionPct: 1, attendanceScore: 0, notes: "", kycStatus: "Not started" }), apnRecommendations: () => [], apnRiskIndicators: () => [], apnPartnerStats: () => ({ submitted: 0, converted: 0, conv: 0, revenue: 0, completed: 0, level: { rate: 1 }, commission: { earned: 0, paid: 0, pending: 0, payable: 0 } }), apnDerivedTimeline: () => [], apnPercent: vi.fn(),
  apnLastActivity: () => null, apnAvatarUrl: () => "", apnTimelineEntry: vi.fn(), onApprovedLeave: () => false, apnLastSeenAt: () => null, apnLastSeenLabel: () => "Never", apnLeadTone: () => "",
  apnSafeHtml: (x) => x, apnStatusClass: () => "", apnStatusLabel: (x) => x || "Pending", APN_SERVICE_LABEL: {}, APN_SERVICES: [], APN_ADMIN_LEVELS: [], APN_ADMIN_STATUSES: [], APN_LEAD_REJECTED: "rejected", APN_TARGET_METRICS: [],
  testProgress: () => ({ done: 0, total: 0, pct: 0 }), testResultTone: () => "pri", TEST_MAX_IMAGES: 5, TEST_IMAGE_TTL_DAYS: 30,
  fileKind: () => "image", uploadAttachment: vi.fn(async () => ({ url: "", name: "", path: "" })), storagePathFromUrl: () => "", haptic: vi.fn(),
  sameMonth: () => false, attendanceFor: () => null, attStatus: () => "Present", clockTime: () => "09:00", sumHours: () => 0, isTaskAssignee: () => false, round2: (n) => Number(Number(n || 0).toFixed(2)), avatarColor: () => "var(--primary)",
  staffEarnings: () => ({ realisedComm: 0, items: [], configured: false, totalToDate: 0, pipelineComm: 0, fixedMonthly: 0, incentivesTotal: 0, incentives: [], months: 0, salaryToDate: 0 }), SalaryRow: Child,
  exportRowsToExcel: vi.fn(), exportRowsToPDF: vi.fn(),
  ContactButtons: Child, ActionBadge: ({ count }) => <span>{count}</span>, Accounts: Child, Tasks: Child, Notifications: Child, Invoices: Child, LoadMore: Child,
  APNPartnerDashboard: Child, APNPartnerAnalytics: Child, APNPartnerDocuments: Child, APNPartnerCommunications: Child, APNPartnerActivity: Child,
};
const db = new Proxy({
  tasks: [], leads: [], clients: [], projects: [], transactions: [], attendance: [], updates: [], rewards: [], payroll: [], recycle: [],
  crm_leads: [], crm_follow_ups: [], crm_quotations: [], crm_projects: [], crm_revenue_collections: [], crm_activities: [],
  portal_posts: [], support_tickets: [], support_ticket_messages: [], support_ticket_audit: [], testing: [], apn_users: [], apn_targets: [],
  apn_training: [], apn_quizzes: [], apn_documents: [], apn_notifications: [], apn_timeline: [], apn_commissions: [], apn_withdrawal_requests: [],
  apn_withdrawal_batches: [], apn_referral_earnings: [], apn_action_badge_reads: [],
}, { get: (target, key) => key in target ? target[key] : [] });
const team = [{ id: "p1", name: "Test", role: "admin", active: true }];
const me = { id: "p1", name: "Test", role: "admin" };
const common = { db, team, me, isAdmin: true, isSuper: true, currentUser: "Test", currentUserId: "p1", role: "admin", profile: me, runtime,
  mutate: vi.fn(), openModal: vi.fn(), removeItem: vi.fn(), reload: vi.fn(), go: vi.fn(), onRefresh: vi.fn(), onBack: vi.fn(), onDelete: vi.fn(),
  portalClients: [], people: db.apn_users, currentUserAvatar: "", currentUserDesignation: "Admin", refreshPeople: vi.fn(), config: {}, saveClassWebhook: vi.fn(),
  canFinance: true, openIncome: vi.fn(), replaceDB: vi.fn(), saveTeamCfg: vi.fn(), restoreItem: vi.fn() };

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Admin route component smoke audit", () => {
  const cases = [
    ["AI Intelligence", AIIntelligenceCenter, { db, go: vi.fn(), openModal: vi.fn(), reload: vi.fn(), runtime }],
    ["Pricing & Knowledge", PricingKnowledgeCenter, { isAdmin: true, runtime }],
    ["Proposal Center", ProposalCenter, { isAdmin: true, runtime }],
    ["Attendance", Attendance, { ...common }], ["Leave", Leave, { ...common }], ["Team Leads", TeamLeads, { ...common }],
    ["Staff Salary", StaffSalary, { ...common }], ["Enterprise CRM", EnterpriseCRM, { ...common }], ["Clients", Clients, { ...common }],
    ["Quotations", Quotations, { ...common }], ["Invoices", Invoices, { ...common }], ["Portal Posts", PortalPosts, { ...common }],
    ["Support", APNHelpdesk, { ...common, onRefresh: vi.fn() }], ["Courses", Courses, { ...common }], ["Marketing", Marketing, { ...common }],
    ["Projects", Projects, { ...common }], ["In-house", InHouse, { ...common }], ["Testing", Testing, { ...common }],
    ["Documents", Documents, { ...common }], ["Knowledge", Knowledge, { ...common }], ["Prompts", Prompts, { ...common }],
    ["Sheets", Sheets, { ...common }], ["Performance", Performance, { db, team, runtime }], ["Rewards", Rewards, { ...common }],
    ["My Earnings", MyEarnings, { ...common, payroll: [] }], ["Recently Deleted", RecentlyDeleted, { ...common }],
    ["APN Lead form", APNLeadForm, { ...common, meRow: me, initial: null }],
    ["APN Quote wizard", APNQuoteWizard, { meRow: me, onSave: vi.fn(), onClose: vi.fn(), go: vi.fn(), runtime: { ...runtime, APN_SERVICES: [["website", "Website Development"]], QUOTE_BUSINESS_EMAIL: { key: "business_email", label: "Business Email", amount: 999 }, QUOTE_DISCLAIMER: "Disclaimer", QUOTE_SERVICE_LABEL: { website: "Website Development" }, QUOTE_SITE_TYPES: [["static", "Static", ""]], QUOTE_STEP_LABELS: ["Service"], QUOTE_TECHS: ["React"], QUOTE_URGENT_RATE: 0.1, shareQuoteVia: vi.fn(), downloadQuotePdf: vi.fn(), supabase } }],
    ["Attendance edit modal", AttendanceEditModal, { member: me, record: null, date: "2026-09-05", onSave: vi.fn(), onClear: vi.fn(), onClose: vi.fn(), runtime: { ...runtime, useState: React.useState } }],
    ["Global search", GlobalSearch, { db, team, profile: me, role: "admin", me, allowedRoutes: ["dashboard"], go: vi.fn(), openTask: vi.fn(), openModal: vi.fn(), onClose: vi.fn(), nav: [], notifVisibleTo: vi.fn(() => true), activityModuleOf: (x) => x }],
    ["Terms manager", TncManager, { config: {}, saveTnc: vi.fn(), saveRoleTnc: vi.fn() }],
  ];
  it.each(cases)("renders %s without a render-time exception", async (_name, Component, props) => {
    expect(() => render(<Component {...props} />)).not.toThrow();
    await waitFor(() => expect(document.body.textContent).not.toContain("Something went wrong rendering the app."));
    // Some admin routes perform an immediate async bootstrap; let its finally
    // state update settle before the per-case cleanup tears down the DOM.
    await new Promise((resolve) => setTimeout(resolve, 25));
  });

  it.each([
    ["Test Detail", TestDetail, { ...common, sessionId: "missing" }],
    ["Class Student form", ClassStudentForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Team Config form", TeamConfigForm, { initial: null, roster: team, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Client form", ClientForm, { initial: null, existing: [], onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Concept form", ConceptForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Marketing form", MarketingForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Project form", ProjectForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Planned form", PlannedForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Student form", StudentForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
    ["Vault form", VaultForm, { initial: null, onSave: vi.fn(), onClose: vi.fn(), runtime }],
  ])("renders %s without missing-module dependencies", (_name, Component, props) => {
    expect(() => render(<Component {...props} />)).not.toThrow();
  });

  it.each([
    ["hub", APNAdminHub, { db, mutate: vi.fn(), currentUser: "Test", isAdmin: true, runtime }],
    ["partners", APNAdminPartners, { db: { ...db, apn_users: [{ id: "p1", name: "Partner", apnId: "APN-TN-0001", status: "active", role: "partner", district: "Chennai", tags: [] }] }, people: [{ id: "p1", name: "Partner" }], isSuper: true, canManage: true, act: { run: vi.fn(), bulk: vi.fn() }, openModal: vi.fn(), onOpenProfile: vi.fn(), runtime }],
    ["leads", APNAdminLeads, { db, openModal: vi.fn(), runtime }],
  ])("renders the real APN Admin %s component", (_name, Component, props) => {
    expect(() => render(<Component {...props} />)).not.toThrow();
    cleanup();
  });

  it("renders the real APN partner profile", () => {
    const partner = { id: "p1", name: "Partner", apnId: "APN-TN-0001", status: "active", role: "partner", district: "Chennai", tags: [] };
    expect(() => render(<APNPartnerProfile partner={partner} db={db} people={[partner]} isSuper={true} runtime={{ ...runtime, APNPartnerDashboard: Child, APNPartnerAnalytics: Child, APNPartnerDocuments: Child, APNPartnerCommunications: Child, APNPartnerActivity: Child }} onClose={vi.fn()} onAction={vi.fn()} onWarning={vi.fn()} onResolveWarning={vi.fn()} onDeleteWarning={vi.fn()} onNote={vi.fn()} onEditNote={vi.fn()} onTags={vi.fn()} onDocuments={vi.fn()} onCommunication={vi.fn()} onExport={vi.fn()} />)).not.toThrow();
  });

  it("renders APN Admin partner modal components without missing dependencies", () => {
    const partner = { id: "p1", name: "Partner", apnId: "APN-TN-0001", status: "active" };
    const commission = { id: "c1", status: "Pending", amount: 30, partnerId: "p1" };
    for (const node of [
      <APNTagForm partner={partner} onSave={vi.fn()} onClose={vi.fn()} runtime={runtime} />,
      <APNPartnerDocumentForm partner={partner} onSave={vi.fn()} onClose={vi.fn()} runtime={runtime} />,
      <APNCommunicationForm partner={partner} onSave={vi.fn()} onClose={vi.fn()} runtime={runtime} />,
      <APNCommissionReverseModal commission={commission} partnerName="Partner" isSuper={true} onClose={vi.fn()} onSave={vi.fn()} runtime={{ ...runtime, apnCommTone: () => "pri", LockIcon: Child }} />
    ]) {
      expect(() => render(node)).not.toThrow();
      cleanup();
    }
  });
});

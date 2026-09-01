import React, { useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import * as Icons from "./icons.jsx";
import "./allbee.css";
const {
  LayoutDashboard, Wallet, ArrowDownToLine, ListTodo, TrendingUp, Lightbulb,
  GraduationCap, Megaphone, FolderKanban, ScrollText, SettingsIcon,
  Plus, X, Sun, Moon, Search, Trash2, Pencil, ChevronRight, ChevronDown, Check, AlertTriangle,
  Download, Upload, LogOut, Hexagon, CalendarClock, ArrowRight, Menu, Wifi, WifiOff,
  Mail, KeyRound, LogIn, RefreshCw, CloudOff, Users, UserCheck, CalendarDays, MessageSquare, Plane, Clock, CheckCircle2, XCircle, Hourglass, ShieldCheck, ShieldAlert,
  ArrowLeft, Undo2, RotateCcw, Paperclip, Link2, ExternalLink, Activity, Filter, Send, FileText, Sheet, Tag, Maximize2, History, Save, Copy, Eye, EyeOff, LockIcon, UnlockIcon, Award, Star, BookOpen, Bell, Building2, Phone, UserPlus, MegaphoneIcon, BadgeCheck, Banknote, User, Sparkles, Home, Coins, Minimize2,
  Bug, ClipboardCheck, ImageIcon, MapPin, Trophy, Target, PhoneCall, GaugeCircle, Gift, ArrowDownUp, MessageCircle, MoreVertical, Flame, FileCheck2, Zap, Handshake, ShieldHalf, Ban, UploadCloud, FileUp, ListChecks, Globe2, Headset, LifeBuoy,
} = Icons;
import { supabase, SUPABASE_URL } from "./supabaseClient";
import { createSessionRecovery } from "./sessionRecovery.js";
import { createRealtimeReconnect } from "./realtimeReconnect.js";
import { createPersistQueue } from "./persistQueue.js";
const LazyAPNTeamChat = React.lazy(() => import("./APNTeamChat.jsx"));
const LazyAPNAdmin = React.lazy(() => import("./APNAdmin.jsx"));
const LazyEnterpriseCRM = React.lazy(() => import("./EnterpriseCRM.jsx"));
const LazyPricingKnowledgeCenter = React.lazy(() => import("./PricingKnowledgeCenter.jsx"));
const LazyAIIntelligenceCenter = React.lazy(() => import("./AIIntelligenceCenter.jsx"));
const LazyStaffSalary = React.lazy(() => import("./StaffSalary.jsx"));
const LazyMyEarnings = React.lazy(() => import("./MyEarnings.jsx"));
const LazyClients = React.lazy(() => import("./Clients.jsx"));
const LazyTasks = React.lazy(() => import("./Tasks.jsx"));
const LazyLeave = React.lazy(() => import("./Leave.jsx"));
const LazyCourses = React.lazy(() => import("./Courses.jsx"));
const LazyMarketing = React.lazy(() => import("./Marketing.jsx"));
const LazyProjects = React.lazy(() => import("./Projects.jsx"));
const LazyAttendance = React.lazy(() => import("./Attendance.jsx"));
const LazyAttendanceEditModal = React.lazy(() => import("./AttendanceEditModal.jsx"));
const LazyDocuments = React.lazy(() => import("./Documents.jsx"));
const LazySheets = React.lazy(() => import("./Sheets.jsx"));
const LazyKnowledge = React.lazy(() => import("./Knowledge.jsx"));
const LazyQuotations = React.lazy(() => import("./Quotations.jsx"));
const LazyVault = React.lazy(() => import("./Vault.jsx"));
const LazyAPNNetwork = React.lazy(() => import("./APNNetwork.jsx"));
const LazyAPNHelpdesk = React.lazy(() => import("./APNHelpdesk.jsx"));
const LazyAPNQuoteWizard = React.lazy(() => import("./APNQuoteWizard.jsx"));
const LazyAPNWallet = React.lazy(() => import("./APNWallet.jsx"));
const LazyAPNLeads = React.lazy(() => import("./APNLeads.jsx"));
const LazyAPNLeadForm = React.lazy(() => import("./APNLeadForm.jsx"));
const LazyAPNWithdrawalCenter = React.lazy(() => import("./APNWithdrawalCenter.jsx"));
const LazyAPNWalletDetailModal = React.lazy(() => import("./APNWalletDetailModal.jsx"));
const LazyProposalCenter = React.lazy(() => import("./ProposalCenter.jsx"));
const LazyLock = React.lazy(() => import("./Lock.jsx"));
const LazyTestDetail = React.lazy(() => import("./TestDetail.jsx"));
const LazyClientPortal = React.lazy(() => import("./ClientPortal.jsx"));
const LazyShareForm = React.lazy(() => import("./ShareForm.jsx"));
const LazyNotificationForm = React.lazy(() => import("./NotificationForm.jsx"));
const LazyTestSessionForm = React.lazy(() => import("./TestSessionForm.jsx"));
const LazyTaskForm = React.lazy(() => import("./TaskForm.jsx"));
const LazyQuotationForm = React.lazy(() => import("./QuotationForm.jsx"));
const LazyDocForm = React.lazy(() => import("./DocForm.jsx"));
const LazyInvoiceForm = React.lazy(() => import("./InvoiceForm.jsx"));
const LazyAnnouncementForm = React.lazy(() => import("./AnnouncementForm.jsx"));
const LazyPortalPostForm = React.lazy(() => import("./PortalPostForm.jsx"));
const LazyRewardForm = React.lazy(() => import("./RewardForm.jsx"));
const LazyInHouseForm = React.lazy(() => import("./InHouseForm.jsx"));
const LazyTeamConfigForm = React.lazy(() => import("./TeamConfigForm.jsx"));
const LazyProjectForm = React.lazy(() => import("./ProjectForm.jsx"));
const LazyStudentForm = React.lazy(() => import("./StudentForm.jsx"));
const LazyClassStudentForm = React.lazy(() => import("./ClassStudentForm.jsx"));
const LazyClientForm = React.lazy(() => import("./ClientForm.jsx"));
const LazyVaultForm = React.lazy(() => import("./VaultForm.jsx"));
const LazyPlannedForm = React.lazy(() => import("./PlannedForm.jsx"));
const LazyPromptForm = React.lazy(() => import("./PromptForm.jsx"));
const LazyKbForm = React.lazy(() => import("./KbForm.jsx"));
const LazyWithdrawForm = React.lazy(() => import("./WithdrawForm.jsx"));
const LazyLeadForm = React.lazy(() => import("./LeadForm.jsx"));
const LazyLeaveForm = React.lazy(() => import("./LeaveForm.jsx"));
const LazyResignForm = React.lazy(() => import("./ResignForm.jsx"));
const LazyIncentiveForm = React.lazy(() => import("./IncentiveForm.jsx"));
const LazyPermsModal = React.lazy(() => import("./PermsModal.jsx"));
const LazyCreateUserModal = React.lazy(() => import("./CreateUserModal.jsx"));
const LazyManageUserModal = React.lazy(() => import("./ManageUserModal.jsx"));
const LazySheetForm = React.lazy(() => import("./SheetForm.jsx"));
const LazyMarketingForm = React.lazy(() => import("./MarketingForm.jsx"));
const LazyConceptForm = React.lazy(() => import("./ConceptForm.jsx"));

export function createConnectivityRecovery({ onOnline, onOffline, refresh }) {
  let timer = null;
  let disposed = false;
  const run = () => {
    if (disposed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!disposed) refresh?.().catch?.(() => {});
    }, 250);
  };
  const online = () => { onOnline?.(); run(); };
  const offline = () => { onOffline?.(); };
  if (typeof window !== "undefined") {
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
  }
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    }
  };
}


/* ──────────────────────────────────────────────────────────────────────────
   ALLBEE — Business management app for Haji & Alim (ALLBEE SOLUTIONS)
   React app backed by Supabase: email/password auth, a shared Postgres
   database, and live sync between both partners. See README.md for setup.
─────────────────────────────────────────────────────────────────────────── */

const USERS = ["Haji", "Alim"];
const COMBINED = "Haji & Alim";          // a task can be assigned to both partners
const PRESETS = [[50, 50], [70, 30], [30, 70], [60, 40], [40, 60]];

const TASK_FLOW = ["Created", "Accepted", "In Progress", "Completed"];
const PROJECT_STAGES = ["Lead", "Discussion", "Proposal Sent", "Advance Received", "Development", "Testing", "Completed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const INCOME_CATEGORIES = ["Project", "Course", "Marketing", "Consulting", "Other"];
const EXPENSE_CATEGORIES = ["Office Rent", "Internet", "Electricity", "Marketing", "Software", "Travel", "Other"];
const LEAVE_TYPES = ["Casual", "Sick", "Emergency", "Earned", "Unpaid", "Other"];

// Phase 3–6 domain vocab
const LEAD_STAGES = ["New", "Contacted", "Qualified", "Proposal Sent", "Converted", "Lost"];
const LEAD_SOURCES = ["Referral", "Instagram", "Facebook", "Website", "Walk-in", "Cold call", "Other"];
const QUOTE_STATUS = ["Draft", "Sent", "Accepted", "Rejected"];
const DOC_CATEGORIES = ["Contract", "Invoice", "Design", "Brand", "Report", "Other"];
const KB_CATEGORIES = ["Policy", "How-to", "FAQ", "Onboarding", "Tools", "Other"];
const PROMPT_CATEGORIES = ["General", "Sales", "Marketing", "Support", "Development", "AI / ChatGPT"];
const SHEET_CATEGORIES = ["General", "Finance", "Reports", "Trackers", "Clients", "HR", "Marketing"];
const EXPENSE_RECURRENCE = ["One-time", "Monthly", "Quarterly", "Yearly"];
const REWARD_KINDS = ["Star performer", "On-time hero", "Team player", "Goal smashed", "Bonus"];
const VAULT_CATEGORIES = ["Social", "Website", "Hosting", "Email", "Domain", "Banking", "Tools", "Other"];

// ── Class students (training institute) ────────────────────────────────────
// A separate roster from the commission-linked "students"/Courses module: the
// offline/online classes ALLBEE runs (MS Office, Tally, Python…). Admin-only.
// Suggested course list — the form still accepts any typed value.
const CLASS_COURSES = ["MS Office", "Tally", "Advanced Excel", "Python", "Data Entry", "DTP", "Web Design", "Digital Marketing", "Spoken English", "C / C++", "Java", "Other"];
const CLASS_MODES = ["Offline", "Online", "Hybrid"];
// Built-in Google Sheet mirror endpoint (Apps Script web-app /exec URL). Used
// when nothing is set in Settings. An admin can override it — or clear it to
// turn sync off — from the Google Sheet sync panel on the Class students page.
const DEFAULT_CLASS_SHEET_WEBHOOK = "https://script.google.com/macros/s/AKfycbydBFxafdnA1PsKO70dfXt1D8RKQrtRScbJ3CUAZeUfjbyuUjRppsuq3YTY1sE1U58M6g/exec";
// Resolve the active webhook: an unset key falls back to the default; an
// explicitly-saved empty string means the admin turned sync off.
const classWebhookOf = (config) => {
  const v = config?.class_sheet_webhook;
  return (v === undefined || v === null) ? DEFAULT_CLASS_SHEET_WEBHOOK : String(v).trim();
};

/* ── Phase Next: dynamic expense sharing + testing module ──────────────────
   Company-level expenses (rent, internet, hosting, subscriptions, company
   purchases…) are split by the LAST month that had revenue — see
   revenueShareForMonth / expenseSharePlan below. Project & client costs keep
   their own manual split, so these two category lists drive the picker. */
const COMPANY_EXPENSE_CATEGORIES = ["Office Rent", "Internet", "Electricity", "Hosting", "Canva", "ChatGPT", "Software", "Subscriptions", "Company purchase", "Other"];
const PROJECT_EXPENSE_CATEGORIES = ["Project cost", "Client expense", "Subcontractor", "Assets", "Travel", "Marketing", "Other"];
const DEFAULT_EXPENSE_SHARE = { haji: 50, alim: 50 }; // used until a first revenue month exists
// Testing module: screenshot retention and per-bug image cap.
const TEST_IMAGE_TTL_DAYS = 30;  // testing screenshots auto-delete after 30 days
const TEST_MAX_IMAGES = 4;       // maximum screenshots per bug report

// ── Phase 7 additions: statuses, levels, notifications, file uploads ───────
const CLIENT_STATUS = ["Prospect", "Active", "Inactive", "Blacklisted"];
const PLANNED_STATUS = ["Planned", "Approved", "Purchased", "Cancelled"];
const NOTIF_LEVELS = ["General", "Important", "Urgent"];
const NOTIF_AUDIENCES = [["all", "Everyone"], ["staff", "Staff only"], ["intern", "Interns only"], ["accountant", "Accountants only"], ["admin", "Admins only"]];
const INVOICE_STATUS = ["Draft", "Sent", "Paid", "Overdue", "Cancelled"];
const LEAD_SERVICES = ["Website", "App", "Digital marketing", "Course", "Branding", "Other"];
const INHOUSE_STAGES = ["Idea", "Planning", "Building", "Testing", "Launched", "On hold"];
const INHOUSE_CATEGORIES = ["Product", "Internal tool", "Marketing", "R&D", "Automation", "Other"];
const ONLINE_MS = 2 * 60 * 1000; // a member is "online" if active within 2 minutes
const isOnline = (p) => !!(p && p.last_active) && (Date.now() - new Date(p.last_active).getTime()) < ONLINE_MS;
// Internal team inactivity remains a one-week signal. APN partner inactivity
// uses its separate 30-day rule below.
const INACTIVE_WEEK_MS = 7 * 86400000;
const lastSeenMs = (p) => { const t = p && (p.last_active || p.created_at); const ms = t ? new Date(t).getTime() : 0; return isNaN(ms) ? 0 : ms; };
const isInactiveWeek = (p) => !!p && (Date.now() - lastSeenMs(p)) > INACTIVE_WEEK_MS;
const isInternalMember = (p) => !!p && p.role !== "client" && p.role !== "partner" && p.role !== "district_head";
const inactiveMembers = (team) => (team || []).filter((p) => isInternalMember(p) && isInactiveWeek(p));
function notifVisibleTo(n, profile) {
  const aud = (n && n.audience) || "all";
  if (aud === "all") return true;
  if (aud.startsWith("user:")) return aud.slice(5) === (profile && profile.id);
  return aud === (profile && profile.role);
}
const FILE_LIMITS = { image: 10, pdf: 50, doc: 25 };
const fileKind = (file) => { const t = ((file && file.type) || "").toLowerCase(); if (t.startsWith("image/")) return "image"; if (t === "application/pdf") return "pdf"; return "doc"; };
const fileLimitOK = (file) => ((file && file.size) || 0) <= FILE_LIMITS[fileKind(file)] * 1024 * 1024;
async function uploadAttachment(file) {
  const k = fileKind(file);
  if (!fileLimitOK(file)) throw new Error(`File too large \u2014 ${k === "image" ? "images" : k === "pdf" ? "PDFs" : "documents"} are limited to ${FILE_LIMITS[k]} MB.`);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size, type: file.type, path };
}
// Recover the storage object key from a public URL so the retention sweep can
// delete the underlying file (older uploads only stored the URL, not the key).
function storagePathFromUrl(url) {
  try { const i = String(url || "").indexOf("/attachments/"); return i === -1 ? null : decodeURIComponent(String(url).slice(i + "/attachments/".length).split("?")[0]); }
  catch { return null; }
}

// Recently Deleted (recycle bin): which collections support soft-delete + restore,
// the human label shown for each, and how long items survive before auto-cleanup.
const RECYCLE_TTL_DAYS = 60;
const MODULE_LABEL = {
  transactions: "Accounts", withdrawals: "Withdrawals", tasks: "Tasks",
  projects: "Projects", students: "Courses", marketing: "Marketing", concepts: "Concepts",
  leads: "Leads", clients: "Clients", quotations: "Quotations", planned: "Planned expenses",
  announcements: "Announcements", documents: "Documents", knowledge: "Knowledge base",
  rewards: "Rewards", vault: "Passwords", portal_posts: "Client updates",
  notifications: "Notifications", invoices: "Invoices",
  prompts: "Prompts",
  sheets: "Sheets",
  inhouse: "In-house projects",
  teams: "Team leads",
  testing: "Testing",
  class_students: "Class students",
};
const ACTIVITY_MODULES = ["Tasks", "Finance", "APN", "Clients", "Leads", "Quotations", "Invoices", "Attendance", "Documents", "Knowledge Base", "AI", "Settings", "System"];
const ACTIVITY_MODULE_ALIASES = {
  Accounts: "Finance", Withdrawals: "Finance", "Planned expenses": "Finance", Payroll: "Finance", Earnings: "Finance",
  "Daily updates": "System", Leave: "Attendance", Progress: "Tasks", Projects: "Tasks", "In-house projects": "Tasks",
  "Class students": "System", Courses: "System", Marketing: "System", Concepts: "System", Announcements: "System",
  Chat: "System", "Team chat": "System", Team: "System", "Team leads": "System", Passwords: "System",
  Notifications: "System", "Client updates": "Clients", Rewards: "System", Sheets: "System", Testing: "System",
  "APN Partner Network": "APN",
};
function activityModuleOf(module) {
  const value = String(module || "System");
  if (ACTIVITY_MODULES.includes(value)) return value;
  if (ACTIVITY_MODULE_ALIASES[value]) return ACTIVITY_MODULE_ALIASES[value];
  const lower = value.toLowerCase();
  if (lower.includes("finance") || lower.includes("account") || lower.includes("withdraw") || lower.includes("commission")) return "Finance";
  if (lower.includes("apn") || lower.includes("partner")) return "APN";
  if (lower.includes("client")) return "Clients";
  if (lower.includes("lead")) return "Leads";
  if (lower.includes("quote")) return "Quotations";
  if (lower.includes("invoice")) return "Invoices";
  if (lower.includes("attendance") || lower.includes("leave")) return "Attendance";
  if (lower.includes("document") || lower.includes("file")) return "Documents";
  if (lower.includes("knowledge")) return "Knowledge Base";
  if (lower.includes("prompt") || lower.includes("ai")) return "AI";
  if (lower.includes("setting") || lower.includes("permission") || lower.includes("security")) return "Settings";
  if (lower.includes("task") || lower.includes("project") || lower.includes("progress")) return "Tasks";
  return "System";
}

// Convert the existing audit shape into the stable activity contract while
// retaining every legacy field and identifier for backward compatibility.
function activityEntry(entry, { user, userId, avatar } = {}) {
  const actor = entry.user || user || "System";
  const action = entry.action || entry.description || "performed an action";
  return {
    ...entry,
    user: actor,
    userId: entry.userId || userId || null,
    avatar: entry.avatar || avatar || null,
    module: activityModuleOf(entry.module),
    action,
    entity: entry.entity || entry.module || "System",
    entityId: entry.entityId || entry.partnerId || null,
    description: entry.description || `${actor} ${action}`,
  };
}

// A few older mutation paths intentionally pass no audit entry. Keep those
// actions visible in the global feed by deriving one append-only event from
// the changed collection, without changing the underlying business mutation.
function activityForMutation(prev, next) {
  const candidates = TABLES.filter((table) => table !== "audit" && table !== "recycle" && JSON.stringify(prev?.[table] || []) !== JSON.stringify(next?.[table] || []));
  const table = candidates[0];
  if (!table) return null;
  const before = prev?.[table] || [];
  const after = next?.[table] || [];
  const beforeIds = new Set(before.map((x) => x.id));
  const afterIds = new Set(after.map((x) => x.id));
  const added = after.find((x) => !beforeIds.has(x.id));
  const removed = before.find((x) => !afterIds.has(x.id));
  const changed = after.find((x) => {
    const prior = before.find((b) => b.id === x.id);
    return prior && JSON.stringify(prior) !== JSON.stringify(x);
  });
  const record = added || changed || removed;
  const label = MODULE_LABEL[table] || table;
  const name = record && (record.name || record.title || record.client || record.number);
  const verb = added ? "created" : removed ? "deleted" : "updated";
  return {
    action: `${verb} ${label.toLowerCase()}${name ? ` "${name}"` : ""}`,
    module: activityModuleOf(label),
    entity: label,
    entityId: record?.id || null,
  };
}
const LOGO_FULL = "/allbee-logo.png";   // full lockup (monogram + wordmark)
const LOGO_ICON = "/allbee-icon.png";   // square monogram

// ── Founder Emergency Lockdown — go-live switch ────────────────────────────
// Gate is LIVE by default in this repo. Hosted deployments keep it live too
// UNLESS the Vercel env var VITE_FOUNDER_LOCKDOWN_QUIET is set to "true"
// (used on the flagship domain while the launch PR is under review). Tests
// pass pause (VITE_PAUSE_TEST=1) so the gate renders its lockdown UI
// immediately with zero network.
const LOCKDOWN_PAUSE_TEST = import.meta.env.VITE_PAUSE_TEST === "1";
const FOUNDER_LOCKDOWN_LIVE = import.meta.env.VITE_FOUNDER_LOCKDOWN_LIVE === "true" || LOCKDOWN_PAUSE_TEST;
// Hidden entrance to the founder authorization flow: 16 idle taps on the gate
// logo, then a 3-2-1 countdown (taps 17-19), an armed beat (tap 20), and the
// existing authorization screen opens on tap 21. No code ever lives in the
// frontend — this only reveals the same server-verified gateway.
const FOUNDER_TAP_TIMEOUT_MS = 2500;   // inactivity resets the sequence

// The founder tap sequence is hosted in RemoteLockGate and shared with every
// logo in the app shell via this context, so the sequence works from the logo
// the user actually sees — login, sidebar, client portal, APN or the gate card.
const FounderTapContext = React.createContext(null);

// Wraps a logo element with the shared founder tap handler + countdown chip.
// One centralized handler — no competing per-surface listeners. The chip is
// absolutely positioned so it never shifts the layout around the logo.
export function FounderTap({ className, src, alt, style, onClick, children, ...rest }) {
  const ctx = React.useContext(FounderTapContext);
  if (!ctx) return <img className={className} src={src} alt={alt} style={style} onClick={onClick} {...rest} />;
  return (
    <span className="founder-tap">
      <img className={className} src={src} alt={alt} style={style} onClick={(e) => { onClick?.(e); ctx.tap(); }} {...rest} />
      {ctx.count >= 17 && (
        <span
          className={`founder-chip${ctx.anim ? " shift" : ""}`}
          data-countdown={ctx.armed ? "armed" : String(20 - ctx.count)}
          aria-live="polite"
          role="status"
        >{ctx.armed ? "✓" : 20 - ctx.count}</span>
      )}
      {children}
    </span>
  );
}

/* ── roles & access (Phase 3 — five levels) ───────────────────────────────
   superadmin (Haji & Alim) · admin · accountant · staff · intern.
   The money (Share & accounts, Withdrawals) is superadmin + accountant only;
   a plain admin runs the team and business but never sees the partner split. */
const ROLE_LABEL = { superadmin: "Super admin", admin: "Admin", accountant: "Accountant", staff: "Staff", intern: "Intern", partner: "APN Partner", district_head: "District Head", state_head: "State Head" };
const ROLE_OPTIONS = ["admin", "accountant", "staff", "intern"]; // an admin may assign these — never superadmin
const STATUS_LABEL = { active: "Active", on_leave: "On leave", suspended: "Suspended", resigned: "Resigned", terminated: "Terminated" };
const STATUS_OPTIONS = ["active", "on_leave", "suspended", "resigned", "terminated"];
// statuses that revoke sign-in (the row's `active` flag is set from this)
const STATUS_ACTIVE = { active: true, on_leave: true, suspended: false, resigned: false, terminated: false };
// business modules an admin can grant to an individual staff member, one by one
const GRANTABLE_MODULES = [["projects", "Projects"], ["inhouse", "In-house projects"], ["leads", "Leads"], ["clients", "Clients"], ["quotations", "Quotations"], ["invoices", "Invoices"], ["portal-posts", "Client updates"], ["courses", "Courses"], ["marketing", "Marketing"], ["concepts", "Concepts"], ["testing", "Testing"], ["sheets", "Sheets"], ["prompts", "Prompts"]];
// Who must accept Terms & Conditions before using the app. Partners (superadmin)
// author the agreements, so they're exempt; everyone else signs.
const TNC_ROLES = ["admin", "accountant", "staff", "intern"];
// The two layers of T&C: ONE general agreement for everyone (tnc_body/tnc_version),
// plus a per-role agreement (tnc_roles → { role: {body, version} }). A user must
// accept both their general and their role-specific agreement to gain access.
function roleTncOf(config) { try { return JSON.parse((config && config.tnc_roles) || "{}") || {}; } catch { return {}; } }
function acceptedRoleTnc(profile) { const a = profile && profile.tnc_roles_accepted; return a && typeof a === "object" ? a : {}; }
// Every agreement this user still needs to accept (general first, then role-specific).
function pendingTnc(config, profile, role) {
  if (!profile || !TNC_ROLES.includes(role)) return [];
  const out = [];
  const gv = Number(config?.tnc_version || 0);
  if (gv > 0 && Number(profile.tnc_version || 0) < gv)
    out.push({ key: "all", title: "Company terms — everyone", body: config?.tnc_body || "", version: gv });
  const rc = roleTncOf(config)[role];
  if (rc && Number(rc.version || 0) > 0 && Number(acceptedRoleTnc(profile)[role] || 0) < Number(rc.version))
    out.push({ key: role, title: `${ROLE_LABEL[role] || role} terms`, body: rc.body || "", version: Number(rc.version) });
  return out;
}

const isSuperRole = (r) => r === "superadmin";
const isAdminRole = (r) => r === "superadmin" || r === "admin";        // management level
const canFinanceRole = (r) => r === "superadmin" || r === "accountant"; // the money

// Which nav entries a user can see, derived from their role + granted modules.
function navAllowed(tag, role, perms) {
  const sa = isSuperRole(role), adm = isAdminRole(role);
  const acc = role === "accountant", staff = role === "staff", intern = role === "intern";
  if (tag === "everyone") return true;               // dashboard
  if (tag === "work") return adm || staff || intern;  // tasks, attendance, daily updates
  if (tag === "leave") return adm || staff;           // leave (not interns, not accountant)
  if (tag === "finance") return sa || acc;            // share & accounts, withdrawals, planned
  if (tag === "admin") return adm;                    // team, progress, recycle, audit, settings
  if (tag === "collab") return true;                  // announcements, chat, docs, knowledge (any internal user)
  if (tag === "vault") return sa;                     // password vault (partners only for now)
  if (tag === "super") return sa;                     // superadmin-only (e.g. Team leads)
  if (tag === "insight") return adm;                  // performance, rewards
  if (tag.startsWith("perm:")) {
    const mod = tag.slice(5);
    return adm || (staff && Array.isArray(perms?.modules) && perms.modules.includes(mod));
  }
  return adm;
}

/* ── helpers ──────────────────────────────────────────────────────────── */
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
// LOCAL calendar date as YYYY-MM-DD. We deliberately do NOT use toISOString(),
// which returns the date in UTC: for India (UTC+5:30) any check-in before
// 5:30 AM local time would otherwise be stamped with the *previous* day, so the
// record showed up under yesterday and "today's" filter never matched it (which
// also made the app ask the person to check in again). fmtDate/clockTime/
// sameMonth all already work in local time, so this keeps everything consistent.
const localISODate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const todayISO = () => localISODate();
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function money(n, { sign = false } = {}) {
  const v = round2(n || 0);
  const neg = v < 0;
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(v));
  const core = "₹" + s;
  if (neg) return "−" + core;
  if (sign) return "+" + core;
  return core;
}
function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const text = String(value);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
}
function pad2(value) { return String(value).padStart(2, "0"); }
function formatDateValue(value, withTime = false) {
  const d = dateValue(value);
  if (!d || Number.isNaN(d.getTime())) return value ? String(value) : "—";
  const date = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  if (!withTime) return date;
  const hours = d.getHours();
  const hour = hours % 12 || 12;
  return `${date} ${pad2(hour)}:${pad2(d.getMinutes())} ${hours >= 12 ? "PM" : "AM"}`;
}
function fmtDate(iso) { return formatDateValue(iso); }
function fmtTime(ts) { return formatDateValue(ts, true); }
const sameMonth = (iso, ref = new Date()) => {
  const d = new Date(iso + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

// Subtle haptic feedback — only for meaningful actions (task accept/complete,
// leave & withdrawal decisions, notifications). No-op where unsupported.
function haptic(pattern = 12) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}
const minsSince = (ts) => (Date.now() - (ts || 0)) / 60000;
const withinMinutes = (ts, m) => minsSince(ts) <= m;
// Sum worked hours across completed attendance sessions (ignores open ones).
const sumHours = (rows) => rows.reduce((s, a) => s + (a.checkOut ? (hoursBetween(a.checkIn, a.checkOut) || 0) : 0), 0);
const startOfWeek = (ref = new Date()) => { const d = new Date(ref); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d; };

/* ── data layer (Supabase) ────────────────────────────────────────────────
   Architecture preserved from the prototype: the whole database is held in
   memory as one `db` object and all derived values are computed in JS. Here
   each collection is a Postgres table with one row per record:
   ( id text primary key, data jsonb, updated_at timestamptz ).
   We load every row into the in-memory shape, and on each change we persist
   only the rows that actually changed (insert / update / delete).
─────────────────────────────────────────────────────────────────────────── */
const TABLES = ["transactions", "withdrawals", "tasks", "projects", "students", "marketing", "concepts", "audit", "attendance", "leave", "updates", "recycle",
  "leads", "clients", "quotations", "planned", "announcements", "documents", "knowledge", "chat", "rewards", "vault", "portal_posts", "notifications", "invoices", "resignations", "prompts", "sheets", "inhouse", "payroll", "teams", "team_chat", "testing", "class_students",
  // APN — ALLBEE Partner Network (logically separate from employee operations)
  "apn_users", "apn_attendance", "apn_targets", "apn_training", "apn_quizzes", "apn_leads", "apn_quotations", "apn_commissions", "apn_commission_projects", "apn_revenue_collections", "apn_achievements", "apn_notifications", "apn_documents", "apn_timeline", "apn_warnings", "apn_notes", "apn_activity", "apn_transfer_history", "apn_communications",
  // WP4 — admin hub consoles/notes + partner zone requests
  "apn_admin_notes", "apn_admin_consoles", "apn_zone_requests"];

// PR2 referral data is relational and intentionally does not participate in
// the legacy JSON-row diff writer. Referral mutations go through audited RPCs.
const REFERRAL_READS = {
  apn_referral_codes: "partner_id,code,rename_count,created_at,renamed_at,active",
  apn_referral_relationships: "id,referrer_id,referred_id,referral_code,linked_at,created_at,status,linked_by,disabled_at",
  apn_referral_earnings: "id,relationship_id,referrer_id,referred_id,source_collection_id,project_id,revenue_amount,referral_percent,referral_amount,status,collection_at,created_at,approved_at,paid_at,snapshot",
  apn_referral_wallets: "partner_id,pending,approved,withdrawable,paid,lifetime,monthly,updated_at",
  apn_referral_withdrawals: "id,partner_id,amount,status,requested_at,reviewed_at,reviewed_by,paid_at,note",
  apn_referral_timeline: "id,partner_id,event_type,title,description,related_id,created_at,created_by",
  apn_referral_activities: "id,partner_id,actor_id,event_type,title,description,metadata,created_at",
  apn_referral_monthly_summary: "partner_id,month_start,referral_count,active_count,revenue,earnings,updated_at",
  apn_referral_analytics_monthly: "partner_id,month_start,conversion_rate,referral_count,active_count,revenue,earnings,updated_at",
  apn_referral_settings: "id,enabled,default_percent,updated_at,updated_by",
  apn_referral_snapshots: "id,earning_id,referral_percent,settings_enabled,captured_at,snapshot",
};

// APN admin action badges use a per-user watermark. The source records remain
// unchanged; opening a tab only marks the current admin's action stream seen.
const APN_ACTION_BADGE_MAP = Object.freeze([
  Object.freeze({ actionType: "partner_pending", tab: "partners", label: "Partners" }),
  Object.freeze({ actionType: "commission_pending", tab: "commissions", label: "Commissions" }),
  Object.freeze({ actionType: "withdrawal_pending", tab: "withdrawals", label: "Withdrawals" }),
  Object.freeze({ actionType: "referral_pending", tab: "referrals", label: "Referrals" }),
  Object.freeze({ actionType: "target_action", tab: "targets", label: "Targets" }),
  Object.freeze({ actionType: "training_action", tab: "content", label: "Training" }),
  Object.freeze({ actionType: "material_action", tab: "docs", label: "Materials" }),
  Object.freeze({ actionType: "notification_unread", tab: "notify", label: "Notify" }),
]);
const APN_ACTION_BADGE_READS = "user_id,action_type,seen_at";

// PR3 withdrawal and settlement data is normalized and changed only through
// transactional RPCs. It deliberately stays outside the legacy JSON diff writer.
const WITHDRAWAL_READS = {
  apn_withdrawal_bank_accounts: "id,partner_id,account_holder,bank_name,account_number,ifsc,upi_id,branch,verification_status,active,created_at,updated_at",
  apn_withdrawal_wallets: "partner_id,wallet_type,pending,approved,withdrawable,locked,paid,lifetime,monthly,today,total_requested,total_approved,total_rejected,total_processing,last_paid_at,next_settlement_date,updated_at",
  apn_withdrawal_requests: "id,partner_id,wallet_type,requested_amount,approved_amount,preferred_method,bank_account_id,bank_snapshot,status,reason,notes,review_reason,requested_at,reviewed_at,reviewed_by,processing_at,paid_at,cancelled_at,expires_at,batch_id,settlement_reference,updated_at",
  apn_withdrawal_status_history: "id,request_id,from_status,to_status,amount,reason,notes,actor_id,actor_name,actor_role,created_at",
  apn_withdrawal_settlements: "id,request_id,batch_id,partner_id,wallet_type,amount,payment_method,payment_reference,paid_at,paid_by,receipt_snapshot",
  apn_withdrawal_batches: "id,batch_code,frequency,status,scheduled_for,created_by,created_at,processed_at,notes",
  apn_wallet_transactions: "id,partner_id,wallet_type,request_id,entry_type,amount,balance_effect,description,metadata,created_at,created_by",
  apn_withdrawal_finance_transactions: "id,request_id,settlement_id,partner_id,wallet_type,transaction_type,amount,reference,created_at,created_by,metadata",
  apn_withdrawal_audit: "id,request_id,partner_id,action,actor_id,metadata,created_at",
  apn_withdrawal_exports: "id,exported_by,format,filters,row_count,created_at",
};

// PR4 normalized CRM reads. Writes go through transactional CRM RPCs so the
// lead, follow-up, quotation, project, revenue, finance, audit, and notification
// records remain consistent with the existing ERP and APN engines.
const CRM_READS = {
  crm_clients: "id,client_key,customer_name,company,mobile,email,location,address,city,district,state,country,pincode,business_type,notes,created_by,created_at,updated_at",
  crm_leads: "id,lead_number,source,lead_owner_id,assigned_employee_id,assigned_partner_id,assigned_district_head_id,assigned_state_head_id,company,customer_name,mobile,email,location,address,city,district,state,country,pincode,business_type,project_category,expected_budget,expected_closing_date,priority,lead_score,status,remarks,tags,created_by,created_at,updated_at,converted_at,client_id,quotation_id,project_id",
  crm_lead_assignments: "id,lead_id,employee_id,partner_id,district_head_id,state_head_id,assigned_by,created_at",
  crm_follow_ups: "id,lead_id,follow_up_date,follow_up_time,reminder_at,priority,notes,outcome,next_follow_up,completed_by,completed_at,status,created_by,created_at,updated_at",
  crm_quotations: "id,quote_number,lead_id,client_id,service_type,title,items,subtotal,discount,tax,gst,grand_total,validity_until,status,version,approval_status,approved_by,approved_at,created_by,created_at,updated_at",
  crm_quotation_versions: "id,quotation_id,version,snapshot,created_by,created_at",
  crm_projects: "id,project_number,lead_id,quotation_id,client_id,name,service_type,project_value,status,assigned_employee_id,assigned_partner_id,apn_project_id,created_by,created_at,updated_at",
  crm_revenue_collections: "id,project_id,received_amount,received_at,commission_generated,incentive,status,remarks,created_by,created_at",
  crm_project_milestones: "id,project_id,proposal_id,name,sort_order,due_date,percentage,status,created_at",
  crm_activities: "id,lead_id,project_id,event_type,title,description,actor_id,actor_name,metadata,created_at",
  crm_files: "id,lead_id,project_id,quotation_id,file_name,file_url,file_type,file_size,uploaded_by,created_at",
  crm_reminders: "id,lead_id,reminder_day,due_at,priority,status,created_at",
  crm_audit: "id,lead_id,project_id,quotation_id,action,actor_id,actor_name,metadata,created_at",
};

// PR5 deterministic intelligence records. Dashboard calculations are returned
// by the admin-only ai_get_dashboard RPC; these tables provide realtime alerts,
// recommendations, history, cached snapshots, and generated report metadata.
const AI_READS = {
  ai_settings: "id,enabled,sensitivity,forecast_period,prediction_model,updated_by,updated_at",
  ai_insights: "id,category,severity,title,message,recommendation,entity_type,entity_id,score,metadata,status,generated_by,created_at,updated_at,last_seen_at",
  ai_predictions: "id,prediction_type,entity_id,value,confidence,explanation,factors,generated_at",
  ai_cache: "key,payload,generated_at,expires_at",
  ai_history: "id,period,summary,metrics,created_by,created_at",
  ai_recommendations: "id,category,title,description,impact,priority,entity_type,entity_id,action_route,metadata,status,created_at,updated_at",
  ai_reports: "id,report_type,format,title,payload,generated_by,created_at",
};

// WP4 — client = level / product / prescription / loyalty. Normalized reads;
// writes go through the audited prescription & loyalty RPCs only.
const CLIENT_READS = {
  apn_target_client_levels: "partner_id,record_id,level_key,label,goal,progress,status,notes,created_by,created_at,updated_at",
  apn_target_client_products: "partner_id,record_id,product_key,label,category,price,quantity,status,created_by,created_at,updated_at",
  apn_target_client_prescriptions: "partner_id,prescription_id,client_key,patient_name,doctor_name,condition_name,phase,balance,submit_count,last_submitted,status,created_by,created_at,updated_at",
  apn_target_client_prescription_items: "partner_id,item_id,prescription_id,item_key,label,quantity,unit,amount,condition_item,embed_order,created_at,updated_at",
  apn_target_client_loyalty: "partner_id,loyalty_id,client_key,points,tier,status,created_by,created_at,updated_at",
  apn_target_client_loyalty_rewards: "partner_id,reward_id,loyalty_id,reward_key,label,points_cost,redeemed,redeemed_at,created_at,updated_at",
};

// Helpdesk — client portal support tickets. Normalized reads; writes go through
// the audited, identity-checked RPCs in supabase/helpdesk.sql only.
const HELPDESK_READS = {
  support_tickets: "id,ticket_no,client_id,client_name,client_email,client_company,subject,description,category,priority,status,assignee_id,created_at,updated_at,closed_at",
  support_ticket_messages: "id,ticket_id,author_id,author_name,author_role,author_public,body,created_at",
  support_ticket_audit: "id,ticket_id,author_id,author_name,action,metadata,created_at",
};

// PR-APN agreements — versioned legal documents + per-partner acceptance
// evidence. Normalized reads; writes go exclusively through the audited
// apn_agreement_save_draft / publish / accept RPCs (see
// supabase/pr-apn-partner-agreements.sql). The finalized schema also exposes
// the Simple-English rendering (body_simple), the material/editorial
// classification (material, change_summary, supersedes_id) and the
// centralized legal-entity row (apn_agreement_company).
const AGREEMENT_READS = {
  apn_agreements: "id,code,version,title,category,body,body_simple,content_hash,status,mandatory,reason,effective_from,published_at,published_by,created_by,created_at,updated_at,material,supersedes_id,change_summary",
  apn_agreement_acceptances: "id,partner_id,agreement_id,version,content_hash,accepted_at,accepted_by,method,terms_view,ip,user_agent",
  apn_hierarchy_assignments: "partner_id,district_head_id,state_head_id,status,assigned_by,effective_from,assigned_at",
  apn_agreement_company: "id,legal_name,trade_name,address_line1,address_line2,city,state,country,postal_code,email,governance_framework,governing_law,jurisdiction_place,signatories,updated_at",
};

async function fetchReferralData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(REFERRAL_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns)]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

async function fetchApnActionBadgeReads() {
  return loadTableRows("apn_action_badge_reads", APN_ACTION_BADGE_READS);
}

async function fetchWithdrawalData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(WITHDRAWAL_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns)]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

async function fetchCRMData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(CRM_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns, "created_at")]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

async function fetchAIData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(AI_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns, table === "ai_settings" ? "updated_at" : "created_at")]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

// WP7 — the partner portal's authoritative financial facts. Reads ONE
// read-only, auth-scoped snapshot RPC that serves the exact engine values the
// ALLBEE AI uses (consolidated wallet, ledger, rule ladder, reversals,
// withdrawal wallets). Returns null when the RPC is absent or fails so the
// portal degrades to the legacy projection instead of white-screening.
async function fetchPartnerFinancialSnapshot() {
  const { data, error } = await supabase.rpc("apn_partner_financial_snapshot");
  if (error) return null;
  return data || null;
}

async function fetchClientData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(CLIENT_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns)]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

async function fetchHelpdeskData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(HELPDESK_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns)]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

async function fetchAgreementData() {
  const out = {};
  const entries = await mapWithConcurrency(Object.entries(AGREEMENT_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(table, columns)]);
  for (const [table, rows] of entries) out[table] = rows;
  return out;
}

// ── resilient table loader ───────────────────────────────────────────────
// Every screen used to load all tables through a single Promise.all that
// RE-THREW on the first non-"table does not exist" error AND had NO timeout.
// Under connection-pool pressure (60+ tables queried at once) a single slow,
// erroring, or hanging table would leave Promise.all unsettled or throw — so
// fetchAll never returned, `db` stayed null, and the loading screen was shown
// forever with no retry. Each table now loads independently with its own
// timeout + one retry; a failing table degrades to an empty collection instead
// of bricking the whole workspace. RLS still protects the data (an error simply
// yields no rows); we only stop a transient failure from locking the app out.
// Startup is deliberately split into a small critical payload and a background
// hydration pass. The old boot path waited for 70+ database reads before showing
// the workspace; on mobile/slow networks that made the premium loader sit there
// for 30+ seconds even though the shell itself was ready.
const TABLE_FETCH_TIMEOUT_MS = 8000;
const TABLE_FETCH_CONCURRENCY = 10;
const BOOTSTRAP_TABLES = Object.freeze([
  "transactions", "tasks", "attendance", "leave", "updates", "announcements",
  "notifications", "chat", "projects", "clients", "invoices", "payroll"
]);
const BOOTSTRAP_TIMEOUT_MS = 4500;


function pTimeout(promise, ms, label, abortController) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      abortController?.abort();
      reject(new Error(`timeout:${label}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Awaitable query builder shim: chaining methods return the builder; awaiting
// it resolves the query. This mirrors how @supabase/supabase-js queries work so
// callers can use `.select(cols).order(...)` interchangeably.
function buildQuery(tbl, columns, orderColumn, signal) {
  let q = supabase.from(tbl).select(columns);
  if (orderColumn) q = q.order(orderColumn, { ascending: false });
  if (signal && typeof q.abortSignal === "function") q = q.abortSignal(signal);
  return q;
}

async function loadTableRows(table, columns, orderColumn, timeoutMs = TABLE_FETCH_TIMEOUT_MS, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    try {
      const { data, error } = await pTimeout(buildQuery(table, columns, orderColumn, controller?.signal), timeoutMs, table, controller);
      if (error) {
        if (attempt === retries) console.warn(`[ALLBEE] table "${table}" unavailable: ${error.message}`);
        continue;
      }
      return data || [];
    } catch (e) {
      if (attempt === retries) console.warn(`[ALLBEE] table "${table}" failed to load: ${e.message}`);
    }
  }
  return [];
}

async function fetchBootstrapData() {
  const db = emptyDB();
  const loaded = await mapWithConcurrency(BOOTSTRAP_TABLES, BOOTSTRAP_TABLES.length, async (t) => [
    t, await loadTableRows(t, "id,data", undefined, BOOTSTRAP_TIMEOUT_MS, 0)
  ]);
  for (const [t, rows] of loaded) {
    db[t] = (rows || [])
      .map((r) => r.data)
      .filter((x) => x && typeof x === "object")
      .sort((a, b) => (a?.createdAt || a?.ts || 0) - (b?.createdAt || b?.ts || 0));
  }
  return db;
}

async function fetchAll() {
  const db = emptyDB();
  // `audit` is intentionally excluded from the generic loader. Supabase/PostgREST
  // caps an un-ranged select at the API row limit (currently 1,000), and the old
  // generic path therefore silently loaded only the oldest ~1,000 audit events.
  // That made the Audit Log appear to stop around 20-Aug even though newer rows
  // existed in production. Audit has its own paginated loader below.
  const loaded = await mapWithConcurrency(TABLES.filter((t) => t !== "audit"), TABLE_FETCH_CONCURRENCY, async (t) => [t, await loadTableRows(t, "id,data")]);
  for (const [t, rows] of loaded) {
    db[t] = (rows || [])
      .map((r) => r.data)
      .filter((x) => x && typeof x === "object")   // tolerate a malformed/null row instead of white-screening
      .sort((a, b) => (a?.createdAt || a?.ts || 0) - (b?.createdAt || b?.ts || 0));
  }
  db.audit = await fetchAuditRows();
  Object.assign(db,
    await fetchReferralData(), await fetchWithdrawalData(), await fetchCRMData(), await fetchAIData(),
    await fetchClientData(), await fetchHelpdeskData(), await fetchAgreementData(),
    { apn_action_badge_reads: await fetchApnActionBadgeReads() });
  return db;
}

// Build a backup from a fresh normalized read as well as the legacy in-memory
// collections. This keeps exports complete even when a user exports before a
// background hydration/realtime refresh has populated every normalized key.
async function buildBackupSnapshot(db) {
  const snapshot = { ...(db || {}) };
  Object.assign(snapshot,
    await fetchReferralData(), await fetchWithdrawalData(), await fetchCRMData(),
    await fetchAIData(), await fetchClientData(), await fetchHelpdeskData(),
    await fetchAgreementData(),
    { apn_action_badge_reads: await fetchApnActionBadgeReads() }
  );
  return snapshot;
}

async function fetchAuditRows() {
  // Audit is append-only and can grow beyond the API's default 1,000-row limit.
  // Page newest-first so the UI always gets the complete history, then restore
  // chronological order for consumers that expect ascending source data.
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("audit")
      .select("id,data,updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Loading audit: ${error.message}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows
    .map((r) => ({ ...(r.data || {}), id: r.id }))
    .filter((x) => x && typeof x === "object")
    .sort((a, b) => (a?.ts || 0) - (b?.ts || 0));
}

async function appendAuditEvent(entry) {
  const event = activityEntry({ id: uid(), ts: Date.now(), ...entry });
  const { error } = await supabase.from("audit").insert({ id: event.id, data: event, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Persist the difference between two db snapshots (per collection, by id).
async function applyDiff(prev, next) {
  const stamp = new Date().toISOString();
  const ops = [];
  for (const t of TABLES) {
    const before = new Map((prev?.[t] || []).map((x) => [x.id, x]));
    const after = new Map((next?.[t] || []).map((x) => [x.id, x]));
    const upserts = [];
    for (const [id, row] of after) {
      const b = before.get(id);
      // Audit rows are immutable: only brand-new activity events may be
      // appended. Legacy rows remain untouched and can never be overwritten.
      if ((!b || JSON.stringify(b) !== JSON.stringify(row)) && (t !== "audit" || !b)) upserts.push({ id, data: row, updated_at: stamp });
    }
    const deletes = [];
    if (t !== "audit") for (const id of before.keys()) if (!after.has(id)) deletes.push(id);
    // The audit table is an append-only activity log. If it can't be written
    // (e.g. its RLS policy hasn't been added yet) that must NEVER block the
    // user's actual change — log it quietly and carry on.
    const optional = t === "audit";
    if (upserts.length) ops.push(supabase.from(t).upsert(upserts).then((r) => { if (r.error) { if (optional) { console.warn(`Audit log skipped: ${r.error.message}`); return; } throw new Error(`Saving ${t}: ${r.error.message}`); } }));
    if (deletes.length) ops.push(supabase.from(t).delete().in("id", deletes).then((r) => { if (r.error) { if (optional) return; throw new Error(`Deleting from ${t}: ${r.error.message}`); } }));
  }
  await Promise.all(ops);
}

// Supabase access tokens (JWTs) are short-lived. If the tab/app was asleep (laptop
// closed, phone locked) the background auto-refresh may not have fired, so the very
// next write goes out with an already-expired token and the server rejects it with
// "JWT expired" — and because our writes are optimistic, the change looked saved on
// screen but never reached the database (so it vanished on the next reload and the
// person was asked to check in again). This refreshes the session and retries the
// write exactly once before giving up, which clears the common expired-token case.
async function persistWithRetry(prev, next) {
  try {
    await applyDiff(prev, next);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (/jwt|token|expired|401|unauthor/i.test(msg)) {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw e;          // refresh itself failed → a real re-sign-in is needed
      await applyDiff(prev, next); // retry once now that we hold a fresh token
    } else {
      throw e;
    }
  }
}

// Replace the entire database (used by "Import backup").
// IMPORTANT: restore is a single server-side transaction. Never perform the
// delete/insert loop in the browser: a mid-restore failure must roll back every
// table, otherwise an apparently valid backup can leave production half-empty.
async function replaceAll(clean) {
  if (!clean || typeof clean !== "object" || Array.isArray(clean)) {
    throw new Error("Invalid ALLBEE backup: expected a JSON object.");
  }
  if (!Array.isArray(clean.transactions)) {
    throw new Error("Invalid ALLBEE backup: the transactions collection is missing or malformed.");
  }
  const { data, error } = await supabase.rpc("admin_restore_json_backup", { p_backup: clean });
  if (error) throw new Error(`Backup restore failed: ${error.message}`);
  if (!data?.ok) throw new Error("Backup restore failed: the server did not confirm a complete restore.");
  return data;
}

/* ── people (profiles / roles) ────────────────────────────────────────── */
async function fetchTeam() {
  const { data, error } = await supabase.from("profiles").select("id,name,email,role,active,created_at,status,mobile,dob,photo_url,perms,tnc_version,tnc_roles_accepted,approved,designation,last_active,last_login,last_logout,username").order("created_at", { ascending: true });
  if (error) throw new Error(`Loading team: ${error.message}`);
  return data || [];
}
// The live Terms & Conditions + version live in app_config; staff can read only
// the tnc_* keys (the admin sign-up code is locked away by row-level security).
async function fetchConfig() {
  const { data, error } = await supabase.from("app_config").select("key,value").in("key", ["tnc_version", "tnc_body", "tnc_roles", "company", "class_sheet_webhook", "ai"]);
  if (error) return {}; // non-fatal — the T&C gate simply won't apply
  const out = {};
  for (const r of data || []) out[r.key] = r.value;
  return out;
}
function companyOf(config) { try { return JSON.parse((config && config.company) || "{}") || {}; } catch { return {}; } }

async function saveConfig(patch) {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value: value == null ? "" : String(value) }));
  const { error } = await supabase.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/* ── ALLBEE AI — built-in assistant ────────────────────────────────────────
   The AI config lives in app_config under the "ai" key (one JSON blob). Two
   ways to run it:
     • mode "function" (recommended): a Supabase Edge Function holds the API key
       server-side; the browser only calls supabase.functions.invoke(name).
     • mode "direct" (quick start / internal use): the browser calls the model
       API directly with a key stored in config. The key is visible to anyone
       who can open the app, so prefer the function for anything shared. */
const AI_RUNTIME_MODEL = "openai/gpt-oss-120b";
const AI_DEFAULT_MODEL = AI_RUNTIME_MODEL;
const AI_DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
function aiConfigOf(config) {
  let raw = {};
  try { raw = JSON.parse((config && config.ai) || "{}") || {}; } catch { raw = {}; }
  // Production ALLBEE AI is always server-side. Ignore legacy/direct settings
  // so an old browser-stored llama model can never break the shared assistant.
  return {
    enabled: !!raw.enabled,
    mode: "function",
    functionName: "ai-chat-v2",
    endpoint: AI_DEFAULT_ENDPOINT,
    model: AI_RUNTIME_MODEL,
    apiKey: "",
  };
}
// Ready to answer? Function mode just needs a name (we can't see if it's deployed
// until we call it); direct mode needs a key.
function aiConfigured(cfg) {
  if (!cfg || !cfg.enabled) return false;
  return cfg.mode === "direct" ? !!cfg.apiKey : !!cfg.functionName;
}
// Send a chat turn and return the assistant's plain text. Tolerates a few
// response shapes so a simple Edge Function ({ text }) or a passthrough of the
// raw Anthropic response ({ content: [...] }) both work.
async function callAI(cfg, system, messages) {
  const model = cfg.model || AI_DEFAULT_MODEL;
  if (cfg.mode !== "direct") {
    const { data, error } = await supabase.functions.invoke(cfg.functionName || "ai-chat-v2", {
      body: { system, model, max_tokens: 1400, messages },
    });
    if (error) throw new Error(error.message || `Couldn't reach the "${cfg.functionName}" function. Is it deployed?`);
    if (data && data.error) throw new Error(typeof data.error === "string" ? data.error : "The AI function returned an error.");
    if (typeof data === "string") return data.trim();
    if (data && typeof data.text === "string") return data.text.trim();
    if (data && Array.isArray(data.content)) return data.content.filter((b) => b && b.type === "text").map((b) => b.text).join("\n").trim();
    return typeof data === "object" ? JSON.stringify(data) : String(data ?? "");
  }
  const res = await fetch(cfg.endpoint || AI_DEFAULT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 1400, system, messages }),
  });
  if (!res.ok) {
    let t = ""; try { t = await res.text(); } catch { /* ignore */ }
    throw new Error(`AI error ${res.status}${t ? ": " + t.slice(0, 300) : ""}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("\n").trim();
}
// Contact details are masked before the snapshot leaves the browser, so the
// model only ever sees partial emails/phones (never full client PII).
function maskEmail(e) {
  const s = String(e || "").trim();
  const at = s.indexOf("@");
  if (!s) return "";
  if (at <= 1) return s.slice(0, 1) + "***";
  return s.slice(0, 1) + "***@" + s.slice(at + 1);
}
function maskPhone(p) {
  const digits = String(p || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 5) return "***";
  return "****" + digits.slice(-4);
}
// Conservative free-text sanitizer for the AI snapshot: masks emails and
// plausible phone numbers (10+ digits, with optional separators) inside any
// note/description field. Everything else is preserved for business meaning.
function scrubText(v) {
  const s = String(v ?? "");
  if (!s) return s;
  let out = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, maskEmail);
  return out.replace(/\+?\d[\d\s().-]{7,}\d/g, (token) => {
    const digits = (token.match(/\d/g) || []).join("");
    return digits.length >= 10 ? "****" + digits.slice(-4) : token;
  });
}
// A compact, bounded snapshot of the workspace so the assistant can answer
// questions and draft quotations/replies grounded in real ALLBEE data.
function renderAIInline(text, keyPrefix = "ai") {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${keyPrefix}-b-${i}`} style={{ color: "var(--ink)", fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={`${keyPrefix}-c-${i}`} style={{ padding: "2px 5px", borderRadius: 5, background: "var(--primary-soft)", color: "var(--primary)", fontSize: "0.92em" }}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

function renderAIText(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const nodes = [];
  let bullets = [];
  let numbered = [];
  const flushList = () => {
    if (bullets.length) { nodes.push(<ul key={`ul-${nodes.length}`} style={{ margin: "6px 0 10px 20px", padding: 0 }}>{bullets.map((x, i) => <li key={i} style={{ margin: "4px 0" }}>{renderAIInline(x, `li-${nodes.length}-${i}`)}</li>)}</ul>); bullets = []; }
    if (numbered.length) { nodes.push(<ol key={`ol-${nodes.length}`} style={{ margin: "6px 0 10px 20px", padding: 0 }}>{numbered.map((x, i) => <li key={i} style={{ margin: "4px 0" }}>{renderAIInline(x, `oli-${nodes.length}-${i}`)}</li>)}</ol>); numbered = []; }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flushList(); nodes.push(<div key={`sp-${i}`} style={{ height: 7 }} />); return; }
    if (/^[-*]\s+/.test(t)) { numbered.length && flushList(); bullets.push(t.replace(/^[-*]\s+/, "")); return; }
    if (/^\d+[.)]\s+/.test(t)) { bullets.length && flushList(); numbered.push(t.replace(/^\d+[.)]\s+/, "")); return; }
    flushList();
    const heading = t.match(/^(#{1,3})\s+(.+)/);
    if (heading) { nodes.push(<div key={`h-${i}`} style={{ fontWeight: 800, fontSize: heading[1].length === 1 ? 17 : 15, margin: "9px 0 5px", color: "var(--ink)" }}>{renderAIInline(heading[2], `h-${i}`)}</div>); return; }
    if (/^>\s?/.test(t)) { nodes.push(<div key={`q-${i}`} style={{ borderLeft: "3px solid var(--primary)", padding: "5px 10px", margin: "6px 0", background: "var(--primary-soft)", borderRadius: "0 7px 7px 0" }}>{renderAIInline(t.replace(/^>\s?/, ""), `q-${i}`)}</div>); return; }
    nodes.push(<div key={`p-${i}`} style={{ margin: "3px 0" }}>{renderAIInline(t, `p-${i}`)}</div>);
  });
  flushList();
  return nodes;
}

function buildAIContext(db, company) {
  const cap = (arr, n) => (Array.isArray(arr) ? arr.slice(-n).reverse() : []);
  const co = company || {};
  const L = [];
  L.push(`COMPANY: ${co.name || "ALLBEE Solutions"}${co.email ? " · " + co.email : ""}${co.phone ? " · " + co.phone : ""}${co.website ? " · " + co.website : ""}`);
  if (co.address) L.push(`ADDRESS: ${co.address}`);

  const clients = cap(db.clients, 40);
  if (clients.length) {
    L.push(`\nCLIENTS (${db.clients.length} total, newest first):`);
    clients.forEach((c) => L.push(`- ${c.name}${c.company ? " (" + c.company + ")" : ""} · ${c.status || "—"}${c.phone ? " · " + maskPhone(c.phone) : ""}${c.email ? " · " + maskEmail(c.email) : ""}${c.value ? " · deal " + money(c.value) : ""}${c.notes ? " · " + scrubText(String(c.notes)).slice(0, 80) : ""}`));
  }
  const leads = cap(db.leads, 40);
  if (leads.length) {
    L.push(`\nLEADS (${db.leads.length}):`);
    leads.forEach((x) => L.push(`- ${x.name}${x.company ? " (" + x.company + ")" : ""} · service ${x.service || "—"} · stage ${x.stage || "—"}${x.value ? " · est " + money(x.value) : ""}${x.leadOwner ? " · owner " + x.leadOwner : ""}${x.phone ? " · " + maskPhone(x.phone) : ""}${x.notes ? " · " + scrubText(String(x.notes)).slice(0, 80) : ""}`));
  }
  const quotes = cap(db.quotations, 30);
  if (quotes.length) {
    L.push(`\nQUOTATIONS (${db.quotations.length}):`);
    quotes.forEach((q) => {
      const items = (q.items || []).map((it) => `${scrubText(it.desc || "item").slice(0, 60)} x${it.qty || 1} @ ${money(it.rate || 0)}`).join("; ");
      L.push(`- ${q.client || "—"}${q.title ? " · " + q.title : ""} · ${q.status || "Draft"} · total ${money(q.total || 0)}${items ? " · items: " + items.slice(0, 180) : ""}`);
    });
  }
  const inv = cap(db.invoices, 30);
  if (inv.length) {
    L.push(`\nINVOICES (${db.invoices.length}):`);
    inv.forEach((i) => L.push(`- ${i.number || ""} ${i.client || "—"}${i.title ? " · " + i.title : ""} · ${i.status || "Draft"} · ${money(i.amount || 0)}${i.dueDate ? " · due " + i.dueDate : ""}`));
  }
  const proj = cap(db.projects, 40);
  if (proj.length) {
    L.push(`\nPROJECTS (${db.projects.length}):`);
    proj.forEach((p) => L.push(`- ${p.name}${p.client ? " for " + p.client : ""} · ${p.type || "—"} · ${p.stage || "—"}${p.cost ? " · " + money(p.cost) : ""}${p.expected ? " · due " + p.expected : ""}`));
  }
  const openTasks = (db.tasks || []).filter((t) => t.status !== "Completed");
  const tks = cap(openTasks, 40);
  if (tks.length) {
    L.push(`\nOPEN TASKS (${openTasks.length}):`);
    tks.forEach((t) => L.push(`- ${t.title} · ${assigneeText(t)} · ${t.status}${t.priority ? " · " + t.priority : ""}${t.due ? " · due " + t.due : ""}`));
  }
  const cs = cap(db.class_students, 30);
  if (cs.length) {
    L.push(`\nCLASS STUDENTS (${db.class_students.length}):`);
    cs.forEach((s) => L.push(`- ${s.name}${s.course ? " · " + s.course : ""}${s.mode ? " · " + s.mode : ""}${s.fee ? " · fee " + money(s.fee) : ""}${s.paymentStatus ? " · " + s.paymentStatus : ""}`));
  }
  const counts = [];
  if (db.students?.length) counts.push(`course students ${db.students.length}`);
  if (db.marketing?.length) counts.push(`marketing clients ${db.marketing.length}`);
  if (db.concepts?.length) counts.push(`concepts/ideas ${db.concepts.length}`);
  if (db.inhouse?.length) counts.push(`in-house projects ${db.inhouse.length}`);
  if (db.planned?.length) counts.push(`planned expenses ${db.planned.length}`);
  if (counts.length) L.push(`\nOTHER COUNTS: ${counts.join(" · ")}`);
  const apn = cap(db.apn_users, 60);
  if (apn.length) {
    L.push(`\nAPN PARTNER NETWORK (${db.apn_users.length} total):`);
    apn.forEach((a) => L.push(`- ${a.name || a.username || "Partner"} · ${a.apnId || a.apn_id || "—"} · ${a.level || "—"} · ${a.status || "—"}${a.district ? " · district " + a.district : ""}${a.state ? " · state " + a.state : ""}${a.commissionRate != null ? " · commission " + a.commissionRate + "%" : ""}`));
  }
  const tx = cap(db.transactions, 50);
  if (tx.length) {
    L.push(`\nFINANCE TRANSACTIONS (${db.transactions.length} total, newest first):`);
    tx.forEach((x) => L.push(`- ${x.date || x.ts || "—"} · ${x.type || x.category || "transaction"} · ${x.description || x.client || "—"} · ${money(x.amount || x.value || 0)} · ${x.status || "—"}`));
  }
  const withdrawals = cap(db.withdrawals, 30);
  if (withdrawals.length) {
    L.push(`\nWITHDRAWALS (${db.withdrawals.length} total):`);
    withdrawals.forEach((w) => L.push(`- ${w.userName || w.user || "—"} · ${money(w.amount || 0)} · ${w.status || "—"} · ${w.requestedAt || w.date || "—"}`));
  }
  const audit = cap(db.audit, 50);
  if (audit.length) {
    L.push(`\nRECENT AUDIT ACTIVITY (${db.audit.length} total):`);
    audit.forEach((a) => L.push(`- ${a.ts ? new Date(a.ts).toLocaleString("en-IN") : "—"} · ${a.user || "System"} · ${a.module || "—"} · ${a.action || "—"} · ${scrubText(a.description || "")}`));
  }
  const genericModules = [
    ["tasks", "Tasks"], ["attendance", "Attendance"], ["leave", "Leave"], ["updates", "Daily updates"],
    ["team_chat", "Team chat"], ["projects", "Projects"], ["inhouse", "In-house projects"], ["marketing", "Marketing"],
    ["students", "Course students"], ["class_students", "Class students"], ["concepts", "Ideas"], ["notifications", "Notifications"],
    ["agreements", "Agreements"], ["materials", "Materials"], ["targets", "Targets"], ["rewards", "Rewards"],
  ];
  const moduleCounts = genericModules.filter(([k]) => Array.isArray(db[k])).map(([k, label]) => `${label}: ${db[k].length}`);
  if (moduleCounts.length) L.push(`\nMODULE COUNTS: ${moduleCounts.join(" · ")}`);
  L.push(`\nNOTE: Client/lead phone numbers and emails in this snapshot are masked; free-text notes and item descriptions are scrubbed for contact details. Ask the user for a full contact when one is needed.`);

  let out = L.join("\n");
  if (out.length > 12000) out = out.slice(0, 12000) + "\n…(snapshot truncated)";
  return out;
}
const AI_QUICK_PROMPTS = [
  ["Draft a quotation", "A client asked for a quotation. Ask me for the client name and what they need if it's not obvious, then draft a clear, itemised quotation in INR (₹) with a subtotal and total, professional wording, and short terms."],
  ["Reply to a client", "Help me write a short, professional reply to a client. Ask what the client said and the outcome I want, then draft it."],
  ["Follow-ups due", "Look at the leads and quotations in the snapshot and list who I should follow up with, grouped by priority, with a one-line suggested message for each."],
  ["Summarise open tasks", "Summarise the open tasks: what's overdue, what's high priority, and what each person is responsible for."],
  ["Explain a feature", "Explain what a part of the ALLBEE app does and how to use it. Ask which feature if I haven't said."],
];

// Global, never-reused task number (atomic on the server).
async function nextTaskNumber() {
  const { data, error } = await supabase.rpc("next_task_number");
  if (error) return null;
  return typeof data === "number" ? data : Number(data);
}
// Global, never-reused APN partner number (atomic on the server). Falls back to
// null so the caller can derive the next id from the loaded rows if the RPC
// hasn't been installed yet.
async function nextApnNumber() {
  const { data, error } = await supabase.rpc("next_apn_number");
  if (error) return null;
  return typeof data === "number" ? data : Number(data);
}
// Financial period locks ('YYYY-MM'). Partners lock/unlock; the DB blocks writes
// to a locked month for everyone else.
async function fetchLocks() {
  const { data, error } = await supabase.from("fin_locks").select("period").order("period", { ascending: true });
  if (error) return [];
  return (data || []).map((r) => r.period);
}
async function lockPeriod(period, who) {
  const { error } = await supabase.from("fin_locks").upsert({ period, locked_by: who || null }, { onConflict: "period" });
  if (error) throw new Error(error.message);
}
async function unlockPeriod(period) {
  const { error } = await supabase.from("fin_locks").delete().eq("period", period);
  if (error) throw new Error(error.message);
}
const fmtPeriod = (p) => { const [y, m] = (p || "").split("-"); const d = new Date(Number(y), Number(m) - 1, 1); return isNaN(d) ? p : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
const fmtDateTime = (ts) => formatDateValue(ts, true);
// "5m ago" / "2h ago" / "3d ago" style relative time, for last-seen displays.
function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return fmtDate(new Date(iso).toISOString().slice(0, 10));
}

// Turn a stored mobile into a WhatsApp-ready number (digits only, India default).
function waNumber(mobile) {
  let d = String(mobile || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;            // bare 10-digit → assume India
  return d;
}
// Reusable one-tap WhatsApp + Email buttons for a person (uses their mobile/email).
// `message` optionally pre-fills the text; `compact` shows icon-only buttons.
function ContactButtons({ person, message, compact = false, size = "sm", stop = true }) {
  if (!person) return null;
  const num = waNumber(person.mobile);
  const email = (person.email || "").trim();
  const wa = num ? `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ""}` : null;
  const mail = email ? `mailto:${email}${message ? `?body=${encodeURIComponent(message)}` : ""}` : null;
  if (!wa && !mail) return null;
  const cls = "btn" + (size === "sm" ? " sm" : "") + (compact ? " icon" : "");
  const halt = stop ? (e) => e.stopPropagation() : undefined;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {wa && <a className={cls + " wa-btn"} href={wa} target="_blank" rel="noreferrer" title={`WhatsApp ${person.name || ""}`.trim()} onClick={halt}><MessageCircle size={14} />{compact ? "" : "WhatsApp"}</a>}
      {mail && <a className={cls} href={mail} title={`Email ${person.name || ""}`.trim()} onClick={halt}><Mail size={14} />{compact ? "" : "Email"}</a>}
    </span>
  );
}
// Make sure the signed-in user has a profile row (covers accounts made before
// the database trigger existed). Defaults to a staff member; an admin can change
// the role later from the Team screen.
async function ensureProfile(user) {
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (data) return;
  const name = user.user_metadata?.name || (user.email ? user.email.split("@")[0] : "Member");
  // approved:false means a brand-new (or previously-removed) account lands on
  // "Awaiting approval" with no access until an admin lets them in — so deleting
  // someone is durable even if their auth login still exists.
  await supabase.from("profiles").upsert({ id: user.id, name, email: user.email, role: "staff", approved: false }, { onConflict: "id", ignoreDuplicates: true });
}
async function updateProfile(id, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── HR derived helpers ───────────────────────────────────────────────── */
const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(from + "T00:00:00"), b = new Date(to + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
};
const hoursBetween = (a, b) => {
  if (!a || !b) return null;
  return Math.max(0, (new Date(b) - new Date(a)) / 3600000);
};
const clockTime = (ts) => (ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const onApprovedLeave = (db, userId, dateISO) =>
  db.leave.some((l) => l.userId === userId && l.status === "Approved" && dateISO >= l.fromDate && dateISO <= l.toDate);
const attendanceFor = (db, userId, dateISO) => db.attendance.find((a) => a.userId === userId && a.date === dateISO) || null;

/* ── teams (team lead → members) ──────────────────────────────────────────
   A team is { id, name, leadId, leadName, memberIds[] }. A person belongs to
   the team they lead or are a member of. The lead is always counted in the
   roster. Stored in the `teams` table; team-scoped chat lives in `team_chat`. */
const teamOfUser = (teams, userId) => (teams || []).find((t) => t.leadId === userId || (t.memberIds || []).includes(userId)) || null;
const teamRosterIds = (t) => (t ? Array.from(new Set([t.leadId, ...(t.memberIds || [])].filter(Boolean))) : []);

const emptyDB = () => ({
  version: 3,
  transactions: [], withdrawals: [], tasks: [], projects: [],
  students: [], marketing: [], concepts: [], audit: [],
  attendance: [], leave: [], updates: [], recycle: [],
  leads: [], clients: [], quotations: [], planned: [],
  announcements: [], documents: [], knowledge: [], chat: [],
  rewards: [], vault: [], portal_posts: [],
  notifications: [], invoices: [], resignations: [], prompts: [], sheets: [],
  inhouse: [], payroll: [], teams: [], team_chat: [], testing: [], class_students: [],
  apn_users: [], apn_hierarchy_assignments: [], apn_attendance: [], apn_targets: [], apn_training: [], apn_quizzes: [],
  apn_leads: [], apn_quotations: [], apn_commissions: [], apn_commission_projects: [], apn_revenue_collections: [], apn_achievements: [], apn_notifications: [], apn_documents: [], apn_timeline: [], apn_warnings: [], apn_notes: [], apn_activity: [], apn_transfer_history: [], apn_communications: [], apn_action_badge_reads: [],
  apn_referral_codes: [], apn_referral_relationships: [], apn_referral_earnings: [], apn_referral_wallets: [], apn_referral_withdrawals: [], apn_referral_timeline: [], apn_referral_activities: [], apn_referral_monthly_summary: [], apn_referral_analytics_monthly: [],
  apn_withdrawal_bank_accounts: [], apn_withdrawal_wallets: [], apn_withdrawal_requests: [], apn_withdrawal_status_history: [], apn_withdrawal_settlements: [], apn_withdrawal_batches: [], apn_wallet_transactions: [], apn_withdrawal_finance_transactions: [], apn_withdrawal_audit: [], apn_withdrawal_exports: [],
  crm_clients: [], crm_leads: [], crm_lead_assignments: [], crm_follow_ups: [], crm_quotations: [], crm_quotation_versions: [], crm_projects: [], crm_revenue_collections: [], crm_activities: [], crm_files: [], crm_reminders: [], crm_audit: [],
  ai_settings: [], ai_insights: [], ai_predictions: [], ai_cache: [], ai_history: [], ai_recommendations: [], ai_reports: [],
  apn_agreements: [], apn_agreement_acceptances: [],
});

/* ── derived calculations ─────────────────────────────────────────────── */
function balances(db) {
  let Haji = 0, Alim = 0;
  for (const t of db.transactions) {
    const a = Number(t.amount) || 0;
    const h = (a * (Number(t.hajiPct) || 0)) / 100;
    const m = (a * (Number(t.alimPct) || 0)) / 100;
    if (t.kind === "income") { Haji += h; Alim += m; }
    else { Haji -= h; Alim -= m; }
  }
  for (const w of db.withdrawals) {
    if (w.status === "pending" || w.status === "rejected") continue; // only approved withdrawals move money
    if (w.user === "Haji") Haji -= Number(w.amount) || 0;
    else Alim -= Number(w.amount) || 0;
  }
  return { Haji: round2(Haji), Alim: round2(Alim), company: round2(Haji + Alim) };
}

function ledgerFor(db, user) {
  const events = [];
  for (const t of db.transactions) {
    const a = Number(t.amount) || 0;
    const pct = user === "Haji" ? Number(t.hajiPct) || 0 : Number(t.alimPct) || 0;
    const share = round2((a * pct) / 100);
    events.push({
      ts: t.createdAt || 0, date: t.date, client: t.client || "—",
      project: t.project || t.category || "—", category: t.category || "—",
      type: t.kind === "income" ? "Income" : "Expense",
      income: t.kind === "income" ? a : null,
      expense: t.kind === "expense" ? a : null,
      pct, credited: t.kind === "income" ? share : 0, debited: t.kind === "expense" ? share : 0,
      notes: t.notes || "",
    });
  }
  for (const w of db.withdrawals.filter((w) => w.user === user && w.status !== "pending" && w.status !== "rejected")) {
    events.push({
      ts: w.createdAt || 0, date: w.date, client: "—", project: "Withdrawal", category: "Withdrawal", type: "Withdrawal",
      income: null, expense: null, pct: 100, credited: 0, debited: Number(w.amount) || 0, notes: w.notes || "",
    });
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));
  let run = 0;
  return events.map((e) => { run = round2(run + e.credited - e.debited); return { ...e, running: run }; });
}

// ── task ownership / permissions ──────────────────────────────────────────
// Who may move a task through its workflow (Accept → Start → Complete → undo):
// only the assigned person. A task assigned to both partners can be acted on
// by either Haji or Alim.
// The people a task is assigned to. New tasks carry an explicit `assignees`
// array (one OR many people). Older tasks only have `assignedTo` — a single
// name, or the special "Haji & Alim" combined label — so we fall back to that.
const taskAssignees = (t) => {
  if (Array.isArray(t.assignees) && t.assignees.length) return t.assignees.slice();
  if (t.assignedTo === COMBINED) return USERS.slice();
  return t.assignedTo ? [t.assignedTo] : [];
};
const isMultiAssignee = (t) => taskAssignees(t).length > 1;
const assigneeText = (t) => taskAssignees(t).join(", ") || "—";
// Stable user-ids a task is assigned to. New tasks store `assigneeIds` alongside
// the readable names, so a task keeps pointing at the right person even after a
// display-name change (older tasks simply have no ids and fall back to names).
const taskAssigneeIds = (t) => (Array.isArray(t.assigneeIds) ? t.assigneeIds.filter(Boolean) : []);
// Is this task assigned to `who`? `who` may be a person object ({ id, name }) or
// a bare name string. We match on user-id first (rename-proof) and fall back to
// the name, so both new (id-carrying) and legacy (name-only) tasks resolve.
const isTaskAssignee = (t, who) => {
  const id = who && typeof who === "object" ? who.id : null;
  const name = who && typeof who === "object" ? who.name : who;
  const ids = taskAssigneeIds(t);
  if (id && ids.length && ids.includes(id)) return true;
  return !!name && taskAssignees(t).includes(name);
};
const canActOnTask = (t, who) => isTaskAssignee(t, who);
// Who may edit / delete / monitor a task: an admin or the person who created it.
const canEditTask = (t, who, isAdmin) => {
  if (isAdmin) return true;
  const id = who && typeof who === "object" ? who.id : null;
  const name = who && typeof who === "object" ? who.name : who;
  return (!!id && t.assignedById === id) || (!!name && t.assignedBy === name);
};

// ── multi-person accept ───────────────────────────────────────────────────
// A task with more than one assignee needs EACH assignee to Accept before it
// can Start; a single-assignee task needs only that one person. Any assignee
// may Start/Complete once accepted. (This also covers the old "Haji & Alim"
// combined tasks, which now simply have two assignees.)
const taskAccepts = (t) => (Array.isArray(t.accepts) ? t.accepts : []);

// The workflow patch produced when `by` clicks the action button. Returns only
// the fields to merge into the task. For a multi-assignee task still gathering
// everyone's acceptance it records the acceptance and keeps the status "Created".
function nextTaskState(t, by) {
  const accepts = taskAccepts(t);
  const assignees = taskAssignees(t);
  if (t.status === "Created" && assignees.length > 1) {
    const merged = accepts.includes(by) ? accepts : [...accepts, by];
    if (!assignees.every((u) => merged.includes(u))) {
      return { accepts: merged, history: [...(t.history || []), { status: `Accepted by ${by}`, at: Date.now(), by }] };
    }
    return { status: "Accepted", accepts: merged, progress: t.progress || 0, history: [...(t.history || []), { status: "Accepted", at: Date.now(), by }] };
  }
  const i = TASK_FLOW.indexOf(t.status);
  const next = TASK_FLOW[Math.min(i + 1, TASK_FLOW.length - 1)];
  const progress = next === "Completed" ? 100 : next === "In Progress" ? Math.max(t.progress || 0, 25) : (t.progress || 0);
  const merged = next === "Accepted" && !accepts.includes(by) ? [...accepts, by] : accepts;
  return { status: next, progress, accepts: merged, history: [...(t.history || []), { status: next, at: Date.now(), by }] };
}
// Label + disabled state for the workflow button. `null` means no action (done).
function taskAction(t, by) {
  if (t.status === "Completed") return null;
  const assignees = taskAssignees(t);
  if (t.status === "Created" && assignees.length > 1 && taskAccepts(t).includes(by)) {
    const waiting = assignees.filter((u) => !taskAccepts(t).includes(u)).join(", ");
    return { label: `Waiting for ${waiting}`, disabled: true };
  }
  return { label: t.status === "Created" ? "Accept" : t.status === "Accepted" ? "Start" : "Complete", disabled: false };
}
// A readable, ordered activity timeline. Falls back to a sensible reconstruction
// for tasks created before history tracking existed.
function taskTimeline(t) {
  if (Array.isArray(t.history) && t.history.length) {
    return [...t.history].sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const out = [{ status: "Created", at: t.createdAt || 0, by: t.assignedBy }];
  const idx = TASK_FLOW.indexOf(t.status);
  for (let i = 1; i <= idx; i++) out.push({ status: TASK_FLOW[i], at: t.createdAt || 0, by: i === 1 ? t.assignedTo : t.assignedTo });
  return out;
}

function monthStats(db) {
  let rev = 0, exp = 0;
  for (const t of db.transactions) {
    if (!sameMonth(t.date)) continue;
    if (t.kind === "income") rev += Number(t.amount) || 0;
    else exp += Number(t.amount) || 0;
  }
  return { rev: round2(rev), exp: round2(exp) };
}

/* ── dynamic expense sharing ───────────────────────────────────────────────
   Company-level office expenses for a month are split by the previous VALID
   revenue month's share. "Revenue share" for a month = how the month's income
   actually credited each partner (each income entry carries its own split), as
   a percentage of that month's total revenue. */
// Revenue split for one month ("YYYY-MM"). null when the month had no revenue.
function revenueShareForMonth(db, period) {
  let haji = 0, alim = 0;
  for (const t of (db.transactions || [])) {
    if (t.kind !== "income" || (t.date || "").slice(0, 7) !== period) continue;
    const a = Number(t.amount) || 0;
    haji += (a * (Number(t.hajiPct) || 0)) / 100;
    alim += (a * (Number(t.alimPct) || 0)) / 100;
  }
  const total = haji + alim;
  if (total <= 0) return null;
  const hp = round2((haji / total) * 100);
  return { hajiRev: round2(haji), alimRev: round2(alim), total: round2(total), haji: hp, alim: round2(100 - hp) };
}
// The most recent month strictly before `period` that resolves to a real share.
// This naturally skips no-revenue months (August in the spec's example), so the
// last valid month's percentages keep applying until a new valid month exists.
function latestRevenuePeriodBefore(db, period) {
  const months = new Set();
  for (const t of (db.transactions || [])) {
    if (t.kind !== "income" || !((Number(t.amount) || 0) > 0)) continue;
    const p = (t.date || "").slice(0, 7);
    if (p && p < period) months.add(p);
  }
  const sorted = [...months].sort();
  for (let i = sorted.length - 1; i >= 0; i--) if (revenueShareForMonth(db, sorted[i])) return sorted[i];
  return null;
}
// How a company expense dated in `period` should split. Falls back to an even
// 50/50 until the business has its first revenue month.
function expenseSharePlan(db, period) {
  const src = latestRevenuePeriodBefore(db, period);
  if (src) { const rs = revenueShareForMonth(db, src); return { sourcePeriod: src, haji: rs.haji, alim: rs.alim, fallback: false, revenue: rs }; }
  return { sourcePeriod: null, haji: DEFAULT_EXPENSE_SHARE.haji, alim: DEFAULT_EXPENSE_SHARE.alim, fallback: true, revenue: null };
}
// When was the driving revenue last touched (newest income entry in the source
// month)? Powers the "Last updated" line in Share & accounts.
function expenseShareLastUpdated(db, sourcePeriod) {
  if (!sourcePeriod) return null;
  let latest = 0;
  for (const t of (db.transactions || [])) {
    if (t.kind !== "income" || (t.date || "").slice(0, 7) !== sourcePeriod) continue;
    latest = Math.max(latest, t.createdAt || 0);
  }
  return latest || null;
}
// Treat an expense as company-scoped when tagged, else infer from legacy data:
// an expense tied to a project is project-scoped, everything else is company.
const expenseScope = (t) => t.scope || (t.project ? "project" : "company");

function marketingDue(m) {
  if (!m.startDate) return { label: "No start date", tone: "muted" };
  const start = new Date(m.startDate + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const due = new Date(today.getFullYear(), today.getMonth(), Math.min(start.getDate(), last));
  const paidThisMonth = m.lastPaid && sameMonth(m.lastPaid, today);
  if (paidThisMonth) return { label: "Paid this month", tone: "pos" };
  if (today >= due) return { label: "Payment due", tone: "neg" };
  return { label: "Due " + fmtDate(due.toISOString().slice(0, 10)), tone: "muted" };
}

/* ── staff earnings (salary + commission) ─────────────────────────────────
   A staff member earns two ways, configured per-person on the Staff salary
   screen and stored in the `payroll` table:
     • a fixed monthly salary, and/or
     • a commission — a percentage of the value of every revenue item they
       personally brought in (a student they registered, a project they added,
       or a client they own that carries a deal value).
   Commission is "realised" once the item is actually earning (student fee Paid,
   project Completed, client Active) and otherwise sits in the pipeline. */
function payrollFor(payroll, userId) {
  return (payroll || []).find((r) => r.userId === userId) || null;
}
function monthsSince(iso) {
  if (!iso) return 1;
  const j = new Date(iso);
  if (isNaN(j)) return 1;
  const now = new Date();
  return Math.max(1, (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth()) + 1);
}
function staffEarnings(db, payroll, person, joinedISO) {
  const cfg = payrollFor(payroll, person.id);
  const pct = Number(cfg?.commissionPct) || 0;
  const fixedMonthly = Number(cfg?.fixedMonthly) || 0;
  const items = [];
  const add = (kind, name, base, realized, status, date, id) => {
    const b = Number(base) || 0;
    items.push({ kind, name: name || "—", base: b, realized, status, date: date || "", id, commission: round2((b * pct) / 100) });
  };
  for (const s of db.students || []) {
    if (s.createdById !== person.id) continue;
    add("Student", s.name, s.fee, s.paymentStatus === "Paid", s.paymentStatus || "Unpaid", s.joinDate, s.id);
  }
  for (const p of db.projects || []) {
    if (p.createdById !== person.id) continue;
    if ((p.approvalStatus || "approved") === "rejected") continue;
    add("Project", p.name, p.cost, p.stage === "Completed", p.stage || "Lead", p.start, p.id);
  }
  for (const c of db.clients || []) {
    if (c.ownerId !== person.id || !(Number(c.value) || 0)) continue;
    add("Client", c.name, c.value, c.status === "Active", c.status || "Prospect", c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "", c.id);
  }
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const realisedComm = round2(items.filter((i) => i.realized).reduce((s, i) => s + i.commission, 0));
  const pipelineComm = round2(items.filter((i) => !i.realized).reduce((s, i) => s + i.commission, 0));
  const incentives = Array.isArray(cfg?.incentives) ? cfg.incentives : [];
  const incentivesTotal = round2(incentives.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const months = monthsSince(joinedISO);
  const salaryToDate = round2(fixedMonthly * months);
  const configured = !!cfg && (fixedMonthly > 0 || pct > 0 || incentivesTotal > 0);
  return { cfg, pct, fixedMonthly, items, realisedComm, pipelineComm, incentives, incentivesTotal, months, salaryToDate, configured, totalToDate: round2(realisedComm + salaryToDate + incentivesTotal) };
}

/* ══════════════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
   SMALL UI PRIMITIVES
══════════════════════════════════════════════════════════════════════ */
function SplitBar({ h, a, legend = true }) {
  return (
    <div>
      <div className="split"><div className="h" style={{ width: `${h}%` }} /><div className="a" style={{ width: `${a}%` }} /></div>
      {legend && (
        <div className="split-legend">
          <span><span className="dot" style={{ background: "var(--haji)" }} /> Haji {h}%</span>
          <span><span className="dot" style={{ background: "var(--alim)" }} /> Alim {a}%</span>
        </div>
      )}
    </div>
  );
}

// One app-wide feedback channel. Any feature can emit a toast without owning
// another notification component or falling back to a blocking browser alert.
function emitToast(message, type = "info", options = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("allbee-toast", { detail: { message, type, duration: options.duration ?? 4200 } }));
}

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail || {};
      const item = { id: uid(), message: String(detail.message || ""), type: detail.type || "info", duration: detail.duration ?? 4200 };
      if (!item.message) return;
      setItems((current) => [...current.slice(-4), item]);
    };
    window.addEventListener("allbee-toast", onToast);
    return () => window.removeEventListener("allbee-toast", onToast);
  }, []);
  return <div className="toast-viewport" aria-live="polite" aria-atomic="false">{items.map((item) => <ToastCard key={item.id} item={item} onDismiss={() => setItems((current) => current.filter((x) => x.id !== item.id))} />)}</div>;
}

function ToastCard({ item, onDismiss }) {
  const timerRef = useRef(null);
  const remainingRef = useRef(item.duration);
  const startedRef = useRef(0);
  const schedule = () => {
    if (remainingRef.current <= 0 || item.duration <= 0) return;
    startedRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, remainingRef.current);
  };
  useEffect(() => { schedule(); return () => clearTimeout(timerRef.current); }, [item.id]);
  const pause = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
  };
  const resume = () => { if (!timerRef.current) schedule(); };
  const Icon = item.type === "success" ? Check : item.type === "warning" || item.type === "error" ? AlertTriangle : Bell;
  return <div className={`toast ${item.type}`} role={item.type === "error" ? "alert" : "status"} onMouseEnter={pause} onMouseLeave={resume}>
    <Icon className="toast-icon" size={17} aria-hidden="true" />
    <div className="toast-body">{item.message}</div>
    <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onDismiss}><X size={15} /></button>
  </div>;
}

function ActionBadge({ count, label = "action" }) {
  if (!count) return null;
  const display = count > 99 ? "99+" : count;
  return <span className="badge action-badge" aria-label={`${count} ${label}${count === 1 ? "" : "s"} required`}>{display}</span>;
}

function SearchableSelect({ options = [], value, onChange, placeholder = "Choose…", disabled = false, ariaLabel, id }) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const normalized = useMemo(() => options.map((option) => typeof option === "object" ? option : ({ value: option, label: option })), [options]);
  const selected = normalized.find((option) => String(option.value) === String(value));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? normalized.filter((option) => `${option.label || ""} ${option.meta || ""}`.toLowerCase().includes(q)) : normalized;
  }, [normalized, query]);
  useEffect(() => {
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 0); }, [open]);
  useEffect(() => { setHighlight(0); }, [query]);
  const choose = (option) => { if (option?.disabled) return; onChange?.(option.value); setQuery(""); setOpen(false); };
  const onTriggerKey = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };
  const onSearchKey = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((current) => Math.min(current + 1, Math.max(0, filtered.length - 1))); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((current) => Math.max(0, current - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); choose(filtered[highlight]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };
  return <div ref={rootRef} className="combo" id={id}>
    <button type="button" className="input combo-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={onTriggerKey}>
      <span className="combo-value">{selected?.label || placeholder}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="combo-menu">
      <input ref={searchRef} className="input combo-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKey} placeholder="Type to filter…" aria-label={`Filter ${ariaLabel || "options"}`} autoComplete="off" />
      <div className="combo-options" role="listbox" aria-label={ariaLabel || "Options"}>
        {filtered.length ? filtered.map((option, index) => <button type="button" key={String(option.value)} role="option" aria-selected={String(option.value) === String(value)} disabled={option.disabled} className={`combo-option${index === highlight ? " on" : ""}`} onMouseEnter={() => setHighlight(index)} onClick={() => choose(option)}>
          <span className="combo-option-main">{option.label}</span>{option.meta && <span className="combo-option-meta">{option.meta}</span>}
        </button>) : <div className="combo-empty">No matches found.</div>}
      </div>
    </div>}
  </div>;
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function useUsernameAvailability(value, excludeId = null) {
  const normalized = normalizeUsername(value);
  const [state, setState] = useState({ checking: false, available: null });
  useEffect(() => {
    let cancelled = false;
    if (!normalized) { setState({ checking: false, available: null }); return undefined; }
    setState({ checking: true, available: null });
    const timer = setTimeout(async () => {
      let available = null;
      try {
        const result = await supabase.rpc("username_available", { p_username: normalized, p_exclude: excludeId });
        if (!result.error) available = Boolean(result.data);
      } catch { /* deployed edge fallback below */ }
      if (available === null) {
        try {
          const result = await supabase.functions.invoke("username-login", { body: { username: normalized, check: true, exclude: excludeId } });
          if (!result.error && result.data && typeof result.data.available === "boolean") available = result.data.available;
        } catch { /* availability remains unknown until the save guard runs */ }
      }
      if (!cancelled) setState({ checking: false, available });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [normalized, excludeId]);
  return { normalized, ...state };
}

function useEmailAvailability(value, excludeId = null) {
  const normalized = String(value || "").trim().toLowerCase();
  const [state, setState] = useState({ checking: false, available: null });
  useEffect(() => {
    let cancelled = false;
    if (!normalized || !normalized.includes("@")) { setState({ checking: false, available: null }); return undefined; }
    setState({ checking: true, available: null });
    const timer = setTimeout(async () => {
      let available = null;
      try {
        const result = await supabase.rpc("email_available", { p_email: normalized, p_exclude: excludeId });
        if (!result.error) available = Boolean(result.data);
      } catch { /* deployed edge fallback below */ }
      if (available === null) {
        try {
          const result = await supabase.functions.invoke("username-login", { body: { username: normalized, kind: "email", check: true, exclude: excludeId } });
          if (!result.error && result.data && typeof result.data.available === "boolean") available = result.data.available;
        } catch { /* availability remains unknown until auth validates the save */ }
      }
      if (!cancelled) setState({ checking: false, available });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [normalized, excludeId]);
  return { normalized, ...state };
}

function PasswordField({ label, value, onChange, error, hint, required, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return <Field label={label} required={required} error={error} hint={hint}>
    <div className="password-wrap"><input {...inputProps} className={`input${inputProps.className ? ` ${inputProps.className}` : ""}`} type={visible ? "text" : "password"} value={value} onChange={onChange} />
      <button type="button" className="password-toggle" aria-label={visible ? `Hide ${label || "password"}` : `Show ${label || "password"}`} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  </Field>;
}

function Modal({ title, onClose, children, footer, onMaximize }) {
  const modalRef = useRef(null);
  const titleId = useId();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = modalRef.current;
    const focusable = () => Array.from(root?.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex=\"-1\"])" ) || []);
    const first = root?.querySelector("[autofocus]") || focusable()[0];
    first?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [onClose]);
  const trapFocus = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(modalRef.current?.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex=\"-1\"])" ) || []);
    if (!nodes.length) return;
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className={`modal${maximized ? " modal-maximized" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={trapFocus}>
        <div className="modal-head"><h3 id={titleId}>{title}</h3><span style={{ flex: 1 }} />
          <button className="iconbtn" onClick={() => onMaximize ? onMaximize() : setMaximized((current) => !current)} aria-label={maximized ? "Restore dialog" : onMaximize ? "Open full page" : "Maximize dialog"} title={maximized ? "Restore dialog" : onMaximize ? "Open full page" : "Maximize dialog"}>{maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <button className="iconbtn" onClick={onClose} aria-label="Close dialog" title="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, required, children, error, hint }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = React.isValidElement(children) ? React.cloneElement(children, {
    id: children.props.id || id,
    "aria-invalid": error ? "true" : children.props["aria-invalid"],
    "aria-describedby": [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined,
  }) : children;
  return (
    <div className="field">
      {label && <label htmlFor={React.isValidElement(control) ? control.props.id : id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>}
      {control}
      {hint && !error && <div id={hintId} className="hint-line" style={{ marginTop: 5 }}>{hint}</div>}
      {error && <div id={errorId} className="field-err" role="alert"><AlertTriangle size={13} />{error}</div>}
    </div>
  );
}

function Empty({ icon, title, text, action }) {
  return (
    <div className="empty" role="status">
      <div className="ic">{icon}</div>
      <h4>{title}</h4><p>{text}</p>
      {action}
    </div>
  );
}

function Confirm({ title, body, confirmLabel = "Delete", onConfirm, onClose, danger = true, error, busyLabel = "Working…" }) {
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) onClose?.(); };
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onConfirm?.();
      if (result !== false) onClose();
    } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={close}
      footer={<>
        <button className="btn" onClick={close} disabled={busy}>Cancel</button>
        <button className={"btn " + (danger ? "primary" : "primary")} style={danger ? { background: "var(--neg)", borderColor: "var(--neg)" } : {}}
          onClick={confirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </>}>
      {error && <div className="auth-msg err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55, whiteSpace: "pre-line" }}>{body}</p>
    </Modal>
  );
}

// Safer destructive action: the button stays disabled until the person types the
// exact word (CONFIRM). Used for every delete and every restore.
function TypedConfirm({ title, body, note, word = "CONFIRM", actionLabel = "Delete", icon, danger = true, onConfirm, onClose }) {
  const [val, setVal] = useState("");
  const ok = val === word;
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok}
          style={ok && danger ? { background: "var(--neg)", borderColor: "var(--neg)" } : {}}
          onClick={() => { if (ok) { onConfirm(); onClose(); } }}>
          {icon}{actionLabel}
        </button>
      </>}>
      {body && <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>{body}</p>}
      {note && (
        <div className="calc-box" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={18} color={danger ? "var(--neg)" : "var(--accent)"} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>{note}</span>
        </div>
      )}
      <Field label={<>Type <b className="mono" style={{ letterSpacing: ".5px" }}>{word}</b> to confirm</>}>
        <input className="input mono" autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={word} onKeyDown={(e) => { if (e.key === "Enter" && ok) { onConfirm(); onClose(); } }} />
      </Field>
    </Modal>
  );
}

const STAFF_COLORS = ["#E8743B", "#1DAF9C", "#C0428A", "#2E8BD0", "#E0A100", "#5A6ACF", "#3FA34D", "#D2553B", "#8E5CC0", "#0FA3A3"];
function avatarColor(name) {
  if (name === "Haji") return "var(--haji)";
  if (name === "Alim") return "var(--alim)";
  let h = 0; const s = name || "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return STAFF_COLORS[h % STAFF_COLORS.length];
}

// Reusable avatar: shows the person's uploaded photo when there is one, otherwise
// the coloured initial. Use anywhere a person is represented.
function Avatar({ name, url, size = 26, fontSize, style }) {
  const fs = fontSize || Math.max(10, Math.round(size * 0.42));
  return (
    <div className="avatar" style={{ background: avatarColor(name || "?"), width: size, height: size, fontSize: fs, overflow: "hidden", padding: 0, ...style }}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?")[0]}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FORMS
══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
   PAGES
══════════════════════════════════════════════════════════════════════ */
// Days until a person's next birthday (DOB captured at first login). Returns
// 0 on the day itself, null if no/invalid DOB.
function daysUntilBirthday(dobISO, ref = new Date()) {
  if (!dobISO) return null;
  const d = new Date(dobISO + (dobISO.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return null;
  const today = new Date(ref); today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - today) / 86400000);
}
// Upcoming employee birthdays (clients excluded). Shows nothing when none fall
// inside the window, so it stays out of the way most of the year.
function Birthdays({ team, windowDays = 30 }) {
  const upcoming = (team || [])
    .filter((p) => p.role !== "client" && p.active !== false && p.dob)
    .map((p) => ({ p, days: daysUntilBirthday(p.dob) }))
    .filter((x) => x.days != null && x.days <= windowDays)
    .sort((a, b) => a.days - b.days);
  if (upcoming.length === 0) return null;
  const rel = (n) => (n === 0 ? "Today 🎂" : n === 1 ? "Tomorrow" : `in ${n} days`);
  const dayMonth = (dobISO) => fmtDate(dobISO);
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><CalendarDays size={14} /> Upcoming birthdays</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {upcoming.slice(0, 6).map(({ p, days }) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="avatar" style={{ background: avatarColor(p.name), width: 28, height: 28, fontSize: 11 }}>{p.name[0]}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{p.name}{days === 0 ? " — wish them well!" : ""}</span>
            <span className="hint-line mono" style={{ fontSize: 12 }}>{dayMonth(p.dob)}</span>
            <span className={"badge " + (days === 0 ? "pos" : days <= 7 ? "accent" : "")}>{rel(days)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard cards: previous month's revenue share (the source) + the split now
// applied to this month's company expenses. Both read live from the ledger.
function ExpenseShareCards({ db, go }) {
  const period = todayISO().slice(0, 7);
  const plan = expenseSharePlan(db, period);
  const src = plan.sourcePeriod;
  return (
    <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
      <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("accounts")}>
        <div className="lbl"><TrendingUp size={14} /> Previous month revenue share</div>
        <div className="sub" style={{ marginTop: 4 }}>{src ? `Based on ${fmtPeriod(src)}` : "No revenue recorded yet"}</div>
        <div style={{ margin: "12px 0 6px" }}><SplitBar h={plan.haji} a={plan.alim} legend={false} /></div>
        <div className="split-legend"><span><span className="dot" style={{ background: "var(--haji)" }} /> Haji {plan.haji}%</span><span><span className="dot" style={{ background: "var(--alim)" }} /> Alim {plan.alim}%</span></div>
      </div>
      <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("accounts")}>
        <div className="lbl"><Coins size={14} /> Current month expense share</div>
        <div className="sub" style={{ marginTop: 4 }}>{plan.fallback ? "Even split until first revenue" : `Applied to ${fmtPeriod(period)} company costs`}</div>
        <div style={{ margin: "12px 0 6px" }}><SplitBar h={plan.haji} a={plan.alim} legend={false} /></div>
        <div className="split-legend"><span><span className="dot" style={{ background: "var(--haji)" }} /> Haji {plan.haji}%</span><span><span className="dot" style={{ background: "var(--alim)" }} /> Alim {plan.alim}%</span></div>
      </div>
    </div>
  );
}

// Share & accounts panel: revenue share %, applied expense share %, the source
// month the numbers came from, and when that revenue was last updated.
function ExpenseSharePanel({ db }) {
  const period = todayISO().slice(0, 7);
  const plan = expenseSharePlan(db, period);
  const updated = expenseShareLastUpdated(db, plan.sourcePeriod);
  return (
    <div className="card stat" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Coins size={16} color="var(--muted)" />
        <div style={{ fontWeight: 700 }}>Company expense sharing</div>
        <span className="tag" style={{ marginLeft: "auto" }}>{plan.fallback ? "Default split" : "Auto"}</span>
      </div>
      <div className="hint-line" style={{ fontSize: 12, marginTop: 4 }}>
        {plan.fallback ? "Company costs split 50/50 until your first revenue month." : `Company costs this month split by ${fmtPeriod(plan.sourcePeriod)}'s revenue share.`}
      </div>
      <div style={{ margin: "12px 0 6px" }}><SplitBar h={plan.haji} a={plan.alim} legend={false} /></div>
      <div className="split-legend" style={{ marginBottom: 8 }}><span><span className="dot" style={{ background: "var(--haji)" }} /> Haji {plan.haji}%</span><span><span className="dot" style={{ background: "var(--alim)" }} /> Alim {plan.alim}%</span></div>
      <div className="meta-grid" style={{ marginTop: 4 }}>
        <div><div className="k">Revenue share</div><div className="v mono">{plan.revenue ? `${plan.revenue.haji}% / ${plan.revenue.alim}%` : "—"}</div></div>
        <div><div className="k">Expense share</div><div className="v mono">{plan.haji}% / {plan.alim}%</div></div>
        <div><div className="k">Source month</div><div className="v">{plan.sourcePeriod ? fmtPeriod(plan.sourcePeriod) : "—"}</div></div>
        <div><div className="k">Last updated</div><div className="v">{updated ? fmtDate(new Date(updated).toISOString().slice(0, 10)) : "—"}</div></div>
      </div>
    </div>
  );
}

function Dashboard({ db, bal, go, openBalance, onOpenActivity, showMoney = true, showOps = true, team = [], isSuper = false }) {
  const m = monthStats(db);
  const apnSummary = showOps ? apnCommissionDashboardSummary(db) : null;
  const pending = db.tasks.filter((t) => t.status !== "Completed").length;
  const active = db.projects.filter((p) => p.stage !== "Completed").length;
  const recent = [...db.audit].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 20);
  const awayList = isSuper ? inactiveMembers(team) : [];
  const openAudit = (e) => {
    if (e.type === "keydown" && !["Enter", " "].includes(e.key)) return;
    if (e.type === "keydown") e.preventDefault();
    go("audit");
  };
  const stats = [];
  if (showMoney) {
    stats.push(<div key="rev" className="card stat"><div className="lbl"><TrendingUp size={14} /> Monthly revenue</div><div className="num mono pos-txt">{money(m.rev)}</div></div>);
    stats.push(<div key="exp" className="card stat"><div className="lbl"><TrendingUp size={14} style={{ transform: "scaleY(-1)" }} /> Monthly expenses</div><div className="num mono neg-txt">{money(m.exp)}</div></div>);
  }
  if (showOps) {
    stats.push(<div key="tasks" className="card stat" style={{ cursor: "pointer" }} onClick={() => go("tasks")}><div className="lbl"><ListTodo size={14} /> Pending tasks</div><div className="num">{pending}</div></div>);
    stats.push(<div key="proj" className="card stat" style={{ cursor: "pointer" }} onClick={() => go("projects")}><div className="lbl"><FolderKanban size={14} /> Active projects</div><div className="num">{active}</div></div>);
  }
  return (
    <div className="content">
      <div className="page-head"><h3>Dashboard</h3></div>

      {awayList.length > 0 && (
        <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14, borderColor: "var(--neg)", background: "var(--neg-soft)", cursor: "pointer" }} onClick={() => go("activity")}>
          <AlertTriangle size={15} color="var(--neg)" />
          <span><b>{awayList.length} {awayList.length === 1 ? "person hasn't" : "people haven't"} signed in for over a week</b> — {awayList.slice().sort((a, b) => lastSeenMs(a) - lastSeenMs(b)).slice(0, 4).map((p) => p.name).join(", ")}{awayList.length > 4 ? ` +${awayList.length - 4} more` : ""}. Tap to review activity.</span>
        </div>
      )}

      <Birthdays team={team} />

      {showMoney && (
        <div className="card stat" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div><div className="lbl"><Wallet size={14} /> Company balance</div>
            <div className="num mono" style={{ color: bal.company < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.company)}</div>
            <div className="sub">Haji balance + Alim balance</div></div>
          <span style={{ flex: 1, minWidth: 20 }} />
          <div style={{ minWidth: 220 }}>
            <SplitBar
              h={bal.company > 0 ? Math.max(0, Math.round((bal.Haji / bal.company) * 100)) : 50}
              a={bal.company > 0 ? Math.max(0, Math.round((bal.Alim / bal.company) * 100)) : 50}
              legend={false} />
            <div className="split-legend" style={{ marginTop: 8 }}>
              <span><span className="dot" style={{ background: "var(--haji)" }} /> Haji {money(bal.Haji)}</span>
              <span><span className="dot" style={{ background: "var(--alim)" }} /> Alim {money(bal.Alim)}</span>
            </div>
          </div>
        </div>
      )}

      {showMoney && (
        <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
          {USERS.map((u) => (
            <div key={u} className="card balance-card" onClick={() => openBalance(u)}>
              <div className="stripe" style={{ background: avatarColor(u) }} />
              <div className="who"><span className="dot" style={{ background: avatarColor(u) }} /> {u} balance</div>
              <div className="amt mono" style={{ color: bal[u] < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal[u])}</div>
              <div className="hint">View full breakdown <ChevronRight size={13} /></div>
            </div>
          ))}
        </div>
      )}

      {showMoney && <ExpenseShareCards db={db} go={go} />}

      {stats.length > 0 && (
        <div className="cards-grid appear" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 18 }}>
          {stats}
        </div>
      )}

      {showOps && apnSummary && <div className="card" style={{ marginBottom: 18 }}><div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Coins size={15} /> APN commission collection</div><div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", padding: 12 }}><div className="card stat"><div className="lbl">Total project value</div><div className="num mono">{money(apnSummary.totalValue)}</div></div><div className="card stat"><div className="lbl">Revenue received</div><div className="num mono pos-txt">{money(apnSummary.totalReceived)}</div></div><div className="card stat"><div className="lbl">Outstanding revenue</div><div className="num mono">{money(apnSummary.outstanding)}</div></div><div className="card stat"><div className="lbl">Commission paid</div><div className="num mono">{money(apnSummary.commissionPaid)}</div></div><div className="card stat"><div className="lbl">Pending commission</div><div className="num mono">{money(apnSummary.pendingCommission)}</div></div><div className="card stat"><div className="lbl">Processing projects</div><div className="num">{apnSummary.processingProjects}</div></div><div className="card stat"><div className="lbl">Completed projects</div><div className="num">{apnSummary.completedProjects}</div></div></div></div>}

      <div className="card activity-feed-card" role="button" tabIndex={0} aria-label="Open Admin audit log" title="Open Admin audit log"
        onClick={openAudit} onKeyDown={openAudit}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Recent activity</div>
        {recent.length === 0 ? (
          <Empty icon={<ScrollText size={22} color="var(--muted)" />} title="Nothing here yet" text="Your activity feed fills up as the team works." />
        ) : recent.map((a) => (
          <div key={a.id} className="item-row activity-row" role="button" tabIndex={0} aria-label={`View activity details: ${a.description || a.action || "activity"}`} onClick={(e) => { e.stopPropagation(); onOpenActivity?.(a); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpenActivity?.(a); } }}>
            <Avatar name={a.user || "System"} url={a.avatar} size={28} fontSize={11} />
            <div className="item-main"><div className="item-title" style={{ fontWeight: 500, fontSize: 14 }}>{a.description || `${a.user || "System"} ${a.action || "performed an action"}`}</div>
              <div className="item-meta"><span>{activityModuleOf(a.module)}</span><span>{fmtTime(a.ts)}</span></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceDetail({ db, user, onClose, onFull }) {
  const rows = useMemo(() => ledgerFor(db, user), [db, user]);
  const final = rows.length ? rows[rows.length - 1].running : 0;
  return (
    <Modal title={`${user} — balance breakdown`} onClose={onClose}
      footer={<>
        {onFull && <button className="btn" onClick={() => { onClose(); onFull(user); }}><ExternalLink size={15} />Open full view</button>}
        <button className="btn primary" onClick={onClose}>Close</button>
      </>}>
      <div className="calc-box" style={{ marginBottom: 4 }}>
        <div className="calc-row"><span style={{ color: "var(--muted)" }}>Current balance</span>
          <span className="mono" style={{ fontWeight: 800, fontSize: 18, color: final < 0 ? "var(--neg)" : "var(--ink)" }}>{money(final)}</span></div>
      </div>
      {rows.length === 0 ? <Empty icon={<Wallet size={22} color="var(--muted)" />} title="No movements yet" text="Income, expenses and withdrawals for this partner will appear here." /> : (
        <div style={{ overflowX: "auto", margin: "0 -20px -20px" }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Client / item</th><th>Type</th><th>%</th><th className="num-cell">Credited</th><th className="num-cell">Debited</th><th className="num-cell">Balance</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td><div style={{ fontWeight: 600 }}>{r.project}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{r.client}</div></td>
                  <td><span className={"badge " + (r.type === "Income" ? "pos" : r.type === "Expense" ? "neg" : "")}>{r.type}</span></td>
                  <td className="mono">{r.pct}%</td>
                  <td className="num-cell mono pos-txt">{r.credited ? money(r.credited) : "—"}</td>
                  <td className="num-cell mono neg-txt">{r.debited ? money(r.debited) : "—"}</td>
                  <td className="num-cell mono" style={{ fontWeight: 700, color: r.running < 0 ? "var(--neg)" : "var(--ink)" }}>{money(r.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* ── exports (Excel / PDF) ──────────────────────────────────────────────────
   The export libraries are fetched on demand from a CDN, so they are NOT npm
   or build dependencies — nothing to install, nothing to bundle, and the app
   loads fine without them. They're only downloaded the moment you export.
   (Loaded via a variable URL so the bundler treats them as runtime-external.) */
const EXPORT_CDN = {
  xlsx: "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs",
};
// PDFs are built with the bundled jsPDF engine (a real PDF, not a print page).
// Standard PDF fonts cover WinAnsi only, so rupee signs and non-Latin glyphs
// are sanitized before drawing — deterministic on every device, no font bloat.
const pdfSafe = (t) => String(t ?? "").replace(/₹/g, "Rs.").replace(/[\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, (c) => ({ "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2026": "..." }[c])).replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").replace(/\s+/g, " ").trim();
const loadPdfEngine = () => Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([j, a]) => ({ jsPDF: j.jsPDF, autoTable: a.default }));
async function exportRowsToExcel(filename, sheetName, columns, rows) {
  try {
    const mod = await import(/* @vite-ignore */ EXPORT_CDN.xlsx);
    const XLSX = mod.utils ? mod : (mod.default || mod);
    const aoa = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => c.value(r)))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = columns.map((c) => ({ wch: c.w || 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Sheet1").slice(0, 31));
    XLSX.writeFile(wb, filename);
  } catch (e) { console.error(e); emitToast("Couldn't build the Excel file — check your connection and try again.", "error"); }
}
// Full backup → one worksheet per table, every row flattened. Opens directly in
// Excel or Google Sheets (File → Import) and doubles as a keep-safe snapshot.
async function exportFullBackupXLSX(db) {
  try {
    const snapshot = await buildBackupSnapshot(db);
    const mod = await import(/* @vite-ignore */ EXPORT_CDN.xlsx);
    const XLSX = mod.utils ? mod : (mod.default || mod);
    const wb = XLSX.utils.book_new();
    const used = new Set();
    let any = false;
    for (const t of Object.keys(snapshot)) {
      const rows = snapshot[t] || [];
      if (!rows.length) continue;
      const keys = Array.from(rows.reduce((s, r) => { Object.keys(r || {}).forEach((k) => s.add(k)); return s; }, new Set()));
      const aoa = [keys, ...rows.map((r) => keys.map((k) => { const v = r ? r[k] : undefined; return v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : v); }))];
      let name = (MODULE_LABEL[t] || t).slice(0, 31), base = name, i = 2;
      while (used.has(name.toLowerCase())) { name = (base.slice(0, 28) + " " + i).slice(0, 31); i++; }
      used.add(name.toLowerCase());
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
      any = true;
    }
    if (!any) { emitToast("There's no data to back up yet.", "warning"); return; }
    XLSX.writeFile(wb, `allbee-backup-${todayISO()}.xlsx`);
  } catch (e) { console.error(e); emitToast("Couldn't build the Excel backup — check your connection and try again.", "error"); }
}
async function exportRowsToPDF(filename, title, subtitle, columns, rows) {
  try {
    const { jsPDF, autoTable } = await loadPdfEngine();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15); doc.text(pdfSafe(title), 40, 40);
    if (subtitle) { doc.setFontSize(10); doc.setTextColor(120); doc.text(pdfSafe(subtitle), 40, 58); doc.setTextColor(0); }
    autoTable(doc, {
      head: [columns.map((c) => c.label)],
      body: rows.map((r) => columns.map((c) => { const v = c.value(r); return v === "" || v == null ? "" : pdfSafe(String(v)); })),
      startY: 72, styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [16, 159, 142], textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 249] },
    });
    doc.save(filename);
  } catch (e) { console.error(e); emitToast("Couldn't build the PDF — check your connection and try again.", "error"); }
}

/* ── spreadsheet import (Excel / CSV / Google Sheets export) ────────────────
   Reads an .xlsx/.xls/.csv file with SheetJS (same CDN as export), auto-maps
   columns to fields by header name, and appends records to a chosen module.
   Google Sheets: File → Download → .xlsx or .csv, then upload here. */
async function loadXLSX() {
  const m = await import(/* @vite-ignore */ EXPORT_CDN.xlsx);
  return m.utils ? m : (m.default || m);
}
const impNorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
function impPick(row, labels) {
  const keys = Object.keys(row);
  for (const lab of labels) {
    const nl = impNorm(lab);
    const hit = keys.find((k) => impNorm(k) === nl);
    if (hit !== undefined && row[hit] !== "" && row[hit] != null) return row[hit];
  }
  return "";
}
const impNum = (v) => { const n = Number(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
const impClamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function impISO(v) {
  if (v === "" || v == null) return "";
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // assume day/month/year (India)
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  const t = Date.parse(s); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}
function impPay(v) { const s = String(v).toLowerCase(); if (s.includes("partial")) return "Partial"; if (s.includes("paid") && !s.includes("un")) return "Paid"; return "Unpaid"; }
function impStatus(v) { const s = impNorm(v); if (s.includes("complete") || s === "done") return "Completed"; if (s.includes("progress")) return "In Progress"; if (s.includes("accept")) return "Accepted"; return "Created"; }
function impPriority(v) { const s = String(v).toLowerCase(); if (s.includes("urgent")) return "Urgent"; if (s.includes("high")) return "High"; if (s.includes("low")) return "Low"; return "Medium"; }
function impUser(v) { const s = String(v).trim().toLowerCase(); return s.startsWith("a") ? "Alim" : "Haji"; }
function impMode(v) { const s = impNorm(v); if (s.includes("hybrid") || s.includes("both")) return "Hybrid"; if (s.includes("online")) return "Online"; return "Offline"; }

const buildTxn = (kind) => (row) => {
  const amount = impNum(impPick(row, ["amount", "value", "total", "price", "fee", kind]));
  if (!amount) return null;
  const hp = impPick(row, ["haji", "haji%", "hajipct", "hajipercent", "hajishare"]);
  const haji = hp === "" ? 50 : impClamp(impNum(hp), 0, 100);
  return {
    id: uid(), kind,
    client: String(impPick(row, ["client", "clientname", "customer"]) || "").trim(),
    project: String(impPick(row, ["project", "projectname", "source", "work", "description"]) || "").trim(),
    amount, date: impISO(impPick(row, ["date", "day"])) || todayISO(),
    category: String(impPick(row, ["category", "cat", "head"]) || (kind === "income" ? "Project" : "Other")).trim() || (kind === "income" ? "Project" : "Other"),
    hajiPct: haji, alimPct: 100 - haji,
    notes: String(impPick(row, ["notes", "note", "remark", "remarks", "details"]) || "").trim(),
    createdAt: Date.now(),
  };
};

const IMPORT_TARGETS = [
  { id: "income", label: "Accounts — income", table: "transactions", headers: ["Date", "Client", "Project", "Category", "Amount", "Haji %", "Alim %", "Notes"],
    example: { Date: "2025-04-12", Client: "Sun Textiles", Project: "Website redesign", Category: "Project", Amount: 50000, "Haji %": 50, "Alim %": 50, Notes: "Advance" }, build: buildTxn("income") },
  { id: "expense", label: "Accounts — expenses", table: "transactions", headers: ["Date", "Client", "Project", "Category", "Amount", "Haji %", "Alim %", "Notes"],
    example: { Date: "2025-04-12", Client: "", Project: "", Category: "Office Rent", Amount: 12000, "Haji %": 50, "Alim %": 50, Notes: "April rent" }, build: buildTxn("expense") },
  { id: "withdrawals", label: "Withdrawals", table: "withdrawals", headers: ["Date", "Partner", "Amount", "Notes"],
    example: { Date: "2025-04-20", Partner: "Haji", Amount: 10000, Notes: "Personal" },
    build: (row) => { const amount = impNum(impPick(row, ["amount", "value", "withdrawal"])); if (!amount) return null; return { id: uid(), user: impUser(impPick(row, ["partner", "user", "who", "name", "member"])), amount, date: impISO(impPick(row, ["date", "day"])) || todayISO(), notes: String(impPick(row, ["notes", "note", "remark", "reason"]) || "").trim(), createdAt: Date.now() }; } },
  { id: "projects", label: "Projects", table: "projects", headers: ["Name", "Client", "Type", "Cost", "Start date", "Expected completion", "Stage", "Notes"],
    example: { Name: "E-commerce site", Client: "Sun Textiles", Type: "Website", Cost: 80000, "Start date": "2025-03-01", "Expected completion": "2025-05-01", Stage: "Development", Notes: "" },
    build: (row) => { const name = String(impPick(row, ["name", "project", "projectname", "title"]) || "").trim(); if (!name) return null; return { id: uid(), name, client: String(impPick(row, ["client", "clientname", "customer"]) || "").trim(), type: String(impPick(row, ["type", "projecttype"]) || "Website").trim() || "Website", cost: impNum(impPick(row, ["cost", "amount", "price", "value", "budget"])), start: impISO(impPick(row, ["start", "startdate", "begin"])), expected: impISO(impPick(row, ["expected", "due", "deadline", "expectedcompletion", "enddate", "completion"])), stage: String(impPick(row, ["stage", "status", "phase"]) || "Lead").trim() || "Lead", notes: String(impPick(row, ["notes", "note", "remark", "remarks", "description"]) || "").trim(), createdAt: Date.now() }; } },
  { id: "students", label: "Courses / students", table: "students", headers: ["Name", "Phone", "Course", "Joining date", "Fee", "Payment status", "Notes"],
    example: { Name: "Asha R", Phone: "+91 90000 00000", Course: "Full-stack web dev", "Joining date": "2025-02-15", Fee: 25000, "Payment status": "Partial", Notes: "" },
    build: (row) => { const name = String(impPick(row, ["name", "student", "studentname"]) || "").trim(); if (!name) return null; return { id: uid(), name, phone: String(impPick(row, ["phone", "mobile", "contact", "number", "phoneno"]) || "").trim(), course: String(impPick(row, ["course", "coursename", "program", "batch"]) || "").trim(), joinDate: impISO(impPick(row, ["joindate", "joined", "joiningdate", "date", "enrolled"])), fee: impNum(impPick(row, ["fee", "amount", "cost", "fees"])), paymentStatus: impPay(impPick(row, ["paymentstatus", "status", "payment", "paid"])), notes: String(impPick(row, ["notes", "note", "remark"]) || "").trim(), createdAt: Date.now() }; } },
  { id: "marketing", label: "Marketing clients", table: "marketing", headers: ["Client", "Business", "Plan", "Monthly fee", "Start date", "Notes"],
    example: { Client: "GreenLeaf", Business: "GreenLeaf Cafe", Plan: "Social — Growth", "Monthly fee": 15000, "Start date": "2025-01-10", Notes: "" },
    build: (row) => { const client = String(impPick(row, ["client", "clientname", "customer", "name"]) || "").trim(); if (!client) return null; return { id: uid(), client, business: String(impPick(row, ["business", "businessname", "company"]) || "").trim(), plan: String(impPick(row, ["plan", "planname", "package", "service"]) || "").trim(), monthlyFee: impNum(impPick(row, ["monthlyfee", "fee", "amount", "monthly", "retainer", "price"])), startDate: impISO(impPick(row, ["startdate", "start", "since", "date"])), notes: String(impPick(row, ["notes", "note", "remark"]) || "").trim(), createdAt: Date.now() }; } },
  { id: "concepts", label: "Concepts / ideas", table: "concepts", headers: ["Title", "Notes", "Tags", "Date"],
    example: { Title: "Subscription billing tool", Notes: "Recurring invoices for retainer clients", Tags: "saas, future", Date: "2025-04-01" },
    build: (row) => { const title = String(impPick(row, ["title", "idea", "name", "concept"]) || "").trim(); if (!title) return null; return { id: uid(), title, notes: String(impPick(row, ["notes", "note", "details", "description"]) || "").trim(), tags: String(impPick(row, ["tags", "tag", "labels"]) || "").split(/[,;]/).map((t) => t.trim()).filter(Boolean), date: impISO(impPick(row, ["date", "day"])) || todayISO(), createdAt: Date.now() }; } },
  { id: "tasks", label: "Tasks", table: "tasks", headers: ["Title", "Description", "Assigned by", "Assigned to", "Due date", "Priority", "Status", "Progress"],
    example: { Title: "Design landing page", Description: "Full mockup + responsive", "Assigned by": "Haji", "Assigned to": "Alim", "Due date": "2025-05-10", Priority: "High", Status: "In Progress", Progress: 40 },
    build: (row, ctx) => { const title = String(impPick(row, ["title", "task", "taskname", "name"]) || "").trim(); if (!title) return null; const by = String(impPick(row, ["assignedby", "by", "creator", "from"]) || ctx.currentUser || "Haji").trim() || ctx.currentUser; const toRaw = String(impPick(row, ["assignedto", "to", "assignee", "owner", "for"]) || "").trim(); const tl = toRaw.toLowerCase(); const assignedTo = (tl.includes("&") || tl.includes("both") || tl.includes("haji and alim")) ? COMBINED : tl.startsWith("h") ? "Haji" : tl.startsWith("a") ? "Alim" : (toRaw || ctx.currentUser); const status = impStatus(impPick(row, ["status", "stage"])); const progress = impClamp(impNum(impPick(row, ["progress", "percent", "percentage", "done"])), 0, 100); return { id: uid(), title, desc: String(impPick(row, ["desc", "description", "details", "notes"]) || "").trim(), assignedBy: by, assignedTo, due: impISO(impPick(row, ["due", "duedate", "deadline", "date"])), priority: impPriority(impPick(row, ["priority", "importance"])), status, progress: status === "Completed" ? 100 : progress, history: [{ status: "Created", at: Date.now(), by }], comments: [], attachments: [], createdAt: Date.now() }; } },
  { id: "class_students", label: "Class students", table: "class_students", headers: ["Name", "Phone", "Email", "Course", "Mode", "Batch", "Joining date", "Fee", "Paid", "Payment status", "Notes"],
    example: { Name: "Karthik S", Phone: "+91 90000 00000", Email: "karthik@email.com", Course: "Tally", Mode: "Offline", Batch: "Morning 10–11", "Joining date": "2025-06-01", Fee: 8000, Paid: 4000, "Payment status": "Partial", Notes: "" },
    build: (row) => {
      const name = String(impPick(row, ["name", "student", "studentname", "fullname"]) || "").trim();
      if (!name) return null;
      return {
        id: (String(impPick(row, ["id", "studentid"]) || "").trim() || uid()),
        name,
        phone: String(impPick(row, ["phone", "mobile", "contact", "number", "phoneno", "whatsapp"]) || "").trim(),
        email: String(impPick(row, ["email", "mail", "emailid"]) || "").trim(),
        course: String(impPick(row, ["course", "coursename", "program", "subject", "training", "batchcourse"]) || "").trim(),
        mode: impMode(impPick(row, ["mode", "classmode", "onlineoffline", "type", "medium"])),
        batch: String(impPick(row, ["batch", "timing", "time", "slot", "schedule", "session"]) || "").trim(),
        joinDate: impISO(impPick(row, ["joindate", "joined", "joiningdate", "date", "enrolled", "admissiondate", "startdate"])),
        fee: impNum(impPick(row, ["fee", "fees", "amount", "cost", "totalfee", "coursefee"])),
        paid: impNum(impPick(row, ["paid", "paidamount", "amountpaid", "received", "feepaid"])),
        paymentStatus: impPay(impPick(row, ["paymentstatus", "status", "payment", "feestatus"])),
        notes: String(impPick(row, ["notes", "note", "remark", "remarks", "details"]) || "").trim(),
        createdAt: Date.now(),
      };
    } },
];

function ImportData({ mutate, currentUser, onClose, defaultTarget = "income", lockTarget = false }) {
  const [targetId, setTargetId] = useState(IMPORT_TARGETS.some((t) => t.id === defaultTarget) ? defaultTarget : "income");
  const [rows, setRows] = useState(null);   // raw parsed objects
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(0);
  const fileRef = useRef(null);
  const target = IMPORT_TARGETS.find((t) => t.id === targetId);
  const ctx = { currentUser };

  const built = useMemo(() => (rows ? rows.map((r) => target.build(r, ctx)).filter(Boolean) : []), [rows, targetId]); // eslint-disable-line
  const previewKeys = built.length ? Object.keys(built[0]).filter((k) => !["id", "createdAt", "history", "comments", "attachments"].includes(k)) : [];

  const pickFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setErr(""); setDone(0); setRows(null); setBusy(true); setFileName(file.name);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      if (!parsed.length) setErr("That sheet looks empty. Make sure the first row is a header row.");
      setRows(parsed);
    } catch (e2) { console.error(e2); setErr("Couldn't read that file. Use .xlsx, .xls or .csv (Google Sheets → File → Download)."); }
    finally { setBusy(false); }
  };

  const downloadTemplate = async () => {
    await exportRowsToExcel(`allbee-${target.id}-template.xlsx`, target.label, target.headers.map((h) => ({ label: h, w: 16, value: (r) => r[h] ?? "" })), [target.example]);
  };

  const doImport = () => {
    if (!built.length) return;
    const recs = built;
    mutate((d) => ({ ...d, [target.table]: [...d[target.table], ...recs] }), { action: `imported ${recs.length} record${recs.length === 1 ? "" : "s"} into ${target.label}`, module: "Settings" });
    setDone(recs.length); setRows(null); setFileName("");
  };

  return (
    <Modal title="Import from Excel / Google Sheets" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={doImport} disabled={!built.length}><Upload size={16} />{built.length ? `Import ${built.length} record${built.length === 1 ? "" : "s"}` : "Import"}</button></>}>
      {done > 0 && <div className="calc-box" style={{ borderColor: "var(--pos)", marginBottom: 14 }}><div className="calc-row" style={{ color: "var(--pos)", fontWeight: 700 }}><Check size={15} /> Imported {done} record{done === 1 ? "" : "s"} into {target.label}.</div></div>}

      {!lockTarget && (
        <Field label="What are you importing?">
          <select className="select" value={targetId} onChange={(e) => { setTargetId(e.target.value); setRows(null); setDone(0); setErr(""); }}>
            {IMPORT_TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
      )}

      <div className="hint-line" style={{ lineHeight: 1.55, margin: "2px 0 12px" }}>
        Your sheet's first row should be column headers. Expected columns:{" "}
        <b>{target.headers.join(", ")}</b>. Column order doesn't matter and extra columns are ignored.{" "}
        <button className="ttl-link" style={{ fontSize: 12.5, fontWeight: 600 }} onClick={downloadTemplate}><Download size={12} style={{ verticalAlign: -2 }} /> Download a template</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><Sheet size={16} />{busy ? "Reading…" : "Choose .xlsx / .csv file"}</button>
        {fileName && <span className="hint-line">{fileName}</span>}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} style={{ display: "none" }} />
      </div>

      {err && <div className="hint-line" style={{ color: "var(--neg)", display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}><AlertTriangle size={13} />{err}</div>}

      {rows && built.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="hint-line" style={{ marginBottom: 8 }}>Found <b>{rows.length}</b> row{rows.length === 1 ? "" : "s"}; <b>{built.length}</b> ready to import{rows.length !== built.length ? ` (${rows.length - built.length} skipped — missing a required value)` : ""}. Preview:</div>
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table className="tbl" style={{ fontSize: 12.5 }}>
              <thead><tr>{previewKeys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody>{built.slice(0, 6).map((r, i) => (
                <tr key={i}>{previewKeys.map((k) => <td key={k} className={typeof r[k] === "number" ? "mono" : ""}>{Array.isArray(r[k]) ? r[k].join(", ") : String(r[k] ?? "")}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          {built.length > 6 && <div className="hint-line" style={{ marginTop: 6 }}>…and {built.length - 6} more.</div>}
        </div>
      )}
      {rows && built.length === 0 && !err && <div className="hint-line" style={{ color: "var(--neg)", marginTop: 10 }}>No importable rows found — check that your headers match and required values (like an amount or a name) are filled in.</div>}
    </Modal>
  );
}

function AccountFull({ db, user, goBack }) {
  const all = useMemo(() => ledgerFor(db, user), [db, user]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [client, setClient] = useState("all");
  const [project, setProject] = useState("all");
  const [category, setCategory] = useState("all");

  const clients = useMemo(() => Array.from(new Set(all.map((r) => r.client).filter((c) => c && c !== "—"))).sort(), [all]);
  const projects = useMemo(() => Array.from(new Set(all.map((r) => r.project).filter(Boolean))).sort(), [all]);
  const categories = useMemo(() => Array.from(new Set(all.map((r) => r.category).filter(Boolean))).sort(), [all]);

  const rows = useMemo(() => all.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (client !== "all" && r.client !== client) return false;
    if (project !== "all" && r.project !== project) return false;
    if (category !== "all" && r.category !== category) return false;
    return true;
  }), [all, from, to, client, project, category]);

  const filtered = from || to || client !== "all" || project !== "all" || category !== "all";
  const currentBalance = all.length ? all[all.length - 1].running : 0;
  const totIncome = round2(rows.filter((r) => r.type === "Income").reduce((s, r) => s + r.credited, 0));
  const totExpense = round2(rows.filter((r) => r.type === "Expense").reduce((s, r) => s + r.debited, 0));
  const totWithdraw = round2(rows.filter((r) => r.type === "Withdrawal").reduce((s, r) => s + r.debited, 0));
  const net = round2(totIncome - totExpense - totWithdraw);

  const columns = [
    { label: "Date", w: 12, value: (r) => fmtDate(r.date) },
    { label: "Client", w: 18, value: (r) => r.client },
    { label: "Project", w: 22, value: (r) => r.project },
    { label: "Category", w: 14, value: (r) => r.category },
    { label: "Income (₹)", w: 12, value: (r) => (r.income != null ? round2(r.income) : "") },
    { label: "Expense (₹)", w: 12, value: (r) => (r.expense != null ? round2(r.expense) : "") },
    { label: "Share %", w: 9, value: (r) => r.pct },
    { label: "Credited (₹)", w: 12, value: (r) => (r.credited ? round2(r.credited) : "") },
    { label: "Debited (₹)", w: 12, value: (r) => (r.debited ? round2(r.debited) : "") },
    { label: "Running balance (₹)", w: 14, value: (r) => round2(r.running) },
    { label: "Notes", w: 26, value: (r) => r.notes || "" },
  ];
  const sub = `${user} · generated ${fmtDate(todayISO())}${filtered ? " · filtered view" : ""}`;
  const doExcel = () => exportRowsToExcel(`allbee-${user.toLowerCase()}-account-${todayISO()}.xlsx`, `${user} account`, columns, rows);
  const doPDF = () => exportRowsToPDF(`allbee-${user.toLowerCase()}-account-${todayISO()}.pdf`, `ALLBEE — ${user} account statement`, sub, columns, rows);
  const clear = () => { setFrom(""); setTo(""); setClient("all"); setProject("all"); setCategory("all"); };

  const SUMMARY = [
    ["Current balance", currentBalance, <Wallet size={13} />, true],
    ["Total income", totIncome, <ArrowRight size={13} />, false],
    ["Total expenses", totExpense, <ArrowRight size={13} />, false],
    ["Total withdrawals", totWithdraw, <ArrowDownToLine size={13} />, false],
    ["Net balance", net, <TrendingUp size={13} />, true],
  ];

  return (
    <div className="content">
      <button className="backlink" onClick={goBack}><ArrowLeft size={15} />Back to Share &amp; accounts</button>
      <div className="detail-head">
        <span className="avatar" style={{ background: avatarColor(user), width: 40, height: 40, fontSize: 17 }}>{user[0]}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3>{user} — account statement</h3>
          <div className="topbar-sub">Full balance breakdown for {user}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={doExcel}><Sheet size={15} />Export Excel</button>
          <button className="btn" onClick={doPDF}><FileText size={15} />Export PDF</button>
        </div>
      </div>

      <div className="sumrow">
        {SUMMARY.map(([k, v, ic, strong]) => (
          <div key={k} className="card">
            <div className="k">{ic} {k}</div>
            <div className="v mono" style={{ color: strong ? (v < 0 ? "var(--neg)" : "var(--ink)") : (k === "Total income" ? "var(--pos)" : k === "Current balance" || k === "Net balance" ? undefined : "var(--neg)") }}>{money(v)}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="lbl" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}><Filter size={14} /> Filters</div>
        <div className="filterbar">
          <Field label="From date"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To date"><input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="field"><label>Client</label><SearchableSelect value={client} onChange={setClient} ariaLabel="Filter by client" options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c, label: c }))]} /></div>
          <div className="field"><label>Project</label><SearchableSelect value={project} onChange={setProject} ariaLabel="Filter by project" options={[{ value: "all", label: "All projects" }, ...projects.map((p) => ({ value: p, label: p }))]} /></div>
          <Field label="Category"><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <span className="hint-line">{rows.length} of {all.length} entries{filtered ? " · totals above reflect these filters" : ""}</span>
          {filtered && <button className="btn sm ghost" onClick={clear}><X size={13} />Clear filters</button>}
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <Empty icon={<Wallet size={22} color="var(--muted)" />} title={all.length ? "No entries match these filters" : "No movements yet"}
            text={all.length ? "Try widening the date range or clearing a filter." : "Income, expenses and withdrawals for this partner will appear here."}
            action={filtered ? <button className="btn" onClick={clear}>Clear filters</button> : undefined} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr>
                <th>Date</th><th>Client</th><th>Project</th><th>Category</th>
                <th className="num-cell">Income</th><th className="num-cell">Expense</th><th>Share %</th>
                <th className="num-cell">Credited</th><th className="num-cell">Debited</th><th className="num-cell">Running</th><th>Notes</th>
              </tr></thead>
              <tbody>
                {[...rows].reverse().map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td>{r.client}</td>
                    <td style={{ fontWeight: 600 }}>{r.project}</td>
                    <td><span className="tag">{r.category}</span></td>
                    <td className="num-cell mono pos-txt">{r.income != null ? money(r.income) : "—"}</td>
                    <td className="num-cell mono neg-txt">{r.expense != null ? money(r.expense) : "—"}</td>
                    <td className="mono">{r.pct}%</td>
                    <td className="num-cell mono pos-txt">{r.credited ? money(r.credited) : "—"}</td>
                    <td className="num-cell mono neg-txt">{r.debited ? money(r.debited) : "—"}</td>
                    <td className="num-cell mono" style={{ fontWeight: 700, color: r.running < 0 ? "var(--neg)" : "var(--ink)" }}>{money(r.running)}</td>
                    <td style={{ color: "var(--muted)", fontSize: 13, maxWidth: 220 }}>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Accounts({ db, bal, mutate, openModal, openBalance, removeItem, locks = [], lockPeriod, unlockPeriod, isSuper, currentUser }) {
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const thisPeriod = todayISO().slice(0, 7);
  const lockedThis = locks.includes(thisPeriod);
  const doLock = async (p, on) => { try { on ? await lockPeriod(p, currentUser) : await unlockPeriod(p); emitToast(on ? "Period locked." : "Period unlocked.", "success"); } catch (e) { emitToast(e.message || "Couldn't update the lock.", "error"); } };
  const list = useMemo(() => {
    let r = [...db.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    if (view !== "all") r = r.filter((t) => t.kind === view);
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((t) => [t.client, t.project, t.category, t.notes].join(" ").toLowerCase().includes(s)); }
    return r;
  }, [db.transactions, view, q]);

  const del = async (t) => {
    // APN income is a cross-module financial posting. Revoke the APN project
    // first so the partner wallet/project/collections are reversed before the
    // finance rows are soft-deleted into the recycle bin.
    if (t.kind === "income" && t.incomeSource === "apn" && t.apnProjectId) {
      try {
        const { error } = await supabase.rpc("apn_finalize_finance_income_revoke", {
          p_transaction_id: t.id,
          p_reason: `Finance income entry deleted by ${currentUser || "Finance"}.`,
        });
        if (error) throw new Error(error.message);
        emitToast("APN income revoked and commission reversed.", "success");
      } catch (e) {
        emitToast(e.message || "Could not revoke the APN income entry.", "error");
        return;
      }
    }
    removeItem("transactions", t, {
      name: `${t.kind === "income" ? "Income" : "Expense"} ${money(t.amount)}${t.client ? " · " + t.client : ""}`,
      cascadeRows: t.kind === "income" && t.apnProjectId ? (db.transactions || []).filter((x) => x.id !== t.id && (x.apnCommissionOfIncome === t.id || x.id === "apn-expense:" + t.id)) : [],
      cascadeLabel: "APN commission expense",
      audit: `deleted a ${t.kind} of ${money(t.amount)}${(db.transactions || []).some((x) => x.id !== t.id && (x.apnCommissionOfIncome === t.id || x.id === "apn-expense:" + t.id)) ? " and its APN commission expense" : ""}`,
    });
  };

  return (
    <div className="content">
      <div className="page-head"><h3>Share & accounts</h3><span className="spacer" />
        <button className="btn" onClick={() => openModal({ type: "expense" })}><Plus size={16} />Add expense</button>
        <button className="btn primary" onClick={() => openModal({ type: "income" })}><Plus size={16} />Add income</button>
      </div>

      {lockedThis && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><LockIcon size={15} /> {fmtPeriod(thisPeriod)} is locked — income, expenses and withdrawals dated this month are frozen{isSuper ? "." : " until a partner unlocks it."}</div>}

      {isSuper && (
        <div className="card stat" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <LockIcon size={16} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700 }}>Financial locking</div>
              <div className="hint-line" style={{ fontSize: 12 }}>Lock a closed month to freeze its books. Only partners can lock or unlock.</div>
            </div>
            <button className={"btn sm " + (lockedThis ? "" : "primary")} onClick={() => doLock(thisPeriod, !lockedThis)}>
              {lockedThis ? <><UnlockIcon size={13} />Unlock {fmtPeriod(thisPeriod)}</> : <><LockIcon size={13} />Lock {fmtPeriod(thisPeriod)}</>}
            </button>
          </div>
          {locks.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {locks.map((p) => <span key={p} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LockIcon size={11} />{fmtPeriod(p)}<button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => doLock(p, false)} title="Unlock"><X size={11} /></button></span>)}
          </div>}
        </div>
      )}

      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="card balance-card" onClick={() => openBalance("Haji")}><div className="stripe" style={{ background: "var(--haji)" }} />
          <div className="who"><span className="dot" style={{ background: "var(--haji)" }} /> Haji</div>
          <div className="amt mono" style={{ fontSize: 24, color: bal.Haji < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.Haji)}</div>
          <div className="hint">Breakdown <ChevronRight size={13} /></div></div>
        <div className="card balance-card" onClick={() => openBalance("Alim")}><div className="stripe" style={{ background: "var(--alim)" }} />
          <div className="who"><span className="dot" style={{ background: "var(--alim)" }} /> Alim</div>
          <div className="amt mono" style={{ fontSize: 24, color: bal.Alim < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.Alim)}</div>
          <div className="hint">Breakdown <ChevronRight size={13} /></div></div>
        <div className="card stat"><div className="lbl"><Wallet size={14} /> Company</div>
          <div className="num mono" style={{ color: bal.company < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.company)}</div>
          <div className="sub">{db.transactions.length} entries recorded</div></div>
      </div>

      <ExpenseSharePanel db={db} />

      <div className="toolbar">
        <div className="search"><Search size={16} color="var(--muted)" /><input placeholder="Search client, project, notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg">{[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Wallet size={22} color="var(--muted)" />} title="No entries yet" text="Record your first income or expense to start tracking the partner split."
            action={<button className="btn primary" onClick={() => openModal({ type: "income" })}><Plus size={16} />Add income</button>} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Client / project</th><th>Category</th><th className="num-cell">Amount</th><th>Split</th><th></th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                    <td><div style={{ fontWeight: 600 }}>{t.project || t.client || "—"}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{t.client || ""}</div></td>
                    <td><span className={"badge " + (t.kind === "income" ? "pos" : "neg")}>{t.kind === "income" ? "Income" : "Expense"}</span> <span className="tag">{t.category}</span>{t.kind === "expense" && expenseScope(t) === "company" && <span className="tag" style={{ marginLeft: 4 }}>Shared</span>}</td>
                    <td className={"num-cell mono " + (t.kind === "income" ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(t.kind === "income" ? t.amount : -t.amount, { sign: t.kind === "income" })}</td>
                    <td style={{ minWidth: 130 }}><SplitBar h={t.hajiPct} a={t.alimPct} legend={false} /><div className="split-legend"><span>H {t.hajiPct}%</span><span>A {t.alimPct}%</span></div></td>
                    <td><div className="row-actions">
                      <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: t.kind, initial: t })}><Pencil size={14} /></button>
                      <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete entry?", body: `Remove this ${t.kind} of ${money(t.amount)}? Balances will recalculate.`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(t) })}><Trash2 size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Withdrawals({ db, bal, mutate, openModal, removeItem, isSuper, currentUser }) {
  const list = [...db.withdrawals].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const del = (w) => removeItem("withdrawals", w, { name: `Withdrawal ${money(w.amount)} · ${w.user}`, audit: `deleted a withdrawal of ${money(w.amount)}` });
  const statusOf = (w) => w.status || "approved"; // legacy rows (no status) already moved money
  const tone = (s) => s === "approved" ? "pos" : s === "rejected" ? "neg" : "pri";
  const setStatus = (w, s) => { haptic(s === "approved" ? 12 : [10, 30, 10]); mutate((d) => ({ ...d, withdrawals: d.withdrawals.map((x) => x.id === w.id ? { ...x, status: s, approvedBy: currentUser, approvedAt: Date.now() } : x) }),
    { action: `${s === "approved" ? "approved" : "rejected"} withdrawal of ${money(w.amount)} for ${w.user}`, module: "Withdrawals" }); };
  const pending = list.filter((w) => statusOf(w) === "pending").length;
  return (
    <div className="content">
      <div className="page-head"><h3>Withdrawals</h3><span className="spacer" />
        <button className="btn primary" onClick={() => openModal({ type: "withdraw" })}><Plus size={16} />Record withdrawal</button></div>

      {pending > 0 && <div className="banner" style={{ marginLeft: 0, marginRight: 0 }}><Hourglass size={15} /> {pending} withdrawal{pending > 1 ? "s" : ""} awaiting a partner's approval. Only approved withdrawals affect the balances.</div>}

      <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: "16px 0" }}>
        {USERS.map((u) => (
          <div key={u} className="card stat"><div className="lbl"><span className="dot" style={{ background: avatarColor(u) }} /> {u} available</div>
            <div className="num mono" style={{ color: bal[u] < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal[u])}</div>
            {bal[u] < 0 && <div className="sub neg-txt">Negative — to be settled by future profit share</div>}</div>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ArrowDownToLine size={22} color="var(--muted)" />} title="No withdrawals yet" text="A partner can withdraw up to their current balance. Each withdrawal needs a partner's approval before it moves money." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Partner</th><th className="num-cell">Amount</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>{list.map((w) => {
                const st = statusOf(w);
                return (
                <tr key={w.id} style={st === "rejected" ? { opacity: 0.55 } : undefined}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(w.date)}</td>
                  <td><span className="badge" style={{ background: "var(--surface-2)" }}><span className="dot" style={{ background: avatarColor(w.user), display: "inline-block", marginRight: 5 }} />{w.user}</span></td>
                  <td className="num-cell mono neg-txt" style={{ fontWeight: 700 }}>{money(-w.amount)}</td>
                  <td><span className={"badge " + tone(st)} style={{ textTransform: "capitalize" }}>{st}</span></td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{w.notes || "—"}</td>
                  <td><div className="row-actions">
                    {isSuper && st !== "approved" && <button className="btn sm primary" onClick={() => setStatus(w, "approved")} title="Approve"><Check size={13} /></button>}
                    {isSuper && st !== "rejected" && <button className="btn sm danger" onClick={() => setStatus(w, "rejected")} title="Reject"><X size={13} /></button>}
                    <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete withdrawal?", body: `Remove this ${money(w.amount)} withdrawal for ${w.user}?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(w) })}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function priorityTone(p) { return p === "Urgent" || p === "High" ? "neg" : p === "Medium" ? "pri" : ""; }

function Progress({ db, mutate, isAdmin = true, currentUser, me, openTask }) {
  const who = me || { name: currentUser };
  const inProgress = db.tasks.filter((t) => t.status === "In Progress");
  // Admins monitor the whole team; staff/interns see the in-progress tasks
  // they're assigned to (so they can update their own progress).
  const list = isAdmin ? inProgress : inProgress.filter((t) => isTaskAssignee(t, who));
  const setProgress = (t, v) => {
    const done = v >= 100;
    const history = done ? [...(t.history || []), { status: "Completed", at: Date.now(), by: currentUser }] : (t.history || []);
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, progress: v, status: done ? "Completed" : "In Progress", history } : x) }), done ? { action: `completed "${t.title}"`, module: "Progress" } : null);
  };
  return (
    <div className="content">
      <div className="page-head"><h3>Progress</h3></div>
      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<TrendingUp size={22} color="var(--muted)" />} title="No tasks in progress" text="Accepted tasks you start working on show up here with a completion slider. Finished tasks move to Completed automatically." />
        ) : list.map((t) => {
          const canAct = canActOnTask(t, currentUser);
          return (
            <div key={t.id} className="item-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="item-main">
                  {openTask ? <button className="ttl-link" onClick={() => openTask(t.id)}>{t.title}</button> : <div className="item-title">{t.title}</div>}
                  <div className="item-meta"><span style={{ color: isMultiAssignee(t) ? "var(--ink)" : avatarColor(taskAssignees(t)[0]) }}>{assigneeText(t)}</span>{t.due && <span>Due {fmtDate(t.due)}</span>}<span className={"badge " + priorityTone(t.priority)}>{t.priority}</span></div></div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 18 }}>{t.progress || 0}%</div>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${t.progress || 0}%` }} /></div>
              {canAct
                ? <input type="range" min="0" max="100" step="5" value={t.progress || 0} onChange={(e) => setProgress(t, Number(e.target.value))} style={{ accentColor: "var(--primary)" }} />
                : <div className="hint-line" style={{ display: "flex", alignItems: "center", gap: 5 }}><ShieldCheck size={12} />Monitoring {assigneeText(t)} — only they can update progress</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetail({ db, taskId, me, isAdmin, currentUser, mutate, openModal, removeItem, goBack }) {
  const t = db.tasks.find((x) => x.id === taskId);
  const [comment, setComment] = useState("");
  const [atLabel, setAtLabel] = useState("");
  const [atUrl, setAtUrl] = useState("");

  if (!t) {
    return (
      <div className="content">
        <button className="backlink" onClick={goBack}><ArrowLeft size={15} />Back to tasks</button>
        <div className="card"><Empty icon={<ListTodo size={22} color="var(--muted)" />} title="Task not found" text="This task may have been deleted. Check Recently deleted to restore it." /></div>
      </div>
    );
  }

  const canAct = canActOnTask(t, currentUser);
  const canEdit = canEditTask(t, currentUser, isAdmin);
  const canCollaborate = canAct || canEdit;
  const auditFor = (action) => ({ action, module: "Tasks" });

  const advance = () => {
    const patch = nextTaskState(t, currentUser);
    const note = patch.status ? `moved "${t.title}" to ${patch.status}` : `accepted "${t.title}"`;
    haptic(patch.status === "Completed" ? [10, 40, 10] : 12);
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, ...patch } : x) }), auditFor(note));
  };
  const undo = () => {
    const history = [...(t.history || []), { status: "In Progress", at: Date.now(), by: currentUser }];
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, status: "In Progress", progress: Math.min(t.progress ?? 90, 90), history } : x) }),
      auditFor(`restored task "${t.title}" from Completed to In Progress`));
  };
  const addComment = () => {
    const text = comment.trim(); if (!text) return;
    const c = { id: uid(), by: currentUser, text, at: Date.now() };
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, comments: [...(x.comments || []), c] } : x) }), null);
    setComment("");
  };
  const addAttachment = () => {
    const url = atUrl.trim(); if (!url) return;
    const a = { id: uid(), label: atLabel.trim() || url, url, by: currentUser, at: Date.now() };
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, attachments: [...(x.attachments || []), a] } : x) }), null);
    setAtLabel(""); setAtUrl("");
  };
  const removeAttachment = (id) => mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, attachments: (x.attachments || []).filter((a) => a.id !== id) } : x) }), null);
  const askDelete = () => openModal({
    type: "deleteConfirm", title: "Delete task?", body: `This moves "${t.title}" to Recently deleted.`, note: "You can restore it within 60 days.",
    onConfirm: () => { removeItem("tasks", t, { name: t.title, audit: `deleted task "${t.title}"` }); goBack(); },
  });

  const timeline = taskTimeline(t);
  const act = canAct ? taskAction(t, currentUser) : null;
  const lbl = { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 12 };
  const colorFor = (n) => (n === COMBINED ? "var(--ink)" : avatarColor(n));
  const META = [
    ["Assigned by", <span style={{ color: colorFor(t.assignedBy), fontWeight: 600 }}>{t.assignedBy}</span>],
    ["Assigned to", <span style={{ color: isMultiAssignee(t) ? "var(--ink)" : colorFor(taskAssignees(t)[0]), fontWeight: 600 }}>{assigneeText(t)}</span>],
    ["Due date", t.due ? fmtDate(t.due) : "—"],
    ["Priority", t.priority || "—"],
    ["Status", t.status],
    ["Created", t.createdAt ? fmtTime(t.createdAt) : "—"],
  ];

  return (
    <div className="content">
      <button className="backlink" onClick={goBack}><ArrowLeft size={15} />Back to tasks</button>
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 220 }}>
          {t.num != null && <div className="hint-line mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".5px" }}>TASK #{t.num}</div>}
          <h3>{t.title}</h3>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className={"badge " + (t.status === "Completed" ? "pos" : t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
            {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {act && <button className="btn primary" disabled={act.disabled} onClick={() => { if (!act.disabled) advance(); }}>{act.label}<ArrowRight size={14} /></button>}
          {t.status === "Completed" && canCollaborate && <button className="btn" onClick={undo}><Undo2 size={15} />Undo</button>}
          {canEdit && <button className="btn" onClick={() => openModal({ type: "task", initial: t })}><Pencil size={14} />Edit</button>}
          {canEdit && <button className="btn danger" onClick={askDelete}><Trash2 size={14} />Delete</button>}
        </div>
      </div>

      {!canAct && t.status !== "Completed" && (
        <div className="hint-line" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldCheck size={12} />{isAdmin ? "You can monitor and edit this task, but " : ""}only {isMultiAssignee(t) ? "the assignees" : assigneeText(t)} can accept, start or complete it.
        </div>
      )}

      <div className="meta-grid">
        {META.map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={lbl}><FileText size={14} /> Description</div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.desc ? t.desc : <span className="hint-line">No description provided.</span>}</div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={lbl}><Activity size={14} /> Activity timeline</div>
        <div className="timeline">
          {timeline.map((ev, i) => (
            <div key={i} className="tl-item">
              <span className="tl-dot" />
              <div className="what">{ev.status}{ev.by ? <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {ev.by}</span> : null}</div>
              <div className="when">{ev.at ? fmtTime(ev.at) : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={lbl}><Paperclip size={14} /> Attachments</div>
        {(t.attachments || []).length > 0 && (
          <div className="attach-list" style={{ marginBottom: canCollaborate ? 12 : 0 }}>
            {t.attachments.map((a) => (
              <div key={a.id} className="attach">
                <Link2 size={15} color="var(--muted)" />
                <a href={a.url} target="_blank" rel="noreferrer">{a.label}</a>
                <span style={{ flex: 1 }} />
                <a href={a.url} target="_blank" rel="noreferrer" className="iconbtn" style={{ width: 28, height: 28 }} title="Open"><ExternalLink size={13} /></a>
                {canCollaborate && <button className="iconbtn" style={{ width: 28, height: 28 }} title="Remove" onClick={() => removeAttachment(a.id)}><X size={13} /></button>}
              </div>
            ))}
          </div>
        )}
        {(t.attachments || []).length === 0 && <div className="hint-line" style={{ marginBottom: canCollaborate ? 12 : 0 }}>No attachments yet.</div>}
        {canCollaborate && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 8 }}>
              <input className="input" placeholder="Label (optional)" value={atLabel} onChange={(e) => setAtLabel(e.target.value)} />
              <input className="input" placeholder="https://link-to-file" value={atUrl} onChange={(e) => setAtUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAttachment()} />
              <button className="btn" onClick={addAttachment}><Plus size={15} />Add link</button>
            </div>
            <div className="hint-line" style={{ marginTop: 10 }}>Attach links to files (Drive, Dropbox, etc). Direct uploads can be enabled with Supabase Storage — see README.</div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16, marginBottom: 8 }}>
        <div style={lbl}><MessageSquare size={14} /> Comments</div>
        {(t.comments || []).length === 0 && <div className="hint-line">No comments yet.</div>}
        {(t.comments || []).map((c) => (
          <div key={c.id} className="comment">
            <div className="avatar" style={{ background: avatarColor(c.by), width: 30, height: 30, fontSize: 12 }}>{(c.by || "?")[0]}</div>
            <div className="body">
              <div className="who">{c.by}</div>
              <div className="txt">{c.text}</div>
              <div className="when">{fmtTime(c.at)}</div>
            </div>
          </div>
        ))}
        {canCollaborate && (
          <div className="composer">
            <textarea className="textarea" placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn primary" onClick={addComment} disabled={!comment.trim()}><Send size={15} />Post</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentlyDeleted({ db, openModal, restoreItem }) {
  const [open, setOpen] = useState({});
  const list = useMemo(() => [...(db.recycle || [])].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), [db.recycle]);
  const daysLeft = (r) => Math.max(0, RECYCLE_TTL_DAYS - Math.floor((Date.now() - (r.deletedAt || 0)) / 86400000));
  const askRestore = (r) => openModal({
    type: "restoreConfirm", title: "Restore item?",
    body: `Restore ${r.module.toLowerCase()} "${r.name}" to its original module?`, note: "It will reappear where it was before.",
    onConfirm: () => restoreItem(r),
  });
  // Turn a stored field name into a readable label ("assignedTo" → "Assigned To").
  const humanizeKey = (k) => k.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  // Every meaningful field of the deleted record, formatted for display. Arrays
  // are joined, timestamps are made readable, booleans become Yes/No. Only the
  // internal id is hidden.
  const detailsOf = (r) => {
    const it = r.item || {};
    const skip = new Set(["id"]);
    const out = [];
    for (const [k, v] of Object.entries(it)) {
      if (skip.has(k) || v === "" || v == null) continue;
      let text;
      if (Array.isArray(v)) {
        if (!v.length) continue;
        text = v.map((x) => (x && typeof x === "object" ? (x.title || x.name || x.status || x.text || JSON.stringify(x)) : String(x))).join(", ");
      } else if (typeof v === "boolean") {
        text = v ? "Yes" : "No";
      } else if (typeof v === "object") {
        text = JSON.stringify(v);
      } else if (typeof v === "number" && v > 1e12 && /(at|At|ts)$/.test(k)) {
        text = fmtTime(v); // millisecond timestamp
      } else {
        text = String(v);
      }
      out.push([humanizeKey(k), text]);
    }
    return out;
  };

  return (
    <div className="content">
      <div className="page-head"><h3>Recently deleted</h3></div>
      <div className="hint-line" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <AlertTriangle size={13} /> Deleted items are kept here for {RECYCLE_TTL_DAYS} days, then removed automatically. There is no permanent-delete option.
      </div>
      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Trash2 size={22} color="var(--muted)" />} title="Nothing deleted" text="When you delete a task, project, entry or any other record, it lands here first so you can restore it." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Item</th><th>Module</th><th>Deleted by</th><th>Deleted</th><th>Auto-removes in</th><th></th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const left = daysLeft(r);
                  const rows = detailsOf(r);
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td><div style={{ fontWeight: 600 }}>{r.name}</div>
                          {rows.length > 0 && <button className="ttl-link" style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>{open[r.id] ? "Hide" : "View"} original details</button>}
                        </td>
                        <td><span className="tag">{r.module}</span></td>
                        <td><span className="badge"><span className="dot" style={{ background: avatarColor(r.deletedBy), display: "inline-block", marginRight: 5 }} />{r.deletedBy}</span></td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtTime(r.deletedAt)}</td>
                        <td><span className={"ttl-pill " + (left <= 7 ? "ttl-soon" : "ttl-ok")}>{left} {left === 1 ? "day" : "days"}</span></td>
                        <td><button className="btn sm primary" onClick={() => askRestore(r)}><RotateCcw size={13} />Restore</button></td>
                      </tr>
                      {open[r.id] && rows.length > 0 && (
                        <tr><td colSpan={6} style={{ background: "var(--surface-2)" }}>
                          <div className="detail-json">
                            {rows.map(([k, v]) => <div key={k}><span className="k">{k}:</span> {v}</div>)}
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClassStudents({ db, openModal, removeItem, mutate, currentUser, config, saveClassWebhook, isSuper }) {
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("all");
  const [mode, setMode] = useState("all");
  const [pay, setPay] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  const all = useMemo(() => [...(db.class_students || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [db.class_students]);
  const courseOptions = useMemo(() => Array.from(new Set(all.map((s) => s.course).filter(Boolean))).sort(), [all]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => {
      if (course !== "all" && (s.course || "") !== course) return false;
      if (mode !== "all" && (s.mode || "Offline") !== mode) return false;
      if (pay !== "all" && (s.paymentStatus || "Unpaid") !== pay) return false;
      if (needle && !`${s.name} ${s.phone} ${s.email} ${s.course} ${s.batch}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, q, course, mode, pay]);

  const del = (s) => removeItem("class_students", s, { name: s.name, audit: `removed class student ${s.name}` });
  const modeTone = (m) => (m === "Online" ? "pri" : m === "Hybrid" ? "accent" : "");
  const payTone = (p) => (p === "Paid" ? "pos" : p === "Partial" ? "accent" : "neg");

  const doExport = () => {
    const columns = [
      { label: "id", w: 10, value: (r) => r.id },
      { label: "Name", w: 20, value: (r) => r.name || "" },
      { label: "Phone", w: 16, value: (r) => r.phone || "" },
      { label: "Email", w: 22, value: (r) => r.email || "" },
      { label: "Course", w: 18, value: (r) => r.course || "" },
      { label: "Mode", w: 10, value: (r) => r.mode || "Offline" },
      { label: "Batch", w: 16, value: (r) => r.batch || "" },
      { label: "Joining date", w: 14, value: (r) => r.joinDate || "" },
      { label: "Fee", w: 10, value: (r) => (r.fee != null ? r.fee : "") },
      { label: "Paid", w: 10, value: (r) => (r.paid != null ? r.paid : "") },
      { label: "Payment status", w: 14, value: (r) => r.paymentStatus || "Unpaid" },
      { label: "Notes", w: 26, value: (r) => r.notes || "" },
    ];
    exportRowsToExcel(`allbee-class-students-${todayISO()}.xlsx`, "Class students", columns, list.length ? list : all);
  };

  return (
    <div className="content">
      <div className="page-head">
        <h3>Class students</h3>
        <span className="spacer" />
        <button className="btn" onClick={() => setImportOpen(true)}><Upload size={16} />Import from sheet</button>
        <button className="btn" onClick={doExport} disabled={!all.length}><Download size={16} />Export</button>
        <button className="btn primary" onClick={() => openModal({ type: "classStudent" })}><Plus size={16} />New student</button>
      </div>

      {isSuper && <ClassSheetSync config={config} saveClassWebhook={saveClassWebhook} />}

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, course…" style={{ paddingLeft: 32 }} />
          </div>
          <select className="select" style={{ width: "auto" }} value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="all">All courses</option>
            {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All modes</option>
            {CLASS_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={pay} onChange={(e) => setPay(e.target.value)}>
            <option value="all">All payments</option>
            {["Unpaid", "Partial", "Paid"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {all.length === 0 ? (
          <Empty icon={<GraduationCap size={22} color="var(--muted)" />} title="No class students yet"
            text="Add students for your offline/online classes, or import your existing sheet with one click."
            action={<div style={{ display: "flex", gap: 8 }}><button className="btn" onClick={() => setImportOpen(true)}><Upload size={16} />Import from sheet</button><button className="btn primary" onClick={() => openModal({ type: "classStudent" })}><Plus size={16} />New student</button></div>} />
        ) : list.length === 0 ? (
          <Empty icon={<Search size={22} color="var(--muted)" />} title="No matches" text="Try a different search or clear the filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Student</th><th>Course</th><th>Mode</th><th>Batch</th><th>Joined</th><th className="num-cell">Fee</th><th>Payment</th><th></th></tr></thead>
              <tbody>{list.map((s) => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone || s.email || "—"}</div></td>
                  <td>{s.course || "—"}</td>
                  <td><span className={"badge " + modeTone(s.mode)}>{s.mode || "Offline"}</span></td>
                  <td style={{ fontSize: 12.5 }}>{s.batch || "—"}</td>
                  <td className="mono">{s.joinDate ? fmtDate(s.joinDate) : "—"}</td>
                  <td className="num-cell mono">{s.fee ? money(s.fee) : "—"}{s.paid ? <div style={{ fontSize: 11, color: "var(--muted)" }}>paid {money(s.paid)}</div> : null}</td>
                  <td><span className={"badge " + payTone(s.paymentStatus)}>{s.paymentStatus || "Unpaid"}</span></td>
                  <td><div className="row-actions">
                    <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "classStudent", initial: s })}><Pencil size={14} /></button>
                    <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove student?", body: `Remove ${s.name}?`, note: "They move to Recently deleted — restore within 60 days.", onConfirm: () => del(s) })}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {importOpen && <ImportData mutate={mutate} currentUser={currentUser} defaultTarget="class_students" lockTarget onClose={() => setImportOpen(false)} />}
    </div>
  );
}

// Google Sheet mirror settings for class students (super admin only). Paste the
// deployed Apps Script /exec URL; every add/edit then POSTs into that sheet.
function ClassSheetSync({ config, saveClassWebhook }) {
  const saved = classWebhookOf(config);
  const [url, setUrl] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setUrl(classWebhookOf(config)); }, [config?.class_sheet_webhook]);

  const valid = /^https:\/\/script\.google\.com\/.+/.test(url.trim());
  const save = async () => {
    setBusy(true); setMsg("");
    try { await saveClassWebhook(url.trim()); setMsg(url.trim() ? "Saved. New students will be sent to your sheet." : "Sheet sync turned off."); }
    catch { setMsg("Couldn't save — check your connection and try again."); }
    finally { setBusy(false); }
  };
  const test = () => {
    if (!saved) return;
    setMsg("");
    try {
      fetch(saved, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "test", student: { id: "test", name: "ALLBEE test row", course: "Test", mode: "Offline", createdAt: Date.now() } }) }).catch(() => {});
      setMsg("Test row sent — check the bottom of your Google Sheet.");
    } catch { setMsg("Couldn't reach the sheet URL."); }
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Link2 size={16} color="var(--muted)" />
        <b style={{ fontSize: 14 }}>Google Sheet sync</b>
        <span className={"badge " + (saved ? "pos" : "")} style={saved ? undefined : { background: "var(--surface-2)", color: "var(--muted)" }}>{saved ? "Connected" : "Not connected"}</span>
      </div>
      <div className="hint-line" style={{ lineHeight: 1.55, marginBottom: 10 }}>
        Optional. When connected, every student you add or edit here is also written into your Google Sheet automatically.
        Importing already reads <i>from</i> a sheet, so it's kept separate. Leave blank to keep everything in-app only.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" style={{ flex: "1 1 320px", minWidth: 220 }} />
        <button className="btn primary" onClick={save} disabled={busy || (url.trim() && !valid)}>{busy ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}Save</button>
        {saved && <button className="btn" onClick={test}><Send size={15} />Send test row</button>}
      </div>
      {url.trim() && !valid && <div className="hint-line" style={{ color: "var(--neg)", display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}><AlertTriangle size={13} />That doesn't look like an Apps Script URL — it should start with https://script.google.com/…</div>}
      {msg && <div className="hint-line" style={{ color: "var(--pos)", marginTop: 8 }}>{msg}</div>}
      <details style={{ marginTop: 10 }}>
        <summary className="ttl-link" style={{ fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>How to connect a sheet (2 minutes)</summary>
        <ol className="hint-line" style={{ lineHeight: 1.7, margin: "8px 0 0", paddingLeft: 18 }}>
          <li>Open your Google Sheet → <b>Extensions → Apps Script</b>.</li>
          <li>Paste the ALLBEE sync script (ask your developer for it), then <b>Deploy → New deployment → Web app</b>.</li>
          <li>Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, then Deploy and copy the <b>Web app URL</b>.</li>
          <li>Paste that URL above and press Save. Use <b>Send test row</b> to confirm it works.</li>
        </ol>
      </details>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STAFF + HR MODULES
══════════════════════════════════════════════════════════════════════ */
function StaffDashboard({ db, me, go, mutate, openModal, team = [] }) {
  const today = todayISO();
  const todays = db.attendance.filter((a) => a.userId === me.id && a.date === today);
  const openSess = todays.find((a) => !a.checkOut);
  const todayH = sumHours(todays);
  const leaveToday = onApprovedLeave(db, me.id, today);
  const myOpen = db.tasks.filter((t) => isTaskAssignee(t, me) && t.status !== "Completed");
  const myPendingLeave = db.leave.filter((l) => l.userId === me.id && l.status === "Pending");
  const myUpdatesToday = db.updates.filter((u) => u.userId === me.id && u.date === today);
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const myJoin = team.find((p) => p.id === me.id)?.created_at;
  const earn = staffEarnings(db, db.payroll, { id: me.id, name: me.name }, myJoin);

  const doCheckIn = () => mutate((d) => ({ ...d, attendance: [...d.attendance, { id: uid(), userId: me.id, userName: me.name, date: today, checkIn: new Date().toISOString(), checkOut: null, createdAt: Date.now() }] }), { action: "checked in", module: "Attendance" });
  const doCheckOut = () => { if (!openSess) return; mutate((d) => ({ ...d, attendance: d.attendance.map((a) => a.id === openSess.id ? { ...a, checkOut: new Date().toISOString() } : a) }), { action: "checked out", module: "Attendance" }); };
  const checkIn = () => openModal({ type: "okConfirm", title: "Check in?", body: "Type OK to confirm your check-in.", actionLabel: "Check in", icon: <LogIn size={15} />, onConfirm: () => { haptic(12); doCheckIn(); } });
  const checkOut = () => openModal({ type: "okConfirm", title: "Check out?", body: "Type OK to confirm your check-out.", actionLabel: "Check out", icon: <CheckCircle2 size={15} />, onConfirm: () => { haptic(12); doCheckOut(); } });

  return (
    <div className="content">
      <div className="page-head"><h3>{greet}, {me.name}</h3></div>

      <div className="card stat" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div className="avatar" style={{ background: avatarColor(me.name), width: 44, height: 44, fontSize: 18 }}>{me.name[0]}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="lbl"><Clock size={14} /> Today · {fmtDate(today)}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
            {leaveToday ? "On approved leave" : openSess ? `Checked in at ${clockTime(openSess.checkIn)}` : todays.length ? `${todays.length} session${todays.length > 1 ? "s" : ""} today · ${todayH.toFixed(1)}h` : "Not checked in yet"}
          </div>
        </div>
        {!leaveToday && !openSess && <button className="btn primary" onClick={checkIn}><LogIn size={16} />Check in</button>}
        {!leaveToday && openSess && <button className="btn primary" onClick={checkOut}><CheckCircle2 size={16} />Check out</button>}
      </div>

      <Birthdays team={team} />

      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 16 }}>
        <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("tasks")}>
          <div className="lbl"><ListTodo size={14} /> My open tasks</div><div className="num">{myOpen.length}</div></div>
        <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("leave")}>
          <div className="lbl"><Plane size={14} /> Pending leave</div><div className="num">{myPendingLeave.length}</div></div>
        <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("updates")}>
          <div className="lbl"><MessageSquare size={14} /> Today's updates</div><div className="num">{myUpdatesToday.length}</div></div>
        {earn.configured && <div className="card stat" style={{ cursor: "pointer" }} onClick={() => go("earnings")}>
          <div className="lbl"><Coins size={14} /> Earned to date</div><div className="num mono pos-txt">{money(earn.totalToDate)}</div>
          <div className="sub">{earn.pipelineComm > 0 ? `${money(earn.pipelineComm)} in pipeline` : "Tap to see breakdown"}</div></div>}
      </div>

      <div className="quick-actions">
        <button className="btn" onClick={() => openModal({ type: "leave" })}><Plane size={15} />Request leave</button>
        <button className="btn" onClick={() => go("updates")}><MessageSquare size={15} />Post a daily update</button>
        <button className="btn" onClick={() => go("tasks")}><ListTodo size={15} />See my tasks</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>My next tasks</div>
        {myOpen.length === 0 ? (
          <Empty icon={<ListTodo size={22} color="var(--muted)" />} title="Nothing assigned right now" text="When an admin assigns you a task, it shows up here." />
        ) : myOpen.slice(0, 5).map((t) => (
          <div key={t.id} className="item-row">
            <div className="item-main">
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span className="item-title">{t.title}</span>
                <span className={"badge " + (t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
                {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
              </div>
              {t.due && <div className="item-meta" style={{ marginTop: 6 }}><span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Due {fmtDate(t.due)}</span></div>}
            </div>
            <div className="row-actions"><button className="btn sm" onClick={() => go("tasks")}>Open<ArrowRight size={13} /></button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function attStatus(db, userId, dateISO) {
  if (onApprovedLeave(db, userId, dateISO)) return { label: "On leave", tone: "accent" };
  const a = attendanceFor(db, userId, dateISO);
  if (!a) return { label: "Absent", tone: "muted" };
  if (a.checkOut) return { label: "Checked out", tone: "pos" };
  return { label: "Present", tone: "pos" };
}

function leaveTone(s) { return s === "Approved" ? "pos" : s === "Rejected" ? "neg" : "pri"; }

function Updates({ db, mutate, me, isAdmin, removeItem, openModal }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const today = todayISO();
  const all = [...db.updates].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((u) => u.userId === me.id);
  const post = () => {
    const content = text.trim(); if (!content) return;
    mutate((d) => ({ ...d, updates: [...d.updates, { id: uid(), userId: me.id, userName: me.name, date: today, content, createdAt: Date.now() }] }), null);
    setText("");
  };
  const startEdit = (u) => { setEditId(u.id); setEditText(u.content); };
  const saveEdit = (u) => { const c = editText.trim(); if (!c) { setEditId(null); return; } mutate((d) => ({ ...d, updates: d.updates.map((x) => x.id === u.id ? { ...x, content: c, editedAt: Date.now() } : x) }), null); setEditId(null); setEditText(""); };
  const acknowledge = (u) => { haptic(10); mutate((d) => ({ ...d, updates: d.updates.map((x) => x.id === u.id ? { ...x, ackBy: me.name, ackAt: Date.now() } : x) }), { action: `acknowledged ${u.userName}'s daily update`, module: "Daily updates" }); };
  const askDelete = (u) => openModal({ type: "deleteConfirm", title: "Delete update?", body: "This moves the update to Recently deleted.", note: "You can restore it within 60 days.", onConfirm: () => removeItem("updates", u, { name: `${u.userName}'s update`, audit: "deleted a daily update" }) });

  return (
    <div className="content">
      <div className="page-head"><h3>Daily updates</h3></div>

      {!isAdmin && (
        <div className="card stat" style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ marginBottom: 8 }}><MessageSquare size={14} /> What did you work on today?</div>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Share progress, blockers, or what's next…" style={{ minHeight: 80 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button className="btn primary" onClick={post} disabled={!text.trim()}><ArrowRight size={15} />Post update</button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>{isAdmin ? "Team updates" : "My updates"}</div>
        {list.length === 0 ? (
          <Empty icon={<MessageSquare size={22} color="var(--muted)" />} title="No updates yet" text={isAdmin ? "Daily updates from your team will show up here." : "Post your first update above."} />
        ) : list.map((u) => (
          <div key={u.id} className="item-row">
            <div className="avatar" style={{ background: avatarColor(u.userName), width: 30, height: 30, fontSize: 12 }}>{u.userName[0]}</div>
            <div className="item-main">
              <div className="item-title" style={{ fontSize: 14 }}><b>{u.userName}</b></div>
              {editId === u.id ? (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea className="textarea" style={{ minHeight: 64 }} value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button className="btn sm" onClick={() => { setEditId(null); setEditText(""); }}>Cancel</button><button className="btn sm primary" onClick={() => saveEdit(u)}><Check size={13} />Save</button></div>
                </div>
              ) : <div style={{ marginTop: 4, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{u.content}</div>}
              <div className="item-meta" style={{ marginTop: 6 }}><span>{fmtDate(u.date)}</span><span>{fmtTime(u.createdAt)}</span>{u.editedAt && <span>edited</span>}{u.ackAt && <span style={{ color: "var(--pos)", display: "inline-flex", alignItems: "center", gap: 4 }}><BadgeCheck size={12} />Acknowledged by {u.ackBy || "admin"}</span>}</div>
            </div>
            {editId !== u.id && (
              <div className="row-actions">
                {!isAdmin && u.userId === me.id && withinMinutes(u.createdAt, 30) && <button className="iconbtn" style={{ width: 32, height: 32 }} title="Edit (within 30 min)" onClick={() => startEdit(u)}><Pencil size={14} /></button>}
                {isAdmin && !u.ackAt && <button className="btn sm" onClick={() => acknowledge(u)}><Check size={13} />Acknowledge</button>}
                {(isAdmin || u.userId === me.id) && <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => askDelete(u)}><Trash2 size={14} /></button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Team({ team, me, changeProfile, db, resolveResign, onActivity, onOpenAPN }) {
  const [permFor, setPermFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [manageFor, setManageFor] = useState(null);
  const [highlightRole, setHighlightRole] = useState(null);
  const highlightTimer = useRef(null);
  const count = (r) => team.filter((p) => p.role === r).length;
  const activeApnCount = (db?.apn_users || []).filter((p) => apnEffectiveStatus(p) === "active").length;
  const highlight = (role) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightRole(role);
    requestAnimationFrame(() => document.querySelector(`[data-team-role="${role}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    highlightTimer.current = setTimeout(() => setHighlightRole(null), 5000);
  };
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); }, []);
  const cardProps = (role) => ({ role: "button", tabIndex: 0, style: { cursor: "pointer" }, onClick: () => highlight(role), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); highlight(role); } } });
  const setStatus = (p, status) => changeProfile(p.id, { status, active: STATUS_ACTIVE[status] }, `set ${p.name} to ${STATUS_LABEL[status] || status}`);
  const moduleSummary = (p) => {
    if (p.role === "superadmin" || p.role === "admin") return "All modules";
    if (p.role === "accountant") return "Share & accounts, Withdrawals";
    if (p.role === "intern") return "Tasks, attendance, updates";
    const mods = Array.isArray(p.perms?.modules) ? p.perms.modules : [];
    return mods.length ? mods.map((k) => (GRANTABLE_MODULES.find((g) => g[0] === k) || [k, k])[1]).join(", ") : "Personal screens only";
  };
  const isSuper = me.role === "superadmin";
  const pending = team.filter((p) => (p.role === "staff" || p.role === "client") && p.approved === false);
  const roster = team.filter((p) => p.role !== "client" && p.role !== "partner" && p.role !== "district_head");          // clients & APN partners live in their own portals, not the internal roster
  const approve = (p) => { haptic(10); changeProfile(p.id, { approved: true }, `approved ${p.name}'s account`); };
  const reject = (p) => changeProfile(p.id, { approved: false, status: "terminated", active: false }, `rejected ${p.name}'s account`);
  return (
    <div className="content">
      <div className="page-head"><h3>Team</h3><span className="spacer" />{isSuper && <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />Add user</button>}</div>
      {isSuper && pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Hourglass size={15} /> {pending.length} account{pending.length > 1 ? "s" : ""} awaiting your approval</div>
          {pending.map((p) => (
            <div key={p.id} className="item-row">
              <div className="avatar" style={{ background: avatarColor(p.name), width: 30, height: 30, fontSize: 12 }}>{(p.name || "?")[0]}</div>
              <div className="item-main">
                <div className="item-title" style={{ fontSize: 14 }}>{p.name} <span className="badge accent" style={{ marginLeft: 4 }}>{p.role === "client" ? "Client" : "Staff"}</span></div>
                <div className="item-meta"><span>{p.email}</span>{p.created_at && <span>Signed up {fmtDate(p.created_at.slice(0, 10))}</span>}</div>
              </div>
              <div className="row-actions">
                <button className="btn sm primary" onClick={() => approve(p)}><Check size={13} />Approve</button>
                <button className="btn sm danger" onClick={() => reject(p)}><X size={13} />Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(db?.resignations || []).filter((r) => r.status === "Pending").length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><LogOut size={15} /> Resignation requests</div>
          {(db.resignations || []).filter((r) => r.status === "Pending").map((r) => (
            <div key={r.id} className="item-row">
              <div className="item-main">
                <div className="item-title" style={{ fontSize: 14 }}>{r.userName}</div>
                <div className="item-meta"><span>{r.reason}</span>{r.lastDay && <span>Proposed last day: {fmtDate(r.lastDay)}</span>}<span>{fmtDateTime(r.createdAt)}</span></div>
              </div>
              <div className="row-actions">
                <button className="btn sm danger" onClick={() => resolveResign(r, "Approved")}><Check size={13} />Approve &amp; offboard</button>
                <button className="btn sm" onClick={() => resolveResign(r, "Declined")}><X size={13} />Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", marginBottom: 16 }}>
        <div className="card stat" {...cardProps("superadmin")}><div className="lbl"><ShieldCheck size={14} /> Partners</div><div className="num">{count("superadmin")}</div></div>
        <div className="card stat" {...cardProps("admin")}><div className="lbl"><ShieldCheck size={14} /> Admins</div><div className="num">{count("admin")}</div></div>
        <div className="card stat" {...cardProps("accountant")}><div className="lbl"><Wallet size={14} /> Accountants</div><div className="num">{count("accountant")}</div></div>
        <div className="card stat" {...cardProps("staff")}><div className="lbl"><Users size={14} /> Staff</div><div className="num">{count("staff")}</div></div>
        <div className="card stat" {...cardProps("intern")}><div className="lbl"><Users size={14} /> Interns</div><div className="num">{count("intern")}</div></div>
        <div className="card stat" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={onOpenAPN} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAPN?.(); } }}><div className="lbl"><BadgeCheck size={14} /> APN Partners</div><div className="num">{activeApnCount}</div></div>
      </div>
      <div className="card">
        {team.length === 0 ? <Empty icon={<Users size={22} color="var(--muted)" />} title="No one here yet" text="Share the app link so your team can create accounts." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Module access</th><th>Joined</th></tr></thead>
              <tbody>{roster.map((p) => {
                const isSelf = p.id === me.id;
                const isSuper = p.role === "superadmin";
                return (
                  <tr key={p.id} data-team-role={p.role} className={highlightRole === p.role ? "team-highlight" : ""} style={p.active === false ? { opacity: .55 } : undefined}>
                    <td>
                      <span className="who-cell">
                        <span style={{ position: "relative", display: "inline-flex" }}><Avatar name={p.name} url={p.photo_url} size={26} />{isOnline(p) && <span title="Online" style={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", background: "var(--pos)", border: "2px solid var(--surface, #fff)" }} />}</span>
                        <span><div style={{ fontWeight: 600 }}>{p.name}{isSelf ? " (you)" : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{p.designation ? p.designation + " · " : ""}{p.email}</div></span>
                      </span>
                    </td>
                    <td>
                      {isSuper
                        ? <span className="role-badge superadmin">Super admin</span>
                        : <select className="select" style={{ width: "auto", padding: "5px 8px" }} value={p.role} disabled={isSelf}
                            onChange={(e) => changeProfile(p.id, { role: e.target.value }, `changed ${p.name}'s role to ${ROLE_LABEL[e.target.value] || e.target.value}`)}>
                            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>}
                    </td>
                    <td>
                      {isSuper
                        ? <span className="status-pill status-active">Active</span>
                        : <select className={"select"} style={{ width: "auto", padding: "5px 8px" }} value={p.status || "active"} disabled={isSelf}
                            onChange={(e) => setStatus(p, e.target.value)}>
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="hint-line" style={{ fontSize: 12 }}>{moduleSummary(p)}</span>
                        {!isSelf && <ContactButtons person={p} compact />}
                        {p.role === "staff" && <button className="btn sm" onClick={() => setPermFor(p)}><Pencil size={12} />Edit</button>}
                        {me.role === "superadmin" && !isSelf && <button className="btn sm" onClick={() => setManageFor(p)}><KeyRound size={12} />Manage</button>}
                      </div>
                    </td>
                    <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{p.created_at ? fmtDate(p.created_at.slice(0, 10)) : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        <div className="hint-line" style={{ padding: "12px 16px", lineHeight: 1.5 }}>
          Partners (Haji &amp; Alim) and accountants are the only people who see Share &amp; accounts and Withdrawals. Admins run the team, projects and approvals but not the money. Set a status of Suspended, Resigned or Terminated to revoke someone's access immediately; On leave keeps it.
        </div>
      </div>
      {permFor && <React.Suspense fallback={<LoadingScreen />}><LazyPermsModal person={permFor} onClose={() => setPermFor(null)} onSave={(modules) => changeProfile(permFor.id, { perms: { ...(permFor.perms || {}), modules } }, `updated ${permFor.name}'s module access`)} runtime={{ useState, Modal, Check, GRANTABLE_MODULES }} /></React.Suspense>}
      {creating && <React.Suspense fallback={<LoadingScreen />}><LazyCreateUserModal onActivity={onActivity} onClose={() => setCreating(false)} runtime={{ useState, Modal, Field, PasswordField, supabase, ROLE_OPTIONS, ROLE_LABEL, RefreshCw, Plus, Check, AlertTriangle }} /></React.Suspense>}
      {manageFor && <React.Suspense fallback={<LoadingScreen />}><LazyManageUserModal person={manageFor} onActivity={onActivity} onClose={() => setManageFor(null)} runtime={{ useState, Modal, Field, PasswordField, supabase, useUsernameAvailability, TypedConfirm, emitToast, AlertTriangle, Check, Trash2 }} /></React.Suspense>}
    </div>
  );
}

function Blocked({ isDark, name, onSignOut }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card">
        <div className="lock-badge" style={{ background: "var(--surface-2)" }}><Hourglass size={28} color="var(--muted)" /></div>
        <h1>Access paused</h1>
        <p>Hi {name}, your account is currently inactive. Please ask an ALLBEE admin to reactivate it.</p>
        <button className="btn" style={{ marginTop: 8 }} onClick={onSignOut}><LogOut size={15} />Sign out</button>
      </div>
    </div>
  );
}

function ApprovalPending({ isDark, name, onSignOut }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card">
        <div className="lock-badge" style={{ background: "var(--surface-2)" }}><ShieldCheck size={28} color="var(--muted)" /></div>
        <h1>Awaiting approval</h1>
        <p>Thanks {name} — your account has been created. A partner needs to approve it before you can get in. You'll have access as soon as they do.</p>
        <button className="btn" style={{ marginTop: 8 }} onClick={onSignOut}><LogOut size={15} />Sign out</button>
      </div>
    </div>
  );
}

// Detects the OS-level reduced-motion preference so animation-dependent UI can
// downgrade to a static/premium-but-subtle presentation. Mirrors the matcher
// already used for the founder-lockdown tap chip.
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// Prism Flux — the app's premium global loader visual: a six-faced 3D prism
// built from the ALLBEE logo (monogram), GPU-spun via CSS only. Optionally
// cycles through an honest, neutral status queue underneath (re-uses msg-in;
// key={i} re-triggers the entrance per message). No fake delays — this never
// extends the wait. When the user prefers reduced motion, the spin pauses and
// a subtle static presentation is used instead.
const DEFAULT_PRISM_STATUS = [
  "Preparing AllBee",
  "Loading your workspace",
  "Syncing data",
  "Preparing your dashboard",
  "Almost ready",
];

// "Did you know?" rotating facts for the loading screen. Local-only (no network
// required), so the loading screen still works offline. 15 facts; rotation
// avoids immediate repeats. Concise, truthful, no financial/legal guarantees.
const DYK_FACTS = [
  { title: "Founder & CEO", body: "Z. Mohamed Backer Alim Sahib — B.E ECE, DECE, CCNA — Founder & CEO of ALLBEE SOLUTIONS." },
  { title: "Co-Founder & CFO", body: "Syed Hasan Kuddos Sahib S — BBA (Financial Services), LLB (Hons) — Co-Founder & CFO of ALLBEE SOLUTIONS." },
  { title: "Zero-upfront referrals", body: "APN provides an opportunity for eligible partners to earn through referrals and business generation without requiring an upfront investment." },
  { title: "Founded 2025", body: "ALLBEE SOLUTIONS was founded in May 2025." },
  { title: "Two branches", body: "ALLBEE currently operates through two branches: Nagore and Velankanni." },
  { title: "Office Admin", body: "N. Saranya (BCA) administers the Nagore office." },
  { title: "Business Development", body: "Romitha Venkatesan (MBA) leads business development for Chennai." },
  { title: "Digital focus", body: "ALLBEE focuses on delivering high-quality websites and digital solutions at affordable prices for businesses in Tamil Nadu." },
  { title: "Services scope", body: "ALLBEE SOLUTIONS provides digital marketing and IT-related services for businesses and learners." },
  { title: "APN purpose", body: "APN is designed to help partners connect businesses and customers with ALLBEE's services." },
  { title: "Four strands", body: "ALLBEE combines technology, business development, digital marketing, and partner-driven growth." },
  { title: "Partner visibility", body: "APN partners can track referrals, projects, revenue, commissions, and wallet information from their portal." },
  { title: "Activity tracking", body: "APN partners can monitor their activity and partner-network progress from the application." },
  { title: "District expansion", body: "ALLBEE's APN network is designed to expand district by district across Tamil Nadu." },
  { title: "Building tools", body: "ALLBEE continues to build digital tools that make business operations simpler, more transparent, and easier to manage." },
];

function LoadingScreen({ isDark, note }) {
  const prisms = note === "Signing you in…" ? ["Checking your access", "Preparing your workspace", "Almost ready"]
    : note === "Loading your portal…" || note === "Loading APN…" ? ["Preparing your dashboard", "Syncing data", "Almost ready"]
    : note === "Preparing your workspace…" ? ["Syncing data", "Almost ready"]
    : null;
  return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} aria-busy="true" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <ToastHost />
      <div className="loading-screen">
        <div className="loading-card">
          <PrismFluxLoader status={note || "Loading ALLBEE…"} statusList={prisms} />
          <DidYouKnow />
        </div>
      </div>
    </div>
  );
}

function DidYouKnow() {
  // Pick a fresh fact on every mount/reload; avoid always starting on the founder fact.
  const [i, setI] = useState(() => Math.floor(Math.random() * DYK_FACTS.length));
  // Keep each fact readable. Rotate on a deliberate 6-second cadence, not
  // through render-driven state updates.
  useEffect(() => {
    if (DYK_FACTS.length < 2) return undefined;
    const timer = setInterval(() => {
      setI((current) => {
        let next = Math.floor(Math.random() * DYK_FACTS.length);
        if (next === current) next = (current + 1) % DYK_FACTS.length;
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="dyk-wrap">
      <div className="dyk-card">
        <span className="dyk-icon" aria-hidden="true">💡</span>
        <div className="dyk-body">
          <span className="dyk-title">{DYK_FACTS[i].title}</span>
          <span className="dyk-text">{DYK_FACTS[i].body}</span>
        </div>
      </div>
    </div>
  );
}

function PrismFluxLoader({ status, statusList, size = 40, interval = 1700 }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const list = useMemo(
    () => [status, ...(statusList && statusList.length ? statusList : DEFAULT_PRISM_STATUS)].filter(Boolean),
    [status, statusList]
  );
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list, interval]);
  return (
    <div className="prism-wrap" style={{ animation: reduced ? "none" : undefined }} role="status" aria-live="polite">
      <div className={`prism${reduced ? " paused" : ""}`} aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <span key={f} className={`prism-face prism-f${f}`}>
            <img className="prism-logo" src={LOGO_ICON} alt="" aria-hidden="true" />
          </span>
        ))}
      </div>
      <div className="prism-status">
        <span key={i}>{list[i]}</span>
      </div>
    </div>
  );
}

// First sign-in: collect the details every profile needs before the app opens.
function ProfileSetup({ profile, onSave, onSignOut, isDark }) {
  const [name, setName] = useState(profile?.name || "");
  const [mobile, setMobile] = useState(profile?.mobile || "");
  const [dob, setDob] = useState(profile?.dob || "");
  const [photo, setPhoto] = useState(profile?.photo_url || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    if (!name.trim()) { setErr("Tell us your full name."); return; }
    if (mobile.replace(/\D/g, "").length < 7) { setErr("Enter a valid mobile number."); return; }
    if (!dob) { setErr("Add your date of birth."); return; }
    const uname = username.trim().toLowerCase().replace(/\s+/g, "");
    setBusy(true);
    try { await onSave({ name: name.trim(), mobile: mobile.trim(), dob, photo_url: photo.trim() || null, username: uname || null }); }
    catch (e) { setErr(e.message || "Couldn't save that. Try again."); setBusy(false); }
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card gate-card">
        <FounderTap className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 52 }} />
        <h1>Complete your profile</h1>
        <p>A few details before you start — your team uses these to reach you.</p>
        <div className="gate-body">
          <Field label="Full name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" /></Field>
          <Field label="Mobile number" required hint="Used for work contact and birthday wishes."><input className="input" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 …" /></Field>
          <Field label="Date of birth" required><input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={todayISO()} /></Field>
          <Field label="Profile photo URL" hint="Optional — add or change this any time."><input className="input" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Username" hint="Optional — lets you sign in with a username instead of your email."><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya" /></Field>
        </div>
        {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
        <div className="gate-foot">
          <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}Save and continue</button>
        </div>
        <button className="linkbtn" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

// Self-service profile page — available to EVERY internal user (admins and staff
// alike). Same required basics as the first-login gate (full name, mobile, DOB);
// photo + username optional. Role/designation stay admin-controlled, email is the
// sign-in identity, so both are shown read-only here.
function ChangePasswordCard({ email }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const change = async () => {
    setMsg(""); setErr("");
    if (nw.length < 6) { setErr("New password must be at least 6 characters."); return; }
    if (nw !== cf) { setErr("The new passwords don't match."); return; }
    if (!email) { setErr("We couldn't find your account email — reload and try again."); return; }
    setBusy(true);
    try {
      const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (reauth) { setErr("Your current password is incorrect."); setBusy(false); return; }
      const { error } = await supabase.auth.updateUser({ password: nw });
      if (error) throw error;
      setMsg("Password changed. Use your new password the next time you sign in.");
      setCur(""); setNw(""); setCf("");
    } catch (e) { setErr((e && e.message) || "Couldn't change the password. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <div className="card stat" style={{ marginTop: 14 }}>
      <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><KeyRound size={14} /> Sign-in &amp; security</div>
      <p className="hint-line" style={{ marginTop: 6, marginBottom: 12 }}>Change the password you use to sign in. You'll enter your current password to confirm it's you.</p>
      <div className="grid2">
        <PasswordField label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        <div />
      </div>
      <div className="grid2">
        <PasswordField label="New password" hint="At least 6 characters." value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
        <PasswordField label="Confirm new password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
      </div>
      {err && <div className="auth-msg err" style={{ marginTop: 8 }}><AlertTriangle size={14} /> {err}</div>}
      {msg && <div className="auth-msg ok" style={{ marginTop: 8 }}><Check size={14} /> {msg}</div>}
      <div style={{ marginTop: 12 }}><button className="btn primary" onClick={change} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <KeyRound size={16} />}Change password</button></div>
    </div>
  );
}

/* ── Activity & last seen (admin): who's online + login/logout times ──────── */
function LastSeen({ team }) {
  const [act, setAct] = useState({});
  const [colsMissing, setColsMissing] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState("all"); // all | inactive
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("id,last_login,last_logout");
        if (error) throw error;
        if (!alive) return;
        const m = {}; for (const r of data || []) m[r.id] = r; setAct(m);
      } catch { if (alive) { setColsMissing(true); setAct({}); } }
    })();
    return () => { alive = false; };
  }, []);
  const people = team.filter(isInternalMember);
  const inactive = people.filter(isInactiveWeek);
  const inactiveSet = new Set(inactive.map((p) => p.id));
  const base = view === "inactive" ? inactive : people;
  const filtered = q.trim() ? base.filter((p) => (p.name || "").toLowerCase().includes(q.trim().toLowerCase())) : base;
  const rows = filtered.slice().sort((a, b) => lastSeenMs(a) - lastSeenMs(b)); // least-recent first, so inactive float to the top
  const onlineCount = people.filter(isOnline).length;
  return (
    <div className="content">
      <div className="page-head"><h3>Activity &amp; last seen</h3></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><Eye size={15} /> See who's online now, when each person was last active, and who hasn't signed in for over a week.</div>
      <div className="sumrow">
        <div className="card"><div className="k"><Users size={14} /> People</div><div className="v">{people.length}</div></div>
        <div className="card"><div className="k"><UserCheck size={14} color="var(--pos)" /> Online now</div><div className="v mono">{onlineCount}</div></div>
        <div className="card" style={inactive.length ? { cursor: "pointer", borderColor: "var(--neg)" } : undefined} onClick={() => inactive.length && setView(view === "inactive" ? "all" : "inactive")}>
          <div className="k"><AlertTriangle size={14} color={inactive.length ? "var(--neg)" : "var(--muted)"} /> Inactive 1+ week</div>
          <div className="v mono" style={inactive.length ? { color: "var(--neg)" } : undefined}>{inactive.length}</div>
        </div>
      </div>

      {inactive.length > 0 && (
        <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14, borderColor: "var(--neg)", background: "var(--neg-soft)" }}>
          <AlertTriangle size={15} color="var(--neg)" />
          <span><b>{inactive.length} {inactive.length === 1 ? "person hasn't" : "people haven't"} signed in for over a week:</b>{" "}
            {inactive.slice().sort((a, b) => lastSeenMs(a) - lastSeenMs(b)).map((p, i) => (
              <span key={p.id}>{i > 0 ? ", " : ""}{p.name} ({p.last_active ? relTime(p.last_active) : "never seen"})</span>
            ))}.
          </span>
        </div>
      )}

      {colsMissing && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14, borderColor: "var(--accent)" }}><AlertTriangle size={15} color="var(--accent)" /> Sign-in / sign-out times need two columns added to your database (run the one-line snippet in setup). Last seen and online status work already.</div>}

      <div className="filterbar" style={{ marginBottom: 12 }}>
        <Field label="Show"><select className="select" value={view} onChange={(e) => setView(e.target.value)}><option value="all">Everyone</option><option value="inactive">Inactive 1+ week{inactive.length ? ` (${inactive.length})` : ""}</option></select></Field>
        <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person…" /></Field>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty icon={<Users size={22} color="var(--muted)" />} title={view === "inactive" ? "Everyone's active" : "No one to show"} text={view === "inactive" ? "No one has been away for more than a week." : "Team members appear here with their activity."} />
          : <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Person</th><th>Status</th><th>Last seen</th><th>Last sign-in</th><th>Last sign-out</th><th>Contact</th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const online = isOnline(p);
                  const away = inactiveSet.has(p.id);
                  const a = act[p.id] || {};
                  const awayDays = Math.floor((Date.now() - lastSeenMs(p)) / 86400000);
                  return (
                    <tr key={p.id} style={away ? { background: "var(--neg-soft)" } : undefined}>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={p.name} url={p.photo_url} size={26} /><div><div style={{ fontWeight: 600 }}>{p.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[p.role] || p.role}</div></div></div></td>
                      <td>{online ? <span className="badge pos"><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "currentColor", marginRight: 5, verticalAlign: "middle" }} />Online</span> : away ? <span className="badge neg"><AlertTriangle size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />Away {awayDays}d</span> : <span className="hint-line">Offline</span>}</td>
                      <td><span className="hint-line" style={away ? { color: "var(--neg)", fontWeight: 600 } : undefined}>{p.last_active ? relTime(p.last_active) : "never seen"}</span></td>
                      <td><span className="hint-line" style={{ fontSize: 12 }}>{a.last_login ? fmtDateTime(new Date(a.last_login).getTime()) : "—"}</span></td>
                      <td><span className="hint-line" style={{ fontSize: 12 }}>{a.last_logout ? fmtDateTime(new Date(a.last_logout).getTime()) : "—"}</span></td>
                      <td><ContactButtons person={p} compact message={away ? `Hi ${p.name || ""}, we noticed you haven't been active on ALLBEE for a while — is everything okay?` : undefined} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
      </div>
      <p className="hint-line" style={{ marginTop: 12, lineHeight: 1.5 }}>Someone is flagged <b>inactive</b> once they haven't been active for more than a week (new joiners get a week's grace). “Last seen” is their last activity in the app; “last sign-out” is only recorded when they use the Sign out button.</p>
    </div>
  );
}

function MyProfile({ profile, role, saveMyProfile, sessionEmail }) {
  const [name, setName] = useState(profile?.name || "");
  const [mobile, setMobile] = useState(profile?.mobile || "");
  const [dob, setDob] = useState(profile?.dob || "");
  const [photo, setPhoto] = useState(profile?.photo_url || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const photoRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  // Upload a display picture to storage, then persist just the photo (so it
  // saves immediately even if the rest of the form isn't filled yet).
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!(file.type || "").startsWith("image/")) { setErr("Please choose an image file."); if (e.target) e.target.value = ""; return; }
    setUploading(true); setErr(""); setDone(false);
    try { const up = await uploadAttachment(file); setPhoto(up.url); await saveMyProfile({ photo_url: up.url }); setDone(true); }
    catch (er) { setErr(er.message || "Couldn't upload that image."); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };
  useEffect(() => {
    setName(profile?.name || ""); setMobile(profile?.mobile || ""); setDob(profile?.dob || "");
    setPhoto(profile?.photo_url || ""); setUsername(profile?.username || "");
  }, [profile?.id, profile?.name, profile?.mobile, profile?.dob, profile?.photo_url, profile?.username]);
  const save = async () => {
    setErr(""); setDone(false);
    if (!name.trim()) { setErr("Enter your full name."); return; }
    if (mobile.replace(/\D/g, "").length < 7) { setErr("Enter a valid mobile number."); return; }
    if (!dob) { setErr("Add your date of birth."); return; }
    const uname = username.trim().toLowerCase().replace(/\s+/g, "");
    setBusy(true);
    try { await saveMyProfile({ name: name.trim(), mobile: mobile.trim(), dob, photo_url: photo.trim() || null, username: uname || null }); setDone(true); }
    catch (e) { setErr(e.message || "Couldn't save. That username may already be taken — try another."); }
    finally { setBusy(false); }
  };
  const email = profile?.email || sessionEmail || "";
  return (
    <div className="content">
      <div className="page-head"><h3>My profile</h3></div>
      <div className="card stat" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div className="avatar" style={{ background: avatarColor(name || "?"), width: 48, height: 48, fontSize: 19, overflow: "hidden", padding: 0 }}>{photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?")[0]}</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{name || "Your name"}</div>
          <div className="hint-line" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
            <span className="badge accent">{ROLE_LABEL[role] || role}</span>
            {profile?.designation && <span className="tag">{profile.designation}</span>}
          </div>
        </div>
      </div>
      <div className="card stat">
        <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><User size={14} /> Your details</div>
        <p className="hint-line" style={{ marginTop: 6, marginBottom: 12 }}>Everyone on the team — admins and staff alike — keeps these basics current. Full name, mobile and date of birth are required.</p>
        <div className="grid2">
          <Field label="Full name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" /></Field>
          <Field label="Mobile number" required hint="Work contact + birthday wishes."><input className="input" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 …" /></Field>
        </div>
        <div className="grid2">
          <Field label="Date of birth" required><input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={todayISO()} /></Field>
          <Field label="Email" hint="Your sign-in email — ask an admin to change it."><input className="input" value={email} disabled style={{ opacity: .7 }} /></Field>
        </div>
        <div className="grid2">
          <Field label="Username" hint="Optional — sign in with this instead of email."><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya" /></Field>
          <Field label="Profile photo" hint="Upload an image (max 10 MB) — saves right away.">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="avatar" style={{ background: avatarColor(name || "?"), width: 40, height: 40, fontSize: 16, overflow: "hidden", padding: 0, flex: "none" }}>{photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?")[0]}</div>
              <button className="btn sm" type="button" onClick={() => photoRef.current?.click()} disabled={uploading}>{uploading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}{photo ? "Change" : "Upload photo"}</button>
              {photo && <button className="btn sm" type="button" onClick={() => { setPhoto(""); saveMyProfile({ photo_url: null }); }}>Remove</button>}
              <input ref={photoRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
            </div>
          </Field>
        </div>
        {err && <div className="auth-msg err" style={{ marginTop: 4 }}><AlertTriangle size={14} /> {err}</div>}
        {done && !err && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginTop: 8, borderColor: "var(--pos)" }}><BadgeCheck size={15} color="var(--pos)" /> Profile saved.</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}Save profile</button>
        </div>
      </div>
      <ChangePasswordCard email={email} />
      <p className="hint-line" style={{ marginTop: 12 }}>Your role{profile?.designation ? " and job title are" : " is"} set by an admin. You can update the details above any time.</p>
    </div>
  );
}


// published version. Editing the terms bumps the version and re-prompts everyone.
function TermsGate({ agreements = [], onAccept, onSignOut, isDark }) {
  const list = agreements.length ? agreements : [{ key: "all", title: "Terms & conditions", body: "", version: 0 }];
  const [checks, setChecks] = useState(() => ({}));
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const allChecked = list.every((a) => checks[a.key]);
  const ready = allChecked && typed.trim().toUpperCase() === "AGREE";
  const accept = async () => {
    if (!ready) return;
    setBusy(true); setErr("");
    try { await onAccept(list); }
    catch (e) { setErr(e.message || "Couldn't record that. Try again."); setBusy(false); }
  };
  const multi = list.length > 1;
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card gate-card">
        <FounderTap className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 52 }} />
        <h1>Terms &amp; conditions</h1>
        <p>{multi ? "Please read and accept both agreements to continue." : "Please read and accept to continue."}</p>
        {list.map((a) => (
          <div key={a.key} style={{ marginBottom: 14 }}>
            {multi && <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{a.title}{a.version ? ` · v${a.version}` : ""}</div>}
            <div className="tnc-scroll">{a.body && a.body.trim() ? a.body : "Your administrator hasn't added the agreement text yet."}</div>
            <label className="checkrow">
              <input type="checkbox" checked={!!checks[a.key]} onChange={(e) => setChecks((c) => ({ ...c, [a.key]: e.target.checked }))} />
              I have read and understood {multi ? "these terms" : "the terms above"}.
            </label>
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <Field label="Type AGREE to confirm"><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="AGREE" autoCapitalize="characters" /></Field>
        </div>
        {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
        <div className="gate-foot">
          <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={accept} disabled={!ready || busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}Accept &amp; continue</button>
        </div>
        <button className="linkbtn" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

/* Always-available Terms & Conditions page. The first-login TermsGate forces
   acceptance; this lets anyone re-read the agreement they're bound by, any time,
   and shows which version they accepted. Read-only — admins edit it in Settings. */
function TermsPage({ config, profile, role, isAdmin, go }) {
  const mustAccept = TNC_ROLES.includes(role);                 // admin/accountant/staff/intern
  const gv = Number(config?.tnc_version || 0);
  const myGv = Number(profile?.tnc_version || 0);
  const rc = roleTncOf(config)[role];
  const myRoleV = Number(acceptedRoleTnc(profile)[role] || 0);
  const cards = [];
  if (gv > 0) cards.push({ id: "all", title: "Company terms — everyone", version: gv, body: config?.tnc_body || "", accepted: mustAccept ? myGv >= gv : null });
  if (rc && Number(rc.version || 0) > 0) cards.push({ id: "role", title: `${ROLE_LABEL[role] || role} terms`, version: Number(rc.version), body: rc.body || "", accepted: mustAccept ? myRoleV >= Number(rc.version) : null });
  const statusBadge = (c) => c.accepted === null
    ? <span className="badge">Published v{c.version}</span>
    : c.accepted
      ? <span className="badge pos" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><BadgeCheck size={12} />Accepted · v{c.version}</span>
      : <span className="badge neg" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} />Re-accept on next sign-in · v{c.version}</span>;
  return (
    <div className="content">
      <div className="page-head"><h3>Terms &amp; conditions</h3><span className="spacer" />
        {isAdmin && <button className="btn" onClick={() => go("settings")}><Pencil size={15} />Edit in Settings</button>}</div>

      {cards.length === 0 ? (
        <div className="card"><Empty icon={<ScrollText size={22} color="var(--muted)" />} title="No terms published yet"
          text={isAdmin ? "Publish a general agreement (and optional role-specific ones) from Settings — people are asked to accept on their next sign-in." : "Your administrator hasn't published the agreement yet. You'll be asked to accept it once it's available."}
          action={isAdmin && <button className="btn primary" onClick={() => go("settings")}><Pencil size={16} />Add terms in Settings</button>} /></div>
      ) : (
        <>
          {!mustAccept && <div className="banner" style={{ marginLeft: 0, marginRight: 0 }}><ScrollText size={15} /> Partners aren't required to accept. Staff, accountants, interns and admins accept their general and role terms on sign-in.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: mustAccept ? 0 : 14 }}>
            {cards.map((c) => (
              <div key={c.id} className="card stat">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><FileText size={14} /> {c.title}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  {statusBadge(c)}
                </div>
                <div className="tnc-scroll" style={{ maxHeight: 460 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   APP SHELL + ERROR BOUNDARY
══════════════════════════════════════════════════════════════════════ */
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 40, fontFamily: "system-ui", color: "#444" }}>
        <h3>Something went wrong rendering the app.</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.err)}</pre>
        <button onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    );
    return this.props.children;
  }
}

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard, "everyone"],
  ["assistant", "ALLBEE AI", Sparkles, "everyone"],
  ["ai-center", "AI Intelligence", Sparkles, "insight"],
  ["knowledge-engine", "Pricing & Knowledge", BookOpen, "admin"],
  ["requirement-builder", "Requirement Builder", MessageCircle, "admin"],
  ["proposal-center", "Proposal Center", FileText, "admin"],
  ["tasks", "Tasks", ListTodo, "work"],
  ["attendance", "Attendance", UserCheck, "work"],
  ["leave", "Leave", Plane, "leave"],
  ["updates", "Daily updates", MessageSquare, "work"],
  ["chat", "Team chat", Send, "collab"],
  ["leads", "Leads & pipeline", UserPlus, "perm:leads"],
  ["clients", "Clients", Building2, "perm:clients"],
  ["quotations", "Quotations", FileText, "perm:quotations"],
  ["invoices", "Invoices", Banknote, "perm:invoices"],
  ["portal-posts", "Client updates", ExternalLink, "perm:portal-posts"],
  ["support", "Support", Headset, "collab"],
  ["projects", "Projects", FolderKanban, "perm:projects"],
  ["inhouse", "In-house projects", Home, "perm:inhouse"],
  ["testing", "Testing", ClipboardCheck, "perm:testing"],
  ["courses", "Courses", GraduationCap, "perm:courses"],
  ["class-students", "Class students", GraduationCap, "admin"],
  ["marketing", "Marketing", Megaphone, "perm:marketing"],
  ["concepts", "Concepts", Lightbulb, "perm:concepts"],
  ["accounts", "Share & accounts", Wallet, "finance"],
  ["withdrawals", "Withdrawals", ArrowDownToLine, "finance"],
  ["planned", "Planned expenses", CalendarClock, "finance"],
  ["vault", "Passwords", KeyRound, "vault"],
  ["notifications", "Notifications", Bell, "everyone"],
  ["announcements", "Announcements", MegaphoneIcon, "collab"],
  ["documents", "Documents", Paperclip, "collab"],
  ["knowledge", "Knowledge base", BookOpen, "collab"],
  ["prompts", "Prompts", Sparkles, "perm:prompts"],
  ["sheets", "Sheets", Sheet, "perm:sheets"],
  ["terms", "Terms & conditions", BadgeCheck, "everyone"],
  ["performance", "Performance", TrendingUp, "insight"],
  ["rewards", "Rewards", Award, "collab"],
  ["earnings", "My earnings", Coins, "everyone"],
  ["team", "Team", Users, "admin"],
  ["team-leads", "Team leads", ShieldCheck, "super"],
  ["apn", "APN network", GaugeCircle, "admin"],
  ["myteam", "My team", Users, "everyone"],
  ["staff-salary", "Staff salary", Banknote, "admin"],
  ["progress", "Progress", Activity, "work"],
  ["recently-deleted", "Recently deleted", Trash2, "admin"],
  ["audit", "Audit log", ScrollText, "admin"],
  ["activity", "Activity", Eye, "admin"],
  ["profile", "My profile", User, "everyone"],
  ["settings", "Settings", SettingsIcon, "admin"],
];

// Sidebar grouping: which category each module belongs to when "Grouped" sort is on.
const NAV_CATEGORIES = [
  ["overview", "Overview"],
  ["work", "Work"],
  ["sales", "Sales & delivery"],
  ["finance", "Finance"],
  ["content", "Content & team"],
  ["admin", "Admin"],
  ["personal", "Personal"],
];
const NAV_CATEGORY = {
  dashboard: "overview", notifications: "overview", myteam: "overview", assistant: "overview", "ai-center": "overview",
  tasks: "work", attendance: "work", leave: "work", updates: "work", progress: "work", chat: "work",
  leads: "sales", clients: "sales", quotations: "sales", invoices: "sales", "portal-posts": "sales", support: "sales", projects: "sales", inhouse: "sales", courses: "sales", "class-students": "sales", marketing: "sales", concepts: "sales", testing: "sales",
  accounts: "finance", withdrawals: "finance", planned: "finance", earnings: "finance", "staff-salary": "finance",
  announcements: "content", documents: "content", knowledge: "content", prompts: "content", sheets: "content", rewards: "content", performance: "content",
  team: "admin", "team-leads": "admin", apn: "admin", "knowledge-engine": "admin", "requirement-builder": "admin", "proposal-center": "admin", vault: "admin", "recently-deleted": "admin", audit: "admin", activity: "admin", settings: "admin",
  profile: "personal", terms: "personal",
};
const navCategoryOf = (k) => NAV_CATEGORY[k] || "personal";
const NAV_SORT_LABEL = { category: "Grouped", az: "A–Z", custom: "Custom" };

// Parse the URL hash into a view. Supports deep links like #/accounts/haji,
// #/tasks/<id> and #/recently-deleted, plus #/<navkey> for ordinary pages.
function parseHash(hash) {
  const h = (hash || "").replace(/^#\/?/, "").trim();
  if (!h) return { route: "dashboard", account: null, task: null };
  const parts = h.split("/");
  if (parts[0] === "accounts" && parts[1]) {
    const k = parts[1].toLowerCase();
    return { route: "accounts", account: k === "haji" ? "Haji" : k === "alim" ? "Alim" : null, task: null };
  }
  if (parts[0] === "tasks" && parts[1]) return { route: "tasks", account: null, task: decodeURIComponent(parts[1]) };
  if (parts[0] === "recently-deleted") return { route: "recently-deleted", account: null, task: null };
  return { route: parts[0], account: null, task: null };
}

function PasswordRecovery({ isDark, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true); emitToast("Password reset successfully.", "success");
    } catch (e) { const message = /expired|invalid|token|session/i.test(e?.message || "") ? "This reset link is invalid or expired. Request a new reset email." : (e?.message || "Password reset failed. Please try again."); setErr(message); emitToast(message, "error"); }
    finally { setBusy(false); }
  };
  return <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
    <ToastHost />
    <div className="lock-card">
      <FounderTap className="lock-logo" src={LOGO_FULL} alt="ALLBEE Solutions" />
      {done ? <><div className="lock-badge" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><Check size={28} /></div><h1>Password updated</h1><p>Your password reset was successful. You can continue using ALLBEE.</p><button className="btn primary" onClick={() => onComplete?.()}>Continue</button></>
        : <><h1>Set a new password</h1><p>Choose a new password for your ALLBEE account.</p><PasswordField label="New password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" /><PasswordField label="Confirm password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" />{err && <div className="auth-msg err"><AlertTriangle size={14} />{err}</div>}<button className="btn primary" style={{ width: "100%", marginTop: 12 }} onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <KeyRound size={16} />}Update password</button></>}
    </div>
  </div>;
}

/* ── Login / access support assistant — button-driven and deterministic.
   Answers are grounded in the app's real auth rules (no LLM, no hallucination). */
const LOGIN_ASSIST_BACK = { label: "Back to start", go: "root" };
const LOGIN_ASSIST_NODES = {
  root: {
    text: "Hi 👋 I'm AllBee AI. I'm here to help you sign in, choose the right login, or solve access issues.\n\nPick an option below to get started.",
    chips: [
      { label: "Which login should I use?", go: "which" },
      { label: "I can't sign in", go: "cant" },
      { label: "I forgot my password", go: "forgot" },
      { label: "OTP problem", go: "otp" },
      { label: "My account is inactive", go: "inactive" },
      { label: "Employee Login", pick: "employee" },
      { label: "Client Login", pick: "client" },
      { label: "APN Partner Login", pick: "partner" },
      { label: "Contact Support", go: "contact" },
    ],
  },
  which: {
    text: "There are three sign-in options on this screen:\n\n• Employee Login — for ALLBEE team members (staff and admins).\n• Client Login — for clients. You get your own portal with project updates, quotations and support tickets.\n• APN Partner Login — for partner network members, signed in with their APN username.\n\nChoose the option that matches you.",
    chips: [
      { label: "Open Employee Login", pick: "employee" },
      { label: "Open Client Login", pick: "client" },
      { label: "Open APN Partner Login", pick: "partner" },
      LOGIN_ASSIST_BACK,
    ],
  },
  cant: {
    text: "Let's fix that. Check these in order:\n\n1. Use the username or email you signed up with.\n2. Passwords are case-sensitive — check caps lock.\n3. If you can't remember the password, enter your username or email and tap \"Forgot password?\" below the form — a reset link is emailed to you.\n4. New accounts must confirm their email first, and APN accounts wait for admin approval before they can sign in.\n\nWhat's going wrong?",
    chips: [
      { label: "I forgot my password", go: "forgot" },
      { label: "OTP problem", go: "otp" },
      { label: "My account is inactive", go: "inactive" },
      { label: "Contact Support", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
  forgot: {
    text: "Resetting your password takes a minute:\n\n1. Enter your email, username or APN ID in the field above.\n2. Tap \"Forgot password?\" just below the form.\n3. Open the reset email and use its link — it is single-use and expires, so always use the newest email if you requested it more than once.\n4. Check your spam or promotions folder if it doesn't arrive.\n\nThen come back here and sign in with your new password.",
    chips: [
      { label: "My reset link is expired", go: "otp" },
      { label: "My account is inactive", go: "inactive" },
      { label: "Contact Support", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
  otp: {
    text: "Reset links are single-use and expire after a short time. When a link is invalid, expired or denied, the app detects it and tells you to request a new one.\n\nJust enter your username or email above, tap \"Forgot password?\" again and use the latest email link — links from older emails won't work.",
    chips: [
      { label: "I forgot my password", go: "forgot" },
      { label: "This still isn't working", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
  inactive: {
    text: "Here's why an account may not open:\n\n• New accounts must click the confirmation link in their email before they can sign in.\n• APN partner applications are reviewed and approved by an admin — approval can take a little time.\n• Disabled accounts are reactivated by the ALLBEE admin team only.\n\nIf you've confirmed your email and still can't get in, contact support and mention the email you signed up with.",
    chips: [
      { label: "Contact Support", go: "contact" },
      { label: "I can't sign in", go: "cant" },
      LOGIN_ASSIST_BACK,
    ],
  },
  employee: {
    text: "Employee Login is for the ALLBEE team. I've opened the form below — enter your username or email and your password to continue.\n\nIf you see a sign-in error, come back here and I'll help.",
    chips: [
      { label: "I can't sign in", go: "cant" },
      { label: "I forgot my password", go: "forgot" },
      { label: "Contact Support", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
  client: {
    text: "Client Login is for clients of ALLBEE. Your portal shows project updates, quotations, invoices and support tickets. I've opened the form below — sign in with your email and password.\n\nClient accounts see only their own data, so one login is all you need for your project.",
    chips: [
      { label: "I can't sign in", go: "cant" },
      { label: "I forgot my password", go: "forgot" },
      { label: "Contact Support", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
  partner: {
    text: "APN Partner Login is for members of the ALLBEE Partner Network. Partners sign in with their APN username (not email). I've opened the form below — enter your username and password.\n\nNew partners: your application must be approved by an admin before your login is activated.",
    chips: [
      { label: "My account is inactive", go: "inactive" },
      { label: "I forgot my password", go: "forgot" },
      { label: "Contact Support", go: "contact" },
      LOGIN_ASSIST_BACK,
    ],
  },
};

function LoginAccessAssistant({ onPick }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(() => [{ id: "laa-w", role: "assistant", text: LOGIN_ASSIST_NODES.root.text }]);
  const [chips, setChips] = useState(LOGIN_ASSIST_NODES.root.chips);
  const [supportEmail, setSupportEmail] = useState("");
  const endRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("web_ai_config");
        if (!error && data && data.fallback_contact) setSupportEmail(String(data.fallback_contact).trim());
      } catch { /* the config table may not exist in older environments */ }
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [chat, chips]);

  const pushAssistant = (text, nextChips) => {
    const id = `laa-${Date.now()}-${seqRef.current++}`;
    setChat((c) => [...c, { id, role: "assistant", text }]);
    setChips(nextChips || [LOGIN_ASSIST_BACK]);
  };
  const startOver = () => {
    setChat([{ id: "laa-w", role: "assistant", text: LOGIN_ASSIST_NODES.root.text }]);
    setChips(LOGIN_ASSIST_NODES.root.chips);
  };
  const contactChips = () => {
    const list = [];
    if (supportEmail) list.push({ label: "Email support", act: "mail" });
    list.push({ label: "Create Support Ticket", go: "ticket" });
    list.push({ label: "Open Client Login", pick: "client" });
    list.push({ label: "Back to start", go: "root" });
    return list;
  };
  const goNode = (key) => {
    if (key === "ticket") {
      pushAssistant("Support tickets are created from inside your account — we can't accept them from a signed-out screen for security reasons.\n\nHere's the exact path:\n\n1. Sign in (Client Login or the login for your role).\n2. Open Support → My Tickets.\n3. Tap Create Ticket, pick the category and priority, and describe the issue.\n4. Our team replies inside the ticket — you'll get a ticket number you can track.\n\nIf you can't sign in at all, use Email support or WhatsApp below and mention the email you registered with.", contactChips());
      return;
    }
    if (key === "contact") {
      pushAssistant(`Here's how to reach the ALLBEE team:\n\n• After you sign in, open Support → My Tickets → Create Ticket — our team replies right inside the app.\n${supportEmail ? "• If you can't sign in at all, email us directly and include the email address you registered with." : "• If you can't sign in at all, mention the email you registered with to any ALLBEE team member or use the contact details on your paper work."}\n\nSupport tickets are created from inside your account (we can't accept them from a signed-out screen).`, contactChips());
      return;
    }
    const node = LOGIN_ASSIST_NODES[key];
    if (node) pushAssistant(node.text, node.chips);
  };
  const handleChip = (chip) => {
    setChat((c) => [...c, { id: `laa-${Date.now()}-${seqRef.current++}`, role: "user", text: chip.label }]);
    if (chip.act === "mail") { window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent("Help signing in to the ALLBEE app")}`; return; }
    if (chip.pick) {
      onPick?.(chip.pick);
      const node = LOGIN_ASSIST_NODES[chip.pick];
      pushAssistant(`${node.text}\n\nTip: you can dismiss me anytime with the ✕ button.`, node.chips);
      emitToast(`${chip.pick === "employee" ? "Employee" : chip.pick === "client" ? "Client" : "APN partner"} login form opened below.`, "success");
      return;
    }
    if (chip.go) goNode(chip.go);
  };

  if (!open) return <button className="web-ai-fab" onClick={() => setOpen(true)} aria-label="Open login help — AllBee AI"><LifeBuoy size={18} /><span>Need help signing in?</span></button>;
  return (
    <section className="web-ai-panel" role="dialog" aria-modal="false" aria-label="AllBee AI — access and login assistant">
      <header className="web-ai-head" style={{ position: "relative", paddingRight: 68 }}>
        <div className="web-ai-avatar"><LifeBuoy size={18} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>AllBee AI</div>
          <div style={{ fontSize: 11, opacity: .82 }}>Access &amp; login assistant</div>
        </div>
        <button type="button" className="web-ai-close" onClick={() => setOpen(false)} aria-label="Close AllBee AI" title="Close AllBee AI"><X size={20} strokeWidth={2.5} /></button>
      </header>
      <div className="web-ai-messages" aria-live="polite">
        {chat.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%" }}>
            <div className={`web-ai-bubble ${m.role === "user" ? "user" : "assistant"}`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="web-ai-composer" style={{ flexDirection: "column", alignItems: "stretch", gap: 9 }}>
        <div className="web-ai-quick" style={{ maxHeight: 132, overflowY: "auto" }}>
          {chips.map((chip, i) => <button key={chip.label} className="laa-chip" style={{ animationDelay: `${i * 35}ms` }} onClick={() => handleChip(chip)}>{chip.label}</button>)}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn sm" onClick={startOver}><RotateCcw size={13} />Start over</button>
        </div>
      </div>
    </section>
  );
}

function Lock({ isDark, setDark }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [entry, setEntry] = useState("choose"); // choose | form  (the two-button gate)
  const [loginAs, setLoginAs] = useState("employee"); // employee | client (display hint)
  const [acctType, setAcctType] = useState("staff"); // staff | owner
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");   // staff display name
  const [who, setWho] = useState("Haji"); // owner partner identity
  const [code, setCode] = useState("");   // admin access code
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const recoveryMessage = useMemo(() => {
    if (typeof window === "undefined") return "";
    const raw = `${window.location.search} ${window.location.hash}`.toLowerCase();
    return /otp_expired|access_denied|invalid.*token|expired.*token/.test(raw) ? "This password reset link is invalid or expired. Request a new reset email and use its latest link." : "";
  }, []);
  const referralFromUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const hashQuery = String(window.location.hash || "").split("?")[1] || "";
    return new URLSearchParams(`${window.location.search.replace(/^\?/, "")}${hashQuery ? `&${hashQuery}` : ""}`).get("ref")?.trim().toUpperCase() || "";
  }, []);
  const [apn, setApn] = useState(() => ({ mobile: "", dob: "", district: "", taluk: "", city: "", occupation: "", college: "", reason: "", username: "", referralCode: referralFromUrl }));
  const usernameCheck = useUsernameAvailability(apn.username);
  const emailCheck = useEmailAvailability(email);
  const upApn = (k, v) => setApn((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr(""); setNotice("");
    if (!email.trim() || !pw) { setErr("Enter your username or email and your password to continue."); return; }
    if (mode === "signup") {
      if (emailCheck.available === false) { setErr("That email already has an account. Sign in or use another email."); return; }
      if ((acctType === "staff" || acctType === "client") && !name.trim()) { setErr("Enter your name so we know who you are."); return; }
      if (acctType === "owner" && !code.trim()) { setErr("Enter the admin access code, or sign up as a team member instead."); return; }
      if (acctType === "partner") {
        if (!name.trim()) { setErr("Enter your full name."); return; }
        if (!apn.mobile.trim()) { setErr("Enter your mobile number."); return; }
        if (!apn.district) { setErr("Select your district."); return; }
        if (!apn.dob) { setErr("Enter your date of birth."); return; }
        const bd = new Date(apn.dob); const now = new Date();
        const age = now.getFullYear() - bd.getFullYear() - (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
        if (isNaN(age) || age < 18) { setErr("You must be at least 18 years old to join APN."); return; }
        if (usernameCheck.available === false) { setErr("That username is already taken. Choose another one."); return; }
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const invokePromise = supabase.functions.invoke("username-login", {
          body: { action: "sign_in", identifier: email, password: pw },
          timeout: 15000,
        });
        const { data, error } = await Promise.race([
          invokePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout:invoke")), 15000)),
        ]);
        if (error) {
          const msg = String(error?.message || error || "");
          if (/timeout|abort|fetch/i.test(msg)) throw new Error("Authentication service is not responding. Please wait a moment and try again.");
          throw new Error("Invalid login credentials.");
        }
        if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error("Invalid login credentials.");
        const sessionResult = await Promise.race([
          supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Authentication session setup timed out. Please try again.")), 15000)),
        ]);
        if (sessionResult?.error) throw sessionResult.error;
      } else {
        const meta = acctType === "owner" ? { name: who, admin_code: code.trim() }
          : acctType === "client" ? { name: name.trim(), role_intent: "client" }
          : acctType === "partner" ? { name: name.trim(), role_intent: "partner", apn: { name: name.trim(), mobile: apn.mobile.trim(), dob: apn.dob, district: apn.district, taluk: apn.taluk.trim(), city: apn.city.trim(), occupation: apn.occupation.trim(), college: apn.college.trim(), reason: apn.reason.trim(), username: apn.username.trim().toLowerCase(), referralCode: apn.referralCode.trim().toUpperCase() } }
          : { name: name.trim() };
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pw, options: { data: meta } });
        if (error) throw error;
        if (!data.session) setNotice("Account created. Check your email to confirm it, then sign in.");
      }
    } catch (e) {
      console.error("Auth error:", e);
      const raw = (e && (e.message || e.error_description || e.msg || e.hint || e.details)) || (typeof e === "string" ? e : "");
      const clean = typeof raw === "string" ? raw.trim() : "";
      let msg = clean && clean !== "{}" ? clean : "";
      if (!msg || /database error saving new user/i.test(msg)) {
        msg = acctType === "partner"
          ? "We couldn't create the partner account. Your database may not allow the 'partner' role yet — see the APN setup (profiles.role must permit 'partner'). If it does, this email may already be registered; try another."
          : "We couldn't create the account. Please try again, or use a different email.";
      }
      setErr(msg);
    } finally { setBusy(false); }
  };
  const requestReset = async () => {
    setErr(""); setNotice("");
    if (!email.trim()) { setErr("Enter your email address, username, or APN ID before resetting your password."); return; }
    setResetBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("username-login", { body: { action: "request_reset", identifier: email, redirectTo: `${window.location.origin}${window.location.pathname}` } });
      if (error || data?.error) throw error || new Error(data.error);
      setNotice("Password reset email sent. Check your inbox for the secure reset link.");
      emitToast("Password reset email sent.", "success");
    } catch (e) { setErr(e?.message || "Password reset failed. Please try again."); emitToast("Password reset failed. Please try again.", "error"); }
    finally { setResetBusy(false); }
  };
  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card">
        <FounderTap className="lock-logo" src={LOGO_FULL} alt="ALLBEE Solutions" />
        <p>{mode === "signin" ? (entry === "choose" ? "How would you like to sign in?" : (loginAs === "client" ? "Client sign in" : loginAs === "partner" ? "APN partner sign in" : "Employee sign in")) : "Create your account"}</p>

        {mode === "signin" && entry === "choose" ? (
          <>
            <div className="choose-stack" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6, width: "100%" }}>
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("employee"); setEntry("form"); setErr(""); }}><Users size={18} />Employee Login</button>
              <button className="btn" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("client"); setEntry("form"); setErr(""); }}><Building2 size={18} />Client Login</button>
              <button className="btn" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("partner"); setEntry("form"); setErr(""); }}><GaugeCircle size={18} />APN Partner Login</button>
            </div>
            <button className="linkbtn" onClick={() => { setMode("signup"); setEntry("form"); setAcctType(loginAs === "client" ? "client" : loginAs === "partner" ? "partner" : "staff"); setErr(""); setNotice(""); }}>New here? Create an account</button>
          </>
        ) : (<>
        {mode === "signin" && <button className="linkbtn" style={{ marginBottom: 2, alignSelf: "flex-start" }} onClick={() => { setEntry("choose"); setErr(""); }}><ArrowLeft size={14} />Back</button>}

        {mode === "signup" && (
          <>
            <div className="seg" style={{ width: "100%", marginBottom: 16, flexWrap: "wrap" }}>
              <button type="button" className={acctType === "staff" ? "on" : ""} onClick={() => setAcctType("staff")}>Team member</button>
              <button type="button" className={acctType === "client" ? "on" : ""} onClick={() => setAcctType("client")}>Client</button>
              <button type="button" className={acctType === "partner" ? "on" : ""} onClick={() => setAcctType("partner")}>APN partner</button>
              <button type="button" className={acctType === "owner" ? "on" : ""} onClick={() => setAcctType("owner")}>Owner / admin</button>
            </div>

            {acctType === "partner" ? (
              <div style={{ textAlign: "left" }}>
                <div className="field"><label>Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder="Your full name" /></div>
                <div className="grid2">
                  <div className="field"><label>Mobile number</label><input className="input" value={apn.mobile} onChange={(e) => upApn("mobile", e.target.value)} placeholder="10-digit mobile" /></div>
                  <div className="field"><label>Date of birth</label><input className="input" type="date" value={apn.dob} onChange={(e) => upApn("dob", e.target.value)} /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>District</label><SearchableSelect value={apn.district} onChange={(value) => upApn("district", value)} ariaLabel="APN district" options={[{ value: "", label: "Select district…" }, ...TN_DISTRICTS.map((d) => ({ value: d, label: d }))]} /></div>
                  <div className="field"><label>Taluk</label><input className="input" value={apn.taluk} onChange={(e) => upApn("taluk", e.target.value)} placeholder="Taluk" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>City / town</label><input className="input" value={apn.city} onChange={(e) => upApn("city", e.target.value)} placeholder="City" /></div>
                  <div className="field"><label>Occupation</label><input className="input" value={apn.occupation} onChange={(e) => upApn("occupation", e.target.value)} placeholder="Student, freelancer…" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>College (optional)</label><input className="input" value={apn.college} onChange={(e) => upApn("college", e.target.value)} placeholder="College" /></div>
                  <div className="field"><label>Username</label><input className="input" value={apn.username} onChange={(e) => upApn("username", e.target.value)} placeholder="Choose a username" aria-describedby="signup-username-status" />{apn.username.trim() && <div id="signup-username-status" className="hint-line" style={{ color: usernameCheck.available === false ? "var(--neg)" : usernameCheck.available === true ? "var(--pos)" : undefined }}>{usernameCheck.checking ? "Checking availability…" : usernameCheck.available === false ? "Username already taken" : usernameCheck.available === true ? "Username available" : "Availability will be checked when saved."}</div>}</div>
                </div>
                <div className="field"><label>Referral code <span className="hint-line" style={{ display: "inline" }}>(optional)</span></label><input className="input mono" value={apn.referralCode} onChange={(e) => upApn("referralCode", e.target.value.toUpperCase())} placeholder="Enter a partner's code" />{apn.referralCode && <div className="hint-line">The code is linked once your APN profile is created. You may add one later from My Network.</div>}</div>
                <div className="field"><label>Why do you want to join APN?</label><textarea className="textarea" value={apn.reason} onChange={(e) => upApn("reason", e.target.value)} placeholder="Tell us briefly why you'd like to become a partner…" /></div>
                <p className="hint-line" style={{ fontSize: 12 }}>APN partners are independent and commission-based — no salary and no joining fee. You must be 18 or older. Applications are approved by an admin.</p>
              </div>
            ) : acctType === "staff" || acctType === "client" ? (
              <div className="field" style={{ textAlign: "left" }}>
                <label>Your name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder={acctType === "client" ? "Your name or business" : "e.g. Priya"} />
                {acctType === "client" && <p className="hint-line" style={{ fontSize: 12, marginTop: 6 }}>Client accounts see only their own project updates and quotations.</p>}
              </div>
            ) : (
              <div style={{ textAlign: "left", marginBottom: 4 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>Which partner are you?</label>
                <div className="who-grid" style={{ marginBottom: 12 }}>
                  {USERS.map((u) => (
                    <button key={u} type="button" className="who-btn" onClick={() => setWho(u)}
                      style={who === u ? { borderColor: avatarColor(u), boxShadow: "var(--shadow)" } : undefined}>
                      <div className="av" style={{ background: avatarColor(u), width: 36, height: 36, fontSize: 15 }}>{u[0]}</div>
                      <div className="nm" style={{ fontSize: 14 }}>{u}{who === u ? " ✓" : ""}</div>
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label>Admin access code</label>
                  <input className="input" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} placeholder="Provided by ALLBEE" />
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "left" }}>
          <div className="field">
            <label>{mode === "signin" ? "Username or email" : "Email"}</label>
            <input className="input" type={mode === "signin" ? "text" : "email"} autoComplete={mode === "signin" ? "username" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} placeholder={mode === "signin" ? "username or you@allbee.in" : "you@allbee.in"} />
            {mode === "signup" && email.trim().includes("@") && <div className="hint-line" style={{ color: emailCheck.available === false ? "var(--neg)" : emailCheck.available === true ? "var(--pos)" : undefined }}>{emailCheck.checking ? "Checking email availability…" : emailCheck.available === false ? "Email already registered" : emailCheck.available === true ? "Email available" : ""}</div>}
          </div>
          <PasswordField label="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" />
        </div>

        {(err || recoveryMessage) && <div className="auth-msg err"><AlertTriangle size={14} /> {err || recoveryMessage}</div>}
        {notice && <div className="auth-msg ok"><Check size={14} /> {notice}</div>}

        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={submit} disabled={busy}>
          {busy ? <RefreshCw size={16} className="spin" /> : mode === "signin" ? <LogIn size={16} /> : <Mail size={16} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {mode === "signin" && <button className="linkbtn" onClick={requestReset} disabled={resetBusy}>{resetBusy ? "Sending reset email…" : "Forgot password?"}</button>}

        <button className="linkbtn" onClick={() => { const goSignup = mode === "signin"; setMode(goSignup ? "signup" : "signin"); if (goSignup && loginAs === "partner") setAcctType("partner"); else if (goSignup && loginAs === "client") setAcctType("client"); setEntry("form"); setErr(""); setNotice(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        </>)}

        <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => setDark(!isDark)}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? "Light" : "Dark"} mode
        </button>
      </div>
      <LoginAccessAssistant onPick={(t) => { setLoginAs(t); setMode("signin"); setEntry("form"); setErr(""); setNotice(""); }} />
    </div>
  );
}

function NamePicker({ isDark, onChoose }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>

      <div className="lock-card">
        <FounderTap className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 56 }} />
        <h1>One quick thing</h1>
        <p>Which partner is this account?</p>
        <div className="who-grid">
          {USERS.map((u) => (
            <button key={u} className="who-btn" onClick={() => onChoose(u)}>
              <div className="av" style={{ background: avatarColor(u) }}>{u[0]}</div>
              <div className="nm">{u}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PHASE 2–6 — FORMS
══════════════════════════════════════════════════════════════════════ */
// Shared prompt library — a place to keep the prompts the team reuses and copy
// them in one tap. Backed by the `prompts` table (run allbee-prompts.sql once).
function Prompts({ db, openModal, removeItem }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const all = [...(db.prompts || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean)));
  const list = all.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || (p.title + " " + (p.body || "") + " " + (p.category || "")).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.body || ""); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); } catch { emitToast("Couldn't copy — your browser blocked clipboard access.", "error"); } };
  const del = (p) => removeItem("prompts", p, { name: p.title, audit: `deleted prompt "${p.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Prompts</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "prompt" })}><Plus size={16} />New prompt</button></div>
      <p className="hint-line" style={{ marginTop: -8, marginBottom: 14 }}>A shared library of the prompts your team reuses — briefs, email templates, AI prompts. Add one, then copy it whenever you need it.</p>
      <div className="filterbar">
        <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" /></Field>
        {cats.length > 0 && <Field label="Category"><select className="select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={<Sparkles size={22} color="var(--muted)" />} title="No prompts yet" text="Add the prompts your team uses most and copy them in one tap." action={<button className="btn primary" onClick={() => openModal({ type: "prompt" })}><Plus size={16} />New prompt</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{list.map((p) => (
          <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.category && <span className="tag">{p.category}</span>}
            </div>
            <div className="hint-line" style={{ whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden", fontSize: 13, lineHeight: 1.5 }}>{p.body}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button className="btn sm primary" onClick={() => copy(p)}>{copiedId === p.id ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}</button>
              <button className="btn sm" onClick={() => openModal({ type: "prompt", initial: p })}><Pencil size={13} /></button>
              <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete prompt?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

// Google Sheets (and any spreadsheet) link library — one tidy place for all the
// team's workbook links. Backed by the `sheets` table (run allbee-sheets.sql).
function SelectOther({ value, onChange, options, placeholder = "Type here…" }) {
  const [custom, setCustom] = useState(() => !!value && !options.includes(value));
  const onSel = (e) => {
    if (e.target.value === "__other__") { setCustom(true); onChange(""); }
    else { setCustom(false); onChange(e.target.value); }
  };
  return (
    <>
      <select className="select" value={custom ? "__other__" : value} onChange={onSel}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other__">Other… (type manually)</option>
      </select>
      {custom && <input className="input" style={{ marginTop: 8 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus />}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PHASE 2–6 — SCREENS
══════════════════════════════════════════════════════════════════════ */
function LoadMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  return <div style={{ textAlign: "center", padding: "14px 0" }}><button className="btn" onClick={onMore}>Show more ({total - shown} more)</button></div>;
}

function RequirementBuilder({ isAdmin }) {
  const tabs = [["questions", "Question library"], ["rules", "Conditional rules"], ["analytics", "Completion analytics"]];
  const [tab, setTab] = useState("questions");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page_size: 25 });
  const [summary, setSummary] = useState(null);
  const [editor, setEditor] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true); setError("");
    try { const [{ data: list, error: listError }, { data: counts, error: summaryError }] = await Promise.all([supabase.rpc("web_requirement_admin_list", { p_entity: tab, p_search: query, p_page: 1, p_page_size: 50 }), supabase.rpc("web_requirement_admin_summary")]); if (listError) throw new Error(listError.message); if (summaryError) throw new Error(summaryError.message); setData(list || { items: [], total: 0, page_size: 50 }); setSummary(counts || {}); }
    catch (e) { setError(e.message || "Requirement builder could not load."); }
    finally { setBusy(false); }
  }, [isAdmin, query, tab]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const channel = supabase.channel("web-requirement-builder").on("postgres_changes", { event: "*", schema: "public", table: "web_requirement_questions" }, load).on("postgres_changes", { event: "*", schema: "public", table: "web_requirement_question_rules" }, load).subscribe(); return () => { supabase.removeChannel(channel); }; }, [load]);
  const save = async () => { let payload; try { payload = JSON.parse(text); } catch { setError("Enter valid JSON."); return; } setBusy(true); try { const { error: saveError } = await supabase.rpc("web_requirement_admin_save", { p_entity: tab === "questions" ? "questions" : "rules", p_payload: payload }); if (saveError) throw new Error(saveError.message); setEditor(null); await load(); emitToast("Requirement builder record saved.", "success"); } catch (e) { setError(e.message || "Could not save the requirement builder record."); } finally { setBusy(false); } };
  if (!isAdmin) return <div className="content"><div className="card"><Empty icon={<ShieldAlert size={22} />} title="Admin access required" text="Requirement Builder is restricted to administrators." /></div></div>;
  return <div className="content"><div className="page-head"><div><h3><MessageCircle size={18} style={{ verticalAlign: -3, marginRight: 7, color: "var(--primary)" }} />Requirement Builder</h3><div className="hint-line">Configure adaptive questions and rules without changing the conversation engine.</div></div><span className="spacer" /><button className="btn" onClick={load} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} />Refresh</button>{tab !== "analytics" && <button className="btn primary" onClick={() => { setEditor({}); setText(JSON.stringify(tab === "questions" ? { prompt: "", question_key: "", question_type: "text", choices: [], active: true, sort_order: 0 } : { question_id: "", condition_key: "service", operator: "equals", condition_value: "", action: "show", active: true }, null, 2)); }}><Plus size={15} />Add</button>}</div>{error && <div className="auth-msg err" role="alert"><AlertTriangle size={15} />{error}</div>}<div className="ai-health-grid" style={{ marginBottom: 14 }}>{[["Sessions",summary?.sessions],["Active",summary?.active],["Completed",summary?.completed],["Abandoned",summary?.abandoned],["Average completion",`${summary?.average_completion || 0}%`]].map(([label,value]) => <div className="card stat" key={label}><div className="lbl"><Activity size={14} />{label}</div><div className="num mono">{value ?? "—"}</div></div>)}</div><div className="seg" style={{ marginBottom: 12 }}>{tabs.map(([key,label]) => <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>)}</div><div className="toolbar"><div className="search"><Search size={16} color="var(--muted)" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions, rules, or events…" aria-label="Search requirement builder" /></div></div><div className="card">{data.items?.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>Record</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id}><td><b>{row.prompt || row.question_slug || row.event || "Record"}</b><div className="hint-line mono">{row.slug || row.id}</div></td><td>{row.condition_key ? `${row.condition_key} ${row.operator} ${row.condition_value}` : row.completion_percent != null ? `${row.completion_percent}% · ${row.service_slug || "—"}` : row.question_type || "—"}</td><td><span className={`badge ${row.active === false ? "neg" : "pos"}`}>{row.active === false ? "Disabled" : "Active"}</span></td><td>{tab !== "analytics" && <button className="btn sm" onClick={() => { setEditor(row); setText(JSON.stringify(row, null, 2)); }}><Pencil size={13} />Edit</button>}</td></tr>)}</tbody></table></div> : <Empty icon={<MessageCircle size={22} />} title="No records" text="Add a configurable question or rule, or wait for conversations to generate analytics." />}</div>{editor && <Modal title={`Edit ${tab === "questions" ? "question" : "rule"}`} onClose={() => setEditor(null)} footer={<><button className="btn" onClick={() => setEditor(null)}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}><Check size={15} />Save</button></>}><p className="hint-line">Changes are applied transactionally, audited, and picked up by active conversations on their next response.</p><textarea className="textarea mono" style={{ minHeight: 300, fontSize: 12 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Requirement builder JSON" /></Modal>}</div>;
}
function ProposalPortal({ token, isDark }) {
  const [detail, setDetail] = useState(null); const [comment, setComment] = useState(""); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [signature, setSignature] = useState(""); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setBusy(true); setError(""); try { const { data, error: rpcError } = await supabase.rpc("proposal_public_get", { p_token: token }); if (rpcError) throw new Error(rpcError.message); setDetail(data); } catch (e) { setError(e.message || "This proposal link is invalid or expired."); } finally { setBusy(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const act = async (action) => { setBusy(true); setError(""); try { const { data, error: rpcError } = await supabase.rpc("proposal_public_action", { p_token: token, p_action: action, p_comment: comment, p_signer_name: name, p_signer_email: email, p_signature: signature }); if (rpcError) throw new Error(rpcError.message); setDetail(data); setComment(""); emitToast(`Proposal ${action.replace(/_/g, " ")}.`, "success"); } catch (e) { setError(e.message || "The proposal action could not be completed."); } finally { setBusy(false); } };
  const p = detail?.proposal;
    return <div className="allbee" data-theme={isDark ? "dark" : "light"}><ToastHost /><main className="portal-shell" style={{ maxWidth: 980, margin: "0 auto", padding: "28px 18px 60px" }}>{busy && !detail ? <div className="card" aria-busy="true"><div className="skeleton skeleton-line" style={{ width: "42%" }} /><div className="skeleton" style={{ height: 180, marginTop: 14 }} /></div> : error ? <div className="card"><Empty icon={<AlertTriangle size={22} />} title="Proposal unavailable" text={error} /></div> : <><div className="page-head"><div><div className="hint-line">ALLBEE SOLUTIONS · Enterprise proposal</div><h1 style={{ margin: "5px 0" }}>{p?.proposal_title}</h1><div className="hint-line">{p?.proposal_number} · Version {p?.current_version || 1} · Prepared for {p?.customer_name}</div></div><button className="btn" onClick={() => printProposalDocument(detail)}><Download size={14} />Print / PDF</button></div><div className="card proposal-portal-summary"><div><span className="hint-line">Proposal value</span><strong className="mono">{money(p?.grand_total || 0)}</strong></div><div><span className="hint-line">Pricing</span><strong>{p?.pricing_mode || "estimated"}</strong></div><div><span className="hint-line">Status</span><strong>{p?.status}</strong></div></div><div className="card proposal-portal-sections">{(detail?.sections || []).filter((s) => s.enabled !== false).map((section) => <section key={section.id}><h2>{section.name}</h2><p style={{ whiteSpace: "pre-wrap" }}>{proposalSectionDisplay(section) || "—"}</p></section>)}</div>{!["converted", "approved", "rejected"].includes(p?.status) && <div className="card"><h3>Respond to this proposal</h3><div className="grid2"><Field label="Your name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div><Field label="Comment or question"><textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ask a question or request a change…" /></Field><Field label="Signature for approval" hint="Type your name or approved signature text."><input className="input" value={signature} onChange={(e) => setSignature(e.target.value)} /></Field><div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 12 }}><button className="btn" onClick={() => act("question")} disabled={busy || !comment.trim()}><MessageCircle size={14} />Ask question</button><button className="btn" onClick={() => act("revision_requested")} disabled={busy}><RefreshCw size={14} />Request revision</button><button className="btn danger" onClick={() => act("rejected")} disabled={busy}>Reject</button><button className="btn primary" onClick={() => act("approved")} disabled={busy || !name.trim() || !signature.trim()}><CheckCircle2 size={14} />Approve proposal</button></div></div>}</>}</main></div>;
}


function Leads({ db, mutate, openModal, removeItem, isAdmin }) {
  const [stage, setStage] = useState("All");
  const [n, setN] = useState(25);
  const all = [...db.leads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = stage === "All" ? all : all.filter((l) => l.stage === stage);
  const setLeadStage = (l, s) => mutate((d) => ({ ...d, leads: d.leads.map((x) => x.id === l.id ? { ...x, stage: s } : x) }), { action: `moved lead "${l.name}" to ${s}`, module: "Leads" });
  const convert = (l) => openModal({ type: "client", initial: { name: l.name, phone: l.phone, email: l.email, notes: l.notes }, fromLead: l.id });
  const del = (l) => removeItem("leads", l, { name: l.name, audit: `deleted lead "${l.name}"` });
  const tone = (s) => s === "Converted" ? "pos" : s === "Lost" ? "neg" : s === "Proposal Sent" ? "accent" : "pri";
  return (
    <div className="content">
      <div className="page-head"><h3>Leads</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "lead" })}><Plus size={16} />New lead</button></div>
      <div className="toolbar"><div className="seg">{["All", ...LEAD_STAGES].map((s) => <button key={s} className={stage === s ? "on" : ""} onClick={() => { setStage(s); setN(25); }}>{s}</button>)}</div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No leads here" text="Capture every enquiry and move it from New all the way to Won." action={<button className="btn primary" onClick={() => openModal({ type: "lead" })}><Plus size={16} />New lead</button>} />
          : list.slice(0, n).map((l) => (
            <div key={l.id} className="item-row">
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span className="item-title">{l.name}</span>
                  <span className={"badge " + tone(l.stage)}>{l.stage}</span>
                  {l.value > 0 && <span className="badge">{money(l.value)}</span>}
                </div>
                <div className="item-meta">{l.source && <span><Tag size={12} style={{ verticalAlign: -2 }} /> {l.source}</span>}{l.phone && <span><Phone size={12} style={{ verticalAlign: -2 }} /> {l.phone}</span>}{l.email && <span>{l.email}</span>}</div>
              </div>
              <div className="row-actions" style={{ alignItems: "center" }}>
                <select className="select" style={{ width: "auto", padding: "5px 8px" }} value={l.stage} onChange={(e) => setLeadStage(l, e.target.value)}>{LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
                {l.stage === "Converted" && <button className="btn sm primary" onClick={() => convert(l)}><ArrowRight size={13} />Client</button>}
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "lead", initial: l })}><Pencil size={14} /></button>
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete lead?", body: `Delete "${l.name}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(l) })}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        <LoadMore shown={Math.min(n, list.length)} total={list.length} onMore={() => setN((x) => x + 25)} />
      </div>
    </div>
  );
}

function Planned({ db, mutate, openModal, removeItem, openIncome, canFinance }) {
  const list = [...db.planned].sort((a, b) => (a.nextDue || "").localeCompare(b.nextDue || ""));
  const del = (p) => removeItem("planned", p, { name: p.title, audit: `deleted planned expense "${p.title}"` });
  const monthlyTotal = list.filter((p) => p.recurrence === "Monthly").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const dueTone = (p) => { if (!p.nextDue) return "muted"; const today = todayISO(); return p.nextDue < today ? "neg" : p.nextDue <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) ? "accent" : "muted"; };
  const recordPaid = (p) => {
    openIncome({ kind: "expense", category: p.category, amount: p.amount, notes: p.title, source: { kind: "planned", id: p.id } });
  };
  return (
    <div className="content">
      <div className="page-head"><h3>Planned & recurring expenses</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "planned" })}><Plus size={16} />New</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><CalendarClock size={14} /> Recurring monthly</div><div className="v mono">{money(monthlyTotal)}</div></div>
        <div className="card"><div className="k"><Banknote size={14} /> Items tracked</div><div className="v mono">{list.length}</div></div>
      </div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<CalendarClock size={22} color="var(--muted)" />} title="Nothing planned yet" text="Track rent, subscriptions and other regular costs, and log them as expenses when paid." action={<button className="btn primary" onClick={() => openModal({ type: "planned" })}><Plus size={16} />New planned expense</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Expense</th><th>Repeats</th><th>Next due</th><th className="num-cell">Amount</th><th></th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{p.title}{p.status && <span className={"badge " + (p.status === "Purchased" ? "pos" : p.status === "Cancelled" ? "neg" : p.status === "Approved" ? "accent" : "pri")} style={{ fontSize: 10 }}>{p.status}</span>}</div><div className="hint-line" style={{ fontSize: 11 }}>{p.category}</div></td>
                <td>{p.recurrence}</td>
                <td><span className={"badge " + dueTone(p)}>{p.nextDue ? fmtDate(p.nextDue) : "—"}</span></td>
                <td className="num-cell mono">{money(p.amount)}</td>
                <td><div className="row-actions">
                  <select className="select" style={{ width: "auto", padding: "4px 6px" }} value={p.status || "Planned"} onChange={(e) => mutate((d) => ({ ...d, planned: d.planned.map((x) => x.id === p.id ? { ...x, status: e.target.value } : x) }), { action: `set planned "${p.title}" to ${e.target.value}`, module: "Planned expenses" })}>{PLANNED_STATUS.map((x) => <option key={x}>{x}</option>)}</select>
                  {canFinance && <button className="btn sm primary" onClick={() => recordPaid(p)}>Log expense</button>}
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "planned", initial: p })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

function Announcements({ db, mutate, openModal, removeItem, isAdmin, me }) {
  const list = [...db.announcements].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (a) => removeItem("announcements", a, { name: a.title, audit: `deleted announcement "${a.title}"` });
  const ack = (a) => { haptic(10); mutate((d) => ({ ...d, announcements: d.announcements.map((x) => x.id === a.id ? { ...x, acks: Array.from(new Set([...(x.acks || []), me.id])) } : x) }), null); };
  return (
    <div className="content">
      <div className="page-head"><h3>Announcements</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "announcement" })}><Plus size={16} />New announcement</button>}</div>
      {list.length === 0 ? <div className="card"><Empty icon={<MegaphoneIcon size={22} color="var(--muted)" />} title="Nothing announced yet" text={isAdmin ? "Post company-wide news here — everyone sees it and gets a bell." : "Company news from your admins will show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "announcement" })}><Plus size={16} />New announcement</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{list.map((a) => (
          <div key={a.id} className="card stat">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{a.title}</div>
                {a.body && <div style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.body}</div>}
                <div className="item-meta" style={{ marginTop: 8 }}><span>{a.by || "Admin"}</span><span>{fmtDateTime(a.createdAt)}</span>{isAdmin && <span><BadgeCheck size={12} style={{ verticalAlign: -2 }} /> {(a.acks || []).length} acknowledged</span>}</div>
                {a.meetingLink && <div style={{ marginTop: 8 }}><a className="btn sm primary" href={a.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
                {!isAdmin && ((a.acks || []).includes(me.id)
                  ? <div className="hint-line" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pos)" }}><BadgeCheck size={13} />You acknowledged this</div>
                  : <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => ack(a)}><Check size={13} />Acknowledge</button></div>)}
              </div>
              {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "announcement", initial: a })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete announcement?", body: `Delete "${a.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(a) })}><Trash2 size={14} /></button></div>}
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

function Chat({ db, mutate, me, team, onRefresh, isAdmin }) {
  const [chatChannel, setChatChannel] = useState("employee");
  const [apnUnread, setApnUnread] = useState(0);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const list = [...db.chat].filter((m) => !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [list.length]);
  // Realtime can lag on mobile/background tabs — gently re-pull while the chat is
  // open so new messages show up without a manual refresh.
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") onRefresh(); }, 12000);
    return () => clearInterval(t);
  }, [onRefresh]);
  const refresh = async () => { if (!onRefresh) return; setRefreshing(true); try { await onRefresh(); } finally { setTimeout(() => setRefreshing(false), 400); } };
  // Read receipts: mark messages from others as seen by me (converges once all seen).
  useEffect(() => {
    const unseen = db.chat.filter((m) => m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id));
    if (!unseen.length) return;
    const ids = new Set(unseen.map((m) => m.id));
    mutate((d) => ({ ...d, chat: d.chat.map((m) => ids.has(m.id) ? { ...m, seenBy: Array.from(new Set([...(m.seenBy || []), me.id])) } : m) }), null);
  }, [db.chat, me.id, mutate]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    setText("");
    mutate((d) => ({ ...d, chat: [...d.chat, { id: uid(), userId: me.id, userName: me.name, text: t, createdAt: Date.now() }] }), null);
  };
  const attach = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try { const up = await uploadAttachment(file); mutate((d) => ({ ...d, chat: [...d.chat, { id: uid(), userId: me.id, userName: me.name, text: "", attachment: up, createdAt: Date.now() }] }), null); }
    catch (er) { emitToast(er.message || "Upload failed.", "error"); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const onlineCount = (team || []).filter((p) => p.id !== me.id && isOnline(p)).length;
  const startEdit = (m) => { setEditId(m.id); setEditText(m.text); };
  const saveEdit = (m) => { const t = editText.trim(); if (!t) { setEditId(null); return; } mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === m.id ? { ...x, text: t, editedAt: Date.now() } : x) }), null); setEditId(null); setEditText(""); };
  // Delete = tombstone (keeps message order, works under existing chat RLS).
  // Admins can delete anyone's; everyone else only their own.
  const del = (m) => setConfirmDelete(m);
  const deleteNow = () => { if (!confirmDelete) return; mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === confirmDelete.id ? { ...x, deleted: true, text: "", attachment: null, deletedBy: me.name } : x) }), null); setConfirmDelete(null); };
  // Names of teammates who've seen one of my messages.
  const seenNames = (m) => (m.seenBy || []).filter((u) => u !== me.id).map((u) => ((team || []).find((p) => p.id === u)?.name) || "Someone").filter(Boolean);
  const employeeView = (<>
    <div className="content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
      <div className="page-head"><h3>Team chat</h3><span className="spacer" />{onlineCount > 0 && <span className="hint-line" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 10 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pos)", display: "inline-block" }} />{onlineCount} online</span>}<button className="btn sm" onClick={refresh} disabled={refreshing} title="Refresh messages"><RefreshCw size={14} className={refreshing ? "spin" : ""} />Refresh</button></div>
      <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? <Empty icon={<Send size={22} color="var(--muted)" />} title="Say hello 👋" text="This channel is shared with the whole internal team." />
          : list.map((m) => {
            const mine = m.userId === me.id;
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <div style={{ position: "relative", flex: "none" }}><Avatar name={m.userName} url={(team || []).find((p) => p.id === m.userId)?.photo_url} size={30} />{isOnline((team || []).find((p) => p.id === m.userId)) && <span title="Online" style={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", background: "var(--pos)", border: "2px solid var(--surface, #fff)" }} />}</div>
                <div style={{ maxWidth: "72%" }}>
                  {editId === m.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <textarea className="textarea" style={{ minHeight: 44 }} value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(m); } }} autoFocus />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button className="btn sm" onClick={() => { setEditId(null); setEditText(""); }}>Cancel</button><button className="btn sm primary" onClick={() => saveEdit(m)}><Check size={13} />Save</button></div>
                    </div>
                  ) : m.deleted ? (
                    <div style={{ background: "var(--surface-2)", color: "var(--muted)", padding: "9px 13px", borderRadius: 12, fontSize: 13, fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: 6 }}><X size={13} />This message was deleted</div>
                  ) : (
                    <div style={{ background: mine ? "var(--primary)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", padding: "9px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}{m.attachment && ((m.attachment.type || "").startsWith("image/")
                      ? <a href={m.attachment.url} target="_blank" rel="noreferrer"><img src={m.attachment.url} alt={m.attachment.name || ""} style={{ display: "block", maxWidth: 220, maxHeight: 220, borderRadius: 8, marginTop: m.text ? 8 : 0 }} /></a>
                      : <a href={m.attachment.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: m.text ? 8 : 0, color: mine ? "#fff" : "var(--primary)", textDecoration: "underline" }}><Paperclip size={13} />{m.attachment.name || "Attachment"}</a>)}</div>
                  )}
                  {!m.deleted && <div className="hint-line" style={{ fontSize: 11, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.userName} · {fmtDateTime(m.createdAt)}{m.editedAt ? " · edited" : ""}{mine && seenNames(m).length > 0 ? " · Seen by " + (seenNames(m).length <= 2 ? seenNames(m).join(", ") : `${seenNames(m).slice(0, 2).join(", ")} +${seenNames(m).length - 2}`) : ""}{mine && editId !== m.id && withinMinutes(m.createdAt, 5) && <button onClick={() => startEdit(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Edit</button>}{mine && editId !== m.id && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}{!mine && isAdmin && editId !== m.id && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}</div>}
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginTop: 12 }}>
        <textarea className="textarea" style={{ minHeight: 44 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message the team… (Enter to send)" />
        <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a file">{busy ? <RefreshCw size={16} className="spin" /> : <Paperclip size={16} />}</button>
        <input ref={fileRef} type="file" onChange={attach} style={{ display: "none" }} />
        <button className="btn primary" onClick={send} disabled={!text.trim()}><Send size={16} />Send</button>
      </div>
    </div>
    {confirmDelete && <Confirm title="Delete message?" body={`Delete ${confirmDelete.userId === me.id ? "your message" : `${confirmDelete.userName}'s message`} for everyone?`} onConfirm={deleteNow} onClose={() => setConfirmDelete(null)} />}
    </>
  );

  return (<>{isAdmin && <div className="content" style={{ paddingBottom: 10 }}>
    <div className="seg" style={{ maxWidth: 430 }}>
      <button className={chatChannel === "employee" ? "on" : ""} onClick={() => setChatChannel("employee")}>Employee</button>
      <button className={chatChannel === "apn" ? "on" : ""} onClick={() => setChatChannel("apn")}>APN{apnUnread > 0 && <span className="badge action-badge" style={{ marginLeft: 6 }}>{apnUnread > 99 ? "99+" : apnUnread}</span>}</button>
    </div>
  </div>}
  {isAdmin && chatChannel === "apn" ? <AdminAPNChat me={me} onUnreadChange={setApnUnread} /> : employeeView}</>);
}

export function AdminAPNChat({ me, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const mounted = useRef(true);
  const scrollRef = useRef(null);
  const openRequestRef = useRef(0);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [cv, ct] = await Promise.all([
        supabase.rpc("apn_list_conversations"),
        supabase.rpc("apn_list_chat_contacts")
      ]);
      if (cv.error) throw new Error(cv.error.message);
      if (!mounted.current) return;
      setConversations(cv.data || []);
      if (!ct.error) setContacts(ct.data || []);
      const unread = (cv.data || []).reduce((n, c) => n + Number(c.unread_count || 0), 0);
      onUnreadChange?.(unread);
    } catch (e) {
      if (mounted.current) setErr(e.message || "Could not load APN chats.");
    } finally { if (mounted.current) setLoading(false); }
  }, [onUnreadChange]);

  const open = useCallback(async (conv) => {
    const requestId = ++openRequestRef.current;
    setSelected(conv); setErr("");
    const { data, error } = await supabase.rpc("apn_list_messages", { p_conversation_id: conv.conversation_id || conv.id });
    if (error) { if (requestId === openRequestRef.current) setErr(error.message); return; }
    if (!mounted.current || requestId !== openRequestRef.current) return;
    const rows = data || [];
    setMessages(rows);
    const last = rows[rows.length - 1];
    if (last) await supabase.rpc("apn_admin_mark_read", { p_conversation_id: conv.conversation_id || conv.id, p_message_id: last.id });
    await load(true);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }, [load]);

  useEffect(() => { load(); }, [load]);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    const ch = supabase.channel(`admin-apn-team-chat:${me.id}`);
    let timerId = null;
    let inFlight = null;
    let queued = false;
    const refreshChat = () => {
      queued = true;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued) return;
        queued = false;
        inFlight = load(true).then(async () => {
          const current = selectedRef.current;
          if (current) await open(current);
        }).catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat();
        });
      }, 120);
    };
    ch.on("postgres_changes", { event: "*", schema: "public", table: "apn_chat_messages" }, refreshChat).subscribe();
    const timer = setInterval(refreshChat, 10000);
    return () => {
      clearInterval(timer);
      if (timerId) clearTimeout(timerId);
      queued = false;
      supabase.removeChannel(ch);
    };
  }, [load, open, me.id]);

  const send = async () => {
    const body = text.trim(); if (!body || !selected) return;
    setText(""); setErr("");
    const { error } = await supabase.rpc("apn_admin_send_message", { p_conversation_id: selected.conversation_id || selected.id, p_body: body });
    if (error) { setText(body); setErr(error.message); return; }
    await open(selected);
  };

  const startPartnerChat = async (contact) => {
    const apnId = contact?.apn_id;
    if (!apnId) return;
    const { data, error } = await supabase.rpc("apn_admin_open_partner_chat", { p_partner_apn_id: apnId });
    if (error) { setErr(error.message); return; }
    if (data?.[0]) await open({ conversation_id: data[0].conversation_id, conv_type: "person", subject: data[0].subject, participant_apn_id: apnId });
  };

  const filtered = conversations.filter((c) => filter === "all" || c.conv_type === filter)
    .filter((c) => `${c.subject || ""} ${c.last_message || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  const partners = contacts.filter((c) => c.contact_type === "partner").filter((c) => `${c.name} ${c.apn_id} ${c.district || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  const unread = conversations.reduce((n, c) => n + Number(c.unread_count || 0), 0);

  return (
    <div className="content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
      <div className="page-head"><h3>APN chat</h3><span className="spacer" />{unread > 0 && <span className="badge action-badge" style={{ marginRight: 8 }}>{unread > 99 ? "99+" : unread} new</span>}<button className="btn sm" onClick={() => load()}><RefreshCw size={14} />Refresh</button></div>
      {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} />{err}</div>}
      <div className={`card apn-admin-chat-shell${selected ? " has-selection" : ""}`} style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: selected ? "330px 1fr" : "1fr", overflow: "hidden" }}>
        <aside style={{ overflowY: "auto", padding: 12, borderRight: selected ? "1px solid var(--border)" : "none" }}>
          <div className="seg" style={{ marginBottom: 10 }}>
            {[['all','All'],['person','Partner chats'],['district','District'],['state','State']].map(([k,l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search APN chats or partners…" />
          {loading && <div className="hint-line" style={{ padding: 10 }}>Loading APN chats…</div>}
          {filtered.map(c => <button key={c.conversation_id} className="apn-tc-recent-row" style={{ width: "100%", marginTop: 6 }} onClick={() => open(c)}>
            <div className="apn-tc-recent-avatar"><MessageCircle size={15} /></div><div className="apn-tc-recent-copy"><b>{c.subject || "APN chat"}</b><span>{c.last_message || "No messages yet"}</span></div>{Number(c.unread_count || 0) > 0 && <span className="apn-tc-unread">{c.unread_count}</span>}
          </button>)}
          {!loading && filtered.length === 0 && <div className="hint-line" style={{ padding: 10 }}>No APN conversations found.</div>}
          <div className="apn-tc-card" style={{ marginTop: 12 }}><div className="apn-tc-card-title">Start partner chat</div>
            {partners.slice(0, 12).map(c => <div key={c.contact_id} className="apn-tc-partner-row"><Avatar name={c.name} url={c.photo_url} size={32} fontSize={11}/><div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{c.name}</div><div className="apn-tc-partner-location">{c.apn_id || "APN partner"}{c.district ? ` · ${c.district}` : ""}</div></div><button className="btn sm" onClick={() => startPartnerChat(c)}>Chat</button></div>)}
          </div>
        </aside>
        {selected ? <main className="apn-tc-chat" ref={scrollRef}>
          <div className="apn-tc-chathead"><button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }}><ArrowLeft size={17}/></button><div style={{fontWeight:700,flex:1}}>{selected.subject || "APN chat"}<div className="apn-tc-presence">{selected.conv_type === "person" ? "Partner conversation" : `${selected.conv_type || "APN"} conversation`}</div></div></div>
          <div className="apn-tc-messages">
            {messages.map(m => { const mine = String(m.sender_id) === String(me.id); return <div key={m.id} className={`apn-tc-msg ${mine ? "mine" : "theirs"}`}><div className="apn-tc-bubble-wrap"><div className="apn-tc-bubble"><div className="apn-tc-text">{m.body}</div><div className="apn-tc-time">{m.created_at ? fmtDateTime(new Date(m.created_at)) : ""}</div></div></div></div>; })}
            {messages.length === 0 && <Empty icon={<MessageSquare size={20}/>} title="No messages yet" text="Send the first message."/>}
          </div>
          <div className="apn-tc-compose"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Message the APN partner…" rows={2} maxLength={2000} onKeyDown={e => { if(e.key === "Enter" && !e.shiftKey){e.preventDefault();send();} }}/><button className="btn primary" onClick={send} disabled={!text.trim()}>Send</button></div>
        </main> : <div className="apn-tc-main-empty"><div><MessageSquare size={30} color="var(--muted)"/><div className="apn-tc-main-title">APN conversations</div><div className="hint-line">Select a partner conversation, district chat, or state chat.</div></div></div>}
      </div>
    </div>
  );
}


function Performance({ db, team }) {
  const month = new Date();
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role) && p.active !== false);
  const rows = staff.map((p) => {
    const done = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status === "Completed").length;
    const open = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status !== "Completed").length;
    const myLeads = db.leads.filter((l) => l.ownerId === p.id || l.leadOwner === p.name);
    const leadsGen = myLeads.length;
    const leadsWon = myLeads.filter((l) => l.stage === "Converted").length;
    const hours = round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month))));
    const updateDays = new Set(db.updates.filter((u) => u.userId === p.id && sameMonth(u.date, month)).map((u) => u.date)).size;
    const points = db.rewards.filter((r) => r.userId === p.id).reduce((s, r) => s + (Number(r.points) || 0), 0);
    const score = done * 10 + leadsWon * 15 + Math.round(hours) + updateDays * 3 + points;
    return { p, done, open, leadsGen, leadsWon, hours, updateDays, points, score };
  }).sort((a, b) => b.score - a.score);
  const medal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
  return (
    <div className="content">
      <div className="page-head"><h3>Performance</h3></div>
      <div className="sumrow" style={{ marginBottom: 14 }}>
        <div className="card"><div className="k"><TrendingUp size={14} /> Revenue this month</div><div className="v mono">{money(db.transactions.filter((t) => t.kind === "income" && sameMonth(t.date, month)).reduce((s, t) => s + (Number(t.amount) || 0), 0))}</div></div>
        <div className="card"><div className="k"><UserPlus size={14} /> Leads this month</div><div className="v mono">{db.leads.filter((l) => sameMonth(new Date(l.createdAt || 0).toISOString().slice(0, 10), month)).length}</div></div>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty icon={<TrendingUp size={22} color="var(--muted)" />} title="No team data yet" text="As people complete tasks, check in and earn recognition, the leaderboard fills up." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>#</th><th>Member</th><th className="num-cell">Tasks</th><th className="num-cell">Leads</th><th className="num-cell">Won</th><th className="num-cell">Hours</th><th className="num-cell">Updates</th><th className="num-cell">Points</th><th className="num-cell">Score</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.p.id}>
                <td style={{ fontSize: 16 }}>{medal(i)}</td>
                <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(r.p.name), width: 26, height: 26, fontSize: 11 }}>{r.p.name[0]}</span><span><div style={{ fontWeight: 600 }}>{r.p.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[r.p.role]}</div></span></span></td>
                <td className="num-cell mono">{r.done}</td><td className="num-cell mono">{r.leadsGen}</td><td className="num-cell mono">{r.leadsWon}</td><td className="num-cell mono">{r.hours}</td><td className="num-cell mono">{r.updateDays}</td><td className="num-cell mono">{r.points}</td>
                <td className="num-cell mono" style={{ fontWeight: 700 }}>{r.score}</td>
              </tr>
            ))}</tbody>
          </table></div>}
        <div className="hint-line" style={{ padding: "12px 16px" }}>Score = tasks completed ×10 + days present this month ×2 + recognition points.</div>
      </div>
    </div>
  );
}

function Rewards({ db, mutate, openModal, removeItem, me, isAdmin, team }) {
  const all = [...db.rewards].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((r) => r.userId === me.id);
  const del = (r) => removeItem("rewards", r, { name: r.userName, audit: `removed recognition for ${r.userName}` });
  const myPoints = db.rewards.filter((r) => r.userId === me.id).reduce((s, r) => s + (Number(r.points) || 0), 0);

  // Suggested recognition this month — computed from real activity so admins can
  // award the obvious wins in one tap (PRD: top lead generator / best attendance /
  // project closer). Each leader, only when there's a clear non-zero standout.
  const month = new Date();
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role) && p.active !== false);
  const lead = (metric) => { let best = null; for (const p of staff) { const v = metric(p); if (v > 0 && (!best || v > best.v)) best = { p, v }; } return best; };
  const leadGen = lead((p) => db.leads.filter((l) => (l.ownerId === p.id || l.leadOwner === p.name) && l.stage === "Converted" && sameMonth(new Date(l.createdAt || 0).toISOString().slice(0, 10), month)).length);
  const attend = lead((p) => round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month)))));
  const closer = lead((p) => db.projects.filter((pr) => pr.stage === "Completed" && (pr.ownerName === p.name || pr.createdById === p.id)).length);
  const nominees = [
    leadGen && { p: leadGen.p, kind: "Goal smashed", points: 20, note: `Top lead generator — ${leadGen.v} converted this month`, badge: "Top lead generator", icon: <UserPlus size={13} /> },
    attend && { p: attend.p, kind: "On-time hero", points: 15, note: `Best attendance — ${attend.v}h this month`, badge: "Best attendance", icon: <Clock size={13} /> },
    closer && { p: closer.p, kind: "Star performer", points: 20, note: `Project closer — ${closer.v} completed`, badge: "Project closer", icon: <FolderKanban size={13} /> },
  ].filter(Boolean);
  const recognize = (n) => openModal({ type: "reward", initial: { userId: n.p.id, kind: n.kind, points: n.points, note: n.note, date: todayISO() } });

  return (
    <div className="content">
      <div className="page-head"><h3>Recognition & rewards</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "reward" })}><Award size={16} />Give recognition</button>}</div>
      {!isAdmin && <div className="sumrow"><div className="card"><div className="k"><Star size={14} /> Your points</div><div className="v mono">{myPoints}</div></div></div>}
      {isAdmin && nominees.length > 0 && (
        <div className="card stat" style={{ marginBottom: 14 }}>
          <div className="lbl" style={{ fontWeight: 700, color: "var(--ink)" }}><Award size={14} /> Suggested recognition this month</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {nominees.map((n) => (
              <div key={n.badge} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="avatar" style={{ background: avatarColor(n.p.name), width: 28, height: 28, fontSize: 11 }}>{n.p.name[0]}</span>
                <span style={{ fontWeight: 600 }}>{n.p.name}</span>
                <span className="badge accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{n.icon}{n.badge}</span>
                <span className="hint-line" style={{ flex: 1, minWidth: 120, fontSize: 12 }}>{n.note}</span>
                <button className="btn sm primary" onClick={() => recognize(n)}><Award size={13} />Recognize</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {list.length === 0 ? <Empty icon={<Award size={22} color="var(--muted)" />} title={isAdmin ? "No recognition given yet" : "No recognition yet"} text={isAdmin ? "Celebrate good work — points feed the performance leaderboard." : "When an admin recognises your work, it shows up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "reward" })}><Award size={16} />Give recognition</button>} />
          : list.map((r) => (
            <div key={r.id} className="item-row">
              <div className="avatar" style={{ background: avatarColor(r.userName), width: 34, height: 34, fontSize: 14 }}>{(r.userName || "?")[0]}</div>
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span className="item-title">{r.userName}</span><span className="badge accent">{r.kind}</span><span className="badge pos">+{r.points} pts</span></div>
                {r.note && <div className="item-meta" style={{ marginTop: 4 }}>{r.note}</div>}
                <div className="item-meta"><span>{fmtDate(r.date || new Date(r.createdAt).toISOString().slice(0, 10))}</span></div>
              </div>
              {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove recognition?", body: `Remove this for ${r.userName}?`, note: "Moves to Recently deleted.", onConfirm: () => del(r) })}><Trash2 size={14} /></button></div>}
            </div>
          ))}
      </div>
    </div>
  );
}

function PortalPosts({ db, mutate, openModal, removeItem, portalClients }) {
  const list = [...db.portal_posts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (p) => removeItem("portal_posts", p, { name: p.title, audit: `deleted client update "${p.title}"` });
  const statusTone = (s) => s === "Completed" ? "pos" : s === "On hold" ? "neg" : s === "Review" ? "accent" : "pri";
  return (
    <div className="content">
      <div className="page-head"><h3>Client updates</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "portalPost" })}><Plus size={16} />Post update</button></div>
      <p className="hint-line" style={{ marginTop: -4 }}>Updates you post here appear in that client's portal when they sign in.</p>
      <div className="card" style={{ marginTop: 12 }}>
        {list.length === 0 ? <Empty icon={<ExternalLink size={22} color="var(--muted)" />} title="No client updates yet" text={portalClients.length === 0 ? "No client portal accounts yet — a client signs up from the login screen (choose Client)." : "Post a status update and your client will see it in their portal."} action={portalClients.length > 0 && <button className="btn primary" onClick={() => openModal({ type: "portalPost" })}><Plus size={16} />Post update</button>} />
          : list.map((p) => (
            <div key={p.id} className="item-row">
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span className="item-title">{p.title}</span><span className={"badge " + statusTone(p.status)}>{p.status}</span></div>
                <div className="item-meta"><span><Building2 size={12} style={{ verticalAlign: -2 }} /> {p.clientName}</span><span>{fmtDateTime(p.createdAt)}</span></div>
                {p.body && <div className="sub" style={{ marginTop: 4 }}>{p.body}</div>}
                {p.meetingLink && <div style={{ marginTop: 6 }}><a className="btn sm primary" href={p.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
              </div>
              <div className="row-actions">
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "portalPost", initial: p })}><Pencil size={14} /></button>
                <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete update?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function PortalRefreshButton({ onRefresh }) {
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (busy || !onRefresh) return;
    setBusy(true);
    try { await onRefresh(); } finally { setBusy(false); }
  };
  return <button className="iconbtn" title="Refresh" aria-label="Refresh current portal" disabled={busy} onClick={refresh}><RefreshCw size={17} className={busy ? "spin" : ""} /></button>;
}

/* ── Client portal: a separate, read-only surface for external clients ──── */
/// ══ Helpdesk · client portal ──────────────────────────────────────────────
const HELP_STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const HELP_STATUS_TONE = (s) => ({ open: "pri", in_progress: "accent", resolved: "pos", closed: "" }[s] || "pri");
const HELP_CATEGORIES = ["Login / Account", "Payment / Billing", "Quotation", "Project", "Website", "Digital Marketing", "Training", "Technical Issue", "App / Portal", "APN", "Other"];

function PortalHelpdesk({ myId, tickets, messages, onCreate, onSend, helpFormOpen, setHelpFormOpen, helpBusy, co = {} }) {
  const waNumber = String(co.phone || "").replace(/[^\d]/g, "");
  const waLink = waNumber ? `https://wa.me/${waNumber.replace(/^0+/, "")}?text=${encodeURIComponent("Hello ALLBEE, I need help with a support query.")}` : "";
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "Other", priority: "Normal", description: "" });
  const msgsOf = (id) => [...messages].filter((m) => m.ticket_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const send = async (t, body) => {
    const txt = (body || "").trim();
    if (!txt || busy) return;
    setBusy(true);
    const ok = await onSend(t.id, txt);
    setBusy(false);
    if (ok) setDrafts((d) => ({ ...d, [t.id]: "" }));
  };
  const submit = () => {
    if (!form.subject.trim()) { emitToast("Please add a subject.", "error"); return; }
    onCreate({ subject: form.subject, description: form.description, category: form.category, priority: form.priority });
    setForm({ subject: "", category: "Other", priority: "Normal", description: "" });
  };
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ marginBottom: 3 }}>Support</h3>
          <div className="hint-line">Facing an issue or have a question? Raise a ticket and our team will reply right here.</div>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setHelpFormOpen(true)}><Plus size={15} />Create Ticket</button>
      </div>

      {(co.email || waLink) && (
        <div className="card" style={{ marginBottom: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="hint-line" style={{ flex: "1 1 200px" }}>Prefer to reach us directly? Email or WhatsApp your query anytime — tickets still get the fastest response.</span>
          {co.email && <a className="btn sm" href={`mailto:${co.email}?subject=${encodeURIComponent("Support request — client portal")}`} style={{ textDecoration: "none" }}><Mail size={13} />Email us</a>}
          {waLink && <a className="btn sm" href={waLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><MessageCircle size={13} />WhatsApp</a>}
        </div>
      )}

      {tickets.length === 0 ? <div className="card"><Empty icon={<Headset size={22} color="var(--muted)" />} title="No support tickets yet" text="When you create a ticket, it will show up here with the team's replies." action={<button className="btn primary" onClick={() => setHelpFormOpen(true)}><Plus size={15} />Create your first ticket</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{tickets.map((t) => {
          const isOpen = expanded === t.id;
          const thread = msgsOf(t.id);
          return (
            <div key={t.id} className="card stat">
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }} onClick={() => setExpanded(isOpen ? null : t.id)}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{t.subject}</div>
                  <div className="hint-line" style={{ fontSize: 11.5, marginTop: 2 }}>{t.ticket_no} · {t.category} · raised {fmtDate(t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : 0)}</div>
                </div>
                {t.priority && t.priority !== "Normal" && <span className={"badge " + (t.priority === "High" || t.priority === "Urgent" ? "neg" : "accent")}>{t.priority}</span>}
                <span className={"badge " + HELP_STATUS_TONE(t.status)}>{HELP_STATUS_LABEL[t.status] || t.status}</span>
                <ChevronDown size={15} style={{ transform: isOpen ? "rotate(180deg)" : "", transition: "transform .18s ease", color: "var(--muted)" }} />
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  {t.description && <div className="hint-line" style={{ margin: "0 0 12px", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{t.description}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {thread.length === 0 ? <div className="hint-line">No replies yet — our team typically follows up within one business day.</div>
                      : thread.map((m) => (
                        <div key={m.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <Avatar name={m.author_name || (m.author_role === "client" ? "You" : "ALLBEE")} size={26} />
                          <div style={{ background: m.author_role === "client" ? "var(--primary-soft)" : "var(--surface-2)", borderRadius: 10, padding: "9px 12px", flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <b style={{ fontSize: 12.5 }}>{m.author_role === "client" ? "You" : (m.author_name || "ALLBEE team")}</b>
                              <span className="hint-line" style={{ fontSize: 10.5 }}>{fmtDateTime(m.created_at)}</span>
                            </div>
                            <div style={{ marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 13.5 }}>{m.body}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {!["resolved", "closed"].includes(t.status) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <textarea className="textarea" style={{ minHeight: 40, flex: 1 }} value={drafts[t.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} placeholder="Write a reply…" />
                      <button className="btn primary" disabled={busy || !(drafts[t.id] || "").trim()} onClick={() => send(t, drafts[t.id])}><Send size={14} />Reply</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}</div>}

      {helpFormOpen && <Modal title="Create a support ticket" onClose={() => setHelpFormOpen(false)} footer={<><button className="btn" onClick={() => setHelpFormOpen(false)}>Cancel</button><button className="btn primary" disabled={helpBusy || !form.subject.trim()} onClick={submit}>{helpBusy ? "Submitting…" : "Submit ticket"}</button></>}>
        <Field label="Subject" required><input className="input" autoFocus value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} placeholder="Short summary of your request" /></Field>
        <div className="grid2"><Field label="Category"><select className="select" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>{HELP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Priority"><select className="select" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>{["Low", "Medium", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field></div>
        <Field label="Describe the issue"><textarea className="textarea" style={{ minHeight: 110 }} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Share as much detail as you can — what happened, when, and what you'd like us to do." /></Field>
      </Modal>}
    </div>
  );
}



/// ══ Helpdesk · ops console (staff/admin reply & triage from the app) ────
function Notifications({ db, mutate, openModal, removeItem, isAdmin, me, profile, team }) {
  const visible = [...db.notifications].filter((n) => isAdmin || notifVisibleTo(n, profile)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const levelTone = (l) => l === "Urgent" ? "neg" : l === "Important" ? "accent" : "pri";
  const audienceLabel = (a) => { if (!a || a === "all") return "Everyone"; if (a.startsWith("user:")) { const u = (team || []).find((x) => x.id === a.slice(5)); return u ? "Only " + u.name : "One person"; } return (NOTIF_AUDIENCES.find((x) => x[0] === a) || [a, a])[1]; };
  const senderFor = (n) => {
    const person = (team || []).find((x) => x.id === n.senderId || x.name === n.by);
    return {
      name: n.senderName || n.by || person?.name || "Admin",
      designation: n.senderDesignation || person?.designation || ROLE_LABEL[person?.role] || "Administrator",
      avatar: n.senderAvatar || person?.photo_url || "",
    };
  };
  // Opening Notifications is itself an acknowledgement: once the user has
  // intentionally opened the notification center, its unread badge must clear
  // immediately and persist across refreshes/devices.
  useEffect(() => {
    if (!me?.id) return;
    const unread = visible.filter((n) => !(n.reads || []).includes(me.id)).map((n) => n.id);
    if (!unread.length) return;
    mutate((d) => ({
      ...d,
      notifications: d.notifications.map((x) => unread.includes(x.id)
        ? { ...x, reads: Array.from(new Set([...(x.reads || []), me.id])) }
        : x),
    }), null);
  }, [visible.length, me?.id, isAdmin]);

  const markRead = (n) => { if ((n.reads || []).includes(me.id)) return; mutate((d) => ({ ...d, notifications: d.notifications.map((x) => x.id === n.id ? { ...x, reads: Array.from(new Set([...(x.reads || []), me.id])) } : x) }), null); };
  const del = (n) => removeItem("notifications", n, { name: n.title, audit: `deleted notification "${n.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Notifications</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>}</div>
      {visible.length === 0 ? <div className="card"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text={isAdmin ? "Broadcast an update to everyone, a role, or one person \u2014 with a priority level." : "Notifications from your admins show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{visible.map((n) => {
          const seen = (n.reads || []).includes(me.id);
          const sender = senderFor(n);
          return (
            <div key={n.id} className="card stat" style={{ borderLeft: `3px solid var(${n.level === "Urgent" ? "--neg" : "--primary"})`, position: "relative" }}>
              {!seen && !isAdmin && <span aria-label="Unread notification" title="Unread" style={{ position: "absolute", top: 18, right: 18, width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Avatar name={sender.name} url={sender.avatar} size={34} fontSize={13} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontWeight: 700, fontSize: 15 }}>{n.title}</span><span className={"badge " + levelTone(n.level)}>{n.level || "General"}</span>{!seen && !isAdmin && <span className="badge pri">New</span>}</div>
                  {n.body && <div style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                  <div className="item-meta" style={{ marginTop: 8 }}><span>{sender.name}</span><span>{sender.designation}</span><span>{fmtDateTime(n.createdAt)}</span>{isAdmin && <span><Users size={12} style={{ verticalAlign: -2 }} /> {audienceLabel(n.audience)}</span>}{isAdmin && <span><Check size={12} style={{ verticalAlign: -2 }} /> {(n.reads || []).length} read</span>}</div>
                  {!isAdmin && !seen && <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => markRead(n)}><Check size={13} />Mark as read</button></div>}
                  {!isAdmin && seen && <div className="hint-line" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pos)" }}><BadgeCheck size={13} />Read</div>}
                </div>
                {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} aria-label={`Delete notification ${n.title}`} title="Delete notification" onClick={() => del(n)}><Trash2 size={14} /></button></div>}
              </div>
            </div>
          );
        })}</div>}
    </div>
  );
}

function Invoices({ db, mutate, openModal, removeItem, portalClients }) {
  const [status, setStatus] = useState("All");
  const all = [...db.invoices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = status === "All" ? all : all.filter((iv) => iv.status === status);
  const setIvStatus = (iv, sv) => mutate((d) => ({ ...d, invoices: d.invoices.map((x) => x.id === iv.id ? { ...x, status: sv, paid: sv === "Paid" } : x) }), { action: `marked invoice ${iv.number || ""} for ${iv.client} ${sv}`, module: "Invoices" });
  const del = (iv) => removeItem("invoices", iv, { name: (iv.number || "Invoice") + " \u00b7 " + iv.client, audit: `deleted invoice for ${iv.client}` });
  const tone = (sv) => sv === "Paid" ? "pos" : sv === "Overdue" ? "neg" : sv === "Sent" ? "pri" : sv === "Cancelled" ? "" : "accent";
  const outstanding = all.filter((iv) => iv.status === "Sent" || iv.status === "Overdue").reduce((a, iv) => a + (Number(iv.amount) || 0), 0);
  const paid = all.filter((iv) => iv.status === "Paid").reduce((a, iv) => a + (Number(iv.amount) || 0), 0);
  return (
    <div className="content">
      <div className="page-head"><h3>Invoices</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "invoice" })}><Plus size={16} />New invoice</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><Banknote size={14} /> Outstanding</div><div className="v mono">{money(outstanding)}</div></div>
        <div className="card"><div className="k"><BadgeCheck size={14} /> Paid</div><div className="v mono">{money(paid)}</div></div>
      </div>
      <div className="toolbar"><div className="seg">{["All", ...INVOICE_STATUS].map((sv) => <button key={sv} className={status === sv ? "on" : ""} onClick={() => setStatus(sv)}>{sv}</button>)}</div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<FileText size={22} color="var(--muted)" />} title="No invoices" text="Raise an invoice, track its payment, and optionally share it to the client portal." action={<button className="btn primary" onClick={() => openModal({ type: "invoice" })}><Plus size={16} />New invoice</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th><th className="num-cell">Amount</th><th></th></tr></thead>
            <tbody>{list.map((iv) => (
              <tr key={iv.id}>
                <td><div style={{ fontWeight: 600 }}>{iv.number || "\u2014"}</div>{iv.title && <div className="hint-line" style={{ fontSize: 11 }}>{iv.title}</div>}</td>
                <td>{iv.client}{iv.clientId && <span className="badge accent" style={{ marginLeft: 6, fontSize: 10 }}>Shared</span>}</td>
                <td><select className="select" style={{ width: "auto", padding: "4px 6px" }} value={iv.status || "Draft"} onChange={(e) => setIvStatus(iv, e.target.value)}>{INVOICE_STATUS.map((sv) => <option key={sv}>{sv}</option>)}</select></td>
                <td><span className={"badge " + (iv.dueDate && iv.status !== "Paid" && iv.dueDate < todayISO() ? "neg" : "")}>{iv.dueDate ? fmtDate(iv.dueDate) : "\u2014"}</span></td>
                <td className="num-cell mono" style={{ fontWeight: 700 }}>{money(iv.amount)}</td>
                <td><div className="row-actions"><span className={"badge " + tone(iv.status)}>{iv.status || "Draft"}</span><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "invoice", initial: iv })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete invoice?", body: `Delete this invoice for ${iv.client}?`, note: "Moves to Recently deleted \u2014 restore within 60 days.", onConfirm: () => del(iv) })}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

function CompanySettings({ config, saveCompany }) {
  const init = (() => { try { return JSON.parse((config && config.company) || "{}") || {}; } catch { return {}; } })();
  const [f, setF] = useState({ name: "ALLBEE Solutions", logoUrl: "", address: "", email: "", phone: "", website: "", ...init });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDone(false); };
  const save = async () => { setBusy(true); try { await saveCompany(f); setDone(true); } finally { setBusy(false); } };
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Company profile</div>
      <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 14 }}>Shown on the client portal and used on quotations and invoices.</p>
      <div className="grid2">
        <Field label="Company name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="ALLBEE Solutions" /></Field>
        <Field label="Logo URL"><input className="input" value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://\u2026/logo.png" /></Field>
      </div>
      <Field label="Address"><textarea className="textarea" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, city, PIN" /></Field>
      <div className="grid2">
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="hello@allbee.in" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 \u2026" /></Field>
      </div>
      <Field label="Website"><input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://allbee.in" /></Field>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}{done ? "Saved" : "Save company profile"}</button>
    </div>
  );
}

/* ── In-house projects ─────────────────────────────────────────────────────
   The company's own initiatives (products, internal tools, R&D) — tracked
   separately from client projects. No client billing; just status + progress. */
function InHouse({ db, mutate, openModal, removeItem, isAdmin, me, team = [] }) {
  const list = [...(db.inhouse || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canEdit = (p) => isAdmin || p.ownerId === me?.id;
  const setStage = (p, stage) => mutate((d) => ({ ...d, inhouse: d.inhouse.map((x) => x.id === p.id ? { ...x, stage, progress: stage === "Launched" ? 100 : x.progress } : x) }), { action: `moved "${p.name}" to ${stage}`, module: "In-house projects" });
  const del = (p) => removeItem("inhouse", p, { name: p.name, audit: `deleted in-house project "${p.name}"` });
  const active = list.filter((p) => p.stage !== "Launched" && p.stage !== "On hold").length;
  const launched = list.filter((p) => p.stage === "Launched").length;
  const budget = list.reduce((s, p) => s + (Number(p.budget) || 0), 0);
  const stageTone = (s) => s === "Launched" ? "pos" : s === "On hold" ? "neg" : s === "Building" || s === "Testing" ? "accent" : "pri";
  return (
    <div className="content">
      <div className="page-head"><h3>In-house projects</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "inhouse" })}><Plus size={16} />New project</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><Home size={14} /> Total</div><div className="v">{list.length}</div></div>
        <div className="card"><div className="k"><Activity size={14} /> In progress</div><div className="v">{active}</div></div>
        <div className="card"><div className="k"><CheckCircle2 size={14} /> Launched</div><div className="v">{launched}</div></div>
        {budget > 0 && <div className="card"><div className="k"><Wallet size={14} /> Budget</div><div className="v mono">{money(budget)}</div></div>}
      </div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Home size={22} color="var(--muted)" />} title="No in-house projects yet" text="Track the company's own products, internal tools and R&D from Idea to Launched." action={<button className="btn primary" onClick={() => openModal({ type: "inhouse" })}><Plus size={16} />New project</button>} /></div>
          : list.map((p) => {
            const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
            return (
              <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div><div className="sub">{p.category}{p.lead ? ` · ${p.lead}` : ""}</div></div>
                  {p.priority && <span className={"badge " + priorityTone(p.priority)}>{p.priority}</span>}
                </div>
                <select className="select" value={p.stage} onChange={(e) => setStage(p, e.target.value)}>{INHOUSE_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}><span className={"badge " + stageTone(p.stage)}>{p.stage}</span><span className="mono">{pct}%</span></div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "var(--pos)" : "var(--primary)", transition: ".2s" }} /></div>
                </div>
                <div className="item-meta">{p.start && <span>Start {fmtDate(p.start)}</span>}{p.target && <span>Target {fmtDate(p.target)}</span>}{Number(p.budget) > 0 && <span className="mono">{money(p.budget)}</span>}</div>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--primary)", textDecoration: "none", fontWeight: 600, wordBreak: "break-all" }}><ExternalLink size={13} style={{ flex: "none" }} />{p.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
                {p.notes && <div className="hint-line" style={{ lineHeight: 1.5 }}>{p.notes.length > 120 ? p.notes.slice(0, 120) + "…" : p.notes}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                  {canEdit(p) && <button className="btn sm" onClick={() => openModal({ type: "inhouse", initial: p })}><Pencil size={13} />Edit</button>}
                  {canEdit(p) && <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete project?", body: `Delete "${p.name}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>}
                  {!canEdit(p) && <span className="hint-line" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}><LockIcon size={11} />{p.owner ? `Added by ${p.owner}` : "Admin-only"}</span>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ── Staff salary (admin) ──────────────────────────────────────────────── */
function SalaryRow({ person, db, payroll, onSave }) {
  const cfg = payrollFor(payroll, person.id);
  const [fixed, setFixed] = useState(cfg?.fixedMonthly != null ? String(cfg.fixedMonthly) : "");
  const [pct, setPct] = useState(cfg?.commissionPct != null ? String(cfg.commissionPct) : "");
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => { setFixed(cfg?.fixedMonthly != null ? String(cfg.fixedMonthly) : ""); setPct(cfg?.commissionPct != null ? String(cfg.commissionPct) : ""); }, [cfg?.fixedMonthly, cfg?.commissionPct]);
  const E = staffEarnings(db, payroll, { id: person.id, name: person.name }, person.created_at);
  const dirty = String(Number(fixed) || 0) !== String(E.fixedMonthly) || String(Number(pct) || 0) !== String(E.pct);
  const save = () => { onSave(person, { fixedMonthly: Number(fixed) || 0, commissionPct: Number(pct) || 0 }); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const incentives = E.incentives;
  const addIncentive = (entry) => { onSave(person, { incentives: [...incentives, entry] }, `added a ${money(entry.amount)} incentive for ${person.name}${entry.note ? ` (${entry.note})` : ""}`); setAdding(false); };
  const removeIncentive = (id) => { const it = incentives.find((x) => x.id === id); onSave(person, { incentives: incentives.filter((x) => x.id !== id) }, `removed a ${money(it?.amount || 0)} incentive for ${person.name}`); };
  return (
    <div className="card stat" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="who-cell">
        <Avatar name={person.name} url={person.photo_url} size={30} />
        <span><div style={{ fontWeight: 700 }}>{person.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[person.role] || person.role}{person.designation ? ` · ${person.designation}` : ""}</div></span>
      </div>
      <div className="grid2">
        <Field label="Fixed salary / month"><input className="input mono" type="number" min="0" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="0" /></Field>
        <Field label="Commission %"><input className="input mono" type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="0" /></Field>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
        <span className="hint-line">Commission earned <b className="pos-txt mono" style={{ marginLeft: 4 }}>{money(E.realisedComm)}</b></span>
        <span className="hint-line">Pipeline <b className="mono" style={{ marginLeft: 4 }}>{money(E.pipelineComm)}</b></span>
        {E.fixedMonthly > 0 && <span className="hint-line">Salary to date <b className="mono" style={{ marginLeft: 4 }}>{money(E.salaryToDate)}</b></span>}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Gift size={14} color="var(--accent)" /><span style={{ fontWeight: 600, fontSize: 12.5 }}>Incentives</span>
          <b className="mono" style={{ marginLeft: "auto" }}>{money(E.incentivesTotal)}</b>
        </div>
        {incentives.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {incentives.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map((x) => (
              <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", borderRadius: 8, padding: "6px 10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{money(x.amount)}</div><div className="hint-line" style={{ fontSize: 11 }}>{x.note || "Incentive"}{x.date ? ` · ${fmtDate(x.date)}` : ""}</div></div>
                <button className="iconbtn" style={{ width: 26, height: 26 }} onClick={() => removeIncentive(x.id)} title="Remove"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}><Plus size={13} />Add incentive</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn sm primary" onClick={save} disabled={!dirty}><Check size={14} />Save</button>
        {saved && <span className="hint-line" style={{ color: "var(--pos)" }}><Check size={13} style={{ verticalAlign: -2 }} /> Saved</span>}
        {!E.configured && !dirty && <span className="hint-line">No pay set yet</span>}
      </div>
      {adding && <React.Suspense fallback={<LoadingScreen />}><LazyIncentiveForm person={person} onAdd={addIncentive} onClose={() => setAdding(false)} runtime={{ useState, Modal, Field, Gift, Plus, todayISO, uid, round2 }} /></React.Suspense>}
    </div>
  );
}



function TeamLeads({ team, db, openModal, removeItem, me }) {
  const teams = [...(db.teams || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const roster = team.filter((p) => p.role !== "client" && p.active !== false);
  const byId = (id) => team.find((p) => p.id === id);
  const del = (t) => removeItem("teams", t, { name: t.name, audit: `deleted team "${t.name}"` });
  const assigned = new Set(teams.flatMap((t) => teamRosterIds(t)));
  const unassigned = roster.filter((p) => !assigned.has(p.id) && p.role !== "superadmin");
  return (
    <div className="content">
      <div className="page-head"><h3>Team leads</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "teamcfg" })}><Plus size={16} />New team</button></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><ShieldCheck size={15} /> Group people under a team lead. Leads (and their members) get a My team screen with the team's attendance, tasks, performance and a private team chat.</div>
      {teams.length === 0 ? <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="No teams yet" text="Create a team, pick a lead, and assign the members who report to them." action={<button className="btn primary" onClick={() => openModal({ type: "teamcfg" })}><Plus size={16} />New team</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
          {teams.map((t) => {
            const members = (t.memberIds || []).map(byId).filter(Boolean);
            const lead = byId(t.leadId);
            return (
              <div key={t.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div><div className="sub">{members.length + 1} member{members.length ? "s" : ""}</div></div>
                  <div className="row-actions">
                    <button className="iconbtn" style={{ width: 30, height: 30 }} title="Edit" onClick={() => openModal({ type: "teamcfg", initial: t })}><Pencil size={14} /></button>
                    <button className="iconbtn" style={{ width: 30, height: 30 }} title="Delete" onClick={() => openModal({ type: "deleteConfirm", title: "Delete team?", body: `Delete "${t.name}"?`, note: "Members keep their accounts — only the grouping is removed.", onConfirm: () => del(t) })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div>
                  <div className="hint-line" style={{ marginBottom: 6 }}>Team lead</div>
                  <span className="who-cell"><Avatar name={lead?.name || "?"} url={lead?.photo_url} size={28} /><span><div style={{ fontWeight: 600 }}>{lead?.name || "—"} <span className="badge accent" style={{ marginLeft: 4 }}>Lead</span></div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[lead?.role] || ""}</div></span></span>
                </div>
                <div>
                  <div className="hint-line" style={{ marginBottom: 6 }}>Members</div>
                  {members.length === 0 ? <div className="hint-line">No members yet.</div>
                    : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{members.map((m) => <span key={m.id} className="who-cell" style={{ background: "var(--surface-2)", borderRadius: 999, padding: "3px 10px 3px 3px" }}><Avatar name={m.name} url={m.photo_url} size={22} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span></span>)}</div>}
                </div>
              </div>
            );
          })}
        </div>}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>Not on a team yet ({unassigned.length})</div>
          <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>{unassigned.map((p) => <span key={p.id} className="who-cell"><Avatar name={p.name} url={p.photo_url} size={22} /><span style={{ fontSize: 12.5 }}>{p.name}</span></span>)}</div>
        </div>
      )}
    </div>
  );
}

/* ── Team-scoped chat (private to one team) ────────────────────────────── */
function TeamChat({ db, mutate, me, members, teamId, onRefresh }) {
  const [text, setText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const endRef = useRef(null);
  const list = [...(db.team_chat || [])].filter((m) => m.teamId === teamId && !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [list.length]);
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") onRefresh(); }, 12000);
    return () => clearInterval(t);
  }, [onRefresh]);
  useEffect(() => {
    const unseen = (db.team_chat || []).filter((m) => m.teamId === teamId && m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id));
    if (!unseen.length) return;
    const ids = new Set(unseen.map((m) => m.id));
    mutate((d) => ({ ...d, team_chat: d.team_chat.map((m) => ids.has(m.id) ? { ...m, seenBy: Array.from(new Set([...(m.seenBy || []), me.id])) } : m) }), null);
  }, [db.team_chat, me.id, teamId, mutate]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    setText("");
    mutate((d) => ({ ...d, team_chat: [...(d.team_chat || []), { id: uid(), teamId, userId: me.id, userName: me.name, text: t, createdAt: Date.now() }] }), null);
  };
  const del = (m) => setConfirmDelete(m);
  const deleteNow = () => { if (!confirmDelete) return; mutate((d) => ({ ...d, team_chat: d.team_chat.map((x) => x.id === confirmDelete.id ? { ...x, deleted: true, text: "", deletedBy: me.name } : x) }), null); setConfirmDelete(null); };
  const photo = (id) => members.find((p) => p.id === id)?.photo_url;
  return (<>
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 360 }}>
      <div className="card" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? <Empty icon={<Send size={22} color="var(--muted)" />} title="No messages yet" text="This chat is private to your team." />
          : list.map((m) => {
            const mine = m.userId === me.id;
            return (
              <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <div style={{ flex: "none" }}><Avatar name={m.userName} url={photo(m.userId)} size={30} /></div>
                <div style={{ maxWidth: "72%" }}>
                  <div style={{ background: mine ? "var(--primary)" : "var(--surface-2)", color: mine ? "#fff" : "var(--ink)", padding: "9px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>
                  <div className="hint-line" style={{ fontSize: 11, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.userName} · {fmtDateTime(m.createdAt)}{mine && <button onClick={() => del(m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--neg)", cursor: "pointer", font: "inherit", padding: 0, textDecoration: "underline" }}>Delete</button>}</div>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginTop: 12 }}>
        <textarea className="textarea" style={{ minHeight: 44 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message your team… (Enter to send)" />
        <button className="btn primary" onClick={send} disabled={!text.trim()}><Send size={16} />Send</button>
      </div>
    </div>
    {confirmDelete && <Confirm title="Delete message?" body="Delete your message for the team?" onConfirm={deleteNow} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}

function MyTeam({ db, team, me, mutate, onRefresh }) {
  const [tab, setTab] = useState("overview");
  const [date, setDate] = useState(todayISO());
  const myTeam = teamOfUser(db.teams, me.id);
  if (!myTeam) {
    return (
      <div className="content">
        <div className="page-head"><h3>My team</h3></div>
        <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="You're not on a team yet" text="Once a super admin adds you to a team, you'll see your teammates' attendance, tasks and a private team chat here." /></div>
      </div>
    );
  }
  const amLead = myTeam.leadId === me.id;
  const members = teamRosterIds(myTeam).map((id) => team.find((p) => p.id === id)).filter(Boolean);
  const month = new Date();
  const memberStats = (p) => {
    const open = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status !== "Completed").length;
    const done = db.tasks.filter((t) => isTaskAssignee(t, p) && t.status === "Completed").length;
    const presentDays = new Set(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month)).map((a) => a.date)).size;
    const hours = round2(sumHours(db.attendance.filter((a) => a.userId === p.id && sameMonth(a.date, month))));
    return { open, done, presentDays, hours };
  };
  const teamTasks = db.tasks
    .filter((t) => members.some((p) => isTaskAssignee(t, p)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const TABS = [["overview", "Overview"], ["attendance", "Attendance"], ["tasks", "Tasks"], ["chat", "Team chat"]];
  return (
    <div className="content">
      <div className="page-head">
        <h3>{myTeam.name}</h3>
        <span className="badge accent">{amLead ? "You lead this team" : "Member"}</span>
        <span className="spacer" />
        <span className="hint-line">{members.length} member{members.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="toolbar"><div className="seg">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div></div>

      {tab === "overview" && (
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {members.map((p) => {
            const s = memberStats(p);
            const att = attStatus(db, p.id, todayISO());
            return (
              <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="who-cell">
                  <Avatar name={p.name} url={p.photo_url} size={32} />
                  <span style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{p.name}{p.id === myTeam.leadId ? <span className="badge accent" style={{ marginLeft: 6 }}>Lead</span> : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[p.role] || p.role}</div></span>
                  <span className={"badge " + att.tone}>{att.label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Open tasks</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.open}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Completed</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.done}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Days present</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.presentDays}</div></div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px" }}><div className="hint-line" style={{ fontSize: 11 }}>Hours (mo)</div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.hours}</div></div>
                </div>
                {p.id !== me.id && <div><ContactButtons person={p} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "attendance" && (
        <div className="card">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Attendance</span>
            <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Member</th><th>{fmtDate(date)}</th><th>Check in</th><th>Check out</th><th className="num-cell">Days this month</th></tr></thead>
              <tbody>{members.map((p) => {
                const st = attStatus(db, p.id, date);
                const a = attendanceFor(db, p.id, date);
                const presentDays = new Set(db.attendance.filter((x) => x.userId === p.id && sameMonth(x.date, month)).map((x) => x.date)).size;
                return (
                  <tr key={p.id}>
                    <td><span className="who-cell"><Avatar name={p.name} url={p.photo_url} size={26} /><span style={{ fontWeight: 600 }}>{p.name}</span></span></td>
                    <td><span className={"badge " + st.tone}>{st.label}</span></td>
                    <td className="mono">{a ? clockTime(a.checkIn) : "—"}</td>
                    <td className="mono">{a && a.checkOut ? clockTime(a.checkOut) : "—"}</td>
                    <td className="num-cell mono">{presentDays}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="card">
          {teamTasks.length === 0 ? <Empty icon={<ListTodo size={22} color="var(--muted)" />} title="No tasks for the team yet" text="Tasks assigned to anyone on the team show up here." />
            : teamTasks.map((t) => (
              <div key={t.id} className="item-row">
                <div className="item-main">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    {t.num != null && <span className="badge mono" style={{ fontWeight: 700 }}>#{t.num}</span>}
                    <span className="item-title">{t.title}</span>
                    <span className={"badge " + (t.status === "Completed" ? "pos" : t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
                    {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
                  </div>
                  <div className="item-meta" style={{ marginTop: 6 }}>
                    <span>{t.assignedBy} → <b>{assigneeText(t)}</b></span>
                    {t.due && <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {fmtDate(t.due)}</span>}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "chat" && <TeamChat db={db} mutate={mutate} me={me} members={members} teamId={myTeam.id} onRefresh={onRefresh} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TESTING MODULE (website / app / software QA)
══════════════════════════════════════════════════════════════════════ */
const testProgress = (s) => {
  const list = Array.isArray(s.checklist) ? s.checklist : [];
  return { done: list.filter((i) => i.done).length, total: list.length };
};
const testResultTone = (r) => (r === "Passed" ? "pos" : r === "Failed" ? "neg" : "pri");

// Create / edit a test session (admin). Seeds a checklist from one-item-per-line
// text and links the session to a project so its history belongs to that project.
// Full session view: checklist, bug reports with screenshots, result. Looks up
// the live session from db by id so edits from either partner stay in sync.
// Master list + dashboard. Admins see and create every session; a tester sees
// the sessions assigned to them.
function Testing({ db, mutate, openModal, removeItem, isAdmin, me, currentUser, team }) {
  const [openId, setOpenId] = useState(null);
  const all = [...(db.testing || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((s) => s.assignedToId === me.id || (!!currentUser && s.assignedTo === currentUser));
  const del = (s) => removeItem("testing", s, { name: s.title, audit: `deleted test session "${s.title}"` });

  if (openId) return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading test session…</div></div>}><LazyTestDetail key={openId} sessionId={openId} db={db} mutate={mutate} isAdmin={isAdmin} me={me} currentUser={currentUser} team={team} openModal={openModal} onBack={() => setOpenId(null)} onDelete={del} runtime={{ Empty, supabase, uid, haptic, uploadAttachment, fileKind, storagePathFromUrl, fmtTime, testProgress, testResultTone, TEST_MAX_IMAGES, TEST_IMAGE_TTL_DAYS, ArrowLeft, ClipboardCheck, FolderKanban, User, Pencil, Trash2, CheckCircle2, XCircle, RotateCcw, ListTodo, X, Plus, Bug, AlertTriangle, ImageIcon, RefreshCw, Send, FileText }} /></React.Suspense>;

  const passed = list.filter((s) => s.result === "Passed").length;
  const failed = list.filter((s) => s.result === "Failed").length;
  const pending = list.filter((s) => (s.result || "Pending") === "Pending").length;

  return (
    <div className="content">
      <div className="page-head"><h3>Testing</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "testSession" })}><Plus size={16} />New test session</button>}</div>

      <div className="sumrow">
        <div className="card"><div className="k"><ClipboardCheck size={14} /> Total tests</div><div className="v mono">{list.length}</div></div>
        <div className="card"><div className="k"><CheckCircle2 size={14} color="var(--pos)" /> Passed</div><div className="v mono pos-txt">{passed}</div></div>
        <div className="card"><div className="k"><XCircle size={14} color="var(--neg)" /> Failed</div><div className="v mono neg-txt">{failed}</div></div>
        <div className="card"><div className="k"><Hourglass size={14} /> Pending</div><div className="v mono">{pending}</div></div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ClipboardCheck size={22} color="var(--muted)" />} title={isAdmin ? "No test sessions yet" : "Nothing assigned to you"} text={isAdmin ? "Create a session, add a checklist, and assign a tester to start QA on a project." : "Test sessions assigned to you will show up here."} action={isAdmin ? <button className="btn primary" onClick={() => openModal({ type: "testSession" })}><Plus size={16} />New test session</button> : null} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Session</th><th>Project</th><th>Tester</th><th>Checklist</th><th>Result</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => {
                  const p = testProgress(s);
                  const nBugs = (Array.isArray(s.bugs) ? s.bugs : []).length;
                  return (
                    <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(s.id)}>
                      <td><div style={{ fontWeight: 600 }}>{s.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(new Date(s.createdAt || Date.now()).toISOString().slice(0, 10))}{nBugs ? ` · ${nBugs} issue${nBugs > 1 ? "s" : ""}` : ""}</div></td>
                      <td>{s.projectName ? <span className="tag">{s.projectName}</span> : <span className="hint-line">—</span>}</td>
                      <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(s.assignedTo || "?"), width: 24, height: 24, fontSize: 10 }}>{(s.assignedTo || "?")[0]}</span>{s.assignedTo || "Unassigned"}</span></td>
                      <td className="mono">{p.done}/{p.total}</td>
                      <td><span className={"badge " + testResultTone(s.result)}>{s.result || "Pending"}</span></td>
                      <td onClick={(e) => e.stopPropagation()}><div className="row-actions">
                        <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setOpenId(s.id)} title="Open"><ChevronRight size={15} /></button>
                        {isAdmin && <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete test session?", body: `Delete "${s.title}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(s) })}><Trash2 size={14} /></button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   UNIVERSAL GLOBAL SEARCH (Ctrl / ⌘ + K)
══════════════════════════════════════════════════════════════════════ */
// Deep-collect every string value in a record (skipping passwords) so search
// scans titles, names, notes, descriptions, comments, checklist items, etc.
function collectText(v, out) {
  out = out || [];
  if (v == null) return out;
  if (typeof v === "string") { out.push(v); return out; }
  if (Array.isArray(v)) { for (const x of v) collectText(x, out); return out; }
  if (typeof v === "object") { for (const k of Object.keys(v)) { if (k === "password") continue; collectText(v[k], out); } return out; }
  return out;
}
const searchHay = (obj) => collectText(obj).join(" ").toLowerCase();
const msToISO = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
const searchEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function SearchHighlight({ text, q }) {
  const toks = (q || "").trim().split(/\s+/).filter(Boolean).map(searchEscape);
  if (!toks.length || !text) return <>{text}</>;
  const re = new RegExp(`(${toks.join("|")})`, "ig");
  const parts = String(text).split(re);
  const test = new RegExp(`^(${toks.join("|")})$`, "i");
  return <>{parts.map((p, i) => (test.test(p) ? <mark key={i} className="hl">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

// Each source maps a collection to a route (gated by the user's permissions),
// a display title, and where relevant an item-level visibility filter.
const SEARCH_SOURCES = [
  { coll: "projects", route: "projects", label: "Projects", title: (x) => x.name, sub: (x) => x.stage, user: (x) => x.ownerName || x.owner, date: (x) => x.start },
  { coll: "inhouse", route: "inhouse", label: "In-house projects", title: (x) => x.name, sub: (x) => x.stage, user: (x) => x.owner, date: (x) => x.start },
  { coll: "leads", route: "leads", label: "Leads", title: (x) => x.name, sub: (x) => x.stage, user: (x) => x.owner, date: (x) => x.date },
  { coll: "clients", route: "clients", label: "Clients", title: (x) => x.name, sub: (x) => x.status, user: (x) => x.owner, date: (x) => msToISO(x.createdAt) },
  { coll: "quotations", route: "quotations", label: "Quotations", title: (x) => x.title || x.client, sub: (x) => x.status, user: (x) => x.owner, date: (x) => x.date },
  { coll: "invoices", route: "invoices", label: "Invoices", title: (x) => (x.number || "Invoice") + " · " + (x.client || ""), sub: (x) => x.status, date: (x) => x.date },
  { coll: "tasks", route: "tasks", label: "Tasks", title: (x) => x.title, sub: (x) => x.status, user: (x) => assigneeText(x), date: (x) => x.due || "", nav: (x) => x.id },
  { coll: "updates", route: "updates", label: "Daily updates", title: (x) => (x.userName || "Update") + " — daily update", user: (x) => x.userName, date: (x) => x.date || msToISO(x.createdAt) },
  { coll: "concepts", route: "concepts", label: "Concepts", title: (x) => x.title, date: (x) => x.date },
  { coll: "knowledge", route: "knowledge", label: "Knowledge base", title: (x) => x.title, sub: (x) => x.category, date: (x) => x.date },
  { coll: "documents", route: "documents", label: "Documents", title: (x) => x.title, sub: (x) => x.category, user: (x) => x.owner, filter: (x, c) => c.isAdmin || x.audience === "internal" || (x.audience === "members" && (x.userIds || []).includes(c.me.id)) || x.ownerId === c.me.id },
  { coll: "testing", route: "testing", label: "Testing", title: (x) => x.title, sub: (x) => x.projectName, user: (x) => x.assignedTo, date: (x) => msToISO(x.createdAt), filter: (x, c) => c.isAdmin || x.assignedToId === c.me.id || x.assignedTo === c.me.name },
  { coll: "announcements", route: "announcements", label: "Announcements", title: (x) => x.title, date: (x) => msToISO(x.createdAt) },
  { coll: "chat", route: "chat", label: "Team chat", title: (x) => (x.userName || "Message") + ": " + String(x.text || "").slice(0, 60), user: (x) => x.userName, date: (x) => msToISO(x.at), filter: (x) => !x.deleted },
  { coll: "transactions", route: "accounts", label: "Accounts", title: (x) => (x.project || x.client || x.category || "Entry") + " · " + money(x.amount), sub: (x) => (x.kind === "income" ? "Income" : "Expense"), date: (x) => x.date },
  { coll: "withdrawals", route: "withdrawals", label: "Withdrawals", title: (x) => "Withdrawal " + money(x.amount) + " · " + (x.user || ""), sub: (x) => x.status, date: (x) => x.date },
  { coll: "planned", route: "planned", label: "Planned expenses", title: (x) => x.title, sub: (x) => x.category, date: (x) => x.nextDue },
  { coll: "rewards", route: "rewards", label: "Rewards", title: (x) => (x.userName || "") + " · " + (x.kind || ""), date: (x) => x.date },
  { coll: "sheets", route: "sheets", label: "Sheets", title: (x) => x.title, sub: (x) => x.category },
  { coll: "prompts", route: "prompts", label: "Prompts", title: (x) => x.title, sub: (x) => x.category },
  { coll: "vault", route: "vault", label: "Passwords", title: (x) => x.service, sub: (x) => x.category },
  { coll: "students", route: "courses", label: "Courses", title: (x) => x.name, sub: (x) => x.course, date: (x) => x.joinDate },
  { coll: "marketing", route: "marketing", label: "Marketing", title: (x) => x.client, sub: (x) => x.plan, date: (x) => x.startDate },
  { coll: "portal_posts", route: "portal-posts", label: "Client updates", title: (x) => x.title, date: (x) => msToISO(x.createdAt) },
  { coll: "notifications", route: "notifications", label: "Notifications", title: (x) => x.title, date: (x) => msToISO(x.createdAt), filter: (x, c) => notifVisibleTo(x, c.profile) },
];

function GlobalSearch({ db, team, profile, role, me, allowedRoutes, go, openTask, openModal, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const isAdmin = isAdminRole(role);
  const allowKey = (allowedRoutes || []).join(",");

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);

  const index = useMemo(() => {
    const allow = new Set(allowedRoutes || []);
    const ctx = { isAdmin, me, profile };
    const out = [];
    // modules (navigation)
    for (const [key, label, , tag] of NAV) {
      if (!allow.has(key)) continue;
      out.push({ id: "nav:" + key, module: "Navigation", route: key, title: label, sub: "", user: "", dateISO: "", path: `Home > ${label}`, text: (label + " " + key).toLowerCase(), navTask: null });
    }
    if (isAdmin) {
      [["Open CRM", "leads"], ["Open Finance", "accounts"], ["Open APN", "apn"], ["Create Lead", "lead"], ["Create Quotation", "quotation"], ["Create Project", "project"], ["Open Client", "clients"], ["Search Partner", "apn"], ["Search Employee", "team"]].forEach(([title, command]) => {
        out.push({ id: "ai-command:" + command + ":" + title, module: "AI commands", route: command === "lead" || command === "quotation" || command === "project" ? "ai-center" : command, title, sub: "Command bar", user: "", dateISO: "", path: `AI command > ${title}`, text: (title + " command ai").toLowerCase(), command });
      });
    }
    // people
    if (allow.has("team")) {
      for (const p of team) {
        if (p.role === "client") continue;
        out.push({ id: "user:" + p.id, module: "Team", route: "team", title: p.name, sub: ROLE_LABEL[p.role] || "", user: p.name, dateISO: "", path: `${ROLE_LABEL[p.role] || "Team"} > ${p.name}`, text: [p.name, p.email, p.designation, p.username, ROLE_LABEL[p.role]].filter(Boolean).join(" ").toLowerCase(), navTask: null });
      }
    }
    // data collections
    for (const s of SEARCH_SOURCES) {
      if (!allow.has(s.route)) continue;
      for (const x of (db[s.coll] || [])) {
        if (s.filter && !s.filter(x, ctx)) continue;
        const title = (s.title ? s.title(x) : "") || "—";
        out.push({ id: s.coll + ":" + (x.id || Math.random()), module: s.label, route: s.route, title, sub: s.sub ? (s.sub(x) || "") : "", user: s.user ? (s.user(x) || "") : "", dateISO: s.date ? (s.date(x) || "") : "", path: `${s.label} > ${title}`, text: searchHay(x), navTask: s.nav ? s.nav(x) : null });
      }
    }
    if (allow.has("audit")) {
      for (const a of (db.audit || [])) {
        const description = a.description || `${a.user || "System"} ${a.action || "performed an action"}`;
        out.push({ id: "audit:" + a.id, module: "Audit log", route: "audit", title: description, sub: activityModuleOf(a.module), user: a.user || "System", dateISO: a.ts ? new Date(a.ts).toISOString().slice(0, 10) : "", path: `Audit log > ${description}`, text: [a.user, description, a.entity, a.module, a.entityId, a.action].filter(Boolean).join(" ").toLowerCase(), navTask: null });
      }
    }
    return out;
  }, [db, team, allowKey, isAdmin, me.id, profile]);

  const results = useMemo(() => {
    const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) {
      // no query → show the modules as quick navigation
      return index.filter((r) => r.module === "Navigation").slice(0, 12);
    }
    const scored = [];
    for (const r of index) {
      if (!toks.every((t) => r.text.includes(t))) continue;
      const tl = r.title.toLowerCase();
      let score = 0;
      if (tl === toks.join(" ")) score += 100;
      if (toks.every((t) => tl.includes(t))) score += 40;         // all terms in the title
      if (tl.startsWith(toks[0])) score += 12;
      if (r.module === "Navigation") score += 6;
      scored.push({ r, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map((x) => x.r);
  }, [q, index]);

  useEffect(() => { setSel(0); }, [q]);
  const curSel = Math.min(sel, Math.max(0, results.length - 1));

  const openRec = (r) => {
    if (!r) return;
    onClose();
    if (r.navTask) return openTask(r.navTask);
    if (r.command === "lead") return openModal?.({ type: "lead" });
    if (r.command === "quotation") return openModal?.({ type: "quotation" });
    if (r.command === "project") return openModal?.({ type: "project" });
    return go(r.route);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); openRec(results[curSel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  // group results by module, preserving overall (scored) order and a flat index
  // for keyboard selection.
  const groups = [];
  const seen = new Map();
  let flat = 0;
  const flatOf = new Map();
  for (const r of results) {
    let g = seen.get(r.module);
    if (!g) { g = { module: r.module, items: [] }; seen.set(r.module, g); groups.push(g); }
    g.items.push(r); flatOf.set(r.id, flat++);
  }
  const routeIcon = (r) => (NAV.find((n) => n[0] === r)?.[2]) || FileText;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="cmdk" role="dialog" aria-modal="true" aria-label="Global search" onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key !== "Tab") return;
        const nodes = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex=\"-1\"])" ) || []);
        if (!nodes.length) return;
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        onKey(e);
      }}>
        <div className="cmdk-input">
          <Search size={20} color="var(--muted)" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search modules, people, projects, tasks, notes…" aria-label="Search all accessible records" />
          <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={onClose} title="Close search" aria-label="Close search"><X size={16} /></button>
        </div>
        <div className="cmdk-results">
          {results.length === 0 ? (
            <div className="cmdk-empty">No matches for “{q}”.</div>
          ) : groups.map((g) => (
            <div key={g.module}>
              <div className="cmdk-group">{g.module}</div>
              {g.items.map((r) => {
                const Icon = routeIcon(r.route);
                const fi = flatOf.get(r.id);
                return (
                  <div key={r.id} className={"cmdk-item" + (fi === curSel ? " on" : "")} onMouseEnter={() => setSel(fi)} onMouseDown={(e) => { e.preventDefault(); openRec(r); }}>
                    <div className="cmdk-ic"><Icon size={16} /></div>
                    <div className="cmdk-main">
                      <div className="cmdk-title"><SearchHighlight text={r.title} q={q} /></div>
                      <div className="cmdk-path">{r.path}{r.user ? ` · ${r.user}` : ""}</div>
                    </div>
                    <div className="cmdk-meta">
                      {r.dateISO && <span className="hint-line" style={{ fontSize: 11 }}>{fmtDate(r.dateISO)}</span>}
                      <span className="tag">{r.module}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="k">↑</span> <span className="k">↓</span> Navigate</span>
          <span><span className="k">↵</span> Open</span>
          <span><span className="k">Esc</span> Close</span>
          <span style={{ marginLeft: "auto" }}>Results respect your access</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APN — ALLBEE PARTNER NETWORK  (statewide commission-based partner portal)
   A logically separate subsystem: its own tables (apn_*), its own portal
   surface, its own permissions. Partners are independent, commission-only —
   never employees — and never touch internal accounts, balances, or the vault.
══════════════════════════════════════════════════════════════════════ */

const APN_ID_PREFIX = "APN-TN-";
const apnPadId = (n) => APN_ID_PREFIX + String(n).padStart(4, "0");
const apnLeadId = (n) => "APN-L-" + String(n).padStart(4, "0");
const APN_RESERVED_NUMBERS = new Set([2, 3]);
const APN_MIN_DYNAMIC_NUMBER = 6;
function apnNumberOf(value) { return Number(String(value || "").replace(/\D/g, "")) || 0; }
function apnIdFor(partner) {
  return partner?.apnId || "—";
}
function normalizeManualApnId(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  const match = raw.match(/^(?:APN-TN-)?(\d{4})$/);
  return match ? apnPadId(Number(match[1])) : null;
}
function nextAvailableApnNumber(rows = [], requested) {
  const occupied = new Set((rows || []).map((row) => apnNumberOf(row.apnId)).filter(Boolean));
  let number = Math.max(Number(requested) || 0, APN_MIN_DYNAMIC_NUMBER);
  while (occupied.has(number) || APN_RESERVED_NUMBERS.has(number)) number += 1;
  return number;
}
function resolveApnId(rows = [], requested) {
  const manual = normalizeManualApnId(requested);
  if (manual) {
    const duplicate = (rows || []).some((row) => apnIdFor(row) === manual || row.apnId === manual);
    if (duplicate) throw new Error(`${manual} is already assigned to another partner.`);
    return manual;
  }
  return apnPadId(nextAvailableApnNumber(rows));
}

const TN_DISTRICTS = ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"];

const APN_SERVICES = [["website", "Website Development"], ["marketing", "Digital Marketing"], ["course", "Course Admission"]];
const APN_SERVICE_LABEL = { website: "Website", marketing: "Digital marketing", course: "Course" };

// Single source of truth for APN progression: project 1 earns 10%, projects
// 2–9 earn 15%, and project 10 onward earns 20%.
const APN_COMMISSION_RULES = Object.freeze([
  Object.freeze({ key: 0, name: "Trainee Partner", rate: 10, minProject: 1, maxProject: 1 }),
  Object.freeze({ key: 1, name: "Active Partner", rate: 15, minProject: 2, maxProject: 9 }),
  Object.freeze({ key: 2, name: "Growth Partner", rate: 20, minProject: 10, maxProject: Infinity }),
]);
const APN_ADMIN_LEVELS = ["Trainee", "Partner", "Senior Partner", "District Head", "State Head"];
const APN_ADMIN_STATUSES = ["pending", "active", "inactive", "suspended", "deleted"];
const APN_PERCENT_MIN = 0;
const APN_PERCENT_MAX = 100;
function apnPercent(value, label) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < APN_PERCENT_MIN || number > APN_PERCENT_MAX) throw new Error(`${label} must be between 0 and 100.`);
  return number;
}
const APN_SUSPEND_REASONS = ["Spam", "Fake Leads", "Policy Violation", "Requested by Admin", "Other"];
const APN_WARNING_TYPES = ["Poor Lead Quality", "Fake Information", "Customer Complaint", "Spam Behaviour", "Policy Violation", "Inactivity", "Other"];
const APN_REACTIVATION_REASONS = ["Training Completed", "Investigation Closed", "Admin Decision", "Mistaken Suspension", "Other"];
const apnStatusLabel = (s) => ({ pending: "Pending", active: "Active", inactive: "Inactive", suspended: "Suspended", banned: "Banned", deleted: "Deleted", rejected: "Rejected" }[s] || s || "Pending");
const apnStatusClass = (s) => s === "active" ? "status-active" : s === "pending" ? "status-on_leave" : s === "suspended" || s === "banned" ? "status-terminated" : s === "inactive" ? "status-inactive" : s === "deleted" ? "status-deleted" : "status-on_leave";
const apnAdminLevel = (u, stats) => u?.level || (u?.role === "state_head" ? "State Head" : u?.role === "district_head" ? "District Head" : (stats?.level?.name || "Trainee").replace(/ Partner$/, ""));
const apnTargetFor = (db, pid, resetAt = 0) => [...(db.apn_targets || [])]
  .filter((t) => t.partnerId === pid && (t.createdAt || 0) > (resetAt || 0))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
const apnAttendanceScore = (db, pid, override) => {
  if (override != null && override !== "") return Number(override) || 0;
  const rows = (db.apn_attendance || []).filter((a) => a.partnerId === pid);
  if (!rows.length) return 0;
  const recent = rows.filter((a) => (a.createdAt || Date.parse(a.date || "") || 0) >= Date.now() - 30 * 86400000);
  return Math.min(100, Math.round((recent.length / 30) * 100));
};
const apnLastActivity = (db, pid, partner) => {
  const times = [partner?.lastActivity, partner?.lastCheckIn, partner?.lastLogin, partner?.updatedAt, partner?.createdAt];
  for (const coll of ["apn_attendance", "apn_leads", "apn_quotations", "apn_commissions"]) {
    for (const row of (db[coll] || [])) if (row.partnerId === pid) times.push(row.createdAt || row.updatedAt);
  }
  for (const row of apnCommissionProjectsOf(db, pid)) for (const collection of apnRevenueCollectionsOf(db, row.id)) times.push(collection.createdAt || collection.receivedDate);
  return Math.max(...times.map((x) => typeof x === "number" ? x : Date.parse(x || "") || 0));
};
const apnLastSeenAt = (partner, profile) => {
  const vals = [profile?.last_active, partner?.lastSeen, partner?.lastLogin, partner?.lastActivity, partner?.lastCheckIn];
  return Math.max(...vals.map((x) => typeof x === "number" ? x : Date.parse(x || "") || 0));
};
const apnLastSeenLabel = (partner, profile) => {
  const ts = apnLastSeenAt(partner, profile);
  if (!ts) return "Never Logged In";
  if (profile?.last_active && Date.now() - ts <= 2 * 60 * 1000) return "Online Now";
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const days = Math.floor(mins / 1440);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};
const apnHealthBand = (score) => score >= 95 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs Attention" : "Critical";
function apnHealthScore(db, partner, profile) {
  const pid = partner?.id;
  const stats = apnPartnerStats(db, pid);
  const attendance = Math.min(100, Number(partner?.attendanceScore ?? apnAttendanceScore(db, pid)) || 0);
  const lastActivity = apnLastActivity(db, pid, partner);
  const activity = lastActivity ? Math.max(0, Math.min(100, 100 - Math.floor((Date.now() - lastActivity) / 86400000) * 5)) : 0;
  const training = APN_SERVICES.length ? Math.round((APN_SERVICES.filter(([k]) => partner?.unlocked?.[k]).length / APN_SERVICES.length) * 100) : 0;
  const quiz = APN_SERVICES.length ? Math.round((APN_SERVICES.filter(([k]) => partner?.quizPasses?.[k] != null).length / APN_SERVICES.length) * 100) : 0;
  const leadQuality = stats.submitted ? Math.round(((stats.submitted - (db.apn_leads || []).filter((l) => l.partnerId === pid && APN_LEAD_REJECTED.has(l.status)).length) / stats.submitted) * 100) : 0;
  const conversions = stats.submitted ? Math.round((stats.converted / stats.submitted) * 100) : 0;
  const activeWarnings = (db.apn_warnings || []).filter((w) => w.partnerId === pid && w.status === "Active").length;
  const warnings = Math.max(0, 100 - activeWarnings * 20);
  const login = apnLastSeenAt(partner, profile) ? Math.max(0, Math.min(100, 100 - Math.floor((Date.now() - apnLastSeenAt(partner, profile)) / 86400000) * 10)) : 0;
  const score = Math.round(attendance * .15 + activity * .15 + training * .1 + quiz * .1 + leadQuality * .15 + conversions * .2 + warnings * .05 + login * .1);
  return { score, band: apnHealthBand(score), parts: { attendance, activity, training, quiz, leadQuality, conversions, warnings, login } };
}
const apnTimelineEntry = (partnerId, eventType, title, description, performedBy = "System", performedById = null, at = Date.now()) => ({
  id: `apn-timeline:${partnerId}:${eventType}`,
  partnerId, eventType, title, description, performedBy, performedById, createdAt: at,
});
function apnDerivedTimeline(db, partner) {
  const pid = partner.id;
  const out = [];
  if (partner.createdAt) out.push(apnTimelineEntry(pid, "registered", "Partner Registered", `${partner.name} joined the APN network.`, "System", null, partner.createdAt));
  if (partner.approvedAt) out.push(apnTimelineEntry(pid, "approved", "Approved by Super Admin", "The APN application was approved.", partner.approvedBy || "Super Admin", null, partner.approvedAt));
  if (partner.district && (partner.districtAssignedAt || partner.createdAt)) out.push(apnTimelineEntry(pid, "district-assigned", "District Assigned", `Assigned to ${partner.district}.`, partner.districtAssignedBy || "System", null, partner.districtAssignedAt || partner.createdAt));
  (db.apn_transfer_history || []).filter((x) => x.partnerId === pid).forEach((x) => out.push(apnTimelineEntry(pid, `district-changed:${x.id}`, "District Changed", `${x.previousDistrict || "Unassigned"} → ${x.newDistrict || "Unassigned"}${x.reason ? ` · ${x.reason}` : ""}.`, x.changedBy || "System", null, x.effectiveDate || x.createdAt)));
  const leads = (db.apn_leads || []).filter((x) => x.partnerId === pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const quotes = (db.apn_quotations || []).filter((x) => x.partnerId === pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const converted = leads.find((x) => x.status === "Converted");
  const commission = (db.apn_commissions || []).filter((x) => x.partnerId === pid).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (Object.keys(partner.quizPasses || {}).length) out.push(apnTimelineEntry(pid, "quiz-completed", "Quiz Completed", "A partner quiz was completed.", "System", null, partner.quizCompletedAt || partner.updatedAt || partner.createdAt));
  if (APN_SERVICES.every(([k]) => partner.unlocked?.[k])) out.push(apnTimelineEntry(pid, "training-completed", "Training Completed", "All APN training categories are complete.", "System", null, partner.trainingCompletedAt || partner.updatedAt || partner.createdAt));
  if (leads[0]) out.push(apnTimelineEntry(pid, "first-lead", "First Lead Submitted", `First lead submitted for ${leads[0].clientName || "a client"}.`, "System", null, leads[0].createdAt));
  if (quotes[0]) out.push(apnTimelineEntry(pid, "first-quotation", "First Quotation Generated", `First quotation generated for ${quotes[0].clientName || "a client"}.`, "System", null, quotes[0].createdAt));
  if (converted) out.push(apnTimelineEntry(pid, "first-conversion", "First Client Converted", `First client converted: ${converted.clientName || "client"}.`, "System", null, converted.updatedAt || converted.createdAt));
  if (commission[0]) out.push(apnTimelineEntry(pid, "first-commission", "First Commission Earned", `First commission recorded: ${money(commission[0].amount)}.`, "System", null, commission[0].createdAt));
  const paid = commission.find((x) => x.status === "Paid");
  if (paid) out.push(apnTimelineEntry(pid, "commission-paid", "Commission Paid", `${money(paid.amount)} commission was paid.`, "System", null, paid.paidAt || paid.updatedAt || paid.createdAt));
  apnCommissionProjectsOf(db, pid).forEach((project) => {
    out.push(apnTimelineEntry(pid, `commission-project:${project.id}`, "Commission Project Created", `${project.projectName || project.project || "Project"} · ${money(project.projectValue)} at ${project.commissionRate || project.rate || 0}%.`, project.createdBy || "Admin", null, project.createdAt));
    apnRevenueCollectionsOf(db, project.id).forEach((collection) => out.push(apnTimelineEntry(pid, `revenue-collection:${collection.id}`, "Revenue Collection Added", `Received ${money(collection.receivedAmount)} · commission credited ${money(collection.commissionGenerated)}${Number(collection.incentive) ? ` · incentive ${money(collection.incentive)}` : ""}.`, collection.createdBy || "Admin", null, collection.createdAt || collection.receivedDate)));
    const summary = apnProjectSummary(db, project);
    if (summary.status === "Completed") out.push(apnTimelineEntry(pid, `commission-completed:${project.id}`, "Project Completed", `Total commission ${money(summary.commissionEarned)}.`, "System", null, project.updatedAt || project.createdAt));
  });
  if (partner.promotedAt) out.push(apnTimelineEntry(pid, "promoted", "Promoted", "Partner was promoted to District Head.", partner.promotedBy || "Super Admin", null, partner.promotedAt));
  if (partner.demotedAt) out.push(apnTimelineEntry(pid, "demoted", "Demoted", "Partner level or hierarchy was changed.", partner.demotedBy || "Super Admin", null, partner.demotedAt));
  if (partner.suspendedAt) out.push(apnTimelineEntry(pid, "suspended", "Suspended", partner.suspensionReason || "Partner account suspended.", partner.suspendedBy || "Super Admin", null, partner.suspendedAt));
  if (partner.reactivatedAt) out.push(apnTimelineEntry(pid, "reactivated", "Reactivated", partner.reactivationReason || "Partner account reactivated.", partner.reactivatedBy || "Super Admin", null, partner.reactivatedAt));
  if (partner.deletedAt) out.push(apnTimelineEntry(pid, "deleted", "Deleted (Archived)", partner.deleteReason || "Partner account archived.", partner.deletedBy || "Super Admin", null, partner.deletedAt));
  return out;
}
const APN_TAG_OPTIONS = ["Website Expert", "Software Sales", "High Performer", "New Partner", "Needs Training", "Premium Partner", "Follow-up Required", "Top Closer"];
const APN_DOCUMENT_TYPES = ["Aadhaar", "PAN", "Bank Passbook", "Photo", "Agreement", "Certificate", "Other"];
const APN_COMMUNICATION_TYPES = ["Notification", "Email", "WhatsApp Message", "Manual Call", "Internal Message"];
const apnMonthKey = (date) => { const d = date instanceof Date ? date : new Date(date || 0); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
function apnMonthlyAnalytics(db, pid, count = 6) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - i - 1), 1);
    return { key: apnMonthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), leads: 0, revenue: 0, commission: 0, attendance: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  apnLeadsOf(db, pid).forEach((l) => { const row = byKey.get(apnMonthKey(l.createdAt)); if (row) { row.leads += 1; if (l.status === "Converted") row.revenue += Number(l.revenue) || 0; } });
  apnCommsOf(db, pid).forEach((c) => { const row = byKey.get(apnMonthKey(c.createdAt || c.paidAt)); if (row) { row.commission += Number(c.amount) || 0; if (c.source === "manual") { row.leads += 1; row.revenue += Number(c.revenue) || 0; } } });
  apnCommissionProjectsOf(db, pid).forEach((project) => apnRevenueCollectionsOf(db, project.id).forEach((collection) => { const row = byKey.get(apnMonthKey(collection.receivedDate || collection.createdAt)); if (row) { row.commission += Number(collection.commissionGenerated) || 0; row.revenue += Number(collection.receivedAmount) || 0; } }));
  (db.apn_attendance || []).filter((a) => a.partnerId === pid).forEach((a) => { const row = byKey.get(apnMonthKey(a.createdAt || a.at || a.date)); if (row) row.attendance += 1; });
  return months.map((m) => ({ ...m, revenue: round2(m.revenue), commission: round2(m.commission), attendance: Math.min(100, Math.round((m.attendance / new Date(Number(m.key.slice(0, 4)), Number(m.key.slice(5)) || 1, 0).getDate()) * 100)) }));
}
function apnActivityHistory(db, partner, profile) {
  const pid = partner.id;
  const rows = [];
  const add = (id, ts, eventType, title, description, user = "System") => { if (ts) rows.push({ id: `activity:${id}`, ts: typeof ts === "number" ? ts : Date.parse(ts) || 0, eventType, title, description, user }); };
  (db.apn_activity || []).filter((x) => x.partnerId === pid).forEach((x) => add(x.id, x.createdAt || x.ts, x.eventType || "activity", x.title || "Activity", x.description || "", x.performedBy || x.user || "System"));
  apnDerivedTimeline(db, partner).forEach((x) => add(x.id, x.createdAt, x.eventType, x.title, x.description, x.performedBy));
  (db.apn_timeline || []).filter((x) => x.partnerId === pid).forEach((x) => add(x.id, x.createdAt, x.eventType || "timeline", x.title, x.description, x.performedBy));
  apnLeadsOf(db, pid).forEach((x) => { add(`lead-created:${x.id}`, x.createdAt, "lead", "Lead Created", x.clientName || "Lead submitted", x.createdBy || "System"); if (x.updatedAt && x.updatedAt !== x.createdAt) add(`lead-updated:${x.id}`, x.updatedAt, "lead", "Lead Updated", `${x.clientName || "Lead"} · ${x.status || "updated"}`, x.updatedBy || "System"); });
  (db.apn_quotations || []).filter((x) => x.partnerId === pid).forEach((x) => add(`quotation:${x.id}`, x.createdAt, "quotation", "Quotation Generated", x.clientName || x.project || "Quotation", x.createdBy || "System"));
  apnCommsOf(db, pid).forEach((x) => add(`commission:${x.id}`, x.createdAt, "commission", `Commission ${x.status || "recorded"}`, `${money(x.amount)} · ${x.project || "Project"}`, x.updatedBy || "System"));
  apnCommissionProjectsOf(db, pid).forEach((project) => {
    add(`commission-project:${project.id}`, project.createdAt, "commission-project", "Commission Project Created", `${project.projectName || project.project || "Project"} · ${money(project.projectValue)}`, project.createdBy || "Admin");
    apnRevenueCollectionsOf(db, project.id).forEach((collection) => add(`revenue-collection:${collection.id}`, collection.createdAt || collection.receivedDate, "revenue-collection", "Revenue Collection Added", `Received ${money(collection.receivedAmount)} · commission credited ${money(collection.commissionGenerated)}${Number(collection.incentive) ? ` · incentive ${money(collection.incentive)}` : ""}`, collection.createdBy || "Admin"));
    if (apnProjectSummary(db, project).status === "Completed") add(`commission-project-completed:${project.id}`, project.updatedAt || project.createdAt, "project-completed", "Project Completed", `Total commission ${money(apnProjectSummary(db, project).commissionEarned)}.`, "System");
  });
  if (Object.keys(partner.unlocked || {}).length) add("training-started", partner.trainingStartedAt || partner.updatedAt, "training", "Training Started", "Partner training activity began.", "System");
  (db.apn_targets || []).filter((x) => x.partnerId === pid).forEach((x) => { const progress = apnTargetProgress(db, x); if (progress.goal && progress.raw >= progress.goal) add(`target-achieved:${x.id}`, x.achievedAt || x.updatedAt || x.createdAt, "target", "Target Achieved", x.title || "Target completed", "System"); });
  (db.apn_attendance || []).filter((x) => x.partnerId === pid).forEach((x) => add(`attendance:${x.id}`, x.createdAt || x.at, "attendance", "Attendance Check-in", x.date || "Partner checked in", x.createdBy || "System"));
  (db.apn_communications || []).filter((x) => x.partnerId === pid).forEach((x) => add(`communication:${x.id}`, x.createdAt, "communication", `${x.type || "Communication"} · ${x.status || "Logged"}`, x.subject || x.message || "", x.sender || "Admin"));
  (db.apn_notifications || []).filter((x) => x.audience === `partner:${pid}`).forEach((x) => add(`notification:${x.id}`, x.createdAt, "notification", "Notification", x.title || x.body || "", x.createdBy || "Admin"));
  (db.audit || []).filter((x) => x.module === "APN" && x.partnerId === pid).forEach((x) => add(`audit:${x.id}`, x.ts, "admin", "Administrative Action", x.action, x.user || "Admin"));
  if (partner.lastLogin || profile?.last_login) add("login", partner.lastLogin || profile.last_login, "login", "Login", "Partner signed in.", partner.name);
  if (partner.lastLogout) add("logout", partner.lastLogout, "logout", "Logout", "Partner signed out.", partner.name);
  return rows.filter((x) => x.ts).sort((a, b) => b.ts - a.ts);
}
function apnMilestones(db, partner) {
  const s = apnPartnerStats(db, partner.id);
  const leads = apnLeadsOf(db, partner.id).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const converted = leads.filter((x) => x.status === "Converted");
  const first = (id, label, done, at) => ({ id, label, done, at: at || null });
  const out = [first("first-lead", "First Lead", leads.length > 0, leads[0]?.createdAt), first("first-client", "First Client", converted.length > 0, converted[0]?.updatedAt || converted[0]?.createdAt)];
  [10000, 50000, 100000].forEach((value) => out.push(first(`revenue-${value}`, `₹${value.toLocaleString("en-IN")} Revenue`, s.revenue >= value, leads.find((x) => x.status === "Converted" && Number(x.revenue) >= value)?.createdAt)));
  [10, 50, 100].forEach((value) => out.push(first(`clients-${value}`, `${value} Clients`, s.converted >= value, converted[value - 1]?.updatedAt || converted[value - 1]?.createdAt)));
  out.push(first("district-head", "District Head Promotion", partner.role === "district_head" || partner.level === "District Head", partner.promotedAt));
  return out;
}
function apnRecommendations(db, partner, profile) {
  const s = apnPartnerStats(db, partner.id); const health = apnHealthScore(db, partner, profile); const out = [];
  if (s.completed >= 1 && partner.role !== "district_head") out.push("This partner qualifies for promotion.");
  if (health.parts.attendance < 50) out.push("Attendance has dropped significantly.");
  if (s.commission.pending > 0 || s.commission.payable > 0) out.push("Commission payout pending.");
  if (s.conv >= 50) out.push("High conversion rate.");
  if (apnLastActivity(db, partner.id, partner) && Date.now() - apnLastActivity(db, partner.id, partner) > APN_INACTIVE_DAYS * 86400000) out.push(`No activity in ${APN_INACTIVE_DAYS} days; requires follow-up.`);
  if (partner.role !== "district_head" && s.converted >= 10) out.push("Eligible for District Head review.");
  return out;
}
function apnRiskIndicators(db, partner, profile) {
  const s = apnPartnerStats(db, partner.id); const rejected = apnLeadsOf(db, partner.id).filter((x) => APN_LEAD_REJECTED.has(x.status)).length; const warnings = (db.apn_warnings || []).filter((x) => x.partnerId === partner.id && x.status === "Active").length; const out = [];
  if ((db.apn_warnings || []).some((x) => x.partnerId === partner.id && /complaint/i.test(x.type || "") && x.status === "Active")) out.push(["Multiple customer complaints", "neg"]);
  if (s.submitted >= 5 && rejected / s.submitted >= .35) out.push(["High rejection rate", "neg"]);
  if (!s.submitted || (apnLastActivity(db, partner.id, partner) && Date.now() - apnLastActivity(db, partner.id, partner) > APN_INACTIVE_DAYS * 86400000)) out.push(["Zero or low activity", "accent"]);
  if (apnAttendanceScore(db, partner.id, partner.attendanceScore) < 50) out.push(["Low attendance", "accent"]);
  if (warnings >= 2) out.push(["Warning accumulation", "neg"]);
  if (s.commission.pending > s.commission.earned * .75 && s.commission.pending > 0) out.push(["Commission anomaly: high pending balance", "accent"]);
  return out;
}
const apnLevelForCompleted = (n) => {
  const c = Number(n) || 0;
  return apnCommissionRuleForProject(c + 1);
};
const apnCommissionRuleForProject = (projectNumber) => {
  const number = Math.max(1, Number(projectNumber) || 1);
  return APN_COMMISSION_RULES.find((rule) => number >= rule.minProject && number <= rule.maxProject) || APN_COMMISSION_RULES[APN_COMMISSION_RULES.length - 1];
};
// Rate for the next project; prior completions determine its project number.
const apnRateForPrior = (prior) => apnCommissionRuleForProject((Number(prior) || 0) + 1).rate;
const apnNextLevel = (n) => {
  const c = Number(n) || 0;
  if (c >= 10) return null;
  const next = c < 2 ? APN_COMMISSION_RULES[1] : APN_COMMISSION_RULES[2];
  return { next, remaining: Math.max(0, next.minProject - c), pct: Math.min(100, Math.round((c / next.minProject) * 100)) };
};

const APN_LEAD_STATUS = ["Submitted", "Approved", "Duplicate", "Invalid", "Fake", "Quotation Sent", "Converted", "Lost"];
const APN_LEAD_REJECTED = new Set(["Duplicate", "Invalid", "Fake", "Lost"]);
const apnLeadTone = (s) => (s === "Converted" ? "pos" : APN_LEAD_REJECTED.has(s) ? "neg" : s === "Approved" || s === "Quotation Sent" ? "pri" : "");

const APN_COMM_STATUS = ["Pending", "Approved", "Payable", "Paid"];
const APN_COMM_REVERSED = "Reversed";
const apnCommTone = (s) => (s === "Paid" ? "pos" : s === "Payable" ? "accent" : s === "Approved" ? "pri" : s === APN_COMM_REVERSED ? "neg" : "");
// Commissions are paid on the 5th of the following month — never immediately.
function apnPayoutDate(fromISO) {
  const d = fromISO ? new Date(fromISO) : new Date();
  return localISODate(new Date(d.getFullYear(), d.getMonth() + 1, 5));
}

const APN_TARGET_METRICS = [["leads", "Leads"], ["conversions", "Conversions"], ["website", "Website projects"], ["course", "Course admissions"], ["marketing", "Marketing projects"]];
const apnMetricLabel = (m) => (APN_TARGET_METRICS.find((x) => x[0] === m)?.[1]) || "Leads";

/* ── WP4 — zones, campaigns, ties & governed targets ─────────────────── */
// The network runs on rolling month-based zones (zone1 … zone6). Each zone
// has a start/end window; a partner's zone is stored on their row (`zone`)
// and mirrors the apex zone they joined through a zone request.
const apnMonthStart = (offset = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); };
function apnZonePeriods(count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const start = apnMonthStart(i);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { key: `zone${i + 1}`, label: start.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), startAt: start.getTime(), endAt: end.getTime(), startIso: localISODate(start) };
  });
}
const apnZonePeriodKey = (ts) => {
  const t = Number(ts) || Date.now();
  return apnZonePeriods(6).find((p) => t >= p.startAt && t <= p.endAt)?.key || "zone1";
};
function apnCurrentZone(db) {
  const consoleRow = apnConsoleRow(db);
  const period = apnZonePeriods(6).find((p) => p.key === apnZonePeriodKey(consoleRow?.zoneStartAt || Date.now())) || apnZonePeriods(6)[0];
  return { key: period.key, label: period.label, period };
}
const apnZoneTone = (key) => ({ zone1: "pri", zone2: "pos", zone3: "accent", zone4: "pri", zone5: "pos", zone6: "accent" }[key] || "");
function apnZoneRank(db, pid, zoneKey) {
  const pool = apnLivePartners(db).filter((u) => (u.zone || apnZonePeriodKey(u.createdAt)) === zoneKey);
  const arr = pool.map((u) => ({ id: u.id, v: apnPartnerStats(db, u.id).revenue })).sort((a, b) => b.v - a.v);
  const idx = arr.findIndex((x) => x.id === pid);
  return { rank: idx < 0 ? null : idx + 1, total: arr.length };
}
function apnZoneStats(db, zoneKey) {
  const members = apnLivePartners(db).filter((u) => (u.zone || apnZonePeriodKey(u.createdAt)) === zoneKey);
  return {
    members: members.length,
    active: members.filter((u) => apnEffectiveStatus(u) === "active").length,
    revenue: round2(members.reduce((s, u) => s + apnPartnerStats(db, u.id).revenue, 0)),
    leads: members.reduce((s, u) => s + apnPartnerStats(db, u.id).submitted, 0),
    conversions: members.reduce((s, u) => s + apnPartnerStats(db, u.id).converted, 0),
    commissions: members.reduce((s, u) => s + apnPartnerStats(db, u.id).commission.earned, 0),
  };
}
// Sweep: every partner belongs to a zone; old rows without one are mapped from
// their registration month so the hub HUD is never empty.

// Hub console row: the admin-side campaign/zone settings live in a row of
// apn_admin_consoles tagged kind:"console". All hub cards read from here.
function apnConsoleRow(db) {
  return [...(db.apn_admin_consoles || [])].filter((c) => c.kind === "console").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || {};
}
function apnCampaignOf(db) {
  const c = apnConsoleRow(db);
  const memberCount = Number(c.apnMemberCount) || 0;
  const targetCount = Number(c.apnTargetCount) || 0;
  return {
    active: !!c.apnCampaignActive,
    memberCount,
    targetCount,
    message: c.apnCampaignMessage || `WORLDWIDE CAMPAIGN — ${memberCount} of ${targetCount} partners have joined`,
    joined: targetCount > 0 ? Math.min(100, Math.round((memberCount / targetCount) * 100)) : 0,
    under: targetCount > 0 && memberCount < targetCount,
  };
}
// One active admin-assigned target at a time per partner (the govern limit);
// anything the partner creates themselves does not count against them.
const APN_GOVERNED_TARGETS_LIMIT = 1;
function apnGovernedTargets(db, pid) {
  return (db.apn_targets || []).filter((t) => t.partnerId === pid && !t.selfCreated);
}
function apnGovernedLimit(db, pid) {
  const targets = apnGovernedTargets(db, pid);
  return { count: targets.length, limit: APN_GOVERNED_TARGETS_LIMIT, full: targets.length >= APN_GOVERNED_TARGETS_LIMIT };
}
function apnCalculatedGovernedExplanation(db, pid) {
  const g = apnGovernedLimit(db, pid);
  if (!g.count) return "No admin-assigned targets right now — your targets are your own.";
  if (g.full) return `You currently have ${g.count} admin-assigned target${g.count === 1 ? "" : "s"} (limit ${g.limit}). Acknowledge it on the Targets tab to clear the counter.`;
  return `You have ${g.count} admin-assigned target${g.count === 1 ? "" : "s"} of ${g.limit} allowed.`;
}
// Express tie-ups: submitting a lead/quote can mark a tie-up with the client.
// When the client also works with us on the other side of the deal the tie is
// reciprocal — both parties are governed by the same relationship.
const APN_TIEUPS = {
  website: ["Website + maintenance", "Referral swap", "Joint marketing"],
  marketing: ["Joint campaign", "Referral swap", "Regular retainer"],
  course: ["Admissions partner", "Campus referral", "Franchise interest"],
};
function apnReciprocal(db, meRow) {
  const mine = apnLeadsOf(db, meRow?.id).filter((l) => l.tieUp);
  if (!mine.length) return { any: false, count: 0 };
  const clients = new Set(mine.map((l) => String(l.mobile || "").replace(/\D/g, "")));
  let count = 0;
  for (const l of (db.apn_leads || [])) {
    if (!String(l.mobile || "").replace(/\D/g, "") || clients.has(String(l.mobile || "").replace(/\D/g, ""))) continue;
    if (mine.some((m) => String(m.mobile || "").replace(/\D/g, "") === String(l.mobile || "").replace(/\D/g, "") && l.partnerId !== meRow?.id)) count += 1;
  }
  return { any: count > 0, count };
}
// Express form rules: which fields a form surfaces depends on the chosen
// service (kept in one place so all three forms agree).
function apnFormRules(service) {
  switch (service) {
    case "website": return { showBusiness: true, showBudget: true, showCollege: false, showTieUps: true };
    case "marketing": return { showBusiness: true, showBudget: true, showCollege: false, showTieUps: true };
    case "course": return { showBusiness: false, showBudget: false, showCollege: true, showTieUps: true };
    default: return { showBusiness: true, showBudget: false, showCollege: true, showTieUps: true };
  }
}

/* ── partner lookups ─────────────────────────────────────────────────── */
const apnMe = (db, pid) => (db.apn_users || []).find((u) => u.id === pid) || null;
const apnAvatarUrl = (partner, profile) => partner?.profilePicture || partner?.photo_url || partner?.photoUrl || profile?.photo_url || "";
const apnUnlocked = (u) => (u && u.unlocked && typeof u.unlocked === "object" ? u.unlocked : {});

/* ── attendance & activity ───────────────────────────────────────────── */
const APN_INACTIVE_DAYS = 30;
const apnCheckedInToday = (db, pid) => (db.apn_attendance || []).some((a) => a.partnerId === pid && a.date === todayISO());
const apnAttendanceBase = (u) => Math.max(u?.lastCheckIn || 0, u?.reactivatedAt || 0, u?.approvedAt || 0, u?.createdAt || 0);
function apnAutoInactive(u) {
  if (!u || u.status !== "active") return false;
  const base = apnAttendanceBase(u);
  return !!base && (Date.now() - base) > APN_INACTIVE_DAYS * 86400000;
}
// pending / active / inactive / rejected / banned — auto-inactive after 30
// days with no check-in. A banned partner behaves like suspended everywhere.
const apnEffectiveStatus = (u) => {
  if (!u) return "pending";
  if (u.status === "banned") return "suspended";
  if (u.status === "active" && apnAutoInactive(u)) return "inactive";
  return u.status || "pending";
};
function apnAttendanceStreak(db, pid) {
  const days = new Set((db.apn_attendance || []).filter((a) => a.partnerId === pid).map((a) => a.date));
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const iso = localISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
    if (days.has(iso)) streak++;
    else if (i === 0) continue; // today not yet checked in — don't break the run
    else break;
  }
  return streak;
}

/* ── derived stats, ranks, leaderboards, achievements ────────────────── */
const apnLeadsOf = (db, pid) => (db.apn_leads || []).filter((l) => l.partnerId === pid);
const apnCommsOf = (db, pid) => (db.apn_commissions || []).filter((c) => c.partnerId === pid);
const apnCommissionProjectsOf = (db, pid) => (db.apn_commission_projects || []).filter((p) => !pid || p.partnerId === pid);
const apnRevenueCollectionsOf = (db, projectId) => (db.apn_revenue_collections || []).filter((c) => c.projectId === projectId);
function apnProjectStatus(project, received) {
  if (project?.status === "Cancelled") return "Cancelled";
  const value = Number(project?.projectValue) || 0;
  if (!received) return "Pending";
  return value > 0 && received >= value ? "Completed" : "Processing";
}
function apnProjectSummary(db, project) {
  const collections = apnRevenueCollectionsOf(db, project.id).slice().sort((a, b) => (a.receivedDate || a.createdAt || "").localeCompare(b.receivedDate || b.createdAt || ""));
  const projectValue = Math.max(0, Number(project.projectValue) || 0);
  const rate = Math.max(0, Math.min(100, Number(project.commissionRate) || 0));
  const maximumCommission = Math.max(0, Number(project.maximumCommission) || round2((projectValue * rate) / 100));
  const totalReceived = round2(collections.reduce((sum, row) => sum + Math.max(0, Number(row.receivedAmount) || 0), 0));
  const commissionEarned = round2(Math.min(maximumCommission, collections.reduce((sum, row) => sum + Math.max(0, Number(row.commissionGenerated) || 0), 0)));
  const totalIncentives = round2(collections.reduce((sum, row) => sum + Math.max(0, Number(row.incentive) || 0), 0));
  const totalCommissionPaid = round2(Math.max(Number(project.totalCommissionPaid) || 0, collections.filter((row) => row.commissionStatus === "Paid").reduce((sum, row) => sum + (Number(row.commissionGenerated) || 0), 0)));
  const remainingAmount = round2(Math.max(0, projectValue - totalReceived));
  const remainingCommission = round2(Math.max(0, maximumCommission - commissionEarned));
  return { ...project, projectValue, commissionRate: rate, maximumCommission, collections, totalReceived, commissionEarned, totalCommissionPaid, totalIncentives, remainingAmount, remainingCommission, status: apnProjectStatus(project, totalReceived) };
}
// Canonical finance↔APN acknowledgement state for a project: the posted
// income receipt and its auto-generated commission expense (if any).
function apnFinancePostedFor(db, projectId) {
  const posted = (db.transactions || []).find((t) => t.kind === "income" && t.apnProjectId === projectId);
  const expense = (db.transactions || []).find((t) => t.apnCommissionExpense && t.apnProjectId === projectId);
  return { posted, expense };
}
function apnCommissionDashboardSummary(db) {
  const projects = apnCommissionProjectsOf(db).map((project) => apnProjectSummary(db, project));
  const collections = db.apn_revenue_collections || [];
  return {
    totalValue: round2(projects.reduce((sum, project) => sum + project.projectValue, 0)),
    totalReceived: round2(projects.reduce((sum, project) => sum + project.totalReceived, 0)),
    outstanding: round2(projects.reduce((sum, project) => sum + project.remainingAmount, 0)),
    commissionPaid: round2(projects.reduce((sum, project) => sum + project.totalCommissionPaid, 0)),
    pendingCommission: round2(projects.reduce((sum, project) => sum + project.remainingCommission, 0)),
    processingProjects: projects.filter((project) => project.status === "Processing").length,
    completedProjects: projects.filter((project) => project.status === "Completed").length,
    projects: projects.length,
    collections: collections.length,
  };
}
function apnPartnerStats(db, pid) {
  const leads = apnLeadsOf(db, pid);
  const submitted = leads.length;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const manual = apnCommsOf(db, pid).filter((c) => c.kind !== "district" && c.source === "manual" && c.status !== APN_COMM_REVERSED);
  const completed = leads.filter((l) => l.projectCompleted).length + manual.length;
  const projectSummaries = apnCommissionProjectsOf(db, pid).map((project) => apnProjectSummary(db, project));
  const activeProjectSummaries = projectSummaries.filter((project) => project.status !== "Cancelled");
  const revenue = round2(leads.filter((l) => l.status === "Converted").reduce((s, l) => s + (Number(l.revenue) || 0), 0) + manual.reduce((s, c) => s + (Number(c.revenue) || 0), 0) + activeProjectSummaries.reduce((s, project) => s + project.totalReceived, 0));
  const conv = submitted ? Math.round((converted / submitted) * 100) : 0;
  const own = apnCommsOf(db, pid).filter((c) => c.kind !== "district" && c.status !== APN_COMM_REVERSED);
  const sumBy = (st) => round2(own.filter((c) => c.status === st).reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const projectEarned = round2(activeProjectSummaries.reduce((s, project) => s + project.commissionEarned, 0));
  const projectPaid = round2(activeProjectSummaries.reduce((s, project) => s + project.totalCommissionPaid, 0));
  const earned = round2(own.reduce((s, c) => s + (Number(c.amount) || 0), 0) + projectEarned);
  return {
    submitted, converted, completed: completed + activeProjectSummaries.filter((project) => project.status === "Completed").length, revenue, conv, level: apnLevelForCompleted(completed + activeProjectSummaries.filter((project) => project.status === "Completed").length),
    projects: activeProjectSummaries.length, completedProjects: activeProjectSummaries.filter((project) => project.status === "Completed").length, processingProjects: activeProjectSummaries.filter((project) => project.status === "Processing").length, collectionsReceived: activeProjectSummaries.reduce((s, project) => s + project.collections.length, 0), totalIncentives: round2(activeProjectSummaries.reduce((s, project) => s + project.totalIncentives, 0)),
    commission: { earned, pending: round2(sumBy("Pending") + activeProjectSummaries.reduce((s, project) => s + project.remainingCommission, 0)), approved: sumBy("Approved"), payable: sumBy("Payable"), paid: round2(sumBy("Paid") + projectPaid) },
    districtEarned: round2(apnCommsOf(db, pid).filter((c) => c.kind === "district" && c.status !== APN_COMM_REVERSED).reduce((s, c) => s + (Number(c.amount) || 0), 0)),
  };
}
// WP7 — authoritative engine values projected by the snapshot RPC (the same
// server-side source the ALLBEE AI uses). These helpers read ONLY the snapshot;
// they never recompute or totalize (no client-side wallet math). Each returns
// null when the snapshot is absent so callers can fall back to legacy figures.
const apnSnapshotWallet = (snap) => (snap?.wallet && typeof snap.wallet === "object" ? snap.wallet : null);
const apnSnapshotRate = (snap, completed) => {
  const ladder = (snap?.ruleKnowledge?.ladder || []).filter((r) => r.commissionType === "partner");
  if (!ladder.length) return null;
  const rule = ladder.find((r) => completed >= Number(r.tierMin) && completed <= (Number(r.tierMax) || Infinity)) || ladder[ladder.length - 1];
  return rule && Number.isFinite(Number(rule.percent)) ? Number(rule.percent) : null;
};
const apnLivePartners = (db) => (db.apn_users || []).filter((u) => u.status !== "rejected");
function apnRankBy(db, pid, scope, metric) {
  let pool = apnLivePartners(db);
  const meRow = apnMe(db, pid);
  if (scope === "district" && meRow) pool = pool.filter((u) => u.district === meRow.district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : metric === "leads" ? s.submitted : metric === "conversion" ? s.conv : metric === "attendance" ? apnAttendanceScore(db, u.id, u.attendanceScore) : metric === "health" ? apnHealthScore(db, u).score : s.completed; };
  const arr = pool.map((u) => ({ id: u.id, v: val(u) })).sort((a, b) => b.v - a.v);
  const idx = arr.findIndex((x) => x.id === pid);
  return { rank: idx < 0 ? null : idx + 1, total: arr.length };
}
function apnLeaderboard(db, scope, district, metric) {
  let pool = apnLivePartners(db);
  if (scope === "district" && district) pool = pool.filter((u) => u.district === district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : metric === "leads" ? s.submitted : metric === "conversion" ? s.conv : metric === "attendance" ? apnAttendanceScore(db, u.id, u.attendanceScore) : metric === "health" ? apnHealthScore(db, u).score : s.completed; };
  return pool.map((u) => ({ u, v: val(u) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 20);
}
const APN_ACHIEVEMENTS = [
  { id: "first_deal", em: "🏆", label: "First Deal Closed", test: (s) => s.converted >= 1 },
  { id: "first_lakh", em: "💰", label: "First ₹1 Lakh Revenue", test: (s) => s.revenue >= 100000 },
  { id: "ten_clients", em: "🤝", label: "First 10 Clients", test: (s) => s.converted >= 10 },
  { id: "fifty_club", em: "⭐", label: "50 Projects Club", test: (s) => s.completed >= 50 },
  { id: "hundred_club", em: "👑", label: "100 Projects Club", test: (s) => s.completed >= 100 },
];
function apnAchievementsFor(db, pid) {
  const s = apnPartnerStats(db, pid);
  const got = APN_ACHIEVEMENTS.map((a) => ({ ...a, done: a.test(s) }));
  const r = apnRankBy(db, pid, "district", "revenue");
  got.push({ id: "district_top", em: "🥇", label: "District Top Performer", done: r.rank === 1 && s.revenue > 0 });
  return got;
}

/* ── targets ─────────────────────────────────────────────────────────── */
function apnTargetProgress(db, t) {
  const leads = apnLeadsOf(db, t.partnerId).filter((l) => (l.createdAt || 0) >= (t.createdAt || 0));
  const metric = t.metric || "leads";
  let raw;
  if (metric === "leads") raw = leads.length;
  else if (metric === "conversions") raw = leads.filter((l) => l.status === "Converted").length;
  else raw = leads.filter((l) => l.status === "Converted" && l.service === metric).length;
  const goal = Number(t.goal) || 0;
  return { raw, count: goal ? Math.min(raw, goal) : raw, goal, pct: goal ? Math.min(100, Math.round((raw / goal) * 100)) : 0 };
}

/* ── notifications visibility ────────────────────────────────────────── */
function apnNotifVisible(n, meRow) {
  const a = n.audience || "all";
  if (a === "all") return true;
  if (a.startsWith("partner:")) return a.slice(8) === meRow?.id;
  if (a.startsWith("district:")) return a.slice(9) === meRow?.district;
  return true;
}

const APN_ACTION_PENDING_STATUSES = new Set(["pending", "under_review", "pending approval", "needs_publish", "unpublished", "draft"]);
const apnActionPending = (value) => APN_ACTION_PENDING_STATUSES.has(String(value || "").trim().toLowerCase());
const apnActionRowTime = (row) => {
  const value = row?.updatedAt ?? row?.createdAt ?? row?.updated_at ?? row?.created_at ?? row?.requested_at ?? row?.linked_at ?? row?.issuedAt ?? row?.uploadedAt;
  const text = String(value || "");
  const time = typeof value === "number" || /^\d{10,}$/.test(text) ? Number(value) : Date.parse(text);
  return Number.isFinite(time) ? time : 0;
};
const apnActionReadTime = (db, viewerId, actionType) => {
  const row = (db.apn_action_badge_reads || []).find((item) => item.user_id === viewerId && item.action_type === actionType);
  const time = row?.seen_at ? Date.parse(row.seen_at) : 0;
  return Number.isFinite(time) ? time : 0;
};
const apnUnseenActionCount = (rows, predicate, readAt) => (rows || []).filter((row) => predicate(row) && apnActionRowTime(row) > readAt).length;
function apnAdminActionCounts(db, viewerId) {
  const counts = {
    partner_pending: apnUnseenActionCount(db.apn_users, (row) => row.status === "pending", apnActionReadTime(db, viewerId, "partner_pending")),
    commission_pending: apnUnseenActionCount([...(db.apn_revenue_collections || []), ...(db.apn_commissions || [])], (row) => apnActionPending(row.commissionStatus || row.status), apnActionReadTime(db, viewerId, "commission_pending")),
    withdrawal_pending: apnUnseenActionCount([...(db.apn_withdrawal_requests || []), ...(db.apn_withdrawal_batches || [])], (row) => apnActionPending(row.status), apnActionReadTime(db, viewerId, "withdrawal_pending")),
    referral_pending: apnUnseenActionCount(db.apn_referral_earnings, (row) => row.status === "pending", apnActionReadTime(db, viewerId, "referral_pending")),
    target_action: apnUnseenActionCount(db.apn_targets, (row) => row.acknowledged === false, apnActionReadTime(db, viewerId, "target_action")),
    training_action: apnUnseenActionCount([...(db.apn_training || []), ...(db.apn_quizzes || [])], (row) => apnActionPending(row.status || row.approvalStatus), apnActionReadTime(db, viewerId, "training_action")),
    material_action: apnUnseenActionCount(db.apn_documents, (row) => row.published === false || apnActionPending(row.status || row.approvalStatus || row.publishStatus), apnActionReadTime(db, viewerId, "material_action")),
    notification_unread: apnUnseenActionCount(db.apn_notifications, () => true, apnActionReadTime(db, viewerId, "notification_unread")),
  };
  const result = Object.fromEntries(APN_ACTION_BADGE_MAP.map(({ actionType, tab }) => [tab, counts[actionType] || 0]));
  return {
    ...counts,
    ...result,
    training: counts.training_action,
    materials: counts.material_action,
    notify: counts.notification_unread,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
  };
}

/* ── commission generation (partner rate + 1% district-head override) ─── */
function apnBuildCommissions(d, lead) {
  const rows = [];
  const pid = lead.partnerId;
  const prior = apnPartnerStats({ ...d, apn_leads: (d.apn_leads || []).filter((row) => row.id !== lead.id) }, pid).completed;
  const rate = apnRateForPrior(prior);
  const revenue = Number(lead.revenue) || 0;
  const project = lead.business || lead.clientName || "Project";
  rows.push({ id: uid(), partnerId: pid, kind: "partner", leadId: lead.id, project, clientName: lead.clientName, service: lead.service, revenue, rate, amount: round2((revenue * rate) / 100), status: "Pending", createdAt: Date.now(), payoutDate: apnPayoutDate() });
  // District/state head income is NOT created here: the engine pays heads
  // server-side from apn_hierarchy_assignments on every revenue collection
  // (wp3 trigger, idempotency key col:<collection>:district). Client-side
  // kind=district rows would double-count that income (engine.district-client).
  return rows;
}

// Create the partner's APN row on first login from the details captured at
// sign-up (mirrors ensureProfile). Assigns the next APN-TN id. A partner who
// already holds an approved profile (invited by an admin) is activated
// immediately; everybody else enters the pending queue for approval.
async function ensureApnProfile(user, existingRows) {
  if ((existingRows || []).some((u) => u.id === user.id)) return false;
  let preApproved = false;
  let profileRow = null;
  try {
    const { data, error } = await supabase.from("profiles").select("approved,status,active,dob").eq("id", user.id).maybeSingle();
    if (!error && data) { profileRow = data; preApproved = !!data.approved && data.active !== false; }
  } catch { /* best effort — pending is a safe default */ }
  const meta = user.user_metadata?.apn || {};
  const n = nextAvailableApnNumber(existingRows, await nextApnNumber());
  const at = Date.now();
  const row = {
    id: user.id, apnId: apnPadId(n),
    name: meta.name || user.user_metadata?.name || (user.email ? user.email.split("@")[0] : "Partner"),
    mobile: meta.mobile || "", email: user.email || meta.email || "", dob: (profileRow?.dob ? localISODate(new Date(profileRow.dob)) : "") || meta.dob || "",
    district: meta.district || "", taluk: meta.taluk || "", city: meta.city || "",
    occupation: meta.occupation || "", college: meta.college || "", reason: meta.reason || "",
    username: (meta.username || "").toLowerCase(), referralCode: (meta.referralCode || "").trim().toUpperCase(),
    zone: apnZonePeriodKey(at),
    status: preApproved ? "active" : "pending", role: "partner", unlocked: {}, quizPasses: {}, createdAt: at,
    ...(preApproved ? { approvedAt: at, approvedBy: "ALLBEE (invited)" } : {}),
  };
  const { error } = await supabase.from("apn_users").upsert({ id: user.id, data: row, updated_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  if (preApproved) {
    const { error: profileError } = await supabase.from("profiles").update({ role: "partner", approved: true, active: true, status: "active" }).eq("id", user.id);
    if (profileError) throw new Error(profileError.message);
  }
  return true;
}

/* ── APN shared UI + gates ───────────────────────────────────────────── */
function APNGate({ isDark, icon, title, body, name, tone, onSignOut, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      emitToast("Status checked successfully", "success");
    } catch (e) {
      emitToast("Failed to check status", "error");
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card gate-card">
        <div className="lock-badge" style={tone === "neg" ? { background: "linear-gradient(135deg,var(--neg),#a92a2a)" } : undefined}>{icon}</div>
        <h1>{title}</h1>
        <p>{body}</p>
        {onRefresh && (
          <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            {refreshing ? "Checking status…" : "Check status"}
          </button>
        )}
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}
function APNMetric({ k, v, icon, tone, onClick }) {
  return <div className="apn-metric" role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined} style={onClick ? { cursor: "pointer" } : undefined}>
    <div className="k">{icon}{k}{onClick && <span className="hint-line" style={{ marginLeft: "auto", fontSize: 11 }}>View</span>}</div>
    <div className="v" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</div>
  </div>;
}

/* ── attendance check-in (Check in → type OK → confirm) ──────────────── */
function APNCheckIn({ db, pid, mutate }) {
  const [step, setStep] = useState("idle");
  const [word, setWord] = useState("");
  const done = apnCheckedInToday(db, pid);
  const streak = apnAttendanceStreak(db, pid);
  const check = () => {
    if (word.trim().toUpperCase() !== "OK") return;
    haptic([10, 30, 10]);
    mutate((d) => ({
      ...d,
      apn_attendance: [...(d.apn_attendance || []), { id: uid(), partnerId: pid, date: todayISO(), at: Date.now() }],
      apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, lastCheckIn: Date.now() } : u),
    }), { action: "checked in for APN attendance", module: "APN", entity: "APN Attendance", entityId: todayISO(), partnerId: pid });
    setStep("idle"); setWord("");
  };
  return (
    <div className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><UserCheck size={16} color={done ? "var(--pos)" : "var(--muted)"} />Daily attendance</div>
        <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>{done ? `Checked in today · ${streak}-day streak` : "Check in daily to stay active. 30 days missed = inactive."}</div>
      </div>
      {done ? <span className="badge pos">Present</span>
        : step === "idle" ? <button className="btn primary" onClick={() => setStep("typing")}><UserCheck size={15} />Check in</button>
          : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
              <input className="input" autoFocus value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") check(); }} placeholder='Type "OK" to confirm' style={{ flex: 1 }} />
              <button className="btn primary" onClick={check} disabled={word.trim().toUpperCase() !== "OK"}><Check size={15} />Confirm</button>
            </div>
          )}
    </div>
  );
}

/* ── inactive gate (needs Haji/Alim reactivation) ────────────────────── */
function APNInactive({ meRow, db, mutate, onSignOut, isDark, pid }) {
  const [f, setF] = useState(() => ({ mobile: meRow.mobile || "", email: meRow.email || "", address: meRow.address || "" }));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const recommend = () => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, reactivationRequested: Date.now() } : u) }), null);
  const saveContact = () => {
    setErr(""); setSaved(false);
    if (f.mobile.replace(/\D/g, "").length < 7) return setErr("Enter a valid mobile number.");
    if (!f.email.trim()) return setErr("Enter an email address.");
    mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, mobile: f.mobile.trim(), email: f.email.trim(), address: f.address.trim(), updatedAt: Date.now() } : u) }), { action: "updated contact details while inactive", module: "APN", partnerId: pid });
    setSaved(true);
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>

      <div className="lock-card gate-card" style={{ width: "min(92vw, 480px)" }}>
        <div className="lock-badge" style={{ background: "linear-gradient(135deg,var(--accent),#d98c00)" }}><Hourglass size={26} /></div>
        <h1>Account inactive</h1>
        <p>You've been marked inactive due to 30 days without attendance. Only an admin can reactivate your account — your district head can recommend it. Keep your contact details current so we can reach you.</p>
        {meRow.reactivationRequested ? <div className="auth-msg ok"><Check size={14} />Reactivation requested — waiting on approval.</div>
          : <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={recommend}><RefreshCw size={15} />Request reactivation</button>}
        <div className="apn-rowcard" style={{ marginTop: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="lbl"><Pencil size={14} /> Self-serve contact details</div>
          <div className="grid2" style={{ marginTop: 8 }}><Field label="Mobile number"><input className="input" value={f.mobile} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, mobile: e.target.value })); }} /></Field><Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, email: e.target.value })); }} /></Field></div>
          <Field label="Full address"><textarea className="textarea" value={f.address} onChange={(e) => { setSaved(false); setF((s) => ({ ...s, address: e.target.value })); }} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn primary" onClick={saveContact}><Check size={14} />Save details</button></div>
          {err && <div className="auth-msg err">{err}</div>}{saved && <div className="auth-msg ok"><Check size={14} />Contact details saved.</div>}
        </div>
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}

/* ── APN agreement governance (pr-apn-partner-agreements) ────────────────
   Versioned legal documents. Portal access is gated server-side by the
   apn_agreement_status RPC: while any required document is unaccepted the
   partner sees APNAgreementGate, not the portal. Acceptance is always
   recorded through the apn_agreement_accept RPC (identity + version + hash
   resolved server-side), never through mutate.                               */
const AGREEMENT_CATEGORIES = ["Agreement", "Terms & Conditions", "Commission Schedule", "Code of Conduct", "Privacy & Data Notice", "IP & Brand", "Confidentiality", "Lead & Client Management", "Quotation & Sales", "Training & Certification", "Suspension & Termination", "Dispute & Grievance"];

function APNAgreementReader({ doc, onClose, footer, simple = false, onToggleSimple }) {
  const simpleBody = doc.body_simple || doc.simpleBody || "";
  const body = (simple ? simpleBody : (doc.body || simpleBody)) || "";
  const simpleAvailable = !!(doc.body_simple || doc.simpleBody);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "min(94vw, 720px)", maxHeight: "88vh", overflow: "auto", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div className="cmdk-ic" style={{ flexShrink: 0 }}><ScrollText size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{doc.title}</div>
            <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>
              {doc.category} · Version {doc.version} · {doc.mandatory ? "Required document" : "Optional"} · Effective {fmtDate(doc.effectiveFrom || doc.effective_from)}
              {doc.material === undefined || doc.material === null ? "" : doc.material === false ? " · Editorial change" : " · Material change"}
              {doc.changeSummary || doc.change_summary ? ` · ${doc.changeSummary || doc.change_summary}` : ""}
            </div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close document" title="Close document"><X size={16} /></button>
        </div>
        {simpleAvailable && onToggleSimple && (
          <div style={{ display: "flex", gap: 6, margin: "10px 0 2px" }}>
            <button className={"btn xs" + (simple ? "" : " primary")} onClick={() => onToggleSimple(false)}>Full text</button>
            <button className={"btn xs" + (simple ? " primary" : "")} onClick={() => onToggleSimple(true)}>Simple English</button>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{body || "This document has no readable text yet."}</div>
        {footer}
      </div>
    </div>
  );
}

/* ── agreement review gate (step before the portal; amber, distinct from the
   suspended state's red and the pending state's purple) ──────────────────── */
function APNAgreementGate({ isDark, onSignOut, required = [], onAccepted }) {
  const [checks, setChecks] = useState(() => ({}));
  const [agree, setAgree] = useState(false);
  const [reading, setReading] = useState(null);
  const [views, setViews] = useState(() => ({}));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const allRead = required.length > 0 && required.every((d) => checks[d.id]);
  const markRead = (id) => { setReading(null); setChecks((s) => ({ ...s, [id]: true })); haptic([12]); };
  const acceptAll = async () => {
    setBusy(true); setErr("");
    try {
      for (const d of required) {
        const { error } = await supabase.rpc("apn_agreement_accept", { p_agreement_id: d.id, p_method: "explicit", p_terms_view: views[d.id] || "normal" });
        if (error) throw new Error(error.message);
      }
      await onAccepted?.();
    } catch (e) { setErr(e.message || "Your acceptance could not be recorded. Please try again."); setBusy(false); }
  };
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      {reading && <APNAgreementReader doc={reading} simple={!!views[reading.id]} onToggleSimple={(s) => setViews((v) => ({ ...v, [reading.id]: s }))} onClose={() => setReading(null)} footer={<button className="btn primary" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={() => markRead(reading.id)}><Check size={15} />I've read this document</button>} />}
      <div className="lock-card gate-card" style={{ width: "min(94vw, 540px)", maxHeight: "92vh", overflow: "auto" }}>
          <div className="lock-badge" style={{ background: "linear-gradient(135deg,#c8901b,#8a5f00)" }}><ScrollText size={26} /></div>
          <h1>Agreement review required</h1>
          <div style={{ display: "flex", justifyContent: "center", margin: "2px 0 8px" }}><span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}><BadgeCheck size={13} />{required.length} REQUIRED {required.length === 1 ? "DOCUMENT" : "DOCUMENTS"}</span></div>
          <p style={{ textAlign: "left" }}>ALLBEE has published updated partner agreement documents. You must read and accept the current versions below before you can continue using the APN portal.</p>
          <div style={{ marginTop: 12, textAlign: "left" }}>
            {required.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "9px 11px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--border)" }}>
                <input type="checkbox" checked={!!checks[d.id]} onChange={(e) => setChecks((s) => ({ ...s, [d.id]: e.target.checked }))} aria-label={`${d.title}: marked as read`} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{d.category} · Version {d.version}{d.mandatory ? " · Required" : ""}</div></div>
                <button className="btn sm" onClick={() => setReading(d)}><BookOpen size={13} />Read</button>
              </div>
            ))}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, textAlign: "left", marginTop: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
            <span><b>I agree</b> to the current versions of the documents above. I acknowledge this acceptance is recorded electronically with my name, the date and device information, and that ALLBEE may rely on it.</span>
          </label>
          {err && <div className="auth-msg err" style={{ marginTop: 8 }}>{err}</div>}
          <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={!allRead || !agree || busy} onClick={acceptAll}>{busy ? <RefreshCw size={16} className="spin" /> : <FileCheck2 size={16} />}{busy ? "Recording acceptance…" : allRead && agree ? "I Agree & Continue" : "Read and agree to continue"}</button>
          <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
          <div className="hint-line" style={{ fontSize: 11, marginTop: 10, textAlign: "center" }}>Need help? Contact ALLBEE through your usual support channel.</div>
        </div>
    </div>
  );
}

/* ── agreement center (portal tab): current published docs + accept state ─── */
function APNAgreementCenter({ db, pid, onRefresh }) {
  const [reading, setReading] = useState(null);
  const [views, setViews] = useState({});
  const [busyId, setBusyId] = useState(null);
  const published = (db.apn_agreements || []).filter((a) => a.status === "published");
  const byCode = new Map();
  for (const a of published) { const cur = byCode.get(a.code); if (!cur || a.version > cur.version) byCode.set(a.code, a); }
  const docs = Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  const myAccepts = new Map((db.apn_agreement_acceptances || []).filter((x) => x.partner_id === pid).map((x) => [x.agreement_id, x]));
  const satisfied = (d) => {
    const acc = myAccepts.get(d.id);
    if (acc && acc.version === d.version) return true;
    // mirror of the status RPC rule: a non-material bump is satisfied by
    // acceptance of the version it supersedes; a material bump always
    // requires a fresh acceptance.
    if (d.material === false && d.supersedes_id) return !!myAccepts.get(d.supersedes_id);
    return false;
  };
  const requiredOpen = docs.filter((d) => d.mandatory && !satisfied(d)).length;
  const accept = async (doc) => {
    setBusyId(doc.id);
    const { error } = await supabase.rpc("apn_agreement_accept", { p_agreement_id: doc.id, p_method: "explicit", p_terms_view: views[doc.id] || "normal" });
    setBusyId(null);
    if (error) emitToast(error.message, "error"); else { emitToast("Accepted — thank you.", "success"); onRefresh?.(); }
  };
  const company = (db.apn_agreement_company || [])[0];
  return (
    <div>
      <div className="apn-section-h">Agreements &amp; policies</div>
      <div className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 700 }}>{requiredOpen === 0 ? "All agreements accepted" : `${requiredOpen} required agreement${requiredOpen === 1 ? "" : "s"} not yet accepted`}</div><div className="hint-line" style={{ fontSize: 12 }}>Current versions are always binding; older versions are archived automatically.</div></div>
        {requiredOpen > 0 ? <span className="badge accent">{requiredOpen} Required</span> : <span className="badge pos"><Check size={12} />All accepted</span>}
      </div>
      <div className="apn-list">
        {docs.length === 0 ? <div className="apn-rowcard"><Empty icon={<ScrollText size={22} color="var(--muted)" />} title="No published agreements" text="Published agreements will appear here." /></div>
          : docs.map((d) => {
            const acc = myAccepts.get(d.id);
            const done = satisfied(d);
            return (
              <div key={d.id} className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="cmdk-ic"><ScrollText size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{d.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{d.category} · Version {d.version}{d.mandatory ? " · Required" : " · Optional"}{d.material === false ? " · Editorial" : ""}</div></div>
                {done ? <span className="badge pos"><Check size={12} />Accepted</span> : d.mandatory ? <span className="badge accent">Required</span> : <span className="badge">Optional</span>}
                <button className="btn sm" onClick={() => setReading(d)}><BookOpen size={13} />Read</button>
              </div>
            );
          })}
      </div>
      {company && (
        <div className="apn-rowcard" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{company.legal_name} · {company.trade_name}</div>
          <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>{company.address_line1}{company.address_line2 ? ", " + company.address_line2 : ""}, {company.city}, {company.state} {company.postal_code}, {company.country} · {company.email}</div>
          {(company.signatories || []).length > 0 && <div className="hint-line" style={{ fontSize: 11.5, marginTop: 4 }}>Signatories: {(company.signatories || []).map((s) => s.name + " (" + s.role + ")").join(" · ")}</div>}
        </div>
      )}
      {reading && <APNAgreementReader doc={reading} simple={!!views[reading.id]} onToggleSimple={(s) => setViews((v) => ({ ...v, [reading.id]: s }))} onClose={() => setReading(null)} footer={(() => { const done = satisfied(reading); const acc = myAccepts.get(reading.id); const acceptedNow = !!acc && acc.version === reading.version; return (
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {acceptedNow && <span className="badge pos" style={{ alignSelf: "center" }}><Check size={12} />Accepted · {fmtDate(acc.accepted_at)}</span>}
          {done && !acceptedNow && <span className="badge" style={{ alignSelf: "center" }}>Covered by your earlier acceptance (editorial change)</span>}
          <button className="btn" onClick={() => setReading(null)}><X size={14} />Close</button>
          {!done && <button className="btn primary" disabled={busyId === reading.id} onClick={() => accept(reading)}>{busyId === reading.id ? <RefreshCw size={14} className="spin" /> : <FileCheck2 size={14} />}{reading.material === false ? "Accept this document (editorial)" : "Accept this document"}</button>}
        </div>
      ); })()} />}
    </div>
  );
}

/* ── admin console: drafts → publish → acceptance coverage ──────────────── */

function APNStatusBadge({ status }) {
  return <span className={`badge ${APN_TICKET_TONE[status] || ""}`}>{status.replace(/_/g, " ")}</span>;
}

function APNAI({ meRow, go, mutate, pid }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(null);
  const [ticketDone, setTicketDone] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [msgs, busy, ticketDone]);

  const ask = async (q) => {
    const question = (q || input).trim();
    if (!question || busy) return;
    const history = msgs.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    setMsgs((l) => [...l, { role: "user", text: question, ts: Date.now() }]);
    setInput(""); setBusy(true); setAsked(null); setTicketDone("");
    try {
      const { data, error } = await supabase.functions.invoke("apn-ai", { body: { messages: [...history, { role: "user", content: question }] } });
      if (error) throw new Error(error.message || "Couldn't reach ALLBEE AI. Is the apn-ai function deployed?");
      if (data && data.error) throw new Error(typeof data.error === "string" ? data.error : "ALLBEE AI returned an error.");
      const text = String(data?.text || "").trim();
      const idx = msgs.length + 1;
      setMsgs((l) => [...l, { role: "bot", text, uncertain: !!data?.uncertain, ids: data?.relevantIds || [], rule: data?.ruleVersion || "", ts: Date.now() }]);
      if (data?.uncertain) setAsked({ question, msgIdx: idx, clientKey: uid() });
    } catch (e) {
      setMsgs((l) => [...l, { role: "bot", text: e.message, err: true, ts: Date.now() }]);
    } finally { setBusy(false); }
  };

  const createTicket = async () => {
    if (!asked || busy) return;
    setBusy(true);
    try {
      const bot = msgs[asked.msgIdx];
      const { data, error } = await supabase.rpc("apn_support_tickets_create", {
        p_category: apnAiCategoryFor(asked.question),
        p_question: asked.question.slice(0, 2000),
        p_ai_summary: bot ? bot.text.slice(0, 8000) : "",
        p_relevant_ids: bot?.ids || [],
        p_priority: "normal",
        p_client_key: asked.clientKey,
      });
      if (error) throw new Error(error.message);
      if (data && data.error) throw new Error(data.error);
      setTicketDone("Your ticket has been created. Our team typically follows up within 24 hours.");
      setAsked(null);
    } catch (e) {
      setTicketDone("Couldn't create the ticket: " + e.message);
    } finally { setBusy(false); }
  };

  const saveQuote = (qq, status) => {
    mutate((d) => ({ ...d, apn_quotations: (d.apn_quotations || []).some((x) => x.id === qq.id) ? d.apn_quotations.map((x) => x.id === qq.id ? qq : x) : [...(d.apn_quotations || []), qq] }), { action: "generated APN quotation", module: "APN", entity: "APN Quotation", entityId: qq.id, partnerId: pid });
    emitToast(status === "Draft" ? "Quotation draft saved." : "Quotation sent for approval.", "success");
  };

  return (
    <div className="apn-ai">
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--primary)" />
          <div style={{ fontWeight: 800, flex: 1 }}>ALLBEE AI</div>
          <button className="btn sm" onClick={() => go("support")}><MessageCircle size={13} />My tickets</button>
        </div>
        <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Your personal APN assistant — answers are built from your live ALLBEE records, not guesses.</div>
      </div>

      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        {msgs.length === 0 && (
          <div className="hint-line" style={{ marginBottom: 10, fontSize: 12.5 }}>Try one of these:</div>
        )}
        <div className="apn-ai-chips">
          <button type="button" className="apn-ai-chip" style={{ borderColor: "var(--pos)", color: "var(--pos)" }} onClick={() => setQuoteOpen(true)}><FileText size={12} />Generate Quotation</button>
          {APN_AI_CHIPS.map(([label, q]) => (
            <button key={label} className="apn-ai-chip" disabled={busy} onClick={() => ask(q)}><Sparkles size={12} />{label}</button>
          ))}
        </div>
      </div>

      <div className="apn-rowcard">
        <div className="apn-ai-chat" ref={chatContainerRef}>
          {msgs.map((m, i) => (
            <div key={i}>
              <div className={"apn-ai-msg " + (m.role === "user" ? "user" : m.err ? "err" : "bot")} style={{ lineHeight: 1.55 }}>
                {m.role === "user" || m.err ? m.text : renderAIText(m.text)}
              </div>
              {m.uncertain && asked && asked.msgIdx === i && (
                <div style={{ marginTop: 8, marginLeft: "4%" }}>
                  <div className="hint-line" style={{ fontSize: 12, marginBottom: 6 }}>Would you like me to create a support ticket?</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn sm primary" disabled={busy} onClick={createTicket}><Check size={13} />Yes</button>
                    <button className="btn sm" disabled={busy} onClick={() => setAsked(null)}><X size={13} />No</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="apn-ai-msg bot" style={{ color: "var(--muted)" }}><span className="ai-dot" style={{ marginRight: 6 }}>●</span>ALLBEE AI is checking your records…</div>}
          {ticketDone && <div className="apn-ai-msg bot" style={{ borderColor: "var(--pos)" }}>{ticketDone}</div>}
        </div>

        <div className="apn-ai-input" style={{ marginTop: 10 }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder={`Ask about your wallet, commissions, withdrawals${meRow?.role === "district_head" ? ", district" : ""} or rules…`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          />
          <button className="btn primary" disabled={busy || !input.trim()} onClick={() => ask()} aria-label="Send" title="Send" style={{ minWidth: 46, height: 46 }}><Send size={17} /></button>
        </div>
      </div>

      {quoteOpen && <React.Suspense fallback={<div className="card" aria-busy="true">Loading quotation…</div>}><LazyAPNQuoteWizard meRow={meRow} go={go} onClose={() => setQuoteOpen(false)} onSave={saveQuote} runtime={{ APN_SERVICES, Field, Modal, QUOTE_BUSINESS_EMAIL, QUOTE_DISCLAIMER, QUOTE_SERVICE_LABEL, QUOTE_SITE_TYPES, QUOTE_STEP_LABELS, QUOTE_TECHS, QUOTE_URGENT_RATE, emitToast, money, round2, shareQuoteVia, uid }} /></React.Suspense>}
    </div>
  );
}

function APNSupportTickets({ pid, refreshTick = 0 }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("apn_support_tickets_list", { p_limit: 100 });
      if (error) { setErr(error.message); return; }
      setRows(Array.isArray(data) ? data : []);
    })();
  }, [pid, refreshTick]);
  return (
    <div className="apn-ai">
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MessageCircle size={16} color="var(--primary)" /><div style={{ fontWeight: 800, flex: 1 }}>My support tickets</div></div>
        <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Official responses here are final — ALLBEE AI explains them, never overrides them.</div>
      </div>
      {err && <div className="banner" style={{ marginBottom: 12, borderColor: "var(--neg)" }}><AlertTriangle size={15} />{err}</div>}
      {!rows ? <div className="hint-line" style={{ padding: "16px 4px" }}>Loading tickets…</div>
        : rows.length === 0 ? <div className="apn-rowcard"><div className="hint-line" style={{ padding: "12px 4px", fontSize: 13 }}>You don't have any support tickets yet. Ask ALLBEE AI anything — if it can't find the answer, it will offer to create one for you.</div></div>
          : rows.map((t) => (
            <div key={t.id} className="apn-rowcard" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{t.ticket_no}</span>
                <span className="badge">{t.category}</span>
                <APNStatusBadge status={t.status} />
                <span className="hint-line" style={{ marginLeft: "auto", fontSize: 11 }}>{fmtDateTime(t.created_at)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13.5 }}>{t.question}</div>
              {t.ai_summary && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>AI summary: {String(t.ai_summary).slice(0, 220)}{t.ai_summary.length > 220 ? "…" : ""}</div>}
              {(t.admin_response || t.superadmin_response) && (
                <div style={{ marginTop: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Official response — {t.superadmin_response ? "Super Admin" : "Admin"}{t.admin_responded_at && <span className="hint-line" style={{ fontWeight: 500, marginLeft: 8 }}>{fmtDateTime(t.admin_responded_at)}</span>}</div>
                  <div style={{ fontSize: 13 }}>{t.superadmin_response || t.admin_response}</div>
                </div>
              )}
            </div>
          ))}
    </div>
  );
}

function APNAdminSupport({ isSuper, people }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [respondTo, setRespondTo] = useState(null);
  const [response, setResponse] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase.rpc("apn_support_tickets_list", { p_limit: 300 });
    if (error) { setErr(error.message); return; }
    setRows(Array.isArray(data) ? data : []);
  };
  useEffect(() => { load(); }, []);

  const sendResponse = async () => {
    if (!respondTo || !response.trim() || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("apn_support_tickets_respond", {
        p_ticket_id: respondTo.id,
        p_response: response.trim(),
        p_status: isSuper && nextStatus ? nextStatus : null,
      });
      if (error) throw new Error(error.message);
      if (data && data.error) throw new Error(data.error);
      setRespondTo(null); setResponse(""); setNextStatus(""); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const changeStatus = async (t, st) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("apn_support_tickets_status", { p_ticket_id: t.id, p_status: st });
      if (error) throw new Error(error.message);
      if (data && data.error) throw new Error(data.error);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const counts = (s) => (rows || []).filter((r) => s === "all" || r.status === s).length;
  const list = (rows || []).filter((r) => filter === "all" || r.status === filter);
  const adminStatuses = APN_TICKET_STATUSES.filter((s) => !["resolved", "closed"].includes(s));

  return (
    <div>
      {err && <div className="banner" style={{ marginBottom: 12, borderColor: "var(--neg)" }}><AlertTriangle size={15} />{err}</div>}
      <div className="apn-seg-scroll" style={{ marginBottom: 14 }}>{["all", ...APN_TICKET_STATUSES].map((s) => <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s === "all" ? "All" : s.replace(/_/g, " ")} ({counts(s)})</button>)}</div>
      {list.length === 0 ? <Empty icon={<MessageCircle size={22} color="var(--muted)" />} title="No tickets here" text="Support tickets raised from ALLBEE AI appear here for the admin team." />
        : <div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards"><thead><tr><th>Ticket</th><th>Partner</th><th>Category</th><th>Question</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td data-label="Ticket"><span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{t.ticket_no}</span>{t.priority !== "normal" && <div><span className={`badge ${t.priority === "urgent" || t.priority === "high" ? "neg" : "accent"}`}>{t.priority}</span></div>}</td>
              <td data-label="Partner">{people?.(t.partner_id) || t.partner_id}</td>
              <td data-label="Category"><span className="badge">{t.category}</span></td>
              <td data-label="Question"><div style={{ maxWidth: "100%" }}>{String(t.question).slice(0, 80)}{t.question?.length > 80 ? "…" : ""}</div>{t.admin_response && <div className="hint-line" style={{ fontSize: 11, maxWidth: "100%" }}>Answered: {String(t.admin_response).slice(0, 60)}…</div>}</td>
              <td data-label="Status"><select className="select" style={{ width: "auto", padding: "4px 6px" }} value={t.status} disabled={busy} onChange={(e) => changeStatus(t, e.target.value)}>{(isSuper ? APN_TICKET_STATUSES : adminStatuses).map((s) => <option key={s}>{s}</option>)}</select></td>
              <td data-label="Created" className="hint-line" style={{ fontSize: 11 }}>{fmtDateTime(t.created_at)}</td>
              <td className="apn-card-act"><button className="btn sm primary" disabled={busy} onClick={() => { setRespondTo(t); setResponse(""); setNextStatus(""); }}>Respond</button></td>
            </tr>
          ))}
        </tbody></table></div>}

      {respondTo && (
        <Modal title={`Respond — ${respondTo.ticket_no}`} onClose={() => setRespondTo(null)}
          footer={<><button className="btn" onClick={() => setRespondTo(null)}>Cancel</button><button className="btn primary" disabled={busy || !response.trim()} onClick={sendResponse}><Check size={15} />Send official response</button></>}>
          <div className="hint-line" style={{ marginBottom: 8, fontSize: 12 }}>This response becomes the final authoritative answer for this case. ALLBEE AI may explain it to the partner but never overrides it.</div>
          <Field label={`Question — ${respondTo.category}`}><div style={{ fontSize: 13, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>{respondTo.question}{respondTo.ai_summary ? <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>AI summary: {String(respondTo.ai_summary).slice(0, 240)}</div> : null}</div></Field>
          <Field label="Official response"><textarea className="textarea" rows={5} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write the official ALLBEE response…" /></Field>
          {isSuper && (
            <Field label="Super Admin authority — status after responding" hint="Only Super Admin can resolve/close a case.">
              <select className="select" style={{ width: "100%" }} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                <option value="">Keep current</option>{APN_TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}

function APNHome({ db, meRow, stats, snap, pid, go, openModal, mutate, onOpenProfile, profile }) {
  const snapWallet = apnSnapshotWallet(snap);
  const effRate = apnSnapshotRate(snap, stats.completed) ?? stats.level.rate;
  const next = apnNextLevel(stats.completed);
  const cRank = apnRankBy(db, pid, "company", "revenue");
  const dRank = apnRankBy(db, pid, "district", "revenue");
  const targets = (db.apn_targets || []).filter((t) => t.partnerId === pid);
  const activeTarget = targets.find((t) => apnTargetProgress(db, t).pct < 100) || targets[0];
  const campaign = apnCampaignOf(db);
  const zone = apnCurrentZone(db);
  const zRank = apnZoneRank(db, pid, zone.key);
  const zStats = apnZoneStats(db, zone.key);
  const myZoneRequest = (db.apn_zone_requests || []).find((r) => r.partnerId === pid && ["pending", "requested"].includes(r.status));
  const reciprocal = apnReciprocal(db, meRow);
  const refEarnings = (db.apn_referral_earnings || []).filter((row) => row.referrer_id === pid);
  const refPending = refEarnings.filter((row) => row.status === "pending").reduce((s, row) => s + (Number(row.referral_amount) || 0), 0);
  // Auto zone join: the first time a partner has no zone they are placed into
  // the current apex zone through a zone request (approved by the hub admin).
  const autoZoneRef = React.useRef(false);
  React.useEffect(() => {
    if (autoZoneRef.current || !meRow?.id || meRow.zone || myZoneRequest) return;
    autoZoneRef.current = true;
    const row = { id: uid(), partnerId: meRow.id, partnerName: meRow.name, zone: zone.key, status: "pending", notes: "Auto-joined the current apex zone", auto: true, createdAt: Date.now() };
    mutate((d) => ({ ...d, apn_zone_requests: [...(d.apn_zone_requests || []), row], apn_users: (d.apn_users || []).map((u) => u.id === meRow.id ? { ...u, zone: zone.key, zoneRequestedAt: Date.now() } : u) }), { action: `auto-joined the ${zone.label} apex zone`, module: "APN", partnerId: meRow.id });
  }, [meRow?.id, meRow?.zone, zone.key]);
  const requestZoneChange = () => {
    if (myZoneRequest) return;
    const row = { id: uid(), partnerId: meRow.id, partnerName: meRow.name, zone: zone.key, status: "pending", notes: "Manual zone change request", auto: false, createdAt: Date.now() };
    mutate((d) => ({ ...d, apn_zone_requests: [...(d.apn_zone_requests || []), row] }), { action: `requested the ${zone.label} apex zone`, module: "APN", partnerId: meRow.id });
  };
  return (
    <div>
      {campaign.active && campaign.under && (
        <div className="banner" style={{ margin: "0 0 14px" }}><Megaphone size={15} />{campaign.message} — <b>Target: {campaign.targetCount}</b></div>
      )}
      <div className="apn-lvl" style={{ marginBottom: 14 }}>
        <div className="apn-hero">
          <button type="button" aria-label="Open My Profile" onClick={onOpenProfile} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", borderRadius: 999 }}>
            <Avatar name={meRow.name} url={apnAvatarUrl(meRow, profile)} size={42} fontSize={17} style={{ background: "rgba(255,255,255,.22)", color: "#fff" }} />
          </button>
          <button type="button" aria-label="Open My Profile" onClick={onOpenProfile} style={{ flex: 1, minWidth: 0, border: 0, padding: 0, background: "none", color: "inherit", textAlign: "left", cursor: "pointer" }}>
            <div className="nm">{meRow.name}</div>
            <div className="rate">{apnIdFor(meRow)} · {stats.level.name} · {effRate}% commission</div>
          </button>
          {meRow.role === "district_head" && <span className="badge" style={{ background: "rgba(255,255,255,.9)", color: "var(--primary)" }}>District Head</span>}
        </div>
        {next ? (
          <>
            <div className="bar"><i style={{ width: next.pct + "%" }} /></div>
            <div style={{ fontSize: 12, opacity: .9, marginTop: 7 }}>{next.remaining} more completed project{next.remaining === 1 ? "" : "s"} to reach {next.next.name} ({apnSnapshotRate(snap, next.next.minProject) ?? next.next.rate}%)</div>
          </>
        ) : <div style={{ fontSize: 12, opacity: .9, marginTop: 10 }}>Highest commission level achieved ({effRate}%)</div>}
      </div>

      <div style={{ marginBottom: 14 }}><APNCheckIn db={db} pid={pid} mutate={mutate} /></div>

      <button className="apn-ai-banner" type="button" onClick={() => go("ai")} aria-label="Open ALLBEE AI">
        <span className="apn-ai-banner-ic"><Sparkles size={17} /></span>
        <span className="apn-ai-banner-main"><b>ALLBEE AI</b><span>Ask anything about your wallet, commissions & rules — or escalate to support.</span></span>
        <span className="apn-ai-banner-go"><ChevronRight size={16} /></span>
      </button>

      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={15} color="var(--primary)" /><div style={{ fontWeight: 700, flex: 1 }}>Apex zone — {zone.label}</div>
          <span className={"badge " + apnZoneTone(zone.key)}>{zStats.members} members</span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
          <div><div className="hint-line" style={{ fontSize: 11 }}>Zone revenue</div><div className="mono" style={{ fontWeight: 700 }}>{money(zStats.revenue)}</div></div>
          <div><div className="hint-line" style={{ fontSize: 11 }}>Zone leads</div><div className="mono" style={{ fontWeight: 700 }}>{zStats.leads}</div></div>
          <div><div className="hint-line" style={{ fontSize: 11 }}>Your zone rank</div><div className="mono" style={{ fontWeight: 700 }}>{zRank.rank ? `#${zRank.rank}` : "—"}{zRank.total ? ` / ${zRank.total}` : ""}</div></div>
        </div>
        <div style={{ marginTop: 10 }}>{myZoneRequest ? <span className="badge pri">Zone request pending</span> : <button className="btn sm" onClick={requestZoneChange}>Request zone change</button>}</div>
      </div>

      <div className="apn-metrics appear" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Commission earned" v={money(snapWallet ? Number(snapWallet.earned) : stats.commission.earned)} icon={<Coins size={13} />} tone="pos" />
        <APNMetric k="Payable" v={money(snapWallet ? Number(snapWallet.eligible) : stats.commission.payable)} icon={<Wallet size={13} />} tone="accent" />
        <APNMetric k="Paid" v={money(snapWallet ? Number(snapWallet.withdrawn) : stats.commission.paid)} icon={<Check size={13} />} />
        <APNMetric k="Leads submitted" v={stats.submitted} icon={<UserPlus size={13} />} />
        <APNMetric k="Leads converted" v={stats.converted} icon={<BadgeCheck size={13} />} />
        <APNMetric k="Conversion rate" v={stats.conv + "%"} icon={<GaugeCircle size={13} />} />
        <APNMetric k="Completed projects" v={stats.completed} icon={<Trophy size={13} />} />
      </div>

      <div className="apn-metrics appear" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
        <div className="apn-metric"><div className="k"><Trophy size={13} />Company rank</div><div className="v">{cRank.rank ? `#${cRank.rank}` : "—"}<span className="hint-line" style={{ fontSize: 12, fontWeight: 500 }}> / {cRank.total}</span></div></div>
        <div className="apn-metric"><div className="k"><MapPin size={13} />District rank</div><div className="v">{dRank.rank ? `#${dRank.rank}` : "—"}<span className="hint-line" style={{ fontSize: 12, fontWeight: 500 }}> · {meRow.district || "—"}</span></div></div>
      </div>

      {activeTarget && (() => { const p = apnTargetProgress(db, activeTarget); return (
        <div className="apn-rowcard" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Target size={15} color="var(--primary)" /><div style={{ fontWeight: 700, flex: 1 }}>{activeTarget.title}</div><span className="badge pri">{p.raw}/{p.goal}</span></div>
          <div className="progress-track" style={{ marginTop: 10 }}><div className="progress-fill" style={{ width: p.pct + "%" }} /></div>
          {!activeTarget.acknowledged && <button className="btn sm primary" style={{ marginTop: 10 }} onClick={() => go("targets")}>Acknowledge target</button>}
        </div>
      ); })()}

      {(reciprocal.any || refEarnings.length > 0) && (
        <div className="apn-rowcard" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Handshake size={15} color="var(--primary)" /><div style={{ fontWeight: 700, flex: 1 }}>Your referrals</div>
            {refEarnings.length > 0 && <span className="badge pos">{money(refPending)} pending</span>}
          </div>
          <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>
            {reciprocal.any ? `${reciprocal.count} reciprocal tie-up${reciprocal.count === 1 ? "" : "s"} active — both sides governed by the same relationship.` : `${refEarnings.length} referral earning${refEarnings.length === 1 ? "" : "s"} on record.`}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go("network")}><Users size={13} />Open referral dashboard</button>
        </div>
      )}

      <div className="apn-metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button className="apn-more-item" onClick={() => openModal({ type: "apnLead" })}><UserPlus size={20} color="var(--primary)" />Submit a lead</button>
        <button className="apn-more-item" onClick={() => go("learn")}><GraduationCap size={20} color="var(--primary)" />Training & quiz</button>
      </div>
    </div>
  );
}

/* ── leads ───────────────────────────────────────────────────────────── */

function APNQuoteForm({ meRow, initial, onSave, onClose }) {
  const [service, setService] = useState(initial?.service || "website");
  const [price, setPrice] = useState(null);
  const [priceBusy, setPriceBusy] = useState(true);
  const [clientName, setClientName] = useState(initial?.clientName || "");
  const [requirements, setRequirements] = useState(initial?.requirements || "");
  const [tieUp, setTieUp] = useState(initial?.tieUp || "");
  const [items, setItems] = useState(initial?.items || null);
  React.useEffect(() => {
    let alive = true;
    setPriceBusy(true);
    supabase.rpc("knowledge_get_pricing", { p_service: service }).then(({ data, error }) => {
      if (!alive) return;
      setPrice(error ? { base: null, baseLabel: "Custom quotation", options: [], customQuote: true } : (data || { base: null, baseLabel: "Custom quotation", options: [], customQuote: true }));
      setPriceBusy(false);
    });
    return () => { alive = false; };
  }, [service]);
  React.useEffect(() => {
    if (!initial && price && !priceBusy) setItems(price.base == null ? [] : [{ id: uid(), label: price.baseLabel || "Base service", amount: Number(price.base) || 0 }]);
  }, [initial, price, priceBusy]);
  const base = items || (price?.base == null ? [] : [{ id: uid(), label: price.baseLabel || "Base service", amount: Number(price.base) || 0 }]);
  const list = items || base;
  const total = list.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const addOpt = (label, amount) => setItems((prev) => [...(prev || base), { id: uid(), label, amount }]);
  const upItem = (id, k, v) => setItems((prev) => (prev || base).map((it) => it.id === id ? { ...it, [k]: k === "amount" ? Number(v) || 0 : v } : it));
  const rmItem = (id) => setItems((prev) => (prev || base).filter((it) => it.id !== id));
  const save = (status) => {
    if (!clientName.trim()) return;
    onSave({ id: initial?.id || uid(), partnerId: meRow.id, partnerName: meRow.name, clientName: clientName.trim(), service, requirements: requirements.trim(), tieUp, items: list, total: round2(total), status, createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit quotation" : "Generate quotation"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn" onClick={() => save("Draft")} disabled={!clientName.trim()}>Save draft</button><button className="btn primary" onClick={() => save("Sent for approval")} disabled={!clientName.trim()}><Send size={15} />Send for approval</button></>}>
      <div className="grid2">
        <Field label="Client name" required><input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client / business" /></Field>
        <Field label="Service"><select className="select" value={service} onChange={(e) => setService(e.target.value)} disabled={!!initial?.id}>{APN_SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <Field label="Requirements"><textarea className="textarea" value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="What does the client need?" /></Field>
      <Field label="Tie-up with the client" hint="Express an optional tie-up — reciprocal deals govern both sides of the relationship.">
        <select className="select" value={tieUp} onChange={(e) => setTieUp(e.target.value)}>
          <option value="">No tie-up</option>
          {(APN_TIEUPS[service] || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Add-ons" hint={priceBusy ? "Loading official pricing…" : price?.customQuote ? "This service is quoted after scope review." : "Tap to add an official add-on — you can edit every line below."}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(price?.options || []).map((option) => <button key={option.key} type="button" className="preset" disabled={priceBusy} onClick={() => addOpt(option.label, Number(option.amount) || 0)}>+ {option.label} {option.amount != null ? `(₹${Number(option.amount).toLocaleString("en-IN")})` : "(custom quote)"}</button>)}</div>
      </Field>
      <Field label="Quotation lines">
        <div className="apn-list">{list.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" value={it.label} onChange={(e) => upItem(it.id, "label", e.target.value)} style={{ flex: 1 }} />
            <input className="input mono" type="number" value={it.amount} onChange={(e) => upItem(it.id, "amount", e.target.value)} style={{ width: 110 }} />
            <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => rmItem(it.id)}><X size={14} /></button>
          </div>
        ))}</div>
        <div className="calc-box" style={{ marginTop: 10 }}><div className="calc-row"><b>Total</b><b className="mono">{money(total)}</b></div></div>
      </Field>
    </Modal>
  );
}
function APNQuotations({ db, meRow, pid, openModal }) {
  const list = (db.apn_quotations || []).filter((q) => q.partnerId === pid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const tone = (s) => s === "Approved" ? "pos" : s === "Rejected" ? "neg" : s === "Sent for approval" ? "accent" : "";
  return (
    <div>
      <div className="apn-section-h">Quotations</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<FileText size={22} color="var(--muted)" />} title="No quotations yet" text="Generate an approximate quotation for a client in seconds." action={<button className="btn primary" onClick={() => openModal({ type: "apnQuote" })}><Plus size={16} />New quotation</button>} /></div>
        : <div className="apn-list">{list.map((q) => (
          <div key={q.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{q.clientName}</div><div className="hint-line" style={{ fontSize: 12 }}>{APN_SERVICE_LABEL[q.service]} · {money(q.total)}</div></div>
              <span className={"badge " + tone(q.status)}>{q.status}</span>
            </div>
            {q.tieUp && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}><Handshake size={12} style={{ verticalAlign: -2 }} /> Tie-up: {q.tieUp}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn sm" onClick={() => downloadQuotePdf(q, meRow)}><Download size={13} />PDF</button>
              <button className="btn sm" onClick={() => shareQuoteVia(q, "email")}><Mail size={13} />Email</button>
              <button className="btn sm" onClick={() => shareQuoteVia(q, "whatsapp")}><MessageCircle size={13} />WhatsApp</button>
              {q.status !== "Approved" && <button className="btn sm" onClick={() => openModal({ type: "apnQuote", initial: q })}><Pencil size={13} />Edit</button>}
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── wallet ──────────────────────────────────────────────────────────── */
function APNWithdrawalRequestModal({ db, pid, onClose, onDone }) {
  const account = (db.apn_withdrawal_bank_accounts || []).find((row) => row.partner_id === pid && row.active);
  const [walletType, setWalletType] = useState("commission");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(account?.upi_id ? "upi" : "bank_transfer");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wallet = apnWithdrawalWalletFor(db, pid, walletType);
  const value = Number(amount) || 0;
  const max = Number(wallet.withdrawable) || 0;
  const valid = value > 0 && value <= max && !!account;
  const submit = async () => {
    setError("");
    if (!account) return setError("Add payout details in your profile before requesting a withdrawal.");
    if (!valid) return setError(value <= 0 ? "Enter an amount above ₹0." : `The request cannot exceed ${money(max)}.`);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("apn_request_withdrawal", { p_wallet_type: walletType, p_amount: value, p_preferred_method: method, p_reason: reason.trim() || null, p_notes: notes.trim() || null });
      if (rpcError) throw rpcError;
      emitToast("Withdrawal request submitted.", "success");
      await onDone?.(); onClose();
    } catch (err) { setError(err?.message || "Couldn’t submit the withdrawal."); }
    finally { setBusy(false); }
  };
  return <Modal title="Request withdrawal" onClose={onClose}
    footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit} disabled={!valid || busy}><ArrowDownToLine size={15} />{busy ? "Submitting…" : "Request withdrawal"}</button></>}>
    <div className="banner" style={{ margin: "0 0 12px" }}><LockIcon size={15} />Funds are locked immediately when you submit this request, so they cannot be requested twice.</div>
    <Field label="Wallet type" required><select className="select" value={walletType} onChange={(e) => { setWalletType(e.target.value); setAmount(""); }}>
      {APN_WITHDRAWAL_TYPES.map(([key, label]) => <option key={key} value={key}>{label} · available {money(apnWithdrawalWalletFor(db, pid, key).withdrawable)}</option>)}
    </select></Field>
    <div className="calc-box"><div className="calc-row"><span>Withdrawable {apnWalletLabel(walletType)}</span><b className="mono">{money(max)}</b></div><div className="calc-row"><span>Currently locked</span><b className="mono">{money(wallet.locked)}</b></div></div>
    <Field label="Amount" required error={amount && value <= 0 ? "Enter an amount above ₹0." : value > max ? `Maximum available is ${money(max)}.` : ""}>
      <div style={{ display: "flex", gap: 7 }}><input className="input mono" style={{ flex: 1 }} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /><button type="button" className="btn sm" onClick={() => setAmount(String(max))} disabled={max <= 0}>Max</button></div>
    </Field>
    <Field label="Preferred method" required><div className="seg"><button type="button" className={method === "upi" ? "on" : ""} onClick={() => setMethod("upi")} disabled={!account?.upi_id}>UPI</button><button type="button" className={method === "bank_transfer" ? "on" : ""} onClick={() => setMethod("bank_transfer")} disabled={!account?.account_number}>Bank transfer</button></div></Field>
    {account && <div className="hint-line" style={{ marginTop: -5, marginBottom: 10 }}>{method === "upi" ? `UPI: ${account.upi_id}` : `${account.bank_name || "Bank"} · ••••${String(account.account_number || "").slice(-4)}`} · verification {account.verification_status}</div>}
    <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" /></Field>
    <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional settlement note" /></Field>
    {error && <div className="auth-msg err"><AlertTriangle size={14} />{error}</div>}
  </Modal>;
}


function APNReferralMetric({ label, value, icon, tone }) {
  return <APNMetric k={label} v={value} icon={icon} tone={tone} />;
}

function APNQuizTaker({ quiz, onPass, onClose }) {
  const [ans, setAns] = useState({});
  const [result, setResult] = useState(null);
  const qs = quiz.questions || [];
  const submit = () => {
    const correct = qs.filter((q, i) => ans[i] === q.answer).length;
    const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
    setResult({ pct, correct, pass: pct >= (quiz.passPct || 60) });
    if (pct >= (quiz.passPct || 60)) onPass(pct);
  };
  return (
    <Modal title={quiz.title || "Quiz"} onClose={onClose}
      footer={result ? <button className="btn primary" onClick={onClose}>Done</button> : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit} disabled={Object.keys(ans).length < qs.length}><Check size={15} />Submit quiz</button></>}>
      {result ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 40 }}>{result.pass ? "🎉" : "😕"}</div>
          <h3 style={{ margin: "8px 0" }}>{result.pct}% — {result.pass ? "Passed!" : "Not passed"}</h3>
          <p className="hint-line">{result.pass ? `${APN_SERVICE_LABEL[quiz.category]} leads are now unlocked.` : `You need ${quiz.passPct || 60}% to pass. Review the training and try again.`}</p>
        </div>
      ) : qs.map((q, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {q.q}</div>
          {(q.options || []).map((opt, oi) => (
            <div key={oi} className={"apn-quiz-opt" + (ans[i] === oi ? " sel" : "")} onClick={() => setAns((s) => ({ ...s, [i]: oi }))}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (ans[i] === oi ? "var(--primary)" : "var(--border)"), background: ans[i] === oi ? "var(--primary)" : "transparent", flex: "none" }} />
              <span>{opt}</span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
function APNTraining({ db, meRow, pid, mutate }) {
  const [cat, setCat] = useState("website");
  const [quiz, setQuiz] = useState(null);
  const unlocked = apnUnlocked(meRow);
  const articles = (db.apn_training || []).filter((t) => t.category === cat).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const catQuiz = (db.apn_quizzes || []).find((q) => q.category === cat);
  const passQuiz = (score) => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, unlocked: { ...(u.unlocked || {}), [cat]: true }, quizPasses: { ...(u.quizPasses || {}), [cat]: score }, quizCompletedAt: Date.now() } : u) }), { action: `completed APN ${APN_SERVICE_LABEL[cat] || cat} quiz`, module: "APN", entity: "APN Quiz", entityId: cat, partnerId: pid, metadata: { score } });
  return (
    <div>
      <div className="apn-section-h">Training</div>
      <div className="apn-seg-scroll">{APN_SERVICES.map(([k, l]) => <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>{l}{unlocked[k] ? " ✓" : ""}</button>)}</div>
      <div className="apn-list">
        {articles.length === 0 && <div className="apn-rowcard"><Empty icon={<GraduationCap size={22} color="var(--muted)" />} title="No lessons yet" text="Training material for this category will appear here." /></div>}
        {articles.map((a) => (
          <div key={a.id} className="apn-rowcard">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{a.title}</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14, color: "var(--ink)" }}>{a.body}</div>
          </div>
        ))}
        <div className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 700 }}>{APN_SERVICE_LABEL[cat]} sales quiz</div>
            <div className="hint-line" style={{ fontSize: 12 }}>{unlocked[cat] ? `Passed (${meRow.quizPasses?.[cat] ?? "✓"}%) — leads unlocked.` : catQuiz ? "Pass 60% to unlock lead submission." : "Quiz coming soon."}</div>
          </div>
          {unlocked[cat] ? <span className="badge pos">Unlocked</span>
            : catQuiz ? <button className="btn primary" onClick={() => setQuiz(catQuiz)}><ClipboardCheck size={15} />Take quiz</button>
              : <span className="badge">No quiz</span>}
        </div>
      </div>
      {quiz && <APNQuizTaker quiz={quiz} onPass={passQuiz} onClose={() => setQuiz(null)} />}
    </div>
  );
}

/* ── targets ─────────────────────────────────────────────────────────── */
function APNTargets({ db, pid, mutate, go }) {
  const list = (db.apn_targets || []).filter((t) => t.partnerId === pid).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const ack = (t) => mutate((d) => ({ ...d, apn_targets: (d.apn_targets || []).map((x) => x.id === t.id ? { ...x, acknowledged: true, acknowledgedAt: Date.now() } : x) }), null);
  // Deep link #/targets/<id> — acknowledge the target the head sent you to and
  // surface it, so a notification tap lands exactly where it should.
  const ackRef = React.useRef(null);
  React.useEffect(() => {
    const raw = String(window.location.hash || "").replace(/^#\/?/, "").split("?")[0].split("/");
    if (raw[0] !== "targets" || !raw[1]) return;
    const target = list.find((t) => t.id === decodeURIComponent(raw[1]));
    if (!target) return;
    if (!target.acknowledged && !ackRef.current) {
      ackRef.current = target.id;
      ack(target);
      window.history.replaceState(null, "", "#/apn/targets");
    }
  }, [list]);
  const governed = apnGovernedLimit(db, pid);
  const explanation = apnCalculatedGovernedExplanation(db, pid);
  return (
    <div>
      <div className="apn-section-h">My targets</div>
      <div className="banner" style={{ margin: "0 0 12px" }}><ShieldCheck size={15} />{explanation}{governed.full && <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => go("home")}>Back to overview</button>}</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<Target size={22} color="var(--muted)" />} title="No targets assigned" text="Targets from your admin or district head will show up here." /></div>
        : <div className="apn-list">{list.map((t) => { const p = apnTargetProgress(db, t); return (
          <div key={t.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{t.title}</div><div className="hint-line" style={{ fontSize: 12 }}>{t.goal} {apnMetricLabel(t.metric).toLowerCase()} · by {t.assignedByName || "Admin"}{t.selfCreated ? " · self-assigned" : " · governed"}{t.parValue ? ` · par ${t.parValue}%` : ""}</div>{t.parentName && <div className="hint-line" style={{ fontSize: 12 }}>Parent: {t.parentName}</div>}{t.prescriptionIds && <div className="hint-line" style={{ fontSize: 12 }}>Prescriptions: {String(t.prescriptionIds).replace(/[;,]\s*/g, ", ")}</div>}</div>
              <span className={"badge " + (p.pct >= 100 ? "pos" : "pri")}>{p.raw}/{p.goal}</span>
            </div>
            <div className="progress-track" style={{ marginTop: 10 }}><div className="progress-fill" style={{ width: p.pct + "%", background: p.pct >= 100 ? "var(--pos)" : "var(--primary)" }} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              {t.acknowledged ? <span className="badge pos"><Check size={11} style={{ marginRight: 3 }} />Acknowledged</span> : <button className="btn sm primary" onClick={() => ack(t)}><Check size={13} />Acknowledge target</button>}
            </div>
          </div>
        ); })}</div>}
      <div className="apn-rowcard" style={{ marginTop: 14 }}>
        <div className="lbl"><ListChecks size={14} /> Data guide</div>
        <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Progress is calculated from leads submitted after the target was created. Admin-assigned targets are governed: at most {APN_GOVERNED_TARGETS_LIMIT} at a time, acknowledged by you here. Your own self-set targets never count against the limit.</div>
      </div>
    </div>
  );
}

/* ── documents ───────────────────────────────────────────────────────── */
function APNDocuments({ db }) {
  const list = (db.apn_documents || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-section-h">Sales materials</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<FileText size={22} color="var(--muted)" />} title="No materials yet" text="Scripts, price lists, brochures and posters uploaded by admin appear here." /></div>
        : <div className="apn-list">{list.map((d) => (
          <div key={d.id} className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cmdk-ic"><FileText size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{d.title}</div><div className="hint-line" style={{ fontSize: 12 }}>{d.category || "Material"}{d.notes ? " · " + d.notes : ""}</div></div>
            <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><Download size={13} />Open</a>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── notifications ───────────────────────────────────────────────────── */
function APNNotifications({ db, meRow }) {
  const list = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow)).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-section-h">Notifications</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text="Training, commission and target updates will appear here." /></div>
        : <div className="apn-list">{list.map((n) => (
          <div key={n.id} className="apn-rowcard">
            {(() => { const sender = apnNotificationSender(n); return <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={sender.name} url={sender.avatar} size={26} fontSize={10} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{n.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{sender.name} · {sender.designation}</div></div>{n.level && n.level !== "General" && <span className={"badge " + (n.level === "Urgent" ? "neg" : "accent")}>{n.level}</span>}</div>; })()}
            {n.body && <div style={{ marginTop: 5, fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>{n.body}</div>}
            <div className="hint-line" style={{ fontSize: 11, marginTop: 6 }}>{fmtDateTime(n.createdAt)}</div>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── achievements ────────────────────────────────────────────────────── */
function APNAchievements({ db, pid }) {
  const list = apnAchievementsFor(db, pid);
  return (
    <div>
      <div className="apn-section-h">Achievements</div>
      <div className="apn-list">{list.map((a) => (
        <div key={a.id} className={"apn-ach" + (a.done ? "" : " lock")}>
          <span className="em">{a.em}</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{a.label}</div><div className="hint-line" style={{ fontSize: 12 }}>{a.done ? "Unlocked" : "Locked"}</div></div>
          {a.done && <BadgeCheck size={18} color="var(--pos)" />}
        </div>
      ))}</div>
    </div>
  );
}

/* ── leaderboard ─────────────────────────────────────────────────────── */
function APNLeaderboard({ db, meRow, pid }) {
  const [scope, setScope] = useState("company");
  const [metric, setMetric] = useState("revenue");
  const rows = apnLeaderboard(db, scope, meRow?.district, metric);
  const fmtVal = (v) => (["projects", "leads"].includes(metric) ? String(v) : ["conversion", "attendance", "health"].includes(metric) ? `${v}%` : money(v));
  return (
    <div>
      <div className="apn-section-h">Leaderboard</div>
      <div className="apn-seg-scroll">
        <button className={scope === "company" ? "on" : ""} onClick={() => setScope("company")}>Company</button>
        <button className={scope === "district" ? "on" : ""} onClick={() => setScope("district")}>My district</button>
      </div>
      <div className="apn-seg-scroll">
        {[["revenue", "Top revenue"], ["commission", "Top commission"], ["projects", "Top projects"]].map(([k, l]) => <button key={k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{l}</button>)}
      </div>
      <div className="apn-rowcard">
        {rows.length === 0 ? <Empty icon={<Trophy size={22} color="var(--muted)" />} title="No ranking yet" text="Close deals to climb the leaderboard." />
          : rows.map((r, i) => (
            <div key={r.u.id} className="apn-rank" style={r.u.id === pid ? { background: "var(--primary-soft)", borderRadius: 10 } : undefined}>
              <div className={"pos" + (i === 0 ? " g1" : i === 1 ? " g2" : i === 2 ? " g3" : "")}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.u.name} url={apnAvatarUrl(r.u)} size={30} /><div><div style={{ fontWeight: 600 }}>{r.u.name}{r.u.id === pid ? " (you)" : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{r.u.district || "—"}</div></div></div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmtVal(r.v)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── Head management cockpits ────────────────────────────────────────── */
const apnDistrictHeadMembers = (db, meRow) => {
  const rows = db.apn_hierarchy_assignments || [];
  const assigned = new Set(rows.filter((r) => r.district_head_id === meRow.id && r.status !== "inactive").map((r) => r.partner_id));
  const district = meRow.district || "";
  return (db.apn_users || []).filter((u) => u.id !== meRow.id && u.role === "partner" && u.status !== "rejected" && u.status !== "banned" && (assigned.has(u.id) || (!assigned.size && u.district === district)));
};
const apnStateScope = (db, meRow) => {
  const rows = db.apn_hierarchy_assignments || [];
  const assigned = new Set(rows.filter((r) => r.state_head_id === meRow.id && r.status !== "reassigned").map((r) => r.partner_id));
  const state = String(meRow.state || "").trim().toLowerCase();
  const namespace = String(meRow.apnId || "").toUpperCase().split("-").slice(0, 2).join("-");
  const districts = new Set((db.apn_users || []).filter((u) => u.role === "district_head" && state && String(u.state || "").trim().toLowerCase() === state).map((u) => u.district).filter(Boolean));
  return (db.apn_users || []).filter((u) => {
    if (u.id === meRow.id || u.role !== "partner" || u.status === "rejected" || u.status === "banned") return false;
    const uState = String(u.state || "").trim().toLowerCase();
    const uNamespace = String(u.apnId || "").toUpperCase().split("-").slice(0, 2).join("-");
    return assigned.has(u.id) || (state && uState === state) || (districts.has(u.district)) || (namespace && uNamespace === namespace);
  });
};
function APNHeadPartnerCard({ db, partner, mutate, viewer, allowActions = true, onApprove, onReject, onLogCall, onRecommend }) {
  const stats = apnPartnerStats(db, partner.id);
  const status = apnEffectiveStatus(partner);
  const target = (db.apn_targets || []).find((t) => t.partnerId === partner.id);
  const progress = target ? apnTargetProgress(db, target) : null;
  const recommend = () => onRecommend ? onRecommend(partner) : mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, reactivationRecommended: Date.now(), reactivationRecommendedBy: viewer.name } : u) }), { action: "recommended partner reactivation", module: "APN", entity: "Partner", entityId: partner.id, partnerId: viewer.id });
  const logCall = () => onLogCall ? onLogCall(partner) : mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, lastHeadCallAt: Date.now(), lastHeadCallBy: viewer.name } : u) }), { action: "logged head call", module: "APN", entity: "Partner", entityId: partner.id, partnerId: viewer.id });
  return <div className="apn-rowcard apn-head-partner-card">
    <div className="apn-head-partner-main"><Avatar name={partner.name} size={38} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 750 }}>{partner.name} <span className="badge pri" style={{ marginLeft: 5 }}>{stats.level.name}</span></div><div className="hint-line">{apnIdFor(partner)} · {partner.district || "Unassigned"} · {partner.mobile || "No phone"}</div></div><span className={"badge " + (status === "active" ? "pos" : status === "inactive" ? "neg" : "pri")}>{status}</span></div>
    <div className="apn-head-mini-grid"><div><span>Revenue</span><b>{money(stats.revenue)}</b></div><div><span>Leads</span><b>{stats.submitted}</b></div><div><span>Converted</span><b>{stats.converted}</b></div><div><span>Commission</span><b>{money(stats.commission.earned)}</b></div>{progress && <div><span>Target</span><b>{progress.pct}%</b></div>}</div>
    {progress && <div className="progress-track" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: Math.min(100, Math.max(0, progress.pct)) + "%" }} /></div>}
    {allowActions && <div className="apn-head-actions">{viewer.role === "state_head" && status === "pending" && <><button className="btn sm primary" onClick={() => onApprove?.(partner)}><Check size={13} />Approve</button><button className="btn sm danger" onClick={() => onReject?.(partner)}><X size={13} />Reject</button></>}<button className="btn sm" onClick={logCall}><PhoneCall size={13} />Log call</button>{status === "inactive" && !partner.reactivationRecommended && <button className="btn sm" onClick={recommend}><RefreshCw size={13} />Recommend reactivation</button>}</div>}
  </div>;
}
function APNDistrict({ db, meRow, mutate }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [focus, setFocus] = useState("overview");
  const members = apnDistrictHeadMembers(db, meRow);
  const visible = members.filter((p) => (!query || `${p.name} ${p.email} ${apnIdFor(p)} ${p.mobile}`.toLowerCase().includes(query.toLowerCase())) && (status === "all" || apnEffectiveStatus(p) === status));
  const leads = (db.apn_leads || []).filter((l) => members.some((p) => p.id === l.partnerId));
  const converted = leads.filter((l) => l.status === "Converted");
  const revenue = round2(converted.reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const heads = (db.apn_users || []).filter((u) => u.role === "district_head");
  return <div className="apn-head-cockpit">
    <div className="apn-section-h"><div><b>District Command</b><div className="hint-line">{meRow.district || "Unassigned district"} · {meRow.name}</div></div><span className="badge pri">District Head</span></div>
    <div className="apn-metrics" style={{ marginBottom: 14 }}><APNMetric k="Partners" v={members.length} icon={<Users size={13} />} /><APNMetric k="Active" v={members.filter((p) => apnEffectiveStatus(p) === "active").length} icon={<UserCheck size={13} />} /><APNMetric k="Revenue" v={money(revenue)} icon={<TrendingUp size={13} />} /><APNMetric k="Leads" v={leads.length} icon={<Lightbulb size={13} />} /><APNMetric k="Conversions" v={converted.length} icon={<BadgeCheck size={13} />} /></div>
    <div className="apn-head-tabs"><button className={focus === "overview" ? "on" : ""} onClick={() => setFocus("overview")}>Overview</button><button className={focus === "partners" ? "on" : ""} onClick={() => setFocus("partners")}>Partners ({members.length})</button></div>
    {focus === "overview" ? <div className="apn-head-overview-grid"><div className="apn-rowcard"><div className="lbl"><GaugeCircle size={14} />District performance</div><div className="apn-head-statline"><span>Conversion rate</span><b>{leads.length ? Math.round((converted.length / leads.length) * 100) : 0}%</b></div><div className="apn-head-statline"><span>Inactive / attention</span><b>{members.filter((p) => ["inactive", "suspended"].includes(apnEffectiveStatus(p))).length}</b></div><div className="apn-head-statline"><span>Partners with targets</span><b>{members.filter((p) => (db.apn_targets || []).some((t) => t.partnerId === p.id)).length}</b></div></div><div className="apn-rowcard"><div className="lbl"><ShieldCheck size={14} />Your authority</div><p className="hint-line" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>Monitor and support your assigned partners, log calls, and recommend reactivation. Financial settings, hierarchy changes and final lifecycle decisions remain with administration.</p></div><div className="apn-rowcard"><div className="lbl"><Users size={14} />District Head directory</div>{heads.filter((h) => h.district === meRow.district).map((h) => <div className="apn-head-statline" key={h.id}><span>{h.name}</span><b>{h.id === meRow.id ? "You" : "District Head"}</b></div>)}</div></div> : <div><div className="apn-head-toolbar"><div className="searchbox"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partner, APN ID, phone…" /></div><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div><div className="apn-list">{visible.length ? visible.map((p) => <APNHeadPartnerCard key={p.id} db={db} partner={p} mutate={mutate} viewer={meRow} />) : <div className="apn-rowcard"><Empty icon={<Users size={22} />} title="No partners found" text="No partner matches this district and filter." /></div>}</div></div>}
  </div>;
}
function APNStateHead({ db, meRow, mutate, patchDb, openModal }) {
  const [query, setQuery] = useState(""); const [districtFilter, setDistrictFilter] = useState("all"); const [focus, setFocus] = useState("overview");
  const members = apnStateScope(db, meRow);
  const districts = [...new Set(members.map((p) => p.district).filter(Boolean))].sort();
  const filtered = members.filter((p) => (!query || `${p.name} ${p.email} ${apnIdFor(p)} ${p.mobile} ${p.district}`.toLowerCase().includes(query.toLowerCase())) && (districtFilter === "all" || p.district === districtFilter));
  const heads = (db.apn_users || []).filter((u) => u.role === "district_head" && districts.includes(u.district));
  const approvePartner = async (partner) => {
    try {
      const { data, error } = await supabase.rpc("apn_state_head_approve_partner", { p_partner_id: partner.id });
      if (error) throw error;
      const at = Date.now();
      patchDb((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, status: "active", approvedAt: at, approvedBy: meRow.name, rejectedAt: null, rejectReason: null } : u), apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify(apnApprovalNotification(partner, meRow)))] }));
      emitToast(`Approved ${data?.name || partner.name}.`, "success");
    } catch (e) { emitToast(e?.message || "Could not approve partner.", "error"); }
  };
  const stateHeadAction = async (partner, action) => {
    try {
      const { data, error } = await supabase.rpc("apn_state_head_partner_action", { p_partner_id: partner.id, p_action: action });
      if (error) throw error;
      patchDb((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, ...(data || {}) } : u) }));
      emitToast(action === "log_call" ? `Call logged for ${partner.name}.` : `Reactivation recommended for ${partner.name}.`, "success");
    } catch (e) { emitToast(e?.message || "Could not complete State Head action.", "error"); }
  };
  const logCall = (partner) => stateHeadAction(partner, "log_call");
  const recommend = (partner) => stateHeadAction(partner, "recommend_reactivation");
  const rejectPartner = (partner) => openModal?.({ type: "apnReject", partner, stateHead: true });
  const leads = (db.apn_leads || []).filter((l) => members.some((p) => p.id === l.partnerId)); const converted = leads.filter((l) => l.status === "Converted");
  const revenue = round2(converted.reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const districtRows = districts.map((district) => { const ps = members.filter((p) => p.district === district); const ls = (db.apn_leads || []).filter((l) => ps.some((p) => p.id === l.partnerId)); const cs = ls.filter((l) => l.status === "Converted"); return { district, partners: ps.length, active: ps.filter((p) => apnEffectiveStatus(p) === "active").length, leads: ls.length, converted: cs.length, revenue: round2(cs.reduce((s, l) => s + (Number(l.revenue) || 0), 0)), head: heads.find((h) => h.district === district)?.name || "Unassigned" }; });
  return <div className="apn-head-cockpit">
    <div className="apn-section-h"><div><b>State Command</b><div className="hint-line">{meRow.state || meRow.zone || "State-wide APN network"} · {meRow.name}</div></div><span className="badge pri">State Head</span></div>
    <div className="apn-metrics" style={{ marginBottom: 14 }}><APNMetric k="Partners" v={members.length} icon={<Users size={13} />} /><APNMetric k="Districts" v={districts.length} icon={<MapPin size={13} />} /><APNMetric k="District Heads" v={heads.length} icon={<UserCheck size={13} />} /><APNMetric k="Revenue" v={money(revenue)} icon={<TrendingUp size={13} />} /><APNMetric k="Conversions" v={converted.length} icon={<BadgeCheck size={13} />} /></div>
    <div className="apn-head-tabs"><button className={focus === "overview" ? "on" : ""} onClick={() => setFocus("overview")}>Overview</button><button className={focus === "districts" ? "on" : ""} onClick={() => setFocus("districts")}>Districts ({districts.length})</button><button className={focus === "partners" ? "on" : ""} onClick={() => setFocus("partners")}>Partners ({members.length})</button></div>
    {focus === "overview" && <div className="apn-head-overview-grid"><div className="apn-rowcard"><div className="lbl"><GaugeCircle size={14} />State performance</div><div className="apn-head-statline"><span>Conversion rate</span><b>{leads.length ? Math.round((converted.length / leads.length) * 100) : 0}%</b></div><div className="apn-head-statline"><span>Active partners</span><b>{members.filter((p) => apnEffectiveStatus(p) === "active").length}</b></div><div className="apn-head-statline"><span>Attention required</span><b>{members.filter((p) => ["inactive", "suspended"].includes(apnEffectiveStatus(p))).length}</b></div></div><div className="apn-rowcard"><div className="lbl"><ShieldCheck size={14} />State Head authority</div><p className="hint-line" style={{ lineHeight: 1.6, margin: "8px 0 0" }}>State-wide oversight is read from the APN hierarchy. You can inspect district and partner performance without bypassing administrator-only financial or lifecycle controls.</p></div></div>}
    {focus === "districts" && <div className="apn-rowcard" style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards"><thead><tr><th>District</th><th>Head</th><th>Partners</th><th>Active</th><th>Leads</th><th>Converted</th><th>Revenue</th></tr></thead><tbody>{districtRows.length ? districtRows.map((r) => <tr key={r.district}><td data-label="District"><b>{r.district}</b></td><td data-label="Head">{r.head}</td><td data-label="Partners">{r.partners}</td><td data-label="Active">{r.active}</td><td data-label="Leads">{r.leads}</td><td data-label="Converted">{r.converted}</td><td data-label="Revenue" className="mono">{money(r.revenue)}</td></tr>) : <tr><td colSpan="7">No districts are assigned to this State Head yet.</td></tr>}</tbody></table></div>}
    {focus === "partners" && <div><div className="apn-head-toolbar"><div className="searchbox"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partner, district, APN ID…" /></div><select className="select" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}><option value="all">All districts</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div><div className="apn-list">{filtered.length ? filtered.map((p) => <APNHeadPartnerCard key={p.id} db={db} partner={p} mutate={mutate} viewer={meRow} allowActions={true} onApprove={approvePartner} onReject={rejectPartner} onLogCall={logCall} onRecommend={recommend} />) : <div className="apn-rowcard"><Empty icon={<Users size={22} />} title="No partners found" text="No partner matches this state and filter." /></div>}</div></div>}
  </div>;
}

/* ── legacy district view retained as the implementation base; the cockpit above
   adds scoped management without changing the finance or authorization model. ── */

function APNBankDetails({ db, pid, reload }) {
  const existing = (db.apn_withdrawal_bank_accounts || []).find((row) => row.partner_id === pid);
  const [f, setF] = useState(() => ({ accountHolder: existing?.account_holder || "", bankName: existing?.bank_name || "", accountNumber: existing?.account_number || "", confirmAccountNumber: existing?.account_number || "", ifsc: existing?.ifsc || "", upiId: existing?.upi_id || "", branch: existing?.branch || "" }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  useEffect(() => setF({ accountHolder: existing?.account_holder || "", bankName: existing?.bank_name || "", accountNumber: existing?.account_number || "", confirmAccountNumber: existing?.account_number || "", ifsc: existing?.ifsc || "", upiId: existing?.upi_id || "", branch: existing?.branch || "" }), [existing?.id, existing?.updated_at]);
  const set = (key, value) => { setMessage(null); setF((prev) => ({ ...prev, [key]: value })); };
  const save = async () => {
    setMessage(null);
    if (f.accountNumber && f.accountNumber !== f.confirmAccountNumber) return setMessage({ type: "err", text: "Account number confirmation does not match." });
    setBusy(true);
    try {
      const { error } = await supabase.rpc("apn_upsert_withdrawal_bank_account", { p_partner_id: pid, p_account_holder: f.accountHolder.trim() || null, p_bank_name: f.bankName.trim() || null, p_account_number: f.accountNumber.trim() || null, p_confirm_account_number: f.confirmAccountNumber.trim() || null, p_ifsc: f.ifsc.trim() || null, p_upi_id: f.upiId.trim() || null, p_branch: f.branch.trim() || null });
      if (error) throw error;
      setMessage({ type: "ok", text: "Payout details saved. Verification is pending." }); await reload?.();
    } catch (err) { setMessage({ type: "err", text: err?.message || "Couldn’t save payout details." }); }
    finally { setBusy(false); }
  };
  return <div className="apn-rowcard" style={{ marginTop: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><Building2 size={16} color="var(--primary)" /><div style={{ fontWeight: 800, flex: 1 }}>Bank details</div>{existing && <span className={`badge ${existing.verification_status === "verified" ? "pos" : existing.verification_status === "rejected" ? "neg" : "pri"}`}>{existing.verification_status}</span>}</div><div className="hint-line" style={{ marginBottom: 12 }}>Use either UPI or complete bank-transfer details. Every change is recorded in the financial audit log.</div><div className="grid2"><Field label="Account holder"><input className="input" value={f.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} /></Field><Field label="Bank name"><input className="input" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field></div><div className="grid2"><Field label="Account number"><input className="input mono" inputMode="numeric" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field><Field label="Confirm account number"><input className="input mono" inputMode="numeric" value={f.confirmAccountNumber} onChange={(e) => set("confirmAccountNumber", e.target.value)} /></Field></div><div className="grid2"><Field label="IFSC"><input className="input mono" value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} /></Field><Field label="Branch"><input className="input" value={f.branch} onChange={(e) => set("branch", e.target.value)} /></Field></div><Field label="UPI ID"><input className="input" value={f.upiId} onChange={(e) => set("upiId", e.target.value.toLowerCase())} placeholder="name@bank" /></Field><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}><button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save payout details"}</button></div>{message && <div className={`auth-msg ${message.type === "ok" ? "ok" : "err"}`} style={{ marginTop: 10 }}>{message.text}</div>}</div>;
}

function APNProfile({ db, meRow, stats, snap, profile, sessionEmail, mutate, onSignOut, reload, isHead, go }) {
  const snapWallet = apnSnapshotWallet(snap);
  const effRate = apnSnapshotRate(snap, stats.completed) ?? stats.level.rate;
  const governed = apnGovernedLimit(db, meRow.id);
  const [f, setF] = useState(() => ({
    name: meRow.name || "", username: meRow.username || profile?.username || "", email: meRow.email || profile?.email || sessionEmail || "", mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "",
    address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", photoUrl: apnAvatarUrl(meRow, profile),
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [usernameState, setUsernameState] = useState("idle");
  const photoRef = useRef(null);
  const set = (key, value) => { setSaved(false); setF((current) => ({ ...current, [key]: value })); };
  useEffect(() => {
    setF({ name: meRow.name || "", username: meRow.username || profile?.username || "", email: meRow.email || profile?.email || sessionEmail || "", mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "", address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", photoUrl: apnAvatarUrl(meRow, profile) });
  }, [meRow.id, meRow.updatedAt, profile?.id, profile?.updated_at, sessionEmail]);
  const normalizedUsername = f.username.trim().toLowerCase().replace(/\s+/g, "");
  useEffect(() => {
    if (!normalizedUsername || normalizedUsername === String(meRow.username || profile?.username || "").toLowerCase()) { setUsernameState(normalizedUsername ? "available" : "idle"); return undefined; }
    let cancelled = false;
    setUsernameState("checking");
    const timer = setTimeout(async () => {
      const localTaken = (db.apn_users || []).some((u) => u.id !== meRow.id && String(u.username || "").toLowerCase() === normalizedUsername);
      if (localTaken) { if (!cancelled) setUsernameState("taken"); return; }
      const { data, error } = await supabase.from("profiles").select("id").ilike("username", normalizedUsername).neq("id", meRow.id).limit(1);
      if (!cancelled) setUsernameState(error ? "unknown" : data?.length ? "taken" : "available");
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [db.apn_users, meRow.id, meRow.username, normalizedUsername, profile?.username]);
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const ext = String(file.name || "").split(".").pop()?.toLowerCase();
    if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") || !["jpg", "jpeg", "png", "webp"].includes(ext)) { setErr("Choose a JPG, JPEG, PNG, or WEBP image."); event.target.value = ""; return; }
    setUploading(true); setErr("");
    try { const uploaded = await uploadAttachment(file); set("photoUrl", uploaded.url); }
    catch (error) { setErr(error.message || "Couldn't upload that image."); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const save = async () => {
    setErr(""); setSaved(false);
    if (!f.name.trim()) return setErr("Enter your full name.");
    if (f.mobile.replace(/\D/g, "").length < 7) return setErr("Enter a valid mobile number.");
    if (!f.email.trim()) return setErr("Enter an email address.");
    if (!f.dob) return setErr("Add your date of birth.");
    if (!normalizedUsername) return setErr("Enter a username.");
    if (usernameState === "taken" || usernameState === "checking" || usernameState === "unknown") return setErr(usernameState === "unknown" ? "Username availability could not be verified. Try again." : "Choose an available username.");
    setBusy(true);
    try {
      const { data: conflicts, error: conflictError } = await supabase.from("profiles").select("id").ilike("username", normalizedUsername).neq("id", meRow.id).limit(1);
      if (conflictError) throw new Error(conflictError.message);
      if (conflicts?.length || (db.apn_users || []).some((u) => u.id !== meRow.id && String(u.username || "").toLowerCase() === normalizedUsername)) throw new Error("That username is already taken.");
      const previousEmail = String(meRow.email || profile?.email || sessionEmail || "").trim().toLowerCase();
      if (f.email.trim().toLowerCase() !== previousEmail) {
        const { error: authError } = await supabase.auth.updateUser({ email: f.email.trim().toLowerCase() });
        if (authError) throw new Error(authError.message);
      }
      const { error: profileError } = await supabase.from("profiles").update({ name: f.name.trim(), username: normalizedUsername, email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), dob: f.dob || null, photo_url: f.photoUrl || null }).eq("id", meRow.id);
      if (profileError) throw new Error(profileError.message);
      const at = Date.now();
      const nextProfile = { name: f.name.trim(), username: normalizedUsername, email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), dob: f.dob || "", address: f.address.trim(), district: f.district.trim(), taluk: f.taluk.trim(), city: f.city.trim(), occupation: f.occupation.trim(), college: f.college.trim(), profilePicture: f.photoUrl || "" };
      const previousProfile = { name: meRow.name || "", username: meRow.username || profile?.username || "", email: previousEmail, mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "", address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", profilePicture: apnAvatarUrl(meRow, profile) };
      const changedFields = Object.keys(nextProfile).filter((key) => String(previousProfile[key] ?? "") !== String(nextProfile[key] ?? ""));
      const profileAction = changedFields.includes("profilePicture") ? (nextProfile.profilePicture ? "changed APN profile picture" : "removed APN profile picture") : "updated own APN profile";
      mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === meRow.id ? { ...u, ...nextProfile, updatedAt: at } : u) }), { action: profileAction, module: "APN", partnerId: meRow.id, previousValue: previousProfile, newValue: nextProfile, metadata: { changedFields } });
      setSaved(true);
    } catch (error) { setErr(error.message || "Couldn't save your profile."); }
    finally { setBusy(false); }
  };
  const field = (label, key, type = "text") => <Field label={label}><input className="input" type={type} value={f[key]} onChange={(e) => set(key, e.target.value)} /></Field>;
  return (
    <div>
      <div className="apn-section-h">My profile</div>
      {isHead && <div className="banner" style={{ margin: "0 0 12px" }}><ShieldHalf size={15} />You lead district {meRow.district || "—"} ({meRow.headRow || "Head"}). Manage members and revenue from the District tab.</div>}
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Commission earned" v={money(snapWallet ? Number(snapWallet.earned) : stats.commission.earned)} icon={<Coins size={13} />} tone="pos" />
        <APNMetric k="Level" v={stats.level.name} icon={<Award size={13} />} />
      </div>
      {governed.full && <div className="banner" style={{ margin: "0 0 12px" }}><ShieldCheck size={15} />{apnCalculatedGovernedExplanation(db, meRow.id)} <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => go("targets")}>View targets</button></div>}
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div className="apn-hero">
          <button type="button" aria-label="Change profile picture" onClick={() => photoRef.current?.click()} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", borderRadius: 999 }}><Avatar name={f.name} url={f.photoUrl} size={48} fontSize={19} /></button>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 17 }}>{f.name}</div><div className="hint-line">{apnIdFor(meRow)} · {stats.level.name}</div><div className="hint-line" style={{ fontSize: 12, marginTop: 4 }}>Click your photo to upload a new picture.</div></div>
          <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button className="btn sm" type="button" onClick={() => photoRef.current?.click()} disabled={uploading}><Upload size={13} />{uploading ? "Uploading…" : "Change picture"}</button>{f.photoUrl && <button className="btn sm" type="button" onClick={() => set("photoUrl", "")} disabled={uploading}>Remove picture</button>}</div>
      </div>
      <div className="apn-rowcard">
        <div className="hint-line" style={{ marginBottom: 12 }}>APN ID is permanent and cannot be edited.</div>
        {field("Full name", "name")}{field("Username", "username")}
        {f.username.trim() && <div className="hint-line" style={{ marginTop: -8, marginBottom: 10, color: usernameState === "taken" ? "var(--neg)" : usernameState === "available" ? "var(--pos)" : "var(--muted)" }}>{usernameState === "checking" ? "Checking username…" : usernameState === "taken" ? "Username is already taken." : usernameState === "available" ? "Username is available." : usernameState === "unknown" ? "Could not verify username availability." : ""}{usernameState === "taken" && <span> Try {normalizedUsername}1, {normalizedUsername}2, or {normalizedUsername}3.</span>}</div>}
        {field("Mobile number", "mobile")}{field("Email", "email", "email")}{field("Date of birth", "dob", "date")}
        {field("Full address", "address")}{field("District", "district")}{field("Taluk", "taluk")}{field("City", "city")}{field("Occupation", "occupation")}{field("College", "college")}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}><button className="btn primary" type="button" onClick={save} disabled={busy || uploading || usernameState === "taken" || usernameState === "checking"}>{busy ? "Saving…" : "Save changes"}</button></div>
        {err && <div className="auth-msg err" style={{ marginTop: 10 }}>{err}</div>}{saved && <div className="auth-msg ok" style={{ marginTop: 10 }}><Check size={14} />Profile saved.</div>}
      </div>
      <div className="apn-rowcard" style={{ marginTop: 14 }}>
        {[
          ["APN ID", apnIdFor(meRow)], ["Current level", `${stats.level.name} (Level ${stats.level.key})`], ["Commission rate", effRate + "%"],
        ].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}><span className="hint-line">{label}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{value || "—"}</span></div>)}
      </div>
      <APNBankDetails db={db} pid={meRow.id} reload={reload} />
      <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
    </div>
  );
}

/* ── APN global search ───────────────────────────────────────────────── */
function APNSearch({ db, meRow, pid, go, onClose }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);
  const index = useMemo(() => {
    const out = [];
    for (const l of apnLeadsOf(db, pid)) out.push({ id: "l" + l.id, tab: "leads", module: "Lead", title: l.clientName, sub: `${APN_SERVICE_LABEL[l.service]} · ${l.status}`, text: searchHay(l) });
    for (const qt of (db.apn_quotations || []).filter((x) => x.partnerId === pid)) out.push({ id: "q" + qt.id, tab: "quotations", module: "Quotation", title: qt.clientName, sub: money(qt.total), text: searchHay(qt) });
    for (const d of (db.apn_documents || [])) out.push({ id: "d" + d.id, tab: "documents", module: "Material", title: d.title, sub: d.category || "", text: searchHay(d) });
    for (const t of (db.apn_training || [])) out.push({ id: "t" + t.id, tab: "learn", module: "Training", title: t.title, sub: APN_SERVICE_LABEL[t.category] || "", text: searchHay(t) });
    for (const t of (db.apn_targets || []).filter((x) => x.partnerId === pid)) out.push({ id: "tg" + t.id, tab: "targets", module: "Target", title: t.title, sub: apnMetricLabel(t.metric), text: searchHay(t) });
    for (const n of (db.apn_notifications || []).filter((x) => apnNotifVisible(x, meRow))) out.push({ id: "n" + n.id, tab: "notifications", module: "Notification", title: n.title, sub: "", text: searchHay(n) });
    return out;
  }, [db, pid, meRow]);
  const results = useMemo(() => {
    const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    return index.filter((r) => toks.every((t) => r.text.includes(t))).slice(0, 40);
  }, [q, index]);
  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="cmdk" role="dialog" aria-modal="true" aria-label="Search APN" onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key !== "Tab") return;
        const nodes = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex=\"-1\"])" ) || []);
        if (!nodes.length) return;
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}>
        <div className="cmdk-input"><Search size={20} color="var(--muted)" aria-hidden="true" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads, quotations, materials…" aria-label="Search APN records" /><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Close search" title="Close search"><X size={16} /></button></div>
        <div className="cmdk-results">
          {!q.trim() ? <div className="cmdk-empty">Search your leads, quotations, targets, training and materials.</div>
            : results.length === 0 ? <div className="cmdk-empty">No matches for “{q}”.</div>
              : results.map((r) => (
                <div key={r.id} className="cmdk-item" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(r.tab); onClose(); } }} onMouseDown={(e) => { e.preventDefault(); go(r.tab); onClose(); }}>
                  <div className="cmdk-ic"><Search size={15} /></div>
                  <div className="cmdk-main"><div className="cmdk-title"><SearchHighlight text={r.title} q={q} /></div><div className="cmdk-path">{r.sub}</div></div>
                  <span className="tag">{r.module}</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

/* ── global pull-to-refresh: ONE mechanism for every surface ───────────── */
// The single authoritative pull-to-refresh implementation in the app. Every
// surface (internal admin/staff app, APN portal, client portal) mounts one
// instance of this component; there is no per-page or per-portal gesture code
// anywhere else.
//
// Why this works app-wide: every ALLBEE surface scrolls at the window level
// (pages grow, the document scrolls — `.main`, `.content`, `.apn-body` are
// plain flex children, never nested scrollers) and every dynamic screen reads
// from the shared `db` store. So the surface's existing reload contract
// (`reload` = fetchAll → setDb) refreshes the CURRENT page's data. The only
// nested scrollers in the app live inside overlays (modals, sheets, drawers,
// search, dropdowns) and form fields — all blocked below, so this gesture can
// never hijack a nested scroll.
const PTR_BLOCKED_SELECTOR = "textarea, input, select, [contenteditable], .apn-top, .topbar, .modal, .overlay, .activity-drawer, .activity-drawer-overlay, .dropdown, .combo-options, .cmdk, .cmdk-overlay, .apn-more, .apn-more-sheet, .apn-sidebar-backdrop, .apn-sidebar";
function scrollContainerAt(target) {
  // Walk up from the touched element to find its real vertical scroll
  // container. Plain wrappers fall through to the document; horizontal-only
  // scrollers (chips, table wraps) never qualify, so pulling on them leaves
  // the native gesture alone. Overlay/form subtrees return null up front.
  let el = target && target.nodeType === 1 ? target.parentElement : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.closest?.(PTR_BLOCKED_SELECTOR)) return null;
    const cs = getComputedStyle(el);
    const ov = cs.overflowY || cs.overflow || "";
    if ((ov === "auto" || ov === "scroll" || ov === "overlay") && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return document.scrollingElement;
}
function GlobalPullToRefresh({ onRefresh, enabled = true }) {
  const [pull, setPull] = useState(null);
  const startRef = useRef(null);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const reset = useCallback(() => { startRef.current = null; setPull(null); }, []);

  const onTouchStart = useCallback((e) => {
    if (refreshingRef.current) return;                              // one pull = one refresh
    if (!window.matchMedia("(pointer: coarse)").matches) return;    // touch devices only
    const t = e.touches[0];
    if (!t) return;
    if (startRef.current) { reset(); return; }                      // second finger: cancel
    const target = e.target;
    if (target && target.closest && target.closest(PTR_BLOCKED_SELECTOR)) return;
    const container = scrollContainerAt(target);
    if (!container) return;
    startRef.current = { id: t.identifier, startX: t.clientX, startY: t.clientY, raw: 0, engaged: false, container };
  }, [reset]);

  const onTouchMove = useCallback((e) => {
    const st = startRef.current;
    if (!st) return;
    if (e.touches.length !== 1 || e.touches[0].identifier !== st.id) { reset(); return; }
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    const dy = y - st.startY;
    const dx = x - st.startX;
    if (!st.engaged) {
      if (dy < 10) return;                                   // not a pull yet
      if (Math.abs(dx) > dy) { reset(); return; }            // horizontal intent → native swipe
      if (st.container && st.container.scrollTop > 1) { reset(); return; }  // only at the very top
      st.engaged = true;
    }
    e.preventDefault();                                       // stop iOS rubber-band once engaged
    st.raw = Math.max(0, dy);
    setPull({ raw: st.raw, refreshing: false });
  }, [reset]);

  const onTouchEnd = useCallback(() => {
    const st = startRef.current;
    startRef.current = null;
    if (!st || !st.engaged) { setPull(null); return; }
    if (st.raw < 64) { setPull(null); return; }               // not past the threshold
    setPull({ raw: 0, refreshing: true });
    refreshingRef.current = true;
    Promise.resolve(onRefreshRef.current ? onRefreshRef.current() : undefined)
      .catch(() => {})                                        // failures surface via existing app patterns
      .finally(() => { refreshingRef.current = false; setTimeout(() => setPull(null), 250); });
  }, []);

  const onTouchCancel = useCallback(reset, [reset]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel]);

  return pull ? (
    <div className="app-ptr" style={{ transform: `translate(-50%, ${pull.refreshing ? 6 : 10 + Math.min(pull.raw * 0.45, 86)}px)` }} role="status" aria-live="polite">
      <RefreshCw size={15} className={pull.refreshing ? "spin" : ""} />
      <span>{pull.refreshing ? "Refreshing…" : pull.raw >= 64 ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  ) : null;
}

/* ── team chat (person / district / state) ──────────────────────────────── */
const CHAT_SECTIONS = ["person", "district", "state"];
const CHAT_SECTION_LABEL = { person: "Friends", district: "District", state: "State" };

function APNTeamChat({ db, meRow, pid, profile, isDark, isOpen, refreshTick, go }) {
  const [section, setSection] = useState("person");
  const [conversations, setConversations] = useState([]);          // from apn_list_conversations
  const [friends, setFriends] = useState([]);                        // accepted friend pairs -> {otherId, otherName, otherApnId}
  const [contacts, setContacts] = useState([]);                      // all active APN partners + always-available admins
  const [contactSearch, setContactSearch] = useState("");
  const [requests, setRequests] = useState([]);                      // from apn_list_friend_requests
  const [selected, setSelected] = useState(null);                    // {id, subject, participants}
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busyRequests, setBusyRequests] = useState(new Set());
  const [messageInfo, setMessageInfo] = useState(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [chatNow, setChatNow] = useState(Date.now());
  const reduced = useReducedMotion();
  const scrollRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const me = meRow || { id: pid, name: profile?.name || "Partner" };
  const myApnId = apnIdFor(meRow) || "-";

  // Truthful presence: heartbeat while this chat is open and mark offline on cleanup.
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    const beat = async (online) => {
      if (!active) return;
      try {
        await supabase.rpc("apn_presence_heartbeat", { p_online: online });
      } catch (e) {
        // ignore
      }
    };
    beat(true);
    const timer = setInterval(() => beat(true), 15000);
    return () => {
      active = false;
      clearInterval(timer);
      (async () => {
        try {
          await supabase.rpc("apn_presence_heartbeat", { p_online: false });
        } catch (e) {
          // ignore
        }
      })();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selected) return undefined;
    const timer = setInterval(() => setChatNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [selected]);

  // Switching to District/State auto-opens the group chat (no extra click).
  useEffect(() => {
    if (!isOpen) return;
    if (section === "district") { setSelected(null); openDistrict(); }
    else if (section === "state") { setSelected(null); openState(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, isOpen]);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) { setLoading(true); setErr(""); }
    try {
      const { data, error } = await supabase.rpc("apn_list_conversations");
      if (error) throw new Error(error.message);
      if (!mountedRef.current) return;
      setConversations(data || []);
      const contactsRes = await supabase.rpc("apn_list_chat_contacts");
      if (!mountedRef.current) return;
      let contactRows = contactsRes.data || [];
      if (contactsRes.error) {
        // Production-safe fallback: an older PostgREST schema cache can retain the
        // UNION ORDER BY error. Keep Team Chat usable while the database function
        // cache catches up by reading the same source tables directly.
        const [partnersRes, adminsRes, presenceRes] = await Promise.all([
          supabase.from("apn_users").select("id,data").neq("id", pid),
          supabase.from("profiles").select("id,name,role,photo_url,active,status").neq("id", pid).in("role", ["admin", "superadmin"]),
          supabase.from("apn_chat_presence").select("user_id,online,last_seen,updated_at")
        ]);
        if (!mountedRef.current) return;
        if (partnersRes.error) throw new Error(contactsRes.error.message);
        const presenceByUser = new Map((presenceRes.data || []).map((r) => [String(r.user_id), r]));
        const fallbackPartners = (partnersRes.data || []).filter((u) => u?.data?.status === "active").map((u) => {
          const d = u.data || {}; const pr = presenceByUser.get(String(u.id));
          const availability = pr?.online && pr?.updated_at && (Date.now() - new Date(pr.updated_at).getTime() < 45000) ? "online" : "offline";
          return { contact_id: String(u.id), contact_type: "partner", name: d.name || "Partner", apn_id: d.apnId || null, district: d.district || null, state: d.state || null, photo_url: d.profilePicture || d.photo_url || d.photoUrl || null, availability, last_seen: pr?.last_seen || null, relationship: "none" };
        });
        const fallbackAdmins = (adminsRes.data || []).filter((a) => a.active && a.status === "active").map((a) => ({ contact_id: String(a.id), contact_type: a.role === "superadmin" ? "superadmin" : "admin", name: a.name || (a.role === "superadmin" ? "Super Admin" : "Admin"), apn_id: null, district: null, state: null, photo_url: a.photo_url || null, availability: "always_available", last_seen: null, relationship: "pre_enabled" }));
        contactRows = [...fallbackAdmins, ...fallbackPartners];
      }
      // profiles.photo_url is the authoritative app-wide avatar. The APN contact
      // RPC can still return the older apn_users.data.profilePicture value, so
      // always overlay the live profile photo when it is available.
      const contactIds = contactRows.map((c) => String(c.contact_id || "")).filter(Boolean);
      if (contactIds.length) {
        const profileRes = await supabase.from("profiles").select("id,photo_url").in("id", contactIds);
        if (!mountedRef.current) return;
        if (!profileRes.error) {
          const photos = new Map((profileRes.data || []).map((r) => [String(r.id), r.photo_url || null]));
          contactRows = contactRows.map((c) => ({ ...c, photo_url: photos.get(String(c.contact_id)) || c.photo_url || null }));
        }
      }
      if (!mountedRef.current) return;
      setContacts(contactRows);
      const fr = await supabase.rpc("apn_list_friend_requests");
      if (!mountedRef.current) return;
      if (fr.error) throw new Error(fr.error.message);
      setRequests(fr.data || []);
      const accepted = (fr.data || []).filter((r) => r.status === "accepted");
      setFriends(accepted.map((r) => ({ id: r.other_id, name: r.other_name, apnId: r.other_apn_id })));
      const requestRows = fr.data || [];
      setContacts((rows) => rows.map((c) => {
        if (c.contact_type !== "partner") return c;
        const rel = requestRows.find((r) => String(r.other_id) === String(c.contact_id));
        return rel ? { ...c, relationship: rel.status === "accepted" ? "friend" : rel.direction === "incoming" ? "incoming" : rel.direction === "outgoing" ? "outgoing" : c.relationship } : c;
      }));
    } catch (e) {
      if (!mountedRef.current) return;
      if (/does not exist|not exist|42P01|PGRST|relation/.test(e.message || "")) {
        setConversations([]); setRequests([]); setFriends([]); setContacts([]);
      } else { setErr(e.message || String(e)); }
    } finally { if (showLoading && mountedRef.current) setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conv, { open = true } = {}) => {
    // Opening a conversation may clear the old thread while it loads. Refreshing
    // an already-open thread must never clear it first: that blank frame is the
    // visible flicker users were seeing after every send/realtime event.
    if (open) {
      setSelected(conv);
      setMessages([]);
    }
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_list_messages", { p_conversation_id: conv.id });
      if (!mountedRef.current) return;
      if (error) throw new Error(error.message);
      const msgs = data || [];
      setMessages(msgs);
      await Promise.all(msgs.filter((m) => m.sender_id !== pid && !m.delivered_at).map((m) => supabase.rpc("apn_mark_delivered", { p_message_id: m.id })));
      // advance the caller's read cursor to the latest message so the badge clears
      if (msgs.length) await supabase.rpc("apn_mark_read", { p_conversation_id: conv.id, p_message_id: msgs[msgs.length - 1].id });
    } catch (e) {
      if (mountedRef.current) setErr(e.message || String(e));
    }
  }, []);

  const openConversation = useCallback(async (conv) => {
    await loadMessages(conv);
    // scroll to bottom after messages render
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  }, [loadMessages]);

  // Load conversations when the tab opens / on refresh ticks.
  useEffect(() => {
    if (isOpen) { loadConversations(); setSelected(null); setMessages([]); }
  }, [isOpen, refreshTick, loadConversations]);

  // Realtime: subscribe to the chat tables (RLS still gates reads). On any
  // change, refetch the relevant slice rather than trusting client-only updates.
  // Use a pid-namespaced name to prevent duplicate-channel errors on rapid remounts.
  useEffect(() => {
    if (!isOpen) return;
    const chName = `apn-team-chat:${pid}`;
    const ch = supabase.channel(chName);
    let timerId = null;
    let inFlight = null;
    let queued = false;
    const refreshChat = () => {
      queued = true;
      if (timerId || inFlight) return;
      timerId = setTimeout(async () => {
        timerId = null;
        if (!queued || !mountedRef.current) return;
        queued = false;
        inFlight = loadConversations(false).then(async () => {
          if (mountedRef.current && selectedRef.current) await loadMessages(selectedRef.current, { open: false });
        }).catch(() => {}).finally(() => {
          inFlight = null;
          if (queued) refreshChat();
        });
      }, 120);
    };
    ["apn_chat_messages", "apn_chat_conversations", "apn_chat_read_states", "apn_friend_requests", "apn_chat_presence"].forEach((t) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refreshChat));
    ch.subscribe();
    return () => {
      if (timerId) clearTimeout(timerId);
      queued = false;
      supabase.removeChannel(ch);
    };
  }, [isOpen, loadConversations, loadMessages]);

  const sendFriendRequest = async (otherApnId) => {
    setErr("");
    try {
      const { error } = await supabase.rpc("apn_send_friend_request", { p_recipient_apn_id: otherApnId });
      if (error) throw new Error(error.message);
      loadConversations();
    } catch (e) { setErr(e.message || String(e)); }
  };

  const acceptRequest = async (requestId) => {
    setBusyRequests((prev) => new Set(prev).add(requestId));
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_accept_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
      const convId = data && data[0] && data[0].conversation_id;
      await loadConversations();
      if (convId) {
        const other = (requests.find((r) => r.request_id === requestId) || {}).other_apn_id;
        openConversation({ id: convId, subject: "Friend chat", conv_type: "person", participant_apn_id: other });
      }
      emitToast("Friend request accepted.", "success");
    } catch (e) {
      setErr(e.message || String(e));
      emitToast(e.message || "Could not accept request.", "error");
    } finally {
      setBusyRequests((prev) => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const rejectRequest = async (requestId) => {
    setBusyRequests((prev) => new Set(prev).add(requestId));
    setErr("");
    try {
      const { error } = await supabase.rpc("apn_reject_friend_request", { p_request_id: requestId });
      if (error) throw new Error(error.message);
      await loadConversations();
      emitToast("Request removed.", "success");
    } catch (e) {
      setErr(e.message || String(e));
      emitToast(e.message || "Could not reject request.", "error");
    } finally {
      setBusyRequests((prev) => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const sendMessage = async () => {
    const body = (composer || "").trim();
    if (!body || !selected) return;
    const convId = selected.id;
    setComposer("");
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_send_message", { p_conversation_id: convId, p_body: body });
      if (error) throw new Error(error.message);
      await loadMessages(selected, { open: false });
      await loadConversations(false);
    } catch (e) {
      setComposer(body);
      setErr(e.message || String(e));
    }
  };

  const deleteMessage = async (message) => {
    try {
      const { error } = await supabase.rpc("apn_delete_message", { p_message_id: message.id });
      if (error) throw new Error(error.message);
      setContextMessage(null);
      await loadMessages(selected, { open: false });
      await loadConversations(false);
      emitToast("Message deleted.", "success");
    } catch (e) { setErr(e.message || String(e)); }
  };

  const showMessageInfo = async (message) => {
    setContextMessage(null);
    try {
      const { data, error } = await supabase.rpc("apn_message_info", { p_message_id: message.id });
      if (error) throw new Error(error.message);
      setMessageInfo(data?.[0] || message);
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openAdminChat = async (admin) => {
    setErr("");
    try {
      const { data, error } = await supabase.rpc("apn_get_or_create_admin_conversation", { p_admin_id: admin.contact_id });
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "person" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openPersonChat = async (other) => {
    setErr("");
    const otherApnId = other?.apnId || other?.apn_id || "";
    if (!otherApnId) { setErr("This partner is missing a valid APN ID."); return; }
    try {
      // Use the hardened RPC first. The previous RPC name had accumulated
      // PostgREST overload/cache drift in production even though the database
      // itself contained the correct text signature.
      const primary = await supabase.rpc("apn_open_person_chat", { p_other_apn_id: otherApnId });
      if (!primary.error && primary.data?.[0]?.conversation_id) {
        openConversation({
          id: primary.data[0].conversation_id,
          subject: primary.data[0].subject || other.name,
          conv_type: "person",
          participant_apn_id: primary.data[0].participant_apn_id || otherApnId,
        });
        return;
      }

      // Compatibility path for databases that have not yet received the
      // hardening migration. Never expose raw PostgREST internals to the user.
      const legacy = await supabase.rpc("apn_get_or_create_person_conversation", { p_other_apn_id: otherApnId });
      if (!legacy.error && legacy.data?.[0]?.conversation_id) {
        openConversation({
          id: legacy.data[0].conversation_id,
          subject: legacy.data[0].subject || other.name,
          conv_type: "person",
          participant_apn_id: legacy.data[0].participant_apn_id || otherApnId,
        });
        return;
      }
      throw new Error(primary.error?.message || legacy.error?.message || "Could not open this friend chat.");
    } catch (e) {
      setErr(/schema cache|without parameters|PGRST202/i.test(e.message || "")
        ? "Chat service is refreshing. Please try again in a moment."
        : (e.message || "Could not open this friend chat."));
    }
  };

  const openDistrict = async () => {
    try {
      const { data, error } = await supabase.rpc("apn_get_district_conversation");
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "district" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const openState = async () => {
    try {
      const { data, error } = await supabase.rpc("apn_get_state_conversation");
      if (error) throw new Error(error.message);
      if (data?.[0]) openConversation({ id: data[0].conversation_id, subject: data[0].subject, conv_type: "state" });
    } catch (e) { setErr(e.message || String(e)); }
  };

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0)
    + requests.filter((r) => r.direction === "incoming" && r.status === "pending").length;

  return (
    <div className="apn apn-teamchat" data-theme={isDark ? "dark" : "light"} style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <div className="apn-tc-header">
        <div className="seg" style={{ flex: "none" }}>{CHAT_SECTIONS.map((s) => <button key={s} className={section === s ? "on" : ""} onClick={() => { setSection(s); setSelected(null); }}>{CHAT_SECTION_LABEL[s]}{s === "person" && totalUnread > 0 && <span className="badge action-badge" style={{ marginLeft: 5 }}>{totalUnread > 99 ? "99+" : totalUnread}</span>}</button>)}</div>
      </div>
      <div className="apn-tc-body">
        {section === "person" && (
          <div className={`apn-tc-shell ${selected ? "has-selection" : ""}`}>
            <aside className="apn-tc-sidebar">
              <div className="apn-tc-sidebar-title">Team Chat</div>
              <div className="apn-tc-sidebar-subtitle">Connect with partners in your network</div>
              {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} />{err}</div>}

              {conversations.filter((c) => c.conv_type === "person").length > 0 && (
                <div className="apn-tc-card">
                  <div className="apn-tc-card-title">Recent Chats</div>
                  <div className="apn-tc-recent-list">
                    {conversations.filter((c) => c.conv_type === "person").slice(0, 8).map((c) => (
                      <button key={c.conversation_id} className="apn-tc-recent-row" onClick={() => openConversation({ id: c.conversation_id, subject: c.subject || "Chat", conv_type: "person" })}>
                        <div className="apn-tc-recent-avatar"><MessageCircle size={15} /></div>
                        <div className="apn-tc-recent-copy"><b>{c.subject || "Chat"}</b><span>{c.last_message || "No messages yet"}</span></div>
                        {Number(c.unread_count || 0) > 0 && <span className="apn-tc-unread">{Number(c.unread_count) > 99 ? "99+" : c.unread_count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="apn-tc-card">
                <div className="apn-tc-card-title">AllBee Support</div>
                {contacts.filter((c) => c.contact_type === "admin" || c.contact_type === "superadmin").map((a) => {
                  const supportLabel = /mohamed\s+backer\s+alim/i.test(a.name || "")
                    ? "Chat with AllBee Founder and CEO"
                    : /^haji$/i.test((a.name || "").trim())
                      ? "Chat with AllBee Cofounder and CFO"
                      : "Chat with AllBee Admins";
                  return (
                    <button key={a.contact_id} className="apn-tc-item apn-tc-contact" onClick={() => openAdminChat(a)}>
                      <Avatar name={a.name} url={a.photo_url} size={36} fontSize={13} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div className="hint-line">{supportLabel}</div></div>
                      <span className="apn-tc-available">Always available</span><ChevronRight size={16} color="var(--muted)" />
                    </button>
                  );
                })}
                {!contacts.some((c) => c.contact_type === "admin" || c.contact_type === "superadmin") && !loading && <div className="hint-line">No management contacts available.</div>}
              </div>

              <div className="apn-tc-card">
                <div className="apn-tc-card-title">Available Partners</div>
                <div className="hint-line" style={{ marginBottom: 8 }}>Send a friend request to start chatting</div>
                <input className="input" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search partner by name, code or district…" aria-label="Search APN partners" />
                <div className="apn-tc-partner-list">
                  {loading && <div className="hint-line" style={{ padding: 10 }}>Loading partners…</div>}
                  {!loading && contacts.filter((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())).map((c) => {
                    const action = c.relationship === "friend" ? "Chat" : c.relationship === "outgoing" ? "Pending" : c.relationship === "incoming" ? "Accept" : "Add Friend";
                    return <div key={c.contact_id} className="apn-tc-partner-row">
                      <Avatar name={c.name} url={c.photo_url} size={34} fontSize={12} />
                      <div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{c.name}</div><div className="apn-tc-partner-location">{c.apn_id || "APN partner"}{c.district ? ` · ${c.district}` : ""}</div></div>
                      <span className={`apn-tc-status ${c.availability === "online" ? "online" : "offline"}`}>{c.contact_type !== "partner" ? "Always available" : c.availability === "online" ? "Online" : `Last seen ${c.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}`}</span>
                      {c.relationship === "friend" ? <button className="btn sm" onClick={() => openPersonChat(c)}>Chat</button> : c.relationship === "incoming" ? <button className="btn sm primary" onClick={() => { const r = requests.find((x) => x.other_id === c.contact_id && x.direction === "incoming" && x.status === "pending"); if (r) acceptRequest(r.request_id); }}>Accept</button> : <button className="btn sm primary" disabled={c.relationship === "outgoing"} onClick={() => sendFriendRequest(c.apn_id)}>{action}</button>}
                    </div>;
                  })}
                  {!loading && !contacts.some((c) => c.contact_type === "partner" && [c.name, c.apn_id, c.district, c.state].join(" ").toLowerCase().includes(contactSearch.trim().toLowerCase())) && <div className="hint-line" style={{ padding: 10 }}>No partners found.</div>}
                </div>
              </div>

              {requests.filter((r) => r.status === "pending").length > 0 && <div className="apn-tc-card">
                <div className="apn-tc-card-title">Friend Requests</div>
                {requests.filter((r) => r.status === "pending").map((r) => <div key={r.request_id} className="apn-tc-partner-row">
                  <Avatar name={r.other_name} url={contacts.find((c) => String(c.contact_id) === String(r.other_id))?.photo_url} size={32} fontSize={11} /><div className="apn-tc-partner-meta"><div className="apn-tc-partner-name">{r.other_name}</div><div className="apn-tc-partner-location">{r.other_apn_id}</div></div>
                  {r.direction === "incoming" ? <div style={{ display: "flex", gap: 5 }}><button className="btn sm primary" onClick={() => acceptRequest(r.request_id)}>Accept</button><button className="btn sm" onClick={() => rejectRequest(r.request_id)}>Reject</button></div> : <span className="hint-line">Pending</span>}
                </div>)}
              </div>}
            </aside>

            <main className="apn-tc-main">
              {selected ? (
                <div className="apn-tc-chat" ref={scrollRef}>
                  <div className="apn-tc-chathead">
                    <button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }} aria-label="Back to chats"><ArrowLeft size={17} /></button>
                    <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{selected.subject}
                      {selected.participant_apn_id && (() => { const c = contacts.find((x) => x.apn_id === selected.participant_apn_id); return <div className="apn-tc-presence">{c?.availability === "online" ? <><span className="apn-tc-online-dot" />Online</> : <>Last seen {c?.last_seen ? fmtDateTime(new Date(c.last_seen)) : "unknown"}</>}</div>; })()}
                    </div>
                  </div>
                  <div className="apn-tc-messages" onClick={() => setContextMessage(null)}>
                    {messages.map((m) => {
                      const isMe = m.sender_id === pid;
                      const ts = m.created_at ? new Date(m.created_at) : null;
                      const remaining = ts ? Math.max(0, 300000 - (chatNow - ts.getTime())) : 0;
                      const canDelete = isMe && remaining > 0 && !String(m.id).startsWith("tmp-");
                      const status = isMe ? (m.read_at ? "✓✓" : m.delivered_at ? "✓✓" : "✓") : "";
                      return <div key={m.id || m.created_at} className={`apn-tc-msg ${isMe ? "mine" : "theirs"}`} onDoubleClick={(e) => { e.stopPropagation(); setContextMessage(m); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMessage(m); }}>
                        {!isMe && <Avatar name={m.sender_name || "?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9} />}
                        <div className="apn-tc-bubble-wrap">
                          <div className="apn-tc-bubble"><div className="apn-tc-text">{m.body}</div><div className="apn-tc-time">{ts ? fmtDateTime(ts) : ""} {status && <span className={`apn-tc-ticks ${m.read_at ? "read" : ""}`}>{status}</span>}</div></div>
                          {isMe && remaining > 0 && <div className="apn-tc-delete-timer">Delete available {Math.floor(remaining/60000)}:{String(Math.floor((remaining%60000)/1000)).padStart(2,"0")}</div>}
                          {contextMessage?.id === m.id && <div className="apn-tc-msg-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => showMessageInfo(m)}>INFO</button>{canDelete && <button className="danger" onClick={() => deleteMessage(m)}><Trash2 size={13}/>Delete</button>}</div>}
                        </div>
                      </div>;
                    })}
                    {messages.length === 0 && !loading && <Empty icon={<MessageSquare size={20} />} title="No messages yet" text="Send the first message." />}
                  </div>
                  <div className="apn-tc-compose">
                    <textarea className="textarea" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Type a message…" rows={2} maxLength={2000} aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                    <button className="btn primary" onClick={sendMessage} disabled={!composer.trim() || !selected}>Send</button>
                  </div>
                </div>
              ) : <div className="apn-tc-main-empty"><div><MessageSquare size={30} color="var(--muted)" /><div className="apn-tc-main-title">Friend chats</div><div className="hint-line">Select a partner from the list to start messaging.</div></div></div>}
            </main>
          </div>
        )}
        {section === "district" && !selected && (
          <div className="apn-tc-group-pane">
            {loading && <div className="hint-line">Opening district chat…</div>}
            {err && <div className="auth-msg err"><AlertTriangle size={14} />{err}</div>}
            {!loading && !err && <button className="btn primary" style={{ marginBottom: 12 }} onClick={openDistrict}>Open {me.district || "District"} Chat</button>}
          </div>
        )}
        {section === "state" && !selected && (
          <div className="apn-tc-group-pane">
            {loading && <div className="hint-line">Opening state chat…</div>}
            {err && <div className="auth-msg err"><AlertTriangle size={14} />{err}</div>}
            {!loading && !err && <button className="btn primary" style={{ marginBottom: 12 }} onClick={openState}>Open {me.state || "State"} Chat</button>}
          </div>
        )}
        {selected && section !== "person" && (
          <div className="apn-tc-chat" ref={scrollRef}>
            <div className="apn-tc-chathead"><button className="linkbtn" onClick={() => { setSelected(null); setMessages([]); }} aria-label="Back to chats"><ArrowLeft size={17} /></button><div style={{ fontWeight: 700, flex: 1 }}>{selected.subject}</div></div>
            <div className="apn-tc-messages">
              {messages.map((m) => { const isMe=m.sender_id===pid; const ts=m.created_at?new Date(m.created_at):null; return <div key={m.id||m.created_at} className={`apn-tc-msg ${isMe?"mine":"theirs"}`}>{!isMe&&<Avatar name={m.sender_name||"?"} url={contacts.find((c) => String(c.contact_id) === String(m.sender_id))?.photo_url} size={22} fontSize={9}/>}<div className="apn-tc-bubble"><div>{m.body}</div><div className="apn-tc-time">{ts?fmtDateTime(ts):""}</div></div></div>; })}
              {messages.length===0&&!loading&&<Empty icon={<MessageSquare size={20}/>} title="No messages yet" text="Send the first message."/>}
            </div>
            <div className="apn-tc-compose"><textarea className="textarea" value={composer} onChange={e=>setComposer(e.target.value)} placeholder="Type a message…" rows={2} maxLength={2000} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}/><button className="btn primary" onClick={sendMessage} disabled={!composer.trim()||!selected}>Send</button></div>
          </div>
        )}
      </div>
      {messageInfo && <div className="apn-tc-info-overlay" onClick={() => setMessageInfo(null)}>
        <div className="apn-tc-info-card" onClick={(e) => e.stopPropagation()}>
          <div className="apn-tc-info-head"><b>Message info</b><button className="linkbtn" onClick={() => setMessageInfo(null)}>×</button></div>
          <div className="apn-tc-info-row"><span>Sender</span><b>{messageInfo.sender_name || messageInfo.sender_id || "—"}</b></div>
          <div className="apn-tc-info-row"><span>Sent</span><b>{messageInfo.created_at ? fmtDateTime(new Date(messageInfo.created_at)) : "—"}</b></div>
          <div className="apn-tc-info-row"><span>Delivered</span><b>{messageInfo.delivered_at ? fmtDateTime(new Date(messageInfo.delivered_at)) : "Not delivered"}</b></div>
          <div className="apn-tc-info-row"><span>Read</span><b>{messageInfo.read_at ? fmtDateTime(new Date(messageInfo.read_at)) : "Not read"}</b></div>
        </div>
      </div>}
    </div>
  );
}

/* ── tab error boundary ──────────────────────────────────────────────── */
class APNTabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("[APN] Tab render error:", error, info?.componentStack?.slice(0, 400)); }
  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "An unexpected error occurred.";
      return (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--neg)", marginBottom: 12 }}><AlertTriangle size={32} /></div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>{msg}</div>
          <button className="btn primary" onClick={() => this.setState({ hasError: false, error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── portal shell ────────────────────────────────────────────────────── */
export function APNPortal({ db, profile, session, signOut, isDark, mutate, patchDb = () => {}, reload }) {
  const pid = profile.id;
  const meRow = apnMe(db, pid);
  const [tab, setTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [finSnap, setFinSnap] = useState(null);
  const [snapTick, setSnapTick] = useState(0);
  const [agr, setAgr] = useState(null);

  // The agreement gate answer comes from the server-side apn_agreement_status
  // RPC (single source of truth). While it says REQUIRED, the whole portal is
  // replaced by APNAgreementGate; acceptance there triggers this refetch.
  const refreshAgreements = useCallback(async () => {
    const { data, error } = await supabase.rpc("apn_agreement_status");
    setAgr(error || !data ? null : data);
  }, []);
  useEffect(() => {
    refreshAgreements().catch(() => {});
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  // The portal's ONE refresh operation: reload the shared store (which every
  // APN page reads from) and bump the snapshot tick so the wallet facts and
  // any page-owned loaders (network, support tickets) refetch. Used by BOTH
  // the header refresh button and the global pull-to-refresh — one pull, one
  // refresh, no duplicated pipelines.
  const refreshPortal = useCallback(async () => {
    await reload();
    setSnapTick((t) => t + 1);
  }, [reload]);

  // WP7 — authoritative financial facts for the portal: refetch on mount, on
  // tab switch, and after a refresh so wallet values stay current, while
  // staying a read-only projection (no client-side recomputation). Never
  // blocks the portal: on failure legacy figures remain.
  useEffect(() => {
    let cancelled = false;
    fetchPartnerFinancialSnapshot().then((s) => { if (!cancelled) setFinSnap(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pid, tab, snapTick]);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setSearchOpen((v) => !v); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Deep links: #/apn/<tab>, and bare #/targets/<id> lands partners on their
  // targets tab so a notification tap acknowledges the right target.
  useEffect(() => {
    const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const route = parts[0] === "apn" ? parts[1] : parts[0];
    if (route && ["home", "leads", "quotations", "wallet", "withdrawals", "network", "chat", "learn", "targets", "documents", "agreements", "notifications", "achievements", "leaderboard", "district", "profile", "ai", "support"].includes(route)) setTab(route);
  }, []);

  const markNotificationsSeen = useCallback(async () => {
    const seenAt = new Date().toISOString();
    const { error } = await supabase.rpc("mark_apn_action_badge_seen", { p_action_type: "notification_unread" });
    if (error) { console.warn("[ALLBEE] notification read state could not be saved:", error.message); return; }
    patchDb((d) => ({ ...d, apn_action_badge_reads: [...(d.apn_action_badge_reads || []).filter((r) => !(r.user_id === pid && r.action_type === "notification_unread")), { user_id: pid, action_type: "notification_unread", seen_at: seenAt, updated_at: seenAt }] }));
  }, [pid, patchDb]);

  if (!meRow) return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>

      <div className="loading-screen">
        <div className="loading-card">
          <PrismFluxLoader status="Setting up your APN account…" statusList={["Loading your network", "Syncing data", "Almost ready"]} />
        </div>
      </div>
    </div>
  );

  const eff = meRow.status === "rejected" ? "rejected" : (profile.active === false && profile.status !== "pending") ? "suspended" : apnEffectiveStatus(meRow);
  if (eff === "pending") return <APNGate isDark={isDark} icon={<Hourglass size={26} />} title="Waiting for Approval" body={`Thanks ${meRow.name}. Your APN partner application (${apnIdFor(meRow)}) was successfully submitted and is awaiting admin approval. You'll get full access as soon as it's approved.`} onSignOut={signOut} onRefresh={refreshPortal} />;
  if (eff === "rejected") return <APNGate isDark={isDark} tone="neg" icon={<XCircle size={26} />} title="Application not approved" body={meRow.rejectReason ? `Reason: ${meRow.rejectReason}` : "Your APN partner application was not approved. Contact ALLBEE for details."} onSignOut={signOut} />;
  if (eff === "suspended") return <APNGate isDark={isDark} tone="neg" icon={<ShieldAlert size={26} />} title="Account suspended" body={`Your APN account is suspended${meRow.suspensionReason ? ` because of ${meRow.suspensionReason.toLowerCase()}` : ""}. Contact an administrator if you believe this is incorrect.`} onSignOut={signOut} onRefresh={refreshPortal} />;
  if (eff === "inactive") return <APNInactive meRow={meRow} db={db} mutate={mutate} onSignOut={signOut} isDark={isDark} pid={pid} />;
  // AGREE-MENT GATE: while any required document is unaccepted the server's
  // apn_agreement_status says required=true and the portal is fully replaced
  // by the review screen (visually distinct from account-suspended).
  if (agr && agr.required) return <APNAgreementGate isDark={isDark} onSignOut={signOut} required={agr.requiredList || []} onAccepted={refreshAgreements} />;

  const stats = apnPartnerStats(db, pid);
  const isHead = meRow.role === "district_head";
  const isStateHead = meRow.role === "state_head";
  const go = (t) => {
    if (t === "notifications") markNotificationsSeen().catch(() => {});
    setTab(t);
    setSidebarOpen(false);
  };
  const unreadNotif = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow) && apnActionRowTime(n) > apnActionReadTime(db, pid, "notification_unread")).length;
  const unackTargets = (db.apn_targets || []).filter((t) => t.partnerId === pid && !t.acknowledged).length;
  const withdrawalOpenCount = (db.apn_withdrawal_requests || []).filter((row) => row.partner_id === pid && ["pending", "under_review", "approved", "processing"].includes(row.status)).length;

  const section = () => {
    switch (tab) {
      case "home": return <APNHome db={db} meRow={meRow} stats={stats} snap={finSnap} pid={pid} go={go} openModal={setModal} mutate={mutate} profile={profile} onOpenProfile={() => go("profile")} />;
      case "leads": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading leads…</div></div>}><LazyAPNLeads db={db} meRow={meRow} pid={pid} openModal={setModal} mutate={mutate} runtime={{ apnLeadsOf, APN_SERVICE_LABEL, apnLeadTone, APN_LEAD_REJECTED, money, fmtDate, Empty, UserPlus, Plus, Handshake, AlertTriangle }} /></React.Suspense>;
      case "wallet": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading wallet…</div></div>}> <LazyAPNWallet db={db} pid={pid} stats={stats} snap={finSnap} runtime={{ APNMetric, APNWalletDetailModal: LazyAPNWalletDetailModal, APN_COMM_REVERSED, APN_WITHDRAWAL_TYPES, Empty, apnCommTone, apnCommissionProjectsOf, apnCommsOf, apnPayoutDate, apnProjectSummary, apnRequestAmount, apnRevenueCollectionsOf, apnSnapshotWallet, apnWalletLabel, apnWithdrawalLabel, apnWithdrawalTone, apnWithdrawalWalletFor, fmtDate, fmtDateTime, money }} />;</React.Suspense>;
      case "network": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading network…</div></div>}> <LazyAPNNetwork db={db} meRow={meRow} pid={pid} reload={reload} onOpenWithdrawals={() => go("withdrawals")} refreshTick={snapTick} runtime={{ APNReferralMetric, Avatar, Dashboard, Empty, Modal, fmtDate, fmtDateTime, money, referralCodeFor, referralLinkFor, referralQrFor, referralWalletFor, todayISO }} />;</React.Suspense>;
      case "chat": return (
        <React.Suspense fallback={<div className="allbee-loading-card">Loading Team Chat…</div>}>
          <LazyAPNTeamChat db={db} meRow={meRow} pid={pid} profile={profile} isDark={isDark} isOpen={tab === "chat"} refreshTick={snapTick} go={go}
            runtime={{ fmtDateTime, uid, emitToast, Empty, Avatar, apnIdFor, Search, Plus, Trash2, ChevronRight, ArrowLeft, FileText, Send, Bell, MessageSquare }} />
        </React.Suspense>
      );
      case "withdrawals": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading withdrawal center…</div></div>}><LazyAPNWithdrawalCenter db={db} pid={pid} goProfile={() => go("profile")} reload={reload} runtime={{ Empty, money, fmtDate, fmtDateTime, apnRequestAmount, apnWithdrawalLabel, apnWalletLabel, apnWithdrawalTone, apnWithdrawalWalletFor, apnPayoutDate, apnSnapshotWallet, apnCommsOf, apnCommissionProjectsOf, apnRevenueCollectionsOf, apnProjectSummary, APN_WITHDRAWAL_TYPES, APN_COMM_REVERSED, APNMetric, supabase }} /></React.Suspense>;
      case "learn": return <APNTraining db={db} meRow={meRow} pid={pid} mutate={mutate} />;
      case "targets": return <APNTargets db={db} pid={pid} mutate={mutate} go={go} />;
      case "quotations": return <APNQuotations db={db} meRow={meRow} pid={pid} openModal={setModal} />;
      case "documents": return <APNDocuments db={db} />;
      case "agreements": return <APNAgreementCenter db={db} pid={pid} onRefresh={refreshPortal} />;
      case "ai": return <APNAI meRow={meRow} go={go} mutate={mutate} pid={pid} />;
      case "support": return <APNSupportTickets pid={pid} refreshTick={snapTick} />;
      case "notifications": return <APNNotifications db={db} meRow={meRow} />;
      case "achievements": return <APNAchievements db={db} pid={pid} />;
      case "leaderboard": return <APNLeaderboard db={db} meRow={meRow} pid={pid} />;
      case "district": return isHead ? <APNDistrict db={db} meRow={meRow} mutate={mutate} /> : isStateHead ? <APNStateHead db={db} meRow={meRow} mutate={mutate} patchDb={patchDb} openModal={setModal} /> : <APNHome db={db} meRow={meRow} stats={stats} snap={finSnap} pid={pid} go={go} openModal={setModal} mutate={mutate} profile={profile} onOpenProfile={() => go("profile")} />;
      case "profile": return <APNProfile db={db} meRow={meRow} stats={stats} snap={finSnap} profile={profile} sessionEmail={session?.user?.email} mutate={mutate} onSignOut={signOut} reload={reload} isHead={isHead} go={go} />;
      default: return null;
    }
  };

  const moreItems = [
    ["targets", "Targets", <Target size={20} color="var(--primary)" />, unackTargets],
    ["quotations", "Quotations", <FileText size={20} color="var(--primary)" />, 0],
    ["documents", "Materials", <BookOpen size={20} color="var(--primary)" />, 0],
    ["agreements", "Agreements", <ScrollText size={20} color="var(--primary)" />, agr?.requiredCount || 0],
    ["notifications", "Notifications", <Bell size={20} color="var(--primary)" />, unreadNotif],
    ["learn", "Learn", <GraduationCap size={20} color="var(--primary)" />, 0],
    ["withdrawals", "Withdrawal Center", <Wallet size={20} color="var(--primary)" />, withdrawalOpenCount],
    ["ai", "ALLBEE AI", <Sparkles size={20} color="var(--primary)" />, 0],
    ["support", "My Tickets", <MessageCircle size={20} color="var(--primary)" />, 0],
    ["achievements", "Achievements", <Award size={20} color="var(--primary)" />, 0],
    ["leaderboard", "Leaderboard", <Trophy size={20} color="var(--primary)" />, 0],
    ...(isHead ? [["district", "District", <MapPin size={20} color="var(--primary)" />, 0]] : []),
    ...(isStateHead ? [["district", "State Command", <MapPin size={20} color="var(--primary)" />, 0]] : []),
    ["profile", "Profile", <User size={20} color="var(--primary)" />, 0],
  ];
  const primary = [["home", "Home", Home], ["leads", "Leads", UserPlus], ["wallet", "Wallet", Wallet], ["network", "My Network", Users], ["chat", "Team Chat", MessageSquare]];
  const showFab = tab === "leads" || tab === "quotations";
  return (
    <div className={`allbee apn apn-nav-shell${sidebarOpen ? " menu-open" : ""}`} data-theme={isDark ? "dark" : "light"}>
      <aside className="apn-desktop-sidebar" aria-label="APN navigation">
        <div className="apn-side-brand" role="button" tabIndex={0} onClick={() => go("home")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("home"); } }}>
          <FounderTap className="brand-logo" src={LOGO_ICON} alt="ALLBEE" />
          <div><div className="apn-side-title">ALLBEE</div><div className="apn-side-sub">Partner Network</div></div>
        </div>
        <div className="apn-side-section">MAIN</div>
        <div className="apn-side-links">
          {primary.map(([k, l, Icon]) => <button key={k} className={"apn-side-link" + (tab === k ? " active" : "")} onClick={() => go(k)}><Icon size={17} /><span>{l}</span>{k === "chat" && unreadNotif > 0 ? <span className="badge action-badge">{unreadNotif > 99 ? "99+" : unreadNotif}</span> : null}</button>)}
        </div>
        <div className="apn-side-section">WORKSPACE</div>
        <div className="apn-side-links">
          {moreItems.map(([k, l, ic, badge]) => <button key={k} className={"apn-side-link" + (tab === k ? " active" : "")} onClick={() => go(k)}>{ic}<span>{l}</span>{badge > 0 && <span className="badge action-badge">{badge > 99 ? "99+" : badge}</span>}</button>)}
        </div>
        <div className="apn-side-foot">
          <button className="apn-side-link" onClick={signOut}><LogOut size={17} color="var(--neg)" /><span style={{ color: "var(--neg)" }}>Sign out</span></button>
        </div>
      </aside>
      <div className="apn-main">
      <ToastHost />
       <header className="apn-top">
         <button type="button" className="brand-logo-button" onClick={() => go("home")} aria-label="Go to APN home" title="Go to APN home"><FounderTap className="brand-logo" src={LOGO_ICON} alt="APN" /></button>
         <button type="button" className="iconbtn" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? "Close menu" : "Open menu"} title="Menu" aria-expanded={sidebarOpen}><Menu size={19} /></button>
         <div style={{ flex: 1, minWidth: 0 }}><h1>APN</h1><div className="apn-id">{apnIdFor(meRow)} · {meRow.district || "Tamil Nadu"}{meRow.role === "state_head" && " · State Head"}</div></div>
        <PortalRefreshButton onRefresh={refreshPortal} />
        <button className="iconbtn" onClick={() => setSearchOpen(true)} title="Search"><Search size={17} /></button>
        <button className="iconbtn" style={{ position: "relative" }} onClick={() => go("notifications")}><Bell size={17} />{unreadNotif > 0 && <span className="badge action-badge" style={{ position: "absolute", top: -5, right: -5 }}>{unreadNotif > 99 ? "99+" : unreadNotif}</span>}</button>
        <button className="iconbtn" style={{ width: 36, height: 36, padding: 0, borderRadius: "50%" }} onClick={() => go("profile")} aria-label="Open APN profile" title="Profile"><Avatar name={meRow.name} url={apnAvatarUrl(meRow, profile)} size={30} fontSize={12} /></button>
      </header>

      <div className="apn-body"><div className="page-enter" key={tab}><APNTabErrorBoundary key={tab}>{section()}</APNTabErrorBoundary></div></div>

      {showFab && <button className="apn-fab" onClick={() => setModal({ type: tab === "leads" ? "apnLead" : "apnQuote" })}><Plus size={24} /></button>}

      {/* one global pull-to-refresh for every APN tab; overlays/sheets guard themselves */}
      <GlobalPullToRefresh enabled={!modal && !searchOpen && !sidebarOpen} onRefresh={refreshPortal} />

      <nav className="apn-bottomnav">
        {primary.map(([k, l, Icon]) => (
          <button key={k} className={"apn-tab" + (tab === k ? " on" : "") + (k === "network" ? " net" : "")} onClick={() => go(k)}><Icon size={k === "chat" ? 22 : 20} strokeWidth={k === "chat" ? 1.6 : 2} /><span>{l}</span></button>
        ))}
      </nav>
      </div>

      {searchOpen && <APNSearch db={db} meRow={meRow} pid={pid} go={go} onClose={() => setSearchOpen(false)} />}
      {modal?.type === "apnLead" && <React.Suspense fallback={<div className="modal-overlay"><div className="modal-card" aria-busy="true">Loading lead form…</div></div>}><LazyAPNLeadForm meRow={meRow} db={db} onSave={(l) => mutate((d) => ({ ...d, apn_leads: [...(d.apn_leads || []), l] }), { action: "submitted APN lead", module: "APN", entity: "APN Lead", entityId: l.id, partnerId: pid })} onClose={() => setModal(null)} runtime={{ APN_SERVICES, Field, SelectOther, Empty, Modal, SearchableSelect, supabase, emitToast, todayISO }} /></React.Suspense>}
      {modal?.type === "apnQuote" && <APNQuoteForm meRow={meRow} initial={modal.initial} onSave={(qq) => mutate((d) => ({ ...d, apn_quotations: (d.apn_quotations || []).some((x) => x.id === qq.id) ? d.apn_quotations.map((x) => x.id === qq.id ? qq : x) : [...(d.apn_quotations || []), qq] }), { action: modal.initial ? "updated APN quotation" : "generated APN quotation", module: "APN", entity: "APN Quotation", entityId: qq.id, partnerId: pid })} onClose={() => setModal(null)} />}
      {modal?.type === "apnReject" && <APNRejectForm partner={modal.partner} onSave={async (reason) => { try { const { error } = await supabase.rpc("apn_state_head_reject_partner", { p_partner_id: modal.partner.id, p_reason: reason || null }); if (error) throw error; const at = Date.now(); patchDb((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === modal.partner.id ? { ...u, status: "rejected", rejectReason: reason || null, rejectedBy: meRow.name, rejectedAt: at } : u) })); emitToast(`Rejected ${modal.partner.name}.`, "success"); } catch (e) { emitToast(e?.message || "Could not reject partner.", "error"); } finally { setModal(null); } }} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APN ADMIN (internal) — run by Haji / Alim / admins. Approvals, District Head
   appointment and reactivation are partner-only (superadmin) actions.
══════════════════════════════════════════════════════════════════════ */
const APN_APPROVERS = [
  { name: "Syed Hasan Kuddos Sahib", designation: "Co-Founder & CFO" },
  { name: "Mohamed Backer Alim Sahib", designation: "Founder & CEO" },
];
const apnApproverFor = (actor) => /syed|haji/i.test(String(actor || "")) ? APN_APPROVERS[0] : APN_APPROVERS[1];
const apnNotificationSender = (n) => {
  const approvedBy = n?.approvedBy || {};
  return { name: n?.senderName || approvedBy.name || n?.createdBy || "ALLBEE", designation: n?.senderDesignation || approvedBy.designation || n?.senderRole || "Admin", avatar: n?.senderAvatar || approvedBy.avatar || approvedBy.photo_url || "" };
};
const apnApprovalNotification = (partner, actor) => {
  const approvedBy = apnApproverFor(actor);
  return { title: "Welcome to APN 🎉", body: `Your partner account has been approved.\n\nApproved by\n${approvedBy.name}\n${approvedBy.designation}`, approvedBy, senderName: approvedBy.name, senderRole: approvedBy.designation, senderDesignation: approvedBy.designation, partnerId: partner.id, audience: `partner:${partner.id}` };
};
const apnNotify = (n) => {
  const createdAt = Date.now();
  return { id: uid(), title: n.title || "", body: n.body || "", audience: n.audience || "all", level: n.level || "General", reads: [], createdAt, createdDate: new Date(createdAt).toISOString().slice(0, 10), createdTime: new Date(createdAt).toTimeString().slice(0, 8), ...(n.approvedBy ? { approvedBy: n.approvedBy } : {}), ...(n.partnerId ? { partnerId: n.partnerId } : {}), ...(n.metadata ? { metadata: n.metadata } : {}), ...(n.senderName ? { senderName: n.senderName } : {}), ...(n.senderRole ? { senderRole: n.senderRole } : {}), ...(n.senderDesignation ? { senderDesignation: n.senderDesignation } : {}), ...(n.senderAvatar ? { senderAvatar: n.senderAvatar } : {}) };
};

/* ── admin forms ─────────────────────────────────────────────────────── */
function APNRejectForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Reject ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" onClick={() => { onSave(reason.trim()); onClose(); }}><X size={15} />Reject application</button></>}>
      <Field label="Reason (shown to the applicant)"><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Incomplete details" /></Field>
    </Modal>
  );
}
function APNLeadManage({ lead, onSave, onClose }) {
  const [f, setF] = useState({ status: lead.status, rejectReason: lead.rejectReason || "", revenue: lead.revenue || "", paymentReceived: !!lead.paymentReceived, projectCompleted: !!lead.projectCompleted });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const isConv = f.status === "Converted";
  const isRej = APN_LEAD_REJECTED.has(f.status);
  const locked = ["Approved", "Quotation Sent", "Converted"].includes(f.status);
  const save = () => {
    onSave({
      ...lead, status: f.status, rejectReason: isRej ? f.rejectReason.trim() : "",
      ownershipLocked: lead.ownershipLocked || locked, reviewedAt: lead.reviewedAt || Date.now(),
      revenue: isConv ? (Number(f.revenue) || 0) : lead.revenue,
      paymentReceived: isConv ? f.paymentReceived : false,
      projectCompleted: isConv ? f.projectCompleted : false,
      convertedAt: isConv ? (lead.convertedAt || Date.now()) : lead.convertedAt,
    });
    onClose();
  };
  return (
    <Modal title={`Lead — ${lead.clientName}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="hint-line" style={{ marginBottom: 10 }}>{lead.leadId} · {APN_SERVICE_LABEL[lead.service]} · by {lead.partnerName}{lead.mobile ? ` · ${lead.mobile}` : ""}</div>
      <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{APN_LEAD_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
      {isRej && <Field label="Rejection reason" hint="Partners can see this."><input className="input" value={f.rejectReason} onChange={(e) => set("rejectReason", e.target.value)} placeholder="Why is it rejected?" /></Field>}
      {isConv && (
        <>
          <Field label="Project revenue" required><input className="input mono" type="number" value={f.revenue} onChange={(e) => set("revenue", e.target.value)} placeholder="20000" /></Field>
          <div className="perm-list">
            <label className="perm-item"><input type="checkbox" checked={f.paymentReceived} onChange={(e) => set("paymentReceived", e.target.checked)} />Full payment received</label>
            <label className="perm-item"><input type="checkbox" checked={f.projectCompleted} onChange={(e) => set("projectCompleted", e.target.checked)} />Project completed</label>
          </div>
          <div className="hint-line" style={{ fontSize: 12, marginTop: 8 }}>Commission is generated automatically once payment is received and the project is completed.</div>
        </>
      )}
    </Modal>
  );
}
function APNTargetForm({ partners, heads, onSave, onClose }) {
  const [f, setF] = useState({ partnerId: partners[0]?.id || "", parentId: "", title: "", metric: "leads", goal: 5 });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.partnerId || !f.title.trim()) return;
    const p = partners.find((x) => x.id === f.partnerId);
    const head = (heads || []).find((x) => x.id === f.parentId);
    onSave({ id: uid(), partnerId: f.partnerId, partnerName: p?.name || "", parentId: f.parentId || null, parentName: head?.name || null, title: f.title.trim(), metric: f.metric, goal: Number(f.goal) || 0, acknowledged: false, createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Assign target" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Assign</button></>}>
      <div className="field"><label>Partner</label><SearchableSelect value={f.partnerId} onChange={(value) => set("partnerId", value)} ariaLabel="Assign target to partner" options={partners.map((p) => ({ value: p.id, label: p.name, meta: apnIdFor(p) }))} /></div>
      <div className="field"><label>Parent (district head) <span className="hint-line">optional</span></label><SearchableSelect value={f.parentId} onChange={(value) => set("parentId", value)} ariaLabel="District head who owns this target" options={(heads || []).map((h) => ({ value: h.id, label: h.name, meta: apnIdFor(h) }))} /></div>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 5 leads this month" /></Field>
      <div className="grid2">
        <Field label="Measure"><select className="select" value={f.metric} onChange={(e) => set("metric", e.target.value)}>{APN_TARGET_METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Goal"><input className="input mono" type="number" min="1" value={f.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
function APNTrainingForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { category: "website", title: "", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => { if (!f.title.trim()) return; onSave({ ...initial, id: initial?.id || uid(), category: f.category, title: f.title.trim(), body: f.body, createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit lesson" : "Add training lesson"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <Field label="Category"><select className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{APN_SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. How to pitch a website" /></Field>
      <Field label="Content"><textarea className="textarea" style={{ minHeight: 160 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write the training material…" /></Field>
    </Modal>
  );
}

function APNDocForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", category: "Sales script", url: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const fileRef = useRef(null);
  const pick = async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); setErr(""); try { const up = await uploadAttachment(file); setF((s) => ({ ...s, url: up.url, title: s.title || up.name })); } catch (er) { setErr(er.message || "Upload failed."); } finally { setBusy(false); if (e.target) e.target.value = ""; } };
  const save = () => { if (!f.title.trim() || !f.url.trim()) { setErr("Add a title and a file or link."); return; } onSave({ ...initial, id: initial?.id || uid(), title: f.title.trim(), category: f.category, url: f.url.trim(), notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit material" : "Upload material"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website price list" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={["Sales script", "Price list", "Brochure", "Poster", "Flyer", "Brand guideline"]} placeholder="Custom…" /></Field>
      </div>
      <Field label="File or link" required hint="Upload a file or paste a link.">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://… or upload →" />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
          <input ref={fileRef} type="file" onChange={pick} style={{ display: "none" }} />
        </div>
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}
function APNNotifForm({ partners, sender, onSave, onClose }) {
  const [f, setF] = useState({ title: "", body: "", level: "General", audience: "all", partnerId: "", district: TN_DISTRICTS[0] });
  const [partnerSearch, setPartnerSearch] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const partnerOptions = partners.filter((p) => !partnerSearch.trim() || [p.name, p.username, apnIdFor(p), p.mobile, p.email].filter(Boolean).join(" ").toLowerCase().includes(partnerSearch.trim().toLowerCase()));
  const selectedPartner = partners.find((p) => p.id === f.partnerId);
  const save = () => {
    if (!f.title.trim()) return;
    const audience = f.audience === "partner" ? "partner:" + f.partnerId : f.audience === "district" ? "district:" + f.district : "all";
    if (f.audience === "partner" && !f.partnerId) return;
    onSave(apnNotify({ title: f.title.trim(), body: f.body.trim(), level: f.level, audience, senderName: sender?.name, senderRole: sender?.role, senderDesignation: sender?.designation, senderAvatar: sender?.avatar }));
    onClose();
  };
  return (
    <Modal title="Send APN notification" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Send size={15} />Send</button></>}>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. New training available" /></Field>
      <Field label="Message"><textarea className="textarea" value={f.body} onChange={(e) => set("body", e.target.value)} /></Field>
      <div className="grid2">
        <Field label="Priority"><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{["General", "Important", "Urgent"].map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Audience"><select className="select" value={f.audience} onChange={(e) => set("audience", e.target.value)}><option value="all">All partners</option><option value="district">A district</option><option value="partner">One partner</option></select></Field>
      </div>
      {f.audience === "district" && <Field label="District"><select className="select" value={f.district} onChange={(e) => set("district", e.target.value)}>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>}
      {f.audience === "partner" && <><Field label="Search partner" hint="Search by name, username, APN ID, mobile, or email."><input className="input" value={partnerSearch} onChange={(e) => { setPartnerSearch(e.target.value); if (!e.target.value.trim()) set("partnerId", ""); }} placeholder="Type to search partners…" /></Field>{selectedPartner && <div className="tag" style={{ marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>{selectedPartner.name} · {apnIdFor(selectedPartner)}<button type="button" className="iconbtn" style={{ width: 20, height: 20, padding: 0 }} aria-label="Clear selected partner" onClick={() => { set("partnerId", ""); setPartnerSearch(""); }}><X size={12} /></button></div>}<div className="apn-list" role="listbox" aria-label="Partner search results" style={{ maxHeight: 180, overflowY: "auto" }}>{partnerOptions.slice(0, 25).map((p) => <button type="button" key={p.id} className="apn-rowcard" role="option" aria-selected={f.partnerId === p.id} onClick={() => { set("partnerId", p.id); setPartnerSearch(p.name); }} style={{ width: "100%", textAlign: "left", cursor: "pointer", border: f.partnerId === p.id ? "1px solid var(--primary)" : undefined }}><b>{p.name}</b><span className="hint-line" style={{ marginLeft: 8 }}>{apnIdFor(p)} · {p.mobile || p.email || "—"}</span></button>)}</div></>}
    </Modal>
  );
}

/* ── admin sub-views ─────────────────────────────────────────────────── */
function APNResetPasswordForm({ partner, onSave, onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    onSave(password);
  };
  return (
    <Modal title={`Reset password — ${partner.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><KeyRound size={15} />Reset password</button></>}>
      <div className="banner" style={{ margin: 0 }}><ShieldCheck size={15} />The partner will need the new password at their next sign-in.</div>
      <PasswordField label="New password" required error={err} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
      <PasswordField label="Confirm password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
    </Modal>
  );
}

function APNSuspendForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState(APN_SUSPEND_REASONS[0]);
  const [notes, setNotes] = useState("");
  return (
    <Modal title={`Suspend ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" onClick={() => onSave({ reason, notes: notes.trim() })}><XCircle size={15} />Confirm suspension</button></>}>
      <div className="banner" style={{ margin: 0, borderColor: "var(--neg)" }}><AlertTriangle size={15} />Login will be blocked and the partner cannot submit leads, create quotations, or receive commissions.</div>
      <Field label="Suspended because" required><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{APN_SUSPEND_REASONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Reason details"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context for the audit record…" /></Field>
    </Modal>
  );
}

function APNBanForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Ban ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}><Ban size={15} />Confirm ban</button></>}>
      <div className="banner" style={{ margin: 0, borderColor: "var(--neg)" }}><Ban size={15} />A ban permanently restricts the partner lifecycle: they count as banned everywhere, cannot be reactivated by a district head, and the reason is kept on the public record for this account.</div>
      <Field label="Ban reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Policy reason — shown to admins and retained in the audit log…" /></Field>
    </Modal>
  );
}

function APNReactivateForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState(APN_REACTIVATION_REASONS[0]);
  return (
    <Modal title={`Reactivate ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(reason)}><RefreshCw size={15} />Reactivate</button></>}>
      <div className="banner" style={{ margin: 0 }}><ShieldCheck size={15} />Login and APN activity will be restored. This decision will be recorded permanently.</div>
      <Field label="Reactivation reason" required><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{APN_REACTIVATION_REASONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
    </Modal>
  );
}

function APNWarningForm({ partner, onSave, onClose }) {
  const [type, setType] = useState(APN_WARNING_TYPES[0]);
  const [notes, setNotes] = useState("");
  return (
    <Modal title={`Add warning · ${partner.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave({ type, notes: notes.trim() })}><AlertTriangle size={15} />Issue warning</button></>}>
      <Field label="Warning type" required><select className="select" value={type} onChange={(e) => setType(e.target.value)}>{APN_WARNING_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Reason and notes" required><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the issue and expected follow-up…" autoFocus /></Field>
    </Modal>
  );
}

const apnSafeHtml = (html) => String(html || "")
  .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  .replace(/<(?!\/?(b|strong|i|em|u|br|p|ul|ol|li)\b)[^>]*>/gi, "");

function APNNoteForm({ initial, partner, onSave, onClose }) {
  const [html, setHtml] = useState(() => apnSafeHtml(initial?.bodyHtml || initial?.body || ""));
  const editorRef = useRef(null);
  const format = (command) => { editorRef.current?.focus(); document.execCommand(command, false); setHtml(apnSafeHtml(editorRef.current?.innerHTML || "")); };
  return (
    <Modal title={`${initial ? "Edit" : "Add"} internal note · ${partner.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(apnSafeHtml(editorRef.current?.innerHTML || html))} disabled={!apnSafeHtml(editorRef.current?.innerHTML || html).replace(/<[^>]*>/g, "").trim()}><Check size={15} />Save note</button></>}>
      <div className="banner" style={{ margin: 0 }}><ShieldCheck size={15} />Internal notes are visible only to Admins and Super Admins.</div>
      <div className="apn-note-tools"><button type="button" onClick={() => format("bold")} aria-label="Bold"><b>B</b></button><button type="button" onClick={() => format("italic")} aria-label="Italic"><i>I</i></button><button type="button" onClick={() => format("underline")} aria-label="Underline"><u>U</u></button></div>
      <div ref={editorRef} className="apn-note-editor" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html }} onInput={(e) => setHtml(apnSafeHtml(e.currentTarget.innerHTML))} role="textbox" aria-label="Internal note" />
    </Modal>
  );
}

function APNDeleteForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const ok = word === "DELETE" && reason.trim();
  return (
    <Modal title={`Delete ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} style={ok ? { background: "var(--neg)", borderColor: "var(--neg)" } : {}} onClick={() => onSave(reason.trim())}><Trash2 size={15} />Delete partner</button></>}>
      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>This archives the partner account, blocks login, and preserves financial, commission, audit, timeline, notification, and reporting history. The email and username remain reserved while the archive exists.</p>
      <Field label="Deletion reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being archived?" /></Field>
      <Field label={<>Type <b className="mono">DELETE</b> to continue</>} required><input className="input mono" value={word} onChange={(e) => setWord(e.target.value)} placeholder="DELETE" autoFocus /></Field>
    </Modal>
  );
}

function APNPermanentDeleteForm({ partner, onSave, onClose }) {
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const ok = word === "DELETE" && reason.trim();
  return (
    <Modal title={`Permanently delete ${partner.name}?`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={!ok} onClick={() => onSave(reason.trim())}><Trash2 size={15} />Permanently delete</button></>}>
      <div className="banner" style={{ margin: 0, borderColor: "var(--neg)" }}><AlertTriangle size={15} />This removes only the login identity. APN business records, financial history, commissions, audit, timeline, notifications, and reports are preserved; the email becomes reusable after the auth identity is removed.</div>
      <Field label="Reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why must this account be permanently removed?" /></Field>
      <Field label={<>Type <b className="mono">DELETE</b> to continue</>} required><input className="input mono" value={word} onChange={(e) => setWord(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}

const parseCsvText = (text) => {
  const rows = [];
  let row = [], cell = "", inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += ch; }
    else if (ch === '"') inq = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some((c) => c.trim())) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
  return rows;
};
function APNBulkForm({ action, partners, onSave, onClose }) {
  const [district, setDistrict] = useState(TN_DISTRICTS[0]);
  const [reason, setReason] = useState(APN_SUSPEND_REASONS[0]);
  const [message, setMessage] = useState("");
  const [word, setWord] = useState("");
  const [csvRows, setCsvRows] = useState(null);
  const [csvError, setCsvError] = useState("");
  const csvImport = ["Import Partners (CSV)", "Import Targets (CSV)"].includes(action);
  const readCsv = (file) => {
    setCsvError(""); setCsvRows(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setCsvError("Choose a .csv file.");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsvText(String(reader.result || "")).map((r) => r.map((c) => c.trim()));
        if (rows.length < 2) return setCsvError("The CSV needs a header row and at least one data row.");
        const header = rows[0].map((h) => h.toLowerCase());
        const data = rows.slice(1).filter((r) => r.some(Boolean));
        setCsvRows({ header, data, file: file.name });
      } catch { setCsvError("Could not read that CSV file."); }
    };
    reader.readAsText(file);
  };
  const destructive = action === "Delete";
  const ready = csvImport ? !!csvRows && !csvError
    : (!destructive && action !== "Send Notification") || word === "DELETE" || (action === "Send Notification" && message.trim().length > 0);
  const confirm = () => {
    if (csvImport) {
      onSave({ csv: csvRows }); return;
    }
    onSave({ district, reason, message: message.trim() });
  };
  const csvHint = ({ "Import Partners (CSV)": ["name", "mobile", "email", "district"].join(", "),
    "Import Targets (CSV)": ["partner", "title", "metric", "goal", "parent"].join(", ") }[action]);
  return (
    <Modal title={`${action} ${csvImport ? "" : partners.length + " partner" + (partners.length === 1 ? "" : "s")}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ready} style={destructive && ready ? { background: "var(--neg)", borderColor: "var(--neg)" } : {}} onClick={confirm}>Confirm</button></>}>
      <div className="banner" style={{ margin: 0 }}><Users size={15} />This operation will be recorded for every selected partner.</div>
      {(action === "Transfer District" || action === "Assign District Head") && <Field label="District" required><select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>{TN_DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select></Field>}
      {action === "Suspend" && <Field label="Suspension reason" required><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{APN_SUSPEND_REASONS.map((x) => <option key={x}>{x}</option>)}</select></Field>}
      {action === "Send Notification" && <Field label="Message" required><textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message for the selected partners…" /></Field>}
      {destructive && <Field label={<>Type <b className="mono">DELETE</b> to continue</>} required><input className="input mono" value={word} onChange={(e) => setWord(e.target.value)} placeholder="DELETE" autoFocus /></Field>}
      {csvImport && <>
        <Field label="CSV file" required hint={<>Header row: <b className="mono">{csvHint}</b>. A header is required; rows are matched by header name.</>}><input className="input" type="file" accept=".csv" onChange={(e) => readCsv(e.target.files?.[0])} /></Field>
        {csvError && <div className="auth-msg err"><AlertTriangle size={14} />{csvError}</div>}
        {csvRows && <div className="hint-line">{csvRows.data.length} data row{csvRows.data.length === 1 ? "" : "s"} ready from {csvRows.file}. {action === "Import Partners (CSV)" ? "Rows are added as Pending (restricted) — they need credentials from the Add Partner form before they can sign in." : "Each row becomes an admin-assigned governed target (par-value column optional)."}</div>}
      </>}
    </Modal>
  );
}

function APNPartnerDashboard({ summary, health }) {
  const cards = [["Total Leads", summary.leads], ["Converted Leads", summary.converted], ["Conversion Rate", `${summary.conv}%`], ["Revenue Generated", money(summary.revenue)], ["Commission Earned", money(summary.earned)], ["Commission Paid", money(summary.paid)], ["Pending Commission", money(summary.pending)], ["Active Targets", summary.activeTargets], ["Attendance", `${summary.attendance}%`], ["Health Score", health.score]];
  return <div className="apn-dashboard-grid">{cards.map(([label, value]) => <div className="apn-dashboard-card" key={label}><div className="k">{label}</div><div className="v">{value}</div></div>)}</div>;
}

function APNPartnerAnalytics({ rows }) {
  return <div className="apn-profile-section"><h4>Performance analytics</h4><div className="hint-line" style={{ marginBottom: 8 }}>Monthly data is normalized for future chart and API consumers.</div><div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards"><thead><tr><th>Month</th><th>Leads</th><th>Revenue</th><th>Commission</th><th>Attendance</th></tr></thead><tbody>{rows.map((r) => <tr key={r.key}><td data-label="Month">{r.label}</td><td data-label="Leads" className="mono">{r.leads}</td><td data-label="Revenue" className="mono">{money(r.revenue)}</td><td data-label="Commission" className="mono">{money(r.commission)}</td><td data-label="Attendance" className="mono">{r.attendance}%</td></tr>)}</tbody></table></div></div>;
}

function APNPartnerActivity({ rows }) {
  const [eventType, setEventType] = useState("all");
  const [user, setUser] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const types = [...new Set(rows.map((x) => x.eventType).filter(Boolean))].sort();
  const users = [...new Set(rows.map((x) => x.user).filter(Boolean))].sort();
  const filtered = rows.filter((x) => (!from || x.ts >= new Date(`${from}T00:00:00`).getTime()) && (!to || x.ts < new Date(`${to}T23:59:59`).getTime() + 1000) && (eventType === "all" || x.eventType === eventType) && (user === "all" || x.user === user));
  const pageSize = 12; const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => setPage(0), [eventType, user, from, to]);
  return <div className="apn-profile-section"><h4>Complete activity history</h4><div className="apn-activity-filters"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Activity from date" /><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Activity to date" /><select className="select" value={eventType} onChange={(e) => setEventType(e.target.value)}><option value="all">All event types</option>{types.map((x) => <option key={x}>{x}</option>)}</select><select className="select" value={user} onChange={(e) => setUser(e.target.value)}><option value="all">All users</option>{users.map((x) => <option key={x}>{x}</option>)}</select></div>{visible.length ? visible.map((x) => <div className="apn-activity-row" key={x.id}><div><b>{x.title}</b><div className="hint-line">{x.description}</div></div><div className="apn-activity-meta">{fmtDateTime(x.ts)} · {x.user || "System"}</div></div>) : <div className="hint-line">No matching activity.</div>}{pages > 1 && <div className="apn-pagination"><button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="hint-line">Page {page + 1} of {pages}</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</div>;
}

function APNAdminActivityLog({ db, isSuper, onOpenRelated }) {
  const partners = db.apn_users || [];
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const rows = useMemo(() => partners.flatMap((partner) => {
    const person = (db.profiles || []).find((x) => x.id === partner.id);
    return apnActivityHistory(db, partner, person).map((entry) => ({
      ...entry, id: `apn-log:${partner.id}:${entry.id}`, partnerId: partner.id, partner: partner.name, apnId: apnIdFor(partner),
      module: "APN", action: entry.title, entity: "APN Partner", entityId: partner.id, description: entry.description || entry.title,
    }));
  }).sort((a, b) => (b.ts || 0) - (a.ts || 0)), [db, partners]);
  const eventTypes = useMemo(() => [...new Set(rows.map((x) => x.eventType).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const day = row.ts ? new Date(row.ts).toLocaleDateString("en-CA") : "";
      const haystack = [row.partner, row.apnId, row.user, row.description, row.entity, row.module, row.action, row.eventType].filter(Boolean).join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (partnerId === "all" || row.partnerId === partnerId) && (eventType === "all" || row.eventType === eventType)
        && (!from || day >= from) && (!to || day <= to);
    });
  }, [rows, search, partnerId, eventType, from, to]);
  useEffect(() => setPage(0), [search, partnerId, eventType, from, to]);
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const list = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const columns = [
    { label: "Date & Time", value: (x) => x.ts ? fmtDateTime(x.ts) : "" }, { label: "Partner", value: (x) => `${x.partner || "—"} (${x.apnId || "—"})` },
    { label: "Action", value: (x) => x.action || "" }, { label: "Module", value: () => "APN" }, { label: "Description", value: (x) => x.description || "" },
  ];
  return <div className="content">
    <div className="page-head"><h3>APN Activity Log</h3><span className="spacer" /><span className="hint-line">Partner activity only</span></div>
    <div className="card" style={{ padding: 12, marginBottom: 12 }}><div className="audit-filter-grid">
      <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partner, APN ID, action, module, description…" aria-label="Search APN activity" />
      <select className="select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} aria-label="Filter APN activity by partner"><option value="all">All partners</option>{partners.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))).map((p) => <option key={p.id} value={p.id}>{p.name} · {apnIdFor(p)}</option>)}</select>
      <select className="select" value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Filter APN activity by event"><option value="all">All events</option>{eventTypes.map((x) => <option key={x}>{x}</option>)}</select>
      <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="APN activity from date" /><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="APN activity to date" />
      {isSuper && <><button className="btn sm" onClick={() => downloadActivityCsv(filtered)}><Download size={13} />CSV</button><button className="btn sm" onClick={() => exportRowsToExcel(`allbee-apn-activity-${todayISO()}.xlsx`, "APN Activity", columns, filtered)}><Sheet size={13} />Excel</button></>}
    </div></div>
    <div className="card"><div className="hint-line" style={{ padding: "0 0 10px" }}>{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</div>{list.length ? <div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards"><thead><tr><th>Date & time</th><th>Partner</th><th>Action</th><th>Module</th><th>Description</th></tr></thead><tbody>{list.map((row) => <tr key={row.id} tabIndex={0} role="button" aria-label={`Open APN activity ${row.action} for ${row.partner}`} onClick={() => setSelected(row)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(row); } }} style={{ cursor: "pointer" }}><td data-label="When" className="hint-line">{fmtDateTime(row.ts)}</td><td data-label="Partner"><div style={{ display: "flex", alignItems: "center", gap: 7 }}><Avatar name={row.partner} url={apnAvatarUrl(partners.find((p) => p.id === row.partnerId))} size={26} /><div><div style={{ fontWeight: 600 }}>{row.partner}</div><div className="hint-line" style={{ fontSize: 11 }}>{row.apnId}</div></div></div></td><td data-label="Action">{row.action}</td><td data-label="Module"><span className="tag">APN</span></td><td data-label="Description">{row.description || "—"}</td></tr>)}</tbody></table></div> : <Empty icon={<Activity size={22} color="var(--muted)" />} title="No APN activity" text="Partner activity will appear here as APN events are recorded." />}{pages > 1 && <div className="apn-pagination"><button className="btn sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="hint-line">Page {page + 1} of {pages}</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</div>
    {selected && <ActivityDetailsDrawer activity={selected} db={db} isSuper={isSuper} onClose={() => setSelected(null)} onRelated={(related, activity) => { setSelected(null); onOpenRelated?.(related, activity); }} />}
  </div>;
}

function APNPartnerDocuments({ documents, isSuper, onAdd, onDownload }) {
  return <div className="apn-profile-section"><div className="apn-section-head"><h4>Documents</h4><span className="spacer" />{isSuper && <button className="btn sm" onClick={onAdd}><Plus size={13} />Add document</button>}</div>{documents.length ? documents.map((d) => <div className="apn-document-row" key={d.id}><FileText size={15} /><div style={{ flex: 1 }}><b>{d.type || "Document"}</b><div className="hint-line">Version {d.version || 1} · Uploaded by {d.uploadedBy || "—"} · {fmtDateTime(d.uploadedOn || d.createdAt)} · {d.versions?.length || 0} prior version(s) · {d.downloadHistory?.length || 0} download(s)</div></div>{d.storagePath && <button className="btn sm" onClick={() => onDownload(d)}><Download size={13} />Download</button>}</div>) : <div className="hint-line">No private partner documents uploaded.</div>}<div className="hint-line" style={{ marginTop: 8 }}>Stored in private Supabase Storage with signed downloads and version metadata.</div></div>;
}

function APNPartnerCommunications({ rows, onAdd, isSuper }) {
  return <div className="apn-profile-section"><div className="apn-section-head"><h4>Communication log</h4><span className="spacer" />{isSuper && <button className="btn sm" onClick={onAdd}><Plus size={13} />Log communication</button>}</div>{rows.length ? rows.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((x) => <div className="apn-activity-row" key={x.id}><div><b>{x.type || "Communication"} · {x.subject || "No subject"}</b><div className="hint-line">{x.sender || "—"} → {x.receiver || "Partner"} · {x.status || "Logged"}</div></div><div className="apn-activity-meta">{fmtDateTime(x.createdAt)}</div></div>) : <div className="hint-line">No communication history recorded.</div>}</div>;
}


export function RemoteLockGate({ isDark, signOut, pause, children }) {
  const [status, setStatus] = useState("checking"); // checking | locked | unlocked | offline
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [reveal, setReveal] = useState(false);
  const signedOutRef = useRef(false);
  // Hidden logo-tap entrance to the founder authorization flow — shared with
  // every shell logo via FounderTapContext. Server-side code check remains the
  // real security boundary. Taps 1-16 idle silently; 17/18/19 show 3/2/1;
  // 20 arms; 21 opens the existing authorization screen; 2500ms inactivity resets.
  const [tapCount, setTapCount] = useState(0);
  const [armed, setArmed] = useState(false);
  const [countAnim, setCountAnim] = useState(true);
  const lastTapRef = useRef(0);
  const resetTimerRef = useRef(null);
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mq.matches;
    const onChange = (e) => { reduceMotionRef.current = e.matches; };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  useEffect(() => () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); }, []);
  useEffect(() => {
    if (tapCount === 0) return undefined;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setTapCount(0); setArmed(false);
    }, FOUNDER_TAP_TIMEOUT_MS);
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, [tapCount]);
  const tap = useCallback(() => {
    // De-duplicate: browsers can fire repeat pointer/click events around a
    // single physical tap (esp. touch) — require a real gap between taps.
    const now = Date.now();
    if (now - lastTapRef.current < 250) return;
    lastTapRef.current = now;
    setCountAnim(!reduceMotionRef.current);
    setTapCount((c) => {
      if (c >= 20) { setArmed(false); setStatus("locked"); return 0; }
      if (c === 19) { setArmed(true); }
      return c + 1;
    });
  }, []);
  const tapValue = useMemo(() => ({ tap, count: tapCount, armed, anim: countAnim }), [tap, tapCount, armed, countAnim]);
  const endpoint = `${SUPABASE_URL}/functions/v1/founder-lockdown`;

  const poll = useCallback(async () => {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      if (!r.ok) throw new Error("status unavailable");
      const j = await r.json();
      setStatus(j.locked ? "locked" : "unlocked");
    } catch {
      setStatus((prev) => (prev === "checking" ? "offline" : prev));
    }
  }, [endpoint]);

  useEffect(() => {
    if (pause) { setStatus("locked"); return undefined; }
    let cancelled = false;
    const tick = async () => { await poll(); if (!cancelled) setTimeout(tick, 30000); };
    tick();
    return () => { cancelled = true; };
  }, [pause, poll]);

  // A lockdown drains local sessions so every account must sign in afresh
  // once services are restored (per the founder lockdown protocol).
  useEffect(() => {
    if (status === "locked" && !signedOutRef.current) {
      signedOutRef.current = true;
      if (signOut) signOut();
    }
  }, [status, signOut]);

  const authorize = async () => {
    const candidate = code.trim();
    if (!candidate) { setError("Enter the authorization code."); return; }
    setBusy(true); setError(""); setOk(false);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: candidate }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) setError("Too many attempts. Wait a few minutes, then try again.");
      else if (r.status === 401 || j.ok === false) setError("Incorrect authorization code.");
      else if (!r.ok || j.ok !== true) setError("The authorization service could not be reached. Try again.");
      else { setCode(""); setOk(true); }
    } catch {
      setError("Could not reach the authorization service — check your connection.");
    } finally { setBusy(false); }
  };

  const card = (node) => (
    <div className="lock-card founder-gate-card">
      <FounderTap className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 52 }} />
      <h1>ALLBEE</h1>
      {node}
    </div>
  );

  return (
    <FounderTapContext.Provider value={tapValue}>
      {status === "unlocked" ? (children || null) : (
        <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
          <ToastHost />
          {status === "checking" && card(
            <div className="loading-label" style={{ justifyContent: "center" }}><RefreshCw size={15} className="spin" />Checking services…</div>
          )}
          {status === "offline" && card(
            <>
              <div className="founder-gate-status err"><CloudOff size={15} /> ALLBEE services could not be reached</div>
              <p className="hint-line">Check your connection. The app will keep retrying automatically.</p>
              <button className="btn founder-gate-btn" onClick={poll}><RefreshCw size={15} />Try again now</button>
              {import.meta.env.MODE === "development" && <button className="linkbtn" onClick={() => setStatus("unlocked")}>Development build — skip the check</button>}
            </>
          )}
          {status === "locked" && card(
            <>
              <p className="founder-gate-sub">Our services are temporarily unavailable.</p>
              <div className="founder-gate-status active"><ShieldAlert size={15} /> Founder-controlled maintenance in progress</div>
              <label className="founder-gate-label" htmlFor="founder-code">Authorization code</label>
              <div className="founder-code-row">
                <input id="founder-code" className="input" type={reveal ? "text" : "password"} value={code}
                  onChange={(e) => setCode(e.target.value)} placeholder="Enter code" autoComplete="off" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") authorize(); }} />
                <button className="iconbtn" type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Hide code" : "Show code"}>
                  {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <button className="btn primary founder-gate-btn" disabled={busy || !code.trim()} onClick={authorize}>
                {busy ? <RefreshCw size={15} className="spin" /> : <ShieldCheck size={15} />}{busy ? "Verifying…" : "Authorize"}
              </button>
              {error && <div className="auth-msg err"><AlertTriangle size={14} /> {error}</div>}
              {ok && <div className="auth-msg ok"><CheckCircle2 size={14} /> Authorized. Services restore when the founder completes protocol #301.</div>}
              <p className="hint-line founder-gate-hint">Expected for authorized personnel only. If you are not authorized, please close this window.</p>
            </>
          )}
        </div>
      )}
    </FounderTapContext.Provider>
  );
}

// Deterministic write queue: callers enqueue snapshots, and each write waits
// for the previous one. If a write fails, the next job rebases against the
// latest committed snapshot before persisting, preventing optimistic state from
// carrying an uncommitted/failed change into the next database write.

export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState(undefined);  // undefined = loading, null = none
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);
  const [isDark, setIsDark] = useState(() => { try { const v = localStorage.getItem("allbee_theme"); return v ? v === "dark" : false; } catch { return false; } });
  const [route, setRoute] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);   // universal search (Ctrl/⌘+K)
  const [topBusy, setTopBusy] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [modal, setModal] = useState(null); // {type, ...}
  const [activityDetail, setActivityDetail] = useState(null);
  const [apnFocusPartnerId, setApnFocusPartnerId] = useState(null);
  const [balanceUser, setBalanceUser] = useState(null);
  const [accountUser, setAccountUser] = useState(null);   // full-page partner statement (Haji/Alim)
  const [taskDetailId, setTaskDetailId] = useState(null); // full-page task detail
  const [config, setConfig] = useState(null);             // app_config (T&C body + version)
  const [locks, setLocks] = useState([]);                 // locked financial periods ('YYYY-MM')
  const [navOrder, setNavOrder] = useState(() => { try { return JSON.parse(localStorage.getItem("allbee_navorder") || "null") || []; } catch { return []; } });
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem("allbee_favs") || "null") || []; } catch { return []; } });
  const [navSort, setNavSort] = useState(() => { try { return localStorage.getItem("allbee_navsort") || "category"; } catch { return "category"; } });
  const dragNavRef = useRef(null);
  const publicProposalToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    const query = new URLSearchParams(window.location.search || "").get("proposal");
    const raw = String(window.location.hash || "").replace(/^#\/?/, "").split("?")[0].split("/");
    return query || (raw[0] === "proposal" && raw[1] ? decodeURIComponent(raw[1]) : "");
  }, []);

  const currentUser = profile?.name || null;
  const role = profile?.role;
  const isSuper = isSuperRole(role);
  const isAdmin = isAdminRole(role);        // management level (superadmin OR admin)
  const inactiveCount = useMemo(() => (isSuper ? inactiveMembers(team).length : 0), [isSuper, team]);
  const canFinance = canFinanceRole(role);  // the money (superadmin OR accountant)
  const me = { id: session?.user?.id, name: currentUser, role };

  // ── tap feedback ──────────────────────────────────────────────────────
  // Subtle tap feedback on interactive elements, app-wide. Very light, and only
  // on real taps of buttons/nav (not typing or scrolling). Works where the device
  // supports the web vibration API (Android); iOS Safari has no equivalent.
  useEffect(() => {
    const onTap = (e) => {
      const t = e.target;
      const el = t && t.closest ? t.closest("button, .btn, .navitem, .iconbtn, .userchip, .seg button, [role='button']") : null;
      if (el && !el.disabled) haptic(6);
    };
    document.addEventListener("pointerdown", onTap, { passive: true });
    return () => document.removeEventListener("pointerdown", onTap);
  }, []);

  // ── universal search shortcut (Ctrl / ⌘ + K) ───────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── auth session ──────────────────────────────────────────────────────
  const handleAuthRecovery = useMemo(() => createSessionRecovery(
    async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return data.session ?? null;
    },
    (e) => {
      setSyncError(e?.message || "Your session expired. Please sign in again.");
      setSession(null);
    },
  ), []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setSyncError(error.message || "Could not restore your session."); return; }
      setSession(data.session ?? null);
    }).catch((e) => { if (mounted) setSyncError(e?.message || "Could not restore your session."); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (_evt === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // Record a fresh sign-in time (best-effort; the column may not exist yet).
      if (_evt === "SIGNED_IN" && s && s.user) {
        supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", s.user.id).then(() => {}, () => {});
        const actor = s.user.user_metadata?.name || s.user.email?.split("@")[0] || "System";
        appendAuditEvent({ user: actor, userId: s.user.id, action: "logged in", module: "System", entity: "Authentication", description: `${actor} logged in` }).catch(() => {});
      }
      // Supabase auto-refreshes the JWT whenever the tab/app regains focus and
      // fires TOKEN_REFRESHED with a brand-new session object. That object change
      // used to re-run the data-load effect, flip `loading`, and remount the whole
      // page — wiping anything you were typing. Only update when the actual signed-in
      // user changes (sign in / sign out / switch account); ignore pure token
      // refreshes by returning the previous reference so React skips the update.
      if (_evt === "SIGNED_OUT") authRecoveryRef.current = false;
      setSession((prev) => {
        const prevId = prev && prev.user ? prev.user.id : null;
        const nextId = s && s.user ? s.user.id : null;
        if (prevId === nextId) return prev;   // same user → no churn, no reload
        return s ?? null;
      });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // ── load my profile + the team + config, with live updates ────────────
  const loadPeople = useCallback(async (user) => {
    try {
      await ensureProfile(user);
      const [list, cfg, lk] = await Promise.all([fetchTeam(), fetchConfig(), fetchLocks()]);
      setTeam(list);
      setConfig(cfg);
      setLocks(lk);
      setProfile(list.find((p) => p.id === user.id) || null);
    } catch (e) { setSyncError(e.message || String(e)); setProfile(null); }
  }, []);

  useEffect(() => {
    if (!session) { setProfile(undefined); setTeam([]); setConfig(null); setLocks([]); return; }
    loadPeople(session.user);
    const ch = supabase.channel("allbee-people")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "*", schema: "public", table: "app_config" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "*", schema: "public", table: "fin_locks" }, async () => setLocks(await fetchLocks()));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, loadPeople]);

  const reloadGenerationRef = useRef(0);
  const reloadInFlightRef = useRef(null);
  const reload = useCallback(async () => {
    const generation = ++reloadGenerationRef.current;
    // Coalesce concurrent callers into one physical snapshot request. Every
    // caller still receives the same promise, while the generation ensures an
    // older snapshot can never overwrite a newer one.
    const request = reloadInFlightRef.current || fetchAll();
    reloadInFlightRef.current = request;
    try {
      const fresh = await request;
      if (generation !== reloadGenerationRef.current) return fresh;
      setDb(fresh);
      setSyncError(null);
      return fresh;
    } catch (e) {
      if (generation === reloadGenerationRef.current) {
        setSyncError(e.message || String(e));
        setDb((d) => d || emptyDB());
      }
      throw e;
    } finally {
      if (reloadInFlightRef.current === request) reloadInFlightRef.current = null;
      if (generation === reloadGenerationRef.current) setLoading(false);
    }
  }, []);

  // Recover after network restoration / laptop wake without forcing a full
  // remount. The existing reload generation + queue provide the race safety.
  useEffect(() => {
    if (!session) return undefined;
    const cleanup = createConnectivityRecovery({
      onOnline: () => setSyncError(null),
      onOffline: () => setSyncError("You are offline. Changes will retry when the connection returns."),
      refresh: () => reload(),
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) reload().catch(() => {});
    };
    window.addEventListener("visibilitychange", onVisibility);
    return () => { cleanup(); window.removeEventListener("visibilitychange", onVisibility); };
  }, [session, reload]);


  // Fast first paint: load only the collections needed by the common dashboard
  // and then hydrate the rest without holding the user behind the loader.
  const bootstrap = useCallback(async () => {
    const started = performance.now();
    try {
      const initial = await fetchBootstrapData();
      setDb(initial);
      setLoading(false);
      setSyncError(null);
      // Full hydration is intentionally detached from the first paint. It fills
      // APN/CRM/AI/referral/audit data after the shell is already interactive.
      const hydrationGeneration = ++reloadGenerationRef.current;
      const hydrationRequest = fetchAll();
      reloadInFlightRef.current = hydrationRequest;
      hydrationRequest.then((full) => {
        if (hydrationGeneration !== reloadGenerationRef.current) return;
        setDb(full);
      }).catch((e) => {
        if (hydrationGeneration === reloadGenerationRef.current) setSyncError(e.message || String(e));
      }).finally(() => {
        if (reloadInFlightRef.current === hydrationRequest) reloadInFlightRef.current = null;
      });
      console.info(`[ALLBEE] fast bootstrap ready in ${Math.round(performance.now() - started)}ms`);
    } catch (e) {
      setDb((current) => current || emptyDB());
      setLoading(false);
      setSyncError(e.message || String(e));
    }
  }, []);

  const markApnActionBadgeSeen = useCallback(async (actionType) => {
    if (!profile?.id || !APN_ACTION_BADGE_MAP.some((item) => item.actionType === actionType)) return;
    const seenAt = new Date().toISOString();
    setDb((prev) => {
      if (!prev) return prev;
      const withoutCurrent = (prev.apn_action_badge_reads || []).filter((row) => !(row.user_id === profile.id && row.action_type === actionType));
      return { ...prev, apn_action_badge_reads: [...withoutCurrent, { user_id: profile.id, action_type: actionType, seen_at: seenAt }] };
    });
    const { error } = await supabase.rpc("mark_apn_action_badge_seen", { p_action_type: actionType });
    if (error) {
      setSyncError(error.message || "Could not save APN badge read state.");
      await reload();
    }
  }, [profile?.id, reload]);

  const handleCommissionDeleted = useCallback((project) => {
    setDb((prev) => {
      if (!prev) return prev;
      const crmProjectIds = new Set((prev.crm_projects || []).filter((row) => row.apn_project_id === project.id).map((row) => row.id));
      return {
        ...prev,
        apn_commission_projects: (prev.apn_commission_projects || []).filter((row) => row.id !== project.id),
        apn_revenue_collections: (prev.apn_revenue_collections || []).filter((row) => row.projectId !== project.id),
        apn_referral_earnings: (prev.apn_referral_earnings || []).filter((row) => row.project_id !== project.id),
        crm_projects: (prev.crm_projects || []).map((row) => crmProjectIds.has(row.id) ? { ...row, apn_project_id: null } : row),
        apn_notifications: (prev.apn_notifications || []).filter((row) => row.metadata?.projectId !== project.id),
        notifications: (prev.notifications || []).filter((row) => row.metadata?.projectId !== project.id),
        apn_timeline: (prev.apn_timeline || []).filter((row) => row.relatedId !== project.id),
      };
    });
  }, []);



// ── load data + live sync while signed in ─────────────────────────────
  useEffect(() => {
    if (!session) { setDb(null); setLoading(false); return; }
    setLoading(true);
    bootstrap();
    // Realtime can emit several row events for one logical action (and chat/
    // notification activity can arrive in bursts). Never start a full database
    // reload for every event. Coalesce the burst into one reload on the next
    // event-loop turn, while preserving the latest requested refresh.
    let reloadTimer = null;
    let reloadInFlight = null;
    let reloadQueued = false;
    const scheduleReload = () => {
      reloadQueued = true;
      if (reloadTimer || reloadInFlight) return;
      reloadTimer = setTimeout(async () => {
        reloadTimer = null;
        if (!reloadQueued) return;
        reloadQueued = false;
        reloadInFlight = reload().catch(() => {}).finally(() => {
          reloadInFlight = null;
          if (reloadQueued) scheduleReload();
        });
      }, 150);
    };
    const configureChannel = (name, statusHandler) => {
      const channel = supabase.channel(name);
      TABLES.filter((t) => t !== "audit").forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      Object.keys(REFERRAL_READS).forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      Object.keys(WITHDRAWAL_READS).forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      Object.keys(CRM_READS).forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      Object.keys(AI_READS).forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      Object.keys(CLIENT_READS).forEach((t) => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
      channel.on("postgres_changes", { event: "*", schema: "public", table: "apn_action_badge_reads", filter: `user_id=eq.${session.user.id}` }, scheduleReload);
      channel.on("postgres_changes", { event: "*", schema: "public", table: "audit" }, () => {
        fetchAuditRows().then((audit) => setDb((prev) => prev ? { ...prev, audit } : prev)).catch((e) => setSyncError(e.message || String(e)));
      });
      channel.subscribe(statusHandler);
      return { unsubscribe: () => supabase.removeChannel(channel) };
    };
    let realtime = createRealtimeReconnect({
      createChannel: (statusHandler) => configureChannel(`allbee-db-sync:${Date.now()}`, statusHandler),
      onReconnect: () => scheduleReload(),
      onError: (e) => console.warn("[ALLBEE] realtime reconnect:", e),
    });
    return () => { realtime.stop(); };
  }, [session, reload, bootstrap]);

  // If an admin changes my role or the modules I'm granted while I'm signed in,
  // my row-level access changes — so refetch everything under the new permissions
  // (otherwise a freshly-granted module would show up empty until a refresh).
  const accessKey = `${profile?.role || ""}|${JSON.stringify(profile?.perms?.modules || [])}`;
  const accessKeyRef = useRef(accessKey);
  useEffect(() => {
    if (accessKeyRef.current !== accessKey) {
      accessKeyRef.current = accessKey;
      if (session && db) reload();
    }
  }, [accessKey, session, db, reload]);

  // mutate(updater, auditEntryOrNull) — updates the screen instantly, then
  // saves only the rows that changed. The other staff member's screen updates live.
  // Every mutation gets one standardized activity event. Explicit audit
  // descriptions remain authoritative; older paths without one receive a
  // backward-compatible event derived from the changed collection.
  const enqueuePersist = useMemo(() => createPersistQueue({ persist: persistWithRetry, rebase: fetchAll }), []);

  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const mutate = useCallback((updater, audit) => {
    // Never perform persistence as a side effect inside a React state updater.
    // React may invoke functional updaters more than once in development/Strict
    // Mode; doing I/O there can duplicate writes and audit events. Keep a
    // synchronous ref as the optimistic source of truth, then enqueue exactly
    // one persistence job for the transition we just calculated.
    const prev = dbRef.current;
    if (!prev) return;
    let next = updater(prev);
    const derived = activityForMutation(prev, next);
    const supplied = audit ? { ...audit, entity: audit.entity || derived?.entity, entityId: audit.entityId || derived?.entityId } : derived;
    if (supplied) {
      const event = activityEntry({ id: uid(), ts: Date.now(), ...supplied }, { user: currentUser || "—", userId: me.id, avatar: profile?.photo_url });
      next = { ...next, audit: [...(next.audit || []), event] };
    }
    dbRef.current = next;
    setDb(next);
    enqueuePersist(prev, next).catch((e) => setSyncError(e.message || String(e)));
  }, [currentUser, me.id, profile?.photo_url, enqueuePersist]);

  const patchDb = useCallback((updater) => { setDb((prev) => (prev ? updater(prev) : prev)); }, []);

  const recordActivity = useCallback((entry) => {
    appendAuditEvent(activityEntry(entry, { user: currentUser || "—", userId: me.id, avatar: profile?.photo_url })).catch((e) => setSyncError(e.message || String(e)));
  }, [currentUser, me.id, profile?.photo_url]);

  // ── soft delete (recycle bin) ─────────────────────────────────────────
  // Move a row out of its table and into `recycle` instead of destroying it.
  // Original screens need no change — the row simply disappears from their list.
  // Audit is written for admins only (staff have no access to the audit table),
  // but a staff member's deleted item is still recoverable by an admin.
  const removeItem = useCallback((table, item, opts = {}) => {
    const cascade = Array.isArray(opts.cascadeRows) ? opts.cascadeRows.filter((x) => x && x.id !== item.id) : [];
    const name = opts.name || item.name || item.title || item.client || "item";
    const module = MODULE_LABEL[table] || table;
    const rec = {
      id: uid(), table, module, name, item,
      deletedBy: currentUser || "—", deletedById: me.id || null, deletedAt: Date.now(),
    };
    const cascadeRecs = cascade.map((row) => ({
      id: uid(), table, module, name: opts.cascadeLabel || name, item: row,
      deletedBy: currentUser || "—", deletedById: me.id || null, deletedAt: Date.now(),
    }));
    mutate(
      (d) => ({ ...d, [table]: d[table].filter((x) => x.id !== item.id && !cascade.some((c) => c.id === x.id)), recycle: [...d.recycle, rec, ...cascadeRecs] }),
      { action: opts.audit || `deleted ${module.toLowerCase()} "${name}"`, module }
    );
  }, [mutate, currentUser, isAdmin, me.id]);

  // Restore a recycled row back into its original table.
  const restoreItem = useCallback((rec) => {
    mutate((d) => {
      const exists = (d[rec.table] || []).some((x) => x.id === rec.item.id);
      return {
        ...d,
        [rec.table]: exists ? d[rec.table] : [...(d[rec.table] || []), rec.item],
        recycle: d.recycle.filter((r) => r.id !== rec.id),
      };
    }, { action: `restored ${rec.module.toLowerCase()} "${rec.name}"`, module: rec.module });
  }, [mutate, isAdmin]);

  // Auto-cleanup: permanently drop recycle rows older than 60 days. Runs once
  // per load for admins (their RLS lets them delete any recycle row). This is a
  // client-side sweep — see README for the optional server-side cron upgrade.
  const purgedRef = useRef(false);
  const purgeExpired = useCallback(() => {
    const cutoff = Date.now() - RECYCLE_TTL_DAYS * 86400000;
    setDb((prev) => {
      if (!prev || !prev.recycle?.length) return prev;
      const keep = prev.recycle.filter((r) => (r.deletedAt || 0) >= cutoff);
      if (keep.length === prev.recycle.length) return prev;
      const next = { ...prev, recycle: keep };
      enqueuePersist(prev, next).catch((e) => setSyncError(e.message || String(e)));
      return next;
    });
  }, [enqueuePersist]);

  // Retention: drop testing screenshots older than 30 days (references + the
  // underlying storage objects) so QA images don't grow storage forever. Runs
  // once per load for admins, mirroring the recycle-bin sweep above.
  const purgeTestImages = useCallback(() => {
    const cutoff = Date.now() - TEST_IMAGE_TTL_DAYS * 86400000;
    setDb((prev) => {
      if (!prev || !(prev.testing || []).length) return prev;
      const toRemove = [];
      let changed = false;
      const testing = prev.testing.map((s) => {
        if (!Array.isArray(s.bugs) || !s.bugs.length) return s;
        let bugChanged = false;
        const bugs = s.bugs.map((b) => {
          if (!Array.isArray(b.images) || !b.images.length) return b;
          const keep = b.images.filter((im) => (im.at || 0) >= cutoff);
          if (keep.length === b.images.length) return b;
          bugChanged = true;
          for (const im of b.images) if ((im.at || 0) < cutoff) { const p = im.path || storagePathFromUrl(im.url); if (p) toRemove.push(p); }
          return { ...b, images: keep };
        });
        if (!bugChanged) return s;
        changed = true;
        return { ...s, bugs };
      });
      if (!changed) return prev;
      if (toRemove.length) { try { supabase.storage.from("attachments").remove(toRemove); } catch { /* best effort */ } }
      const next = { ...prev, testing };
      enqueuePersist(prev, next).catch((e) => setSyncError(e.message || String(e)));
      return next;
    });
  }, [enqueuePersist]);

  useEffect(() => {
    if (isAdmin && !loading && db && !purgedRef.current) { purgedRef.current = true; purgeExpired(); purgeTestImages(); }
  }, [isAdmin, loading, db, purgeExpired, purgeTestImages]);

  // Create an APN partner's profile row on first login from the details they
  // gave at sign-up (assigns their APN-TN id), then refresh so it appears.
  const apnEnsuredRef = useRef(false);
  useEffect(() => {
    if (role === "partner" && session && db && !apnEnsuredRef.current && !apnMe(db, session.user.id)) {
      apnEnsuredRef.current = true;
      ensureApnProfile(session.user, db.apn_users).then((created) => { if (created) reload(); }).catch((e) => setSyncError(e.message || String(e)));
    }
  }, [role, session, db, reload]);

  const replaceDB = useCallback(async (d) => {
    const clean = { ...emptyDB(), ...d };
    try {
      await replaceAll(clean);
      // Re-read the database after the transaction commits. Do not trust the
      // imported client snapshot because audit/normalized tables are intentionally
      // managed by their own server-side paths. The UI must reflect committed data.
      await reload();
      setSyncError(null);
      emitToast("ALLBEE backup restored successfully.", "success");
    } catch (e) {
      setSyncError(e.message || String(e));
      throw e;
    }
  }, [reload]);

  const changeProfile = useCallback(async (id, patch, auditAction) => {
    try {
      await updateProfile(id, patch);
      // Profile updates write straight to Postgres (not through `mutate`), so on
      // their own they never reach the audit log. When the caller supplies a
      // description (role/status/approval changes), record it so the Audit log
      // shows team-management actions too.
      if (auditAction) mutate((d) => d, { action: auditAction, module: "Team" });
      if (session) await loadPeople(session.user);
    }
    catch (e) { setSyncError(e.message || String(e)); }
  }, [session, loadPeople, mutate]);

  // Permanently remove a registered client (a self-signed-up portal account).
  // The edge function owns auth/profile deletion so a failed auth deletion never
  // leaves the UI claiming that the email is reusable.
  const deleteClientAccount = useCallback(async (person) => {
    if (!person || person.role !== "client") return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: person.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    } catch (e) { setSyncError("Couldn't remove the client: " + ((e && e.message) || "unknown error")); return; }
    mutate((d) => d, { action: `deleted client account "${person.name}"`, module: "Clients" });
    emitToast("Client deleted; login access and email reservation were removed.", "success");
    if (session) await loadPeople(session.user);
  }, [session, loadPeople, mutate]);

  // first-login profile completion + T&C acceptance (both write to my own row)
  const saveMyProfile = useCallback((patch) => changeProfile(me.id, patch, "updated own profile"), [changeProfile, me.id]);
  const acceptTnc = useCallback((agreements) => {
    const patch = {};
    let roleAccepts = null;
    for (const a of (agreements || [])) {
      if (a.key === "all") patch.tnc_version = a.version;
      else { roleAccepts = roleAccepts || { ...acceptedRoleTnc(profile) }; roleAccepts[a.key] = a.version; }
    }
    if (roleAccepts) patch.tnc_roles_accepted = roleAccepts;
    return changeProfile(me.id, patch, "accepted terms and conditions");
  }, [changeProfile, me.id, profile]);
  // publish/edit the Terms (admins): bump the version so everyone re-accepts
  const saveTnc = useCallback(async (body) => {
    const next = Number(config?.tnc_version || 0) + 1;
    await saveConfig({ tnc_body: body, tnc_version: next });
    recordActivity({ action: "edited company terms", module: "Settings", entity: "Company settings" });
    if (session) setConfig(await fetchConfig());
  }, [config, session, recordActivity]);
  // publish/edit a ROLE-SPECIFIC agreement; bumps just that role's version
  const saveRoleTnc = useCallback(async (roleKey, body) => {
    const map = roleTncOf(config);
    const cur = map[roleKey] || {};
    map[roleKey] = { body, version: Number(cur.version || 0) + 1 };
    await saveConfig({ tnc_roles: JSON.stringify(map) });
    recordActivity({ action: `edited ${ROLE_LABEL[roleKey] || roleKey} terms`, module: "Settings", entity: "Permissions" });
    if (session) setConfig(await fetchConfig());
  }, [config, session, recordActivity]);
  const saveCompany = useCallback(async (obj) => {
    await saveConfig({ company: JSON.stringify(obj || {}) });
    recordActivity({ action: "edited company settings", module: "Settings", entity: "Company settings" });
    if (session) setConfig(await fetchConfig());
  }, [session, recordActivity]);
  const saveAI = useCallback(async (obj) => {
    await saveConfig({ ai: JSON.stringify(obj || {}) });
    recordActivity({ action: "updated AI settings", module: "AI", entity: "AI settings" });
    if (session) setConfig(await fetchConfig());
  }, [session, recordActivity]);
  const resolveResign = (r, decision) => {
    mutate((d) => ({ ...d, resignations: (d.resignations || []).map((x) => x.id === r.id ? { ...x, status: decision, resolvedAt: Date.now() } : x) }), { action: `${decision === "Approved" ? "approved" : "declined"} ${r.userName}'s resignation request`, module: "Team" });
    if (decision === "Approved") changeProfile(r.userId, { status: "resigned", active: false });
  };

  const signOut = async () => {
    setUserMenu(false);
    try {
      if (me.id) await supabase.from("profiles").update({ last_logout: new Date().toISOString() }).eq("id", me.id);
      if (me.id) await appendAuditEvent({ user: currentUser || "System", userId: me.id, action: "logged out", module: "System", entity: "Authentication", description: `${currentUser || "User"} logged out` });
    } catch { /* profile columns or audit migration may not exist yet */ }
    await supabase.auth.signOut();
  };

  const bal = useMemo(() => (db ? balances(db) : { Haji: 0, Alim: 0, company: 0 }), [db]);

  const openModal = (m) => setModal(m);
  const openBalance = (u) => setBalanceUser(u);
  const setHash = (h) => { if (window.location.hash !== h) window.location.hash = h; };
  const go = (r) => {
    setRoute(r); setAccountUser(null); setTaskDetailId(null); setMenuOpen(false);
    setHash(r === "dashboard" ? "#/" : `#/${r}`);
  };
  const openAccount = (u) => { setAccountUser(u); setTaskDetailId(null); setRoute("accounts"); setMenuOpen(false); setHash(`#/accounts/${String(u).toLowerCase()}`); };
  const openTask = (id) => { setTaskDetailId(id); setAccountUser(null); setRoute("tasks"); setMenuOpen(false); setHash(`#/tasks/${encodeURIComponent(id)}`); };
  const openActivityRelated = (related, activity) => {
    setActivityDetail(null);
    if (related.table === "tasks" && related.record?.id) return openTask(related.record.id);
    if (related.module === "APN" && related.record?.id) { setApnFocusPartnerId(related.record.id); return go("apn"); }
    const route = { Leads: "leads", Clients: "clients", Quotations: "quotations", Invoices: "invoices", Finance: related.table === "withdrawals" ? "withdrawals" : "accounts" }[related.module];
    if (route) go(route);
  };
  const goBackDetail = () => {
    const target = taskDetailId ? "tasks" : "accounts";
    setAccountUser(null); setTaskDetailId(null); setRoute(target);
    setHash(`#/${target}`);
  };

  // keep the URL hash and the in-app view in sync (reload-safe deep links)
  useEffect(() => {
    const apply = () => {
      const p = parseHash(window.location.hash);
      setAccountUser(p.account); setTaskDetailId(p.task);
      if (p.route) setRoute(p.route);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  // Presence heartbeat: mark me active so teammates see an "online" dot.
  useEffect(() => {
    if (!session || !me.id) return;
    const beat = () => { if (typeof document !== "undefined" && document.visibilityState === "hidden") return; supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", me.id).then(() => {}, () => {}); };
    beat();
    const t = setInterval(beat, 60000);
    return () => clearInterval(t);
  }, [session, me.id]);

  // open income form prefilled (used by projects / courses / marketing)
  const openIncome = (prefill) => setModal({ type: prefill?.kind === "expense" ? "expense" : "income", initial: prefill, source: prefill?.source });

  const saveShare = async (entry, source) => {
    const prev = entry.id ? db.transactions.find((t) => t.id === entry.id) : null;
    const shareChanged = prev && (prev.hajiPct !== entry.hajiPct || prev.alimPct !== entry.alimPct);
    const shareNote = shareChanged ? ` · share ${prev.hajiPct}/${prev.alimPct} → ${entry.hajiPct}/${entry.alimPct}` : "";
    // Company expenses are split from the previous valid revenue month — record
    // which month's share was applied so the audit log has a clear trail.
    const companyNote = (entry.kind === "expense" && entry.scope === "company")
      ? ` · company split ${entry.hajiPct}/${entry.alimPct}${entry.shareSource ? ` (from ${fmtPeriod(entry.shareSource)} revenue)` : " — even split, no revenue yet"}`
      : "";
    try {
      // Mode routing for APN-attributed incomes:
      //   edit    — the income already posts to its project (anchors on it,
      //             collections replaced wholesale, expense recomputed).
      //   convert — a normal income gains APN attribution; it keeps its own id.
      //   create  — brand-new posting, possibly attached through the RPC's
      //             canonical partner+name+client resolution.
      // Only a NEW income linked to an ALREADY-EXISTING project takes the local
      // attach path at the bottom; everything else goes through the RPC so the
      // income id is never mistaken for an unwanted duplicate.
      const apnEditing = !!prev?.id && !!prev?.apnProjectId;
      const existingApnProject = entry.apnProjectId && (db.apn_commission_projects || []).find((row) => row.id === entry.apnProjectId);
      if (entry.kind === "income" && entry.incomeSource === "apn" && (apnEditing || !!prev?.id || !existingApnProject)) {
        const pMode = apnEditing ? "edit" : (prev?.id ? "convert" : "create");
        const partner = (db.apn_users || []).find((row) => row.id === entry.apnPartnerId && row.status === "active");
        if (!partner) throw new Error("Select an active APN partner.");
        const collections = (entry.apnCollections || []).map((row) => ({ ...row, projectId: entry.apnProjectId, partnerId: partner.id, receivedAmount: Number(row.receivedAmount) || 0, incentive: Number(row.incentive || 0), receivedDate: row.receivedDate || entry.date, createdBy: row.createdBy || currentUser, createdAt: row.createdAt || Date.now(), commissionStatus: row.commissionStatus || "Pending" }));
        let received = 0; let earned = 0;
        const value = Number(entry.apnProjectValue) || 0;
        const rate = Number(entry.apnCommissionRate) || 0;
        const maximum = round2(value * rate / 100);
        const normalizedCollections = collections.map((row) => {
          if (row.receivedAmount <= 0) throw new Error("Collection amounts must be greater than zero.");
          if (row.incentive < 0) throw new Error("Incentives cannot be negative.");
          received += row.receivedAmount;
          if (received > value) throw new Error("Collections cannot exceed the APN project value.");
          const commissionGenerated = round2(Math.min(Math.max(0, maximum - earned), row.receivedAmount * rate / 100));
          earned += commissionGenerated;
          return { ...row, commissionGenerated };
        });
        const project = { id: entry.apnProjectId, partnerId: partner.id, partnerName: partner.name, projectName: entry.apnProjectName.trim(), clientName: entry.apnClientName.trim(), category: entry.category || "website", projectValue: value, commissionRate: rate, maximumCommission: maximum, totalReceived: round2(received), totalCommissionPaid: 0, remainingAmount: round2(Math.max(0, value - received)), remainingCommission: round2(Math.max(0, maximum - earned)), status: received >= value ? "Completed" : "Processing", remarks: entry.notes || "Finance income receipt", createdBy: currentUser, createdAt: entry.createdAt || Date.now(), updatedAt: Date.now() };
        // Preflight the canonical DB state (create/convert only — an edit anchors
        // on its own project and the RPC itself refuses collisions): the same
        // partner+project+client may already exist under a different id (APN
        // module on another device).
        let canonicalProjectId = null;
        let alreadyPostedIncome = null;
        if (pMode !== "edit") {
          try {
            const { data: state, error: stateError } = await supabase.rpc("get_apn_commission_state", { p_partner_id: partner.id, p_project_name: entry.apnProjectName.trim(), p_client_name: entry.apnClientName.trim() });
            if (!stateError && state?.project?.id) {
              canonicalProjectId = state.project.id;
              alreadyPostedIncome = state.financeIncome || null;
            }
          } catch { /* best effort — the RPC itself guards duplicates */ }
        }
        if (alreadyPostedIncome) {
          await reload().catch(() => {});
          throw new Error(`This project's commission was already posted to finance on ${fmtDate(alreadyPostedIncome.data?.date)} (${money(alreadyPostedIncome.data?.amount)} income). Fresh data was loaded — review it in Share & accounts.`);
        }
        const postProjectId = canonicalProjectId || project.id;
        const { error } = await supabase.rpc("create_apn_income_transaction", { p_transaction: { ...entry, amount: round2(received), apnProjectId: postProjectId, apnCollectionIds: normalizedCollections.map((row) => row.id) }, p_project: { ...project, id: postProjectId }, p_collections: normalizedCollections, p_mode: pMode });
        if (error) {
          if (/already exists/i.test(error.message)) await reload().catch(() => {});
          throw new Error(`${error.message}${/already exists/i.test(error.message) ? " Fresh data was loaded — check the APN project and Share & accounts." : ""}`);
        }
        await reload();
        emitToast(pMode === "edit" ? "APN commission income updated — collections and matching commission expense recalculated." : canonicalProjectId ? "Income recorded and attached to the existing APN commission project." : "Income recorded and APN commission project created with matching commission expense.", "success");
        return true;
      }
      let savedEntry = entry;
      // NEW income against an already-registered APN project (converts and edits
      // route through the RPC above): post atomically via mode 'create' so the
      // commission expense is recorded exactly once.
      if (entry.kind === "income" && entry.apnProjectId && !prev?.id) {
        const sourceProject = (db.apn_commission_projects || []).find((p) => p.id === entry.apnProjectId);
        if (!sourceProject) throw new Error("The selected APN commission project is no longer available.");
        const alreadyPosted = (db.transactions || []).find((t) => t.kind === "income" && t.apnProjectId === sourceProject.id);
        if (alreadyPosted) throw new Error(`This project's income was already posted to finance on ${fmtDate(alreadyPosted.date)} (${money(alreadyPosted.amount)}). Edit that entry instead.`);
        const existing = (db.apn_revenue_collections || []).filter((row) => row.projectId === sourceProject.id).map((row) => ({ ...row }));
        const collection = { id: uid(), projectId: sourceProject.id, partnerId: sourceProject.partnerId, receivedAmount: Number(entry.amount) || 0, incentive: 0, remarks: entry.notes || "Finance income receipt", receivedDate: entry.date, commissionStatus: "Pending", createdBy: currentUser, createdAt: entry.createdAt || Date.now() };
        const linkedCollections = [...existing, collection].sort((a, b) => String(a.receivedDate || a.createdAt).localeCompare(String(b.receivedDate || b.createdAt)));
        let received = 0; let earned = 0;
        const normalized = linkedCollections.map((row) => {
          const amount = Number(row.receivedAmount) || 0;
          if (amount <= 0) throw new Error("APN collection amounts must be greater than zero.");
          received += amount;
          const commission = round2(Math.min(Math.max(0, (Number(sourceProject.maximumCommission) || (Number(sourceProject.projectValue) * Number(sourceProject.commissionRate) / 100)) - earned), amount * (Number(sourceProject.commissionRate) || 0) / 100));
          earned += commission;
          return { ...row, receivedAmount: amount, commissionGenerated: commission };
        });
        if (received > Number(sourceProject.projectValue)) throw new Error("This income exceeds the APN project's remaining value.");
        const value = Number(sourceProject.projectValue) || 0;
        const max = round2(value * (Number(sourceProject.commissionRate) || 0) / 100);
        const linkedProject = { ...sourceProject, maximumCommission: max, totalReceived: round2(received), remainingAmount: round2(Math.max(0, value - received)), remainingCommission: round2(Math.max(0, max - earned)), status: apnProjectStatus(sourceProject, received), updatedAt: Date.now() };
        const { error } = await supabase.rpc("create_apn_income_transaction", { p_transaction: { ...entry, amount: Number(collection.receivedAmount) || 0, apnProjectId: sourceProject.id, apnCollectionIds: [collection.id], apnCollectionId: collection.id }, p_project: linkedProject, p_collections: normalized, p_mode: "create" });
        if (error) {
          if (/already exists/i.test(error.message)) await reload().catch(() => {});
          throw new Error(`${error.message}${/already exists/i.test(error.message) ? " Fresh data was loaded — check the APN project and Share & accounts." : ""}`);
        }
        await reload();
        emitToast("Income recorded and APN commission updated with matching commission expense.", "success");
        return true;
      }
      mutate((d) => {
        let next = { ...d };
        if (savedEntry.id && next.transactions.some((t) => t.id === savedEntry.id)) next.transactions = next.transactions.map((t) => t.id === savedEntry.id ? savedEntry : t);
        else next.transactions = [...next.transactions, savedEntry];
        if (source?.kind === "student") next.students = next.students.map((s) => s.id === source.id ? { ...s, paymentStatus: "Paid" } : s);
        if (source?.kind === "marketing") next.marketing = next.marketing.map((m) => m.id === source.id ? { ...m, lastPaid: savedEntry.date } : m);
        return next;
      }, { action: `${savedEntry.id ? "updated" : "added"} ${savedEntry.kind} ${money(savedEntry.amount)}${savedEntry.client ? " · " + savedEntry.client : ""}${shareNote}${companyNote}`, module: "Accounts" });
      emitToast("Income saved.", "success");
      return true;
    } catch (error) {
      emitToast(error?.message || "Couldn't save this entry.", "error");
      return false;
    }
  };

  const saveTask = async (task, fromConcept) => {
    const isUpdate = task.id && db.tasks.some((t) => t.id === task.id);
    let t = task;
    if (!isUpdate && t.num == null) {
      const n = await nextTaskNumber();        // global counter — numbers are never reused
      if (n != null) t = { ...t, num: n };
    }
    mutate((d) => {
      let next = { ...d };
      if (isUpdate) next.tasks = d.tasks.map((x) => x.id === t.id ? t : x);
      else next.tasks = [...d.tasks, t];
      if (fromConcept) next.concepts = d.concepts.filter((c) => c.id !== fromConcept);
      return next;
    }, { action: `${isUpdate ? "updated" : "created"} task "${t.title}"${!isUpdate && t.num ? ` (#${t.num})` : ""}`, module: "Tasks" });
  };

  const saveGeneric = (coll, item, label) => {
    let toSave = item;
    // staff-created projects need an admin's approval before they count as active
    if (coll === "projects" && !db.projects.some((x) => x.id === item.id)) {
      toSave = { ...item, approvalStatus: isAdmin ? "approved" : "pending", createdById: me.id, ownerName: currentUser };
    }
    // stamp the registrar on new students so commission credits the right person
    if (coll === "students" && !db.students.some((x) => x.id === item.id)) {
      toSave = { ...item, createdById: me.id, ownerName: currentUser };
    }
    mutate((d) => ({ ...d, [coll]: d[coll].some((x) => x.id === toSave.id) ? d[coll].map((x) => x.id === toSave.id ? toSave : x) : [...d[coll], toSave] }),
      { action: `${db[coll].some((x) => x.id === item.id) ? "updated" : "added"} ${label}${coll === "projects" && !isAdmin && !db.projects.some((x) => x.id === item.id) ? " (awaiting approval)" : ""}`, module: label === "project" ? "Projects" : label === "student" ? "Courses" : label === "marketing client" ? "Marketing" : "Concepts" });
  };

  // Class students (training institute) — admin/superadmin only. Saves to the
  // app DB and, if a Google Sheet webhook is set, mirrors the row into that sheet.
  const pushClassStudentToSheet = (student, action) => {
    const url = classWebhookOf(config);
    if (!url) return;
    // Best-effort: the app database is the source of truth, so a sheet/network
    // failure must never block the save. no-cors avoids an Apps Script CORS preflight.
    try {
      fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, student }) }).catch(() => {});
    } catch { /* ignore — mirror only */ }
  };
  const saveClassStudent = (s) => {
    const isUpdate = (db.class_students || []).some((x) => x.id === s.id);
    const row = isUpdate ? s : { ...s, createdById: me.id, ownerName: currentUser };
    mutate((d) => ({ ...d, class_students: isUpdate ? (d.class_students || []).map((x) => x.id === s.id ? row : x) : [...(d.class_students || []), row] }),
      { action: `${isUpdate ? "updated" : "added"} class student "${s.name}"`, module: "Class students" });
    pushClassStudentToSheet(row, isUpdate ? "update" : "add");
  };
  const saveClassWebhook = async (url) => {
    await saveConfig({ class_sheet_webhook: (url || "").trim() });
    recordActivity({ action: "updated class student sheet integration", module: "Settings", entity: "Settings" });
    if (session) setConfig(await fetchConfig());
  };

  // CRM / collaboration / finance rows: stamp the owner + author on first save.
  const saveOwned = (coll, item) => {
    const isUpdate = db[coll].some((x) => x.id === item.id);
    const row = isUpdate ? item : { ...item, ownerId: me.id, owner: currentUser, by: currentUser };
    mutate((d) => ({ ...d, [coll]: isUpdate ? d[coll].map((x) => x.id === item.id ? row : x) : [...d[coll], row] }),
      { action: `${isUpdate ? "updated" : "added"} ${MODULE_LABEL[coll] || coll}`, module: MODULE_LABEL[coll] || coll });
    setModal(null);
  };

  // Create / update a team (super admin). Stored in the `teams` table.
  const saveTeamCfg = (t) => {
    const isUpdate = (db.teams || []).some((x) => x.id === t.id);
    mutate((d) => ({ ...d, teams: isUpdate ? d.teams.map((x) => x.id === t.id ? t : x) : [...(d.teams || []), t] }),
      { action: `${isUpdate ? "updated" : "created"} team "${t.name}"`, module: "Team leads" });
    setModal(null);
  };

  // Create / update a test session. Stamps the creator on first save and logs a
  // clear "created / assigned" line for the audit trail.
  const saveTesting = (t) => {
    const isUpdate = (db.testing || []).some((x) => x.id === t.id);
    const prev = isUpdate ? db.testing.find((x) => x.id === t.id) : null;
    const row = isUpdate ? t : { ...t, createdBy: currentUser, createdById: me.id };
    const assignNote = t.assignedTo && (!prev || prev.assignedToId !== t.assignedToId) ? ` · assigned to ${t.assignedTo}` : "";
    mutate((d) => ({ ...d, testing: isUpdate ? d.testing.map((x) => x.id === t.id ? row : x) : [...(d.testing || []), row] }),
      { action: `${isUpdate ? "updated" : "created"} test session "${t.title}"${t.projectName ? ` for ${t.projectName}` : ""}${assignNote}`, module: "Testing" });
    setModal(null);
  };

  // Loading is kept outside App so parent state updates do not remount the
  // loading surface. Remounting here used to restart Did You Know and made the
  // fact appear to refresh rapidly while auth/data state was settling.

  // Wraps every remote surface in the founder lockdown gate when live (allows
  // tests to force the paused UI with zero network via LOCKDOWN_PAUSE_TEST).
  const gateChild = (node) => (FOUNDER_LOCKDOWN_LIVE
    ? <RemoteLockGate isDark={isDark} signOut={signOut} pause={LOCKDOWN_PAUSE_TEST}>{node}</RemoteLockGate>
    : node);

  if (publicProposalToken) return gateChild(<ProposalPortal token={publicProposalToken} isDark={isDark} />);
  if (session === undefined) return <LoadingScreen isDark={isDark} />;
  if (!session) return gateChild(<React.Suspense fallback={<LoadingScreen isDark={isDark} />}><LazyLock isDark={isDark} setDark={setIsDark} runtime={{ supabase, useUsernameAvailability, useEmailAvailability, emitToast, FounderTap, ToastHost, SearchableSelect, PasswordField, LoginAccessAssistant, LOGO_FULL, TN_DISTRICTS, USERS, avatarColor, Users, Building2, GaugeCircle, ArrowLeft, AlertTriangle, Check, RefreshCw, LogIn, Mail, Sun, Moon }} /></React.Suspense>);
  if (passwordRecovery) return gateChild(<PasswordRecovery isDark={isDark} onComplete={() => { setPasswordRecovery(false); try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ } }} />);
  if (profile === undefined) return <LoadingScreen isDark={isDark} note="Signing you in…" />;
  if (profile && profile.active === false && role !== "partner")
    return gateChild(<Blocked isDark={isDark} name={currentUser} onSignOut={signOut} />);
  // new staff & client sign-ups wait for a partner to approve them
  if (profile && (role === "staff" || role === "client") && profile.approved === false)
    return gateChild(<ApprovalPending isDark={isDark} name={currentUser} onSignOut={signOut} />);
  // portal clients get their own surface and skip the internal profile/T&C gates
  if (role === "client") {
    if (loading || !db) return <LoadingScreen isDark={isDark} note="Loading your portal…" />;
    return gateChild(<React.Suspense fallback={<LoadingScreen isDark={isDark} note="Loading client portal…" />}><LazyClientPortal db={db} profile={profile} signOut={signOut} isDark={isDark} config={config} reload={reload} runtime={{ companyOf, supabase, emitToast, ToastHost, GlobalPullToRefresh, FounderTap, PortalRefreshButton, Avatar, LogOut, Home, Headset, Link2, Download, ExternalLink, Mail, MessageCircle, PortalHelpdesk, fmtDate, fmtDateTime, money, LOGO_ICON }} /></React.Suspense>);
  }
  // APN partners get their own mobile-first portal — fully separate from the
  // internal app, so they never reach accounts, balances, the vault or the team.
  if (role === "partner") {
    if (loading || !db) return <LoadingScreen isDark={isDark} note="Loading APN…" />;
    return gateChild(<APNPortal db={db} profile={profile} session={session} signOut={signOut} isDark={isDark} mutate={mutate} patchDb={patchDb} reload={reload} />);
  }
  // first login: require the core profile details before anything else
  if (profile && (!profile.mobile || !profile.dob))
    return gateChild(<ProfileSetup profile={profile} onSave={saveMyProfile} onSignOut={signOut} isDark={isDark} />);
  // then the Terms gate — show every agreement (general + role-specific) this
  // user still needs to accept; they accept all before gaining access
  const tncPending = pendingTnc(config, profile, role);
  if (profile && tncPending.length)
    return gateChild(<TermsGate agreements={tncPending} onAccept={acceptTnc} onSignOut={signOut} isDark={isDark} />);
  if (loading || !db) return <LoadingScreen isDark={isDark} note="Preparing your workspace…" />;

  const teamNames = team.length ? team.filter((p) => p.role !== "client" && p.role !== "partner" && p.role !== "district_head" && p.active !== false).map((p) => p.name) : USERS;
  const myTeam = teamOfUser(db?.teams, me.id);
  const visibleNav = NAV.filter((n) => navAllowed(n[3], role, profile?.perms || {}))
    .filter((n) => n[0] !== "myteam" || !!myTeam);
  const allowedRoutes = new Set(visibleNav.map((n) => n[0]));
  const safeRoute = allowedRoutes.has(route) ? route : "dashboard";
  const detailTask = taskDetailId ? db.tasks.find((t) => t.id === taskDetailId) : null;
  const routeTitle =
    accountUser && canFinance ? `${accountUser} — account` :
    taskDetailId ? (detailTask ? detailTask.title : "Task") :
    NAV.find((n) => n[0] === safeRoute)?.[1] || "";
  const myPending = db.tasks.filter((t) => t.status !== "Completed" && (isAdmin || isTaskAssignee(t, me))).length;
  const unreadNotifs = db.notifications.filter((n) => notifVisibleTo(n, profile) && !(n.reads || []).includes(me.id)).length;
  const unreadChat = db.chat.filter((m) => m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id)).length;
  const portalClients = team.filter((p) => p.role === "client");
  const financeApnProjects = (db.apn_commission_projects || []).map((project) => apnProjectSummary(db, project)).filter((project) => project.status !== "Cancelled");
  const unseenAnn = db.announcements.filter((a) => !profile?.notif_seen_at || (a.createdAt || 0) > new Date(profile.notif_seen_at).getTime()).length;
  const financeApnPartners = (db.apn_users || []).filter((partner) => partner.status === "active");
  const actionCounts = (() => {
    const pending = (value) => ["pending", "Pending", "under_review", "processing", "Pending approval"].includes(value);
    const apnActions = apnAdminActionCounts(db, profile?.id);
    const apnApprovals = apnActions.partners;
    const apnWithdrawals = apnActions.withdrawals;
    const apnCommissionApprovals = apnActions.commissions;
    const apnTraining = apnActions.training;
    const apnMaterials = apnActions.materials;
    const crmQuotations = (db.crm_quotations || []).filter((row) => pending(row.approval_status || row.status)).length + (db.quotations || []).filter((row) => pending(row.approvalStatus || row.status)).length;
    const crmFollowUps = (db.crm_follow_ups || []).filter((row) => pending(row.status)).length;
    const financeSettlements = (db.apn_withdrawal_batches || []).filter((row) => pending(row.status)).length + apnWithdrawals;
    const taskApprovals = (db.tasks || []).filter((row) => pending(row.approvalStatus || row.status)).length;
    const leave = (db.leave || []).filter((row) => row.status === "Pending").length;
    const clientOnboarding = (team || []).filter((row) => row.role === "client" && row.approved === false).length + (db.clients || []).filter((row) => pending(row.status || row.onboardingStatus)).length;
    const attendance = (db.attendance || []).filter((row) => pending(row.approvalStatus || row.status)).length;
    return { apn: apnActions.total, apnApprovals, apnWithdrawals, apnCommissionApprovals, apnTraining, apnMaterials, crm: crmQuotations + crmFollowUps, crmQuotations, crmFollowUps, finance: financeSettlements, tasks: myPending + taskApprovals, leave, clients: clientOnboarding, attendance, notifications: unreadNotifs };
  })();

  const renderPage = () => {
    // full-page detail views take precedence over the tab routes
    if (taskDetailId) return <TaskDetail db={db} taskId={taskDetailId} me={me} isAdmin={isAdmin} currentUser={currentUser} mutate={mutate} openModal={openModal} removeItem={removeItem} goBack={goBackDetail} />;
    if (accountUser && canFinance) return <AccountFull db={db} user={accountUser} goBack={goBackDetail} />;

    switch (safeRoute) {
      case "dashboard":
        return (role === "staff" || role === "intern")
          ? <StaffDashboard db={db} me={me} go={go} mutate={mutate} openModal={openModal} team={team} />
          : <Dashboard db={db} bal={bal} go={go} openBalance={openBalance} onOpenActivity={setActivityDetail} showMoney={canFinance} showOps={isAdmin} team={team} isSuper={isSuper} />;
      case "tasks": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading tasks…</div></div>}><LazyTasks db={db} mutate={mutate} openModal={openModal} isAdmin={isAdmin} currentUser={currentUser} me={me} openTask={openTask} removeItem={removeItem} runtime={{ Empty, Progress, assigneeText, avatarColor, canActOnTask, canEditTask, fmtDate, haptic, isMultiAssignee, isTaskAssignee, nextTaskState, priorityTone, taskAction, taskAssignees }} /></React.Suspense>;
      case "assistant": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true"><div className="skeleton skeleton-line" style={{ width: "34%" }} /><div className="skeleton" style={{ height: 180, marginTop: 12 }} /></div></div>}><AllbeeAI db={db} config={config} me={me} role={role} isAdmin={isAdmin} go={go} /></React.Suspense>;
      case "ai-center": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading AI Intelligence…</div></div>}><LazyAIIntelligenceCenter db={db} go={go} openModal={openModal} reload={reload} runtime={{ Empty, Field, money, fmtDate, Search, TrendingUp, Users, Target, Activity, FileText, RefreshCw, Check, AlertTriangle, ArrowRight, emitToast, exportRowsToExcel, todayISO, supabase }} /></React.Suspense>;
      case "knowledge-engine": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading Pricing &amp; Knowledge Center…</div></div>}><LazyPricingKnowledgeCenter isAdmin={isAdmin} runtime={{ Field, Empty, Modal, money, todayISO, exportRowsToExcel, emitToast }} /></React.Suspense>;
      case "requirement-builder": return <RequirementBuilder isAdmin={isAdmin} />;
      case "proposal-center": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading Proposal Center…</div></div>}><LazyProposalCenter isAdmin={isAdmin} runtime={{ supabase, emitToast, money, Empty, Modal, Search, RefreshCw, AlertTriangle, FileText, ShieldAlert, Eye, Pencil, Activity, Download, Copy, Send, Check }} /></React.Suspense>;
      case "attendance": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading attendance…</div></div>}><LazyAttendance db={db} mutate={mutate} me={me} isAdmin={isAdmin} isSuper={isSuper} team={team} openModal={openModal} runtime={{ Empty, Team, attStatus, attendanceFor, avatarColor, clockTime, fmtDate, haptic, hoursBetween, onApprovedLeave, sameMonth, startOfWeek, sumHours, todayISO, uid, LazyAttendanceEditModal }} /></React.Suspense>;
      case "leave": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading leave…</div></div>}><LazyLeave db={db} team={team} mutate={mutate} me={me} isAdmin={isAdmin} openModal={openModal} runtime={{ Empty, avatarColor, fmtDate, haptic, leaveTone, ContactButtons }} /></React.Suspense>;
      case "updates": return <Updates db={db} mutate={mutate} me={me} isAdmin={isAdmin} removeItem={removeItem} openModal={openModal} />;
      case "team": return <Team team={team} me={me} changeProfile={changeProfile} db={db} resolveResign={resolveResign} onActivity={recordActivity} onOpenAPN={() => go("apn")} />;
      case "team-leads": return <TeamLeads team={team} db={db} openModal={openModal} removeItem={removeItem} me={me} />;
      case "apn": return (
        <React.Suspense fallback={<div className="allbee-loading-card">Loading APN Admin…</div>}>
          <LazyAPNAdmin db={db} people={team} mutate={mutate} isSuper={isSuper} isAdmin={isAdmin} currentUser={currentUser} currentUserId={profile?.id || session?.user?.id} currentUserAvatar={profile?.photo_url} currentUserDesignation={profile?.designation} refreshPeople={session ? () => loadPeople(session.user) : undefined} focusPartnerId={apnFocusPartnerId} onFocusConsumed={() => setApnFocusPartnerId(null)} onOpenRelated={openActivityRelated} onRefresh={reload} onCommissionDeleted={handleCommissionDeleted} onActionBadgeSeen={markApnActionBadgeSeen}
            runtime={{ supabase, todayISO, money, fmtDate, fmtDateTime, uid, round2, APN_SERVICES, SearchableSelect, apnRevenueCollectionsOf, apnPartnerStats, apnRateForPrior, apnProjectStatus, apnFinancePostedFor, apnIdFor, Coins, GaugeCircle, FileCheck2, emitToast, Confirm, Modal, Field, SelectOther, Empty, Avatar, APNAdminActivityLog, APNAdminHub, APNAdminPartners, APNAdminLeads, APNAdminReferrals, APNAdminSupport, Search, Plus, Trash2, Pencil, Save, Check, X, ChevronRight, ChevronDown, ArrowRight, Download, FileText, Activity, Filter, Send, Eye, MoreVertical }} />
        </React.Suspense>
      );
      case "activity": return <LastSeen team={team} />;
      case "myteam": return <MyTeam db={db} team={team} me={me} mutate={mutate} onRefresh={reload} />;
      case "staff-salary": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading staff salary…</div></div>}><LazyStaffSalary db={db} team={team} mutate={mutate} me={me} runtime={{ money, fmtDate, Modal, Field, Empty, Avatar, emitToast, ROLE_LABEL }} /></React.Suspense>;
      case "accounts": return <Accounts db={db} bal={bal} mutate={mutate} openModal={openModal} openBalance={openBalance} removeItem={removeItem} locks={locks} lockPeriod={lockPeriod} unlockPeriod={unlockPeriod} isSuper={isSuper} currentUser={currentUser} />;
      case "withdrawals": return <Withdrawals db={db} bal={bal} mutate={mutate} openModal={openModal} removeItem={removeItem} isSuper={isSuper} currentUser={currentUser} />;
      case "progress": return <Progress db={db} mutate={mutate} isAdmin={isAdmin} currentUser={currentUser} me={me} openTask={openTask} />;
      case "concepts": return <Concepts db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} />;
      case "courses": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading courses…</div></div>}> <LazyCourses db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} runtime={{ Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts }} />;</React.Suspense>;
      case "class-students": return <ClassStudents db={db} openModal={openModal} removeItem={removeItem} mutate={mutate} currentUser={currentUser} config={config} saveClassWebhook={saveClassWebhook} isSuper={isSuper} />;
      case "marketing": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading marketing…</div></div>}> <LazyMarketing db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} runtime={{ Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts }} />;</React.Suspense>;
      case "projects": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading projects…</div></div>}> <LazyProjects db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} isAdmin={isAdmin} me={me} runtime={{ Empty, money, fmtDate, todayISO, avatarColor, marketingDue, PROJECT_STAGES, Accounts }} />;</React.Suspense>;
      case "inhouse": return <InHouse db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} team={team} />;
      case "testing": return <Testing db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} currentUser={currentUser} team={team} />;
      case "leads": return (
        <React.Suspense fallback={<div className="allbee-loading-card">Loading CRM…</div>}>
          <LazyEnterpriseCRM db={db} team={team} me={me} isAdmin={isAdmin} reload={reload}
            runtime={{ todayISO, round2, money, fmtDate, fmtDateTime, uid, emitToast, Confirm, Modal, Field, SelectOther, Empty, Avatar }} />
        </React.Suspense>
      );
      case "clients": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading clients…</div></div>}><LazyClients db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} portalClients={portalClients} deleteClientAccount={deleteClientAccount} runtime={{ Empty, LoadMore, avatarColor, fmtDate }} /></React.Suspense>;
      case "quotations": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading quotations…</div></div>}> <LazyQuotations db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} me={me} currentUser={currentUser} isAdmin={isAdmin} runtime={{ Empty, money, uid, QUOTE_STATUS, VaultCategories, VAULT_CATEGORIES, fmtDate, avatarColor }} />;</React.Suspense>;
      case "invoices": return <Invoices db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} portalClients={portalClients} />;
      case "portal-posts": return <PortalPosts db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} portalClients={portalClients} />;
      case "support": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading support…</div></div>}> <LazyAPNHelpdesk db={db} me={me} team={team} isAdmin={isAdmin} onRefresh={reload} runtime={{ Avatar, Empty, HELP_STATUS_LABEL, HELP_STATUS_TONE, Invoices, Notifications, emitToast, fmtDateTime }} />;</React.Suspense>;
      case "planned": return <Planned db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} openIncome={openIncome} canFinance={canFinance} />;
      case "vault": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading vault…</div></div>}> <LazyVault db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} runtime={{ Empty, money, uid, QUOTE_STATUS, VaultCategories, VAULT_CATEGORIES, fmtDate, avatarColor }} />;</React.Suspense>;
      case "notifications": return <Notifications db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} profile={profile} team={team} />;
      case "announcements": return <Announcements db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} />;
      case "documents": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading documents…</div></div>}> <LazyDocuments db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} runtime={{ Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks }} />;</React.Suspense>;
      case "knowledge": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading knowledge…</div></div>}> <LazyKnowledge db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} runtime={{ Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks }} />;</React.Suspense>;
      case "prompts": return <Prompts db={db} openModal={openModal} removeItem={removeItem} />;
      case "sheets": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading sheets…</div></div>}> <LazySheets db={db} openModal={openModal} removeItem={removeItem} runtime={{ Empty, Field, emitToast, fmtDate, avatarColor, DOC_CATEGORIES, KB_CATEGORIES, Notifications, Tasks }} />;</React.Suspense>;
      case "terms": return <TermsPage config={config} profile={profile} role={role} isAdmin={isAdmin} go={go} />;
      case "profile": return <MyProfile profile={profile} role={role} saveMyProfile={saveMyProfile} sessionEmail={session?.user?.email} />;
      case "chat": return <Chat db={db} mutate={mutate} me={me} team={team} onRefresh={reload} isAdmin={isAdmin} />;
      case "performance": return <Performance db={db} team={team} />;
      case "rewards": return <Rewards db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} me={me} isAdmin={isAdmin} team={team} />;
      case "earnings": return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading earnings…</div></div>}><LazyMyEarnings db={db} me={me} role={role} payroll={db.payroll} profile={profile} go={go} runtime={{ money, fmtDate, Empty }} /></React.Suspense>;
      case "recently-deleted": return <RecentlyDeleted db={db} openModal={openModal} restoreItem={restoreItem} />;
      case "audit": return <AuditLog db={db} isSuper={isSuper} onOpenActivity={setActivityDetail} />;
      case "settings": return <Settings db={db} mutate={mutate} replaceDB={replaceDB} syncError={syncError} currentUser={currentUser} role={role} teamCount={team.length} sessionEmail={session?.user?.email} config={config} saveTnc={saveTnc} saveRoleTnc={saveRoleTnc} saveCompany={saveCompany} saveAI={saveAI} />;
      default: return null;
    }
  };

  // Sidebar: favorites pinned on top + drag-to-reorder, persisted locally.
  const persistNav = (o) => { try { localStorage.setItem("allbee_navorder", JSON.stringify(o)); } catch { /* ignore */ } };
  const persistFavs = (o) => { try { localStorage.setItem("allbee_favs", JSON.stringify(o)); } catch { /* ignore */ } };
  const toggleFav = (k) => setFavorites((prev) => { const nx = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]; persistFavs(nx); return nx; });
  const cycleSort = () => setNavSort((s) => { const order = ["category", "az", "custom"]; const nx = order[(order.indexOf(s) + 1) % order.length]; try { localStorage.setItem("allbee_navsort", nx); } catch { /* ignore */ } return nx; });
  const moveNav = (dragK, dropK) => {
    if (dragK === dropK) return;
    setNavOrder((prev) => {
      const base = (prev && prev.length) ? prev.slice() : NAV.map((n) => n[0]);
      if (!base.includes(dragK)) base.push(dragK);
      if (!base.includes(dropK)) base.push(dropK);
      base.splice(base.indexOf(dragK), 1);
      base.splice(base.indexOf(dropK), 0, dragK);
      persistNav(base);
      return base;
    });
  };
  const favSet = new Set(favorites);
  const navRank = (k) => { const i = (navOrder || []).indexOf(k); return i === -1 ? 1000 + NAV.findIndex((n) => n[0] === k) : i; };
  const sortedNav = visibleNav.slice().sort((a, b) => navRank(a[0]) - navRank(b[0]));
  const favNav = sortedNav.filter((n) => favSet.has(n[0]));
  const restNav = sortedNav.filter((n) => !favSet.has(n[0]));
  const navBadge = (key) => (
    <>
      {key === "tasks" && <ActionBadge count={actionCounts.tasks} label="task action" />}
      {key === "leave" && <ActionBadge count={actionCounts.leave} label="leave action" />}
      {key === "notifications" && <ActionBadge count={actionCounts.notifications} label="notification" />}
      {key === "chat" && <ActionBadge count={unreadChat} label="unread chat" />}
      {key === "apn" && <ActionBadge count={actionCounts.apn} label="APN action" />}
      {(key === "leads" || key === "quotations") && <ActionBadge count={actionCounts.crm} label="CRM action" />}
      {key === "accounts" && <ActionBadge count={actionCounts.finance} label="finance action" />}
      {key === "clients" && <ActionBadge count={actionCounts.clients} label="client action" />}
      {key === "attendance" && <ActionBadge count={actionCounts.attendance} label="attendance action" />}
      {key === "activity" && isSuper && inactiveCount > 0 && <span className="badge neg">{inactiveCount}</span>}
    </>
  );
  const renderNav = ([key, label, Icon], drag = false) => (
    <div key={key} draggable={drag}
      onDragStart={drag ? (e) => { dragNavRef.current = key; try { e.dataTransfer.effectAllowed = "move"; } catch { /* ignore */ } } : undefined}
      onDragOver={drag ? (e) => e.preventDefault() : undefined}
      onDrop={drag ? (e) => { e.preventDefault(); if (dragNavRef.current) moveNav(dragNavRef.current, key); dragNavRef.current = null; } : undefined}
      className={"navitem" + (safeRoute === key ? " active" : "")} onClick={() => go(key)} title={drag ? "Drag to reorder" : undefined}>
      <Icon size={18} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {navBadge(key)}
      <button onClick={(e) => { e.stopPropagation(); toggleFav(key); }} title={favSet.has(key) ? "Unpin from favorites" : "Pin to favorites"} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 2, opacity: favSet.has(key) ? 0.95 : 0.3, flex: "none", display: "flex" }}><Star size={13} fill={favSet.has(key) ? "currentColor" : "none"} /></button>
    </div>
  );

  return gateChild(
  <ErrorBoundary>
      <div className={"allbee" + (menuOpen ? " menu-open" : "")} data-theme={isDark ? "dark" : "light"}>
        <ToastHost />

        {syncError && (
          <div className="banner"><CloudOff size={15} /> Couldn't sync with the server: {syncError}</div>
        )}

        <div className="layout">
          {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />}
          <aside className="sidebar">
            <div className="brand" role="button" tabIndex={0} aria-label="Go to Home Dashboard" title="Go to Home Dashboard" onClick={() => go("dashboard")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("dashboard"); } }}>
              <FounderTap className="brand-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 34 }} />
              <div><h1>ALLBEE</h1><p>Solutions</p></div>
            </div>
            {favNav.length > 0 && <div className="nav-sec">Favorites</div>}
            {favNav.map((n) => renderNav(n, navSort === "custom"))}
            <div className="nav-sec-row">
              <span className="nav-sec">{favNav.length > 0 ? "All modules" : "Modules"}</span>
              <button className="nav-sort" onClick={cycleSort} title="Change how modules are ordered: Grouped, A–Z, or your Custom order (drag to reorder in Custom)"><ArrowDownUp size={11} />{NAV_SORT_LABEL[navSort]}</button>
            </div>
            {navSort === "category"
              ? NAV_CATEGORIES.map(([ck, clabel]) => {
                const items = restNav.filter((n) => navCategoryOf(n[0]) === ck);
                if (!items.length) return null;
                return <React.Fragment key={ck}><div className="nav-cat">{clabel}</div>{items.map((n) => renderNav(n, false))}</React.Fragment>;
              })
              : (navSort === "az" ? restNav.slice().sort((a, b) => a[1].localeCompare(b[1])) : restNav).map((n) => renderNav(n, navSort === "custom"))}
            <div className="sidebar-foot">
              <div className="navitem" onClick={() => { const nd = !isDark; setIsDark(nd); try { localStorage.setItem("allbee_theme", nd ? "dark" : "light"); } catch { /* ignore */ } }}>{isDark ? <Sun size={18} /> : <Moon size={18} />} {isDark ? "Light mode" : "Dark mode"}</div>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              <button className="iconbtn hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"><Menu size={18} /></button>
              <div className="topbar-title"><h2>{routeTitle}</h2><div className="topbar-sub">ALLBEE Solutions · internal</div></div>
              {canFinance && (
                <div className="company-pill" role="button" tabIndex={0} aria-label="Open Share & accounts" title="Open Share & accounts"
                  onClick={() => go("accounts")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("accounts"); } }}>
                  <Wallet size={14} color="var(--muted)" />
                  <span className="lbl">Balance</span>
                  <span className="val mono" style={{ color: bal.company < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.company)}</span>
                </div>
              )}
              <div className="usermenu">
                <button className="search-trigger" onClick={() => setSearchOpen(true)} title="Search (Ctrl K)">
                  <Search size={16} /><span className="st-lbl" style={{ flex: 1, textAlign: "left" }}>Search…</span><span className="st-kbd">Ctrl K</span>
                </button>
                <button className="iconbtn topbar-refresh" title="Refresh" disabled={topBusy}
                  onClick={async () => { setTopBusy(true); try { await reload(); if (session) await loadPeople(session.user); } finally { setTimeout(() => setTopBusy(false), 400); } }}>
                  <RefreshCw size={18} className={topBusy ? "spin" : ""} />
                </button>
                <button className="iconbtn" title="Announcements" style={{ position: "relative" }}
                  onClick={() => { go("announcements"); if (me.id) changeProfile(me.id, { notif_seen_at: new Date().toISOString() }); }}>
                  <Bell size={18} />
                  {unseenAnn > 0 && <span className="badge pri" style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, lineHeight: "16px" }}>{unseenAnn}</span>}
                </button>
                <div className="userchip" onClick={() => setUserMenu((v) => !v)}>
                  <Avatar name={currentUser} url={profile?.photo_url} size={26} />
                  <span className="userchip-name">{currentUser}</span>
                  <span className={"role-badge " + (role || "staff")}>{ROLE_LABEL[role] || "Staff"}</span>
                </div>
                {userMenu && (
                  <div className="dropdown" onMouseLeave={() => setUserMenu(false)}>
                    <div className="drop-id">
                      <Avatar name={currentUser} url={profile?.photo_url} size={22} fontSize={10} />
                      <div><div style={{ fontWeight: 700, fontSize: 13 }}>{currentUser}</div><div className="hint-line" style={{ fontSize: 11 }}>{session?.user?.email}</div></div>
                    </div>
                    {role !== "superadmin" && <button onClick={() => { setUserMenu(false); openModal({ type: "resign" }); }}><XCircle size={15} />Request resignation</button>}
                    <button onClick={signOut}><LogOut size={15} />Sign out</button>
                  </div>
                )}
              </div>
            </header>
            <div className="page-enter" key={safeRoute + "|" + (taskDetailId || "") + "|" + (accountUser || "")}>
              {renderPage()}
            </div>
          </div>
        </div>

        {/* global pull-to-refresh for the internal app — one mechanism for
            every admin/staff/intern route, driving the same shared reload
            (and team people fetch) the toolbar Refresh button uses */}
        <GlobalPullToRefresh enabled={!modal}
          onRefresh={async () => { await reload(); if (session) try { await loadPeople(session.user); } catch { /* ignore */ } }} />

        {/* MODALS */}
        {modal?.type === "income" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading income form…</div>}><LazyShareForm kind="income" initial={modal.initial} currentUser={currentUser} db={db} apnProjects={financeApnProjects} apnPartners={financeApnPartners} onSave={(e) => saveShare(e, modal.source)} onClose={() => setModal(null)} runtime={{ supabase, uid, todayISO, money, round2, fmtPeriod, expenseSharePlan, emptyDB, apnRateForPrior, apnPartnerStats, apnFinancePostedFor, apnIdFor, INCOME_CATEGORIES, PRESETS, COMPANY_EXPENSE_CATEGORIES, PROJECT_EXPENSE_CATEGORIES, Modal, Field, SearchableSelect, SelectOther, SplitBar, Trash2, Plus, X, Link2 }} /></React.Suspense>}
        {modal?.type === "expense" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading expense form…</div>}><LazyShareForm kind="expense" initial={modal.initial} currentUser={currentUser} db={db} onSave={(e) => saveShare(e, modal.source)} onClose={() => setModal(null)} runtime={{ supabase, uid, todayISO, money, round2, fmtPeriod, expenseSharePlan, emptyDB, apnRateForPrior, apnPartnerStats, apnFinancePostedFor, apnIdFor, INCOME_CATEGORIES, PRESETS, COMPANY_EXPENSE_CATEGORIES, PROJECT_EXPENSE_CATEGORIES, Modal, Field, SearchableSelect, SelectOther, SplitBar, Trash2, Plus, X, Link2 }} /></React.Suspense>}
        {modal?.type === "withdraw" && <React.Suspense fallback={<LoadingScreen />}><LazyWithdrawForm balances={bal} defaultUser={currentUser} onSave={(w) => mutate((d) => ({ ...d, withdrawals: [...d.withdrawals, { ...w, status: isSuper ? "approved" : "pending" }] }), { action: `recorded withdrawal of ${money(w.amount)}${isSuper ? "" : " (awaiting approval)"}`, module: "Withdrawals" })} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, USERS, todayISO, round2, uid, money }} /></React.Suspense>}
        {modal?.type === "task" && <React.Suspense fallback={<LoadingScreen />}><LazyTaskForm initial={modal.initial} currentUser={currentUser} team={teamNames} people={team} isAdmin={isAdmin} onSave={(t) => saveTask(t, modal.fromConcept)} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, USERS, COMBINED, PRIORITIES }} /></React.Suspense>}
        {modal?.type === "leave" && <React.Suspense fallback={<LoadingScreen />}><LazyLeaveForm initial={modal.initial} me={me} onSave={(l) => mutate((d) => ({ ...d, leave: d.leave.some((x) => x.id === l.id) ? d.leave.map((x) => x.id === l.id ? l : x) : [...d.leave, l] }), { action: (db.leave.some((x) => x.id === l.id) ? "updated " : "submitted ") + l.type + " leave request", module: "Leave" })} onClose={() => setModal(null)} runtime={{ useState, Modal, Field, SelectOther, Check, uid, todayISO, daysBetween, LEAVE_TYPES }} /></React.Suspense>}
        {modal?.type === "project" && <React.Suspense fallback={<LoadingScreen />}><LazyProjectForm initial={modal.initial} onSave={(p) => saveGeneric("projects", p, "project")} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, todayISO, PROJECT_STAGES }} /></React.Suspense>}
        {modal?.type === "inhouse" && <React.Suspense fallback={<LoadingScreen />}><LazyInHouseForm initial={modal.initial} team={team} onSave={(x) => saveOwned("inhouse", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, todayISO, INHOUSE_CATEGORIES, PRIORITIES, INHOUSE_STAGES, ExternalLink }} /></React.Suspense>}
        {modal?.type === "testSession" && <React.Suspense fallback={<LoadingScreen />}><LazyTestSessionForm initial={modal.initial} projects={[...db.projects].filter((p) => (p.approvalStatus || "approved") !== "rejected").sort((a, b) => (a.name || "").localeCompare(b.name || ""))} team={team} onSave={saveTesting} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid }} /></React.Suspense>}
        {modal?.type === "teamcfg" && <React.Suspense fallback={<LoadingScreen />}><LazyTeamConfigForm initial={modal.initial} roster={team.filter((p) => p.role !== "client" && p.active !== false)} onSave={saveTeamCfg} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, AlertTriangle, Avatar, uid, ROLE_LABEL }} /></React.Suspense>}
        {modal?.type === "student" && <React.Suspense fallback={<LoadingScreen />}><LazyStudentForm initial={modal.initial} onSave={(s) => saveGeneric("students", s, "student")} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO }} /></React.Suspense>}
        {modal?.type === "classStudent" && <React.Suspense fallback={<LoadingScreen />}><LazyClassStudentForm initial={modal.initial} onSave={saveClassStudent} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO, CLASS_COURSES, CLASS_MODES }} /></React.Suspense>}
        {modal?.type === "marketing" && <React.Suspense fallback={<LoadingScreen />}><LazyMarketingForm initial={modal.initial} onSave={(m) => saveGeneric("marketing", m, "marketing client")} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO }} /></React.Suspense>}
        {modal?.type === "concept" && <React.Suspense fallback={<LoadingScreen />}><LazyConceptForm initial={modal.initial} onSave={(c) => saveGeneric("concepts", c, "idea")} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO }} /></React.Suspense>}
        {modal?.type === "lead" && <React.Suspense fallback={<LoadingScreen />}><LazyLeadForm initial={modal.initial} onSave={(x) => saveOwned("leads", x)} onClose={() => setModal(null)} runtime={{ useState, Modal, Field, SelectOther, Check, uid, LEAD_SOURCES, LEAD_STAGES, LEAD_SERVICES }} /></React.Suspense>}
        {modal?.type === "client" && <React.Suspense fallback={<LoadingScreen />}><LazyClientForm initial={modal.initial} existing={db.clients} onSave={(x) => { saveOwned("clients", x); }} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO }} /></React.Suspense>}
        {modal?.type === "quotation" && <React.Suspense fallback={<LoadingScreen />}><LazyQuotationForm initial={modal.initial} clients={db.clients} portalClients={portalClients} onSave={(x) => saveOwned("quotations", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, X, Plus, RefreshCw, Upload, uid, round2, money, uploadAttachment, QUOTE_STATUS }} /></React.Suspense>}
        {modal?.type === "invoice" && <React.Suspense fallback={<LoadingScreen />}><LazyInvoiceForm initial={modal.initial} clients={db.clients} portalClients={portalClients} onSave={(x) => saveOwned("invoices", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, uid, todayISO, INVOICE_STATUS }} /></React.Suspense>}
        {modal?.type === "planned" && <React.Suspense fallback={<LoadingScreen />}><LazyPlannedForm initial={modal.initial} onSave={(x) => saveOwned("planned", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, EXPENSE_CATEGORIES, EXPENSE_RECURRENCE, PLANNED_STATUS }} /></React.Suspense>}
        {modal?.type === "vault" && <React.Suspense fallback={<LoadingScreen />}><LazyVaultForm initial={modal.initial} onSave={(x) => saveOwned("vault", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, VAULT_CATEGORIES, Eye, EyeOff }} /></React.Suspense>}
        {modal?.type === "document" && <React.Suspense fallback={<LoadingScreen />}><LazyDocForm initial={modal.initial} team={team} portalClients={portalClients} onSave={(x) => saveOwned("documents", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, Check, SelectOther, RefreshCw, Upload, uid, uploadAttachment, DOC_CATEGORIES }} /></React.Suspense>}
        {modal?.type === "knowledge" && <React.Suspense fallback={<LoadingScreen />}><LazyKbForm initial={modal.initial} onSave={(x) => saveOwned("knowledge", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, KB_CATEGORIES }} /></React.Suspense>}
        {modal?.type === "prompt" && <React.Suspense fallback={<LoadingScreen />}><LazyPromptForm initial={modal.initial} onSave={(x) => saveOwned("prompts", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, PROMPT_CATEGORIES }} /></React.Suspense>}
        {modal?.type === "sheet" && <React.Suspense fallback={<LoadingScreen />}><LazySheetForm initial={modal.initial} onSave={(x) => saveOwned("sheets", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Check, uid, SHEET_CATEGORIES }} /></React.Suspense>}
        {modal?.type === "reward" && <React.Suspense fallback={<LoadingScreen />}><LazyRewardForm initial={modal.initial} team={team} onSave={(x) => saveOwned("rewards", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SelectOther, Award, Check, uid, todayISO, REWARD_KINDS }} /></React.Suspense>}
        {modal?.type === "notification" && <React.Suspense fallback={<LoadingScreen />}><LazyNotificationForm initial={modal.initial} team={team} onSave={(x) => saveOwned("notifications", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, SearchableSelect, Bell, uid, NOTIF_LEVELS, NOTIF_AUDIENCES, ROLE_LABEL }} /></React.Suspense>}
        {modal?.type === "announcement" && <React.Suspense fallback={<LoadingScreen />}><LazyAnnouncementForm initial={modal.initial} onSave={(x) => saveOwned("announcements", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, MegaphoneIcon, uid }} /></React.Suspense>}
        {modal?.type === "portalPost" && <React.Suspense fallback={<LoadingScreen />}><LazyPortalPostForm initial={modal.initial} portalClients={portalClients} onSave={(x) => saveOwned("portal_posts", x)} onClose={() => setModal(null)} runtime={{ Modal, Field, Send, RefreshCw, Upload, uid, uploadAttachment }} /></React.Suspense>}
        {modal?.type === "resign" && <React.Suspense fallback={<LoadingScreen />}><LazyResignForm existing={(db.resignations || []).filter((r) => r.userId === me.id)} onSave={(r) => { mutate((d) => ({ ...d, resignations: [...(d.resignations || []), { ...r, id: uid(), userId: me.id, userName: currentUser, status: "Pending", createdAt: Date.now() }] }), { action: "submitted a resignation request", module: "Team" }); setModal(null); }} onClose={() => setModal(null)} runtime={{ useState, Modal, Field, Check, todayISO, fmtDate }} /></React.Suspense>}
        {modal?.type === "confirm" && <Confirm title={modal.title} body={modal.body} confirmLabel={modal.confirmLabel} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "deleteConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} actionLabel={modal.actionLabel || "Delete"} icon={<Trash2 size={15} />} danger onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "restoreConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} actionLabel={modal.actionLabel || "Restore"} icon={<RotateCcw size={15} />} danger={false} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "okConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} word="OK" actionLabel={modal.actionLabel || "Confirm"} icon={modal.icon} danger={false} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}

        {balanceUser && <BalanceDetail db={db} user={balanceUser} onClose={() => setBalanceUser(null)} onFull={canFinance ? openAccount : undefined} />}

        {activityDetail && <ActivityDetailsDrawer activity={activityDetail} db={db} isSuper={isSuper} onClose={() => setActivityDetail(null)} onRelated={openActivityRelated} />}

        {searchOpen && <GlobalSearch db={db} team={team} profile={profile} role={role} me={me} allowedRoutes={[...allowedRoutes]} go={go} openTask={openTask} openModal={openModal} onClose={() => setSearchOpen(false)} />}
      </div>
    </ErrorBoundary>
  );
}

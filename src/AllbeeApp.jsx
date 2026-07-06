import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Wallet, ArrowDownToLine, ListTodo, TrendingUp, Lightbulb,
  GraduationCap, Megaphone, FolderKanban, ScrollText, Settings as SettingsIcon,
  Plus, X, Sun, Moon, Search, Trash2, Pencil, ChevronRight, Check, AlertTriangle,
  Download, Upload, LogOut, Hexagon, CalendarClock, ArrowRight, Menu, Wifi, WifiOff,
  Mail, KeyRound, LogIn, RefreshCw, CloudOff,
  Users, UserCheck, CalendarDays, MessageSquare, Plane, Clock, CheckCircle2, XCircle, Hourglass, ShieldCheck,
  ArrowLeft, Undo2, RotateCcw, Paperclip, Link2, ExternalLink, Activity, Filter, Send, FileText, Sheet, Tag,
  Copy, Eye, EyeOff, Lock as LockIcon, Unlock as UnlockIcon, Award, Star, BookOpen, Bell, Building2, Phone, UserPlus, Megaphone as MegaphoneIcon, BadgeCheck, Banknote, User, Sparkles, Home, Coins,
  Bug, ClipboardCheck, Image as ImageIcon, MapPin, Trophy, Target, PhoneCall, GaugeCircle, Gift, ArrowDownUp, MessageCircle,
} from "lucide-react";
import { supabase } from "./supabaseClient";

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
// "Inactive" = no activity for over a week. Uses last seen, falling back to the
// join date so brand-new accounts get a grace period before they're flagged.
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
const LOGO_FULL = "/allbee-logo.png";   // full lockup (monogram + wordmark)
const LOGO_ICON = "/allbee-icon.png";   // square monogram

/* ── roles & access (Phase 3 — five levels) ───────────────────────────────
   superadmin (Haji & Alim) · admin · accountant · staff · intern.
   The money (Share & accounts, Withdrawals) is superadmin + accountant only;
   a plain admin runs the team and business but never sees the partner split. */
const ROLE_LABEL = { superadmin: "Super admin", admin: "Admin", accountant: "Accountant", staff: "Staff", intern: "Intern", partner: "APN Partner", district_head: "District Head" };
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
const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
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
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
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
  "apn_users", "apn_attendance", "apn_targets", "apn_training", "apn_quizzes", "apn_leads", "apn_quotations", "apn_commissions", "apn_achievements", "apn_notifications", "apn_documents"];

async function fetchAll() {
  const db = emptyDB();
  await Promise.all(TABLES.map(async (t) => {
    const { data, error } = await supabase.from(t).select("id,data");
    if (error) {
      // Tolerate a table that hasn't been migrated yet so a partial deploy
      // (new app, old schema) doesn't brick the whole workspace. Real errors
      // (RLS, auth, network) still surface.
      if (/does not exist|find the table|schema cache|PGRST205/i.test(error.message || "")) { db[t] = []; return; }
      throw new Error(`Loading ${t}: ${error.message}`);
    }
    db[t] = (data || [])
      .map((r) => r.data)
      .filter((x) => x && typeof x === "object")   // tolerate a malformed/null row instead of white-screening
      .sort((a, b) => (a?.createdAt || a?.ts || 0) - (b?.createdAt || b?.ts || 0));
  }));
  return db;
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
      if (!b || JSON.stringify(b) !== JSON.stringify(row)) upserts.push({ id, data: row, updated_at: stamp });
    }
    const deletes = [];
    for (const id of before.keys()) if (!after.has(id)) deletes.push(id);
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
async function replaceAll(clean) {
  const stamp = new Date().toISOString();
  for (const t of TABLES) {
    const del = await supabase.from(t).delete().neq("id", "");
    if (del.error) throw new Error(`Clearing ${t}: ${del.error.message}`);
    const rows = (clean[t] || []).map((x) => ({ id: x.id, data: x, updated_at: stamp }));
    if (rows.length) {
      const up = await supabase.from(t).upsert(rows);
      if (up.error) throw new Error(`Restoring ${t}: ${up.error.message}`);
    }
  }
}

/* ── people (profiles / roles) ────────────────────────────────────────── */
async function fetchTeam() {
  const { data, error } = await supabase.from("profiles").select("id,name,email,role,active,created_at,status,mobile,dob,photo_url,perms,tnc_version,tnc_roles_accepted,approved,designation,last_active,username").order("created_at", { ascending: true });
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
const AI_DEFAULT_MODEL = "claude-sonnet-4-5";
const AI_DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
function aiConfigOf(config) {
  let raw = {};
  try { raw = JSON.parse((config && config.ai) || "{}") || {}; } catch { raw = {}; }
  return {
    enabled: !!raw.enabled,
    mode: raw.mode === "direct" ? "direct" : "function",
    functionName: (raw.functionName || "ai-chat").trim() || "ai-chat",
    endpoint: (raw.endpoint || AI_DEFAULT_ENDPOINT).trim() || AI_DEFAULT_ENDPOINT,
    model: (raw.model || AI_DEFAULT_MODEL).trim() || AI_DEFAULT_MODEL,
    apiKey: raw.apiKey || "",
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
    const { data, error } = await supabase.functions.invoke(cfg.functionName || "ai-chat", {
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
// A compact, bounded snapshot of the workspace so the assistant can answer
// questions and draft quotations/replies grounded in real ALLBEE data.
function buildAIContext(db, company) {
  const cap = (arr, n) => (Array.isArray(arr) ? arr.slice(-n).reverse() : []);
  const co = company || {};
  const L = [];
  L.push(`COMPANY: ${co.name || "ALLBEE Solutions"}${co.email ? " · " + co.email : ""}${co.phone ? " · " + co.phone : ""}${co.website ? " · " + co.website : ""}`);
  if (co.address) L.push(`ADDRESS: ${co.address}`);

  const clients = cap(db.clients, 40);
  if (clients.length) {
    L.push(`\nCLIENTS (${db.clients.length} total, newest first):`);
    clients.forEach((c) => L.push(`- ${c.name}${c.company ? " (" + c.company + ")" : ""} · ${c.status || "—"}${c.phone ? " · " + c.phone : ""}${c.email ? " · " + c.email : ""}${c.value ? " · deal " + money(c.value) : ""}${c.notes ? " · " + String(c.notes).slice(0, 80) : ""}`));
  }
  const leads = cap(db.leads, 40);
  if (leads.length) {
    L.push(`\nLEADS (${db.leads.length}):`);
    leads.forEach((x) => L.push(`- ${x.name}${x.company ? " (" + x.company + ")" : ""} · service ${x.service || "—"} · stage ${x.stage || "—"}${x.value ? " · est " + money(x.value) : ""}${x.leadOwner ? " · owner " + x.leadOwner : ""}${x.phone ? " · " + x.phone : ""}${x.notes ? " · " + String(x.notes).slice(0, 80) : ""}`));
  }
  const quotes = cap(db.quotations, 30);
  if (quotes.length) {
    L.push(`\nQUOTATIONS (${db.quotations.length}):`);
    quotes.forEach((q) => {
      const items = (q.items || []).map((it) => `${it.desc || "item"} x${it.qty || 1} @ ${money(it.rate || 0)}`).join("; ");
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
const periodOf = (iso) => (iso ? String(iso).slice(0, 7) : todayISO().slice(0, 7)); // 'YYYY-MM'
const fmtPeriod = (p) => { const [y, m] = (p || "").split("-"); const d = new Date(Number(y), Number(m) - 1, 1); return isNaN(d) ? p : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
const fmtDateTime = (ts) => { const d = new Date(ts); return isNaN(d) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }); };
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
const isTeamLead = (teams, userId) => (teams || []).some((t) => t.leadId === userId);
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
  apn_users: [], apn_attendance: [], apn_targets: [], apn_training: [], apn_quizzes: [],
  apn_leads: [], apn_quotations: [], apn_commissions: [], apn_achievements: [], apn_notifications: [], apn_documents: [],
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
const CSS = `
.allbee, .allbee * { box-sizing: border-box; }
.allbee {
  --bg:#F6F7F9; --surface:#FFFFFF; --surface-2:#F0F2F6; --ink:#161A20; --muted:#626C7A;
  --border:#E4E8EF; --primary:#2E3B8F; --primary-soft:#E9EBFA; --accent:#EAA417;
  --pos:#15924D; --pos-soft:#E5F4EB; --neg:#D23B3B; --neg-soft:#FBEAEA;
  --haji:#0E9F8E; --alim:#7C5CFC; --shadow:0 1px 2px rgba(16,22,32,.06),0 8px 24px rgba(16,22,32,.06);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--ink); background:var(--bg); min-height:100vh; -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.allbee[data-theme="dark"] {
  --bg:#0D1117; --surface:#161B22; --surface-2:#1C232C; --ink:#E7EBF1; --muted:#8B95A5;
  --border:#262E39; --primary:#6D7BFF; --primary-soft:#1B2247; --accent:#F2B23C;
  --pos:#3FBF73; --pos-soft:#12281C; --neg:#F0635F; --neg-soft:#2E1717;
  --haji:#26C4B0; --alim:#9B82FF; --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35);
}
.mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace; font-variant-numeric:tabular-nums; }

.layout { display:grid; grid-template-columns:248px 1fr; min-height:100vh; }
.sidebar {
  background:var(--surface); border-right:1px solid var(--border); padding:18px 14px;
  display:flex; flex-direction:column; gap:4px; position:sticky; top:0; height:100vh; overflow-y:auto;
}
.brand { display:flex; align-items:center; gap:10px; padding:6px 8px 16px; }
.brand-badge { width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,var(--accent),#d98c00);
  display:grid; place-items:center; color:#fff; box-shadow:0 4px 12px rgba(234,164,23,.35); }
.brand h1 { font-size:16px; margin:0; letter-spacing:.3px; font-weight:800; }
.brand p { font-size:11px; margin:1px 0 0; color:var(--muted); letter-spacing:.6px; text-transform:uppercase; }
.navitem { display:flex; align-items:center; gap:11px; padding:9px 11px; border-radius:9px; cursor:pointer;
  font-size:14px; color:var(--muted); border:1px solid transparent; transition:.12s; font-weight:500; }
.navitem:hover { background:var(--surface-2); color:var(--ink); }
.navitem.active { background:var(--primary-soft); color:var(--primary); font-weight:600; }
.navitem .badge { margin-left:auto; }
.sidebar-foot { margin-top:auto; padding-top:12px; border-top:1px solid var(--border); }
.nav-sec { font-size:10.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; padding:6px 11px 2px; }
.nav-sec-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 11px 4px; }
.nav-sec-row .nav-sec { padding:0; }
.nav-sort { background:none; border:1px solid var(--border); border-radius:6px; color:var(--muted); font-size:10px; font-weight:700; padding:2px 8px; cursor:pointer; text-transform:uppercase; letter-spacing:.04em; display:flex; align-items:center; gap:4px; }
.nav-sort:hover { background:var(--surface-2); color:var(--ink); }
.nav-cat { font-size:10px; font-weight:700; color:var(--muted); opacity:.72; text-transform:uppercase; letter-spacing:.05em; padding:10px 11px 3px; }

.main { display:flex; flex-direction:column; min-width:0; }
.topbar { display:flex; align-items:center; gap:12px; padding:8px 18px; border-bottom:1px solid var(--border);
  background:color-mix(in srgb,var(--surface) 80%,transparent); backdrop-filter:blur(8px); position:sticky; top:0; z-index:20; min-height:50px; }
.hamburger { display:none; }
.topbar h2 { font-size:15px; margin:0; font-weight:700; line-height:1.15; }
.topbar-sub { font-size:11px; color:var(--muted); margin-top:0; }
.company-pill { margin-left:auto; display:flex; align-items:center; gap:7px; background:var(--surface);
  border:1px solid var(--border); padding:5px 11px; border-radius:9px; box-shadow:var(--shadow); }
.company-pill .lbl { font-size:11px; color:var(--muted); font-weight:600; }
.company-pill .val { font-size:14px; font-weight:700; }
.iconbtn { width:36px; height:36px; border-radius:9px; border:1px solid var(--border); background:var(--surface);
  display:grid; place-items:center; cursor:pointer; color:var(--ink); transition:.12s; }
.iconbtn:hover { background:var(--surface-2); }
.usermenu { position:relative; display:flex; align-items:center; gap:4px; flex-shrink:0; }
.topbar-title { flex:1; min-width:0; }
.topbar-title h2 { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.userchip { display:flex; align-items:center; gap:8px; border:1px solid var(--border); background:var(--surface);
  border-radius:9px; padding:5px 10px 5px 6px; cursor:pointer; font-weight:600; font-size:13px; }
.avatar { width:26px; height:26px; border-radius:50%; display:grid; place-items:center; color:#fff; font-size:12px; font-weight:700; }
.dropdown { position:absolute; right:0; top:46px; background:var(--surface); border:1px solid var(--border);
  border-radius:11px; box-shadow:var(--shadow); padding:6px; min-width:170px; z-index:40; }
.dropdown button { width:100%; text-align:left; padding:9px 10px; border:none; background:none; color:var(--ink);
  border-radius:8px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:9px; }
.dropdown button:hover { background:var(--surface-2); }
.drop-id { display:flex; align-items:center; gap:9px; padding:8px 10px 10px; margin-bottom:4px; border-bottom:1px solid var(--border); }
.userchip-name { max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.role-badge { font-size:10px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; padding:2px 7px; border-radius:999px; }
.role-badge.admin { background:var(--primary-soft); color:var(--primary); }
.role-badge.staff { background:var(--surface-2); color:var(--muted); }
.quick-actions { display:flex; gap:10px; flex-wrap:wrap; }
.who-cell { display:inline-flex; align-items:center; gap:9px; }

.content { padding:18px 22px 22px; max-width:1180px; width:100%; }
.page-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.page-head h3 { font-size:19px; margin:0; font-weight:700; }
.page-head .spacer { flex:1; }
.topbar .iconbtn { width:32px; height:32px; }
.topbar .userchip { padding:4px 9px 4px 5px; }
.topbar .dropdown { top:42px; }

.card { background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:var(--shadow); }
.cards-grid { display:grid; gap:14px; }
.stat { padding:16px 18px; }
.stat .lbl { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:7px; font-weight:500; }
.stat .num { font-size:26px; font-weight:700; margin-top:8px; letter-spacing:-.5px; }
.stat .sub { font-size:12px; color:var(--muted); margin-top:3px; }
.dot { width:9px; height:9px; border-radius:50%; }

.balance-card { padding:18px; position:relative; overflow:hidden; cursor:pointer; transition:.15s; }
.balance-card:hover { transform:translateY(-2px); }
.balance-card .stripe { position:absolute; left:0; top:0; bottom:0; width:4px; }
.balance-card .who { font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px; }
.balance-card .amt { font-size:30px; font-weight:800; margin-top:10px; letter-spacing:-.6px; }
.balance-card .hint { font-size:11px; color:var(--muted); margin-top:8px; display:flex; align-items:center; gap:4px; }

.split { display:flex; height:7px; border-radius:6px; overflow:hidden; background:var(--surface-2); }
.split .h { background:var(--haji); }
.split .a { background:var(--alim); }
.split-legend { display:flex; gap:14px; font-size:11px; color:var(--muted); margin-top:6px; }
.split-legend span { display:flex; align-items:center; gap:5px; }

.btn { display:inline-flex; align-items:center; gap:7px; border:1px solid var(--border); background:var(--surface);
  color:var(--ink); padding:9px 14px; border-radius:9px; font-size:13.5px; font-weight:600; cursor:pointer; transition:.12s; }
.btn:hover { background:var(--surface-2); }
.btn.primary { background:var(--primary); color:#fff; border-color:var(--primary); }
.btn.primary:hover { filter:brightness(1.07); }
.btn.danger { color:var(--neg); border-color:transparent; background:transparent; }
.btn.danger:hover { background:var(--neg-soft); }
.btn.ghost { border-color:transparent; background:transparent; }
.btn.sm { padding:6px 10px; font-size:12.5px; }
.btn.icon { padding:6px; gap:0; }
.btn.icon.sm { padding:5px; }
.wa-btn { border-color:#25D366; color:#128C7E; background:var(--surface); }
.wa-btn:hover { background:#25D366; color:#fff; border-color:#25D366; }
.allbee[data-theme="dark"] .wa-btn { color:#3FBF73; }
.allbee[data-theme="dark"] .wa-btn:hover { color:#052; }
.btn:disabled { opacity:.5; cursor:not-allowed; }

.badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; background:var(--surface-2); color:var(--muted); white-space:nowrap; }
.badge.pos { background:var(--pos-soft); color:var(--pos); }
.badge.neg { background:var(--neg-soft); color:var(--neg); }
.badge.pri { background:var(--primary-soft); color:var(--primary); }
.badge.accent { background:rgba(234,164,23,.16); color:var(--accent); }

table.tbl { width:100%; border-collapse:collapse; font-size:13.5px; }
table.tbl th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--muted);
  padding:10px 14px; border-bottom:1px solid var(--border); font-weight:600; }
table.tbl td { padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
table.tbl tr:last-child td { border-bottom:none; }
table.tbl tr:hover td { background:var(--surface-2); }
.num-cell { text-align:right; }
.pos-txt { color:var(--pos); } .neg-txt { color:var(--neg); }

.item-row { display:flex; align-items:center; gap:14px; padding:14px 16px; border-bottom:1px solid var(--border); }
.item-row:last-child { border-bottom:none; }
.item-row:hover { background:var(--surface-2); }
.item-main { min-width:0; flex:1; }
.item-title { font-weight:600; font-size:14.5px; }
.item-meta { font-size:12.5px; color:var(--muted); margin-top:3px; display:flex; gap:10px; flex-wrap:wrap; }
.row-actions { display:flex; gap:4px; opacity:.8; }

.empty { text-align:center; padding:46px 20px; color:var(--muted); }
.empty .ic { width:54px; height:54px; border-radius:14px; background:var(--surface-2); display:grid; place-items:center; margin:0 auto 14px; }
.empty h4 { margin:0 0 6px; color:var(--ink); font-size:16px; }
.empty p { margin:0 0 16px; font-size:13.5px; }

.overlay { position:fixed; inset:0; background:rgba(10,14,20,.5); backdrop-filter:blur(2px); z-index:100;
  display:flex; align-items:flex-start; justify-content:center; padding:40px 16px; overflow-y:auto; }
.modal { background:var(--surface); border:1px solid var(--border); border-radius:16px; width:100%; max-width:560px;
  box-shadow:0 24px 64px rgba(0,0,0,.35); animation:pop .16s ease; }
@keyframes pop { from { opacity:0; transform:translateY(8px) scale(.99);} to { opacity:1; transform:none; } }
.modal-head { display:flex; align-items:center; padding:18px 20px; border-bottom:1px solid var(--border); }
.modal-head h3 { margin:0; font-size:17px; font-weight:700; }
.modal-body { padding:20px; display:flex; flex-direction:column; gap:14px; max-height:62vh; overflow-y:auto; }
.modal-foot { padding:14px 20px; border-top:1px solid var(--border); display:flex; gap:10px; justify-content:flex-end; }

.field label { display:block; font-size:12.5px; font-weight:600; margin-bottom:6px; color:var(--ink); }
.field .req { color:var(--neg); }
.input, .select, .textarea { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:9px;
  padding:10px 12px; font-size:14px; color:var(--ink); font-family:inherit; transition:.12s; }
.input:focus, .select:focus, .textarea:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-soft); }
.textarea { resize:vertical; min-height:90px; line-height:1.5; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.hint-line { font-size:12px; color:var(--muted); }
.field-err { font-size:12px; color:var(--neg); margin-top:5px; display:flex; align-items:center; gap:5px; }

.preset-row { display:flex; gap:6px; flex-wrap:wrap; }
.preset { font-size:11.5px; padding:5px 9px; border-radius:7px; border:1px solid var(--border); background:var(--surface);
  cursor:pointer; font-weight:600; color:var(--muted); }
.preset:hover { border-color:var(--primary); color:var(--primary); }

.calc-box { background:var(--surface-2); border-radius:11px; padding:13px 15px; display:flex; flex-direction:column; gap:9px; }
.calc-row { display:flex; align-items:center; justify-content:space-between; font-size:13.5px; }

.toolbar { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.search { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border);
  border-radius:9px; padding:0 12px; flex:1; min-width:180px; }
.search input { border:none; background:none; outline:none; padding:10px 0; font-size:14px; color:var(--ink); width:100%; font-family:inherit; }
.seg { display:flex; gap:2px; background:var(--surface-2); border-radius:9px; padding:3px; }
.seg button { border:none; background:none; padding:7px 12px; border-radius:7px; font-size:12.5px; cursor:pointer;
  color:var(--muted); font-weight:600; white-space:nowrap; }
.seg button.on { background:var(--surface); color:var(--ink); box-shadow:var(--shadow); }

.banner { display:flex; align-items:center; gap:9px; padding:9px 14px; border-radius:10px; font-size:12.5px;
  background:var(--accent); color:#3a2a00; margin:0 22px 0; margin-top:14px; font-weight:500; }

.progress-track { height:8px; border-radius:6px; background:var(--surface-2); overflow:hidden; }
.progress-fill { height:100%; background:var(--primary); border-radius:6px; transition:width .25s; }

.tag { font-size:11px; padding:2px 8px; border-radius:6px; background:var(--surface-2); color:var(--muted); }

.kbd { font-size:11px; }

/* Lock screen */
.lock { min-height:100vh; display:grid; place-items:center; padding:24px; }
.lock-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:36px 32px;
  width:100%; max-width:420px; box-shadow:var(--shadow); text-align:center; }
.lock-badge { width:60px; height:60px; border-radius:16px; margin:0 auto 18px; background:linear-gradient(135deg,var(--accent),#d98c00);
  display:grid; place-items:center; color:#fff; box-shadow:0 8px 24px rgba(234,164,23,.4); }
.lock h1 { margin:0; font-size:24px; font-weight:800; letter-spacing:.5px; }
.lock p { margin:6px 0 26px; color:var(--muted); font-size:14px; }
.who-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.who-btn { border:1px solid var(--border); background:var(--surface); border-radius:14px; padding:20px 12px; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:10px; transition:.14s; }
.who-btn:hover { transform:translateY(-2px); box-shadow:var(--shadow); border-color:var(--primary); }
.who-btn .av { width:48px; height:48px; border-radius:50%; display:grid; place-items:center; color:#fff; font-size:20px; font-weight:800; }
.who-btn .nm { font-weight:700; font-size:15px; }
.auth-msg { display:flex; align-items:center; gap:7px; font-size:12.5px; margin-top:14px; padding:9px 11px; border-radius:9px; text-align:left; }
.auth-msg.err { color:var(--neg); background:color-mix(in srgb, var(--neg) 12%, transparent); }
.auth-msg.ok { color:var(--pos); background:color-mix(in srgb, var(--pos) 14%, transparent); }
.linkbtn { background:none; border:none; color:var(--primary); font-size:13px; font-weight:600; cursor:pointer; margin-top:14px; }
.linkbtn:hover { text-decoration:underline; }
.spin { animation:sp 1s linear infinite; } @keyframes sp { to { transform:rotate(360deg); } }

@media (max-width:900px) {
  .layout { grid-template-columns:1fr; }
  .sidebar { position:fixed; left:0; top:0; bottom:0; width:264px; z-index:200; transform:translateX(-105%); transition:.22s; }
  .allbee.menu-open .sidebar { transform:none; box-shadow:0 0 0 100vmax rgba(0,0,0,.45); }
  .hamburger { display:grid; }
  .content { padding:16px; }
  .grid2 { grid-template-columns:1fr; }
  .company-pill .lbl { display:none; }
  .topbar { padding:9px 14px; gap:10px; }
  .topbar h2 { font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .topbar > div:nth-child(2) { min-width:0; }
  .company-pill { padding:5px 9px; }
  .company-pill .val { font-size:14px; }
}
@media (max-width:768px) {
  .topbar { gap:8px; padding:9px 12px; }
  .topbar-sub { display:none; }
  .userchip-name { display:none; }
  .userchip .role-badge { display:none; }
  .userchip { padding:4px; gap:0; }
  .search-trigger { min-width:0; padding:8px; flex:none; }
  .search-trigger .st-lbl, .search-trigger .st-kbd { display:none; }
  .topbar .company-pill { padding:5px 8px; gap:5px; }
  .topbar .company-pill .val { font-size:13px; }
}
@media (max-width:560px) {
  .cards-grid { grid-template-columns:1fr !important; }
  .topbar-title h2 { font-size:14px; }
}

/* ── Phase 2 additions ─────────────────────────────────────────────────── */
/* logo */
.brand-logo { height:30px; width:auto; display:block; }
.lock-logo { height:64px; width:auto; margin:0 auto 16px; display:block; }
.brand-mini { display:flex; align-items:center; gap:10px; padding:6px 8px 16px; }

/* back link + detail header */
.backlink { display:inline-flex; align-items:center; gap:6px; background:none; border:none; color:var(--muted);
  font-size:13px; font-weight:600; cursor:pointer; padding:4px 0; margin-bottom:6px; }
.backlink:hover { color:var(--ink); }
.detail-head { display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
.detail-head h3 { font-size:22px; margin:0; font-weight:800; letter-spacing:-.3px; }
.meta-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:1px; background:var(--border);
  border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.meta-grid > div { background:var(--surface); padding:12px 14px; }
.meta-grid .k { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--muted); font-weight:600; }
.meta-grid .v { font-weight:600; margin-top:5px; font-size:14px; }

/* summary stat strip */
.sumrow { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:16px; }
.sumrow .card { padding:14px 16px; }
.sumrow .k { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:6px; font-weight:500; }
.sumrow .v { font-size:21px; font-weight:700; margin-top:7px; letter-spacing:-.4px; }

/* filter bar */
.filterbar { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px; align-items:end; }
.filterbar .field { margin:0; }
.filterbar label { font-size:11px; }

/* activity timeline */
.timeline { position:relative; padding-left:22px; }
.timeline::before { content:""; position:absolute; left:6px; top:4px; bottom:4px; width:2px; background:var(--border); }
.tl-item { position:relative; padding:6px 0 14px; }
.tl-item:last-child { padding-bottom:0; }
.tl-dot { position:absolute; left:-20px; top:8px; width:11px; height:11px; border-radius:50%; background:var(--primary);
  border:2px solid var(--surface); box-shadow:0 0 0 1px var(--border); }
.tl-item .what { font-weight:600; font-size:14px; }
.tl-item .when { font-size:12px; color:var(--muted); margin-top:2px; }

/* comments */
.comment { display:flex; gap:10px; padding:12px 0; border-bottom:1px solid var(--border); }
.comment:last-child { border-bottom:none; }
.comment .body { flex:1; min-width:0; }
.comment .who { font-weight:600; font-size:13.5px; }
.comment .txt { margin-top:3px; line-height:1.5; white-space:pre-wrap; font-size:14px; }
.comment .when { font-size:11.5px; color:var(--muted); margin-top:4px; }
.composer { display:flex; gap:10px; align-items:flex-end; margin-top:6px; }
.composer .textarea { min-height:44px; }

/* attachment chips */
.attach-list { display:flex; flex-direction:column; gap:8px; }
.attach { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--surface-2); }
.attach a { color:var(--primary); text-decoration:none; font-weight:600; font-size:14px; word-break:break-all; }
.attach a:hover { text-decoration:underline; }

/* recently deleted */
.ttl-pill { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; }
.ttl-ok { background:var(--surface-2); color:var(--muted); }
.ttl-soon { background:var(--neg-soft); color:var(--neg); }
.detail-json { background:var(--surface-2); border-radius:10px; padding:12px 14px; font-size:12.5px; line-height:1.7; }
.detail-json .k { color:var(--muted); }
.ttl-link { background:none; border:none; padding:0; margin:0; font:inherit; font-weight:700; font-size:14.5px; color:var(--ink);
  cursor:pointer; text-align:left; }
.ttl-link:hover { color:var(--primary); text-decoration:underline; }

/* ── Phase 3: roles, access gates, lifecycle ───────────────────────────── */
.role-badge.superadmin { background:rgba(234,164,23,.18); color:var(--accent); }
.role-badge.accountant { background:var(--pos-soft); color:var(--pos); }
.role-badge.intern { background:var(--surface-2); color:var(--muted); }

/* first-login profile + terms gates reuse the lock card */
.gate-card { max-width:480px; text-align:left; }
.gate-card h1 { font-size:22px; text-align:center; }
.gate-card > p { text-align:center; }
.gate-foot { display:flex; gap:10px; margin-top:18px; }
.tnc-scroll { max-height:44vh; overflow:auto; border:1px solid var(--border); border-radius:12px;
  padding:14px 16px; background:var(--surface-2); font-size:13.5px; line-height:1.6; white-space:pre-wrap; }
.checkrow { display:flex; align-items:flex-start; gap:10px; font-size:13.5px; margin-top:16px; cursor:pointer; line-height:1.45; }
.checkrow input { margin-top:2px; width:16px; height:16px; flex:none; }

/* per-staff module grants */
.perm-list { display:flex; flex-direction:column; gap:8px; }
.perm-item { display:flex; align-items:center; gap:11px; padding:11px 13px; border:1px solid var(--border);
  border-radius:10px; background:var(--surface-2); font-size:14px; font-weight:600; cursor:pointer; }
.perm-item input { width:16px; height:16px; }

/* employee lifecycle */
.status-pill { font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px; white-space:nowrap; }
.status-active { background:var(--pos-soft); color:var(--pos); }
.status-on_leave { background:rgba(234,164,23,.16); color:var(--accent); }
.status-suspended, .status-resigned, .status-terminated { background:var(--neg-soft); color:var(--neg); }

/* ── Phase Next: global search (Ctrl+K) ────────────────────────────────── */
.search-trigger { display:flex; align-items:center; gap:8px; border:1px solid var(--border); background:var(--surface);
  border-radius:9px; padding:6px 10px; cursor:pointer; color:var(--muted); font-size:13px; font-weight:500; min-width:170px; }
.search-trigger:hover { background:var(--surface-2); color:var(--ink); }
.search-trigger .st-kbd { margin-left:auto; font-size:10.5px; font-weight:700; letter-spacing:.3px; color:var(--muted);
  border:1px solid var(--border); border-radius:6px; padding:1px 6px; background:var(--surface-2); }
.cmdk-overlay { position:fixed; inset:0; background:rgba(10,14,20,.5); backdrop-filter:blur(2px); z-index:300;
  display:flex; align-items:flex-start; justify-content:center; padding:64px 16px 24px; overflow-y:auto; }
.cmdk { background:var(--surface); border:1px solid var(--border); border-radius:16px; width:100%; max-width:640px;
  box-shadow:0 24px 64px rgba(0,0,0,.4); overflow:hidden; animation:pop .16s ease; }
.cmdk-input { display:flex; align-items:center; gap:11px; padding:15px 18px; border-bottom:1px solid var(--border); }
.cmdk-input input { flex:1; border:none; background:none; outline:none; font-size:16px; color:var(--ink); font-family:inherit; }
.cmdk-results { max-height:60vh; overflow-y:auto; padding:8px; }
.cmdk-group { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); padding:10px 12px 5px; }
.cmdk-item { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; cursor:pointer; }
.cmdk-item:hover, .cmdk-item.on { background:var(--surface-2); }
.cmdk-ic { width:32px; height:32px; border-radius:9px; background:var(--surface-2); display:grid; place-items:center; color:var(--muted); flex:none; }
.cmdk-item.on .cmdk-ic { background:var(--primary-soft); color:var(--primary); }
.cmdk-main { min-width:0; flex:1; }
.cmdk-title { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cmdk-path { font-size:11.5px; color:var(--muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cmdk-meta { display:flex; align-items:center; gap:8px; flex:none; }
.cmdk-empty { padding:40px 20px; text-align:center; color:var(--muted); font-size:14px; }
.cmdk-foot { display:flex; align-items:center; gap:14px; padding:9px 16px; border-top:1px solid var(--border);
  font-size:11px; color:var(--muted); flex-wrap:wrap; }
.cmdk-foot .k { border:1px solid var(--border); border-radius:5px; padding:1px 6px; font-weight:700; background:var(--surface-2); }
mark.hl { background:rgba(234,164,23,.32); color:inherit; border-radius:3px; padding:0 1px; }

/* ── Phase Next: testing module ────────────────────────────────────────── */
.check-item { display:flex; align-items:flex-start; gap:11px; padding:11px 0; border-bottom:1px solid var(--border); }
.check-item:last-child { border-bottom:none; }
.check-box { width:22px; height:22px; border-radius:7px; border:1.5px solid var(--border); background:var(--surface);
  display:grid; place-items:center; cursor:pointer; flex:none; margin-top:1px; transition:.12s; color:#fff; }
.check-box.done { background:var(--pos); border-color:var(--pos); }
.check-box:not(.done):hover { border-color:var(--primary); }
.check-txt { flex:1; min-width:0; font-size:14px; }
.check-txt.done { text-decoration:line-through; color:var(--muted); }
.thumb-row { display:flex; gap:8px; flex-wrap:wrap; }
.thumb { width:74px; height:74px; border-radius:10px; object-fit:cover; border:1px solid var(--border); cursor:pointer; background:var(--surface-2); }
.thumb-add { width:74px; height:74px; border-radius:10px; border:1.5px dashed var(--border); background:var(--surface-2);
  display:grid; place-items:center; cursor:pointer; color:var(--muted); }
.thumb-add:hover { border-color:var(--primary); color:var(--primary); }
.bug-card { border:1px solid var(--border); border-radius:12px; padding:13px 15px; background:var(--surface-2); display:flex; flex-direction:column; gap:10px; }

/* ── APN — ALLBEE Partner Network (mobile-first portal) ─────────────────── */
.apn { min-height:100vh; background:var(--bg); display:flex; flex-direction:column; }
.apn-top { position:sticky; top:0; z-index:30; display:flex; align-items:center; gap:10px; padding:11px 16px;
  background:color-mix(in srgb,var(--surface) 88%,transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--border); }
.apn-top .brand-logo { height:26px; }
.apn-top h1 { font-size:15px; font-weight:800; margin:0; letter-spacing:.3px; }
.apn-top .apn-id { font-size:11px; color:var(--muted); font-weight:600; }
.apn-body { flex:1; padding:16px 16px 88px; max-width:720px; width:100%; margin:0 auto; }
.apn-bottomnav { position:fixed; left:0; right:0; bottom:0; z-index:40; display:flex; background:var(--surface);
  border-top:1px solid var(--border); padding:6px 4px calc(6px + env(safe-area-inset-bottom)); box-shadow:0 -2px 16px rgba(0,0,0,.06); }
.apn-tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 2px; border:none; background:none;
  color:var(--muted); font-size:10.5px; font-weight:600; cursor:pointer; border-radius:10px; position:relative; }
.apn-tab.on { color:var(--primary); }
.apn-tab .tb { position:absolute; top:-6px; right:calc(50% - 22px); background:var(--neg); color:#fff; font-size:9px; font-weight:800;
  min-width:15px; height:15px; border-radius:8px; padding:0 4px; display:grid; place-items:center; }
.apn-more { position:fixed; inset:0; z-index:60; background:rgba(10,14,20,.5); backdrop-filter:blur(2px); display:flex; align-items:flex-end; }
.apn-more-sheet { background:var(--surface); width:100%; border-radius:18px 18px 0 0; padding:16px 16px calc(20px + env(safe-area-inset-bottom)); box-shadow:0 -12px 40px rgba(0,0,0,.35); animation:sheet .2s ease; }
@keyframes sheet { from { transform:translateY(20px); opacity:.6; } to { transform:none; opacity:1; } }
.apn-more-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.apn-more-item { display:flex; flex-direction:column; align-items:center; gap:7px; padding:15px 8px; border:1px solid var(--border);
  border-radius:14px; background:var(--surface-2); cursor:pointer; font-size:12px; font-weight:600; color:var(--ink); text-align:center; }
.apn-more-item:hover { border-color:var(--primary); }
.apn-metrics { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.apn-metric { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:13px 14px; box-shadow:var(--shadow); }
.apn-metric .k { font-size:11px; color:var(--muted); font-weight:600; display:flex; align-items:center; gap:6px; }
.apn-metric .v { font-size:20px; font-weight:800; margin-top:6px; letter-spacing:-.4px; }
.apn-lvl { background:linear-gradient(135deg,var(--primary),#4453c7); color:#fff; border-radius:16px; padding:16px 18px; box-shadow:var(--shadow); }
.apn-lvl .nm { font-size:18px; font-weight:800; }
.apn-lvl .rate { font-size:13px; opacity:.9; }
.apn-lvl .bar { height:8px; border-radius:6px; background:rgba(255,255,255,.28); overflow:hidden; margin-top:12px; }
.apn-lvl .bar > i { display:block; height:100%; background:#fff; border-radius:6px; }
.apn-hero { display:flex; align-items:center; gap:12px; }
.apn-hero .av { width:46px; height:46px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:19px; flex:none; }
.apn-section-h { font-size:17px; font-weight:800; margin:2px 0 12px; }
.apn-list { display:flex; flex-direction:column; gap:10px; }
.apn-rowcard { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:13px 15px; box-shadow:var(--shadow); }
.apn-fab { position:fixed; right:16px; bottom:92px; z-index:45; width:52px; height:52px; border-radius:50%; border:none;
  background:var(--primary); color:#fff; display:grid; place-items:center; box-shadow:0 8px 24px rgba(46,59,143,.4); cursor:pointer; }
.apn-rank { display:flex; align-items:center; gap:12px; padding:11px 6px; border-bottom:1px solid var(--border); }
.apn-rank:last-child { border-bottom:none; }
.apn-rank .pos { width:26px; height:26px; border-radius:50%; background:var(--surface-2); display:grid; place-items:center; font-weight:800; font-size:12px; flex:none; }
.apn-rank .pos.g1 { background:#F7C948; color:#5a3d00; } .apn-rank .pos.g2 { background:#CBD2D9; color:#1f2933; } .apn-rank .pos.g3 { background:#E8B27A; color:#5a3d00; }
.apn-ach { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:var(--surface); }
.apn-ach.lock { opacity:.5; }
.apn-ach .em { font-size:24px; }
.apn-quiz-opt { display:flex; align-items:center; gap:10px; padding:11px 13px; border:1.5px solid var(--border); border-radius:11px; cursor:pointer; margin-top:8px; font-size:14px; }
.apn-quiz-opt.sel { border-color:var(--primary); background:var(--primary-soft); }
.apn-seg-scroll { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px; -webkit-overflow-scrolling:touch; }
.apn-seg-scroll button { white-space:nowrap; border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:7px 13px; font-size:12.5px; font-weight:600; color:var(--muted); cursor:pointer; flex:none; }
.apn-seg-scroll button.on { background:var(--primary); color:#fff; border-color:var(--primary); }
@media (min-width:720px){ .apn-metrics { grid-template-columns:repeat(4,1fr); } }
`;

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

function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><span style={{ flex: 1 }} />
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, required, children, error, hint }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="req"> *</span>}</label>}
      {children}
      {hint && !error && <div className="hint-line" style={{ marginTop: 5 }}>{hint}</div>}
      {error && <div className="field-err"><AlertTriangle size={13} />{error}</div>}
    </div>
  );
}

function Empty({ icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <h4>{title}</h4><p>{text}</p>
      {action}
    </div>
  );
}

function Confirm({ title, body, confirmLabel = "Delete", onConfirm, onClose, danger = true }) {
  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={"btn " + (danger ? "primary" : "primary")} style={danger ? { background: "var(--neg)", borderColor: "var(--neg)" } : {}}
          onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>}>
      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>{body}</p>
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
function ShareForm({ kind, initial, onSave, onClose, currentUser, db }) {
  const isIncome = kind === "income";
  const [f, setF] = useState(() => {
    const base = { client: "", project: "", amount: "", date: todayISO(), category: isIncome ? "Project" : "Office Rent", hajiPct: 50, alimPct: 50, notes: "", ...initial };
    // New expenses default to the shared "company" bucket; legacy edits stay
    // manual ("project") so historical splits are never silently rewritten.
    if (!isIncome) base.scope = initial?.scope || (initial?.id ? "project" : "company");
    return base;
  });
  const [touched, setTouched] = useState(false);
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setSplit = (h) => setF((s) => ({ ...s, hajiPct: h, alimPct: 100 - h }));

  // Company expenses derive their split from the previous valid revenue month.
  const isCompany = !isIncome && f.scope === "company";
  const plan = useMemo(() => expenseSharePlan(db || emptyDB(), (f.date || todayISO()).slice(0, 7)), [db, f.date]);
  useEffect(() => {
    if (isCompany) setF((s) => (Number(s.hajiPct) === plan.haji && Number(s.alimPct) === plan.alim ? s : { ...s, hajiPct: plan.haji, alimPct: plan.alim }));
  }, [isCompany, plan.haji, plan.alim]);

  const amt = Number(f.amount) || 0;
  const sum = (Number(f.hajiPct) || 0) + (Number(f.alimPct) || 0);
  const splitOK = sum === 100;
  const valid = amt > 0 && (isCompany || splitOK) && f.date;
  const hShare = round2((amt * (Number(f.hajiPct) || 0)) / 100);
  const aShare = round2((amt * (Number(f.alimPct) || 0)) / 100);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const payload = {
      ...initial, id: initial?.id || uid(), kind, client: f.client.trim(), project: f.project.trim(),
      amount: amt, date: f.date, category: f.category, hajiPct: Number(f.hajiPct), alimPct: Number(f.alimPct),
      notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now(),
    };
    if (!isIncome) { payload.scope = f.scope; payload.shareSource = isCompany ? (plan.fallback ? null : plan.sourcePeriod) : null; }
    onSave(payload);
    onClose();
  };

  return (
    <Modal title={(initial?.id ? "Edit " : "Add ") + (isIncome ? "income" : "expense")} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />{isIncome ? "Add income" : "Add expense"}</button></>}>
      <div className="grid2">
        <Field label="Client name"><input className="input" value={f.client} onChange={(e) => up("client", e.target.value)} placeholder="e.g. Sun Textiles" /></Field>
        <Field label={isIncome ? "Project / source" : "Project (optional)"}><input className="input" value={f.project} onChange={(e) => up("project", e.target.value)} placeholder={isIncome ? "Website redesign" : "Tied to a project?"} /></Field>
      </div>
      <div className="grid2">
        <Field label={isIncome ? "Income amount" : "Expense amount"} required error={touched && amt <= 0 ? "Enter an amount above ₹0" : ""}>
          <input className="input mono" type="number" min="0" value={f.amount} onChange={(e) => up("amount", e.target.value)} placeholder="10000" />
        </Field>
        <Field label="Date" required><input className="input" type="date" value={f.date} onChange={(e) => up("date", e.target.value)} /></Field>
      </div>
      {!isIncome && (
        <Field label="Expense type" hint={isCompany ? "Company costs are shared automatically from your revenue split." : "Project & client costs keep their own manual split."}>
          <div className="seg" style={{ display: "inline-flex" }}>
            <button type="button" className={isCompany ? "on" : ""} onClick={() => up("scope", "company")}>Company (auto-shared)</button>
            <button type="button" className={!isCompany ? "on" : ""} onClick={() => up("scope", "project")}>Project / client</button>
          </div>
        </Field>
      )}
      <Field label="Category">
        <SelectOther value={f.category} onChange={(v) => up("category", v)} options={(isIncome ? INCOME_CATEGORIES : (isCompany ? COMPANY_EXPENSE_CATEGORIES : PROJECT_EXPENSE_CATEGORIES)).filter((c) => c !== "Other")} placeholder="Custom category…" />
      </Field>

      {isCompany ? (
        <Field label="Company expense split" hint="Set automatically — manage it under Share & accounts.">
          <div className="calc-box">
            <div className="calc-row" style={{ color: "var(--muted)", fontSize: 12 }}>
              {plan.fallback ? "No revenue recorded yet — using an even 50/50 split until your first revenue month." : `Based on ${fmtPeriod(plan.sourcePeriod)} revenue share`}
            </div>
            <div style={{ margin: "2px 0 4px" }}><SplitBar h={plan.haji} a={plan.alim} /></div>
            <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--haji)" }} />Haji</span><span className="mono" style={{ fontWeight: 700 }}>{plan.haji}%</span></div>
            <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--alim)" }} />Alim</span><span className="mono" style={{ fontWeight: 700 }}>{plan.alim}%</span></div>
          </div>
        </Field>
      ) : (
        <Field label="Profit split" required error={touched && !splitOK ? `Split must total 100% (currently ${sum}%)` : ""}
          hint="Set the share for this entry — no fixed percentage is assumed.">
          <div className="preset-row" style={{ marginBottom: 10 }}>
            {PRESETS.map(([h, a]) => (
              <button key={h + "/" + a} className="preset" onClick={() => setSplit(h)}>{h} / {a}</button>
            ))}
          </div>
          <div className="grid2">
            <div><div className="hint-line" style={{ marginBottom: 5 }}>Haji %</div>
              <input className="input mono" type="number" min="0" max="100" value={f.hajiPct} onChange={(e) => up("hajiPct", e.target.value === "" ? "" : Number(e.target.value))} /></div>
            <div><div className="hint-line" style={{ marginBottom: 5 }}>Alim %</div>
              <input className="input mono" type="number" min="0" max="100" value={f.alimPct} onChange={(e) => up("alimPct", e.target.value === "" ? "" : Number(e.target.value))} /></div>
          </div>
          <div style={{ marginTop: 12 }}><SplitBar h={Number(f.hajiPct) || 0} a={Number(f.alimPct) || 0} /></div>
        </Field>
      )}

      {amt > 0 && splitOK && (
        <div className="calc-box">
          <div className="calc-row" style={{ color: "var(--muted)", fontSize: 12 }}>This entry will {isIncome ? "credit" : "debit"}:</div>
          <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--haji)" }} />Haji</span>
            <span className={"mono " + (isIncome ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(isIncome ? hShare : -hShare, { sign: isIncome })}</span></div>
          <div className="calc-row"><span style={{ display: "flex", alignItems: "center", gap: 7 }}><span className="dot" style={{ background: "var(--alim)" }} />Alim</span>
            <span className={"mono " + (isIncome ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(isIncome ? aShare : -aShare, { sign: isIncome })}</span></div>
        </div>
      )}

      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Anything worth recording…" /></Field>
    </Modal>
  );
}

function WithdrawForm({ balances, defaultUser, onSave, onClose }) {
  const [user, setUser] = useState(defaultUser || "Haji");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const avail = balances[user] || 0;
  const amt = Number(amount) || 0;
  const over = amt > avail;
  const valid = amt > 0 && !over;
  const after = round2(avail - amt);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ id: uid(), user, amount: amt, date, notes: notes.trim(), createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Record withdrawal" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Withdraw</button></>}>
      <Field label="Who is withdrawing" required>
        <div className="seg">{USERS.map((u) => <button key={u} className={user === u ? "on" : ""} onClick={() => setUser(u)}>{u}</button>)}</div>
      </Field>
      <div className="calc-box"><div className="calc-row"><span style={{ color: "var(--muted)" }}>{user}'s available balance</span>
        <span className="mono" style={{ fontWeight: 700 }}>{money(avail)}</span></div></div>
      <div className="grid2">
        <Field label="Amount" required error={touched && amt <= 0 ? "Enter an amount" : over ? `Can't exceed available balance (${money(avail)})` : ""}>
          <input className="input mono" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </Field>
        <Field label="Date" required><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {amt > 0 && !over && (
        <div className="hint-line">Balance after withdrawal: <b className="mono">{money(after)}</b></div>
      )}
      <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / reference" /></Field>
    </Modal>
  );
}

function TaskForm({ initial, onSave, onClose, currentUser, team = USERS, people = [], isAdmin = true }) {
  // Everyone (admins, staff AND interns) can assign a task to one or more
  // teammates. The roster always includes the person creating it, so they can
  // assign work to themselves too.
  const roster = team.includes(currentUser) ? team : [currentUser, ...team];
  // name → stable user id, so a saved task keeps pointing at the right person
  // even if their display name is edited later (fixes assigned tasks that stop
  // showing up for the assignee). Legacy tasks with no ids still match by name.
  const idByName = useMemo(() => {
    const m = {};
    (people || []).forEach((p) => { if (p && p.name && p.id) m[p.name] = p.id; });
    return m;
  }, [people]);
  const initialAssignees = () => {
    if (Array.isArray(initial?.assignees) && initial.assignees.length) return initial.assignees.slice();
    if (initial?.assignedTo === COMBINED) return USERS.slice();
    if (initial?.assignedTo) return [initial.assignedTo];
    return [currentUser];
  };
  const [f, setF] = useState(() => ({
    title: "", desc: "", assignedBy: currentUser,
    priority: "Medium", due: "", notes: "", ...initial,
    assignees: initialAssignees(),
  }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleAssignee = (name) => setF((s) => ({
    ...s,
    assignees: s.assignees.includes(name) ? s.assignees.filter((x) => x !== name) : [...s.assignees, name],
  }));
  const valid = f.title.trim().length > 0 && f.assignees.length > 0;
  const save = () => {
    if (!valid) return;
    const assignees = f.assignees.slice();
    // Keep a readable `assignedTo` string for older/simple views, and preserve
    // the special two-partner label so existing combined-task behaviour is unchanged.
    const bothPartners = assignees.length === USERS.length && USERS.every((u) => assignees.includes(u));
    const assignedTo = assignees.length === 1 ? assignees[0] : bothPartners ? COMBINED : assignees.join(", ");
    // Attach stable ids next to the names (missing when someone isn't in the
    // roster yet — matching then simply falls back to the name).
    const assigneeIds = assignees.map((n) => idByName[n]).filter(Boolean);
    const assignedById = idByName[f.assignedBy] || initial?.assignedById || null;
    onSave({
      ...initial, id: initial?.id || uid(), title: f.title.trim(), desc: f.desc.trim(),
      assignedBy: f.assignedBy, assignedById, assignedTo, assignees, assigneeIds, priority: f.priority, due: f.due,
      notes: f.notes.trim(), status: initial?.status || "Created", progress: initial?.progress ?? 0,
      history: initial?.history || [{ status: "Created", at: Date.now(), by: f.assignedBy }],
      comments: initial?.comments || [], attachments: initial?.attachments || [], accepts: initial?.accepts || [],
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit task" : "New task"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />{initial?.id ? "Save task" : "Create task"}</button></>}>
      <Field label="Task title" required><input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Design the landing page" /></Field>
      <Field label="Description"><textarea className="textarea" value={f.desc} onChange={(e) => up("desc", e.target.value)} placeholder="Full, detailed instructions — write as much as you need." /></Field>
      <Field label="Assigned by"><input className="input" value={f.assignedBy} disabled style={{ opacity: .7 }} /></Field>
      <Field label={`Assign to${f.assignees.length > 1 ? ` · ${f.assignees.length} people` : ""}`} required
        hint={f.assignees.length > 1 ? "Everyone selected must accept before the task can start; any of them can complete it." : undefined}>
        <div className="perm-list">
          {roster.map((n) => (
            <label key={n} className="perm-item">
              <input type="checkbox" checked={f.assignees.includes(n)} onChange={() => toggleAssignee(n)} />{n}{n === currentUser ? " (you)" : ""}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid2">
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => up("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Due date"><input className="input" type="date" value={f.due} onChange={(e) => up("due", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" style={{ minHeight: 60 }} value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function ProjectForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ client: "", name: "", type: "Website", cost: "", start: todayISO(), expected: "", stage: "Lead", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), client: f.client.trim(), name: f.name.trim(), type: f.type, cost: Number(f.cost) || 0, start: f.start, expected: f.expected, stage: f.stage, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit project" : "New project"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save project</button></>}>
      <div className="grid2">
        <Field label="Project name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="E-commerce site" /></Field>
        <Field label="Client name"><input className="input" value={f.client} onChange={(e) => up("client", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Project type"><SelectOther value={f.type} onChange={(v) => up("type", v)} options={["Website", "Mobile App", "Software"]} placeholder="Custom type…" /></Field>
        <Field label="Cost"><input className="input mono" type="number" min="0" value={f.cost} onChange={(e) => up("cost", e.target.value)} placeholder="50000" /></Field>
      </div>
      <div className="grid2">
        <Field label="Start date"><input className="input" type="date" value={f.start} onChange={(e) => up("start", e.target.value)} /></Field>
        <Field label="Expected completion"><input className="input" type="date" value={f.expected} onChange={(e) => up("expected", e.target.value)} /></Field>
      </div>
      <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => up("stage", e.target.value)}>{PROJECT_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function StudentForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: "", phone: "", course: "", joinDate: todayISO(), fee: "", paymentStatus: "Unpaid", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), name: f.name.trim(), phone: f.phone.trim(), course: f.course.trim(), joinDate: f.joinDate, fee: Number(f.fee) || 0, paymentStatus: f.paymentStatus, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit student" : "New student"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save student</button></>}>
      <div className="grid2">
        <Field label="Student name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label="Phone number"><input className="input" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+91…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Course name"><input className="input" value={f.course} onChange={(e) => up("course", e.target.value)} placeholder="Full-stack web dev" /></Field>
        <Field label="Joining date"><input className="input" type="date" value={f.joinDate} onChange={(e) => up("joinDate", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Fee amount"><input className="input mono" type="number" min="0" value={f.fee} onChange={(e) => up("fee", e.target.value)} /></Field>
        <Field label="Payment status"><select className="select" value={f.paymentStatus} onChange={(e) => up("paymentStatus", e.target.value)}>{["Unpaid", "Partial", "Paid"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function MarketingForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ client: "", business: "", plan: "", monthlyFee: "", startDate: todayISO(), notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.client.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), client: f.client.trim(), business: f.business.trim(), plan: f.plan.trim(), monthlyFee: Number(f.monthlyFee) || 0, startDate: f.startDate, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit marketing client" : "New marketing client"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save client</button></>}>
      <div className="grid2">
        <Field label="Client name" required><input className="input" value={f.client} onChange={(e) => up("client", e.target.value)} /></Field>
        <Field label="Business name"><input className="input" value={f.business} onChange={(e) => up("business", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Plan name"><input className="input" value={f.plan} onChange={(e) => up("plan", e.target.value)} placeholder="Growth / Social" /></Field>
        <Field label="Monthly fee"><input className="input mono" type="number" min="0" value={f.monthlyFee} onChange={(e) => up("monthlyFee", e.target.value)} /></Field>
      </div>
      <Field label="Start date"><input className="input" type="date" value={f.startDate} onChange={(e) => up("startDate", e.target.value)} /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function ConceptForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ title: "", notes: "", date: todayISO(), ...initial, tags: Array.isArray(initial?.tags) ? initial.tags.join(", ") : initial?.tags || "" }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.title.trim().length > 0;
  const save = () => { if (!valid) return; onSave({ ...initial, id: initial?.id || uid(), title: f.title.trim(), notes: f.notes.trim(), tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), date: f.date, createdAt: initial?.createdAt || Date.now() }); onClose(); };
  return (
    <Modal title={initial?.id ? "Edit idea" : "New idea"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save idea</button></>}>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Subscription billing tool" /></Field>
      <Field label="Detailed notes"><textarea className="textarea" style={{ minHeight: 120 }} value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Flesh out the idea…" /></Field>
      <div className="grid2">
        <Field label="Tags" hint="Comma separated"><input className="input" value={f.tags} onChange={(e) => up("tags", e.target.value)} placeholder="saas, future, B2B" /></Field>
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => up("date", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

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
  const dayMonth = (dobISO) => { const d = new Date(dobISO + "T00:00:00"); return new Date(new Date().getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); };
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

function Dashboard({ db, bal, go, openBalance, showMoney = true, showOps = true, team = [], isSuper = false }) {
  const m = monthStats(db);
  const pending = db.tasks.filter((t) => t.status !== "Completed").length;
  const active = db.projects.filter((p) => p.stage !== "Completed").length;
  const recent = [...db.audit].slice(-8).reverse();
  const awayList = isSuper ? inactiveMembers(team) : [];
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
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 18 }}>
          {stats}
        </div>
      )}

      <div className="card">
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Recent activity</div>
        {recent.length === 0 ? (
          <Empty icon={<ScrollText size={22} color="var(--muted)" />} title="Nothing here yet" text="Your activity feed fills up as the team works." />
        ) : recent.map((a) => (
          <div key={a.id} className="item-row">
            <div className="avatar" style={{ background: avatarColor(a.user), width: 28, height: 28, fontSize: 11 }}>{a.user[0]}</div>
            <div className="item-main"><div className="item-title" style={{ fontWeight: 500, fontSize: 14 }}><b>{a.user}</b> {a.action}</div>
              <div className="item-meta"><span>{a.module}</span><span>{fmtTime(a.ts)}</span></div></div>
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
  jspdf: "https://esm.sh/jspdf@2.5.2",
  autotable: "https://esm.sh/jspdf-autotable@3.8.4",
};
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
  } catch (e) { console.error(e); alert("Couldn't build the Excel file — the export library failed to load. Check your internet connection and try again."); }
}
// Full backup → one worksheet per table, every row flattened. Opens directly in
// Excel or Google Sheets (File → Import) and doubles as a keep-safe snapshot.
async function exportFullBackupXLSX(db) {
  try {
    const mod = await import(/* @vite-ignore */ EXPORT_CDN.xlsx);
    const XLSX = mod.utils ? mod : (mod.default || mod);
    const wb = XLSX.utils.book_new();
    const used = new Set();
    let any = false;
    for (const t of TABLES) {
      const rows = db[t] || [];
      if (!rows.length) continue;
      const keys = Array.from(rows.reduce((s, r) => { Object.keys(r || {}).forEach((k) => s.add(k)); return s; }, new Set()));
      const aoa = [keys, ...rows.map((r) => keys.map((k) => { const v = r ? r[k] : undefined; return v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : v); }))];
      let name = (MODULE_LABEL[t] || t).slice(0, 31), base = name, i = 2;
      while (used.has(name.toLowerCase())) { name = (base.slice(0, 28) + " " + i).slice(0, 31); i++; }
      used.add(name.toLowerCase());
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
      any = true;
    }
    if (!any) { alert("There's no data to back up yet."); return; }
    XLSX.writeFile(wb, `allbee-backup-${todayISO()}.xlsx`);
  } catch (e) { console.error(e); alert("Couldn't build the Excel backup — the export library failed to load. Check your connection and try again."); }
}
async function exportRowsToPDF(filename, title, subtitle, columns, rows) {
  try {
    const jspdfMod = await import(/* @vite-ignore */ EXPORT_CDN.jspdf);
    const jsPDF = jspdfMod.jsPDF || jspdfMod.default;
    const autoTable = (await import(/* @vite-ignore */ EXPORT_CDN.autotable)).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15); doc.text(title, 40, 40);
    if (subtitle) { doc.setFontSize(10); doc.setTextColor(120); doc.text(subtitle, 40, 58); doc.setTextColor(0); }
    autoTable(doc, {
      head: [columns.map((c) => c.label)],
      body: rows.map((r) => columns.map((c) => { const v = c.value(r); return v === "" || v == null ? "" : String(v); })),
      startY: 72, styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [16, 159, 142], textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 249] },
    });
    doc.save(filename);
  } catch (e) { console.error(e); alert("Couldn't build the PDF — the export library failed to load. Check your internet connection and try again."); }
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
          <Field label="Client"><select className="select" value={client} onChange={(e) => setClient(e.target.value)}><option value="all">All clients</option>{clients.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Project"><select className="select" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All projects</option>{projects.map((p) => <option key={p}>{p}</option>)}</select></Field>
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
  const doLock = async (p, on) => { try { on ? await lockPeriod(p, currentUser) : await unlockPeriod(p); } catch (e) { alert(e.message || "Couldn't update the lock."); } };
  const list = useMemo(() => {
    let r = [...db.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    if (view !== "all") r = r.filter((t) => t.kind === view);
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((t) => [t.client, t.project, t.category, t.notes].join(" ").toLowerCase().includes(s)); }
    return r;
  }, [db.transactions, view, q]);

  const del = (t) => removeItem("transactions", t, { name: `${t.kind === "income" ? "Income" : "Expense"} ${money(t.amount)}${t.client ? " · " + t.client : ""}`, audit: `deleted a ${t.kind} of ${money(t.amount)}` });

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

function Tasks({ db, mutate, openModal, isAdmin = true, currentUser, me, openTask, removeItem }) {
  const [filter, setFilter] = useState("active");
  const [scope, setScope] = useState("mine"); // staff: mine | assigned
  const who = me || { name: currentUser };
  const list = useMemo(() => {
    let r = [...db.tasks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!isAdmin) r = r.filter((t) => scope === "assigned"
      ? ((who.id && t.assignedById === who.id) || t.assignedBy === currentUser)
      : isTaskAssignee(t, who));
    if (filter === "active") r = r.filter((t) => t.status !== "Completed");
    else if (filter === "progress") r = r.filter((t) => t.status === "In Progress");
    else if (filter === "done") r = r.filter((t) => t.status === "Completed");
    return r;
  }, [db.tasks, filter, scope, isAdmin, currentUser, who.id, who.name]);

  const auditFor = (action) => ({ action, module: "Tasks" });

  // advance is only ever called by the assigned person (button is gated below).
  // A task assigned to both partners needs each of them to Accept before Start.
  const advance = (t) => {
    const patch = nextTaskState(t, currentUser);
    const note = patch.status ? `moved "${t.title}" to ${patch.status}` : `accepted "${t.title}"`;
    haptic(patch.status === "Completed" ? [10, 40, 10] : 12);
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, ...patch } : x) }), auditFor(note));
  };
  const undo = (t) => {
    const history = [...(t.history || []), { status: "In Progress", at: Date.now(), by: currentUser }];
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, status: "In Progress", progress: Math.min(t.progress ?? 90, 90), history } : x) }),
      auditFor(`restored task "${t.title}" from Completed to In Progress`));
  };
  const askDelete = (t) => openModal({
    type: "deleteConfirm", title: "Delete task?",
    body: `This moves "${t.title}" to Recently deleted.`, note: "You can restore it within 60 days.",
    onConfirm: () => removeItem("tasks", t, { name: t.title, audit: `deleted task "${t.title}"` }),
  });

  return (
    <div className="content">
      <div className="page-head"><h3>{isAdmin ? "Tasks" : "My tasks"}</h3><span className="spacer" />
        <button className="btn primary" onClick={() => openModal({ type: "task" })}><Plus size={16} />New task</button></div>
      <div className="toolbar">
        <div className="seg">{[["all", "All"], ["active", "Active"], ["progress", "Progress"], ["done", "Completed"]].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {!isAdmin && <div className="seg">{[["mine", "Assigned to me"], ["assigned", "I assigned"]].map(([k, l]) => <button key={k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>{l}</button>)}</div>}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ListTodo size={22} color="var(--muted)" />} title="No tasks here"
            text={isAdmin ? "Assign work to anyone on the team. Tasks move Created → Accepted → In Progress → Completed." : "Tasks assigned to you will appear here. Accept one to get started."}
            action={<button className="btn primary" onClick={() => openModal({ type: "task" })}><Plus size={16} />New task</button>} />
        ) : list.map((t) => {
          const canAct = canActOnTask(t, currentUser);
          const canEdit = canEditTask(t, currentUser, isAdmin);
          const act = canAct ? taskAction(t, currentUser) : null;
          return (
            <div key={t.id} className="item-row">
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  {t.num != null && <span className="badge mono" style={{ fontWeight: 700 }}>#{t.num}</span>}
                  <button className="ttl-link" onClick={() => openTask(t.id)}>{t.title}</button>
                  <span className={"badge " + (t.status === "Completed" ? "pos" : t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
                  {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
                </div>
                {t.desc && <div className="item-meta" style={{ marginTop: 6 }}>{t.desc.length > 140 ? t.desc.slice(0, 140) + "…" : t.desc}</div>}
                <div className="item-meta" style={{ marginTop: 6 }}>
                  <span>{t.assignedBy} → <b style={{ color: isMultiAssignee(t) ? "var(--ink)" : avatarColor(taskAssignees(t)[0]) }}>{assigneeText(t)}</b></span>
                  {t.due && <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {fmtDate(t.due)}</span>}
                  {!canAct && t.status !== "Completed" && <span className="hint-line" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ShieldCheck size={11} />{isAdmin ? "Monitor only — " : ""}{isMultiAssignee(t) ? "assignees control status" : `${assigneeText(t)} controls status`}</span>}
                </div>
              </div>
              <div className="row-actions">
                {act && <button className="btn sm primary" disabled={act.disabled} onClick={() => { if (!act.disabled) advance(t); }}>{act.label}<ArrowRight size={13} /></button>}
                {t.status === "Completed" && (canAct || canEdit) && <button className="btn sm" onClick={() => undo(t)}><Undo2 size={13} />Undo</button>}
                <button className="iconbtn" style={{ width: 32, height: 32 }} title="Open task" onClick={() => openTask(t.id)}><ExternalLink size={14} /></button>
                {canEdit && <button className="iconbtn" style={{ width: 32, height: 32 }} title="Edit" onClick={() => openModal({ type: "task", initial: t })}><Pencil size={14} /></button>}
                {canEdit && <button className="iconbtn" style={{ width: 32, height: 32 }} title="Delete" onClick={() => askDelete(t)}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function Projects({ db, mutate, openModal, openIncome, removeItem, canFinance, isAdmin, me }) {
  const list = [...db.projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Staff may edit a project they created for 7 days; after that it's admin-only.
  const canEditP = (p) => isAdmin || (p.createdById === me?.id && (Date.now() - (p.createdAt || 0)) < 7 * 86400000);
  const setStage = (p, stage) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, stage } : x) }), { action: `set "${p.name}" to ${stage}`, module: "Projects" });
  const appr = (p) => p.approvalStatus || "approved"; // legacy projects count as approved
  const setApproval = (p, s) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, approvalStatus: s, approvedAt: Date.now() } : x) }), { action: `${s === "approved" ? "approved" : "rejected"} project "${p.name}"`, module: "Projects" });
  const del = (p) => removeItem("projects", p, { name: p.name, audit: `deleted project "${p.name}"` });
  const pending = isAdmin ? list.filter((p) => appr(p) === "pending").length : 0;
  return (
    <div className="content">
      <div className="page-head"><h3>Projects</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "project" })}><Plus size={16} />New project</button></div>
      {pending > 0 && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><Hourglass size={15} /> {pending} project{pending > 1 ? "s" : ""} submitted by staff awaiting your approval.</div>}
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<FolderKanban size={22} color="var(--muted)" />} title="No projects yet" text="Track websites, apps and software from Lead all the way to Completed." action={<button className="btn primary" onClick={() => openModal({ type: "project" })}><Plus size={16} />New project</button>} /></div>
          : list.map((p) => (
            <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div><div className="sub">{p.client || "No client"} · {p.type}</div></div>
                <div className="mono" style={{ fontWeight: 700 }}>{money(p.cost)}</div>
              </div>
              {appr(p) !== "approved" && <div><span className={"badge " + (appr(p) === "rejected" ? "neg" : "accent")}>{appr(p) === "rejected" ? "Rejected" : "Awaiting approval"}</span>{p.ownerName && <span className="hint-line" style={{ fontSize: 11, marginLeft: 8 }}>by {p.ownerName}</span>}</div>}
              <select className="select" value={p.stage} onChange={(e) => setStage(p, e.target.value)}>{PROJECT_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
              <div className="item-meta">{p.start && <span>Start {fmtDate(p.start)}</span>}{p.expected && <span>Due {fmtDate(p.expected)}</span>}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {isAdmin && appr(p) !== "approved" && <button className="btn sm primary" onClick={() => setApproval(p, "approved")}><Check size={13} />Approve</button>}
                {isAdmin && appr(p) === "pending" && <button className="btn sm danger" onClick={() => setApproval(p, "rejected")}><X size={13} />Reject</button>}
                {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: p.client, project: p.name, amount: p.cost, category: "Project" })}>Record income</button>}
                {canEditP(p) && <button className="btn sm" onClick={() => openModal({ type: "project", initial: p })}><Pencil size={13} /></button>}
                {canEditP(p) && <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete project?", body: `Delete "${p.name}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>}
                {!canEditP(p) && <span className="hint-line" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}><LockIcon size={11} />Admin-only after 7 days</span>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Courses({ db, mutate, openModal, openIncome, removeItem, canFinance }) {
  const list = [...db.students].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (s) => removeItem("students", s, { name: s.name, audit: `removed student ${s.name}` });
  return (
    <div className="content">
      <div className="page-head"><h3>Courses & students</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "student" })}><Plus size={16} />New student</button></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<GraduationCap size={22} color="var(--muted)" />} title="No students yet" text="Register students and record their fees — paid fees flow straight into Accounts." action={<button className="btn primary" onClick={() => openModal({ type: "student" })}><Plus size={16} />New student</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Student</th><th>Course</th><th>Joined</th><th className="num-cell">Fee</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id}>
                <td><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone}</div></td>
                <td>{s.course || "—"}</td><td className="mono">{fmtDate(s.joinDate)}</td>
                <td className="num-cell mono">{money(s.fee)}</td>
                <td><span className={"badge " + (s.paymentStatus === "Paid" ? "pos" : s.paymentStatus === "Partial" ? "accent" : "neg")}>{s.paymentStatus}</span></td>
                <td><div className="row-actions">
                  {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: s.name, project: s.course || "Course fee", amount: s.fee, category: "Course", source: { kind: "student", id: s.id } })}>Record fee</button>}
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "student", initial: s })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove student?", body: `Remove ${s.name}?`, note: "They move to Recently deleted — restore within 60 days.", onConfirm: () => del(s) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

/* ── Class students (training institute roster) — admin/superadmin only ─────
   Own module, own table (class_students). Import from an existing Excel/CSV/
   Google Sheet, export back out any time, and — if a Google Sheet webhook is
   connected — every add/edit is mirrored into that sheet automatically. */
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

function ClassStudentForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: "", phone: "", email: "", course: "", mode: "Offline", batch: "", joinDate: todayISO(), fee: "", paid: "", paymentStatus: "Unpaid", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = (f.name || "").trim().length > 0;
  const save = () => {
    if (!valid) return;
    onSave({
      ...initial,
      id: initial?.id || uid(),
      name: f.name.trim(), phone: (f.phone || "").trim(), email: (f.email || "").trim(),
      course: (f.course || "").trim(), mode: f.mode || "Offline", batch: (f.batch || "").trim(),
      joinDate: f.joinDate, fee: Number(f.fee) || 0, paid: Number(f.paid) || 0,
      paymentStatus: f.paymentStatus, notes: (f.notes || "").trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit class student" : "New class student"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save student</button></>}>
      <div className="grid2">
        <Field label="Student name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label="Phone number"><input className="input" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+91…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Course"><input className="input" list="class-course-list" value={f.course} onChange={(e) => up("course", e.target.value)} placeholder="MS Office, Tally, Python…" />
          <datalist id="class-course-list">{CLASS_COURSES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Class mode"><select className="select" value={f.mode} onChange={(e) => up("mode", e.target.value)}>{CLASS_MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Batch / timing"><input className="input" value={f.batch} onChange={(e) => up("batch", e.target.value)} placeholder="Morning 10–11" /></Field>
      </div>
      <div className="grid2">
        <Field label="Joining date"><input className="input" type="date" value={f.joinDate} onChange={(e) => up("joinDate", e.target.value)} /></Field>
        <Field label="Payment status"><select className="select" value={f.paymentStatus} onChange={(e) => up("paymentStatus", e.target.value)}>{["Unpaid", "Partial", "Paid"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Total fee"><input className="input mono" type="number" min="0" value={f.fee} onChange={(e) => up("fee", e.target.value)} /></Field>
        <Field label="Amount paid"><input className="input mono" type="number" min="0" value={f.paid} onChange={(e) => up("paid", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function Marketing({ db, mutate, openModal, openIncome, removeItem, canFinance }) {
  const list = [...db.marketing].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (m) => removeItem("marketing", m, { name: m.client, audit: `removed marketing client ${m.client}` });
  return (
    <div className="content">
      <div className="page-head"><h3>Digital marketing</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "marketing" })}><Plus size={16} />New client</button></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Megaphone size={22} color="var(--muted)" />} title="No marketing clients yet" text="Track monthly retainers and get a due reminder each cycle." action={<button className="btn primary" onClick={() => openModal({ type: "marketing" })}><Plus size={16} />New client</button>} /></div>
          : list.map((m) => {
            const due = marketingDue(m);
            return (
              <div key={m.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{m.client}</div><div className="sub">{m.business || "—"} · {m.plan || "Plan"}</div></div>
                  <div className="mono" style={{ fontWeight: 700 }}>{money(m.monthlyFee)}<span style={{ fontSize: 11, color: "var(--muted)" }}>/mo</span></div>
                </div>
                <div><span className={"badge " + due.tone}>{due.label}</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  {canFinance && <button className="btn sm primary" onClick={() => openIncome({ client: m.client, project: (m.plan || "Marketing") + " — monthly", amount: m.monthlyFee, category: "Marketing", source: { kind: "marketing", id: m.id } })}>Record payment</button>}
                  <button className="btn sm" onClick={() => openModal({ type: "marketing", initial: m })}><Pencil size={13} /></button>
                  <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Remove client?", body: `Remove ${m.client}?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(m) })}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function Concepts({ db, mutate, openModal, removeItem }) {
  const list = [...db.concepts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const del = (c) => removeItem("concepts", c, { name: c.title, audit: `deleted idea "${c.title}"` });
  const convert = (c) => openModal({ type: "task", initial: { title: c.title, desc: c.notes }, fromConcept: c.id });
  return (
    <div className="content">
      <div className="page-head"><h3>Concepts & ideas</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<Lightbulb size={22} color="var(--muted)" />} title="No ideas saved" text="Park business ideas and future plans here. Turn any of them into a task with one tap." action={<button className="btn primary" onClick={() => openModal({ type: "concept" })}><Plus size={16} />New idea</button>} /></div>
          : list.map((c) => (
            <div key={c.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
              {c.notes && <div className="sub" style={{ lineHeight: 1.5 }}>{c.notes.length > 160 ? c.notes.slice(0, 160) + "…" : c.notes}</div>}
              {c.tags?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
              <div className="item-meta"><span>{fmtDate(c.date)}</span></div>
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn sm primary" onClick={() => convert(c)}><ArrowRight size={13} />Convert to task</button>
                <button className="btn sm" onClick={() => openModal({ type: "concept", initial: c })}><Pencil size={13} /></button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete idea?", body: `Delete "${c.title}"?`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(c) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function AuditLog({ db }) {
  const list = [...db.audit].reverse();
  return (
    <div className="content">
      <div className="page-head"><h3>Audit log</h3></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<ScrollText size={22} color="var(--muted)" />} title="No activity recorded" text="Every action — edits, share changes, expenses, withdrawals — is logged here permanently." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th></tr></thead>
            <tbody>{list.map((a) => (
              <tr key={a.id}><td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtTime(a.ts)}</td>
                <td><span className="badge"><span className="dot" style={{ background: avatarColor(a.user), display: "inline-block", marginRight: 5 }} />{a.user}</span></td>
                <td>{a.action}</td><td><span className="tag">{a.module}</span></td></tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

function AllbeeAI({ db, config, me, role, isAdmin, go }) {
  const cfg = aiConfigOf(config);
  const company = companyOf(config);
  const configured = aiConfigured(cfg);
  const [messages, setMessages] = useState([]);      // [{ role: "user"|"assistant", content }]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(-1);
  const scroller = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, busy]);

  const system = useMemo(() => {
    const co = company.name || "ALLBEE Solutions";
    const features = "Dashboard, Tasks, Attendance, Leave, Daily updates, Team chat, Leads, Clients, Quotations, Invoices, Client updates, Projects, In-house projects, Testing, Courses, Class students, Marketing, Concepts/Ideas, Share & accounts, Withdrawals, Planned expenses, Passwords vault, Notifications, Announcements, Documents, Knowledge base, Prompts, Sheets, Performance, Rewards, Earnings, Team & Team leads, Audit log, Settings.";
    return [
      `You are ALLBEE AI, the built-in assistant inside the ${co} business-management app (run by partners Haji & Alim).`,
      `You are talking to ${me?.name || "a team member"} (role: ${ROLE_LABEL[role] || role || "staff"}).`,
      `Help staff with anything in the business: drafting client quotations and replies, following up on leads, summarising tasks, pricing, explaining how app features work, and general help.`,
      `The app has these modules: ${features}`,
      `When drafting a quotation or anything with money, use Indian Rupees (₹) and show a clear itemised list with a subtotal and total. Keep a professional, friendly tone suited to an Indian small business.`,
      `Be concise and practical. If you need a detail (client name, budget, scope), ask a short question first. Never invent client data — only use what's in the snapshot below or what the user tells you.`,
      `\nCURRENT WORKSPACE SNAPSHOT (read-only, newest first, may be partial):\n${buildAIContext(db, company)}`,
    ].join("\n");
  }, [db, company, me, role]);

  const send = async (text) => {
    const content = (text != null ? text : input).trim();
    if (!content || busy) return;
    setError("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // Keep the last few turns for context, but the window must begin with a
      // user turn (the model API rejects a leading assistant message).
      let window = next.slice(-12);
      while (window.length && window[0].role !== "user") window = window.slice(1);
      const reply = await callAI(cfg, system, window);
      setMessages((m) => [...m, { role: "assistant", content: reply || "(no reply)" }]);
    } catch (e) {
      setError((e && e.message) || "Something went wrong talking to the AI.");
    } finally {
      setBusy(false);
      setTimeout(() => boxRef.current?.focus(), 30);
    }
  };
  const copy = async (txt, i) => { try { await navigator.clipboard.writeText(txt || ""); setCopied(i); setTimeout(() => setCopied(-1), 1500); } catch { /* blocked */ } };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  if (!configured) {
    return (
      <div className="content">
        <div className="page-head"><h3><Sparkles size={18} style={{ verticalAlign: -3, marginRight: 6, color: "var(--primary)" }} />ALLBEE AI</h3></div>
        <div className="card stat" style={{ textAlign: "center", padding: "34px 22px" }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--primary-soft)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Sparkles size={26} color="var(--primary)" /></div>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>The assistant isn't switched on yet</div>
          {isAdmin ? (
            <>
              <p className="hint-line" style={{ lineHeight: 1.6, maxWidth: 460, margin: "0 auto 16px" }}>
                Turn on ALLBEE AI in Settings. The quickest secure way is a small Supabase Edge Function that holds your API key; you can also paste a key directly for internal testing.
              </p>
              <button className="btn primary" onClick={() => go("settings")}><SettingsIcon size={16} />Set up AI in Settings</button>
            </>
          ) : (
            <p className="hint-line" style={{ lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
              Ask a partner or admin (Haji or Alim) to switch on ALLBEE AI from Settings. Once it's on, you can ask it to draft quotations, reply to clients, and more — right here.
            </p>
          )}
        </div>
      </div>
    );
  }

  const bubbleWrap = { display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 12px" };
  return (
    <div className="content">
      <div className="page-head">
        <h3><Sparkles size={18} style={{ verticalAlign: -3, marginRight: 6, color: "var(--primary)" }} />ALLBEE AI</h3>
        <span className="spacer" />
        {messages.length > 0 && <button className="btn sm" onClick={() => { setMessages([]); setError(""); }}><RotateCcw size={13} />New chat</button>}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 210px)", minHeight: 420, overflow: "hidden" }}>
        <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 4px" }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 620, margin: "6px auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary-soft)", display: "grid", placeItems: "center" }}><Sparkles size={17} color="var(--primary)" /></div>
                <div style={{ fontWeight: 700 }}>Hi {me?.name || "there"} — how can I help?</div>
              </div>
              <p className="hint-line" style={{ lineHeight: 1.6, marginBottom: 14 }}>
                I can see your clients, leads, quotations, projects and open tasks. Ask me to draft a quotation for a client, write a reply, or summarise what's pending. Try one:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AI_QUICK_PROMPTS.map(([label, prompt]) => (
                  <button key={label} className="btn sm" onClick={() => send(prompt)} style={{ borderRadius: 999 }}>
                    <Sparkles size={13} />{label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={bubbleWrap}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 13px", borderRadius: 14, lineHeight: 1.55, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    background: m.role === "user" ? "var(--primary-soft)" : "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderBottomRightRadius: m.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: m.role === "user" ? 14 : 4,
                  }}>
                    {m.content}
                    {m.role === "assistant" && (
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn sm" onClick={() => copy(m.content, i)} style={{ padding: "3px 8px" }}>
                          {copied === i ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "10px 13px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <RefreshCw size={14} className="spin" /> Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="banner" style={{ margin: "0 12px 8px", background: "var(--neg-soft)" }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={boxRef}
            className="textarea"
            style={{ flex: 1, minHeight: 44, maxHeight: 140, resize: "none" }}
            placeholder="Ask ALLBEE AI to draft a quotation, reply to a client, summarise tasks…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
          />
          <button className="btn primary" onClick={() => send()} disabled={busy || !input.trim()} style={{ height: 44 }}>
            <Send size={16} />Send
          </button>
        </div>
      </div>
      <p className="hint-line" style={{ marginTop: 10, lineHeight: 1.5 }}>
        ALLBEE AI can make mistakes — double-check figures and client details before sending anything out. It reads a read-only snapshot of your workspace and doesn't change any records.
      </p>
    </div>
  );
}

function AISettings({ config, saveAI }) {
  const init = aiConfigOf(config);
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDone(false); };
  const save = async () => { setBusy(true); try { await saveAI(f); setDone(true); } finally { setBusy(false); } };
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
        <Sparkles size={14} color="var(--primary)" /> ALLBEE AI assistant
      </div>
      <p className="hint-line" style={{ lineHeight: 1.6, marginBottom: 14 }}>
        Adds a built-in AI on the <b style={{ color: "var(--ink)" }}>ALLBEE AI</b> screen that staff can ask to draft quotations, reply to clients and summarise work — grounded in your live data.
      </p>

      <label className="perm-item" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        <span>Turn ALLBEE AI on for the team</span>
      </label>

      <Field label="How the app reaches the AI">
        <select className="select" value={f.mode} onChange={(e) => set("mode", e.target.value)}>
          <option value="function">Supabase Edge Function (recommended — key stays on the server)</option>
          <option value="direct">Direct API key (quick start — key is stored in settings)</option>
        </select>
      </Field>

      {f.mode === "function" ? (
        <Field label="Edge Function name" hint="Deploy the ai-chat function (code in the project README) and set its ANTHROPIC_API_KEY secret.">
          <input className="input mono" value={f.functionName} onChange={(e) => set("functionName", e.target.value)} placeholder="ai-chat" />
        </Field>
      ) : (
        <>
          <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 12, background: "var(--neg-soft)" }}>
            <AlertTriangle size={15} /> A direct key is downloaded to every signed-in browser and can be read by staff. Use this only for internal testing — prefer the Edge Function for anything shared.
          </div>
          <Field label="API endpoint">
            <input className="input mono" value={f.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder={AI_DEFAULT_ENDPOINT} />
          </Field>
          <Field label="API key">
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input mono" type={showKey ? "text" : "password"} value={f.apiKey} onChange={(e) => set("apiKey", e.target.value)} placeholder="sk-ant-…" style={{ flex: 1 }} />
              <button className="iconbtn" type="button" title={showKey ? "Hide" : "Show"} onClick={() => setShowKey((s) => !s)} style={{ width: 40 }}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </Field>
        </>
      )}

      <Field label="Model" hint="Set this to a model your API key can use. Change it if you get a model-not-found error.">
        <input className="input mono" value={f.model} onChange={(e) => set("model", e.target.value)} placeholder={AI_DEFAULT_MODEL} />
      </Field>

      <button className="btn primary" onClick={save} disabled={busy}>{busy ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}{done ? "Saved" : "Save AI settings"}</button>
    </div>
  );
}

function Settings({ db, mutate, replaceDB, syncError, currentUser, role, teamCount, sessionEmail, config, saveTnc, saveRoleTnc, saveCompany, saveAI }) {
  const fileRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `allbee-backup-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (d && d.transactions) replaceDB(d); } catch { alert("That file couldn't be read as an ALLBEE backup."); } };
    r.readAsText(file); e.target.value = "";
  };
  const counts = { "Team members": teamCount || 0, Transactions: db.transactions.length, Withdrawals: db.withdrawals.length, Tasks: db.tasks.length, Projects: db.projects.length, Students: db.students.length, "Marketing clients": db.marketing.length, "Leave requests": db.leave.length, "Daily updates": db.updates.length };
  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div className="page-head"><h3>Settings</h3></div>

      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Backup & restore</div>
        <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 14 }}>
          Export a full copy of your database. <b>Excel backup</b> writes one sheet per module — open it in Excel or import it into Google Sheets (File → Import) for a spreadsheet backup. <b>JSON backup</b> is for re-importing here later. Importing JSON replaces the current data.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => exportFullBackupXLSX(db)}><Sheet size={16} />Excel backup (all data)</button>
          <button className="btn" onClick={exportJSON}><Download size={16} />JSON backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} />Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} style={{ display: "none" }} />
        </div>
      </div>

      <TncManager config={config} saveTnc={saveTnc} saveRoleTnc={saveRoleTnc} />

      <CompanySettings config={config} saveCompany={saveCompany} />

      <AISettings config={config} saveAI={saveAI} />


      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Import from Excel / Google Sheets</div>
        <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 14 }}>
          Bring in existing records — income, expenses, withdrawals, projects, students, marketing clients, ideas or tasks — from a spreadsheet. Upload an <b>.xlsx</b> or <b>.csv</b> file (from Google Sheets use <b>File → Download</b>). Imported rows are <b>added</b> to what's already here; they don't replace anything.
        </p>
        <button className="btn primary" onClick={() => setImportOpen(true)}><Sheet size={16} />Import a spreadsheet</button>
      </div>

      <div className="card stat" style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Your data</div>
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="hint-line">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stat">
        <div className="lbl" style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>About this build</div>
        <p className="hint-line" style={{ lineHeight: 1.6, margin: 0 }}>
          Signed in as <b style={{ color: avatarColor(currentUser) }}>{currentUser}</b>{sessionEmail ? ` (${sessionEmail})` : ""} · <b>{ROLE_LABEL[role] || "Staff"}</b>. Records live in a shared Postgres database and sync across the team in real time{syncError ? " — but the last sync failed, so some changes may not have saved yet" : ""}. Share &amp; accounts and Withdrawals are limited to the two partners and an accountant; module access for staff is set per person on the Team screen. All of this is enforced by the database, not just hidden. File attachments and an installable Android version are optional add-ons documented in the project README.
        </p>
      </div>

      {importOpen && <ImportData mutate={mutate} currentUser={currentUser} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function TncManager({ config, saveTnc, saveRoleTnc }) {
  const TARGETS = [["all", "All users (general)"], ["admin", "Admins"], ["accountant", "Accountants"], ["staff", "Staff"], ["intern", "Interns"]];
  const [target, setTarget] = useState("all");
  const roleMap = roleTncOf(config);
  const bodyFor = (t) => t === "all" ? (config?.tnc_body || "") : (roleMap[t]?.body || "");
  const versionFor = (t) => t === "all" ? Number(config?.tnc_version || 0) : Number(roleMap[t]?.version || 0);
  const [body, setBody] = useState(bodyFor("all"));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // load the selected agreement's text when the target or stored config changes
  useEffect(() => { setBody(target === "all" ? (config?.tnc_body || "") : (roleTncOf(config)[target]?.body || "")); setDone(false); }, [target, config?.tnc_body, config?.tnc_roles]);
  const version = versionFor(target);
  const targetLabel = (TARGETS.find((t) => t[0] === target) || ["", ""])[1];
  const publish = async () => {
    setSaving(true); setDone(false);
    try { if (target === "all") await saveTnc(body); else await saveRoleTnc(target, body); setDone(true); }
    catch { /* surfaced via the sync banner */ } finally { setSaving(false); }
  };
  return (
    <div className="card stat" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Terms &amp; conditions</div>
      <p className="hint-line" style={{ lineHeight: 1.55, marginBottom: 12 }}>
        Publish a <b>general</b> agreement everyone signs, plus optional <b>role-specific</b> agreements. On sign-in each person accepts the general terms <i>and</i> the terms for their role. Publishing a change asks the affected people to re-accept before they carry on.
      </p>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <Field label="Agreement"><select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>{TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}><span className="hint-line">{version > 0 ? <>Current: <b style={{ color: "var(--ink)" }}>version {version}</b></> : "Not published yet"}</span></div>
      </div>
      <textarea className="textarea" style={{ minHeight: 150 }} value={body} onChange={(e) => { setBody(e.target.value); setDone(false); }} placeholder={target === "all" ? "Terms every employee accepts…" : `Terms specific to ${targetLabel}…`} />
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" onClick={publish} disabled={saving || !body.trim()}>
          {saving ? <RefreshCw size={16} className="spin" /> : <ScrollText size={16} />}{version > 0 ? "Publish update" : "Publish terms"}
        </button>
        {done && <span className="hint-line" style={{ color: "var(--pos)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Published — affected people re-accept on next sign-in.</span>}
      </div>
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

function Attendance({ db, mutate, me, isAdmin, isSuper, team, openModal }) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(null); // super-admin attendance edit: { p, a }

  // ── Personal attendance — available to EVERYONE, admins included, so a
  // partner/admin can check themselves in and out just like the rest of the team.
  const mineAll = db.attendance.filter((a) => a.userId === me.id);
  const todays = mineAll.filter((a) => a.date === today);
  const openSess = todays.find((a) => !a.checkOut);
  const leaveToday = onApprovedLeave(db, me.id, today);
  const mine = [...mineAll].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  const weekStart = startOfWeek();
  const todayH = sumHours(todays);
  const weekH = sumHours(mineAll.filter((a) => new Date(a.date + "T00:00:00") >= weekStart));
  const monthH = sumHours(mineAll.filter((a) => sameMonth(a.date)));
  const doCheckIn = () => mutate((d) => ({ ...d, attendance: [...d.attendance, { id: uid(), userId: me.id, userName: me.name, date: today, checkIn: new Date().toISOString(), checkOut: null, createdAt: Date.now() }] }), { action: "checked in", module: "Attendance" });
  const doCheckOut = () => { if (!openSess) return; mutate((d) => ({ ...d, attendance: d.attendance.map((a) => a.id === openSess.id ? { ...a, checkOut: new Date().toISOString() } : a) }), { action: "checked out", module: "Attendance" }); };
  const checkIn = () => openModal({ type: "okConfirm", title: "Check in?", body: "Type OK to confirm your check-in.", actionLabel: "Check in", icon: <LogIn size={15} />, onConfirm: () => { haptic(12); doCheckIn(); } });
  const checkOut = () => openModal({ type: "okConfirm", title: "Check out?", body: "Type OK to confirm your check-out.", actionLabel: "Check out", icon: <CheckCircle2 size={15} />, onConfirm: () => { haptic(12); doCheckOut(); } });

  const myCheckInCard = (
    <div className="card stat" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="lbl"><Clock size={14} /> {fmtDate(today)}{isAdmin ? " · You" : ""}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
          {leaveToday ? "You're on approved leave today" : openSess ? `Checked in at ${clockTime(openSess.checkIn)}` : todays.length ? `${todays.length} session${todays.length > 1 ? "s" : ""} · ${todayH.toFixed(1)}h today` : "Not checked in yet"}
        </div>
      </div>
      {!leaveToday && !openSess && <button className="btn primary" onClick={checkIn}><LogIn size={16} />Check in</button>}
      {!leaveToday && openSess && <button className="btn primary" onClick={checkOut}><CheckCircle2 size={16} />Check out</button>}
    </div>
  );

  const myStatsRow = (
    <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", marginBottom: 16 }}>
      <div className="card stat"><div className="lbl"><Clock size={14} /> Today</div><div className="num">{todayH.toFixed(1)}h</div></div>
      <div className="card stat"><div className="lbl"><CalendarDays size={14} /> This week</div><div className="num">{weekH.toFixed(1)}h</div></div>
      <div className="card stat"><div className="lbl"><CalendarDays size={14} /> This month</div><div className="num">{monthH.toFixed(1)}h</div></div>
    </div>
  );

  const myRecentCard = (
    <div className="card">
      <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>My recent attendance</div>
      {mine.length === 0 ? <Empty icon={<UserCheck size={22} color="var(--muted)" />} title="No records yet" text="Check in each day and your history builds up here." /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th className="num-cell">Hours</th></tr></thead>
            <tbody>{mine.map((a) => (
              <tr key={a.id}><td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
                <td className="mono">{clockTime(a.checkIn)}</td><td className="mono">{clockTime(a.checkOut)}</td>
                <td className="num-cell mono">{a.checkOut ? hoursBetween(a.checkIn, a.checkOut)?.toFixed(1) : "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="content">
        <div className="page-head"><h3>Attendance</h3></div>
        {myCheckInCard}
        {myStatsRow}
        {myRecentCard}
      </div>
    );
  }

  // admin roster — only real, active team members (no client portal accounts,
  // no suspended/resigned/terminated people).
  const roster = team
    .filter((p) => p.role !== "client" && p.active !== false)
    .map((p) => ({ p, a: attendanceFor(db, p.id, date), st: attStatus(db, p.id, date) }));
  const present = roster.filter((r) => r.st.label === "Present" || r.st.label === "Checked out").length;
  const onLeave = roster.filter((r) => r.st.label === "On leave").length;
  const absent = roster.filter((r) => r.st.label === "Absent").length;
  // Super-admins can correct or fill in attendance for any member on the chosen
  // date: editing the matching record if there is one, otherwise creating it.
  const saveAttendance = (member, record, checkInISO, checkOutISO) => {
    mutate((d) => record
      ? { ...d, attendance: d.attendance.map((x) => x.id === record.id ? { ...x, checkIn: checkInISO, checkOut: checkOutISO } : x) }
      : { ...d, attendance: [...d.attendance, { id: uid(), userId: member.id, userName: member.name, date, checkIn: checkInISO, checkOut: checkOutISO, createdAt: Date.now() }] },
      { action: `edited ${member.name}'s attendance for ${fmtDate(date)}`, module: "Attendance" });
    setEditing(null);
  };
  // Mark absent: drop every session that member has on the chosen date.
  const clearAttendance = (member) => {
    mutate((d) => ({ ...d, attendance: d.attendance.filter((x) => !(x.userId === member.id && x.date === date)) }),
      { action: `cleared ${member.name}'s attendance for ${fmtDate(date)}`, module: "Attendance" });
    setEditing(null);
  };
  return (
    <div className="content">
      <div className="page-head"><h3>Attendance</h3><span className="spacer" />
        <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} /></div>
      {/* Admins & partners mark their own attendance too */}
      {myCheckInCard}
      <div className="lbl" style={{ margin: "4px 2px 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
        <Users size={14} /> Team · {fmtDate(date)}
      </div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="card stat"><div className="lbl"><UserCheck size={14} /> Present</div><div className="num pos-txt">{present}</div></div>
        <div className="card stat"><div className="lbl"><Plane size={14} /> On leave</div><div className="num">{onLeave}</div></div>
        <div className="card stat"><div className="lbl"><XCircle size={14} /> Absent</div><div className="num neg-txt">{absent}</div></div>
      </div>
      <div className="card">
        {roster.length === 0 ? <Empty icon={<Users size={22} color="var(--muted)" />} title="No team members yet" text="Staff who create accounts will appear here." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Member</th><th>Status</th><th>In</th><th>Out</th><th className="num-cell">Hours</th>{isSuper && <th></th>}</tr></thead>
              <tbody>{roster.map(({ p, a, st }) => (
                <tr key={p.id}>
                  <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(p.name), width: 24, height: 24, fontSize: 10 }}>{p.name[0]}</span>{p.name}</span></td>
                  <td><span className={"badge " + (st.tone === "muted" ? "" : st.tone)} style={st.tone === "muted" ? { background: "var(--surface-2)", color: "var(--muted)" } : undefined}>{st.label}</span></td>
                  <td className="mono">{clockTime(a?.checkIn)}</td><td className="mono">{clockTime(a?.checkOut)}</td>
                  <td className="num-cell mono">{a?.checkOut ? hoursBetween(a.checkIn, a.checkOut)?.toFixed(1) : "—"}</td>
                  {isSuper && <td><div className="row-actions"><button className="btn sm" onClick={() => setEditing({ p, a })}><Pencil size={13} />Edit</button></div></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <AttendanceEditModal member={editing.p} record={editing.a} date={date}
        onClose={() => setEditing(null)}
        onSave={(ci, co) => saveAttendance(editing.p, editing.a, ci, co)}
        onClear={() => clearAttendance(editing.p)} />}
    </div>
  );
}

// Super-admin: set/correct a member's check-in & check-out for one date. Times
// are entered and shown in local time; an empty check-out means still on the clock.
function AttendanceEditModal({ member, record, date, onSave, onClear, onClose }) {
  const toTimeInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const [inT, setInT] = useState(toTimeInput(record?.checkIn) || "09:00");
  const [outT, setOutT] = useState(toTimeInput(record?.checkOut));
  const atTime = (hhmm) => {
    if (!hhmm) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = hhmm.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  };
  const save = () => {
    if (!inT) return;
    const ci = atTime(inT);
    const co = atTime(outT);
    if (co && new Date(co) < new Date(ci)) { alert("Check-out can't be before check-in."); return; }
    onSave(ci, co);
  };
  return (
    <Modal title={`Edit attendance — ${member.name}`} onClose={onClose}
      footer={<>
        {record && <button className="btn danger" style={{ marginRight: "auto" }} onClick={onClear}><Trash2 size={15} />Mark absent</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!inT}><Check size={16} />Save</button>
      </>}>
      <p className="hint-line" style={{ marginBottom: 14, lineHeight: 1.5 }}>Set the check-in and check-out for <b style={{ color: "var(--ink)" }}>{fmtDate(date)}</b>. Leave check-out empty to mark them still checked in.</p>
      <div className="grid2">
        <Field label="Check in" required><input className="input" type="time" value={inT} onChange={(e) => setInT(e.target.value)} /></Field>
        <Field label="Check out"><input className="input" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function LeaveForm({ initial, me, onSave, onClose }) {
  const [f, setF] = useState(() => ({ type: "Casual", fromDate: todayISO(), toDate: todayISO(), reason: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const days = daysBetween(f.fromDate, f.toDate);
  const valid = f.fromDate && f.toDate && f.toDate >= f.fromDate && f.reason.trim().length > 0 && (f.type !== "Other" || (f.customType || "").trim().length > 0);
  const save = () => {
    if (!valid) return;
    onSave({ ...initial, id: initial?.id || uid(), userId: me.id, userName: me.name, type: f.type === "Other" ? ((f.customType || "").trim() || "Other") : f.type, fromDate: f.fromDate, toDate: f.toDate, days, reason: f.reason.trim(), status: initial?.status || "Pending", createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit leave request" : "Request leave"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Submit request</button></>}>
      <Field label="Leave type"><SelectOther value={f.type} onChange={(v) => up("type", v)} options={LEAVE_TYPES.filter((t) => t !== "Other")} placeholder="Other reason…" /></Field>
      {f.type === "Other" && <Field label="Specify type" required><input className="input" value={f.customType || ""} onChange={(e) => up("customType", e.target.value)} placeholder="e.g. Bereavement" /></Field>}
      <div className="grid2">
        <Field label="From" required><input className="input" type="date" value={f.fromDate} onChange={(e) => up("fromDate", e.target.value)} /></Field>
        <Field label="To" required><input className="input" type="date" value={f.toDate} min={f.fromDate} onChange={(e) => up("toDate", e.target.value)} /></Field>
      </div>
      <div className="hint-line" style={{ marginBottom: 12 }}>{days > 0 ? `${days} day${days > 1 ? "s" : ""}` : "Pick valid dates"}{f.toDate < f.fromDate ? " · end date is before start" : ""}</div>
      <Field label="Reason" required><textarea className="textarea" value={f.reason} onChange={(e) => up("reason", e.target.value)} placeholder="Briefly, why you need this leave." /></Field>
    </Modal>
  );
}

function leaveTone(s) { return s === "Approved" ? "pos" : s === "Rejected" ? "neg" : "pri"; }

function Leave({ db, team = [], mutate, me, isAdmin, openModal }) {
  const [filter, setFilter] = useState(isAdmin ? "Pending" : "all");
  const all = [...db.leave].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin
    ? all.filter((l) => filter === "all" ? true : l.status === filter)
    : all.filter((l) => l.userId === me.id);

  const decide = (l, status) => { haptic(/^app/i.test(status) ? 12 : [10, 30, 10]); mutate((d) => ({ ...d, leave: d.leave.map((x) => x.id === l.id ? { ...x, status, decidedBy: me.name, decidedAt: Date.now() } : x) }), { action: `${status.toLowerCase()} ${l.userName}'s ${l.type.toLowerCase()} leave`, module: "Leave" }); };
  const cancel = (l) => mutate((d) => ({ ...d, leave: d.leave.filter((x) => x.id !== l.id) }), null);

  return (
    <div className="content">
      <div className="page-head"><h3>{isAdmin ? "Leave requests" : "My leave"}</h3><span className="spacer" />
        {!isAdmin && <button className="btn primary" onClick={() => openModal({ type: "leave" })}><Plus size={16} />Request leave</button>}</div>
      {isAdmin && <div className="toolbar"><div className="seg">{["Pending", "Approved", "Rejected", "all"].map((k) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : k}</button>)}</div></div>}

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Plane size={22} color="var(--muted)" />} title={isAdmin ? "Nothing to review" : "No leave requests"} text={isAdmin ? "Approved and rejected requests stay here for your records." : "Request time off and track its status here."}
            action={!isAdmin ? <button className="btn primary" onClick={() => openModal({ type: "leave" })}><Plus size={16} />Request leave</button> : undefined} />
        ) : list.map((l) => (
          <div key={l.id} className="item-row">
            <div className="item-main">
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                {isAdmin && <span className="avatar" style={{ background: avatarColor(l.userName), width: 24, height: 24, fontSize: 10 }}>{l.userName[0]}</span>}
                <span className="item-title">{isAdmin ? l.userName + " · " : ""}{l.type} leave</span>
                <span className={"badge " + leaveTone(l.status)}>{l.status}</span>
                <span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{l.days} day{l.days > 1 ? "s" : ""}</span>
              </div>
              <div className="item-meta" style={{ marginTop: 6 }}>
                <span><CalendarDays size={12} style={{ verticalAlign: -2 }} /> {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</span>
                {l.decidedBy && <span>{l.status} by {l.decidedBy}</span>}
              </div>
              {l.reason && <div className="item-meta" style={{ marginTop: 6 }}>{l.reason}</div>}
            </div>
            <div className="row-actions">
              {isAdmin && (() => { const person = team.find((p) => p.id === l.userId); return person ? <ContactButtons person={person} compact message={`Hi ${l.userName || ""}, regarding your ${String(l.type || "").toLowerCase()} leave (${fmtDate(l.fromDate)} to ${fmtDate(l.toDate)}) —`} /> : null; })()}
              {isAdmin && l.status === "Pending" && (
                <>
                  <button className="btn sm primary" onClick={() => decide(l, "Approved")}><Check size={13} />Approve</button>
                  <button className="btn sm" onClick={() => decide(l, "Rejected")} style={{ color: "var(--neg)" }}><XCircle size={13} />Reject</button>
                </>
              )}
              {!isAdmin && l.status === "Pending" && (
                <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => openModal({ type: "confirm", title: "Cancel request?", body: "Withdraw this pending leave request?", confirmLabel: "Cancel request", onConfirm: () => cancel(l) })}><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function PermsModal({ person, onSave, onClose }) {
  const init = Array.isArray(person.perms?.modules) ? person.perms.modules : [];
  const [mods, setMods] = useState(init);
  const toggle = (k) => setMods((m) => m.includes(k) ? m.filter((x) => x !== k) : [...m, k]);
  return (
    <Modal title={`Module access — ${person.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { onSave(mods); onClose(); }}><Check size={15} />Save access</button></>}>
      <p className="hint-line" style={{ lineHeight: 1.55 }}>Tick the business modules {person.name} can open. Their personal screens — tasks, attendance, leave and daily updates — are always available.</p>
      <div className="perm-list">
        {GRANTABLE_MODULES.map(([k, label]) => (
          <label key={k} className="perm-item">
            <input type="checkbox" checked={mods.includes(k)} onChange={() => toggle(k)} />{label}
          </label>
        ))}
      </div>
    </Modal>
  );
}

function Team({ team, me, changeProfile, db, resolveResign }) {
  const [permFor, setPermFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [manageFor, setManageFor] = useState(null);
  const count = (r) => team.filter((p) => p.role === r).length;
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
        <div className="card stat"><div className="lbl"><ShieldCheck size={14} /> Partners</div><div className="num">{count("superadmin")}</div></div>
        <div className="card stat"><div className="lbl"><ShieldCheck size={14} /> Admins</div><div className="num">{count("admin")}</div></div>
        <div className="card stat"><div className="lbl"><Wallet size={14} /> Accountants</div><div className="num">{count("accountant")}</div></div>
        <div className="card stat"><div className="lbl"><Users size={14} /> Staff</div><div className="num">{count("staff")}</div></div>
        <div className="card stat"><div className="lbl"><Users size={14} /> Interns</div><div className="num">{count("intern")}</div></div>
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
                  <tr key={p.id} style={p.active === false ? { opacity: .55 } : undefined}>
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
      {permFor && <PermsModal person={permFor} onClose={() => setPermFor(null)} onSave={(modules) => changeProfile(permFor.id, { perms: { ...(permFor.perms || {}), modules } }, `updated ${permFor.name}'s module access`)} />}
      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {manageFor && <ManageUserModal person={manageFor} onClose={() => setManageFor(null)} />}
    </div>
  );
}

function Blocked({ isDark, name, onSignOut }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
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
      <style>{CSS}</style>
      <div className="lock-card">
        <div className="lock-badge" style={{ background: "var(--surface-2)" }}><ShieldCheck size={28} color="var(--muted)" /></div>
        <h1>Awaiting approval</h1>
        <p>Thanks {name} — your account has been created. A partner needs to approve it before you can get in. You'll have access as soon as they do.</p>
        <button className="btn" style={{ marginTop: 8 }} onClick={onSignOut}><LogOut size={15} />Sign out</button>
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
      <style>{CSS}</style>
      <div className="lock-card gate-card">
        <img className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 52 }} />
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
  const [show, setShow] = useState(false);
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
        <Field label="Current password"><input className="input" type={show ? "text" : "password"} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></Field>
        <div />
      </div>
      <div className="grid2">
        <Field label="New password" hint="At least 6 characters."><input className="input" type={show ? "text" : "password"} value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" placeholder="••••••••" /></Field>
        <Field label="Confirm new password"><input className="input" type={show ? "text" : "password"} value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" placeholder="••••••••" /></Field>
      </div>
      <label className="hint-line" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 2 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
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
      <style>{CSS}</style>
      <div className="lock-card gate-card">
        <img className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 52 }} />
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
  ["tasks", "Tasks", ListTodo, "work"],
  ["attendance", "Attendance", UserCheck, "work"],
  ["leave", "Leave", Plane, "leave"],
  ["updates", "Daily updates", MessageSquare, "work"],
  ["chat", "Team chat", Send, "collab"],
  ["leads", "Leads", UserPlus, "perm:leads"],
  ["clients", "Clients", Building2, "perm:clients"],
  ["quotations", "Quotations", FileText, "perm:quotations"],
  ["invoices", "Invoices", Banknote, "perm:invoices"],
  ["portal-posts", "Client updates", ExternalLink, "perm:portal-posts"],
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
  dashboard: "overview", notifications: "overview", myteam: "overview", assistant: "overview",
  tasks: "work", attendance: "work", leave: "work", updates: "work", progress: "work", chat: "work",
  leads: "sales", clients: "sales", quotations: "sales", invoices: "sales", "portal-posts": "sales", projects: "sales", inhouse: "sales", courses: "sales", "class-students": "sales", marketing: "sales", concepts: "sales", testing: "sales",
  accounts: "finance", withdrawals: "finance", planned: "finance", earnings: "finance", "staff-salary": "finance",
  announcements: "content", documents: "content", knowledge: "content", prompts: "content", sheets: "content", rewards: "content", performance: "content",
  team: "admin", "team-leads": "admin", apn: "admin", vault: "admin", "recently-deleted": "admin", audit: "admin", activity: "admin", settings: "admin",
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
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [apn, setApn] = useState({ mobile: "", dob: "", district: "", taluk: "", city: "", occupation: "", college: "", reason: "", username: "" });
  const upApn = (k, v) => setApn((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr(""); setNotice("");
    if (!email.trim() || !pw) { setErr("Enter your username or email and your password to continue."); return; }
    if (mode === "signup") {
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
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        let loginEmail = email.trim();
        if (!loginEmail.includes("@")) {
          // Username path: resolve the username to its account email so we can
          // sign in. Tries a SQL function first (no edge function needed — just
          // run allbee-username-login.sql once), then falls back to the
          // username-login edge function if that's what's deployed.
          const uname = loginEmail.toLowerCase();
          let resolved = "";
          try {
            const { data, error } = await supabase.rpc("username_to_email", { p_username: uname });
            if (!error && data) resolved = typeof data === "string" ? data : (data.email || "");
          } catch { /* RPC not installed — try the edge function next */ }
          if (!resolved) {
            try {
              const { data, error } = await supabase.functions.invoke("username-login", { body: { username: uname } });
              if (!error && data && data.email) resolved = data.email;
            } catch { /* neither available */ }
          }
          if (!resolved) throw new Error("We couldn't find that username. Check it, or sign in with your email instead.");
          loginEmail = resolved;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: pw });
        if (error) throw error;
      } else {
        const meta = acctType === "owner" ? { name: who, admin_code: code.trim() }
          : acctType === "client" ? { name: name.trim(), role_intent: "client" }
          : acctType === "partner" ? { name: name.trim(), role_intent: "partner", apn: { name: name.trim(), mobile: apn.mobile.trim(), dob: apn.dob, district: apn.district, taluk: apn.taluk.trim(), city: apn.city.trim(), occupation: apn.occupation.trim(), college: apn.college.trim(), reason: apn.reason.trim(), username: apn.username.trim().toLowerCase() } }
          : { name: name.trim() };
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { data: meta } });
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
  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
      <div className="lock-card">
        <img className="lock-logo" src={LOGO_FULL} alt="ALLBEE Solutions" />
        <p>{mode === "signin" ? (entry === "choose" ? "How would you like to sign in?" : (loginAs === "client" ? "Client sign in" : loginAs === "partner" ? "APN partner sign in" : "Employee sign in")) : "Create your account"}</p>

        {mode === "signin" && entry === "choose" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6, width: "100%" }}>
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
                  <div className="field"><label>District</label><select className="select" value={apn.district} onChange={(e) => upApn("district", e.target.value)}><option value="">Select district…</option>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></div>
                  <div className="field"><label>Taluk</label><input className="input" value={apn.taluk} onChange={(e) => upApn("taluk", e.target.value)} placeholder="Taluk" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>City / town</label><input className="input" value={apn.city} onChange={(e) => upApn("city", e.target.value)} placeholder="City" /></div>
                  <div className="field"><label>Occupation</label><input className="input" value={apn.occupation} onChange={(e) => upApn("occupation", e.target.value)} placeholder="Student, freelancer…" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>College (optional)</label><input className="input" value={apn.college} onChange={(e) => upApn("college", e.target.value)} placeholder="College" /></div>
                  <div className="field"><label>Username</label><input className="input" value={apn.username} onChange={(e) => upApn("username", e.target.value)} placeholder="Choose a username" /></div>
                </div>
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
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey} placeholder="••••••••" />
          </div>
        </div>

        {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
        {notice && <div className="auth-msg ok"><Check size={14} /> {notice}</div>}

        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={submit} disabled={busy}>
          {busy ? <RefreshCw size={16} className="spin" /> : mode === "signin" ? <LogIn size={16} /> : <Mail size={16} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button className="linkbtn" onClick={() => { const goSignup = mode === "signin"; setMode(goSignup ? "signup" : "signin"); if (goSignup && loginAs === "partner") setAcctType("partner"); else if (goSignup && loginAs === "client") setAcctType("client"); setEntry("form"); setErr(""); setNotice(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        </>)}

        <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => setDark(!isDark)}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? "Light" : "Dark"} mode
        </button>
      </div>
    </div>
  );
}

function NamePicker({ isDark, onChoose }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
      <div className="lock-card">
        <img className="lock-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 56 }} />
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
function LeadForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", company: "", phone: "", email: "", source: "Referral", referredBy: "", leadOwner: "", service: "Website", stage: "New", value: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.name.trim()) { setErr("Add the lead's name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), name: f.name.trim(), value: Number(f.value) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit lead" : "New lead"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save lead</button></>}>
      <Field label="Name" required error={err}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Person or business" /></Field>
      <div className="grid2">
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email" /></Field>
      </div>
      <div className="grid2">
        <Field label="Source"><SelectOther value={f.source} onChange={(v) => set("source", v)} options={LEAD_SOURCES.filter((s) => s !== "Other")} placeholder="e.g. Ajis, Saranya…" /></Field>
        <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => set("stage", e.target.value)}>{LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Company"><input className="input" value={f.company || ""} onChange={(e) => set("company", e.target.value)} placeholder="Business name" /></Field>
        <Field label="Service interested"><SelectOther value={f.service || "Website"} onChange={(v) => set("service", v)} options={LEAD_SERVICES.filter((x) => x !== "Other")} placeholder="Custom service…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Referred by"><input className="input" value={f.referredBy || ""} onChange={(e) => set("referredBy", e.target.value)} placeholder="Who referred them?" /></Field>
        <Field label="Lead owner"><input className="input" value={f.leadOwner || ""} onChange={(e) => set("leadOwner", e.target.value)} placeholder="Who owns this lead?" /></Field>
      </div>
      <Field label="Estimated value (₹)"><input className="input" type="number" value={f.value} onChange={(e) => set("value", e.target.value)} placeholder="0" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What do they need?" /></Field>
    </Modal>
  );
}

function ClientForm({ initial, onSave, onClose, existing }) {
  const [f, setF] = useState(initial || { name: "", phone: "", email: "", company: "", status: "Prospect", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  // duplicate detection on phone / email (ignore the record being edited)
  const dupe = (existing || []).find((c) => c.id !== f.id && ((f.phone && c.phone && c.phone.replace(/\D/g, "") === f.phone.replace(/\D/g, "")) || (f.email && c.email && c.email.toLowerCase() === f.email.toLowerCase())));
  const save = () => {
    if (!f.name.trim()) { setErr("Add the client's name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), name: f.name.trim(), value: Number(f.value) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit client" : "New client"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save client</button></>}>
      <Field label="Name" required error={err}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Client name" /></Field>
      {dupe && <div className="auth-msg err" style={{ marginTop: -4 }}><AlertTriangle size={14} /> Looks like a duplicate of <b style={{ margin: "0 4px" }}>{dupe.name}</b> — same {dupe.email && f.email && dupe.email.toLowerCase() === f.email.toLowerCase() ? "email" : "phone"}.</div>}
      <div className="grid2">
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email" /></Field>
      </div>
      <div className="grid2">
        <Field label="Company"><input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Business name (optional)" /></Field>
        <Field label="Status"><select className="select" value={f.status || "Prospect"} onChange={(e) => set("status", e.target.value)}>{CLIENT_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      <Field label="Deal value" hint="Contract value for this client. Commission credits the person who added them once the status is Active."><input className="input mono" type="number" min="0" value={f.value ?? ""} onChange={(e) => set("value", e.target.value)} placeholder="0" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering" /></Field>
    </Modal>
  );
}

function QuotationForm({ initial, onSave, onClose, clients, portalClients }) {
  const [f, setF] = useState(initial || { client: "", clientId: "", title: "", status: "Draft", notes: "", items: [{ desc: "", qty: 1, rate: 0 }], pdfUrl: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setItem = (i, k, v) => setF((s) => ({ ...s, items: s.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setF((s) => ({ ...s, items: [...s.items, { desc: "", qty: 1, rate: 0 }] }));
  const delItem = (i) => setF((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }));
  const total = (f.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const [err, setErr] = useState("");
  const pdfRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pickPdf = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, pdfUrl: up.url })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.client.trim()) { setErr("Add a client name."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), client: f.client.trim(), total: round2(total), pdfUrl: (f.pdfUrl || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit quotation" : "New quotation"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save quotation</button></>}>
      <div className="grid2">
        <Field label="Client" required error={err}>
          <input className="input" list="quote-clients" value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Client name" />
          <datalist id="quote-clients">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{QUOTE_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Title"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website + branding" /></Field>
      {portalClients && portalClients.length > 0 && (
        <Field label="Share to portal client" hint="Optional — lets that client see this quote when they sign in.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Don't share</option>
            {portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
          </select>
        </Field>
      )}
      <div className="field">
        <label>Line items</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(f.items || []).map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 90px 32px", gap: 6, alignItems: "center" }}>
              <input className="input" value={it.desc} onChange={(e) => setItem(i, "desc", e.target.value)} placeholder="Description" />
              <input className="input" type="number" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} placeholder="Qty" />
              <input className="input" type="number" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} placeholder="Rate" />
              <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => delItem(i)} disabled={f.items.length === 1}><X size={14} /></button>
            </div>
          ))}
        </div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={addItem}><Plus size={13} />Add line</button>
      </div>
      <div className="calc-box"><div className="calc-row"><span>Total</span><b className="mono">{money(total)}</b></div></div>
      <Field label="Attach PDF" hint="Optional — store a PDF of this quotation (≤50MB).">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={f.pdfUrl || ""} onChange={(e) => set("pdfUrl", e.target.value)} placeholder="https://… or upload →" />
          <button className="btn" type="button" onClick={() => pdfRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
          <input ref={pdfRef} type="file" accept="application/pdf" onChange={pickPdf} style={{ display: "none" }} />
        </div>
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Terms, validity, etc." /></Field>
    </Modal>
  );
}

function PlannedForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", category: "Office Rent", amount: "", recurrence: "Monthly", status: "Planned", nextDue: todayISO(), notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Name this expense."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), amount: Number(f.amount) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit planned expense" : "New planned expense"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <Field label="What is it?" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office rent" /></Field>
      <div className="grid2">
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={EXPENSE_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
        <Field label="Amount (₹)"><input className="input" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid2">
        <Field label="Repeats"><select className="select" value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)}>{EXPENSE_RECURRENCE.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Next due"><input className="input" type="date" value={f.nextDue} onChange={(e) => set("nextDue", e.target.value)} /></Field>
      </div>
      <Field label="Status"><select className="select" value={f.status || "Planned"} onChange={(e) => set("status", e.target.value)}>{PLANNED_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
    </Modal>
  );
}

function VaultForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { service: "", category: "Social", username: "", password: "", url: "", notes: "" });
  const [show, setShow] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.service.trim()) { setErr("Name the service."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), service: f.service.trim() });
  };
  return (
    <Modal title={f.id ? "Edit credential" : "New credential"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Service" required error={err}><input className="input" value={f.service} onChange={(e) => set("service", e.target.value)} placeholder="e.g. Instagram" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={VAULT_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Username / email"><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="login@…" /></Field>
      <Field label="Password">
        <div style={{ display: "flex", gap: 6 }}>
          <input className="input" type={show ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
          <button className="iconbtn" onClick={() => setShow((v) => !v)} type="button" aria-label="Show/hide">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </Field>
      <Field label="Login URL"><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></Field>
      <Field label="Notes" hint="Recovery email, 2FA backup codes, etc."><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function DocForm({ initial, onSave, onClose, team, portalClients }) {
  const [f, setF] = useState(initial || { title: "", category: "Contract", url: "", notes: "", audience: "internal", userIds: [], clientId: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, url: up.url, title: s.title || up.name })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    if (!f.url.trim()) { setErr("Add a link to the file."); return; }
    const norm = { ...f, clientId: f.audience === "client" ? f.clientId : "", userIds: f.audience === "members" ? (f.userIds || []) : [] };
    onSave({ ...norm, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), url: f.url.trim() });
  };
  return (
    <Modal title={f.id ? "Edit document" : "Add document"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. NDA template" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={DOC_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="File or link" required hint="Upload (image ≤10MB, PDF ≤50MB, other ≤25MB) or paste a link.">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://… or upload →" />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
          <input ref={fileRef} type="file" onChange={pick} style={{ display: "none" }} />
        </div>
      </Field>
      <Field label="Who can see this">
        <select className="select" value={f.audience} onChange={(e) => set("audience", e.target.value)}>
          <option value="internal">Everyone (internal team)</option>
          <option value="members">Specific team members</option>
          <option value="client">A portal client</option>
        </select>
      </Field>
      {f.audience === "members" && (
        <Field label="Team members" hint="Only these people (plus admins) can see it.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(team || []).filter((pp) => pp.role !== "client").map((pp) => {
            const on = (f.userIds || []).includes(pp.id);
            return <button type="button" key={pp.id} onClick={() => set("userIds", on ? (f.userIds || []).filter((x) => x !== pp.id) : [...(f.userIds || []), pp.id])} style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid var(--border)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "#fff" : "var(--ink)", cursor: "pointer", fontSize: 12.5 }}>{pp.name}</button>;
          })}</div>
        </Field>
      )}
      {f.audience === "client" && (
        <Field label="Portal client" hint="Shows in that client's portal under Files.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Select a client…</option>
            {(portalClients || []).map((pp) => <option key={pp.id} value={pp.id}>{pp.name} ({pp.email})</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

function KbForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", category: "How-to", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim() });
  };
  return (
    <Modal title={f.id ? "Edit article" : "New article"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. How to onboard a client" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={KB_CATEGORIES.filter((c) => c !== "Other")} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Content"><textarea className="textarea" style={{ minHeight: 180 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write the guide…" /></Field>
    </Modal>
  );
}

// Shared prompt library — a place to keep the prompts the team reuses and copy
// them in one tap. Backed by the `prompts` table (run allbee-prompts.sql once).
function PromptForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", category: "General", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a title."); return; }
    if (!(f.body || "").trim()) { setErr("Add the prompt text."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim() });
  };
  return (
    <Modal title={f.id ? "Edit prompt" : "New prompt"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Cold outreach email" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={PROMPT_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Prompt" required><textarea className="textarea" style={{ minHeight: 200 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Paste or write the full prompt here…" /></Field>
    </Modal>
  );
}

function Prompts({ db, openModal, removeItem }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const all = [...(db.prompts || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean)));
  const list = all.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || (p.title + " " + (p.body || "") + " " + (p.category || "")).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.body || ""); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); } catch { alert("Couldn't copy — your browser blocked clipboard access."); } };
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
function SheetForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", url: "", category: "General", note: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a name."); return; }
    const url = f.url.trim();
    if (!/^https?:\/\//i.test(url)) { setErr("Add a valid link starting with http(s)://"); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), url });
  };
  return (
    <Modal title={f.id ? "Edit sheet link" : "Add a sheet link"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save</button></>}>
      <div className="grid2">
        <Field label="Name" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 2026 Expense tracker" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => set("category", v)} options={SHEET_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <Field label="Link" required hint="Paste the Google Sheets (or any spreadsheet) URL."><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" /></Field>
      <Field label="Note"><textarea className="textarea" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="What's in this sheet? (optional)" /></Field>
    </Modal>
  );
}

function Sheets({ db, openModal, removeItem }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const all = [...(db.sheets || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cats = Array.from(new Set(all.map((p) => p.category).filter(Boolean)));
  const list = all.filter((p) => (cat === "all" || p.category === cat) && (!q.trim() || (p.title + " " + (p.note || "") + " " + (p.category || "")).toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.url || ""); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); } catch { alert("Couldn't copy the link."); } };
  const del = (p) => removeItem("sheets", p, { name: p.title, audit: `deleted sheet link "${p.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Sheets</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "sheet" })}><Plus size={16} />Add link</button></div>
      <p className="hint-line" style={{ marginTop: -8, marginBottom: 14 }}>Keep all your Google Sheets links in one place — trackers, reports, old workbooks. Open or copy any of them in one tap.</p>
      <div className="filterbar">
        <Field label="Search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sheets…" /></Field>
        {cats.length > 0 && <Field label="Category"><select className="select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={<Sheet size={22} color="var(--muted)" />} title="No sheet links yet" text="Paste your Google Sheets links here so the whole team can find them." action={<button className="btn primary" onClick={() => openModal({ type: "sheet" })}><Plus size={16} />Add link</button>} /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{list.map((p) => (
          <div key={p.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sheet size={16} color="var(--pos)" style={{ flex: "none" }} />
              <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              {p.category && <span className="tag">{p.category}</span>}
            </div>
            {p.note && <div className="hint-line" style={{ fontSize: 13, lineHeight: 1.5 }}>{p.note}</div>}
            <div className="hint-line" style={{ fontSize: 12, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.url}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button className="btn sm primary" onClick={() => window.open(p.url, "_blank", "noopener")}><ExternalLink size={13} />Open</button>
              <button className="btn sm" onClick={() => copy(p)}>{copiedId === p.id ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}</button>
              <button className="btn sm" onClick={() => openModal({ type: "sheet", initial: p })}><Pencil size={13} /></button>
              <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete sheet link?", body: `Delete "${p.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(p) })}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

// A <select> whose last entry is "Other…", which reveals a text box so you can
// type a custom value. Drop-in for any preset dropdown that should also accept
// free text. `value` is the current string; `options` are the presets.
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

function RewardForm({ initial, onSave, onClose, team }) {
  const staff = (team || []).filter((p) => ["staff", "intern", "admin", "accountant"].includes(p.role));
  const [f, setF] = useState(initial || { userId: staff[0]?.id || "", kind: "Star performer", points: 10, note: "", date: todayISO() });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.userId) { setErr("Pick a team member."); return; }
    const person = staff.find((p) => p.id === f.userId);
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), userName: person?.name || "", points: Number(f.points) || 0 });
  };
  return (
    <Modal title={f.id ? "Edit recognition" : "Give recognition"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Award size={15} />Award</button></>}>
      <Field label="To" required error={err}>
        <select className="select" value={f.userId} onChange={(e) => set("userId", e.target.value)}>
          {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="For"><SelectOther value={f.kind} onChange={(v) => set("kind", v)} options={REWARD_KINDS} placeholder="Custom recognition…" /></Field>
        <Field label="Points"><input className="input" type="number" value={f.points} onChange={(e) => set("points", e.target.value)} /></Field>
      </div>
      <Field label="Note"><textarea className="textarea" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="What did they do well?" /></Field>
    </Modal>
  );
}

function PortalPostForm({ initial, onSave, onClose, portalClients }) {
  const [f, setF] = useState(initial || { clientId: portalClients?.[0]?.id || "", title: "", body: "", status: "In progress", kind: "update", fileUrl: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr("");
    try { const up = await uploadAttachment(file); setF((s) => ({ ...s, fileUrl: up.url, title: s.title || up.name })); }
    catch (er) { setErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const save = () => {
    if (!f.clientId) { setErr("Pick a client."); return; }
    if (!f.title.trim()) { setErr("Add a heading."); return; }
    const person = (portalClients || []).find((p) => p.id === f.clientId);
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), clientName: person?.name || "", title: f.title.trim(), meetingLink: (f.meetingLink || "").trim(), fileUrl: (f.fileUrl || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit update" : "Post a client update"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Send size={15} />Post</button></>}>
      {(!portalClients || portalClients.length === 0)
        ? <p className="hint-line">No client portal accounts yet. A client creates one from the login screen (choose <b>Client</b>), then they'll appear here.</p>
        : <>
          <Field label="Client" required error={err}>
            <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>{portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}</select>
          </Field>
          <div className="grid2">
            <Field label="Type"><select className="select" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="update">Project update</option><option value="deliverable">Deliverable</option></select></Field>
            <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{["Not started", "In progress", "Review", "Completed", "On hold"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <Field label="Heading"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={f.kind === "deliverable" ? "e.g. Final logo pack" : "e.g. Homepage design ready"} /></Field>
          <Field label="Message"><textarea className="textarea" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="What's the latest for this client?" /></Field>
          {f.kind === "deliverable" && (
            <Field label="Deliverable file or link" hint="Upload the file or paste a link — the client gets a Download button.">
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" value={f.fileUrl || ""} onChange={(e) => set("fileUrl", e.target.value)} placeholder="https://… or upload →" />
                <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}Upload</button>
                <input ref={fileRef} type="file" onChange={pick} style={{ display: "none" }} />
              </div>
            </Field>
          )}
          <Field label="Meeting link (optional)" hint="Paste a Google Meet / Zoom / Teams link — the client gets a Join button in their portal."><input className="input" value={f.meetingLink || ""} onChange={(e) => set("meetingLink", e.target.value)} placeholder="https://meet.google.com/…" /></Field>
        </>}
    </Modal>
  );
}

function AnnouncementForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", body: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) { setErr("Add a headline."); return; }
    onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), meetingLink: (f.meetingLink || "").trim() });
  };
  return (
    <Modal title={f.id ? "Edit announcement" : "New announcement"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><MegaphoneIcon size={15} />Post</button></>}>
      <Field label="Headline" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office closed on Friday" /></Field>
      <Field label="Details"><textarea className="textarea" style={{ minHeight: 120 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="The full message…" /></Field>
      <Field label="Meeting link (optional)" hint="Paste a Google Meet / Zoom / Teams link — everyone gets a Join button."><input className="input" value={f.meetingLink || ""} onChange={(e) => set("meetingLink", e.target.value)} placeholder="https://meet.google.com/…" /></Field>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PHASE 2–6 — SCREENS
══════════════════════════════════════════════════════════════════════ */
function LoadMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  return <div style={{ textAlign: "center", padding: "14px 0" }}><button className="btn" onClick={onMore}>Show more ({total - shown} more)</button></div>;
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

function Clients({ db, mutate, openModal, removeItem, isAdmin = true, me, portalClients = [], deleteClientAccount }) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(25);
  const all = [...db.clients].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const scoped = isAdmin ? all : all.filter((c) => c.ownerId === (me && me.id));
  const list = q.trim() ? scoped.filter((c) => (c.name + " " + (c.company || "") + " " + (c.phone || "") + " " + (c.email || "")).toLowerCase().includes(q.toLowerCase())) : scoped;
  const del = (c) => removeItem("clients", c, { name: c.name, audit: `removed client "${c.name}"` });
  const quote = (c) => openModal({ type: "quotation", initial: { client: c.name } });
  // Registered clients = people who signed up themselves from the login screen
  // (choose "Client"). Newest first.
  const registered = [...portalClients].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const removeAccount = (p) => openModal({
    type: "deleteConfirm", title: "Delete client account?",
    body: `Permanently remove ${p.name}'s portal account?`,
    note: "They're removed from the team and can't sign back in. This can't be undone here.",
    onConfirm: () => deleteClientAccount && deleteClientAccount(p),
  });
  return (
    <div className="content">
      <div className="page-head"><h3>Clients</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "client" })}><Plus size={16} />New client</button></div>
      <div className="toolbar"><div className="search"><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => { setQ(e.target.value); setN(25); }} placeholder="Search clients…" /></div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<Building2 size={22} color="var(--muted)" />} title={q ? "No matches" : "No clients yet"} text="Win a lead or add a client directly, then send them quotations." action={!q && <button className="btn primary" onClick={() => openModal({ type: "client" })}><Plus size={16} />New client</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Client</th><th>Contact</th><th>Added</th><th></th></tr></thead>
            <tbody>{list.slice(0, n).map((c) => (
              <tr key={c.id}>
                <td><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{c.name}{c.status && <span className={"badge " + (c.status === "Blacklisted" ? "neg" : c.status === "Active" ? "pos" : c.status === "Inactive" ? "" : "pri")} style={{ fontSize: 10 }}>{c.status}</span>}</div>{c.company && <div className="hint-line" style={{ fontSize: 11 }}>{c.company}</div>}</td>
                <td>{c.phone && <div style={{ fontSize: 13 }}>{c.phone}</div>}{c.email && <div className="hint-line" style={{ fontSize: 11 }}>{c.email}</div>}{!c.phone && !c.email && "—"}</td>
                <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{c.createdAt ? fmtDate(new Date(c.createdAt).toISOString().slice(0, 10)) : "—"}</td>
                <td><div className="row-actions">
                  <button className="btn sm" onClick={() => quote(c)}><FileText size={13} />Quote</button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "client", initial: c })}><Pencil size={14} /></button>
                  <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Remove client?", body: `Remove ${c.name}?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(c) })}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
        <LoadMore shown={Math.min(n, list.length)} total={list.length} onMore={() => setN((x) => x + 25)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <ExternalLink size={15} /> Registered clients
          {registered.length > 0 && <span className="badge" style={{ marginLeft: 2 }}>{registered.length}</span>}
        </div>
        {registered.length === 0
          ? <Empty icon={<ExternalLink size={22} color="var(--muted)" />} title="No registered clients yet" text="When someone signs up from the login screen and chooses “Client”, their account shows up here." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Client</th><th>Contact</th><th>Joined</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>{registered.map((p) => (
              <tr key={p.id}>
                <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(p.name), width: 24, height: 24, fontSize: 10 }}>{(p.name || "?")[0]}</span>{p.name}</span></td>
                <td>{p.email && <div style={{ fontSize: 13 }}>{p.email}</div>}{p.mobile && <div className="hint-line" style={{ fontSize: 11 }}>{p.mobile}</div>}{!p.email && !p.mobile && "—"}</td>
                <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{p.created_at ? fmtDate(p.created_at) : "—"}</td>
                <td>{p.approved === false
                  ? <span className="badge pri" style={{ fontSize: 10 }}>Pending approval</span>
                  : <span className={"badge " + (p.active === false ? "neg" : "pos")} style={{ fontSize: 10 }}>{p.active === false ? "Inactive" : "Active"}</span>}</td>
                {isAdmin && <td><div className="row-actions">
                  <button className="iconbtn" style={{ width: 30, height: 30 }} title="Delete client account" onClick={() => removeAccount(p)}><Trash2 size={14} /></button>
                </div></td>}
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}

function Quotations({ db, mutate, openModal, removeItem, me, currentUser, isAdmin }) {
  const [status, setStatus] = useState("All");
  const all = [...db.quotations].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = status === "All" ? all : all.filter((qt) => qt.status === status);
  const setQuoteStatus = (qt, s) => {
    const makeProject = s === "Accepted" && !db.projects.some((pr) => pr.quoteId === qt.id);
    mutate((d) => {
      const projects = makeProject
        ? [...d.projects, { id: uid(), name: qt.title || qt.client, client: qt.client, type: "From quotation", stage: "In progress", priority: "Medium", cost: qt.total || 0, quoteId: qt.id, approvalStatus: isAdmin ? "approved" : "pending", createdById: me?.id, ownerName: currentUser, createdAt: Date.now() }]
        : d.projects;
      return { ...d, quotations: d.quotations.map((x) => x.id === qt.id ? { ...x, status: s } : x), projects };
    }, { action: `marked quote for ${qt.client} ${s}${makeProject ? " — created a project" : ""}`, module: "Quotations" });
  };
  const del = (qt) => removeItem("quotations", qt, { name: qt.client, audit: `deleted quotation for ${qt.client}` });
  const tone = (s) => s === "Accepted" ? "pos" : s === "Rejected" ? "neg" : s === "Sent" ? "pri" : "";
  return (
    <div className="content">
      <div className="page-head"><h3>Quotations</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "quotation" })}><Plus size={16} />New quotation</button></div>
      <div className="toolbar"><div className="seg">{["All", ...QUOTE_STATUS].map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div></div>
      {(() => { const decided = all.filter((q) => q.status === "Accepted" || q.status === "Rejected").length; const accepted = all.filter((q) => q.status === "Accepted").length; const rate = decided ? Math.round((accepted / decided) * 100) : 0; return <div className="hint-line" style={{ marginTop: -2, marginBottom: 10 }}>Conversion rate: <b style={{ color: "var(--ink)" }}>{rate}%</b> · {accepted} accepted of {decided} decided · {all.length} total</div>; })()}
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<FileText size={22} color="var(--muted)" />} title="No quotations" text="Build a quote with line items and a running total, then mark it Sent." action={<button className="btn primary" onClick={() => openModal({ type: "quotation" })}><Plus size={16} />New quotation</button>} /></div>
          : list.map((qt) => (
            <div key={qt.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{qt.client}</div><div className="sub">{qt.title || "Quotation"}</div></div>
                <div className="mono" style={{ fontWeight: 700 }}>{money(qt.total)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className={"badge " + tone(qt.status)}>{qt.status}</span>
                {(qt.items || []).length > 0 && <span className="hint-line" style={{ fontSize: 12 }}>{qt.items.length} item{qt.items.length > 1 ? "s" : ""}</span>}
                {qt.clientId && <span className="badge accent">Shared</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                <select className="select" style={{ width: "auto", padding: "5px 8px" }} value={qt.status} onChange={(e) => setQuoteStatus(qt, e.target.value)}>{QUOTE_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                {qt.pdfUrl && <a className="btn sm" href={qt.pdfUrl} target="_blank" rel="noreferrer"><FileText size={13} />PDF</a>}
                <button className="btn sm" onClick={() => openModal({ type: "quotation", initial: qt })}><Pencil size={13} /></button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete quotation?", body: `Delete the quote for ${qt.client}?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(qt) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
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

function Vault({ db, mutate, openModal, removeItem }) {
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState({});
  const all = [...db.vault].sort((a, b) => (a.service || "").localeCompare(b.service || ""));
  const list = q.trim() ? all.filter((v) => (v.service + " " + (v.category || "") + " " + (v.username || "")).toLowerCase().includes(q.toLowerCase())) : all;
  const del = (v) => removeItem("vault", v, { name: v.service, audit: `deleted credential "${v.service}"` });
  const logVault = (action) => mutate((d) => d, { action, module: "Passwords" });
  const copy = (t, v, what) => { try { navigator.clipboard?.writeText(t || ""); logVault(`copied ${what} for "${v.service}"`); } catch { /* clipboard may be blocked */ } };
  const toggleReveal = (v) => setReveal((r) => { const now = !r[v.id]; if (now) logVault(`viewed password for "${v.service}"`); return { ...r, [v.id]: now }; });
  return (
    <div className="content">
      <div className="page-head"><h3>Passwords</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "vault" })}><Plus size={16} />New credential</button></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0 }}><LockIcon size={15} /> Visible to partners only. Stored in your database with row-level security.</div>
      <div className="toolbar" style={{ marginTop: 14 }}><div className="search"><Search size={16} color="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logins…" /></div></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<KeyRound size={22} color="var(--muted)" />} title={q ? "No matches" : "No logins saved"} text="Keep shared business logins — social, hosting, email, domains — in one safe place." action={!q && <button className="btn primary" onClick={() => openModal({ type: "vault" })}><Plus size={16} />New credential</button>} /></div>
          : list.map((v) => (
            <div key={v.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{v.service}</div><div className="sub">{v.category}</div></div>
                <span className="tag">{v.category}</span>
              </div>
              {v.username && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}><span className="hint-line" style={{ minWidth: 64 }}>User</span><span className="mono" style={{ flex: 1, wordBreak: "break-all" }}>{v.username}</span><button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => copy(v.username, v, "username")}><Copy size={13} /></button></div>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}><span className="hint-line" style={{ minWidth: 64 }}>Pass</span><span className="mono" style={{ flex: 1 }}>{reveal[v.id] ? v.password : "••••••••"}</span>
                <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => toggleReveal(v)}>{reveal[v.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => copy(v.password, v, "password")}><Copy size={13} /></button>
              </div>
              {v.url && <a className="hint-line" href={v.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><ExternalLink size={12} />Open login</a>}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn sm" onClick={() => openModal({ type: "vault", initial: v })}><Pencil size={13} />Edit</button>
                <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete credential?", body: `Delete "${v.service}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(v) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
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

function Documents({ db, mutate, openModal, removeItem, isAdmin, me }) {
  const [cat, setCat] = useState("All");
  const all = [...db.documents].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canSee = (d) => {
    if (isAdmin || d.ownerId === me?.id) return true;
    const aud = d.audience || "internal";
    if (aud === "internal") return true;
    if (aud === "members") return (d.userIds || []).includes(me?.id);
    return false; // client-targeted documents appear in the client portal, not the internal list
  };
  const visibleDocs = all.filter(canSee);
  const list = cat === "All" ? visibleDocs : visibleDocs.filter((d) => d.category === cat);
  const audLabel = (d) => { const a = d.audience || "internal"; return a === "client" ? "Client" : a === "members" ? `${(d.userIds || []).length} member${(d.userIds || []).length === 1 ? "" : "s"}` : null; };
  const del = (d) => removeItem("documents", d, { name: d.title, audit: `deleted document "${d.title}"` });
  const canManage = (d) => isAdmin || d.ownerId === me?.id;
  return (
    <div className="content">
      <div className="page-head"><h3>Documents</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "document" })}><Plus size={16} />Add document</button></div>
      <div className="toolbar"><div className="seg">{["All", ...DOC_CATEGORIES].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<FileText size={22} color="var(--muted)" />} title="No documents" text="Keep shared contracts, templates and brand files (as links) in one place." action={<button className="btn primary" onClick={() => openModal({ type: "document" })}><Plus size={16} />Add document</button>} />
          : list.map((d) => (
            <div key={d.id} className="item-row">
              <div className="empty" style={{ padding: 0 }}><div className="ic" style={{ width: 40, height: 40, margin: 0 }}><FileText size={18} color="var(--muted)" /></div></div>
              <div className="item-main">
                <div className="item-title"><a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)", textDecoration: "none" }}>{d.title}</a></div>
                <div className="item-meta"><span className="tag">{d.category}</span>{audLabel(d) && <span className="badge accent" style={{ fontSize: 10.5 }}>{audLabel(d)}</span>}{d.owner && <span>by {d.owner}</span>}{d.notes && <span>{d.notes}</span>}<span>{fmtDate(new Date(d.createdAt).toISOString().slice(0, 10))}</span></div>
              </div>
              <div className="row-actions" style={{ alignItems: "center" }}>
                <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open</a>
                {canManage(d) && <><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "document", initial: d })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete document?", body: `Delete "${d.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(d) })}><Trash2 size={14} /></button></>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Knowledge({ db, mutate, openModal, removeItem, isAdmin }) {
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState("All");
  const all = [...db.knowledge].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = cat === "All" ? all : all.filter((k) => k.category === cat);
  const del = (k) => removeItem("knowledge", k, { name: k.title, audit: `deleted article "${k.title}"` });
  // PRD: knowledge can be shared through Notifications / Tasks. Each opens the
  // matching composer pre-filled, so the admin still picks audience / assignee.
  const shareKb = (k, how) => {
    const excerpt = (k.body || "").slice(0, 600);
    if (how === "notify") openModal({ type: "notification", initial: { title: "📚 " + k.title, body: excerpt + ((k.body || "").length > 600 ? "…" : ""), level: "General", audience: "all" } });
    else openModal({ type: "task", initial: { title: "Read: " + k.title, desc: k.body || "" } });
  };
  const article = open ? db.knowledge.find((k) => k.id === open) : null;
  if (article) return (
    <div className="content">
      <button className="backlink" onClick={() => setOpen(null)}><ArrowLeft size={15} />Back to knowledge base</button>
      <div className="detail-head"><div><h3>{article.title}</h3><div className="item-meta" style={{ marginTop: 6 }}><span className="tag">{article.category}</span><span>{fmtDate(new Date(article.createdAt).toISOString().slice(0, 10))}</span></div></div>
        {isAdmin && <div className="row-actions"><button className="btn sm" onClick={() => shareKb(article, "notify")}><Bell size={13} />Share as notification</button><button className="btn sm" onClick={() => shareKb(article, "task")}><ListTodo size={13} />Make a task</button></div>}
      </div>
      <div className="card stat" style={{ lineHeight: 1.65, whiteSpace: "pre-wrap", fontSize: 14.5 }}>{article.body || "No content yet."}</div>
    </div>
  );
  return (
    <div className="content">
      <div className="page-head"><h3>Knowledge base</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "knowledge" })}><Plus size={16} />New article</button>}</div>
      <div className="toolbar"><div className="seg">{["All", ...KB_CATEGORIES].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div></div>
      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {list.length === 0 ? <div className="card" style={{ gridColumn: "1/-1" }}><Empty icon={<BookOpen size={22} color="var(--muted)" />} title="No articles yet" text={isAdmin ? "Write down how-tos, policies and onboarding guides for the team." : "Guides from your team will show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "knowledge" })}><Plus size={16} />New article</button>} /></div>
          : list.map((k) => (
            <div key={k.id} className="card stat" style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }} onClick={() => setOpen(k.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={16} color="var(--primary)" /><span className="tag">{k.category}</span></div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{k.title}</div>
              <div className="sub" style={{ lineHeight: 1.5 }}>{(k.body || "").slice(0, 110)}{(k.body || "").length > 110 ? "…" : ""}</div>
              {isAdmin && <div style={{ display: "flex", gap: 6, marginTop: 2 }} onClick={(e) => e.stopPropagation()}><button className="btn sm" title="Share with the team as a notification" onClick={() => shareKb(k, "notify")}><Bell size={13} />Share</button><button className="btn sm" onClick={() => openModal({ type: "knowledge", initial: k })}><Pencil size={13} /></button><button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete article?", body: `Delete "${k.title}"?`, note: "Moves to Recently deleted.", onConfirm: () => del(k) })}><Trash2 size={13} /></button></div>}
            </div>
          ))}
      </div>
    </div>
  );
}

function Chat({ db, mutate, me, team, onRefresh, isAdmin }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
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
    catch (er) { alert(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const onlineCount = (team || []).filter((p) => p.id !== me.id && isOnline(p)).length;
  const startEdit = (m) => { setEditId(m.id); setEditText(m.text); };
  const saveEdit = (m) => { const t = editText.trim(); if (!t) { setEditId(null); return; } mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === m.id ? { ...x, text: t, editedAt: Date.now() } : x) }), null); setEditId(null); setEditText(""); };
  // Delete = tombstone (keeps message order, works under existing chat RLS).
  // Admins can delete anyone's; everyone else only their own.
  const del = (m) => { const whose = m.userId === me.id ? "your message" : `${m.userName}'s message`; if (!window.confirm(`Delete ${whose} for everyone?`)) return; mutate((d) => ({ ...d, chat: d.chat.map((x) => x.id === m.id ? { ...x, deleted: true, text: "", attachment: null, deletedBy: me.name } : x) }), null); };
  // Names of teammates who've seen one of my messages.
  const seenNames = (m) => (m.seenBy || []).filter((u) => u !== me.id).map((u) => ((team || []).find((p) => p.id === u)?.name) || "Someone").filter(Boolean);
  return (
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

function ResignForm({ existing, onSave, onClose }) {
  const mine = (existing || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState("");
  const pending = mine && mine.status === "Pending";
  const approved = mine && mine.status === "Approved";
  const submit = () => { if (!reason.trim()) return; onSave({ reason: reason.trim(), lastDay: lastDay || null }); };
  return (
    <Modal title="Resignation" onClose={onClose}
      footer={(pending || approved)
        ? <button className="btn" onClick={onClose}>Close</button>
        : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}><Check size={15} />Submit request</button></>}>
      {approved ? <p className="hint-line">Your resignation has been approved. Thank you for your time with the team.</p>
        : pending ? <p className="hint-line">Your resignation request was submitted{mine.lastDay ? ` with a proposed last working day of ${fmtDate(mine.lastDay)}` : ""} and is pending review by an admin.</p>
        : <>
          <p className="hint-line" style={{ marginBottom: 10 }}>This notifies your admins. They'll confirm your last working day and offboard your access.</p>
          <Field label="Reason" required><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly, why are you resigning?" /></Field>
          <Field label="Proposed last working day"><input className="input" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} min={todayISO()} /></Field>
        </>}
    </Modal>
  );
}

/* ── Client portal: a separate, read-only surface for external clients ──── */
function ClientPortal({ db, profile, signOut, isDark, config }) {
  const myId = profile?.id;
  const co = companyOf(config);
  const posts = [...db.portal_posts].filter((p) => p.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const updates = posts.filter((p) => (p.kind || "update") !== "deliverable");
  const deliverables = posts.filter((p) => (p.kind || "update") === "deliverable");
  const files = [...db.documents].filter((d) => d.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const quotes = [...db.quotations].filter((q) => q.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const invoices = [...db.invoices].filter((iv) => iv.clientId === myId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const statusTone = (s) => s === "Completed" ? "pos" : s === "On hold" ? "neg" : s === "Review" ? "accent" : "pri";
  return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ minHeight: "100vh" }}>
      <style>{CSS}</style>
      <header className="topbar" style={{ position: "sticky", top: 0 }}>
        <img className="brand-logo" src={co.logoUrl || LOGO_ICON} alt={co.name || "ALLBEE"} style={{ height: 30 }} />
        <div><h2 style={{ fontSize: 16 }}>{co.name || "ALLBEE Solutions"}</h2><div className="topbar-sub">Client portal</div></div>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="userchip" onClick={signOut} style={{ cursor: "pointer" }}><Avatar name={profile?.name || "C"} url={profile?.photo_url} size={26} /><span className="userchip-name">{profile?.name}</span><LogOut size={15} /></div>
      </header>
      <div className="content" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div className="page-head"><h3>Welcome, {profile?.name?.split(" ")[0] || "there"}</h3></div>

        <div className="card stat" style={{ marginBottom: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your project updates</div>
          {updates.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No updates yet. We'll post progress here as we go.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>{updates.map((p) => (
              <div key={p.id} style={{ borderLeft: "3px solid var(--primary)", paddingLeft: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontWeight: 700 }}>{p.title}</span><span className={"badge " + statusTone(p.status)}>{p.status}</span></div>
                {p.body && <div style={{ marginTop: 5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{p.body}</div>}
                {p.meetingLink && <div style={{ marginTop: 8 }}><a className="btn sm primary" href={p.meetingLink} target="_blank" rel="noreferrer"><Link2 size={13} />Join meeting</a></div>}
                <div className="hint-line" style={{ fontSize: 11.5, marginTop: 5 }}>{fmtDateTime(p.createdAt)}</div>
              </div>
            ))}</div>}
        </div>

        <div className="card stat">
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your quotations</div>
          {quotes.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No quotations shared with you yet.</p>
            : <div style={{ overflowX: "auto", marginTop: 10 }}><table className="tbl">
              <thead><tr><th>Quotation</th><th>Status</th><th className="num-cell">Total</th></tr></thead>
              <tbody>{quotes.map((q) => (
                <tr key={q.id}><td><div style={{ fontWeight: 600 }}>{q.title || "Quotation"}</div><div className="hint-line" style={{ fontSize: 11 }}>{(q.items || []).length} item{(q.items || []).length === 1 ? "" : "s"}{q.pdfUrl && <> · <a href={q.pdfUrl} target="_blank" rel="noreferrer">PDF</a></>}</div></td>
                  <td><span className={"badge " + (q.status === "Accepted" ? "pos" : q.status === "Rejected" ? "neg" : "pri")}>{q.status}</span></td>
                  <td className="num-cell mono">{money(q.total)}</td></tr>
              ))}</tbody>
            </table></div>}
          <p className="hint-line" style={{ marginTop: 12 }}>Questions about a quote? Reply to the email from your ALLBEE contact.</p>
        </div>

        <div className="card stat" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your invoices</div>
          {invoices.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No invoices yet.</p>
            : <div style={{ overflowX: "auto", marginTop: 10 }}><table className="tbl">
              <thead><tr><th>Invoice</th><th>Payment</th><th>Due</th><th className="num-cell">Amount</th></tr></thead>
              <tbody>{invoices.map((iv) => (
                <tr key={iv.id}><td><div style={{ fontWeight: 600 }}>{iv.number || "Invoice"}</div><div className="hint-line" style={{ fontSize: 11 }}>{iv.title || ""}</div></td>
                  <td><span className={"badge " + (iv.status === "Paid" ? "pos" : iv.status === "Overdue" ? "neg" : "pri")}>{iv.status === "Paid" ? "Paid" : iv.status === "Overdue" ? "Overdue" : "Due"}</span></td>
                  <td className="mono">{iv.dueDate ? fmtDate(iv.dueDate) : "—"}</td>
                  <td className="num-cell mono">{money(iv.amount)}</td></tr>
              ))}</tbody>
            </table></div>}
        </div>

        <div className="card stat" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Deliverables</div>
          {deliverables.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No deliverables shared yet.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>{deliverables.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 700 }}>{p.title}</div>{p.body && <div className="hint-line" style={{ fontSize: 12.5, marginTop: 2 }}>{p.body}</div>}</div>
                <span className={"badge " + statusTone(p.status)}>{p.status}</span>
                {p.fileUrl && <a className="btn sm primary" href={p.fileUrl} target="_blank" rel="noreferrer"><Download size={13} />Download</a>}
              </div>
            ))}</div>}
        </div>

        <div className="card stat" style={{ marginTop: 16 }}>
          <div className="lbl" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Files</div>
          {files.length === 0 ? <p className="hint-line" style={{ margin: "8px 0 0" }}>No files shared yet.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>{files.map((d) => (
              <div key={d.id} className="item-row" style={{ padding: "10px 0" }}>
                <div className="item-main"><div className="item-title" style={{ fontSize: 14 }}>{d.title}</div><div className="item-meta"><span className="tag">{d.category}</span><span>{fmtDate(new Date(d.createdAt).toISOString().slice(0, 10))}</span></div></div>
                <a className="btn sm" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open</a>
              </div>
            ))}</div>}
        </div>

        {(co.name || co.address || co.email || co.phone || co.website) && (
          <div className="hint-line" style={{ marginTop: 20, textAlign: "center", lineHeight: 1.6 }}>
            {co.name && <div style={{ fontWeight: 700, color: "var(--ink)" }}>{co.name}</div>}
            {co.address && <div>{co.address}</div>}
            {[co.phone, co.email, co.website].filter(Boolean).length > 0 && <div>{[co.phone, co.email, co.website].filter(Boolean).join("  ·  ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}



/* ══════════════════════════════════════════════════════════════════════
   PHASE 7 — Notifications, Invoices, Company profile
══════════════════════════════════════════════════════════════════════ */
function Notifications({ db, mutate, openModal, removeItem, isAdmin, me, profile, team }) {
  const visible = [...db.notifications].filter((n) => isAdmin || notifVisibleTo(n, profile)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const levelTone = (l) => l === "Urgent" ? "neg" : l === "Important" ? "accent" : "pri";
  const audienceLabel = (a) => { if (!a || a === "all") return "Everyone"; if (a.startsWith("user:")) { const u = (team || []).find((x) => x.id === a.slice(5)); return u ? "Only " + u.name : "One person"; } return (NOTIF_AUDIENCES.find((x) => x[0] === a) || [a, a])[1]; };
  const markRead = (n) => { if ((n.reads || []).includes(me.id)) return; mutate((d) => ({ ...d, notifications: d.notifications.map((x) => x.id === n.id ? { ...x, reads: Array.from(new Set([...(x.reads || []), me.id])) } : x) }), null); };
  const del = (n) => removeItem("notifications", n, { name: n.title, audit: `deleted notification "${n.title}"` });
  return (
    <div className="content">
      <div className="page-head"><h3>Notifications</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>}</div>
      {visible.length === 0 ? <div className="card"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text={isAdmin ? "Broadcast an update to everyone, a role, or one person \u2014 with a priority level." : "Notifications from your admins show up here."} action={isAdmin && <button className="btn primary" onClick={() => openModal({ type: "notification" })}><Bell size={16} />New notification</button>} /></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{visible.map((n) => {
          const seen = (n.reads || []).includes(me.id);
          return (
            <div key={n.id} className="card stat" style={{ borderLeft: `3px solid var(${n.level === "Urgent" ? "--neg" : "--primary"})` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontWeight: 700, fontSize: 15 }}>{n.title}</span><span className={"badge " + levelTone(n.level)}>{n.level || "General"}</span>{!seen && !isAdmin && <span className="badge pri">New</span>}</div>
                  {n.body && <div style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                  <div className="item-meta" style={{ marginTop: 8 }}><span>{n.by || "Admin"}</span><span>{fmtDateTime(n.createdAt)}</span>{isAdmin && <span><Users size={12} style={{ verticalAlign: -2 }} /> {audienceLabel(n.audience)}</span>}{isAdmin && <span><Check size={12} style={{ verticalAlign: -2 }} /> {(n.reads || []).length} read</span>}</div>
                  {!isAdmin && !seen && <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => markRead(n)}><Check size={13} />Mark as read</button></div>}
                  {!isAdmin && seen && <div className="hint-line" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pos)" }}><BadgeCheck size={13} />Read</div>}
                </div>
                {isAdmin && <div className="row-actions"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => del(n)}><Trash2 size={14} /></button></div>}
              </div>
            </div>
          );
        })}</div>}
    </div>
  );
}

function NotificationForm({ initial, team, onSave, onClose }) {
  const [f, setF] = useState(initial || { title: "", body: "", level: "General", audience: "all" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");
  const people = (team || []).filter((p) => p.role !== "client");
  const save = () => { if (!f.title.trim()) { setErr("Add a title."); return; } onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), title: f.title.trim(), reads: f.reads || [] }); };
  return (
    <Modal title={f.id ? "Edit notification" : "New notification"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Bell size={15} />Send</button></>}>
      <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Office closed Friday" /></Field>
      <Field label="Message"><textarea className="textarea" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Details\u2026" /></Field>
      <div className="grid2">
        <Field label="Priority"><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{NOTIF_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Send to"><select className="select" value={f.audience} onChange={(e) => set("audience", e.target.value)}>{NOTIF_AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<optgroup label="One person">{people.map((p) => <option key={p.id} value={"user:" + p.id}>{p.name}</option>)}</optgroup></select></Field>
      </div>
    </Modal>
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

function InvoiceForm({ initial, clients, portalClients, onSave, onClose }) {
  const [f, setF] = useState(initial || { number: "INV-" + String(Date.now()).slice(-5), client: "", clientId: "", title: "", amount: "", status: "Draft", dueDate: todayISO(), notes: "" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => { if (!f.client.trim()) { setErr("Add a client."); return; } onSave({ ...f, id: f.id || uid(), createdAt: f.createdAt || Date.now(), client: f.client.trim(), amount: Number(f.amount) || 0 }); };
  return (
    <Modal title={f.id ? "Edit invoice" : "New invoice"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save invoice</button></>}>
      <div className="grid2">
        <Field label="Invoice #"><input className="input" value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="INV-001" /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{INVOICE_STATUS.map((sv) => <option key={sv}>{sv}</option>)}</select></Field>
      </div>
      <Field label="Client" required error={err}>
        <input className="input" list="inv-clients" value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Client name" />
        <datalist id="inv-clients">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <Field label="Description"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website \u2014 milestone 1" /></Field>
      <div className="grid2">
        <Field label="Amount (\u20b9)"><input className="input mono" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" /></Field>
        <Field label="Due date"><input className="input" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
      </div>
      {portalClients && portalClients.length > 0 && (
        <Field label="Share to portal client" hint="Optional \u2014 lets that client see this invoice and its payment status.">
          <select className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Don't share</option>
            {portalClients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
          </select>
        </Field>
      )}
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Payment terms, bank details, etc." /></Field>
    </Modal>
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

function CreateUserModal({ onClose }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "staff" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const create = async () => {
    if (!f.email.trim() || f.password.length < 6) { setErr("Enter an email and a password of at least 6 characters."); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "create", email: f.email.trim(), password: f.password, name: f.name.trim(), role: f.role } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      setOk(true);
    } catch (e) { setErr((e && e.message) || "Couldn't create the user. Is the admin-users function deployed?"); }
    finally { setBusy(false); }
  };
  if (ok) return <Modal title="User created" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}><p className="hint-line" style={{ lineHeight: 1.6 }}>{f.name || f.email} can now sign in with the email and password you set. The account is confirmed and approved.</p></Modal>;
  return (
    <Modal title="Add a user" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}Create user</button></>}>
      <div className="grid2">
        <Field label="Full name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Priya Sharma" /></Field>
        <Field label="Role"><select className="select" value={f.role} onChange={(e) => set("role", e.target.value)}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
      </div>
      <Field label="Email" required><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@allbee.in" /></Field>
      <Field label="Password" required hint="At least 6 characters. Share it with them securely."><input className="input" type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Temporary password" /></Field>
      {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
      <p className="hint-line" style={{ marginTop: 8 }}>Requires the <b>admin-users</b> edge function to be deployed.</p>
    </Modal>
  );
}

function ManageUserModal({ person, onClose }) {
  const [designation, setDesignation] = useState(person.designation || "");
  const [username, setUsername] = useState(person.username || "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const call = async (body) => { setBusy(true); setMsg(""); setErr(""); try { const { data, error } = await supabase.functions.invoke("admin-users", { body }); if (error) throw error; if (data && data.error) throw new Error(data.error); return true; } catch (e) { setErr((e && e.message) || "Action failed. Is the admin-users function deployed?"); return false; } finally { setBusy(false); } };
  const saveDes = async () => {
    setBusy(true); setMsg(""); setErr("");
    try { const { error } = await supabase.from("profiles").update({ designation: designation.trim() || null }).eq("id", person.id); if (error) throw error; setMsg("Job title updated."); }
    catch (e) { setErr((e && e.message) || "Couldn't update the job title."); }
    finally { setBusy(false); }
  };
  const resetPw = async () => { if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; } if (await call({ action: "reset_password", userId: person.id, password: pw })) { setMsg("Password reset."); setPw(""); } };
  // Username writes straight to the profile (no edge function needed).
  const saveUsername = async () => {
    setBusy(true); setMsg(""); setErr("");
    const uname = username.trim().toLowerCase().replace(/\s+/g, "") || null;
    try { const { error } = await supabase.from("profiles").update({ username: uname }).eq("id", person.id); if (error) throw error; setMsg("Username updated."); }
    catch (e) { setErr((e && e.message && /duplicate|unique/i.test(e.message)) ? "That username is already taken." : ((e && e.message) || "Couldn't update the username.")); }
    finally { setBusy(false); }
  };
  // Permanently delete: removes their login + profile so the email/username can be
  // reused. Partners can't be deleted. Goes through the admin-users edge function.
  const removeUser = async () => {
    if (person.role === "superadmin") { setErr("Partners can't be deleted."); return; }
    if (!window.confirm(`Permanently delete ${person.name}? They're removed from the team and can't sign back in. You can re-create them afterwards.`)) return;
    setBusy(true); setMsg(""); setErr("");
    // 1. Remove the profile row directly. This works with no edge function and
    //    takes them out of the team immediately (and frees their username).
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", person.id);
      if (error) throw error;
    } catch (e) {
      setBusy(false);
      setErr(/(permission|denied|policy|row-level)/i.test((e && e.message) || "")
        ? "The database is blocking the delete. Run allbee-delete-user.sql once, then try again."
        : ("Couldn't remove them: " + ((e && e.message) || "unknown error")));
      return;
    }
    // 2. Best-effort: also delete their login via the edge function so the email
    //    frees up too. If it isn't deployed, that's fine — they're already gone.
    try { await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: person.id } }); } catch { /* function not deployed — profile already removed */ }
    setBusy(false);
    onClose();
  };
  return (
    <Modal title={"Manage " + person.name} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <Field label="Job title / designation"><div style={{ display: "flex", gap: 8 }}><input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Developer" /><button className="btn primary" onClick={saveDes} disabled={busy}>Save</button></div></Field>
      <Field label="Username" hint="They can sign in with this instead of their email."><div style={{ display: "flex", gap: 8 }}><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya" /><button className="btn primary" onClick={saveUsername} disabled={busy}>Save</button></div></Field>
      <Field label="Reset password" hint="Sets a new password for this user immediately."><div style={{ display: "flex", gap: 8 }}><input className="input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" /><button className="btn primary" onClick={resetPw} disabled={busy}>Reset</button></div></Field>
      {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
      {msg && <div className="auth-msg ok"><Check size={14} /> {msg}</div>}
      {person.role !== "superadmin" && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div className="lbl" style={{ fontSize: 12, fontWeight: 700, color: "var(--neg)", marginBottom: 6 }}>Danger zone</div>
          <p className="hint-line" style={{ marginBottom: 10 }}>Permanently delete this account. Their login and profile are removed and the email/username can be reused to re-create them.</p>
          <button className="btn danger" onClick={removeUser} disabled={busy}><Trash2 size={15} />Delete user</button>
        </div>
      )}
      <p className="hint-line" style={{ marginTop: 12 }}>Delete, password reset and adding users need the <b>admin-users</b> edge function deployed. Username and job title save directly.</p>
    </Modal>
  );
}

/* ── In-house projects ─────────────────────────────────────────────────────
   The company's own initiatives (products, internal tools, R&D) — tracked
   separately from client projects. No client billing; just status + progress. */
function InHouseForm({ initial, team = [], onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: "", category: "Product", lead: "", stage: "Idea", priority: "Medium", start: todayISO(), target: "", budget: "", progress: 0, link: "", notes: "", ...initial }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length > 0;
  const leads = team.filter((p) => p.role !== "client").map((p) => p.name);
  const save = () => {
    if (!valid) return;
    let link = f.link.trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link; // tolerate "site.com"
    onSave({ ...initial, id: initial?.id || uid(), name: f.name.trim(), category: f.category, lead: f.lead, stage: f.stage, priority: f.priority, start: f.start, target: f.target, budget: Number(f.budget) || 0, progress: Math.max(0, Math.min(100, Number(f.progress) || 0)), link, notes: f.notes.trim(), createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit in-house project" : "New in-house project"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />Save project</button></>}>
      <div className="grid2">
        <Field label="Project name" required><input className="input" value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="Internal CRM revamp" /></Field>
        <Field label="Category"><SelectOther value={f.category} onChange={(v) => up("category", v)} options={INHOUSE_CATEGORIES} placeholder="Custom category…" /></Field>
      </div>
      <div className="grid2">
        <Field label="Project lead"><select className="select" value={f.lead} onChange={(e) => up("lead", e.target.value)}><option value="">Unassigned</option>{leads.map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => up("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Start date"><input className="input" type="date" value={f.start} onChange={(e) => up("start", e.target.value)} /></Field>
        <Field label="Target date"><input className="input" type="date" value={f.target} onChange={(e) => up("target", e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Stage"><select className="select" value={f.stage} onChange={(e) => up("stage", e.target.value)}>{INHOUSE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Budget (optional)"><input className="input mono" type="number" min="0" value={f.budget} onChange={(e) => up("budget", e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label={`Progress · ${Math.max(0, Math.min(100, Number(f.progress) || 0))}%`}><input type="range" min="0" max="100" step="5" value={f.progress} onChange={(e) => up("progress", e.target.value)} style={{ width: "100%" }} /></Field>
      <Field label="Project link" hint="Live URL, repo, or doc — shown as a clickable link on the card."><input className="input" type="url" value={f.link} onChange={(e) => up("link", e.target.value)} placeholder="https://edusphere.allbeesolutions.com/" /></Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Goal, scope, who's involved…" /></Field>
    </Modal>
  );
}

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
function IncentiveForm({ person, onAdd, onClose }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState("");
  const save = () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    onAdd({ id: uid(), amount: round2(amt), note: note.trim(), date, createdAt: Date.now() });
  };
  return (
    <Modal title={`Add incentive — ${person.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Plus size={15} />Add incentive</button></>}>
      <div className="banner" style={{ margin: "0 0 12px" }}><Gift size={15} /> A one-off bonus — a festival bonus, a spot reward, a performance incentive. It's added to what this person has earned to date.</div>
      <div className="grid2">
        <Field label="Amount" required error={err}><input className="input mono" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" autoFocus /></Field>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Reason (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali bonus, top performer" /></Field>
    </Modal>
  );
}

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
      {adding && <IncentiveForm person={person} onAdd={addIncentive} onClose={() => setAdding(false)} />}
    </div>
  );
}

function StaffSalary({ db, team, mutate, me }) {
  const roster = team.filter((p) => p.role !== "client" && p.role !== "superadmin");
  const setPay = (person, patch, action) => mutate((d) => {
    const exists = (d.payroll || []).some((r) => r.userId === person.id);
    const payroll = exists
      ? d.payroll.map((r) => r.userId === person.id ? { ...r, ...patch, updatedAt: Date.now() } : r)
      : [...(d.payroll || []), { id: uid(), userId: person.id, userName: person.name, fixedMonthly: 0, commissionPct: 0, createdAt: Date.now(), ...patch }];
    return { ...d, payroll };
  }, { action: action || `updated ${person.name}'s pay settings`, module: "Staff salary" });
  const totalCommission = roster.reduce((s, p) => s + staffEarnings(db, db.payroll, { id: p.id, name: p.name }, p.created_at).realisedComm, 0);
  const totalMonthly = (db.payroll || []).reduce((s, r) => s + (Number(r.fixedMonthly) || 0), 0);
  const totalIncentives = (db.payroll || []).reduce((s, r) => s + (Array.isArray(r.incentives) ? r.incentives.reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0), 0);
  return (
    <div className="content">
      <div className="page-head"><h3>Staff salary</h3></div>
      <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><Coins size={15} /> Set each person's fixed monthly salary, a commission rate, or both — and add one-off incentives (bonuses) any time. Commission is a share of the value of every student, project or client they bring in.</div>
      <div className="sumrow">
        <div className="card"><div className="k"><Users size={14} /> People</div><div className="v">{roster.length}</div></div>
        <div className="card"><div className="k"><Banknote size={14} /> Monthly salaries</div><div className="v mono">{money(totalMonthly)}</div></div>
        <div className="card"><div className="k"><Coins size={14} /> Commission earned</div><div className="v mono">{money(totalCommission)}</div></div>
        <div className="card"><div className="k"><Gift size={14} /> Incentives paid</div><div className="v mono">{money(totalIncentives)}</div></div>
      </div>
      {roster.length === 0 ? <div className="card"><Empty icon={<Users size={22} color="var(--muted)" />} title="No team members yet" text="Add staff on the Team screen, then set their pay here." /></div>
        : <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {roster.map((p) => <SalaryRow key={p.id} person={p} db={db} payroll={db.payroll} onSave={setPay} />)}
        </div>}
      <div className="hint-line" style={{ marginTop: 14, lineHeight: 1.5 }}>
        Commission is "earned" once an item is actually paying — a student fee marked Paid, a project marked Completed, or a client set to Active. Until then it sits in the pipeline. Everyone can see their own breakdown on the My earnings screen.
      </div>
    </div>
  );
}

/* ── My earnings (every member sees their own) ─────────────────────────── */
function MyEarnings({ db, me, role, payroll, profile, go }) {
  if (role === "superadmin") {
    return (
      <div className="content">
        <div className="page-head"><h3>My earnings</h3></div>
        <div className="card"><Empty icon={<Wallet size={22} color="var(--muted)" />} title="Partners draw from the profit share" text="As a partner you don't take a fixed salary or commission — your earnings come from the Haji & Alim split tracked in Share & accounts." action={<button className="btn primary" onClick={() => go("accounts")}><Wallet size={16} />Open Share & accounts</button>} /></div>
      </div>
    );
  }
  const E = staffEarnings(db, payroll, { id: me.id, name: me.name }, profile?.created_at);
  const realised = E.items.filter((i) => i.realized);
  const pipeline = E.items.filter((i) => !i.realized);
  const kindTone = (k) => k === "Student" ? "pri" : k === "Project" ? "accent" : "pos";
  const Row = ({ i }) => (
    <tr>
      <td><div style={{ fontWeight: 600 }}>{i.name}</div>{i.date && <div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(i.date)}</div>}</td>
      <td><span className={"badge " + kindTone(i.kind)}>{i.kind}</span></td>
      <td className="num-cell mono">{money(i.base)}</td>
      <td><span className="hint-line">{i.status}</span></td>
      <td className="num-cell mono" style={{ fontWeight: 700, color: i.realized ? "var(--pos)" : "var(--muted)" }}>{money(i.commission)}</td>
    </tr>
  );
  return (
    <div className="content">
      <div className="page-head"><h3>My earnings</h3></div>
      {!E.configured && E.items.length === 0 ? (
        <div className="card"><Empty icon={<Coins size={22} color="var(--muted)" />} title="No earnings set up yet" text="Once an admin sets your salary or commission rate, what you earn from ALLBEE shows up here — including a share of every student, project and client you bring in." /></div>
      ) : (
        <>
          <div className="sumrow">
            <div className="card"><div className="k"><Wallet size={14} /> Earned to date</div><div className="v mono pos-txt">{money(E.totalToDate)}</div></div>
            <div className="card"><div className="k"><Coins size={14} /> Commission earned</div><div className="v mono">{money(E.realisedComm)}</div></div>
            <div className="card"><div className="k"><Hourglass size={14} /> In pipeline</div><div className="v mono">{money(E.pipelineComm)}</div></div>
            {E.fixedMonthly > 0 && <div className="card"><div className="k"><Banknote size={14} /> Salary / month</div><div className="v mono">{money(E.fixedMonthly)}</div></div>}
            {E.incentivesTotal > 0 && <div className="card"><div className="k"><Gift size={14} /> Incentives</div><div className="v mono">{money(E.incentivesTotal)}</div></div>}
          </div>

          {E.fixedMonthly > 0 && (
            <div className="card stat" style={{ marginBottom: 16 }}>
              <div className="lbl"><Banknote size={14} /> Fixed salary</div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 10 }}>
                <div><div className="hint-line">Per month</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(E.fixedMonthly)}</div></div>
                <div><div className="hint-line">Months on the team</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{E.months}</div></div>
                <div><div className="hint-line">Salary to date (estimate)</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(E.salaryToDate)}</div></div>
              </div>
              <div className="hint-line" style={{ marginTop: 8 }}>Estimated from your joining date — your actual payslip is settled by the finance team.</div>
            </div>
          )}

          {E.incentives.length > 0 && (
            <div className="card stat" style={{ marginBottom: 16 }}>
              <div className="lbl"><Gift size={14} /> Incentives</div>
              <div style={{ marginTop: 10 }}>
                {E.incentives.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map((x) => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                    <div><div style={{ fontWeight: 600 }}>{x.note || "Incentive"}</div>{x.date && <div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(x.date)}</div>}</div>
                    <div className="mono" style={{ fontWeight: 700, color: "var(--pos)" }}>{money(x.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="hint-line" style={{ marginTop: 8 }}>One-off incentives added by your admin — included in your earned-to-date total.</div>
            </div>
          )}

          <div className="card">
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Coins size={15} /><span style={{ fontWeight: 700 }}>Commission</span>
              {E.pct > 0 ? <span className="badge pri">{E.pct}% of each deal</span> : <span className="hint-line">No commission rate set — you're on a fixed salary.</span>}
            </div>
            {E.items.length === 0 ? (
              <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="Nothing to show yet" text="Register a student, add a project, or bring in a client with a deal value and your commission appears here." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Item</th><th>Type</th><th className="num-cell">Value</th><th>Status</th><th className="num-cell">Your commission</th></tr></thead>
                  <tbody>
                    {realised.length > 0 && <tr><td colSpan={5} style={{ background: "var(--surface-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700 }}>Earned</td></tr>}
                    {realised.map((i) => <Row key={i.id} i={i} />)}
                    {pipeline.length > 0 && <tr><td colSpan={5} style={{ background: "var(--surface-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700 }}>Pipeline — not earned yet</td></tr>}
                    {pipeline.map((i) => <Row key={i.id} i={i} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Team leads: superadmin sets a lead + their members ─────────────────── */
function TeamConfigForm({ initial, roster, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [leadId, setLeadId] = useState(initial?.leadId || "");
  const [memberIds, setMemberIds] = useState(initial?.memberIds || []);
  const [err, setErr] = useState("");
  const toggle = (id) => setMemberIds((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
  const candidates = roster.filter((p) => p.id !== leadId);
  const save = () => {
    if (!name.trim()) { setErr("Give the team a name."); return; }
    if (!leadId) { setErr("Choose a team lead."); return; }
    const lead = roster.find((p) => p.id === leadId);
    onSave({ id: initial?.id || uid(), name: name.trim(), leadId, leadName: lead?.name || "", memberIds: memberIds.filter((id) => id !== leadId), createdAt: initial?.createdAt || Date.now(), updatedAt: Date.now() });
  };
  return (
    <Modal title={initial?.id ? "Edit team" : "New team"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={16} />Save team</button></>}>
      {err && <div className="auth-msg err" style={{ marginBottom: 10 }}><AlertTriangle size={14} /> {err}</div>}
      <div className="grid2">
        <Field label="Team name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Development squad" /></Field>
        <Field label="Team lead" required><select className="select" value={leadId} onChange={(e) => setLeadId(e.target.value)}><option value="">Choose…</option>{roster.map((p) => <option key={p.id} value={p.id}>{p.name} · {ROLE_LABEL[p.role] || p.role}</option>)}</select></Field>
      </div>
      <Field label={`Members${memberIds.length ? ` · ${memberIds.length} selected` : ""}`} hint="Tick everyone who reports to this lead. The lead is included automatically.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {candidates.length === 0 ? <div className="hint-line">No other members available.</div> : candidates.map((p) => {
            const on = memberIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} className="card" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", cursor: "pointer", textAlign: "left", border: on ? "1px solid var(--primary)" : "1px solid var(--border)", background: on ? "var(--primary-soft)" : "var(--surface)" }}>
                <Avatar name={p.name} url={p.photo_url} size={26} />
                <span style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{ROLE_LABEL[p.role] || p.role}</div></span>
                {on && <Check size={15} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
      </Field>
    </Modal>
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
  const del = (m) => { if (!window.confirm("Delete your message for the team?")) return; mutate((d) => ({ ...d, team_chat: d.team_chat.map((x) => x.id === m.id ? { ...x, deleted: true, text: "", deletedBy: me.name } : x) }), null); };
  const photo = (id) => members.find((p) => p.id === id)?.photo_url;
  return (
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
function TestSessionForm({ initial, projects = [], team = [], onSave, onClose }) {
  const [f, setF] = useState(() => ({
    title: "", projectId: "", projectName: "", assignedTo: "", assignedToId: "", notes: "",
    checklistText: (Array.isArray(initial?.checklist) ? initial.checklist.map((i) => i.text).join("\n") : ""),
    ...initial,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const roster = (team || []).filter((p) => p.role !== "client" && p.active !== false);
  const save = () => {
    if (!f.title.trim()) { setErr("Give the test session a title."); return; }
    const proj = projects.find((p) => p.id === f.projectId);
    const tester = roster.find((p) => p.id === f.assignedToId);
    // preserve existing checklist state; only add/rename from the text box
    const prev = Array.isArray(initial?.checklist) ? initial.checklist : [];
    const lines = f.checklistText.split("\n").map((l) => l.trim()).filter(Boolean);
    const checklist = lines.map((text, i) => {
      const match = prev[i] && prev[i].text === text ? prev[i] : prev.find((p) => p.text === text);
      return match || { id: uid(), text, done: false, note: "", by: "", at: 0 };
    });
    onSave({
      ...initial, id: initial?.id || uid(),
      title: f.title.trim(),
      projectId: proj ? proj.id : (f.projectId || ""),
      projectName: proj ? proj.name : (f.projectName || ""),
      assignedTo: tester ? tester.name : (f.assignedTo || ""),
      assignedToId: tester ? tester.id : (f.assignedToId || ""),
      checklist,
      bugs: Array.isArray(initial?.bugs) ? initial.bugs : [],
      result: initial?.result || "Pending",
      notes: f.notes.trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit test session" : "New test session"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={16} />Save session</button></>}>
      <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AllBee App — release check" /></Field>
      <div className="grid2">
        <Field label="Project" hint="Testing history belongs to this project.">
          {projects.length ? (
            <select className="select" value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">— General / no project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input className="input" value={f.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="Project name" />
          )}
        </Field>
        <Field label="Assign tester">
          <select className="select" value={f.assignedToId} onChange={(e) => set("assignedToId", e.target.value)}>
            <option value="">— Unassigned —</option>
            {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Checklist" hint="One item per line — add as many as you like.">
        <textarea className="textarea" style={{ minHeight: 130 }} value={f.checklistText} onChange={(e) => set("checklistText", e.target.value)}
          placeholder={"Login works\nDashboard works\nTasks working\nNotifications working\nMobile responsive\nSearch working\nDark mode working\nAttendance working"} />
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the tester should know…" /></Field>
    </Modal>
  );
}

// Full session view: checklist, bug reports with screenshots, result. Looks up
// the live session from db by id so edits from either partner stay in sync.
function TestDetail({ sessionId, db, mutate, isAdmin, me, currentUser, team, openModal, onBack, onDelete }) {
  const s = (db.testing || []).find((x) => x.id === sessionId);
  const [newItem, setNewItem] = useState("");
  const [bugText, setBugText] = useState("");
  const [bugImgs, setBugImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const [notes, setNotes] = useState(s?.notes || "");
  const fileRef = useRef(null);

  if (!s) {
    return (
      <div className="content">
        <button className="backlink" onClick={onBack}><ArrowLeft size={15} />Back to testing</button>
        <div className="card"><Empty icon={<ClipboardCheck size={22} color="var(--muted)" />} title="Session not found" text="It may have been deleted. Check Recently deleted to restore it." /></div>
      </div>
    );
  }

  const isTester = s.assignedToId === me.id || (!!currentUser && s.assignedTo === currentUser);
  const canAct = isAdmin || isTester;   // tick items, add notes/bugs, set result
  const checklist = Array.isArray(s.checklist) ? s.checklist : [];
  const bugs = Array.isArray(s.bugs) ? s.bugs : [];
  const prog = testProgress(s);
  const patch = (fn, audit) => mutate((d) => ({ ...d, testing: (d.testing || []).map((x) => x.id === s.id ? fn(x) : x) }), audit || null);
  const A = (action) => ({ action, module: "Testing" });

  const toggle = (id) => {
    if (!canAct) return;
    patch((x) => ({ ...x, checklist: (x.checklist || []).map((i) => i.id === id ? { ...i, done: !i.done, by: currentUser, at: Date.now() } : i) }), A(`updated the checklist on "${s.title}"`));
  };
  const setItemNote = (id, note) => patch((x) => ({ ...x, checklist: (x.checklist || []).map((i) => i.id === id ? { ...i, note } : i) }));
  const addItem = () => { const t = newItem.trim(); if (!t || !isAdmin) return; patch((x) => ({ ...x, checklist: [...(x.checklist || []), { id: uid(), text: t, done: false, note: "", by: "", at: 0 }] }), A(`added a checklist item to "${s.title}"`)); setNewItem(""); };
  const removeItemRow = (id) => { if (!isAdmin) return; patch((x) => ({ ...x, checklist: (x.checklist || []).filter((i) => i.id !== id) }), A(`updated the checklist on "${s.title}"`)); };
  const setResult = (r) => { if (!canAct) return; haptic(r === "Passed" ? [10, 40, 10] : 12); patch((x) => ({ ...x, result: r }), A(r === "Pending" ? `reset test "${s.title}" to Pending` : `marked test "${s.title}" as ${r}`)); };

  const pickImages = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setImgErr("");
    const room = TEST_MAX_IMAGES - bugImgs.length;
    if (room <= 0) { setImgErr(`Up to ${TEST_MAX_IMAGES} screenshots per report.`); if (e.target) e.target.value = ""; return; }
    setBusy(true);
    try {
      for (const file of files.slice(0, room)) {
        if (fileKind(file) !== "image") { setImgErr("Only image files can be attached here."); continue; }
        const up = await uploadAttachment(file);
        setBugImgs((prev) => prev.length >= TEST_MAX_IMAGES ? prev : [...prev, { url: up.url, name: up.name, path: up.path || storagePathFromUrl(up.url), at: Date.now() }]);
      }
    } catch (er) { setImgErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const addBug = () => {
    const t = bugText.trim(); if ((!t && !bugImgs.length) || !canAct) return;
    const bug = { id: uid(), text: t, images: bugImgs, by: currentUser, byId: me.id, at: Date.now() };
    patch((x) => ({ ...x, bugs: [...(x.bugs || []), bug] }), A(`reported an issue on "${s.title}"`));
    setBugText(""); setBugImgs([]); setImgErr("");
  };
  const removeBug = (bug) => {
    if (!(isAdmin || bug.byId === me.id)) return;
    // best-effort remove the stored screenshots so they don't linger
    const paths = (bug.images || []).map((im) => im.path || storagePathFromUrl(im.url)).filter(Boolean);
    if (paths.length) { try { supabase.storage.from("attachments").remove(paths); } catch { /* ignore */ } }
    patch((x) => ({ ...x, bugs: (x.bugs || []).filter((b) => b.id !== bug.id) }), A(`removed an issue from "${s.title}"`));
  };
  const saveNotes = () => { if (notes !== (s.notes || "")) patch((x) => ({ ...x, notes })); };

  return (
    <div className="content">
      <button className="backlink" onClick={onBack}><ArrowLeft size={15} />Back to testing</button>
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{s.title}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            {s.projectName ? <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FolderKanban size={12} />{s.projectName}</span> : <span className="tag">General</span>}
            <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><User size={12} />{s.assignedTo || "Unassigned"}</span>
            <span className={"badge " + testResultTone(s.result)}>{s.result || "Pending"}</span>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn sm" onClick={() => openModal({ type: "testSession", initial: s })}><Pencil size={13} />Edit</button>
            <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete test session?", body: `Delete "${s.title}"? Its checklist and reports will be removed.`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => { onDelete(s); onBack(); } })}><Trash2 size={13} />Delete</button>
          </div>
        )}
      </div>

      {/* result controls */}
      <div className="card stat" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="lbl"><ClipboardCheck size={14} /> Checklist progress</div>
          <div className="num mono" style={{ fontSize: 22 }}>{prog.done}/{prog.total}</div>
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <div className="progress-track"><div className="progress-fill" style={{ width: (prog.total ? Math.round((prog.done / prog.total) * 100) : 0) + "%", background: s.result === "Failed" ? "var(--neg)" : s.result === "Passed" ? "var(--pos)" : "var(--primary)" }} /></div>
        </div>
        {canAct && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={"btn sm " + (s.result === "Passed" ? "primary" : "")} onClick={() => setResult("Passed")}><CheckCircle2 size={14} />Pass</button>
            <button className={"btn sm " + (s.result === "Failed" ? "danger" : "")} onClick={() => setResult("Failed")}><XCircle size={14} />Fail</button>
            {s.result !== "Pending" && <button className="btn sm" onClick={() => setResult("Pending")}><RotateCcw size={13} />Reset</button>}
          </div>
        )}
      </div>

      {/* checklist */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><ListTodo size={16} />Checklist</div>
        <div style={{ padding: "6px 16px 12px" }}>
          {checklist.length === 0 ? <div className="hint-line" style={{ padding: "14px 0" }}>No checklist items yet.{isAdmin ? " Add the first below." : ""}</div>
            : checklist.map((i) => (
              <div key={i.id} className="check-item">
                <div className={"check-box" + (i.done ? " done" : "")} onClick={() => toggle(i.id)} title={canAct ? "Toggle" : "Read-only"} style={{ cursor: canAct ? "pointer" : "default" }}>{i.done && <Check size={14} />}</div>
                <div className="check-main" style={{ flex: 1, minWidth: 0 }}>
                  <div className={"check-txt" + (i.done ? " done" : "")}>{i.text}</div>
                  {canAct
                    ? <input className="input" style={{ marginTop: 6, fontSize: 13, padding: "6px 10px" }} value={i.note || ""} onChange={(e) => setItemNote(i.id, e.target.value)} placeholder="Add a note (e.g. crashes on Samsung A34)…" />
                    : (i.note ? <div className="hint-line" style={{ marginTop: 4 }}>{i.note}</div> : null)}
                  {i.done && i.by && <div className="hint-line" style={{ marginTop: 4, fontSize: 11 }}>Tested by {i.by} · {fmtTime(i.at)}</div>}
                </div>
                {isAdmin && <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => removeItemRow(i.id)} title="Remove item"><X size={13} /></button>}
              </div>
            ))}
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="Add a checklist item…" />
              <button className="btn" onClick={addItem}><Plus size={15} />Add</button>
            </div>
          )}
        </div>
      </div>

      {/* bug reports */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Bug size={16} />Issues & bug reports <span className="hint-line" style={{ fontWeight: 500, marginLeft: "auto" }}>Screenshots auto-delete after {TEST_IMAGE_TTL_DAYS} days</span></div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {bugs.length === 0 && <div className="hint-line">No issues reported yet.</div>}
          {bugs.map((b) => (
            <div key={b.id} className="bug-card">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {b.text && <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{b.text}</div>}
                  <div className="hint-line" style={{ marginTop: 4, fontSize: 11 }}>{b.by || "—"} · {fmtTime(b.at)}</div>
                </div>
                {(isAdmin || b.byId === me.id) && <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => removeBug(b)} title="Delete report"><Trash2 size={13} /></button>}
              </div>
              {(b.images || []).length > 0 && (
                <div className="thumb-row">
                  {(b.images || []).map((im, idx) => <img key={idx} className="thumb" src={im.url} alt={im.name || "screenshot"} onClick={() => window.open(im.url, "_blank", "noreferrer")} />)}
                </div>
              )}
            </div>
          ))}
          {canAct && (
            <div style={{ borderTop: bugs.length ? "1px solid var(--border)" : "none", paddingTop: bugs.length ? 12 : 0 }}>
              <textarea className="textarea" style={{ minHeight: 64 }} value={bugText} onChange={(e) => setBugText(e.target.value)} placeholder="Describe the issue…" />
              {imgErr && <div className="field-err" style={{ marginTop: 6 }}><AlertTriangle size={13} />{imgErr}</div>}
              <div className="thumb-row" style={{ marginTop: 10 }}>
                {bugImgs.map((im, idx) => (
                  <div key={idx} style={{ position: "relative" }}>
                    <img className="thumb" src={im.url} alt={im.name} />
                    <button className="iconbtn" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%" }} onClick={() => setBugImgs((p) => p.filter((_, i) => i !== idx))}><X size={12} /></button>
                  </div>
                ))}
                {bugImgs.length < TEST_MAX_IMAGES && (
                  <div className="thumb-add" onClick={() => !busy && fileRef.current?.click()} title="Add screenshot">{busy ? <RefreshCw size={18} className="spin" /> : <ImageIcon size={18} />}</div>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={pickImages} style={{ display: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn primary" onClick={addBug} disabled={busy || (!bugText.trim() && !bugImgs.length)}><Send size={14} />Add report</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* session notes */}
      <div className="card stat">
        <div className="lbl" style={{ marginBottom: 8 }}><FileText size={14} /> Session notes</div>
        {canAct
          ? <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Overall notes for this test session…" />
          : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: s.notes ? "var(--ink)" : "var(--muted)" }}>{s.notes || "No notes."}</div>}
      </div>
    </div>
  );
}

// Master list + dashboard. Admins see and create every session; a tester sees
// the sessions assigned to them.
function Testing({ db, mutate, openModal, removeItem, isAdmin, me, currentUser, team }) {
  const [openId, setOpenId] = useState(null);
  const all = [...(db.testing || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((s) => s.assignedToId === me.id || (!!currentUser && s.assignedTo === currentUser));
  const del = (s) => removeItem("testing", s, { name: s.title, audit: `deleted test session "${s.title}"` });

  if (openId) return <TestDetail key={openId} sessionId={openId} db={db} mutate={mutate} isAdmin={isAdmin} me={me} currentUser={currentUser} team={team} openModal={openModal} onBack={() => setOpenId(null)} onDelete={del} />;

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

function GlobalSearch({ db, team, profile, role, me, allowedRoutes, go, openTask, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const isAdmin = isAdminRole(role);
  const allowKey = (allowedRoutes || []).join(",");

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }, []);

  const index = useMemo(() => {
    const allow = new Set(allowedRoutes || []);
    const ctx = { isAdmin, me, profile };
    const out = [];
    // modules (navigation)
    for (const [key, label, , tag] of NAV) {
      if (!allow.has(key)) continue;
      out.push({ id: "nav:" + key, module: "Navigation", route: key, title: label, sub: "", user: "", dateISO: "", path: `Home > ${label}`, text: (label + " " + key).toLowerCase(), navTask: null });
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

  const openRec = (r) => { if (!r) return; onClose(); if (r.navTask) openTask(r.navTask); else go(r.route); };
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
      <div className="cmdk" onKeyDown={onKey}>
        <div className="cmdk-input">
          <Search size={20} color="var(--muted)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search modules, people, projects, tasks, notes…" />
          <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={onClose} title="Close"><X size={16} /></button>
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

const TN_DISTRICTS = ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"];

const APN_SERVICES = [["website", "Website Development"], ["marketing", "Digital Marketing"], ["course", "Course Admission"]];
const APN_SERVICE_LABEL = { website: "Website", marketing: "Digital marketing", course: "Course" };

// Partner levels — commission rate is a function of completed projects.
const APN_LEVELS = [
  { key: 0, name: "Trainee Partner", rate: 10, min: 0 },
  { key: 1, name: "Active Partner", rate: 15, min: 1 },
  { key: 2, name: "Growth Partner", rate: 20, min: 50 },
  { key: 3, name: "Elite Partner", rate: 25, min: 100 },
];
const apnLevelForCompleted = (n) => {
  const c = Number(n) || 0;
  if (c >= 100) return APN_LEVELS[3];
  if (c >= 50) return APN_LEVELS[2];
  if (c >= 1) return APN_LEVELS[1];
  return APN_LEVELS[0];
};
// Rate for the NEXT project a partner completes (prior completions decide level),
// so the first paid project earns Trainee 10%, the 2nd–49th earn Active 15%, etc.
const apnRateForPrior = (prior) => apnLevelForCompleted(Number(prior) || 0).rate;
const apnNextLevel = (n) => {
  const c = Number(n) || 0;
  if (c >= 100) return null;
  const next = c >= 50 ? APN_LEVELS[3] : c >= 1 ? APN_LEVELS[2] : APN_LEVELS[1];
  return { next, remaining: Math.max(0, next.min - c), pct: Math.min(100, Math.round((c / next.min) * 100)) };
};

const APN_LEAD_STATUS = ["Submitted", "Approved", "Duplicate", "Invalid", "Fake", "Quotation Sent", "Converted", "Lost"];
const APN_LEAD_REJECTED = new Set(["Duplicate", "Invalid", "Fake", "Lost"]);
const apnLeadTone = (s) => (s === "Converted" ? "pos" : APN_LEAD_REJECTED.has(s) ? "neg" : s === "Approved" || s === "Quotation Sent" ? "pri" : "");

const APN_COMM_STATUS = ["Pending", "Approved", "Payable", "Paid"];
const apnCommTone = (s) => (s === "Paid" ? "pos" : s === "Payable" ? "accent" : s === "Approved" ? "pri" : "");
// Commissions are paid on the 5th of the following month — never immediately.
function apnPayoutDate(fromISO) {
  const d = fromISO ? new Date(fromISO) : new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 5).toISOString().slice(0, 10);
}

const APN_TARGET_METRICS = [["leads", "Leads"], ["conversions", "Conversions"], ["website", "Website projects"], ["course", "Course admissions"], ["marketing", "Marketing projects"]];
const apnMetricLabel = (m) => (APN_TARGET_METRICS.find((x) => x[0] === m)?.[1]) || "Leads";

// Approximate quotation pricing — a starting point the partner can edit.
const APN_PRICE = {
  website: { base: 15000, baseLabel: "Website (starter)", options: [["ecommerce", "E-commerce store", 12000], ["seo", "SEO setup", 5000], ["extra", "Extra pages / sections", 4000], ["maintenance", "Annual maintenance", 6000]] },
  marketing: { base: 8000, baseLabel: "Digital marketing (monthly)", options: [["ads", "Paid ad management", 5000], ["content", "Content creation", 4000], ["social", "Social media handling", 3000]] },
  course: { base: 5000, baseLabel: "Course admission", options: [["advanced", "Advanced module", 3000], ["certification", "Certification", 1500]] },
};

/* ── partner lookups ─────────────────────────────────────────────────── */
const apnMe = (db, pid) => (db.apn_users || []).find((u) => u.id === pid) || null;
const apnUnlocked = (u) => (u && u.unlocked && typeof u.unlocked === "object" ? u.unlocked : {});

/* ── attendance & activity ───────────────────────────────────────────── */
const APN_INACTIVE_DAYS = 7;
const apnCheckedInToday = (db, pid) => (db.apn_attendance || []).some((a) => a.partnerId === pid && a.date === todayISO());
const apnAttendanceBase = (u) => Math.max(u?.lastCheckIn || 0, u?.reactivatedAt || 0, u?.approvedAt || 0, u?.createdAt || 0);
function apnAutoInactive(u) {
  if (!u || u.status !== "active") return false;
  const base = apnAttendanceBase(u);
  return !!base && (Date.now() - base) > APN_INACTIVE_DAYS * 86400000;
}
// pending / active / inactive / rejected — auto-inactive after 7 days with no check-in.
const apnEffectiveStatus = (u) => {
  if (!u) return "pending";
  if (u.status === "active" && apnAutoInactive(u)) return "inactive";
  return u.status || "pending";
};
function apnAttendanceStreak(db, pid) {
  const days = new Set((db.apn_attendance || []).filter((a) => a.partnerId === pid).map((a) => a.date));
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i).toISOString().slice(0, 10);
    if (days.has(iso)) streak++;
    else if (i === 0) continue; // today not yet checked in — don't break the run
    else break;
  }
  return streak;
}

/* ── derived stats, ranks, leaderboards, achievements ────────────────── */
const apnLeadsOf = (db, pid) => (db.apn_leads || []).filter((l) => l.partnerId === pid);
const apnCommsOf = (db, pid) => (db.apn_commissions || []).filter((c) => c.partnerId === pid);
function apnPartnerStats(db, pid) {
  const leads = apnLeadsOf(db, pid);
  const submitted = leads.length;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const completed = leads.filter((l) => l.projectCompleted).length;
  const revenue = round2(leads.filter((l) => l.status === "Converted").reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const conv = submitted ? Math.round((converted / submitted) * 100) : 0;
  const own = apnCommsOf(db, pid).filter((c) => c.kind !== "district");
  const sumBy = (st) => round2(own.filter((c) => c.status === st).reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const earned = round2(own.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  return {
    submitted, converted, completed, revenue, conv, level: apnLevelForCompleted(completed),
    commission: { earned, pending: sumBy("Pending"), approved: sumBy("Approved"), payable: sumBy("Payable"), paid: sumBy("Paid") },
    districtEarned: round2(apnCommsOf(db, pid).filter((c) => c.kind === "district").reduce((s, c) => s + (Number(c.amount) || 0), 0)),
  };
}
const apnLivePartners = (db) => (db.apn_users || []).filter((u) => u.status !== "rejected");
function apnRankBy(db, pid, scope, metric) {
  let pool = apnLivePartners(db);
  const meRow = apnMe(db, pid);
  if (scope === "district" && meRow) pool = pool.filter((u) => u.district === meRow.district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : s.completed; };
  const arr = pool.map((u) => ({ id: u.id, v: val(u) })).sort((a, b) => b.v - a.v);
  const idx = arr.findIndex((x) => x.id === pid);
  return { rank: idx < 0 ? null : idx + 1, total: arr.length };
}
function apnLeaderboard(db, scope, district, metric) {
  let pool = apnLivePartners(db);
  if (scope === "district" && district) pool = pool.filter((u) => u.district === district);
  const val = (u) => { const s = apnPartnerStats(db, u.id); return metric === "revenue" ? s.revenue : metric === "commission" ? s.commission.earned : s.completed; };
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

/* ── commission generation (partner rate + 1% district-head override) ─── */
function apnBuildCommissions(d, lead) {
  const rows = [];
  const pid = lead.partnerId;
  const prior = (d.apn_leads || []).filter((l) => l.partnerId === pid && l.projectCompleted && l.id !== lead.id).length;
  const rate = apnRateForPrior(prior);
  const revenue = Number(lead.revenue) || 0;
  const project = lead.business || lead.clientName || "Project";
  rows.push({ id: uid(), partnerId: pid, kind: "partner", leadId: lead.id, project, clientName: lead.clientName, service: lead.service, revenue, rate, amount: round2((revenue * rate) / 100), status: "Pending", createdAt: Date.now(), payoutDate: apnPayoutDate() });
  const partner = (d.apn_users || []).find((u) => u.id === pid);
  const head = partner && (d.apn_users || []).find((u) => u.role === "district_head" && u.status === "active" && u.district === partner.district && u.id !== pid);
  if (head) rows.push({ id: uid(), partnerId: head.id, kind: "district", leadId: lead.id, project, clientName: lead.clientName, service: lead.service, revenue, rate: 1, amount: round2(revenue * 0.01), status: "Pending", createdAt: Date.now(), payoutDate: apnPayoutDate(), fromPartnerId: pid });
  return rows;
}

// Create the partner's APN row on first login from the details captured at
// sign-up (mirrors ensureProfile). Assigns the next APN-TN id.
async function ensureApnProfile(user, existingRows) {
  if ((existingRows || []).some((u) => u.id === user.id)) return false;
  const meta = user.user_metadata?.apn || {};
  let n = await nextApnNumber();
  if (n == null) {
    const nums = (existingRows || []).map((u) => Number(String(u.apnId || "").replace(/\D/g, "")) || 0);
    n = (nums.length ? Math.max(...nums) : 0) + 1;
  }
  const row = {
    id: user.id, apnId: apnPadId(n),
    name: meta.name || user.user_metadata?.name || (user.email ? user.email.split("@")[0] : "Partner"),
    mobile: meta.mobile || "", email: user.email || meta.email || "", dob: meta.dob || "",
    district: meta.district || "", taluk: meta.taluk || "", city: meta.city || "",
    occupation: meta.occupation || "", college: meta.college || "", reason: meta.reason || "",
    username: (meta.username || "").toLowerCase(),
    status: "pending", role: "partner", unlocked: {}, quizPasses: {}, createdAt: Date.now(),
  };
  const { error } = await supabase.from("apn_users").upsert({ id: user.id, data: row, updated_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return true;
}

/* ── APN shared UI + gates ───────────────────────────────────────────── */
function APNGate({ isDark, icon, title, body, name, tone, onSignOut }) {
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
      <div className="lock-card gate-card">
        <div className="lock-badge" style={tone === "neg" ? { background: "linear-gradient(135deg,var(--neg),#a92a2a)" } : undefined}>{icon}</div>
        <h1>{title}</h1>
        <p>{body}</p>
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}
function APNMetric({ k, v, icon, tone }) {
  return <div className="apn-metric"><div className="k">{icon}{k}</div><div className="v" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</div></div>;
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
    }), null);
    setStep("idle"); setWord("");
  };
  return (
    <div className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><UserCheck size={16} color={done ? "var(--pos)" : "var(--muted)"} />Daily attendance</div>
        <div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>{done ? `Checked in today · ${streak}-day streak` : "Check in daily to stay active. 7 days missed = inactive."}</div>
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
  const recommend = () => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, reactivationRequested: Date.now() } : u) }), null);
  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
      <div className="lock-card gate-card">
        <div className="lock-badge" style={{ background: "linear-gradient(135deg,var(--accent),#d98c00)" }}><Hourglass size={26} /></div>
        <h1>Account inactive</h1>
        <p>You've been marked inactive due to 7 days without attendance. Only an admin can reactivate your account — your district head can recommend it.</p>
        {meRow.reactivationRequested ? <div className="auth-msg ok"><Check size={14} />Reactivation requested — waiting on approval.</div>
          : <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={recommend}><RefreshCw size={15} />Request reactivation</button>}
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  );
}

/* ── dashboard ───────────────────────────────────────────────────────── */
function APNHome({ db, meRow, stats, pid, go, openModal, mutate }) {
  const next = apnNextLevel(stats.completed);
  const cRank = apnRankBy(db, pid, "company", "revenue");
  const dRank = apnRankBy(db, pid, "district", "revenue");
  const targets = (db.apn_targets || []).filter((t) => t.partnerId === pid);
  const activeTarget = targets.find((t) => apnTargetProgress(db, t).pct < 100) || targets[0];
  return (
    <div>
      <div className="apn-lvl" style={{ marginBottom: 14 }}>
        <div className="apn-hero">
          <span className="av" style={{ background: "rgba(255,255,255,.22)" }}>{(meRow.name || "P")[0]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nm">{meRow.name}</div>
            <div className="rate">{meRow.apnId} · {stats.level.name} · {stats.level.rate}% commission</div>
          </div>
          {meRow.role === "district_head" && <span className="badge" style={{ background: "rgba(255,255,255,.9)", color: "var(--primary)" }}>District Head</span>}
        </div>
        {next ? (
          <>
            <div className="bar"><i style={{ width: next.pct + "%" }} /></div>
            <div style={{ fontSize: 12, opacity: .9, marginTop: 7 }}>{next.remaining} more completed project{next.remaining === 1 ? "" : "s"} to reach {next.next.name} ({next.next.rate}%)</div>
          </>
        ) : <div style={{ fontSize: 12, opacity: .9, marginTop: 10 }}>Top level reached — Elite Partner 👑</div>}
      </div>

      <div style={{ marginBottom: 14 }}><APNCheckIn db={db} pid={pid} mutate={mutate} /></div>

      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Commission earned" v={money(stats.commission.earned)} icon={<Coins size={13} />} tone="pos" />
        <APNMetric k="Payable" v={money(stats.commission.payable)} icon={<Wallet size={13} />} tone="accent" />
        <APNMetric k="Paid" v={money(stats.commission.paid)} icon={<Check size={13} />} />
        <APNMetric k="Leads submitted" v={stats.submitted} icon={<UserPlus size={13} />} />
        <APNMetric k="Leads converted" v={stats.converted} icon={<BadgeCheck size={13} />} />
        <APNMetric k="Conversion rate" v={stats.conv + "%"} icon={<GaugeCircle size={13} />} />
        <APNMetric k="Completed projects" v={stats.completed} icon={<Trophy size={13} />} />
      </div>

      <div className="apn-metrics" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
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

      <div className="apn-metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button className="apn-more-item" onClick={() => openModal({ type: "apnLead" })}><UserPlus size={20} color="var(--primary)" />Submit a lead</button>
        <button className="apn-more-item" onClick={() => go("learn")}><GraduationCap size={20} color="var(--primary)" />Training & quiz</button>
      </div>
    </div>
  );
}

/* ── leads ───────────────────────────────────────────────────────────── */
function APNLeadForm({ meRow, db, initial, onSave, onClose }) {
  const unlocked = apnUnlocked(meRow);
  const enabled = APN_SERVICES.filter(([k]) => unlocked[k]);
  const [f, setF] = useState(() => ({ clientName: "", mobile: "", business: "", service: enabled[0]?.[0] || "", notes: "", ...initial }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const save = () => {
    if (!enabled.length) { setErr("Pass a sales quiz first to unlock lead submission."); return; }
    if (!f.clientName.trim()) { setErr("Client name is required."); return; }
    if (!f.mobile.trim()) { setErr("Client mobile number is required."); return; }
    if (!f.service) { setErr("Choose the service required."); return; }
    const nums = (db.apn_leads || []).map((l) => Number(String(l.leadId || "").replace(/\D/g, "")) || 0);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    onSave({ id: uid(), leadId: apnLeadId(n), partnerId: meRow.id, partnerName: meRow.name, clientName: f.clientName.trim(), mobile: f.mobile.trim(), business: f.business.trim(), service: f.service, notes: f.notes.trim(), status: "Submitted", createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Submit a lead" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!enabled.length}><Send size={15} />Submit lead</button></>}>
      {!enabled.length && <div className="banner" style={{ margin: "0 0 12px" }}><AlertTriangle size={15} />Complete a training quiz to unlock lead submission.</div>}
      <Field label="Client name" required error={err}><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client's name" /></Field>
      <div className="grid2">
        <Field label="Mobile number" required><input className="input" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10-digit mobile" /></Field>
        <Field label="Business name"><input className="input" value={f.business} onChange={(e) => set("business", e.target.value)} placeholder="Business / shop" /></Field>
      </div>
      <Field label="Service required" required>
        <select className="select" value={f.service} onChange={(e) => set("service", e.target.value)}>
          {enabled.length ? enabled.map(([k, l]) => <option key={k} value={k}>{l}</option>) : <option value="">No services unlocked yet</option>}
        </select>
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything useful about the lead…" /></Field>
    </Modal>
  );
}
function APNLeads({ db, meRow, pid, openModal, mutate }) {
  const [view, setView] = useState("all");
  const all = apnLeadsOf(db, pid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = view === "all" ? all : view === "open" ? all.filter((l) => !["Converted", "Lost", "Invalid", "Fake", "Duplicate"].includes(l.status)) : all.filter((l) => l.status === "Converted");
  return (
    <div>
      <div className="apn-section-h">My leads</div>
      <div className="apn-seg-scroll">{[["all", "All"], ["open", "Active"], ["converted", "Converted"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No leads yet" text="Submit your first lead to start earning commission." action={<button className="btn primary" onClick={() => openModal({ type: "apnLead" })}><Plus size={16} />Submit a lead</button>} /></div>
        : <div className="apn-list">{list.map((l) => (
          <div key={l.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{l.clientName}</div>
                <div className="hint-line" style={{ fontSize: 12, marginTop: 2 }}>{l.business ? l.business + " · " : ""}{APN_SERVICE_LABEL[l.service]} · {l.leadId}</div>
              </div>
              <span className={"badge " + apnLeadTone(l.status)}>{l.status}</span>
            </div>
            {l.status === "Converted" && l.revenue != null && <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Revenue {money(l.revenue)}{l.projectCompleted ? " · project completed" : ""}</div>}
            {APN_LEAD_REJECTED.has(l.status) && l.rejectReason && <div className="field-err" style={{ marginTop: 6 }}><AlertTriangle size={13} />{l.status}: {l.rejectReason}</div>}
            <div className="hint-line" style={{ fontSize: 11, marginTop: 6 }}>Submitted {fmtDate(new Date(l.createdAt).toISOString().slice(0, 10))}{l.ownershipLocked ? " · ownership locked to you" : ""}</div>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── quotations ──────────────────────────────────────────────────────── */
function apnPrintQuote(q, meRow) {
  const rows = (q.items || []).map((it) => `<tr><td>${it.label}</td><td style="text-align:right">₹${(Number(it.amount) || 0).toLocaleString("en-IN")}</td></tr>`).join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Quotation ${q.clientName || ""}</title>
    <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#161A20;padding:36px;max-width:720px;margin:auto}
    h1{color:#2E3B8F;margin:0 0 2px} .muted{color:#626C7A;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:18px}
    td,th{padding:10px 12px;border-bottom:1px solid #E4E8EF;font-size:14px} th{text-align:left;color:#626C7A;font-size:11px;text-transform:uppercase}
    .tot{font-weight:800;font-size:18px} .box{border:1px solid #E4E8EF;border-radius:12px;padding:16px 18px;margin-top:18px}</style></head>
    <body><h1>ALLBEE</h1><div class="muted">Quotation · ${APN_SERVICE_LABEL[q.service] || ""}</div>
    <div class="box"><b>To:</b> ${q.clientName || "—"}<br/><span class="muted">Prepared by ${meRow?.name || "APN Partner"} (${meRow?.apnId || ""})</span><br/>
    ${q.requirements ? `<div class="muted" style="margin-top:8px">${q.requirements}</div>` : ""}</div>
    <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}
    <tr><td class="tot">Total</td><td class="tot" style="text-align:right">₹${(Number(q.total) || 0).toLocaleString("en-IN")}</td></tr></tbody></table>
    <p class="muted" style="margin-top:24px">This is an approximate quotation and is subject to final confirmation by the ALLBEE sales team.</p>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
function APNQuoteForm({ meRow, initial, onSave, onClose }) {
  const [service, setService] = useState(initial?.service || "website");
  const price = APN_PRICE[service];
  const [clientName, setClientName] = useState(initial?.clientName || "");
  const [requirements, setRequirements] = useState(initial?.requirements || "");
  const [items, setItems] = useState(initial?.items || null);
  // reset line items when the service changes (unless editing an existing quote)
  const base = items || [{ id: uid(), label: price.baseLabel, amount: price.base }];
  const setBase = items ? setItems : (v) => setItems(v);
  React.useEffect(() => { if (!initial) setItems([{ id: uid(), label: APN_PRICE[service].baseLabel, amount: APN_PRICE[service].base }]); }, [service]); // eslint-disable-line
  const list = items || base;
  const total = list.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const addOpt = (label, amount) => setItems((prev) => [...(prev || base), { id: uid(), label, amount }]);
  const upItem = (id, k, v) => setItems((prev) => (prev || base).map((it) => it.id === id ? { ...it, [k]: k === "amount" ? Number(v) || 0 : v } : it));
  const rmItem = (id) => setItems((prev) => (prev || base).filter((it) => it.id !== id));
  const save = (status) => {
    if (!clientName.trim()) return;
    onSave({ id: initial?.id || uid(), partnerId: meRow.id, partnerName: meRow.name, clientName: clientName.trim(), service, requirements: requirements.trim(), items: list, total: round2(total), status, createdAt: initial?.createdAt || Date.now() });
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
      <Field label="Add-ons" hint="Tap to add — you can edit every line below.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{price.options.map(([k, label, amt]) => <button key={k} type="button" className="preset" onClick={() => addOpt(label, amt)}>+ {label} (₹{amt.toLocaleString("en-IN")})</button>)}</div>
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
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn sm" onClick={() => apnPrintQuote(q, meRow)}><Download size={13} />PDF</button>
              {q.status !== "Approved" && <button className="btn sm" onClick={() => openModal({ type: "apnQuote", initial: q })}><Pencil size={13} />Edit</button>}
            </div>
          </div>
        ))}</div>}
    </div>
  );
}

/* ── wallet ──────────────────────────────────────────────────────────── */
function APNWallet({ db, pid, stats }) {
  const rows = apnCommsOf(db, pid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-section-h">Wallet</div>
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Commission earned" v={money(stats.commission.earned)} icon={<Coins size={13} />} tone="pos" />
        <APNMetric k="Pending" v={money(stats.commission.pending)} icon={<Hourglass size={13} />} />
        <APNMetric k="Approved" v={money(stats.commission.approved)} icon={<Check size={13} />} tone="pri" />
        <APNMetric k="Payable" v={money(stats.commission.payable)} icon={<Wallet size={13} />} tone="accent" />
        <APNMetric k="Paid" v={money(stats.commission.paid)} icon={<BadgeCheck size={13} />} tone="pos" />
      </div>
      <div className="apn-rowcard" style={{ padding: 0 }}>
        <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Commission history</div>
        {rows.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Coins size={22} color="var(--muted)" />} title="No commission yet" text="Commission appears once a converted project is paid and completed. Payouts land on the 5th of the next month." /></div>
          : rows.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.project}{c.kind === "district" ? " (district 1%)" : ""}</div>
                <div className="hint-line" style={{ fontSize: 12 }}>Revenue {money(c.revenue)} · {c.rate}% · pay {fmtDate(c.payoutDate)}</div>
              </div>
              <div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{money(c.amount)}</div><span className={"badge " + apnCommTone(c.status)} style={{ marginTop: 4 }}>{c.status}</span></div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── training + quiz ─────────────────────────────────────────────────── */
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
  const passQuiz = (score) => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, unlocked: { ...(u.unlocked || {}), [cat]: true }, quizPasses: { ...(u.quizPasses || {}), [cat]: score } } : u) }), null);
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
function APNTargets({ db, pid, mutate }) {
  const list = (db.apn_targets || []).filter((t) => t.partnerId === pid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const ack = (t) => mutate((d) => ({ ...d, apn_targets: (d.apn_targets || []).map((x) => x.id === t.id ? { ...x, acknowledged: true, acknowledgedAt: Date.now() } : x) }), null);
  return (
    <div>
      <div className="apn-section-h">My targets</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<Target size={22} color="var(--muted)" />} title="No targets assigned" text="Targets from your admin or district head will show up here." /></div>
        : <div className="apn-list">{list.map((t) => { const p = apnTargetProgress(db, t); return (
          <div key={t.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{t.title}</div><div className="hint-line" style={{ fontSize: 12 }}>{t.goal} {apnMetricLabel(t.metric).toLowerCase()} · by {t.assignedByName || "Admin"}</div></div>
              <span className={"badge " + (p.pct >= 100 ? "pos" : "pri")}>{p.raw}/{p.goal}</span>
            </div>
            <div className="progress-track" style={{ marginTop: 10 }}><div className="progress-fill" style={{ width: p.pct + "%", background: p.pct >= 100 ? "var(--pos)" : "var(--primary)" }} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              {t.acknowledged ? <span className="badge pos"><Check size={11} style={{ marginRight: 3 }} />Acknowledged</span> : <button className="btn sm primary" onClick={() => ack(t)}><Check size={13} />Acknowledge target</button>}
            </div>
          </div>
        ); })}</div>}
    </div>
  );
}

/* ── documents ───────────────────────────────────────────────────────── */
function APNDocuments({ db }) {
  const list = (db.apn_documents || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
function APNNotifications({ db, meRow, pid, mutate }) {
  const list = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  React.useEffect(() => {
    const unread = list.filter((n) => !(meRow.notifReads || []).includes(n.id)).map((n) => n.id);
    if (unread.length) mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === pid ? { ...u, notifReads: [...(u.notifReads || []), ...unread] } : u) }), null);
  }, []); // eslint-disable-line
  return (
    <div>
      <div className="apn-section-h">Notifications</div>
      {list.length === 0 ? <div className="apn-rowcard"><Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications" text="Training, commission and target updates will appear here." /></div>
        : <div className="apn-list">{list.map((n) => (
          <div key={n.id} className="apn-rowcard">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontWeight: 700, flex: 1 }}>{n.title}</div>{n.level && n.level !== "General" && <span className={"badge " + (n.level === "Urgent" ? "neg" : "accent")}>{n.level}</span>}</div>
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
  const fmtVal = (v) => (metric === "projects" ? String(v) : money(v));
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
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{r.u.name}{r.u.id === pid ? " (you)" : ""}</div><div className="hint-line" style={{ fontSize: 11 }}>{r.u.district || "—"}</div></div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmtVal(r.v)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── district head dashboard ─────────────────────────────────────────── */
function APNDistrict({ db, meRow, mutate }) {
  const district = meRow.district;
  const partners = (db.apn_users || []).filter((u) => u.district === district && u.role !== "district_head" && u.status !== "rejected");
  const leads = (db.apn_leads || []).filter((l) => partners.some((p) => p.id === l.partnerId));
  const converted = leads.filter((l) => l.status === "Converted");
  const revenue = round2(converted.reduce((s, l) => s + (Number(l.revenue) || 0), 0));
  const recommend = (p) => mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === p.id ? { ...u, reactivationRecommended: Date.now(), reactivationRecommendedBy: meRow.name } : u) }), null);
  return (
    <div>
      <div className="apn-section-h">District — {district}</div>
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Partners" v={partners.length} icon={<UserPlus size={13} />} />
        <APNMetric k="District revenue" v={money(revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Leads" v={leads.length} icon={<UserPlus size={13} />} />
        <APNMetric k="Conversions" v={converted.length} icon={<BadgeCheck size={13} />} />
      </div>
      <div className="banner" style={{ margin: "0 0 12px" }}><ShieldCheck size={15} />You can recommend reactivation and monitor partners. Only an admin can reactivate accounts or change commissions.</div>
      <div className="apn-list">{partners.map((p) => { const s = apnPartnerStats(db, p.id); const eff = apnEffectiveStatus(p); return (
        <div key={p.id} className="apn-rowcard">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{p.name}</div><div className="hint-line" style={{ fontSize: 12 }}>{p.apnId} · {s.level.name} · {money(s.revenue)}</div></div>
            <span className={"badge " + (eff === "active" ? "pos" : eff === "inactive" ? "neg" : "")}>{eff}</span>
          </div>
          {eff === "inactive" && (p.reactivationRecommended ? <div className="hint-line" style={{ marginTop: 6, fontSize: 12 }}>Reactivation recommended</div> : <button className="btn sm" style={{ marginTop: 8 }} onClick={() => recommend(p)}><RefreshCw size={13} />Recommend reactivation</button>)}
        </div>
      ); })}</div>
    </div>
  );
}

/* ── profile ─────────────────────────────────────────────────────────── */
function APNProfile({ meRow, stats, sessionEmail, onSignOut }) {
  const row = (k, v) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}><span className="hint-line">{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v || "—"}</span></div>;
  return (
    <div>
      <div className="apn-section-h">My profile</div>
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div className="apn-hero">
          <span className="av" style={{ background: avatarColor(meRow.name) }}>{(meRow.name || "P")[0]}</span>
          <div><div style={{ fontWeight: 800, fontSize: 17 }}>{meRow.name}</div><div className="hint-line">{meRow.apnId} · {stats.level.name}</div></div>
        </div>
      </div>
      <div className="apn-rowcard">
        {row("APN ID", meRow.apnId)}
        {row("Mobile", meRow.mobile)}
        {row("Email", sessionEmail || meRow.email)}
        {row("Date of birth", meRow.dob ? fmtDate(meRow.dob) : "—")}
        {row("District", meRow.district)}
        {row("Taluk", meRow.taluk)}
        {row("City", meRow.city)}
        {row("Occupation", meRow.occupation)}
        {row("College", meRow.college)}
        {row("Level", `${stats.level.name} (Level ${stats.level.key})`)}
        {row("Commission rate", stats.level.rate + "%")}
      </div>
      <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
    </div>
  );
}

/* ── APN global search ───────────────────────────────────────────────── */
function APNSearch({ db, meRow, pid, go, onClose }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }, []);
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
      <div className="cmdk">
        <div className="cmdk-input"><Search size={20} color="var(--muted)" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads, quotations, materials…" /><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={onClose}><X size={16} /></button></div>
        <div className="cmdk-results">
          {!q.trim() ? <div className="cmdk-empty">Search your leads, quotations, targets, training and materials.</div>
            : results.length === 0 ? <div className="cmdk-empty">No matches for “{q}”.</div>
              : results.map((r) => (
                <div key={r.id} className="cmdk-item" onMouseDown={(e) => { e.preventDefault(); go(r.tab); onClose(); }}>
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

/* ── portal shell ────────────────────────────────────────────────────── */
function APNPortal({ db, profile, session, signOut, isDark, mutate }) {
  const pid = profile.id;
  const meRow = apnMe(db, pid);
  const [tab, setTab] = useState("home");
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setSearchOpen((v) => !v); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!meRow) return (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <style>{CSS}</style><div style={{ color: "var(--muted)", display: "flex", gap: 10, alignItems: "center" }}><Hexagon size={20} className="spin" />Setting up your APN account…</div>
    </div>
  );

  const eff = apnEffectiveStatus(meRow);
  if (eff === "pending") return <APNGate isDark={isDark} icon={<Hourglass size={26} />} title="Application received" body={`Thanks ${meRow.name}. Your APN partner application (${meRow.apnId}) is pending approval from an admin. You'll get full access as soon as it's approved.`} onSignOut={signOut} />;
  if (eff === "rejected") return <APNGate isDark={isDark} tone="neg" icon={<XCircle size={26} />} title="Application not approved" body={meRow.rejectReason ? `Reason: ${meRow.rejectReason}` : "Your APN partner application was not approved. Contact ALLBEE for details."} onSignOut={signOut} />;
  if (eff === "inactive") return <APNInactive meRow={meRow} db={db} mutate={mutate} onSignOut={signOut} isDark={isDark} pid={pid} />;

  const stats = apnPartnerStats(db, pid);
  const isHead = meRow.role === "district_head";
  const go = (t) => { setTab(t); setMoreOpen(false); };
  const unreadNotif = (db.apn_notifications || []).filter((n) => apnNotifVisible(n, meRow) && !(meRow.notifReads || []).includes(n.id)).length;
  const unackTargets = (db.apn_targets || []).filter((t) => t.partnerId === pid && !t.acknowledged).length;

  const section = () => {
    switch (tab) {
      case "home": return <APNHome db={db} meRow={meRow} stats={stats} pid={pid} go={go} openModal={setModal} mutate={mutate} />;
      case "leads": return <APNLeads db={db} meRow={meRow} pid={pid} openModal={setModal} mutate={mutate} />;
      case "wallet": return <APNWallet db={db} pid={pid} stats={stats} />;
      case "learn": return <APNTraining db={db} meRow={meRow} pid={pid} mutate={mutate} />;
      case "targets": return <APNTargets db={db} pid={pid} mutate={mutate} />;
      case "quotations": return <APNQuotations db={db} meRow={meRow} pid={pid} openModal={setModal} />;
      case "documents": return <APNDocuments db={db} />;
      case "notifications": return <APNNotifications db={db} meRow={meRow} pid={pid} mutate={mutate} />;
      case "achievements": return <APNAchievements db={db} pid={pid} />;
      case "leaderboard": return <APNLeaderboard db={db} meRow={meRow} pid={pid} />;
      case "district": return isHead ? <APNDistrict db={db} meRow={meRow} mutate={mutate} /> : <APNHome db={db} meRow={meRow} stats={stats} pid={pid} go={go} openModal={setModal} mutate={mutate} />;
      case "profile": return <APNProfile meRow={meRow} stats={stats} sessionEmail={session?.user?.email} onSignOut={signOut} />;
      default: return null;
    }
  };

  const moreItems = [
    ["targets", "Targets", <Target size={20} color="var(--primary)" />, unackTargets],
    ["quotations", "Quotations", <FileText size={20} color="var(--primary)" />, 0],
    ["documents", "Materials", <BookOpen size={20} color="var(--primary)" />, 0],
    ["notifications", "Notifications", <Bell size={20} color="var(--primary)" />, unreadNotif],
    ["achievements", "Achievements", <Award size={20} color="var(--primary)" />, 0],
    ["leaderboard", "Leaderboard", <Trophy size={20} color="var(--primary)" />, 0],
    ...(isHead ? [["district", "District", <MapPin size={20} color="var(--primary)" />, 0]] : []),
    ["profile", "Profile", <User size={20} color="var(--primary)" />, 0],
  ];
  const primary = [["home", "Home", Home], ["leads", "Leads", UserPlus], ["wallet", "Wallet", Wallet], ["learn", "Learn", GraduationCap]];
  const showFab = tab === "leads" || tab === "quotations";

  return (
    <div className="allbee apn" data-theme={isDark ? "dark" : "light"}>
      <style>{CSS}</style>
      <header className="apn-top">
        <img className="brand-logo" src={LOGO_ICON} alt="APN" />
        <div style={{ flex: 1, minWidth: 0 }}><h1>APN</h1><div className="apn-id">{meRow.apnId} · {meRow.district || "Tamil Nadu"}</div></div>
        <button className="iconbtn" style={{ width: 34, height: 34 }} onClick={() => setSearchOpen(true)} title="Search"><Search size={17} /></button>
        <button className="iconbtn" style={{ width: 34, height: 34, position: "relative" }} onClick={() => go("notifications")}><Bell size={17} />{unreadNotif > 0 && <span className="badge pri" style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, lineHeight: "16px" }}>{unreadNotif}</span>}</button>
      </header>

      <div className="apn-body">{section()}</div>

      {showFab && <button className="apn-fab" onClick={() => setModal({ type: tab === "leads" ? "apnLead" : "apnQuote" })}><Plus size={24} /></button>}

      <nav className="apn-bottomnav">
        {primary.map(([k, l, Icon]) => (
          <button key={k} className={"apn-tab" + (tab === k ? " on" : "")} onClick={() => go(k)}><Icon size={20} /><span>{l}</span></button>
        ))}
        <button className={"apn-tab" + (["targets", "quotations", "documents", "notifications", "achievements", "leaderboard", "district", "profile"].includes(tab) ? " on" : "")} onClick={() => setMoreOpen(true)}>
          <Menu size={20} /><span>More</span>{(unreadNotif + unackTargets) > 0 && <span className="tb">{unreadNotif + unackTargets}</span>}
        </button>
      </nav>

      {moreOpen && (
        <div className="apn-more" onMouseDown={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
          <div className="apn-more-sheet">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}><div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>More</div><button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => setMoreOpen(false)}><X size={16} /></button></div>
            <div className="apn-more-grid">
              {moreItems.map(([k, l, ic, badge]) => (
                <button key={k} className="apn-more-item" style={{ position: "relative" }} onClick={() => go(k)}>{ic}<span>{l}</span>{badge > 0 && <span className="badge pri" style={{ position: "absolute", top: 8, right: 8, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, lineHeight: "16px" }}>{badge}</span>}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {searchOpen && <APNSearch db={db} meRow={meRow} pid={pid} go={go} onClose={() => setSearchOpen(false)} />}
      {modal?.type === "apnLead" && <APNLeadForm meRow={meRow} db={db} onSave={(l) => mutate((d) => ({ ...d, apn_leads: [...(d.apn_leads || []), l] }), null)} onClose={() => setModal(null)} />}
      {modal?.type === "apnQuote" && <APNQuoteForm meRow={meRow} initial={modal.initial} onSave={(qq) => mutate((d) => ({ ...d, apn_quotations: (d.apn_quotations || []).some((x) => x.id === qq.id) ? d.apn_quotations.map((x) => x.id === qq.id ? qq : x) : [...(d.apn_quotations || []), qq] }), null)} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   APN ADMIN (internal) — run by Haji / Alim / admins. Approvals, District Head
   appointment and reactivation are partner-only (superadmin) actions.
══════════════════════════════════════════════════════════════════════ */
const apnNotify = (n) => ({ id: uid(), title: n.title || "", body: n.body || "", audience: n.audience || "all", level: n.level || "General", reads: [], createdAt: Date.now() });

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
function APNTargetForm({ partners, onSave, onClose }) {
  const [f, setF] = useState({ partnerId: partners[0]?.id || "", title: "", metric: "leads", goal: 5 });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.partnerId || !f.title.trim()) return;
    const p = partners.find((x) => x.id === f.partnerId);
    onSave({ id: uid(), partnerId: f.partnerId, partnerName: p?.name || "", title: f.title.trim(), metric: f.metric, goal: Number(f.goal) || 0, acknowledged: false, createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Assign target" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Assign</button></>}>
      <Field label="Partner"><select className="select" value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}>{partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.apnId})</option>)}</select></Field>
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
function APNQuizForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { category: "website", title: "", passPct: 60, questions: [{ id: uid(), q: "", options: ["", "", "", ""], answer: 0 }] });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setQ = (qi, patch) => setF((s) => ({ ...s, questions: s.questions.map((q, i) => i === qi ? { ...q, ...patch } : q) }));
  const setOpt = (qi, oi, v) => setF((s) => ({ ...s, questions: s.questions.map((q, i) => i === qi ? { ...q, options: q.options.map((o, j) => j === oi ? v : o) } : q) }));
  const addQ = () => setF((s) => ({ ...s, questions: [...s.questions, { id: uid(), q: "", options: ["", "", "", ""], answer: 0 }] }));
  const rmQ = (qi) => setF((s) => ({ ...s, questions: s.questions.filter((_, i) => i !== qi) }));
  const save = () => {
    const questions = f.questions.filter((q) => q.q.trim() && q.options.filter((o) => o.trim()).length >= 2);
    if (!f.title.trim() || !questions.length) return;
    onSave({ ...initial, id: initial?.id || uid(), category: f.category, title: f.title.trim(), passPct: Number(f.passPct) || 60, questions, createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit quiz" : "Create quiz"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={15} />Save quiz</button></>}>
      <div className="grid2">
        <Field label="Category" hint="Passing unlocks this category's leads."><select className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{APN_SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Pass %"><input className="input mono" type="number" min="1" max="100" value={f.passPct} onChange={(e) => set("passPct", e.target.value)} /></Field>
      </div>
      <Field label="Title" required><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website sales quiz" /></Field>
      {f.questions.map((q, qi) => (
        <div key={q.id} className="bug-card">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={q.q} onChange={(e) => setQ(qi, { q: e.target.value })} placeholder={`Question ${qi + 1}`} style={{ flex: 1 }} />
            {f.questions.length > 1 && <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => rmQ(qi)}><X size={14} /></button>}
          </div>
          {q.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="radio" checked={q.answer === oi} onChange={() => setQ(qi, { answer: oi })} title="Correct answer" />
              <input className="input" value={o} onChange={(e) => setOpt(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} style={{ flex: 1 }} />
            </div>
          ))}
          <div className="hint-line" style={{ fontSize: 11 }}>Select the radio next to the correct answer.</div>
        </div>
      ))}
      <button className="btn" onClick={addQ}><Plus size={15} />Add question</button>
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
function APNNotifForm({ partners, onSave, onClose }) {
  const [f, setF] = useState({ title: "", body: "", level: "General", audience: "all", partnerId: "", district: TN_DISTRICTS[0] });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!f.title.trim()) return;
    const audience = f.audience === "partner" ? "partner:" + f.partnerId : f.audience === "district" ? "district:" + f.district : "all";
    if (f.audience === "partner" && !f.partnerId) return;
    onSave(apnNotify({ title: f.title.trim(), body: f.body.trim(), level: f.level, audience }));
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
      {f.audience === "partner" && <Field label="Partner"><select className="select" value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}><option value="">Select…</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.apnId})</option>)}</select></Field>}
    </Modal>
  );
}

/* ── admin sub-views ─────────────────────────────────────────────────── */
function APNAdminPartners({ db, isSuper, act, openModal }) {
  const [view, setView] = useState("pending");
  const users = db.apn_users || [];
  const counts = { pending: users.filter((u) => u.status === "pending").length, active: users.filter((u) => apnEffectiveStatus(u) === "active").length, inactive: users.filter((u) => apnEffectiveStatus(u) === "inactive").length, heads: users.filter((u) => u.role === "district_head").length };
  const list = users.filter((u) => view === "all" ? true : view === "pending" ? u.status === "pending" : view === "heads" ? u.role === "district_head" : apnEffectiveStatus(u) === view).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="sumrow">
        <div className="card"><div className="k"><Hourglass size={14} /> Pending</div><div className="v mono">{counts.pending}</div></div>
        <div className="card"><div className="k"><Check size={14} color="var(--pos)" /> Active</div><div className="v mono">{counts.active}</div></div>
        <div className="card"><div className="k"><XCircle size={14} /> Inactive</div><div className="v mono">{counts.inactive}</div></div>
        <div className="card"><div className="k"><ShieldCheck size={14} /> District heads</div><div className="v mono">{counts.heads}</div></div>
      </div>
      <div className="apn-seg-scroll">{[["pending", "Pending"], ["active", "Active"], ["inactive", "Inactive"], ["heads", "District heads"], ["all", "All"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No partners here" text="Applications and partners show up in these tabs." action={isSuper ? <button className="btn primary" onClick={() => openModal({ type: "apnCreatePartner" })}><Plus size={16} />Add partner</button> : undefined} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Partner</th><th>District</th><th>Level</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((p) => { const s = apnPartnerStats(db, p.id); const eff = apnEffectiveStatus(p); return (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 600 }}>{p.name}{p.role === "district_head" && <span className="badge pri" style={{ marginLeft: 6 }}>Head</span>}</div><div className="hint-line" style={{ fontSize: 11 }}>{p.apnId} · {p.mobile || "—"}{p.reactivationRequested || p.reactivationRecommended ? " · ⟳ reactivation requested" : ""}</div></td>
                <td>{p.district || "—"}<div className="hint-line" style={{ fontSize: 11 }}>{p.taluk || ""}</div></td>
                <td><span className="tag">{s.level.name}</span><div className="hint-line" style={{ fontSize: 11 }}>{money(s.revenue)} · {s.completed} done</div></td>
                <td><span className={"status-pill " + (eff === "active" ? "status-active" : eff === "inactive" ? "status-suspended" : eff === "rejected" ? "status-terminated" : "status-on_leave")}>{eff}</span></td>
                <td><div className="row-actions" style={{ flexWrap: "wrap", gap: 4 }}>
                  {p.status === "pending" && <><button className="btn sm primary" onClick={() => act.approve(p)}><Check size={13} />Approve</button><button className="btn sm danger" onClick={() => openModal({ type: "apnReject", partner: p })}>Reject</button></>}
                  {eff === "active" && isSuper && <button className="btn sm" onClick={() => act.deactivate(p)}>Deactivate</button>}
                  {eff === "inactive" && isSuper && <button className="btn sm primary" onClick={() => act.reactivate(p)}><RefreshCw size={13} />Reactivate</button>}
                  {isSuper && eff === "active" && (p.role === "district_head" ? <button className="btn sm" onClick={() => act.setHead(p, false)}>Remove head</button> : <button className="btn sm" onClick={() => act.setHead(p, true)}><ShieldCheck size={13} />Make head</button>)}
                </div></td>
              </tr>
            ); })}</tbody>
          </table></div>}
      </div>
    </div>
  );
}
function APNAdminLeads({ db, openModal }) {
  const [view, setView] = useState("Submitted");
  const list = (db.apn_leads || []).filter((l) => view === "all" ? true : l.status === view).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="apn-seg-scroll">{["Submitted", "Approved", "Quotation Sent", "Converted", "all"].map((k) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{k === "all" ? "All" : k}</button>)}</div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="No leads" text="Partner-submitted leads appear here for review." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Lead</th><th>Partner</th><th>Service</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((l) => (
              <tr key={l.id}>
                <td><div style={{ fontWeight: 600 }}>{l.clientName}</div><div className="hint-line" style={{ fontSize: 11 }}>{l.business || "—"} · {l.mobile} · {l.leadId}</div></td>
                <td>{l.partnerName}</td>
                <td><span className="tag">{APN_SERVICE_LABEL[l.service]}</span>{l.status === "Converted" && <div className="hint-line" style={{ fontSize: 11 }}>{money(l.revenue)}{l.projectCompleted ? " · done" : ""}</div>}</td>
                <td><span className={"badge " + apnLeadTone(l.status)}>{l.status}</span></td>
                <td><button className="btn sm" onClick={() => openModal({ type: "apnLeadManage", lead: l })}><Pencil size={13} />Manage</button></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}
function APNAdminCommissions({ db, setCommStatus }) {
  const [view, setView] = useState("Pending");
  const list = (db.apn_commissions || []).filter((c) => view === "all" ? true : c.status === view).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const partnerName = (id) => (db.apn_users || []).find((u) => u.id === id)?.name || "—";
  const totals = APN_COMM_STATUS.map((s) => [s, round2((db.apn_commissions || []).filter((c) => c.status === s).reduce((a, c) => a + (Number(c.amount) || 0), 0))]);
  return (
    <div>
      <div className="sumrow">{totals.map(([s, v]) => <div key={s} className="card"><div className="k">{s}</div><div className="v mono">{money(v)}</div></div>)}</div>
      <div className="apn-seg-scroll">{[...APN_COMM_STATUS, "all"].map((k) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{k === "all" ? "All" : k}</button>)}</div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<Coins size={22} color="var(--muted)" />} title="No commissions" text="Commissions are generated when a converted project is paid and completed." />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Partner</th><th>Project</th><th className="num-cell">Amount</th><th>Payout</th><th>Status</th></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.id}>
                <td>{partnerName(c.partnerId)}{c.kind === "district" && <span className="badge" style={{ marginLeft: 5 }}>District 1%</span>}</td>
                <td>{c.project}<div className="hint-line" style={{ fontSize: 11 }}>{money(c.revenue)} · {c.rate}%</div></td>
                <td className="num-cell mono" style={{ fontWeight: 700 }}>{money(c.amount)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{fmtDate(c.payoutDate)}</td>
                <td><select className="select" style={{ width: "auto", padding: "4px 6px" }} value={c.status} onChange={(e) => setCommStatus(c, e.target.value)}>{APN_COMM_STATUS.map((s) => <option key={s}>{s}</option>)}</select></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}
function APNAdminContent({ db, openModal, removeRow }) {
  const training = (db.apn_training || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const quizzes = (db.apn_quizzes || []);
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Training</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnTraining" })}><Plus size={15} />Lesson</button></div>
      <div className="apn-list" style={{ marginBottom: 18 }}>
        {training.length === 0 ? <div className="card stat"><Empty icon={<GraduationCap size={20} color="var(--muted)" />} title="No lessons yet" text="Add sales training for each category." /></div>
          : training.map((t) => (
            <div key={t.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{APN_SERVICE_LABEL[t.category]}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{t.title}</div>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnTraining", initial: t })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_training", t.id, `deleted APN lesson "${t.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Quizzes</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnQuiz" })}><Plus size={15} />Quiz</button></div>
      <div className="apn-list">
        {quizzes.length === 0 ? <div className="card stat"><Empty icon={<ClipboardCheck size={20} color="var(--muted)" />} title="No quizzes yet" text="A passed quiz unlocks that category's lead submission for partners." /></div>
          : quizzes.map((qz) => (
            <div key={qz.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{APN_SERVICE_LABEL[qz.category]}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{qz.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{(qz.questions || []).length} questions · pass {qz.passPct || 60}%</div></div>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnQuiz", initial: qz })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_quizzes", qz.id, `deleted APN quiz "${qz.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
function APNAdminDocs({ db, openModal, removeRow }) {
  const list = (db.apn_documents || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Sales materials</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnDoc" })}><Plus size={15} />Upload</button></div>
      <div className="apn-list">
        {list.length === 0 ? <div className="card stat"><Empty icon={<FileText size={20} color="var(--muted)" />} title="No materials" text="Upload scripts, price lists, brochures and posters for partners." /></div>
          : list.map((d) => (
            <div key={d.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{d.category}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{d.title}</div>
              <a className="iconbtn" style={{ width: 30, height: 30 }} href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnDoc", initial: d })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_documents", d.id, `deleted APN material "${d.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
function APNAdminLeaderboard({ db }) {
  const [scope, setScope] = useState("company");
  const [district, setDistrict] = useState(TN_DISTRICTS[0]);
  const [metric, setMetric] = useState("revenue");
  const rows = apnLeaderboard(db, scope, district, metric);
  const fmtVal = (v) => (metric === "projects" ? String(v) : money(v));
  return (
    <div>
      <div className="filterbar">
        <Field label="Scope"><select className="select" value={scope} onChange={(e) => setScope(e.target.value)}><option value="company">Company-wide</option><option value="district">District</option></select></Field>
        {scope === "district" && <Field label="District"><select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>}
        <Field label="Rank by"><select className="select" value={metric} onChange={(e) => setMetric(e.target.value)}><option value="revenue">Top revenue</option><option value="commission">Top commission</option><option value="projects">Top projects</option></select></Field>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty icon={<Trophy size={22} color="var(--muted)" />} title="No ranking yet" text="Rankings appear as partners close deals." />
          : rows.map((r, i) => (
            <div key={r.u.id} className="apn-rank">
              <div className={"pos" + (i === 0 ? " g1" : i === 1 ? " g2" : i === 2 ? " g3" : "")}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{r.u.name}</div><div className="hint-line" style={{ fontSize: 11 }}>{r.u.apnId} · {r.u.district || "—"}</div></div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmtVal(r.v)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── admin shell ─────────────────────────────────────────────────────── */
function APNCreatePartnerForm({ db, mutate, currentUser, onClose }) {
  const [f, setF] = useState({ name: "", email: "", password: "", mobile: "", district: TN_DISTRICTS[0], taluk: "", city: "", occupation: "", college: "", username: "", reason: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const create = async () => {
    setErr("");
    if (!f.name.trim()) { setErr("Enter the partner's full name."); return; }
    if (!f.email.trim()) { setErr("Enter an email."); return; }
    if (f.password.length < 6) { setErr("Set a password of at least 6 characters."); return; }
    if (!f.mobile.trim()) { setErr("Enter a mobile number."); return; }
    if (!f.district) { setErr("Choose a district."); return; }
    setBusy(true);
    try {
      // 1) create a confirmed login via the same edge function used to add staff
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "create", email: f.email.trim(), password: f.password, name: f.name.trim(), role: "staff" } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      // 2) resolve the new user id (works whatever the function returns)
      let newId = data && (data.id || (data.user && data.user.id) || data.userId);
      if (!newId) { const { data: p1 } = await supabase.from("profiles").select("id").eq("email", f.email.trim().toLowerCase()).maybeSingle(); newId = p1 && p1.id; }
      if (!newId) { const { data: p2 } = await supabase.from("profiles").select("id").eq("email", f.email.trim()).maybeSingle(); newId = p2 && p2.id; }
      if (!newId) throw new Error("Account created, but couldn't link the APN profile automatically. Ask them to sign in once, then approve them from Pending.");
      // 3) make the profile a partner (so they land in the APN portal) and approved
      await supabase.from("profiles").update({ role: "partner", approved: true }).eq("id", newId);
      // 4) assign the next APN id
      let n = await nextApnNumber();
      if (n == null) { const nums = (db.apn_users || []).map((u) => Number(String(u.apnId || "").replace(/\D/g, "")) || 0); n = (nums.length ? Math.max(...nums) : 0) + 1; }
      const row = {
        id: newId, apnId: apnPadId(n), name: f.name.trim(), mobile: f.mobile.trim(), email: f.email.trim(), dob: "",
        district: f.district, taluk: f.taluk.trim(), city: f.city.trim(), occupation: f.occupation.trim(),
        college: f.college.trim(), reason: f.reason.trim(), username: f.username.trim().toLowerCase(),
        status: "active", role: "partner", approvedBy: currentUser, approvedAt: Date.now(),
        unlocked: {}, quizPasses: {}, createdAt: Date.now(),
      };
      // 5) create the APN profile row (active — the admin is vouching for them)
      mutate((d) => ({ ...d, apn_users: (d.apn_users || []).some((u) => u.id === newId) ? d.apn_users.map((u) => u.id === newId ? { ...u, ...row } : u) : [...(d.apn_users || []), row] }), { action: `added APN partner "${f.name.trim()}"`, module: "APN" });
      setOk(`${f.name.trim()} (${row.apnId}) can sign in right away with the email and password you set — no email confirmation needed.`);
    } catch (e) {
      const msg = (e && e.message) || "Couldn't create the partner.";
      setErr(/already registered|already been registered|duplicate|exists/i.test(msg) ? "That email already has an account — use a different email."
        : /admin-users|not deployed|Failed to send a request|Function|non-2xx/i.test(msg) ? "This needs the admin-users edge function deployed (the same one used to add staff on the Team screen)."
        : msg);
    } finally { setBusy(false); }
  };
  if (ok) return <Modal title="Partner added 🎉" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}><div className="banner" style={{ margin: 0, borderColor: "var(--pos)" }}><BadgeCheck size={15} color="var(--pos)" />{ok}</div></Modal>;
  return (
    <Modal title="Add APN partner" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create} disabled={busy}>{busy ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}Create partner</button></>}>
      <div className="banner" style={{ margin: "0 0 12px" }}><GaugeCircle size={15} />Creates a ready-to-use partner account — confirmed and approved, so they can sign in immediately. Share the password with them securely.</div>
      <div className="grid2">
        <Field label="Full name" required><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Partner name" /></Field>
        <Field label="Mobile" required><input className="input" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10-digit mobile" /></Field>
      </div>
      <div className="grid2">
        <Field label="Email" required><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Password" required hint="At least 6 characters."><input className="input" type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Temporary password" /></Field>
      </div>
      <div className="grid2">
        <Field label="District" required><select className="select" value={f.district} onChange={(e) => set("district", e.target.value)}>{TN_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Taluk"><input className="input" value={f.taluk} onChange={(e) => set("taluk", e.target.value)} placeholder="Taluk" /></Field>
      </div>
      <div className="grid2">
        <Field label="City / town"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="City" /></Field>
        <Field label="Occupation"><input className="input" value={f.occupation} onChange={(e) => set("occupation", e.target.value)} placeholder="Student, freelancer…" /></Field>
      </div>
      <div className="grid2">
        <Field label="College (optional)"><input className="input" value={f.college} onChange={(e) => set("college", e.target.value)} placeholder="College" /></Field>
        <Field label="Username (optional)"><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="Sign-in username" /></Field>
      </div>
      <Field label="Notes / why joining (optional)"><textarea className="textarea" value={f.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
      {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
    </Modal>
  );
}

function APNAdmin({ db, mutate, isSuper, currentUser }) {
  const [tab, setTab] = useState("partners");
  const [modal, setModal] = useState(null);
  const partners = (db.apn_users || []).filter((u) => u.status !== "rejected");
  const M = (action) => ({ action, module: "APN" });
  const removeRow = (table, id, action) => mutate((d) => ({ ...d, [table]: (d[table] || []).filter((x) => x.id !== id) }), M(action));

  const act = {
    approve: (p) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "active", approvedAt: Date.now(), approvedBy: currentUser } : u), apn_notifications: [...(d.apn_notifications || []), apnNotify({ title: "Welcome to APN 🎉", body: "Your partner account is approved. Complete training, pass a quiz, and start submitting leads.", audience: "partner:" + p.id })] }), M(`approved APN partner "${p.name}"`)),
    reject: (p, reason) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "rejected", rejectReason: reason } : u) }), M(`rejected APN application "${p.name}"`)),
    deactivate: (p) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "inactive" } : u) }), M(`deactivated APN partner "${p.name}"`)),
    reactivate: (p) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "active", reactivatedAt: Date.now(), reactivationRequested: null, reactivationRecommended: null } : u), apn_notifications: [...(d.apn_notifications || []), apnNotify({ title: "Account reactivated", body: "Your APN account is active again. Remember to check in daily.", audience: "partner:" + p.id })] }), M(`reactivated APN partner "${p.name}"`)),
    setHead: (p, on) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, role: on ? "district_head" : "partner" } : u) }), M(`${on ? "appointed" : "removed"} district head "${p.name}"`)),
  };
  const saveLead = (lead) => mutate((d) => {
    let next = { ...d, apn_leads: (d.apn_leads || []).map((x) => x.id === lead.id ? lead : x) };
    const hasComm = (d.apn_commissions || []).some((c) => c.leadId === lead.id);
    if (lead.status === "Converted" && lead.paymentReceived && lead.projectCompleted && !hasComm) next.apn_commissions = [...(d.apn_commissions || []), ...apnBuildCommissions(next, lead)];
    return next;
  }, M(`updated APN lead "${lead.clientName}" → ${lead.status}`));
  const setCommStatus = (c, status) => mutate((d) => {
    let next = { ...d, apn_commissions: d.apn_commissions.map((x) => x.id === c.id ? { ...x, status, ...(status === "Approved" ? { approvedAt: Date.now() } : {}), ...(status === "Paid" ? { paidAt: Date.now() } : {}) } : x) };
    if (status === "Approved" && c.kind !== "district") next.apn_notifications = [...(d.apn_notifications || []), apnNotify({ title: "Commission approved ✅", body: `${money(c.amount)} for ${c.project} is approved and added to your wallet.`, audience: "partner:" + c.partnerId, level: "Important" })];
    return next;
  }, M(`set APN commission for ${c.project} → ${status}`));
  const saveTarget = (t) => mutate((d) => ({ ...d, apn_targets: [...(d.apn_targets || []), t], apn_notifications: [...(d.apn_notifications || []), apnNotify({ title: "New target assigned 🎯", body: `${t.title} — ${t.goal} ${apnMetricLabel(t.metric)}.`, audience: "partner:" + t.partnerId, level: "Important" })] }), M(`assigned APN target "${t.title}"`));
  const saveRow = (table, row, action) => mutate((d) => ({ ...d, [table]: (d[table] || []).some((x) => x.id === row.id) ? d[table].map((x) => x.id === row.id ? row : x) : [...(d[table] || []), row] }), M(action));
  const sendNotif = (n) => mutate((d) => ({ ...d, apn_notifications: [...(d.apn_notifications || []), n] }), M(`sent APN notification "${n.title}"`));

  const tabs = [["partners", "Partners"], ["leads", "Leads"], ["commissions", "Commissions"], ["targets", "Targets"], ["content", "Training"], ["docs", "Materials"], ["notify", "Notify"], ["board", "Leaderboard"]];

  return (
    <div className="content">
      <div className="page-head"><h3>APN — Partner Network</h3><span className="spacer" />
        {tab === "partners" && isSuper && <button className="btn primary" onClick={() => setModal({ type: "apnCreatePartner" })}><Plus size={16} />Add partner</button>}
        {tab === "targets" && <button className="btn primary" onClick={() => setModal({ type: "apnTarget" })}><Plus size={16} />Assign target</button>}
        {tab === "notify" && <button className="btn primary" onClick={() => setModal({ type: "apnNotif" })}><Plus size={16} />New notification</button>}
      </div>
      <div className="apn-seg-scroll" style={{ marginBottom: 16 }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === "partners" && <APNAdminPartners db={db} isSuper={isSuper} act={act} openModal={setModal} />}
      {tab === "leads" && <APNAdminLeads db={db} openModal={setModal} />}
      {tab === "commissions" && <APNAdminCommissions db={db} setCommStatus={setCommStatus} />}
      {tab === "targets" && (() => { const list = (db.apn_targets || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return (
        <div className="card">{list.length === 0 ? <Empty icon={<Target size={22} color="var(--muted)" />} title="No targets yet" text="Assign targets to partners; they must acknowledge them." action={<button className="btn primary" onClick={() => setModal({ type: "apnTarget" })}><Plus size={16} />Assign target</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Partner</th><th>Target</th><th>Progress</th><th>Acknowledged</th></tr></thead>
            <tbody>{list.map((t) => { const p = apnTargetProgress(db, t); return <tr key={t.id}><td>{t.partnerName}</td><td>{t.title}<div className="hint-line" style={{ fontSize: 11 }}>{t.goal} {apnMetricLabel(t.metric)}</div></td><td className="mono">{p.raw}/{p.goal} ({p.pct}%)</td><td>{t.acknowledged ? <span className="badge pos">Yes</span> : <span className="badge">No</span>}</td></tr>; })}</tbody>
          </table></div>}</div>
      ); })()}
      {tab === "content" && <APNAdminContent db={db} openModal={setModal} removeRow={removeRow} />}
      {tab === "docs" && <APNAdminDocs db={db} openModal={setModal} removeRow={removeRow} />}
      {tab === "notify" && (() => { const list = (db.apn_notifications || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return (
        <div className="card">{list.length === 0 ? <Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications sent" text="Send updates to all partners, a district, or one partner." action={<button className="btn primary" onClick={() => setModal({ type: "apnNotif" })}><Plus size={16} />New notification</button>} />
          : list.map((n) => <div key={n.id} className="card stat" style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 10 }}><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{n.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{n.audience === "all" ? "All partners" : n.audience.startsWith("district:") ? n.audience.slice(9) : "One partner"} · {fmtDateTime(n.createdAt)}</div></div><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_notifications", n.id, `deleted APN notification "${n.title}"`)}><Trash2 size={14} /></button></div>)}</div>
      ); })()}
      {tab === "board" && <APNAdminLeaderboard db={db} />}

      {modal?.type === "apnReject" && <APNRejectForm partner={modal.partner} onSave={(reason) => act.reject(modal.partner, reason)} onClose={() => setModal(null)} />}
      {modal?.type === "apnCreatePartner" && <APNCreatePartnerForm db={db} mutate={mutate} currentUser={currentUser} onClose={() => setModal(null)} />}
      {modal?.type === "apnLeadManage" && <APNLeadManage lead={modal.lead} onSave={saveLead} onClose={() => setModal(null)} />}
      {modal?.type === "apnTarget" && <APNTargetForm partners={partners.filter((p) => apnEffectiveStatus(p) !== "rejected")} onSave={saveTarget} onClose={() => setModal(null)} />}
      {modal?.type === "apnTraining" && <APNTrainingForm initial={modal.initial} onSave={(r) => saveRow("apn_training", r, `${modal.initial ? "updated" : "added"} APN lesson "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnQuiz" && <APNQuizForm initial={modal.initial} onSave={(r) => saveRow("apn_quizzes", r, `${modal.initial ? "updated" : "created"} APN quiz "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnDoc" && <APNDocForm initial={modal.initial} onSave={(r) => saveRow("apn_documents", r, `${modal.initial ? "updated" : "uploaded"} APN material "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnNotif" && <APNNotifForm partners={partners} onSave={sendNotif} onClose={() => setModal(null)} />}
    </div>
  );
}


export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
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
  const [balanceUser, setBalanceUser] = useState(null);
  const [accountUser, setAccountUser] = useState(null);   // full-page partner statement (Haji/Alim)
  const [taskDetailId, setTaskDetailId] = useState(null); // full-page task detail
  const [config, setConfig] = useState(null);             // app_config (T&C body + version)
  const [locks, setLocks] = useState([]);                 // locked financial periods ('YYYY-MM')
  const [navOrder, setNavOrder] = useState(() => { try { return JSON.parse(localStorage.getItem("allbee_navorder") || "null") || []; } catch { return []; } });
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem("allbee_favs") || "null") || []; } catch { return []; } });
  const [navSort, setNavSort] = useState(() => { try { return localStorage.getItem("allbee_navsort") || "category"; } catch { return "category"; } });
  const dragNavRef = useRef(null);

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
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      // Record a fresh sign-in time (best-effort; the column may not exist yet).
      if (_evt === "SIGNED_IN" && s && s.user) {
        supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", s.user.id).then(() => {}, () => {});
      }
      // Supabase auto-refreshes the JWT whenever the tab/app regains focus and
      // fires TOKEN_REFRESHED with a brand-new session object. That object change
      // used to re-run the data-load effect, flip `loading`, and remount the whole
      // page — wiping anything you were typing. Only update when the actual signed-in
      // user changes (sign in / sign out / switch account); ignore pure token
      // refreshes by returning the previous reference so React skips the update.
      setSession((prev) => {
        const prevId = prev && prev.user ? prev.user.id : null;
        const nextId = s && s.user ? s.user.id : null;
        if (prevId === nextId) return prev;   // same user → no churn, no reload
        return s ?? null;
      });
    });
    return () => sub.subscription.unsubscribe();
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

  const reload = useCallback(async () => {
    try { setDb(await fetchAll()); setSyncError(null); }
    catch (e) { setSyncError(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  // ── load data + live sync while signed in ─────────────────────────────
  useEffect(() => {
    if (!session) { setDb(null); setLoading(false); return; }
    setLoading(true);
    reload();
    const ch = supabase.channel("allbee-db-sync");
    TABLES.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, reload));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, reload]);

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
  // Audit entries are written for admin actions only (staff can't access the log).
  const mutate = useCallback((updater, audit) => {
    setDb((prev) => {
      if (!prev) return prev;
      let next = updater(prev);
      if (audit) next = { ...next, audit: [...next.audit, { id: uid(), ts: Date.now(), user: currentUser || "—", ...audit }] };
      persistWithRetry(prev, next).catch((e) => setSyncError(e.message || String(e)));
      return next;
    });
  }, [currentUser]);

  // ── soft delete (recycle bin) ─────────────────────────────────────────
  // Move a row out of its table and into `recycle` instead of destroying it.
  // Original screens need no change — the row simply disappears from their list.
  // Audit is written for admins only (staff have no access to the audit table),
  // but a staff member's deleted item is still recoverable by an admin.
  const removeItem = useCallback((table, item, opts = {}) => {
    const name = opts.name || item.name || item.title || item.client || "item";
    const module = MODULE_LABEL[table] || table;
    const rec = {
      id: uid(), table, module, name, item,
      deletedBy: currentUser || "—", deletedById: me.id || null, deletedAt: Date.now(),
    };
    mutate(
      (d) => ({ ...d, [table]: d[table].filter((x) => x.id !== item.id), recycle: [...d.recycle, rec] }),
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
      persistWithRetry(prev, next).catch((e) => setSyncError(e.message || String(e)));
      return next;
    });
  }, []);

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
      persistWithRetry(prev, next).catch((e) => setSyncError(e.message || String(e)));
      return next;
    });
  }, []);

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
    try { await replaceAll(clean); setDb(clean); setSyncError(null); }
    catch (e) { setSyncError(e.message || String(e)); }
  }, []);

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
  // Same approach as Manage user: delete the profile row (frees the email), then
  // best-effort delete their login via the admin-users edge function if deployed.
  const deleteClientAccount = useCallback(async (person) => {
    if (!person || person.role !== "client") return;
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", person.id);
      if (error) throw error;
    } catch (e) {
      setSyncError(/(permission|denied|policy|row-level)/i.test((e && e.message) || "")
        ? "The database is blocking the delete. Run allbee-delete-user.sql once, then try again."
        : ("Couldn't remove the client: " + ((e && e.message) || "unknown error")));
      return;
    }
    try { await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: person.id } }); } catch { /* edge function optional — profile already removed */ }
    mutate((d) => d, { action: `deleted client account "${person.name}"`, module: "Clients" });
    if (session) await loadPeople(session.user);
  }, [session, loadPeople, mutate]);

  // first-login profile completion + T&C acceptance (both write to my own row)
  const saveMyProfile = useCallback((patch) => changeProfile(me.id, patch), [changeProfile, me.id]);
  const acceptTnc = useCallback((agreements) => {
    const patch = {};
    let roleAccepts = null;
    for (const a of (agreements || [])) {
      if (a.key === "all") patch.tnc_version = a.version;
      else { roleAccepts = roleAccepts || { ...acceptedRoleTnc(profile) }; roleAccepts[a.key] = a.version; }
    }
    if (roleAccepts) patch.tnc_roles_accepted = roleAccepts;
    return changeProfile(me.id, patch);
  }, [changeProfile, me.id, profile]);
  // publish/edit the Terms (admins): bump the version so everyone re-accepts
  const saveTnc = useCallback(async (body) => {
    const next = Number(config?.tnc_version || 0) + 1;
    await saveConfig({ tnc_body: body, tnc_version: next });
    if (session) setConfig(await fetchConfig());
  }, [config, session]);
  // publish/edit a ROLE-SPECIFIC agreement; bumps just that role's version
  const saveRoleTnc = useCallback(async (roleKey, body) => {
    const map = roleTncOf(config);
    const cur = map[roleKey] || {};
    map[roleKey] = { body, version: Number(cur.version || 0) + 1 };
    await saveConfig({ tnc_roles: JSON.stringify(map) });
    if (session) setConfig(await fetchConfig());
  }, [config, session]);
  const saveCompany = useCallback(async (obj) => {
    await saveConfig({ company: JSON.stringify(obj || {}) });
    if (session) setConfig(await fetchConfig());
  }, [session]);
  const saveAI = useCallback(async (obj) => {
    await saveConfig({ ai: JSON.stringify(obj || {}) });
    if (session) setConfig(await fetchConfig());
  }, [session]);
  const resolveResign = (r, decision) => {
    mutate((d) => ({ ...d, resignations: (d.resignations || []).map((x) => x.id === r.id ? { ...x, status: decision, resolvedAt: Date.now() } : x) }), { action: `${decision === "Approved" ? "approved" : "declined"} ${r.userName}'s resignation request`, module: "Team" });
    if (decision === "Approved") changeProfile(r.userId, { status: "resigned", active: false });
  };

  const signOut = async () => {
    setUserMenu(false);
    try { if (me.id) await supabase.from("profiles").update({ last_logout: new Date().toISOString() }).eq("id", me.id); } catch { /* column may not exist yet */ }
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

  const saveShare = (entry, source) => {
    const prev = entry.id ? db.transactions.find((t) => t.id === entry.id) : null;
    const shareChanged = prev && (prev.hajiPct !== entry.hajiPct || prev.alimPct !== entry.alimPct);
    const shareNote = shareChanged ? ` · share ${prev.hajiPct}/${prev.alimPct} → ${entry.hajiPct}/${entry.alimPct}` : "";
    // Company expenses are split from the previous valid revenue month — record
    // which month's share was applied so the audit log has a clear trail.
    const companyNote = (entry.kind === "expense" && entry.scope === "company")
      ? ` · company split ${entry.hajiPct}/${entry.alimPct}${entry.shareSource ? ` (from ${fmtPeriod(entry.shareSource)} revenue)` : " — even split, no revenue yet"}`
      : "";
    mutate((d) => {
      let next = { ...d };
      if (entry.id && d.transactions.some((t) => t.id === entry.id)) next.transactions = d.transactions.map((t) => t.id === entry.id ? entry : t);
      else next.transactions = [...d.transactions, entry];
      // update linked source status
      if (source?.kind === "student") next.students = next.students.map((s) => s.id === source.id ? { ...s, paymentStatus: "Paid" } : s);
      if (source?.kind === "marketing") next.marketing = next.marketing.map((m) => m.id === source.id ? { ...m, lastPaid: entry.date } : m);
      return next;
    }, { action: `${entry.id ? "updated" : "added"} ${entry.kind} ${money(entry.amount)}${entry.client ? " · " + entry.client : ""}${shareNote}${companyNote}`, module: "Accounts" });
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

  const Loading = ({ note }) => (
    <div className="allbee" data-theme={isDark ? "dark" : "light"} style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <style>{CSS}</style>
      <div style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 10 }}>
        <Hexagon size={20} className="spin" /> {note || "Loading ALLBEE…"}
      </div>
    </div>
  );

  if (session === undefined) return <Loading />;
  if (!session) return <Lock isDark={isDark} setDark={setIsDark} />;
  if (profile === undefined) return <Loading note="Signing you in…" />;
  if (profile && profile.active === false)
    return <Blocked isDark={isDark} name={currentUser} onSignOut={signOut} />;
  // new staff & client sign-ups wait for a partner to approve them
  if (profile && (role === "staff" || role === "client") && profile.approved === false)
    return <ApprovalPending isDark={isDark} name={currentUser} onSignOut={signOut} />;
  // portal clients get their own surface and skip the internal profile/T&C gates
  if (role === "client") {
    if (loading || !db) return <Loading note="Loading your portal…" />;
    return <ClientPortal db={db} profile={profile} signOut={signOut} isDark={isDark} config={config} />;
  }
  // APN partners get their own mobile-first portal — fully separate from the
  // internal app, so they never reach accounts, balances, the vault or the team.
  if (role === "partner") {
    if (loading || !db) return <Loading note="Loading APN…" />;
    return <APNPortal db={db} profile={profile} session={session} signOut={signOut} isDark={isDark} mutate={mutate} />;
  }
  // first login: require the core profile details before anything else
  if (profile && (!profile.mobile || !profile.dob))
    return <ProfileSetup profile={profile} onSave={saveMyProfile} onSignOut={signOut} isDark={isDark} />;
  // then the Terms gate — show every agreement (general + role-specific) this
  // user still needs to accept; they accept all before gaining access
  const tncPending = pendingTnc(config, profile, role);
  if (profile && tncPending.length)
    return <TermsGate agreements={tncPending} onAccept={acceptTnc} onSignOut={signOut} isDark={isDark} />;
  if (loading || !db) return <Loading />;

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
  const pendingLeave = isAdmin ? db.leave.filter((l) => l.status === "Pending").length : 0;
  const unreadNotifs = db.notifications.filter((n) => notifVisibleTo(n, profile) && !(n.reads || []).includes(me.id)).length;
  const unreadChat = db.chat.filter((m) => m.userId !== me.id && !m.deleted && !(m.seenBy || []).includes(me.id)).length;
  const portalClients = team.filter((p) => p.role === "client");
  const unseenAnn = db.announcements.filter((a) => !profile?.notif_seen_at || (a.createdAt || 0) > new Date(profile.notif_seen_at).getTime()).length;

  const renderPage = () => {
    // full-page detail views take precedence over the tab routes
    if (taskDetailId) return <TaskDetail db={db} taskId={taskDetailId} me={me} isAdmin={isAdmin} currentUser={currentUser} mutate={mutate} openModal={openModal} removeItem={removeItem} goBack={goBackDetail} />;
    if (accountUser && canFinance) return <AccountFull db={db} user={accountUser} goBack={goBackDetail} />;

    switch (safeRoute) {
      case "dashboard":
        return (role === "staff" || role === "intern")
          ? <StaffDashboard db={db} me={me} go={go} mutate={mutate} openModal={openModal} team={team} />
          : <Dashboard db={db} bal={bal} go={go} openBalance={openBalance} showMoney={canFinance} showOps={isAdmin} team={team} isSuper={isSuper} />;
      case "tasks": return <Tasks db={db} mutate={mutate} openModal={openModal} isAdmin={isAdmin} currentUser={currentUser} me={me} openTask={openTask} removeItem={removeItem} />;
      case "assistant": return <AllbeeAI db={db} config={config} me={me} role={role} isAdmin={isAdmin} go={go} />;
      case "attendance": return <Attendance db={db} mutate={mutate} me={me} isAdmin={isAdmin} isSuper={isSuper} team={team} openModal={openModal} />;
      case "leave": return <Leave db={db} team={team} mutate={mutate} me={me} isAdmin={isAdmin} openModal={openModal} />;
      case "updates": return <Updates db={db} mutate={mutate} me={me} isAdmin={isAdmin} removeItem={removeItem} openModal={openModal} />;
      case "team": return <Team team={team} me={me} changeProfile={changeProfile} db={db} resolveResign={resolveResign} />;
      case "team-leads": return <TeamLeads team={team} db={db} openModal={openModal} removeItem={removeItem} me={me} />;
      case "apn": return <APNAdmin db={db} mutate={mutate} isSuper={isSuper} currentUser={currentUser} />;
      case "activity": return <LastSeen team={team} />;
      case "myteam": return <MyTeam db={db} team={team} me={me} mutate={mutate} onRefresh={reload} />;
      case "staff-salary": return <StaffSalary db={db} team={team} mutate={mutate} me={me} />;
      case "accounts": return <Accounts db={db} bal={bal} mutate={mutate} openModal={openModal} openBalance={openBalance} removeItem={removeItem} locks={locks} lockPeriod={lockPeriod} unlockPeriod={unlockPeriod} isSuper={isSuper} currentUser={currentUser} />;
      case "withdrawals": return <Withdrawals db={db} bal={bal} mutate={mutate} openModal={openModal} removeItem={removeItem} isSuper={isSuper} currentUser={currentUser} />;
      case "progress": return <Progress db={db} mutate={mutate} isAdmin={isAdmin} currentUser={currentUser} me={me} openTask={openTask} />;
      case "concepts": return <Concepts db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} />;
      case "courses": return <Courses db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} />;
      case "class-students": return <ClassStudents db={db} openModal={openModal} removeItem={removeItem} mutate={mutate} currentUser={currentUser} config={config} saveClassWebhook={saveClassWebhook} isSuper={isSuper} />;
      case "marketing": return <Marketing db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} />;
      case "projects": return <Projects db={db} mutate={mutate} openModal={openModal} openIncome={openIncome} removeItem={removeItem} canFinance={canFinance} isAdmin={isAdmin} me={me} />;
      case "inhouse": return <InHouse db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} team={team} />;
      case "testing": return <Testing db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} currentUser={currentUser} team={team} />;
      case "leads": return <Leads db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} />;
      case "clients": return <Clients db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} portalClients={portalClients} deleteClientAccount={deleteClientAccount} />;
      case "quotations": return <Quotations db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} me={me} currentUser={currentUser} isAdmin={isAdmin} />;
      case "invoices": return <Invoices db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} portalClients={portalClients} />;
      case "portal-posts": return <PortalPosts db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} portalClients={portalClients} />;
      case "planned": return <Planned db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} openIncome={openIncome} canFinance={canFinance} />;
      case "vault": return <Vault db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} />;
      case "notifications": return <Notifications db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} profile={profile} team={team} />;
      case "announcements": return <Announcements db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} />;
      case "documents": return <Documents db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} me={me} />;
      case "knowledge": return <Knowledge db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} isAdmin={isAdmin} />;
      case "prompts": return <Prompts db={db} openModal={openModal} removeItem={removeItem} />;
      case "sheets": return <Sheets db={db} openModal={openModal} removeItem={removeItem} />;
      case "terms": return <TermsPage config={config} profile={profile} role={role} isAdmin={isAdmin} go={go} />;
      case "profile": return <MyProfile profile={profile} role={role} saveMyProfile={saveMyProfile} sessionEmail={session?.user?.email} />;
      case "chat": return <Chat db={db} mutate={mutate} me={me} team={team} onRefresh={reload} isAdmin={isAdmin} />;
      case "performance": return <Performance db={db} team={team} />;
      case "rewards": return <Rewards db={db} mutate={mutate} openModal={openModal} removeItem={removeItem} me={me} isAdmin={isAdmin} team={team} />;
      case "earnings": return <MyEarnings db={db} me={me} role={role} payroll={db.payroll} profile={profile} go={go} />;
      case "recently-deleted": return <RecentlyDeleted db={db} openModal={openModal} restoreItem={restoreItem} />;
      case "audit": return <AuditLog db={db} />;
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
      {key === "tasks" && myPending > 0 && <span className="badge pri">{myPending}</span>}
      {key === "leave" && pendingLeave > 0 && <span className="badge pri">{pendingLeave}</span>}
      {key === "notifications" && unreadNotifs > 0 && <span className="badge pri">{unreadNotifs}</span>}
      {key === "chat" && unreadChat > 0 && <span className="badge pri">{unreadChat}</span>}
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

  return (
    <ErrorBoundary>
      <div className={"allbee" + (menuOpen ? " menu-open" : "")} data-theme={isDark ? "dark" : "light"}>
        <style>{CSS}</style>

        {syncError && (
          <div className="banner"><CloudOff size={15} /> Couldn't sync with the server: {syncError}</div>
        )}

        <div className="layout">
          {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />}
          <aside className="sidebar">
            <div className="brand">
              <img className="brand-logo" src={LOGO_ICON} alt="ALLBEE" style={{ height: 34 }} />
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
                <div className="company-pill" title="Company balance">
                  <Wallet size={14} color="var(--muted)" />
                  <span className="lbl">Balance</span>
                  <span className="val mono" style={{ color: bal.company < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.company)}</span>
                </div>
              )}
              <div className="usermenu">
                <button className="search-trigger" onClick={() => setSearchOpen(true)} title="Search (Ctrl K)">
                  <Search size={16} /><span className="st-lbl" style={{ flex: 1, textAlign: "left" }}>Search…</span><span className="st-kbd">Ctrl K</span>
                </button>
                <button className="iconbtn" title="Refresh" disabled={topBusy}
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
            {renderPage()}
          </div>
        </div>

        {/* MODALS */}
        {modal?.type === "income" && <ShareForm kind="income" initial={modal.initial} currentUser={currentUser} db={db} onSave={(e) => saveShare(e, modal.source)} onClose={() => setModal(null)} />}
        {modal?.type === "expense" && <ShareForm kind="expense" initial={modal.initial} currentUser={currentUser} db={db} onSave={(e) => saveShare(e, modal.source)} onClose={() => setModal(null)} />}
        {modal?.type === "withdraw" && <WithdrawForm balances={bal} defaultUser={currentUser} onSave={(w) => mutate((d) => ({ ...d, withdrawals: [...d.withdrawals, { ...w, status: isSuper ? "approved" : "pending" }] }), { action: `recorded withdrawal of ${money(w.amount)}${isSuper ? "" : " (awaiting approval)"}`, module: "Withdrawals" })} onClose={() => setModal(null)} />}
        {modal?.type === "task" && <TaskForm initial={modal.initial} currentUser={currentUser} team={teamNames} people={team} isAdmin={isAdmin} onSave={(t) => saveTask(t, modal.fromConcept)} onClose={() => setModal(null)} />}
        {modal?.type === "leave" && <LeaveForm initial={modal.initial} me={me} onSave={(l) => mutate((d) => ({ ...d, leave: d.leave.some((x) => x.id === l.id) ? d.leave.map((x) => x.id === l.id ? l : x) : [...d.leave, l] }), { action: (db.leave.some((x) => x.id === l.id) ? "updated " : "submitted ") + l.type + " leave request", module: "Leave" })} onClose={() => setModal(null)} />}
        {modal?.type === "project" && <ProjectForm initial={modal.initial} onSave={(p) => saveGeneric("projects", p, "project")} onClose={() => setModal(null)} />}
        {modal?.type === "inhouse" && <InHouseForm initial={modal.initial} team={team} onSave={(x) => saveOwned("inhouse", x)} onClose={() => setModal(null)} />}
        {modal?.type === "testSession" && <TestSessionForm initial={modal.initial} projects={[...db.projects].filter((p) => (p.approvalStatus || "approved") !== "rejected").sort((a, b) => (a.name || "").localeCompare(b.name || ""))} team={team} onSave={saveTesting} onClose={() => setModal(null)} />}
        {modal?.type === "teamcfg" && <TeamConfigForm initial={modal.initial} roster={team.filter((p) => p.role !== "client" && p.active !== false)} onSave={saveTeamCfg} onClose={() => setModal(null)} />}
        {modal?.type === "student" && <StudentForm initial={modal.initial} onSave={(s) => saveGeneric("students", s, "student")} onClose={() => setModal(null)} />}
        {modal?.type === "classStudent" && <ClassStudentForm initial={modal.initial} onSave={saveClassStudent} onClose={() => setModal(null)} />}
        {modal?.type === "marketing" && <MarketingForm initial={modal.initial} onSave={(m) => saveGeneric("marketing", m, "marketing client")} onClose={() => setModal(null)} />}
        {modal?.type === "concept" && <ConceptForm initial={modal.initial} onSave={(c) => saveGeneric("concepts", c, "idea")} onClose={() => setModal(null)} />}
        {modal?.type === "lead" && <LeadForm initial={modal.initial} onSave={(x) => saveOwned("leads", x)} onClose={() => setModal(null)} />}
        {modal?.type === "client" && <ClientForm initial={modal.initial} existing={db.clients} onSave={(x) => { saveOwned("clients", x); }} onClose={() => setModal(null)} />}
        {modal?.type === "quotation" && <QuotationForm initial={modal.initial} clients={db.clients} portalClients={portalClients} onSave={(x) => saveOwned("quotations", x)} onClose={() => setModal(null)} />}
        {modal?.type === "invoice" && <InvoiceForm initial={modal.initial} clients={db.clients} portalClients={portalClients} onSave={(x) => saveOwned("invoices", x)} onClose={() => setModal(null)} />}
        {modal?.type === "planned" && <PlannedForm initial={modal.initial} onSave={(x) => saveOwned("planned", x)} onClose={() => setModal(null)} />}
        {modal?.type === "vault" && <VaultForm initial={modal.initial} onSave={(x) => saveOwned("vault", x)} onClose={() => setModal(null)} />}
        {modal?.type === "document" && <DocForm initial={modal.initial} team={team} portalClients={portalClients} onSave={(x) => saveOwned("documents", x)} onClose={() => setModal(null)} />}
        {modal?.type === "knowledge" && <KbForm initial={modal.initial} onSave={(x) => saveOwned("knowledge", x)} onClose={() => setModal(null)} />}
        {modal?.type === "prompt" && <PromptForm initial={modal.initial} onSave={(x) => saveOwned("prompts", x)} onClose={() => setModal(null)} />}
        {modal?.type === "sheet" && <SheetForm initial={modal.initial} onSave={(x) => saveOwned("sheets", x)} onClose={() => setModal(null)} />}
        {modal?.type === "reward" && <RewardForm initial={modal.initial} team={team} onSave={(x) => saveOwned("rewards", x)} onClose={() => setModal(null)} />}
        {modal?.type === "notification" && <NotificationForm initial={modal.initial} team={team} onSave={(x) => saveOwned("notifications", x)} onClose={() => setModal(null)} />}
        {modal?.type === "announcement" && <AnnouncementForm initial={modal.initial} onSave={(x) => saveOwned("announcements", x)} onClose={() => setModal(null)} />}
        {modal?.type === "portalPost" && <PortalPostForm initial={modal.initial} portalClients={portalClients} onSave={(x) => saveOwned("portal_posts", x)} onClose={() => setModal(null)} />}
        {modal?.type === "resign" && <ResignForm existing={(db.resignations || []).filter((r) => r.userId === me.id)} onSave={(r) => { mutate((d) => ({ ...d, resignations: [...(d.resignations || []), { ...r, id: uid(), userId: me.id, userName: currentUser, status: "Pending", createdAt: Date.now() }] }), { action: "submitted a resignation request", module: "Team" }); setModal(null); }} onClose={() => setModal(null)} />}
        {modal?.type === "confirm" && <Confirm title={modal.title} body={modal.body} confirmLabel={modal.confirmLabel} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "deleteConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} actionLabel={modal.actionLabel || "Delete"} icon={<Trash2 size={15} />} danger onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "restoreConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} actionLabel={modal.actionLabel || "Restore"} icon={<RotateCcw size={15} />} danger={false} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
        {modal?.type === "okConfirm" && <TypedConfirm title={modal.title} body={modal.body} note={modal.note} word="OK" actionLabel={modal.actionLabel || "Confirm"} icon={modal.icon} danger={false} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}

        {balanceUser && <BalanceDetail db={db} user={balanceUser} onClose={() => setBalanceUser(null)} onFull={canFinance ? openAccount : undefined} />}

        {searchOpen && <GlobalSearch db={db} team={team} profile={profile} role={role} me={me} allowedRoutes={[...allowedRoutes]} go={go} openTask={openTask} onClose={() => setSearchOpen(false)} />}
      </div>
    </ErrorBoundary>
  );
}

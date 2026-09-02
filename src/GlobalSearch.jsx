import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, FileText } from "./icons.jsx";

const USERS = ["Haji", "Alim"];
const COMBINED = "Haji & Alim";
const assigneeText = (t) => {
  const a = Array.isArray(t.assignees) && t.assignees.length ? t.assignees.slice() : t.assignedTo === COMBINED ? USERS.slice() : t.assignedTo ? [t.assignedTo] : [];
  return a.join(", ") || "—";
};
const formatMoney = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return (v < 0 ? "−₹" : "₹") + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(v));
};
function collectText(v, out) {
  out = out || [];
  if (v == null) return out;
  if (typeof v === "string") { out.push(v); return out; }
  if (Array.isArray(v)) { for (const x of v) collectText(x, out); return out; }
  if (typeof v === "object") { for (const k of Object.keys(v)) { if (k !== "password") collectText(v[k], out); } return out; }
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
  { coll: "transactions", route: "accounts", label: "Accounts", title: (x) => (x.project || x.client || x.category || "Entry") + " · " + formatMoney(x.amount), sub: (x) => (x.kind === "income" ? "Income" : "Expense"), date: (x) => x.date },
  { coll: "withdrawals", route: "withdrawals", label: "Withdrawals", title: (x) => "Withdrawal " + formatMoney(x.amount) + " · " + (x.user || ""), sub: (x) => x.status, date: (x) => x.date },
  { coll: "planned", route: "planned", label: "Planned expenses", title: (x) => x.title, sub: (x) => x.category, date: (x) => x.nextDue },
  { coll: "rewards", route: "rewards", label: "Rewards", title: (x) => (x.userName || "") + " · " + (x.kind || ""), date: (x) => x.date },
  { coll: "sheets", route: "sheets", label: "Sheets", title: (x) => x.title, sub: (x) => x.category },
  { coll: "prompts", route: "prompts", label: "Prompts", title: (x) => x.title, sub: (x) => x.category },
  { coll: "vault", route: "vault", label: "Passwords", title: (x) => x.service, sub: (x) => x.category },
  { coll: "students", route: "courses", label: "Courses", title: (x) => x.name, sub: (x) => x.course, date: (x) => x.joinDate },
  { coll: "marketing", route: "marketing", label: "Marketing", title: (x) => x.client, sub: (x) => x.plan, date: (x) => x.startDate },
  { coll: "portal_posts", route: "portal-posts", label: "Client updates", title: (x) => x.title, date: (x) => msToISO(x.createdAt) },
  { coll: "notifications", route: "notifications", label: "Notifications", title: (x) => x.title, date: (x) => msToISO(x.createdAt), filter: (x, c) => notifVisibleTo?.(x, c.profile) },
];


function GlobalSearch({ db, team, profile, role, me, allowedRoutes, go, openTask, openModal, onClose, nav, notifVisibleTo, activityModuleOf }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const isAdmin = role === "superadmin" || role === "admin";
  const allowKey = (allowedRoutes || []).join(",");
  const ROLE_LABEL = { superadmin: "Super admin", admin: "Admin", accountant: "Accountant", staff: "Staff", intern: "Intern", partner: "APN Partner", district_head: "District Head", state_head: "State Head" };

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
    for (const [key, label, , tag] of nav) {
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
  const routeIcon = (r) => (nav.find((n) => n[0] === r)?.[2]) || FileText;

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
export const ROLE_LABEL = { superadmin: "Super admin", admin: "Admin", accountant: "Accountant", staff: "Staff", intern: "Intern", partner: "APN Partner", district_head: "District Head", state_head: "State Head" };
export const ROLE_OPTIONS = ["admin", "accountant", "staff", "intern"];
export const STATUS_LABEL = { active: "Active", on_leave: "On leave", suspended: "Suspended", resigned: "Resigned", terminated: "Terminated" };
export const STATUS_OPTIONS = ["active", "on_leave", "suspended", "resigned", "terminated"];
export const STATUS_ACTIVE = { active: true, on_leave: true, suspended: false, resigned: false, terminated: false };
export const GRANTABLE_MODULES = [["projects", "Projects"], ["inhouse", "In-house projects"], ["leads", "Leads"], ["clients", "Clients"], ["quotations", "Quotations"], ["invoices", "Invoices"], ["portal-posts", "Client updates"], ["courses", "Courses"], ["marketing", "Marketing"], ["concepts", "Concepts"], ["testing", "Testing"], ["sheets", "Sheets"], ["prompts", "Prompts"]];
export const TNC_ROLES = ["admin", "accountant", "staff", "intern"];
export const isSuperRole = (r) => r === "superadmin";
export const isAdminRole = (r) => r === "superadmin" || r === "admin";
export const canFinanceRole = (r) => r === "superadmin" || r === "accountant";
export function navAllowed(tag, role, perms) {
  const sa = isSuperRole(role), adm = isAdminRole(role);
  const acc = role === "accountant", staff = role === "staff", intern = role === "intern";
  if (tag === "everyone") return true;
  if (tag === "work") return adm || staff || intern;
  if (tag === "leave") return adm || staff;
  if (tag === "finance") return sa || acc;
  if (tag === "admin") return adm;
  if (tag === "collab") return true;
  if (tag === "vault") return sa;
  if (tag === "super") return sa;
  if (tag === "insight") return adm;
  if (tag.startsWith("perm:")) {
    const mod = tag.slice(5);
    return adm || (staff && Array.isArray(perms?.modules) && perms.modules.includes(mod));
  }
  return adm;
}

export function roleTncOf(config) { try { return JSON.parse((config && config.tnc_roles) || "{}") || {}; } catch { return {}; } }
export function acceptedRoleTnc(profile) { const a = profile && profile.tnc_roles_accepted; return a && typeof a === "object" ? a : {}; }
export function pendingTnc(config, profile, role) {
  if (!profile || !TNC_ROLES.includes(role)) return [];
  const out = []; const gv = Number(config?.tnc_version || 0);
  if (gv > 0 && Number(profile.tnc_version || 0) < gv) out.push({ key:"all", title:"Company terms — everyone", body:config?.tnc_body || "", version:gv });
  const rc = roleTncOf(config)[role];
  if (rc && Number(rc.version || 0) > 0 && Number(acceptedRoleTnc(profile)[role] || 0) < Number(rc.version)) out.push({ key:role, title:`${ROLE_LABEL[role] || role} terms`, body:rc.body || "", version:Number(rc.version) });
  return out;
}

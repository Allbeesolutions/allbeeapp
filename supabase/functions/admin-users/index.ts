// Supabase Edge Function: admin-users
// Deploy with: supabase functions deploy admin-users
// The service-role key stays server-side; callers are checked against profiles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const auditSensitive = async (admin: any, actorId: string, actionType: string, targetId: string | null, metadata: Record<string, unknown> = {}) => {
  const { error } = await admin.from("security_sensitive_actions").insert({ user_id: actorId, action_type: actionType, target_id: targetId, confirmed: true, metadata });
  if (error) console.warn("[admin-users] sensitive-action audit failed:", error.message);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization) return json({ error: "Not signed in." }, 401);
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Invalid session." }, 401);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
    const callerRole = callerProfile?.role ?? "";
    if (!["admin", "superadmin"].includes(callerRole)) return json({ error: "You don't have permission to manage users." }, 403);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "create") {
      const { email, password, name, role = "staff" } = body;
      const allowedCreateRoles = callerRole === "superadmin"
        ? ["admin", "accountant", "staff", "intern", "client", "partner", "district_head", "state_head"]
        : ["accountant", "staff", "intern", "client", "partner", "district_head", "state_head"];
      if (!allowedCreateRoles.includes(String(role))) return json({ error: "You don't have permission to create an account with that role." }, 403);
      if (!email || !password) return json({ error: "Email and password are required." }, 400);
      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedUsername = body.username ? String(body.username).trim().toLowerCase().replace(/\s+/g, "") : "";
      const { data, error } = await admin.auth.admin.createUser({ email: normalizedEmail, password: String(password), email_confirm: true, user_metadata: { name: name ?? "", role, role_intent: role === "partner" ? "partner" : undefined, apn: role === "partner" ? { username: normalizedUsername, mobile: body.mobile ?? "" } : undefined } });
      if (error) return json({ error: error.message }, 400);
      if (data.user?.id && normalizedUsername) {
        const { error: profileError } = await admin.from("profiles").update({ username: normalizedUsername }).eq("id", data.user.id);
        if (profileError) {
          await admin.auth.admin.deleteUser(data.user.id);
          return json({ error: profileError.message }, 400);
        }
      }
      await auditSensitive(admin, caller.id, "admin_user_create", data.user?.id ?? null, { role });
      return json({ id: data.user?.id, user: data.user });
    }

    const { userId } = body;
    const { data: target } = userId ? await admin.from("profiles").select("role").eq("id", userId).maybeSingle() : { data: null };
    const targetRole = String(target?.role || "");
    const targetIsApn = ["partner", "district_head", "state_head"].includes(targetRole);
    if (targetRole === "superadmin" && callerRole !== "superadmin") {
      return json({ error: "Only a Super Admin may manage another Super Admin account." }, 403);
    }
    if (targetIsApn && callerRole !== "superadmin" && ["reset_password", "update_email", "delete", "permanent_delete"].includes(action)) {
      return json({ error: "Only a Super Admin may perform this APN account action." }, 403);
    }

    if (action === "reset_password") {
      if (targetRole === "superadmin" && callerRole !== "superadmin") return json({ error: "Only a Super Admin may reset another Super Admin's password." }, 403);
      if (!userId || !body.password) return json({ error: "User and new password are required." }, 400);
      if (String(body.password).length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
      const { error } = await admin.auth.admin.updateUserById(String(userId), { password: String(body.password) });
      if (error) return json({ error: error.message }, 400);
      await auditSensitive(admin, caller.id, "admin_user_reset_password", String(userId), { target_role: targetRole });
      return json({ ok: true });
    }

    if (action === "update_email") {
      if (targetRole === "superadmin" && callerRole !== "superadmin") return json({ error: "Only a Super Admin may change another Super Admin's email." }, 403);
      if (!userId || !body.email) return json({ error: "User and email are required." }, 400);
      const email = String(body.email).trim().toLowerCase();
      const { error } = await admin.auth.admin.updateUserById(String(userId), { email, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: profileError } = await admin.from("profiles").update({ email }).eq("id", userId);
      if (profileError) return json({ error: profileError.message }, 400);
      await auditSensitive(admin, caller.id, "admin_user_update_email", String(userId), { target_role: targetRole });
      return json({ ok: true });
    }

    if (action === "permanent_delete") {
      if (callerRole !== "superadmin") return json({ error: "Only a Super Admin may permanently delete an APN account." }, 403);
      if (!userId) return json({ error: "User id is required." }, 400);
      if (userId === caller.id) return json({ error: "You can't delete your own account." }, 400);
      if (target?.role === "superadmin") return json({ error: "Super Admin accounts can't be deleted." }, 403);
      if (!targetIsApn) return json({ error: "Permanent deletion is reserved for APN accounts." }, 400);

      // APN business records are the financial and audit history. Mark the
      // identity as permanently deleted, then remove only the auth identity;
      // never delete APN rows, documents, commissions, or timeline records.
      const { error: authError } = await admin.auth.admin.deleteUser(String(userId));
      if (authError && !/not found|does not exist/i.test(authError.message)) return json({ error: authError.message }, 400);
      const { data: apn } = await admin.from("apn_users").select("id,data").eq("id", userId).maybeSingle();
      if (apn?.data) {
        const now = Date.now();
        const { error: apnError } = await admin.from("apn_users").update({ data: { ...apn.data, status: "deleted", archived: true, permanentlyDeleted: true, archiveReason: String(body.reason || "Permanent deletion"), archivedAt: now, deletedAt: now, deletedBy: caller.id }, updated_at: new Date().toISOString() }).eq("id", userId);
        if (apnError) return json({ error: apnError.message }, 400);
      }
      await auditSensitive(admin, caller.id, "admin_user_permanent_delete", String(userId), { target_role: targetRole, reason: String(body.reason || "") });
      return json({ ok: true, permanentlyDeleted: true, emailReusable: true, historyPreserved: true, reason: String(body.reason || "") });
    }

    if (action === "delete") {
      if (!userId) return json({ error: "User id is required." }, 400);
      if (userId === caller.id) return json({ error: "You can't delete your own account." }, 400);
      if (target?.role === "superadmin") return json({ error: "Super Admin accounts can't be deleted." }, 403);
      if (targetIsApn) {
        if (!body.archive) return json({ error: "APN accounts must be archived or permanently deleted by a Super Admin." }, 400);
        const { data: apn } = await admin.from("apn_users").select("id,data").eq("id", userId).maybeSingle();
        if (apn?.data) await admin.from("apn_users").update({ data: { ...apn.data, status: "deleted", archived: true, archiveReason: String(body.archiveReason ?? "Account archived"), archivedAt: Date.now(), deletedAt: Date.now(), deletedBy: caller.id }, updated_at: new Date().toISOString() }).eq("id", userId);
        const { error: profileError } = await admin.from("profiles").update({ active: false, approved: false, status: "terminated" }).eq("id", userId);
        if (profileError) return json({ error: profileError.message }, 400);
        await auditSensitive(admin, caller.id, "admin_user_archive", String(userId), { target_role: targetRole, reason: String(body.archiveReason ?? "Account archived") });
        return json({ ok: true, archived: true, emailReusable: false, historyPreserved: true });
      }
      const { error } = await admin.auth.admin.deleteUser(String(userId));
      if (error && !/not found|does not exist/i.test(error.message)) return json({ error: error.message }, 400);
      await admin.from("profiles").delete().eq("id", userId);
      await auditSensitive(admin, caller.id, "admin_user_delete", String(userId), { target_role: targetRole });
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: (error as Error)?.message ?? "Unexpected error." }, 500);
  }
});

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
      if (!email || !password) return json({ error: "Email and password are required." }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email: String(email).trim().toLowerCase(), password: String(password), email_confirm: true, user_metadata: { name: name ?? "", role, role_intent: role === "partner" ? "partner" : undefined, apn: role === "partner" ? { username: body.username ?? "", mobile: body.mobile ?? "" } : undefined } });
      if (error) return json({ error: error.message }, 400);
      return json({ id: data.user?.id, user: data.user });
    }

    const { userId } = body;
    const { data: target } = userId ? await admin.from("profiles").select("role").eq("id", userId).maybeSingle() : { data: null };
    const targetIsApn = ["partner", "district_head"].includes(target?.role);
    if (targetIsApn && callerRole !== "superadmin" && ["reset_password", "update_email", "delete"].includes(action)) {
      return json({ error: "Only a Super Admin may perform this APN account action." }, 403);
    }

    if (action === "reset_password") {
      if (!userId || !body.password) return json({ error: "User and new password are required." }, 400);
      if (String(body.password).length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
      const { error } = await admin.auth.admin.updateUserById(String(userId), { password: String(body.password) });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "update_email") {
      if (!userId || !body.email) return json({ error: "User and email are required." }, 400);
      const email = String(body.email).trim().toLowerCase();
      const { error } = await admin.auth.admin.updateUserById(String(userId), { email, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: profileError } = await admin.from("profiles").update({ email }).eq("id", userId);
      if (profileError) return json({ error: profileError.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!userId) return json({ error: "User id is required." }, 400);
      if (userId === caller.id) return json({ error: "You can't delete your own account." }, 400);
      if (target?.role === "superadmin") return json({ error: "Super Admin accounts can't be deleted." }, 403);
      if (targetIsApn) {
        const { data: apn } = await admin.from("apn_users").select("id,data").eq("id", userId).maybeSingle();
        if (apn?.data) await admin.from("apn_users").update({ data: { ...apn.data, status: "deleted", archived: true, archiveReason: String(body.archiveReason ?? "Account archived"), archivedAt: Date.now(), deletedAt: Date.now(), deletedBy: caller.id }, updated_at: new Date().toISOString() }).eq("id", userId);
      }
      const { error } = await admin.auth.admin.deleteUser(String(userId));
      if (error && !/not found|does not exist/i.test(error.message)) return json({ error: error.message }, 400);
      await admin.from("profiles").delete().eq("id", userId);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: (error as Error)?.message ?? "Unexpected error." }, 500);
  }
});

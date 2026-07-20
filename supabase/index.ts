// supabase/functions/admin-users/index.ts
//
// One Edge Function that powers every privileged user action in ALLBEE:
//   • create           → make a confirmed login (staff / partner)
//   • reset_password    → set a new password for another user
//   • delete           → permanently remove the login from auth.users
//
// These can ONLY happen server-side with the service-role key. The browser
// (anon key) is not allowed to touch other users' auth records — that's why
// the app must call this function instead of doing it directly.
//
// Deploy:  supabase functions deploy admin-users
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically into deployed functions — you don't set them yourself.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ─────────────────────────────────────────────────────────────────────
// Without these headers the browser's preflight fails and supabase-js reports
// "Failed to send a request to the Edge Function" — the error you were seeing.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // 1. Answer the CORS preflight.
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 2. Who is calling? Verify their JWT (sent automatically by invoke()).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not signed in." }, 401);

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: whoErr } = await asCaller.auth.getUser();
    if (whoErr || !caller) return json({ error: "Invalid session." }, 401);

    // 3. Admin client (service role) — bypasses RLS, can manage auth.users.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Authorize: only admin / superadmin may run privileged actions.
    const { data: me } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    const callerRole = me?.role ?? "";
    if (callerRole !== "admin" && callerRole !== "superadmin") {
      return json({ error: "You don't have permission to manage users." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (action === "create") {
      const { email, password, name, role } = body;
      if (!email || !password) return json({ error: "Email and password are required." }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true, // confirmed → they can sign in immediately
        user_metadata: { name: name ?? "", role: role ?? "staff" },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ id: data.user?.id, user: data.user });
    }

    // ── RESET PASSWORD ──────────────────────────────────────────────────────────
    if (action === "reset_password") {
      const { userId, password } = body;
      if (!userId || !password) return json({ error: "User and new password are required." }, 400);
      if (String(password).length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

      // Defense in depth: don't let a plain admin reset a partner's password.
      const { data: target } = await admin
        .from("profiles").select("role").eq("id", userId).maybeSingle();
      if (target?.role === "superadmin" && callerRole !== "superadmin") {
        return json({ error: "Only a partner can reset another partner's password." }, 403);
      }

      const { error } = await admin.auth.admin.updateUserById(String(userId), {
        password: String(password),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "User id is required." }, 400);

      const { data: target } = await admin
        .from("profiles").select("role").eq("id", userId).maybeSingle();
      if (target?.role === "superadmin") {
        return json({ error: "Partners can't be deleted." }, 403);
      }

      // Remove the login. This frees the email so it can be re-registered.
      const { error } = await admin.auth.admin.deleteUser(String(userId));
      // If the auth user was already gone, treat as success (idempotent).
      if (error && !/not found|does not exist/i.test(error.message)) {
        return json({ error: error.message }, 400);
      }
      // Also clear the profile row in case it's still there.
      await admin.from("profiles").delete().eq("id", userId);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unexpected error." }, 500);
  }
});

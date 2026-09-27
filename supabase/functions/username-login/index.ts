// Universal pre-auth login, password-reset routing, and availability checks.
// Login errors are intentionally generic and the resolver never returns an
// account email to the browser.
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
const genericAuthError = () => json({ error: "Invalid login credentials." }, 401);
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const isEmail = (value: string) => value.includes("@");
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((b) => b.toString(16).padStart(2, "0")).join("");
async function throttle(admin: ReturnType<typeof createClient>, req: Request, identifier: string, action: string) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
  const spec = action === "request_reset" ? { limit: 5, window: 3600 } : action === "check" ? { limit: 60, window: 900 } : { limit: 15, window: 900 };
  for (const raw of [`${action}:ip:${ip}`, `${action}:id:${identifier}`]) {
    const key = await sha256(`allbee-auth-v1:${raw}`);
    const { data, error } = await admin.rpc("auth_preflight_rate_limit", { p_key: key, p_limit: spec.limit, p_window_seconds: spec.window });
    if (error) throw new Error("Authentication protection is temporarily unavailable.");
    if (data?.allowed === false) return Number(data.retry_after || 60);
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = normalize(body?.identifier ?? body?.username).replace(/\s+/g, "");
    if (!identifier) return body?.action === "request_reset" ? json({ ok: true }) : genericAuthError();
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const actionKind = body?.check === true ? "check" : body?.action === "request_reset" ? "request_reset" : "sign_in";
    const retryAfter = await throttle(admin, req, identifier, actionKind);
    if (retryAfter > 0) return json({ error: `Too many authentication attempts. Please try again in ${retryAfter}s.`, retry_after: retryAfter }, 429);
    if (body?.check === true) {
      const rpc = body?.kind === "email" ? "email_available" : "username_available";
      const params = body?.kind === "email" ? { p_email: identifier, p_exclude: body?.exclude || null } : { p_username: identifier, p_exclude: body?.exclude || null };
      const { data, error } = await admin.rpc(rpc, params);
      if (error) return json({ error: error.message }, 400);
      return json({ available: Boolean(data) });
    }

    const { data: resolvedEmail, error: resolveError } = await admin.rpc("username_to_email", { p_username: identifier });
    if (resolveError || !resolvedEmail) return body?.action === "request_reset" ? json({ ok: true }) : genericAuthError();

    if (body?.action === "request_reset") {
      const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
      await publicClient.auth.resetPasswordForEmail(String(resolvedEmail), { redirectTo: String(body?.redirectTo || "") || undefined });
      return json({ ok: true });
    }

    if (body?.action && body.action !== "sign_in") return genericAuthError();
    const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: sessionData, error: signInError } = await publicClient.auth.signInWithPassword({ email: String(resolvedEmail), password: String(body?.password || "") });
    if (signInError || !sessionData?.session) return genericAuthError();
    return json({ session: sessionData.session, user: sessionData.user });
  } catch (error) {
    console.error("username-login error", error);
    return bodySafeError(req);
  }
});

function bodySafeError(req: Request) {
  return json({ error: "Invalid login credentials." }, req.method === "POST" ? 401 : 500);
}

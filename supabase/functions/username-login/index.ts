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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = normalize(body?.identifier ?? body?.username).replace(/\s+/g, "");
    if (!identifier) return body?.action === "request_reset" ? json({ ok: true }) : genericAuthError();
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
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

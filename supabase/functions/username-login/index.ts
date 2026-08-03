// Username login lookup and availability check for clients that cannot call
// the PR-1 SQL helpers yet. Never returns a password or auth token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!username) return json({ error: "Username is required." }, 400);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (body?.check === true) {
      const rpc = body?.kind === "email" ? "email_available" : "username_available";
      const params = body?.kind === "email" ? { p_email: username, p_exclude: body?.exclude || null } : { p_username: username, p_exclude: body?.exclude || null };
      const { data, error } = await admin.rpc(rpc, params);
      if (error) return json({ error: error.message }, 400);
      return json({ available: Boolean(data) });
    }
    const { data, error } = await admin.from("profiles").select("email,active,status").ilike("username", username).limit(1).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data?.email) return json({ error: "Username not found." }, 404);
    return json({ email: String(data.email).trim().toLowerCase(), active: data.active !== false, status: data.status || "active" });
  } catch (error) {
    return json({ error: (error as Error)?.message || "Unexpected error." }, 500);
  }
});

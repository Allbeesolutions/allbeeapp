// Founder Emergency Lockdown — server-side authorization and state.
// The authorization code lives ONLY in the FOUNDER_LOCKDOWN_CODE secret; it is
// never returned, logged, echoed, or placed in any response. Nothing in this
// function distinguishes a "wrong length" or "partially correct" code from a
// plain wrong code — the client only ever receives ok:false.
//
// Deployed with --no-verify-jwt because it must be reachable from the signed-out
// login screen; the security boundary is the code check itself (plus rate
// limiting). There is intentionally NO remote unlock action here — recovery is
// performed by the infrastructure owner in the Supabase SQL console only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("FOUNDER_LOCKDOWN_CODE") || "";

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_MAX = 5;                    // verify attempts per window per client

const reserveAttempt = async (admin, client: string): Promise<number> => {
  const nowIso = new Date().toISOString();
  await admin
    .from("emergency_lockdown_attempts")
    .upsert({ client_key: client, window_start: nowIso, attempts: 1, updated_at: nowIso }, { onConflict: "client_key", ignoreDuplicates: true });
  const { data } = await admin
    .from("emergency_lockdown_attempts")
    .select("window_start, attempts")
    .eq("client_key", client)
    .maybeSingle();
  if (!data) return 1000; // fails closed: treat as over the limit
  const started = new Date(data.window_start).getTime();
  if (Date.now() - started > RATE_WINDOW_MS) {
    await admin
      .from("emergency_lockdown_attempts")
      .update({ window_start: nowIso, attempts: 1, updated_at: nowIso })
      .eq("client_key", client);
    return 1;
  }
  if (data.attempts >= RATE_MAX) return data.attempts + 1;
  await admin
    .from("emergency_lockdown_attempts")
    .update({ attempts: data.attempts + 1, updated_at: nowIso })
    .eq("client_key", client);
  return data.attempts + 1;
};

const clearAttempts = async (admin, client: string) => {
  await admin
    .from("emergency_lockdown_attempts")
    .upsert({ client_key: client, window_start: new Date().toISOString(), attempts: 0, updated_at: new Date().toISOString() }, { onConflict: "client_key" });
};

const timingSafeEqual = async (a: string, b: string) => {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const A = new Uint8Array(ha);
  const B = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
};

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const codeIsValid = async (admin, candidate: string): Promise<boolean> => {
  if (SECRET) return timingSafeEqual(candidate, SECRET);
  const { data } = await admin
    .from("emergency_lockdown")
    .select("code_hash")
    .eq("id", "founder")
    .maybeSingle();
  const stored = data?.code_hash || "";
  if (!stored) return false;
  return timingSafeEqual((await sha256Hex(candidate)).toLowerCase(), String(stored).toLowerCase());
};

const readState = async (admin) => {
  const { data } = await admin
    .from("emergency_lockdown")
    .select("locked, locked_at, locked_by, updated_at")
    .eq("id", "founder")
    .maybeSingle();
  return data ?? null;
};

const applyLockdown = async (admin) => {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("emergency_lockdown")
    .update({ locked: true, locked_at: now, locked_by: "founder-authorization", updated_at: now })
    .eq("id", "founder");
  if (error) return false;
  await admin.from("emergency_lockdown_audit").insert({ action: "activate", actor: "founder-authorization" });
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // status — public availability check; reveals only whether the app is locked.
    if (action === "status") {
      const row = await readState(admin);
      return json({ locked: Boolean(row?.locked) });
    }

    // verify — rate-limited authorization check; on success applies lockdown.
    if (action === "verify") {
      const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const attemptNo = await reserveAttempt(admin, client);
      if (attemptNo > RATE_MAX) return json({ error: "Too many attempts. Try again later." }, 429);

      const candidate = String(body?.code ?? "");
      if (!(await codeIsValid(admin, candidate))) {
        return json({ ok: false }, 401);
      }
      await clearAttempts(admin, client);
      const row = await readState(admin);
      if (row?.locked) return json({ ok: true, already: true });
      if (!(await applyLockdown(admin))) return json({ error: "Lockdown could not be applied." }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("founder-lockdown error", e);
    return json({ error: "Unavailable." }, 500);
  }
});
// ALLBEE AI — Edge Function powered by Groq (free tier, no credit card).
// ----------------------------------------------------------------------------------
// Save this file as:   supabase/functions/ai-chat/index.ts   (replace the old one)
//
// 1) Set the secret (once):
//        supabase secrets set GROQ_API_KEY=gsk_xxxxxxxx
// 2) Deploy. JWT verification may stay OFF — this function verifies the caller's
//    JWT itself against the project JWKS, so it is secure either way. Recommended:
//        supabase functions deploy ai-chat --no-verify-jwt
//
// BEHAVIOR (Phase 1 hardening):
//   • AUTH: only signed-in ALLBEE users can call it. The caller's access token
//     (Authorization: Bearer <jwt>, sent automatically by supabase-js
//     functions.invoke) is verified against <SUPABASE_URL>/auth/v1 JWKS with the
//     issuer + "authenticated" audience check. Anonymous / tampered calls get 401.
//   • RATE LIMITING: per-user sliding window, 60 calls / hour / user
//     (in-memory, per warm instance — documented limitation, not a global cap).
//   • INPUT CAPS: max_tokens ≤ 2048, ≤ 60 messages, each ≤ 8 000 chars,
//     total ≤ 150 000 chars, body ≤ 256 KB. Keeps abuse cost bounded.
//   • PII: the app masks client/lead emails + phones in the snapshot before it
//     is sent here (src/AllbeeApp.jsx buildAIContext). This function does not
//     receive the service-role key and never logs request bodies.
//
// Response shape is unchanged: { text } on success, { error } on failure.
// The production model is fixed here to openai/gpt-oss-120b so stale/unsupported GROQ_MODEL secrets cannot break the shared assistant.
// The app's "Model" setting is ignored in secure function mode.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

// ── JWT verification (JWKS is fetched lazily once per warm instance) ─────
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  const base = Deno.env.get("SUPABASE_URL") || "";
  if (!base) throw new Error("SUPABASE_URL is not set on the function.");
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

async function verifyUser(authorization: string | null): Promise<{ id?: string } | null> {
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === "null" || token === "undefined") return null;
  const base = Deno.env.get("SUPABASE_URL") || "";
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${base}/auth/v1`,
      audience: "authenticated",
    });
    if (!payload.sub) return null;
    return { id: String(payload.sub) };
  } catch {
    return null;
  }
}

// ── Per-user rate limit (in-memory sliding window; resets on cold start) ──
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 60; // calls per user per hour
const rateHits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (rateHits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateHits.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(userId, recent);
  return false;
}

// ── Bounds (keep abuse cost low) ──────────────────────────────────────────
const MAX_TOKENS = 2048;
const MAX_MESSAGES = 60;
const MAX_MESSAGE_CHARS = 8000;
const MAX_TOTAL_CHARS = 150000;
const MAX_BODY_BYTES = 256 * 1024;

function sanitizePayload(body: unknown) {
  const raw = (body || {}) as {
    system?: unknown;
    messages?: Array<{ role?: string; content?: unknown }>;
    max_tokens?: unknown;
  };
  const system = typeof raw.system === "string" ? raw.system.slice(0, MAX_TOTAL_CHARS) : "";
  const maxTokens = Math.min(Number(raw.max_tokens) || 1400, MAX_TOKENS);
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  if (messages.length > MAX_MESSAGES) messages.length = MAX_MESSAGES;
  const chat: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  let total = system.length;
  for (const m of messages) {
    const content = String(m?.content ?? "").slice(0, MAX_MESSAGE_CHARS);
    total += content.length;
    if (total > MAX_TOTAL_CHARS) break;
    chat.push({ role: m?.role === "assistant" ? "assistant" : "user", content });
  }
  return { system, chat, maxTokens };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const user = await verifyUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "Not signed in." }, 401);
    if (rateLimited(user.id!)) {
      return json({ error: "Too many requests. Please wait and try again later." }, 429);
    }

    const length = Number(req.headers.get("content-length") || 0);
    if (length > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ error: "GROQ_API_KEY is not set on the function." }, 200);

    const model = "openai/gpt-oss-120b";
    const { system, chat, maxTokens } = sanitizePayload(await req.json().catch(() => ({})));
    if (chat.length === 0 && !system) return json({ error: "Empty request." }, 400);

    // Groq is OpenAI-compatible: an optional system message, then the turns.
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...chat,
    ];

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message || `Groq error ${r.status}`;
      return json({ error: msg }, 200);
    }

    const text = ((data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content || "").trim();
    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error" }, 200);
  }
});

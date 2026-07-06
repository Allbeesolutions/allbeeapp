// ALLBEE AI — FREE version of the Edge Function, powered by Groq (no credit card).
// ----------------------------------------------------------------------------------
// Save this file as:   supabase/functions/ai-chat/index.ts   (replace the old one)
//
// 1) Get a free API key: https://console.groq.com  ->  API Keys  ->  Create key
// 2) Set it as the function secret:
//        supabase secrets set GROQ_API_KEY=gsk_xxxxxxxx
//    (Or in the Dashboard: Edge Functions -> Secrets -> add GROQ_API_KEY)
// 3) Deploy with JWT verification OFF (needed so the browser's pre-flight works):
//        supabase functions deploy ai-chat --no-verify-jwt
//    (Dashboard: create/deploy the "ai-chat" function and turn OFF "Verify JWT".)
//
// In the app: Settings -> ALLBEE AI -> turn it on, keep mode "Supabase Edge
// Function", function name "ai-chat". The "Model" field in Settings is IGNORED
// by this function — the model is chosen here (GROQ_MODEL below). The app needs
// no changes.
//
// Change the model any time by setting a GROQ_MODEL secret, e.g.
//   llama-3.3-70b-versatile   (default, best quality)
//   llama-3.1-8b-instant      (faster, higher free rate limits)
//
// HEADS-UP on free tiers: they have rate limits, are usually a step below Claude
// in quality, and free plans may use your prompts to improve their models. This
// assistant sends a snapshot that includes client names/phones and deal values,
// so if that data is sensitive, weigh that before using a free tier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const { system, messages, max_tokens } = await req.json();
    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ error: "GROQ_API_KEY is not set on the function." }, 200);

    const model = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

    // Groq is OpenAI-compatible: a system message, then the alternating turns.
    const chat = [
      ...(system ? [{ role: "system", content: String(system) }] : []),
      ...((messages || []).map((m: { role?: string; content?: unknown }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      }))),
    ];

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: chat,
        max_tokens: max_tokens || 1400,
        temperature: 0.4,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `Groq error ${r.status}`;
      return json({ error: msg }, 200);
    }

    const text = (data?.choices?.[0]?.message?.content || "").trim();
    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error" }, 200);
  }
});

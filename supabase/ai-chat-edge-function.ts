// ALLBEE AI — Supabase Edge Function (the recommended, secure way to run the assistant)
// ---------------------------------------------------------------------------------------
// Save this file as:   supabase/functions/ai-chat/index.ts
//
// Deploy:              supabase functions deploy ai-chat
// Set your API key:    supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
//
// Then in the app: Settings → ALLBEE AI assistant → turn it on, keep mode
// "Supabase Edge Function", function name "ai-chat". The key stays on the
// server and is never sent to the browser.
//
// Note: leave the function's JWT verification ON (the default). That way only
// signed-in ALLBEE users can call it, so nobody can abuse your API key.

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
    const { system, model, max_tokens, messages } = await req.json();
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY is not set on the function." }, 200);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-5",
        max_tokens: max_tokens || 1400,
        system: system || "",
        messages: messages || [],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `Anthropic error ${r.status}`;
      return json({ error: msg }, 200);
    }

    const text = (data.content || [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text)
      .join("\n")
      .trim();

    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error" }, 200);
  }
});

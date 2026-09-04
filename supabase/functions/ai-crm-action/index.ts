import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "Authentication required." }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ error: "Authentication required." }, 401);
    const body = await req.json().catch(() => ({}));
    const actionId = String(body.actionId || "");
    if (!actionId) return json({ error: "Action id is required." }, 400);
    const { data: claimed, error: claimError } = await client.rpc("ai_crm_action_claim", { p_action_id: actionId });
    if (claimError) return json({ error: claimError.message }, 409);
    const action = claimed as { actionType:string; payload:Record<string,unknown>; leadId:string };
    let providerError = "";
    try {
      if (action.actionType === "send_email") {
        const key = Deno.env.get("RESEND_API_KEY");
        const from = Deno.env.get("RESEND_FROM_EMAIL");
        if (!key || !from) throw new Error("Email provider is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
        const res = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" }, body:JSON.stringify({ from, to:[String(action.payload.to)], subject:String(action.payload.subject || "Follow-up from ALLBEE"), text:String(action.payload.body || "") }) });
        if (!res.ok) throw new Error(`Email provider returned ${res.status}.`);
      } else if (action.actionType === "send_whatsapp") {
        const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
        const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
        if (!token || !phoneId) throw new Error("WhatsApp provider is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
        const to = String(action.payload.to || "").replace(/\D/g, "");
        if (!to) throw new Error("WhatsApp recipient is invalid.");
        const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify({ messaging_product:"whatsapp", to, type:"text", text:{ body:String(action.payload.body || "") } }) });
        if (!res.ok) throw new Error(`WhatsApp provider returned ${res.status}.`);
      } else throw new Error("Unsupported provider action.");
    } catch (e) { providerError = e instanceof Error ? e.message : "Provider execution failed."; }
    const { data: completed, error: completeError } = await admin.rpc("ai_crm_action_complete", { p_action_id: actionId, p_ok: !providerError, p_failure_reason: providerError || null });
    if (completeError) return json({ error: completeError.message }, 500);
    if (providerError) return json({ error: providerError, action: completed }, 502);
    return json({ ok: true, action: completed });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "AI CRM action failed." }, 500); }
});

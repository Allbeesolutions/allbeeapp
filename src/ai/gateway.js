export const AI_RUNTIME_MODEL = "openai/gpt-oss-120b";
export const AI_DEFAULT_MODEL = AI_RUNTIME_MODEL;

export function aiConfigOf(config) {
  let raw = {};
  try { raw = JSON.parse((config && config.ai) || "{}") || {}; } catch { raw = {}; }
  return { enabled: !!raw.enabled, mode: "function", functionName: "ai-chat-v2", model: AI_RUNTIME_MODEL, apiKey: "" };
}

export function aiConfigured(cfg) {
  return !!cfg?.enabled && cfg?.mode === "function" && !!cfg?.functionName;
}

export async function callAI(supabase, cfg, system, messages) {
  if (!aiConfigured(cfg)) throw new Error("ALLBEE AI is not configured.");
  const { data, error } = await supabase.functions.invoke(cfg.functionName, { body: { system, model: cfg.model || AI_DEFAULT_MODEL, max_tokens: 1400, messages } });
  if (error) throw new Error(error.message || `Couldn't reach the "${cfg.functionName}" function.`);
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "The AI gateway returned an error.");
  if (typeof data === "string") return data.trim();
  if (typeof data?.text === "string") return data.text.trim();
  if (Array.isArray(data?.content)) return data.content.filter((b) => b?.type === "text").map((b) => b.text).join("\n").trim();
  return typeof data === "object" ? JSON.stringify(data) : String(data ?? "");
}

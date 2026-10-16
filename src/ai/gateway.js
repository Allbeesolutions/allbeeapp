import { supabase } from "../supabaseClient";
import { awaitWithTimeout } from "./requestLifecycle.js";
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

// The optional external signal implements Stop/unmount cancellation.
// The deadline prevents the composer from waiting forever on a stalled gateway.
export async function callAI(cfg, system, messages, client = supabase, options = {}) {
  if (!aiConfigured(cfg)) throw new Error("ALLBEE AI is not configured.");
  const controller = new AbortController();
  const externalSignal = options.signal;
  const onAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener?.("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  const assertActive = () => {
    if (controller.signal.aborted) throw Object.assign(new Error("ALLBEE AI request cancelled or timed out."), { name: "AbortError" });
  };
  const invoke = async () => {
    assertActive();
    return awaitWithTimeout(client.functions.invoke(cfg.functionName, {
      body: { system, model: cfg.model || AI_DEFAULT_MODEL, max_tokens: 1400, messages },
      signal: controller.signal,
    }), options.timeoutMs ?? 60000, controller.signal);
  };
  try {
    let result = await invoke();
    assertActive();
    if (result?.error && /fetch|network|timeout|502|503|504/i.test(String(result.error.message || result.error))) {
      await awaitWithTimeout(new Promise(resolve => setTimeout(resolve, 650)), 700, controller.signal);
      result = await invoke();
      assertActive();
    }
    const { data, error } = result || {};
    if (error) throw new Error(error.message || "Couldn't reach the " + cfg.functionName + " function.");
    if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "The AI gateway returned an error.");
    if (typeof data === "string") return data.trim();
    if (typeof data?.text === "string") return data.text.trim();
    if (Array.isArray(data?.content)) return data.content.filter(b => b?.type === "text").map(b => b.text).join("\n").trim();
    return typeof data === "object" ? JSON.stringify(data) : String(data ?? "");
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener?.("abort", onAbort);
  }
}

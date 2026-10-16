import { describe, it, expect, vi } from "vitest";
import { awaitWithTimeout } from "./requestLifecycle.js";
import { callAI } from "./gateway.js";

const cfg = { enabled: true, mode: "function", functionName: "ai-chat-v2", model: "openai/gpt-oss-120b" };
const client = invoke => ({ functions: { invoke } });

describe("AI gateway cancellation and resilience", () => {
  it("forwards AbortSignal and stops a pending network request", async () => {
    const controller = new AbortController();
    let observedSignal;
    const invoke = vi.fn((_name, options) => {
      observedSignal = options.signal;
      return new Promise(() => {});
    });
    const response = callAI(cfg, "system", [{ role: "user", content: "Hi" }], client(invoke), { signal: controller.signal, timeoutMs: 5000 });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(observedSignal.aborted).toBe(false);
    controller.abort();
    await expect(response).rejects.toMatchObject({ name: "AbortError" });
    expect(observedSignal.aborted).toBe(true);
  });

  it("returns from a hung provider after the request deadline", async () => {
    const invoke = vi.fn(() => new Promise(() => {}));
    await expect(callAI(cfg, "system", [], client(invoke), { timeoutMs: 35 })).rejects.toThrow(/timed out|cancelled/i);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("retries a transient gateway failure exactly once", async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ error: { message: "502 Bad Gateway" } })
      .mockResolvedValueOnce({ data: { text: "Recovered response" }, error: null });
    const text = await callAI(cfg, "system", [], client(invoke), { timeoutMs: 3500 });
    expect(text).toBe("Recovered response");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient failure", async () => {
    const invoke = vi.fn().mockResolvedValue({ error: { message: "Permission denied" } });
    await expect(callAI(cfg, "system", [], client(invoke))).rejects.toThrow("Permission denied");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("bounds optional memory retrieval and aborts on navigation", async () => {
    await expect(awaitWithTimeout(new Promise(() => {}), 30)).rejects.toThrow("timed out");
    const controller = new AbortController();
    const pending = awaitWithTimeout(new Promise(() => {}), 10000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

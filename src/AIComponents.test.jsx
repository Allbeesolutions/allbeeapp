import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AllbeeAI from "./AllbeeAI.jsx";
import AIIntelligenceCenter from "./AIIntelligenceCenter.jsx";

const icon = ({ children }) => <span>{children}</span>;
const baseRuntime = { aiConfigOf: () => ({ enabled: true }), companyOf: () => ({ name: "ALLBEE" }), aiConfigured: () => true,
  buildAIContext: () => "snapshot", callAI: vi.fn().mockResolvedValue("Hello from AI"), ROLE_LABEL: { admin: "Admin" },
  AI_QUICK_PROMPTS: [["Summarise", "summarise pending work"]], renderAIText: (x) => <span>{x}</span>, supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } };
const intelligenceRuntime = { Empty: ({ title }) => <div>{title}</div>, Field: ({ children }) => <div>{children}</div>, money: (n) => `₹${n || 0}`,
  fmtDate: () => "date", fmtDateTime: () => "date-time", Activity: icon, emitToast: vi.fn(), exportRowsToExcel: vi.fn(), exportRowsToPDF: vi.fn(),
  todayISO: () => "2026-09-03", ROLE_LABEL: { admin: "Admin" }, Search: icon, TrendingUp: icon, Users: icon, Target: icon, FileText: icon,
  RefreshCw: icon, Check: icon, AlertTriangle: icon, ArrowRight: icon, supabase: { rpc: vi.fn() } };

beforeEach(() => cleanup());

describe("ALLBEE AI surfaces", () => {
  it("loads knowledge context, renders quick prompts, and sends a chat", async () => {
    const rpc = baseRuntime.supabase.rpc.mockImplementation((name) => {
      if (name === "knowledge_search") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    const invoke = baseRuntime.supabase.functions.invoke.mockImplementation((name) => {
      if (name === "ai-memory-runtime") return Promise.resolve({ data: { rows: [{ title: "Lead follow-up", content: "Follow up open leads promptly." }] } });
      return Promise.resolve({ data: {} });
    });
    render(<AllbeeAI db={{}} config={{}} me={{ name: "Haji" }} role="admin" isAdmin go={vi.fn()} runtime={baseRuntime} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("knowledge_search", { p_query: "", p_limit: 12 }));
    fireEvent.click(screen.getByRole("button", { name: "Summarise" }));
    await waitFor(() => expect(baseRuntime.callAI).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith("ai-memory-runtime", expect.objectContaining({ body: { mode: "query", query: "summarise pending work", limit: 8 }, signal: expect.any(AbortSignal) }));
    expect(baseRuntime.callAI.mock.calls.at(-1)[1]).toContain("RETRIEVED AI MEMORY");
    expect(screen.getByText("Hello from AI")).toBeTruthy();
  });
});

describe("AI optional catalog resilience", () => {
  it("keeps successful catalog reads when one pricing request fails", async () => {
    const rpc=vi.fn(async (name, params)=>{
      if(name==="knowledge_get_pricing" && params.p_service==="marketing") throw new Error("catalog temporarily offline");
      if(name==="knowledge_get_pricing" && params.p_service==="website") return {data:{name:"Website package"},error:null};
      if(name==="knowledge_get_pricing") return {data:null,error:{message:"unavailable"}};
      return {data:[{title:"Reliable reference"}],error:null};
    });
    const invoke=vi.fn(async ()=>({data:{rows:[]},error:null}));
    const callAI=vi.fn().mockResolvedValue("Resilient answer");
    const runtime={...baseRuntime,callAI,supabase:{rpc,functions:{invoke}}};
    render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="admin" isAdmin go={vi.fn()} runtime={runtime}/>);
    await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(4));
    await waitFor(()=>expect(screen.getByLabelText("Message ALLBEE AI")).toBeTruthy());
    await new Promise(resolve=>setTimeout(resolve,20));
    fireEvent.change(screen.getByLabelText("Message ALLBEE AI"),{target:{value:"Help with pricing"}});
    fireEvent.click(screen.getByRole("button",{name:"Send message"}));
    await waitFor(()=>expect(callAI).toHaveBeenCalled());
    const system=callAI.mock.calls.at(-1)[1];
    expect(system).toContain("Website package");
    expect(system).toContain("Reliable reference");
    expect(system).not.toContain("catalog temporarily offline");
    expect(screen.getByText("Resilient answer")).toBeTruthy();
  });
});

describe("AI Intelligence Center", () => {
  it("loads the dashboard and exercises search, settings, and refresh actions", async () => {
    const rpc = intelligenceRuntime.supabase.rpc;
    rpc.mockImplementation((name) => {
      if (name === "ai_get_dashboard") return Promise.resolve({ data: { health: {}, lead_scores: [], partner_scores: [], employee_scores: [], forecasts: [], insights: [], recommendations: [], settings: { enabled: true, sensitivity: "balanced", forecast_period: 90, prediction_model: "deterministic-v1" } } });
      if (name === "web_ai_config") return Promise.resolve({ data: {} });
      if (name === "ai_natural_language_search") return Promise.resolve({ data: [] });
      if (name === "ai_refresh_insights") return Promise.resolve({ data: {} });
      if (name === "ai_save_settings") return Promise.resolve({ data: { enabled: true, sensitivity: "balanced", forecast_period: 90, prediction_model: "deterministic-v1" } });
      return Promise.resolve({ data: {} });
    });
    render(<AIIntelligenceCenter db={{ ai_history: [] }} go={vi.fn()} openModal={vi.fn()} reload={vi.fn()} runtime={intelligenceRuntime} />);
    await waitFor(() => expect(screen.getByText("AI Intelligence Center")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Natural search" }));
    fireEvent.change(screen.getByLabelText("Natural language business search"), { target: { value: "revenue" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("ai_natural_language_search", { p_query: "revenue" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("ai_save_settings", expect.any(Object)));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh intelligence" }).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Refresh intelligence" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("ai_refresh_insights"));
    expect(rpc).toHaveBeenCalledWith("ai_natural_language_search", { p_query: "revenue" });
    expect(rpc).toHaveBeenCalledWith("ai_save_settings", expect.any(Object));
  });
});

describe("Assistant failure and retry", () => {
 it("preserves the draft, prevents duplicate sends, and retries without duplicate history", async () => {
  let rejectRequest;
  const callAI = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest=reject; })).mockResolvedValue("Recovered");
  const runtime = { ...baseRuntime, callAI };
  render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="admin" isAdmin go={vi.fn()} runtime={runtime} />);
  const input = screen.getByLabelText("Message ALLBEE AI");
  fireEvent.change(input,{target:{value:"Review my tasks"}});
  fireEvent.click(screen.getByRole("button",{name:"Send message"}));
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button",{name:"New chat"}).disabled).toBe(true);
  fireEvent.keyDown(input,{key:"Enter"});
  expect(callAI).toHaveBeenCalledTimes(1);
  rejectRequest(new Error("private gateway failure"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(input.value).toBe("Review my tasks");
  expect(screen.queryByText("private gateway failure")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Try again"}));
  await waitFor(() => expect(screen.getByText("Recovered")).toBeTruthy());
  expect(callAI).toHaveBeenCalledTimes(2);
  expect(screen.getAllByText("Review my tasks")).toHaveLength(1);
 });
});

describe("Assistant response controls", () => {
 it("falls back to the main assistant when memory indexing stalls", async () => {
  let indexingSignal;
  const invoke = vi.fn((_name, options) => {
    indexingSignal = options.signal;
    return new Promise(() => {});
  });
  const callAI = vi.fn().mockResolvedValue("Main assistant answered");
  render(<AllbeeAI db={{}} config={{}} me={{ name: "Alex" }} role="admin" isAdmin go={vi.fn()} runtime={{ ...baseRuntime, callAI, supabase: { rpc: vi.fn(), functions: { invoke } } }} />);
  fireEvent.change(screen.getByLabelText("Message ALLBEE AI"), { target: { value: "Help me" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(1), { timeout: 3000 });
  expect(await screen.findByText("Main assistant answered")).toBeTruthy();
  expect(indexingSignal.aborted).toBe(true);
 });
 it("can stop while optional memory indexing is stuck", async () => {
  let memorySignal;
  const invoke = vi.fn((_name, options) => {
    memorySignal = options.signal;
    return new Promise(() => {});
  });
  const callAI = vi.fn().mockResolvedValue("Unexpected reply");
  render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="admin" isAdmin go={vi.fn()} runtime={{ ...baseRuntime, callAI, supabase: { rpc: vi.fn(), functions: { invoke } } }} />);
  fireEvent.change(screen.getByLabelText("Message ALLBEE AI"), { target: { value: "Check memory" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(memorySignal.aborted).toBe(true);
  expect(screen.getByText("Response stopped. Your conversation is unchanged.")).toBeTruthy();
  expect(callAI).not.toHaveBeenCalled();
 });
 it("aborts the gateway when leaving the AI screen", async () => {
  let pendingSignal;
  const callAI = vi.fn((_cfg, _system, _messages, _client, options) => {
    pendingSignal = options.signal;
    return new Promise(() => {});
  });
  const view = render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="client" isAdmin={false} go={vi.fn()} runtime={{ ...baseRuntime, callAI }} />);
  fireEvent.change(screen.getByLabelText("Message ALLBEE AI"), { target: { value: "Summarise" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(1));
  view.unmount();
  expect(pendingSignal.aborted).toBe(true);
 });
 it("stops a pending response without appending stale output", async () => {
  let resolveRequest;
  const callAI = vi.fn(() => new Promise((resolve) => { resolveRequest = resolve; }));
  render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="admin" isAdmin go={vi.fn()} runtime={{...baseRuntime, callAI}} />);
  fireEvent.change(screen.getByLabelText("Message ALLBEE AI"), {target:{value:"Analyse this"}});
  fireEvent.click(screen.getByRole("button", {name:"Send message"}));
  await waitFor(() => expect(screen.getByRole("button", {name:"Stop"})).toBeTruthy());
  fireEvent.click(screen.getByRole("button", {name:"Stop"}));
  expect(screen.getByText("Response stopped. Your conversation is unchanged.")).toBeTruthy();
  resolveRequest("Stale reply");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText("Stale reply")).toBeNull();
 });

 it("regenerates the latest answer without duplicating the user message", async () => {
  const callAI = vi.fn().mockResolvedValueOnce("First answer").mockResolvedValueOnce("Second answer");
  render(<AllbeeAI db={{}} config={{}} me={{name:"Alex"}} role="admin" isAdmin go={vi.fn()} runtime={{...baseRuntime, callAI}} />);
  fireEvent.change(screen.getByLabelText("Message ALLBEE AI"), {target:{value:"Summarise today"}});
  fireEvent.click(screen.getByRole("button", {name:"Send message"}));
  await waitFor(() => expect(screen.getByText("First answer")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", {name:"Regenerate"}));
  await waitFor(() => expect(screen.getByText("Second answer")).toBeTruthy());
  expect(screen.queryByText("First answer")).toBeNull();
  expect(screen.getAllByText("Summarise today")).toHaveLength(1);
  expect(callAI).toHaveBeenCalledTimes(2);
 });
});

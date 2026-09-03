import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AllbeeAI from "./AllbeeAI.jsx";
import AIIntelligenceCenter from "./AIIntelligenceCenter.jsx";

const icon = ({ children }) => <span>{children}</span>;
const baseRuntime = { aiConfigOf: () => ({ enabled: true }), companyOf: () => ({ name: "ALLBEE" }), aiConfigured: () => true,
  buildAIContext: () => "snapshot", callAI: vi.fn().mockResolvedValue("Hello from AI"), ROLE_LABEL: { admin: "Admin" },
  AI_QUICK_PROMPTS: [["Summarise", "summarise pending work"]], renderAIText: (x) => <span>{x}</span>, supabase: { rpc: vi.fn() } };
const intelligenceRuntime = { Empty: ({ title }) => <div>{title}</div>, Field: ({ children }) => <div>{children}</div>, money: (n) => `₹${n || 0}`,
  fmtDate: () => "date", fmtDateTime: () => "date-time", Activity: icon, emitToast: vi.fn(), exportRowsToExcel: vi.fn(), exportRowsToPDF: vi.fn(),
  todayISO: () => "2026-09-03", ROLE_LABEL: { admin: "Admin" }, Search: icon, TrendingUp: icon, Users: icon, Target: icon, FileText: icon,
  RefreshCw: icon, Check: icon, AlertTriangle: icon, ArrowRight: icon, supabase: { rpc: vi.fn() } };

beforeEach(() => cleanup());

describe("ALLBEE AI surfaces", () => {
  it("loads knowledge context, renders quick prompts, and sends a chat", async () => {
    const rpc = baseRuntime.supabase.rpc.mockImplementation((name) => name === "knowledge_search" ? Promise.resolve({ data: [] }) : Promise.resolve({ data: {} }));
    render(<AllbeeAI db={{}} config={{}} me={{ name: "Haji" }} role="admin" isAdmin go={vi.fn()} runtime={baseRuntime} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("knowledge_search", { p_query: "", p_limit: 12 }));
    fireEvent.click(screen.getByRole("button", { name: "Summarise" }));
    await waitFor(() => expect(baseRuntime.callAI).toHaveBeenCalled());
    expect(screen.getByText("Hello from AI")).toBeTruthy();
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

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AIIntelligenceCenter from "./AIIntelligenceCenter.jsx";
import PageErrorBoundary from "./ui/PageErrorBoundary.jsx";

vi.mock("./supabaseClient", () => {
  const rpc = async (name) => {
    const malformed = {
      ai_get_dashboard: { health: "invalid", lead_scores: { rows: [] }, partner_scores: 12, employee_scores: {}, forecasts: "bad", insights: { items: [] }, recommendations: "not a list", settings: [] },
      app_error_health: { last_24h: 2, groups: { unexpected: true } },
      ai_natural_language_search: { results: [] },
      ai_memory_admin_explorer: { rows: [] },
      ai_memory_health: null,
      ai_intelligence_v5_dashboard: { recommendations: "bad", lead_predictions: "bad", partner_predictions: {} },
      ai_intelligence_v5_accuracy: {},
      ai_crm_admin_actions: { invalid: true },
      ai_crm_provider_health: { invalid: true },
      business_automation_history: { invalid: true },
      platform_v6_ops_snapshot: {},
      web_ai_config: {},
    };
    return { data: Object.hasOwn(malformed, name) ? malformed[name] : [], error: null };
  };
  const from = () => {
    const response = Promise.resolve({ data: { malformed: true }, error: null });
    const chain = { then: (resolve, reject) => response.then(resolve, reject) };
    for (const method of ["select", "order", "eq", "is", "limit", "range"]) chain[method] = () => chain;
    return chain;
  };
  return { supabase: { rpc, from } };
});

afterEach(cleanup);

const Empty = ({ title }) => <div>{title}</div>;
const Field = ({ label, children }) => <label>{label}{children}</label>;
const runtime = {
  Empty, Field, money: (v) => "₹" + Number(v || 0), fmtDate: (v) => String(v || ""),
  fmtDateTime: (v) => String(v || ""), ROLE_LABEL: {},
  emitToast: vi.fn(), todayISO: () => "2026-10-16",
  exportRowsToPDF: vi.fn(), exportRowsToExcel: vi.fn(),
};

describe("malformed AI responses do not crash workspace", () => {
  it("keeps all AI Intelligence tabs usable when RPCs return wrong shapes", async () => {
    render(<AIIntelligenceCenter db={{ crm_leads: {}, crm_follow_ups: "", crm_quotations: null, ai_history: {} }} go={vi.fn()} reload={vi.fn()} mutate={vi.fn()} openModal={vi.fn()} runtime={runtime} />);
    await screen.findByText("AI Intelligence Center");
    await screen.findByText("Company intelligence at a glance");
    for (const label of ["Lead AI", "Partner AI", "Employee AI", "Finance AI", "Observability", "Natural search", "Reports", "Settings", "AI Delivery", "AI Memory", "AI Executive", "V6 Operations", "Automation"]) {
      fireEvent.click(screen.getAllByRole("button", { name: label, exact: true })[0]);
      await waitFor(() => expect(screen.queryByText(/ALLBEE could not render/i)).toBeNull());
    }
    expect(screen.getAllByRole("button", { name: "Automation", exact: true }).length).toBeGreaterThan(0);
  });
  it("returns to Overview if the saved AI section no longer exists", async () => {
    sessionStorage.setItem("allbee:view:ai-intelligence", JSON.stringify("unavailable-tab"));
    render(<AIIntelligenceCenter db={{ ai_history: [] }} go={vi.fn()} reload={vi.fn()} mutate={vi.fn()} openModal={vi.fn()} runtime={runtime} />);
    await screen.findByText("Company intelligence at a glance");
    await waitFor(() => expect(screen.getByRole("button", { name: "Overview", exact: true }).classList.contains("on")).toBe(true));
    sessionStorage.removeItem("allbee:view:ai-intelligence");
  });
  it("isolates a broken page and restores the page on retry", () => {
    const Broken = ({ broken }) => { if (broken) throw new Error("Simulated tab crash"); return <p>Page recovered</p>; };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<PageErrorBoundary onNavigateHome={vi.fn()}><Broken broken /></PageErrorBoundary>);
    expect(screen.getByText("This page could not load")).toBeTruthy();
    view.rerender(<PageErrorBoundary onNavigateHome={vi.fn()}><Broken broken={false}/></PageErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Retry page" }));
    expect(screen.getByText("Page recovered")).toBeTruthy();
    log.mockRestore();
  });
});

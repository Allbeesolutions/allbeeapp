import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";

const state = vi.hoisted(() => ({ reads: [], zonePromise: null, releaseZone: null, role: "partner", listeners: [], rpcs: [] }));
vi.mock("./supabaseClient.js", () => {
  const profile = { id: "p1", name: "Test Partner", role: state.role, mobile: "9999999999", dob: "1990-01-01", active: true, approved: true, status: "active", perms: { modules: [] } };
  const partner = { id: "p1", name: "Test Partner", role: "partner", status: "active", zone: "north", district: "Chennai", state: "Tamil Nadu" };
  const from = (table) => {
    const builder = {
      select: () => builder, update: () => builder, upsert: () => builder, insert: () => builder, delete: () => builder, order: () => builder, eq: () => builder, in: () => builder,
      neq: () => builder, limit: () => builder, range: () => builder,
      abortSignal: () => builder, filter: () => builder,
      maybeSingle: () => Promise.resolve({ data: table === "profiles" ? profile : null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve, reject) => {
        state.reads.push(table);
        const data = table === "profiles" ? [profile] : table === "apn_users" ? [{ id: "p1", data: partner }] : [];
        if (table === "apn_zone_requests" && state.zonePromise) return state.zonePromise.then(() => ({ data, error: null })).then(resolve, reject);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
  const channel = { on: (_event, filter, handler) => { state.listeners.push({ filter, handler }); return channel; }, subscribe: () => channel };
  return { supabase: {
    from, channel: () => channel, removeChannel: () => {},
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "p1", email: "partner@test.example", user_metadata: {} } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: () => Promise.resolve({ error: null }), signOut: () => Promise.resolve({}),
    },
    rpc: (name) => { state.rpcs.push(name); return Promise.resolve({ data: name === "apn_agreement_status" ? { required: false, requiredList: [] } : null, error: null }); },
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    storage: { from: () => ({ remove: () => Promise.resolve({}), upload: () => Promise.resolve({}) }) },
  }, SUPABASE_URL: "https://example.supabase.co" };
});
describe("partner first load", () => {
  it("waits for partner home data before rendering the portal", async () => {
    if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    vi.stubEnv("VITE_PAUSE_TEST", "0");
    vi.stubEnv("VITE_FOUNDER_LOCKDOWN_QUIET", "true");
    const { default: App } = await import("./AllbeeApp.jsx");
    state.reads.length = 0;
    state.zonePromise = new Promise((resolve) => { state.releaseZone = resolve; });
    render(<App />);
    await waitFor(() => expect(state.reads).toContain("apn_zone_requests"), { timeout: 10000 });
    expect(screen.queryByText("Test Partner")).toBeNull();
    state.releaseZone();
    await waitFor(() => expect(screen.getAllByText("Test Partner").length).toBeGreaterThan(0), { timeout: 10000 });
    expect(state.reads).toContain("apn_commission_projects");
    expect(state.reads).not.toContain("transactions");
    expect(state.reads).not.toContain("crm_leads");
  }, 20000);
  it("loads only the selected partner tab on navigation and manual refresh", async () => {
    if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    vi.stubEnv("VITE_PAUSE_TEST", "0");
    vi.stubEnv("VITE_FOUNDER_LOCKDOWN_QUIET", "true");
    window.location.hash = "#/apn/home";
    state.role = "partner";
    state.zonePromise = null;
    const { default: App } = await import("./AllbeeApp.jsx");
    render(<App />);
    await waitFor(() => expect(screen.getAllByText("Test Partner").length).toBeGreaterThan(0), { timeout: 10000 });
    state.reads.length = 0; state.rpcs.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    await waitFor(() => expect(state.reads).toContain("apn_training"));
    expect(state.reads).not.toContain("crm_leads");
    expect(state.reads).not.toContain("apn_commission_projects");
    expect(state.rpcs).not.toContain("apn_partner_financial_snapshot");
    await waitFor(() => expect(screen.queryByText("Loading APN tab…")).toBeNull());
    state.reads.length = 0;
    fireEvent.click(screen.getAllByRole("button", { name: "My Network" })[0]);
    await waitFor(() => expect(state.reads).toContain("apn_referral_relationships"));
    expect(state.reads).not.toContain("crm_leads");
    expect(window.location.hash).toBe("#/apn/network");
    state.reads.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Refresh current portal" }));
    await waitFor(() => expect(state.reads).toContain("apn_referral_relationships"));
    expect(state.reads).not.toContain("crm_leads");
    cleanup();
  }, 20000);
  it("loads admin APN tabs without the full normalized CRM scope", async () => {
    if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    vi.stubEnv("VITE_PAUSE_TEST", "0");
    vi.stubEnv("VITE_FOUNDER_LOCKDOWN_QUIET", "true");
    state.role = "admin";
    state.zonePromise = null;
    window.location.hash = "#/apn";
    const { default: App } = await import("./AllbeeApp.jsx");
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Materials/ })).toBeTruthy(), { timeout: 10000 });
    state.reads.length = 0;
    fireEvent.click(screen.getByRole("button", { name: /Materials/ }));
    await waitFor(() => expect(state.reads).toContain("apn_documents"));
    expect(state.reads).not.toContain("crm_leads");
    expect(state.reads).not.toContain("transactions");
    state.reads.length = 0;
    const docsChange = [...state.listeners].reverse().find((entry) => entry.filter?.table === "apn_documents" && entry.filter?.event === "INSERT");
    expect(docsChange).toBeTruthy();
    docsChange.handler({ table: "apn_documents", eventType: "INSERT" });
    await waitFor(() => expect(state.reads).toContain("apn_documents"), { timeout: 5000 });
    expect(state.reads).not.toContain("crm_leads");
    cleanup();
    state.role = "partner";
  }, 20000);
});

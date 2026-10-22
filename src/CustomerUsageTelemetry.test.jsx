import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CustomerUsageTelemetry from "./CustomerUsageTelemetry.jsx";
import { usageStorageKeys } from "./usageAnalyticsKeys.js";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn(),
}));
vi.mock("./supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange },
  },
}));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let onAuth;
let originalHash;
let uuidCounter;

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => items.has(String(key)) ? items.get(String(key)) : null,
    setItem: (key, value) => items.set(String(key), String(value)),
    removeItem: key => items.delete(String(key)),
    clear: () => items.clear(),
  };
}

beforeEach(() => {
  uuidCounter = 0;
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  originalHash = window.location.hash;
  window.location.hash = "#/dashboard";
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: A } } } });
  mocks.onAuthStateChange.mockImplementation((fn) => {
    onAuth = fn;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  vi.stubGlobal("crypto", { randomUUID: () => {
    uuidCounter++;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
  } });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  window.location.hash = originalHash;
});

describe("AllBee consented analytics telemetry", () => {
  it("does not collect until opt-in, strips sensitive targets and stops after withdrawal", async () => {
    render(<CustomerUsageTelemetry />);
    expect(await screen.findByRole("dialog", { name: "Optional usage analytics" })).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
      "app_record_customer_usage", expect.objectContaining({ p_kind: "visit", p_screen: "dashboard" })
    ));
    expect(mocks.rpc).toHaveBeenCalledWith("app_record_customer_usage", expect.objectContaining({ p_kind: "view" }));
    const button = document.createElement("button");
    button.textContent = "SECRET ACCOUNT 123456";
    document.body.appendChild(button);
    fireEvent.click(button);
    expect(mocks.rpc).toHaveBeenCalledWith("app_record_customer_usage", expect.objectContaining({
      p_kind: "tap", p_target: "button",
    }));
    const payloads = mocks.rpc.mock.calls.map(([,payload]) => JSON.stringify(payload));
    expect(payloads.every(p => !p.includes("SECRET") && !p.includes("ACCOUNT"))).toBe(true);
    button.remove();

    const before = mocks.rpc.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Change optional usage analytics consent" }));
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(localStorage.getItem(usageStorageKeys(A).visitor)).toBeNull();
    expect(sessionStorage.getItem(usageStorageKeys(A).session)).toBeNull();
    window.location.hash = "#/tasks";
    fireEvent(window, new Event("hashchange"));
    expect(mocks.rpc.mock.calls.length).toBe(before);
  });

  it("keeps old-user consent separate when another account logs in", async () => {
    render(<CustomerUsageTelemetry />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    const old = mocks.rpc.mock.calls.length;
    await act(async () => { onAuth("SIGNED_IN", { user: { id: B } }); });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Optional usage analytics" })).toBeTruthy());
    window.location.hash = "#/tasks";
    fireEvent(window, new Event("hashchange"));
    expect(mocks.rpc.mock.calls.length).toBe(old);
    expect(localStorage.getItem(usageStorageKeys(B).choice)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    await waitFor(() => expect(mocks.rpc.mock.calls.length).toBeGreaterThan(old));
    expect(localStorage.getItem(usageStorageKeys(B).choice)).toBe("yes");
  });

  it("does not count private finance, chat or account routes even with consent", async () => {
    localStorage.setItem(usageStorageKeys(A).choice, "yes");
    window.location.hash = "#/chat/secret";
    render(<CustomerUsageTelemetry />);
    await screen.findByRole("button", { name: "Change optional usage analytics consent" });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mocks.rpc).not.toHaveBeenCalled();
    for (const hash of ["#/apn/wallet", "#/accounts", "#/settings", "#/vault"]) {
      window.location.hash = hash;
      fireEvent(window, new Event("hashchange"));
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

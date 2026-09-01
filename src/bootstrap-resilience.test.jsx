import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Controls how the mocked Supabase behaves for a chosen table. This reproduces
// the production incident: a single slow/erroring/hanging table used to hang
// Promise.all in fetchAll, leaving `db` null and the loading screen up forever.
const ctrl = vi.hoisted(() => ({ failTable: null, mode: "ok" }));

vi.mock("./supabaseClient", () => {
  const PROFILE = {
    id: "u1", name: "Tester", role: "admin", mobile: "9999999999", dob: "1990-01-01",
    active: true, approved: true, perms: { modules: [] }, tnc_version: 0,
  };
  const makeBuilder = (tbl) => {
    const builder = {
      tbl,
      select: () => builder, order: () => builder, eq: () => builder, in: () => builder,
      neq: () => builder, limit: () => builder, filter: () => builder, range: () => builder, single: () => builder,
      insert: () => builder, update: () => builder, upsert: () => builder, delete: () => builder,
      then: (resolve, reject) => {
        if (ctrl.failTable && tbl === ctrl.failTable) {
          if (ctrl.mode === "hang") return new Promise(() => {});           // never resolves
          if (ctrl.mode === "error") return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject);
        }
        const data = tbl === "profiles" ? [PROFILE] : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
  const channel = { on: () => channel, subscribe: () => {}, unsubscribe: () => {} };
  const auth = {
    getSession: () => Promise.resolve({ data: { session: { user: { id: "u1", email: "tester@allbee.test", user_metadata: {} } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    refreshSession: () => Promise.resolve({ error: null }),
    signInWithPassword: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve({}),
  };
  const supabase = {
    from: (tbl) => makeBuilder(tbl),
    channel: () => channel,
    removeChannel: () => {},
    auth,
    rpc: (name) => {
      if (name === "apn_agreement_status") return Promise.resolve({ data: { required: false }, error: null });
      if (name === "apn_partner_financial_snapshot") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: [], error: null });
    },
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
    storage: { from: () => ({ remove: () => Promise.resolve({}), upload: () => Promise.resolve({}) }) },
  };
  return { supabase, SUPABASE_URL: "https://x.supabase.co" };
});

import App from "./AllbeeApp.jsx";

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
});

describe("bootstrap resilience — loader must never block the app", () => {
  it("proceeds past the loading screen even when a core table HANGS forever", async () => {
    ctrl.failTable = "transactions";
    ctrl.mode = "hang";
    const { container } = render(<App />);
    await waitFor(() => {
      expect(document.querySelector(".prism-wrap, .loading-screen")).toBeNull();
    }, { timeout: 36000 });
    // real application chrome rendered (not a blank/white screen)
    expect(container.textContent.length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Dashboard|Team|Tasks|ALLBEE/i);
  }, 40000);

  it("proceeds past the loading screen even when a core table ERRORS", async () => {
    ctrl.failTable = "transactions";
    ctrl.mode = "error";
    render(<App />);
    await waitFor(() => {
      expect(document.querySelector(".prism-wrap, .loading-screen")).toBeNull();
    }, { timeout: 8000 });
  }, 12000);
});

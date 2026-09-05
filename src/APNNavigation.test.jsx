import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { APNPortal } from "./AllbeeApp.jsx";
import { supabase } from "./supabaseClient.js";

// Mock matchMedia for jsdom
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
  };
};

// Mock the supabase client
vi.mock("./supabaseClient.js", () => {
  const mockChannel = {
    on: vi.fn().mockImplementation(function() { return this; }),
    subscribe: vi.fn().mockImplementation(function() { return this; }),
  };
  return {
    supabase: {
      rpc: vi.fn().mockImplementation((fn) => {
        if (fn === "apn_list_conversations") return Promise.resolve({ data: [], error: null });
        if (fn === "apn_list_chat_contacts") return Promise.resolve({ data: [], error: null });
        if (fn === "apn_list_friend_requests") return Promise.resolve({ data: [], error: null });
        if (fn === "apn_presence_heartbeat") return Promise.resolve({ data: null, error: null });
        if (fn === "apn_agreement_status") return Promise.resolve({ data: { required: false }, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn().mockResolvedValue(null),
    }
  };
});

describe("APN Portal Navigation", () => {
  const mockDb = {
    apn_users: [
      { id: "test-partner-id", name: "Test Partner", status: "active", role: "partner", district: "Chennai" }
    ],
    apn_attendance: [],
    apn_targets: [],
    apn_training: [],
    apn_quizzes: [],
    apn_leads: [],
    apn_quotations: [],
    apn_commissions: [],
    apn_commission_projects: [],
    apn_revenue_collections: [],
    apn_achievements: [],
    apn_notifications: [],
    apn_documents: [],
    apn_timeline: [],
    apn_warnings: [],
    apn_notes: [],
    apn_activity: [],
    apn_transfer_history: [],
    apn_communications: [],
    apn_zone_requests: [],
  };

  const mockProfile = {
    id: "test-partner-id",
    name: "Test Partner",
    role: "partner",
    active: true,
    approved: true,
    status: "active"
  };

  const mockSession = {
    user: { id: "test-partner-id", email: "partner@example.com" }
  };

  it("persists the selected APN page in the URL for refresh-safe navigation", async () => {
    const signOut = vi.fn();
    const mutate = vi.fn();
    const reload = vi.fn();

    window.location.hash = "#/apn/network";
    const first = render(
      <APNPortal db={mockDb} profile={mockProfile} session={mockSession} signOut={signOut} isDark={false} mutate={mutate} reload={reload} />
    );
    await waitFor(() => expect(screen.getAllByRole("button", { name: /my network/i })[0]).toBeTruthy());

    const chatTabButton = screen.getAllByRole("button", { name: /team chat/i })[0];
    fireEvent.click(chatTabButton);
    await waitFor(() => expect(window.location.hash).toBe("#/apn/chat"));

    first.unmount();
    render(<APNPortal db={mockDb} profile={mockProfile} session={mockSession} signOut={signOut} isDark={false} mutate={mutate} reload={reload} />);
    await waitFor(() => expect(screen.getByText("AllBee Support")).toBeTruthy());
    expect(window.location.hash).toBe("#/apn/chat");
  });

  it("navigates to Team Chat and then back to Home without crashing", async () => {
    const signOut = vi.fn();
    const mutate = vi.fn();
    const reload = vi.fn();
    window.location.hash = "#/apn/home";

    render(
      <APNPortal
        db={mockDb}
        profile={mockProfile}
        session={mockSession}
        signOut={signOut}
        isDark={false}
        mutate={mutate}
        reload={reload}
      />
    );

    // Agreement verification is now fail-closed, so wait for the authoritative
    // gate check before asserting the portal surface.
    await waitFor(() => {
      expect(screen.getByText("Test Partner")).toBeTruthy();
      expect(screen.getByText("Revenue generated")).toBeTruthy();
    });

    // Click on Team Chat tab
    const chatTabButton = screen.getAllByRole("button", { name: /team chat/i })[0];
    fireEvent.click(chatTabButton);

    // Verify we are on Team Chat tab
    await waitFor(() => {
      expect(screen.getByText("AllBee Support")).toBeTruthy();
    });

    // Click back to Home tab
    const homeTabButton = screen.getAllByRole("button", { name: /^home$/i })[0];
    fireEvent.click(homeTabButton);

    // Verify we are successfully back on Home tab (no crash)
    await waitFor(() => {
      expect(screen.getByText("Revenue generated")).toBeTruthy();
    });
  });
});

// Head cockpit regression coverage: role routing must land on the correct
// management surface, and hierarchy scope must not fall back to a foreign
// district/state when authoritative assignments are present.
describe("APN Head Cockpits", () => {
  const baseDb = {
    apn_users: [
      { id: "dh", name: "District Head", role: "district_head", status: "active", district: "Chennai", state: "Tamil Nadu" },
      { id: "p1", name: "Assigned Partner", role: "partner", status: "active", district: "Chennai", state: "Tamil Nadu" },
      { id: "p2", name: "Foreign Partner", role: "partner", status: "active", district: "Madurai", state: "Tamil Nadu" },
      { id: "p3", name: "Pending Partner", role: "partner", status: "pending", district: "Chennai", state: "Tamil Nadu" },
      { id: "sh", name: "State Head", role: "state_head", status: "active", state: "Tamil Nadu" },
    ],
    apn_hierarchy_assignments: [
      { id: "h1", partner_id: "p1", district_head_id: "dh", state_head_id: "sh", status: "active" },
      { id: "h2", partner_id: "p2", district_head_id: null, state_head_id: "sh", status: "active" },
      { id: "h3", partner_id: "p3", district_head_id: null, state_head_id: "sh", status: "active" },
    ],
    apn_attendance: [], apn_targets: [], apn_training: [], apn_quizzes: [], apn_leads: [],
    apn_quotations: [], apn_commissions: [], apn_commission_projects: [], apn_revenue_collections: [],
    apn_achievements: [], apn_notifications: [], apn_documents: [], apn_timeline: [], apn_warnings: [],
    apn_notes: [], apn_activity: [], apn_transfer_history: [], apn_communications: [], apn_zone_requests: [],
  };

  it("routes a District Head to the District Command cockpit and respects assignment scope", async () => {
    window.location.hash = "#/apn/district";
    render(<APNPortal db={baseDb} profile={{ id: "dh", role: "district_head", active: true, approved: true, status: "active" }} session={{ user: { id: "dh" } }} signOut={vi.fn()} isDark={false} mutate={vi.fn()} reload={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("District Command")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Partners \(1\)/i }));
    expect(screen.getByText("Assigned Partner")).toBeTruthy();
    expect(screen.queryByText("Foreign Partner")).toBeNull();
  });

  it("routes a State Head to State Command with state-wide partner oversight", async () => {
    window.location.hash = "#/apn/district";
    render(<APNPortal db={baseDb} profile={{ id: "sh", role: "state_head", active: true, approved: true, status: "active" }} session={{ user: { id: "sh" } }} signOut={vi.fn()} isDark={false} mutate={vi.fn()} reload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("State Command")[1]).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Partners \(3\)/i }));
    expect(screen.getByText("Assigned Partner")).toBeTruthy();
    expect(screen.getByText("Foreign Partner")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("lets the State Head approve and reject pending partners through the secured RPCs", async () => {
    window.location.hash = "#/apn/district";
    render(<APNPortal db={baseDb} profile={{ id: "sh", role: "state_head", active: true, approved: true, status: "active" }} session={{ user: { id: "sh" } }} signOut={vi.fn()} isDark={false} mutate={vi.fn()} reload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("State Command")[1]).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Partners \(3\)/i }));

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("apn_state_head_approve_partner", { p_partner_id: "p3" }));

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reject application" })).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("e.g. Incomplete details"), { target: { value: "Incomplete documents" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject application" }));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("apn_state_head_reject_partner", { p_partner_id: "p3", p_reason: "Incomplete documents" }));
  });
});

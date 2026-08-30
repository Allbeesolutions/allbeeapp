import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { APNPortal } from "./AllbeeApp.jsx";

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

  it("navigates to Team Chat and then back to Home without crashing", async () => {
    const signOut = vi.fn();
    const mutate = vi.fn();
    const reload = vi.fn();

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

    // Verify we start on Home tab
    expect(screen.getByText("Test Partner")).toBeTruthy();
    expect(screen.getByText("Revenue generated")).toBeTruthy();

    // Click on Team Chat tab
    const chatTabButton = screen.getByRole("button", { name: /team chat/i });
    fireEvent.click(chatTabButton);

    // Verify we are on Team Chat tab
    await waitFor(() => {
      expect(screen.getByText("Quick Chats")).toBeTruthy();
    });

    // Click back to Home tab
    const homeTabButton = screen.getByRole("button", { name: /^home$/i });
    fireEvent.click(homeTabButton);

    // Verify we are successfully back on Home tab (no crash)
    await waitFor(() => {
      expect(screen.getByText("Revenue generated")).toBeTruthy();
    });
  });
});

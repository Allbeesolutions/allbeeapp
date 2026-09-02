import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { APNPortal } from "./AllbeeApp.jsx";

window.matchMedia = window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));

vi.mock("./supabaseClient.js", () => {
  const chain = () => ({
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data:null, error:null }), single: vi.fn().mockResolvedValue({ data:null, error:null }),
  });
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return { supabase: {
    rpc: vi.fn().mockImplementation((fn) => {
      if (fn === "apn_agreement_status") return Promise.resolve({ data:{ required:false, requiredList:[], requiredCount:0 }, error:null });
      if (fn === "apn_list_conversations" || fn === "apn_list_chat_contacts" || fn === "apn_list_friend_requests") return Promise.resolve({ data:[], error:null });
      if (fn === "apn_presence_heartbeat") return Promise.resolve({ data:null, error:null });
      if (fn === "apn_get_district_conversation" || fn === "apn_get_state_conversation") return Promise.resolve({ data:[{ conversation_id:"c1", subject:"Test Chat" }], error:null });
      return Promise.resolve({ data:null, error:null });
    }),
    from: vi.fn().mockImplementation(chain), channel: vi.fn().mockReturnValue(channel), removeChannel: vi.fn().mockResolvedValue(null),
  }};
});

const baseDb = {
  apn_users:[{ id:"partner", name:"Test Partner", role:"partner", status:"active", district:"Chennai", state:"Tamil Nadu", apn_id:"APN-TN-0001" }],
  apn_attendance:[], apn_targets:[], apn_training:[], apn_quizzes:[], apn_leads:[], apn_quotations:[],
  apn_commissions:[], apn_commission_projects:[], apn_revenue_collections:[], apn_achievements:[], apn_notifications:[],
  apn_documents:[], apn_timeline:[], apn_warnings:[], apn_notes:[], apn_activity:[], apn_transfer_history:[],
  apn_communications:[], apn_zone_requests:[], apn_withdrawal_requests:[], apn_action_badge_reads:[],
};
const profile = { id:"partner", name:"Test Partner", role:"partner", active:true, approved:true, status:"active" };
const session = { user:{ id:"partner", email:"partner@example.com" } };

beforeEach(() => { cleanup(); window.location.hash = ""; });

const routes = ["home","leads","quotations","wallet","withdrawals","network","chat","learn","targets","documents","agreements","notifications","achievements","leaderboard","profile","ai","support"];

describe("APN partner route smoke coverage", () => {
  for (const route of routes) {
    it(`renders ${route} without a tab crash`, async () => {
      window.location.hash = `#/apn/${route}`;
      render(<APNPortal db={baseDb} profile={profile} session={session} signOut={vi.fn()} isDark={false} mutate={vi.fn()} reload={vi.fn()} />);
      await waitFor(() => {
        expect(screen.queryByText("Something went wrong")).toBeNull();
      }, { timeout: 2500 });
    });
  }
});

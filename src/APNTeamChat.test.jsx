import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { APNPortal, AdminAPNChat } from "./AllbeeApp.jsx";
import { supabase } from "./supabaseClient.js";

window.matchMedia = window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));

let realtimeHandler;
vi.mock("./supabaseClient.js", () => {
  const channel = { on: vi.fn().mockImplementation(function(_event, _filter, handler){ realtimeHandler = handler; return this; }), subscribe: vi.fn().mockImplementation(function(){ return this; }) };
  return { supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data:null, error:null }),
    })),
    channel: vi.fn().mockReturnValue(channel), removeChannel: vi.fn().mockResolvedValue(null),
  }};
});

const db = { apn_users: [{ id:"me", name:"Me", status:"active", role:"partner", district:"Nagore", state:"Tamil Nadu" }] };
const profile = { id:"me", name:"Me", role:"partner", active:true, approved:true, status:"active" };
const session = { user:{ id:"me", email:"me@example.com" } };

beforeEach(() => {
  window.location.hash = "#/apn/chat";
  vi.clearAllMocks();
  supabase.rpc.mockImplementation((fn) => {
    if (fn === "apn_list_conversations") return Promise.resolve({ data:[], error:null });
    if (fn === "apn_list_chat_contacts") return Promise.resolve({ data:[{
      contact_id:"friend", contact_type:"partner", name:"Friend One", apn_id:"APN-TN-0002",
      district:"Nagore", state:"Tamil Nadu", photo_url:null, availability:"online", relationship:"friend"
    }], error:null });
    if (fn === "apn_list_friend_requests") return Promise.resolve({ data:[{
      request_id:"r1", other_id:"friend", other_name:"Friend One", other_apn_id:"APN-TN-0002", direction:"outgoing", status:"accepted"
    }], error:null });
    if (fn === "apn_presence_heartbeat") return Promise.resolve({ data:null, error:null });
    if (fn === "apn_agreement_status") return Promise.resolve({ data:{ required:false }, error:null });
    if (fn === "apn_open_person_chat") return Promise.resolve({ data:[{ conversation_id:"conv1", subject:"Friend One", participant_apn_id:"APN-TN-0002" }], error:null });
    if (fn === "apn_list_messages") return Promise.resolve({ data:[], error:null });
    if (fn === "apn_mark_read" || fn === "apn_mark_delivered") return Promise.resolve({ data:null, error:null });
    if (fn === "apn_send_message_v3") return Promise.resolve({ data:[{ message_id:"m1" }], error:null });
    return Promise.resolve({ data:null, error:null });
  });
});

describe("APN Team Chat", () => {
  it("opens a friend chat through the hardened RPC and sends a message", async () => {
    render(<APNPortal db={db} profile={profile} session={session} signOut={vi.fn()} isDark={false} mutate={vi.fn()} reload={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Friend One")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name:"Chat" })[0]);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message…")).toBeTruthy());
    expect(supabase.rpc).toHaveBeenCalledWith("apn_open_person_chat", { p_other_apn_id:"APN-TN-0002" });

    fireEvent.change(screen.getByPlaceholderText("Type a message…"), { target:{ value:"Hello from ALLBEE" } });
    fireEvent.click(screen.getByRole("button", { name:"Send" }));
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("apn_send_message_v3", { p_conversation_id:"conv1", p_body:"Hello from ALLBEE", p_reply_to_id:null, p_mentions:[] }));
  });

  it("keeps the visible admin chat while realtime refresh is pending", async () => {
    let messageCall = 0;
    supabase.rpc.mockImplementation((fn) => {
      if (fn === "apn_list_conversations") return Promise.resolve({ data:[{ conversation_id:"c1", conv_type:"person", subject:"Partner One", last_message:"Hello" , unread_count:0 }], error:null });
      if (fn === "apn_list_chat_contacts") return Promise.resolve({ data:[], error:null });
      if (fn === "apn_list_messages") {
        messageCall += 1;
        if (messageCall === 1) return Promise.resolve({ data:[{ id:"m1", sender_id:"partner", sender_name:"Partner One", body:"Existing message", created_at:"2026-09-01T03:20:00Z" }], error:null });
        return new Promise(() => {});
      }
      if (fn === "apn_admin_mark_read") return Promise.resolve({ data:[{ ok:true }], error:null });
      return Promise.resolve({ data:null, error:null });
    });

    render(<AdminAPNChat me={{ id:"admin" }} onUnreadChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Partner One")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name:/Partner One/ }));
    await waitFor(() => expect(screen.getByText("Existing message")).toBeTruthy());

    await act(async () => {
      realtimeHandler?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Existing message")).toBeTruthy();
  });
});

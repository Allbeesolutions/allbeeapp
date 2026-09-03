import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, cleanup, fireEvent } from "@testing-library/react";
import APNNetwork from "./APNNetwork.jsx";

const rpc = vi.fn();
const supabase = { rpc };
const APNReferralMetric = ({ label }) => <div>{label}</div>;
const Avatar = () => <div />;
const Empty = () => <div />;
const Modal = ({ children }) => <div>{children}</div>;
const money = (n) => `₹${n || 0}`;
const runtime = {
  APNReferralMetric, Avatar, Empty, Modal, supabase,
  fmtDate: () => "date", fmtDateTime: () => "date-time", money,
  referralCodeFor: () => ({ code: "TESTCODE", rename_count: 0 }),
  referralLinkFor: () => "https://example.test/ref",
  referralQrFor: () => "data:image/png;base64,qr",
  referralWalletFor: () => ({ pending: 0, approved: 0, withdrawable: 0, paid: 0, lifetime: 0, monthly: 0 }),
  todayISO: () => "2026-09-03",
  exportRowsToExcel: vi.fn(),
  Users: () => <div />, Copy: () => <div />, Pencil: () => <div />, Send: () => <div />,
  Download: () => <div />, Coins: () => <div />, CalendarDays: () => <div />, Hourglass: () => <div />,
  Wallet: () => <div />, BadgeCheck: () => <div />, UserCheck: () => <div />, UserPlus: () => <div />,
  Link2: () => <div />, Clock: () => <div />, Trophy: () => <div />, ChevronRight: () => <div />,
  TrendingUp: () => <div />,
};

beforeEach(() => {
  cleanup();
  rpc.mockReset();
  rpc.mockImplementation((fn) => {
    if (fn === "apn_referral_network") return Promise.resolve({ data: [], error: null });
    if (fn === "apn_referral_leaderboard") return Promise.resolve({ data: [], error: null });
    if (fn === "apn_referral_code_available") return Promise.resolve({ data: true, error: null });
    return Promise.resolve({ data: null, error: null });
  });
});

describe("APN Network refresh stability", () => {
  it("does not turn state updates into an RPC refresh loop", async () => {
    render(<APNNetwork db={{ apn_referral_relationships: [] }} meRow={{ id: "partner" }} pid="partner" reload={vi.fn()} onOpenWithdrawals={vi.fn()} runtime={runtime} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("apn_referral_network", { p_partner_id: "partner" }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const networkCalls = rpc.mock.calls.filter(([fn]) => fn === "apn_referral_network").length;
    const leaderboardCalls = rpc.mock.calls.filter(([fn]) => fn === "apn_referral_leaderboard").length;
    expect(networkCalls).toBe(1);
    expect(leaderboardCalls).toBe(1);
  });

  it("does not crash when cached DB collections or RPC payloads are malformed", async () => {
    rpc.mockImplementation((fn) => {
      if (fn === "apn_referral_network") return Promise.resolve({ data: { unexpected: true }, error: null });
      if (fn === "apn_referral_leaderboard") return Promise.resolve({ data: [null, { partner_id: "partner", partner_name: "Haji", earnings: 0, referral_count: 0 }], error: null });
      return Promise.resolve({ data: null, error: null });
    });
    expect(() => render(<APNNetwork db={{ apn_referral_relationships: {}, apn_users: null, apn_referral_earnings: {}, apn_referral_timeline: {} }} meRow={{ id: "partner" }} pid="partner" reload={vi.fn()} onOpenWithdrawals={vi.fn()} runtime={runtime} />)).not.toThrow();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("apn_referral_network", { p_partner_id: "partner" }));
    fireEvent.click(document.querySelector('[aria-label="Referral network sections"] button:last-child'));
    await waitFor(() => expect(document.body.textContent).toContain("Lifetime"));
  });
});

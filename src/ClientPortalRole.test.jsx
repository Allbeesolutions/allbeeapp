import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ClientPortal from "./ClientPortal.jsx";

const Icon = () => null;
const runtime = {
  companyOf: () => ({ name: "ALLBEE Solutions" }),
  supabase: {}, emitToast: vi.fn(), ToastHost: Icon, GlobalPullToRefresh: Icon,
  FounderTap: ({ alt }) => <span>{alt}</span>, PortalRefreshButton: Icon,
  Avatar: Icon, LogOut: Icon, Home: Icon, Headset: Icon, Link2: Icon,
  Download: Icon, ExternalLink: Icon, Mail: Icon, MessageCircle: Icon,
  LazyPortalHelpdesk: () => <div>Client helpdesk screen</div>,
  fmtDate: (value) => value, fmtDateTime: (value) => value, money: String, LOGO_ICON: "",
};

describe("mocked client portal navigation", () => {
  it("shows only the client's updates and opens support", () => {
    const db = {
      portal_posts: [{ id: "own", clientId: "client-1", title: "My update" }, { id: "other", clientId: "client-2", title: "Other client's update" }],
      documents: [], quotations: [], invoices: [], support_tickets: [],
    };
    render(<ClientPortal db={db} profile={{ id: "client-1", name: "Client One" }} signOut={vi.fn()} isDark={false} config={{}} reload={vi.fn()} runtime={runtime} />);
    expect(screen.getByText("My update")).toBeTruthy();
    expect(screen.queryByText("Other client's update")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Support" }));
    expect(screen.getByText("Client helpdesk screen")).toBeTruthy();
    expect(screen.queryByText("My update")).toBeNull();
  });
});

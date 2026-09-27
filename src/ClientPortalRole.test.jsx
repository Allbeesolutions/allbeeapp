import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import ClientPortal from "./ClientPortal.jsx";

import PortalHelpdesk from "./PortalHelpdesk.jsx";
import { Field, Modal } from "./AllbeeApp.jsx";
afterEach(cleanup);
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


it("wires the real helpdesk runtime and submits a client support ticket", async () => {
 const rpc=vi.fn().mockResolvedValue({data:"ticket-1",error:null});
 const reload=vi.fn();
 const clientRuntime={...runtime,LazyPortalHelpdesk:PortalHelpdesk,Field,Modal,Empty:({title})=><p>{title}</p>,Plus:Icon,ChevronDown:Icon,Send:Icon,supabase:{rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{ticket_no:"SUP-1"}})})})})}};
 render(<ClientPortal db={{portal_posts:[],documents:[],quotations:[],invoices:[],support_tickets:[]}} profile={{id:"client-1",name:"Client One"}} signOut={vi.fn()} config={{}} reload={reload} runtime={clientRuntime} />);
 fireEvent.click(screen.getByRole("button",{name:"Support",exact:true}));
 fireEvent.click(await screen.findByRole("button",{name:"Create Ticket",exact:true}));
 fireEvent.change(screen.getByLabelText(/Subject/),{target:{value:"Review handoff"}});
 fireEvent.click(screen.getByRole("button",{name:"Submit ticket",exact:true}));
 await waitFor(()=>expect(rpc).toHaveBeenCalledWith("apn_create_support_ticket",expect.objectContaining({p_subject:"Review handoff"})));
 await waitFor(()=>expect(reload).toHaveBeenCalled());
});

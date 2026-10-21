import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientPortal from "./ClientPortal.jsx";

const Empty = () => null;
const base = {
  companyOf: () => ({ name: "ALLBEE" }), supabase: {rpc:vi.fn()}, emitToast: vi.fn(),
  ToastHost: Empty, GlobalPullToRefresh: Empty, FounderTap: Empty, PortalRefreshButton: Empty,
  Avatar: Empty, LogOut: Empty, Home: Empty, Headset: Empty, Link2: Empty,
  Download: Empty, ExternalLink: Empty, Mail: Empty, MessageCircle: Empty,
  LazyPortalHelpdesk: Empty, fmtDate: String, fmtDateTime: String,
  money: String, LOGO_ICON: "",
};
afterEach(() => { cleanup(); window.location.hash = ""; vi.clearAllMocks(); });

describe("Client portal defensive scoping and support errors", () => {
  it("never exposes rows with missing ownership when session has no client ID", () => {
    window.location.hash = "#/client/home";
    const db = {
      portal_posts: [{title: "Unscoped update"},{title:"Other update",clientId:"other"}],
      documents: [{title:"Unscoped file"}],
      quotations: [{title:"Unscoped quote"}],
      invoices: [{title:"Unscoped invoice"}],
    };
    render(<ClientPortal db={db} profile={{name:"Unknown"}} config={{}} reload={vi.fn()} runtime={base}/>);
    for(const text of ["Unscoped update","Unscoped file","Unscoped quote","Unscoped invoice","Other update"])
      expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByText("No updates yet. We'll post progress here as we go.")).toBeTruthy();
  });

  it("renders owned rows with corrupt nested quotation items and invalid document dates", () => {
    window.location.hash = "#/client/home";
    const db = {
      portal_posts: [null, "bad"],
      documents: [null,{id:"d",clientId:"self",title:"Owned file",createdAt:"not-a-date"}],
      quotations: [null,{id:"q",clientId:"self",title:"Owned quote",items:{bad:true}}],
      invoices: [],support_tickets:[null],
    };
    render(<ClientPortal db={db} profile={{id:"self",name:"Client"}} config={{}} reload={vi.fn()} runtime={base}/>);
    expect(screen.getByText("Owned quote")).toBeTruthy();
    expect(screen.getByText("0 items")).toBeTruthy();
    expect(screen.getByText("Owned file")).toBeTruthy();
    expect(screen.queryByText("This page could not load")).toBeNull();
  });

  it("reports photo removal failure without unhandled rejection or a false success", async () => {
    window.location.hash = "#/client/profile";
    const saveMyProfile=vi.fn().mockRejectedValue(new Error("Storage unavailable"));
    const reload=vi.fn();
    render(<ClientPortal db={{}} profile={{id:"self",name:"Client",photo_url:"https://example.com/photo.jpg"}} config={{}} saveMyProfile={saveMyProfile} reload={reload} runtime={base}/>);
    fireEvent.click(screen.getByRole("button",{name:"Remove photo"}));
    await waitFor(()=>expect(base.emitToast).toHaveBeenCalledWith("Storage unavailable","error"));
    expect(saveMyProfile).toHaveBeenCalledWith({photo_url:null});
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("button",{name:"Remove photo"}).disabled).toBe(false);
  });
  it("returns a safe failure on rejected support network requests and never sends another client's ticket", async () => {
    window.location.hash = "#/client/support";
    let onSend;
    const rpc = vi.fn().mockRejectedValue(new Error("Service unavailable"));
    const runtime={...base,supabase:{rpc},LazyPortalHelpdesk:(props)=>{onSend=props.onSend;return <p>Support ready</p>;}};
    const db = {support_tickets:[{id:"mine",client_id:"self",status:"open"}],portal_posts:[],documents:[],quotations:[],invoices:[]};
    render(<ClientPortal db={db} profile={{id:"self",name:"Client"}} config={{}} reload={vi.fn()} runtime={runtime}/>);
    expect(screen.getByText("Support ready")).toBeTruthy();
    expect(await onSend("someone-else","Hi")).toBe(false);
    expect(rpc).not.toHaveBeenCalledWith("apn_helpdesk_client_message",expect.anything());
    expect(await onSend("mine","Hello")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("apn_helpdesk_client_message",{p_ticket_id:"mine",p_message:"Hello"});
    await waitFor(()=>expect(base.emitToast).toHaveBeenCalledWith("Service unavailable","error"));
  });
});

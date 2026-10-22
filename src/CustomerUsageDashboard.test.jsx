import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlatformV6Operations from "./PlatformV6Operations.jsx";
import { verifiedCustomerUsageReport } from "./customerAnalyticsFormatting.js";

const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("./supabaseClient",()=>({supabase:{rpc:mocks.rpc}}));

const valid = {
  visits24h:1, visits7d:2, visitors7d:1, returningUsers7d:0,
  views7d:4, taps7d:3, activeMinutes7d:2,
  daily:[{day:"2026-10-22",visits:1,views:3,users:1}],
  screens:[{screen:"dashboard",views:3}],
  users:[{actor:"11111111",visits:1,days_active:1}],
};
afterEach(()=>{cleanup();mocks.rpc.mockReset()});

describe("privileged customer usage dashboard",()=>{
  it("remains reachable after unrelated Platform V6 operations RPC failure",async()=>{
    mocks.rpc.mockImplementation(async name=>{
      if(name==="platform_v6_ops_snapshot") return {data:null,error:{message:"General operations service unavailable"}};
      if(name==="app_customer_usage_report") return {data:valid,error:null};
      throw Error("Unexpected RPC "+name);
    });
    render(<PlatformV6Operations money={String}/>);
    await screen.findByText(/General operations service unavailable/);
    fireEvent.click(screen.getByRole("button",{name:/Customer activity/}));
    await screen.findByText("Opted-in customer activity");
    expect(mocks.rpc).toHaveBeenCalledWith("app_customer_usage_report");
    expect(screen.getByText("Most visited screens · 7 days")).toBeTruthy();
    expect(screen.getByText("Signed-in user frequency · 7 days")).toBeTruthy();
  });

  it("does not fabricate zeros from a missing or unauthorized usage report",async()=>{
    mocks.rpc.mockImplementation(async name=>{
      if(name==="platform_v6_ops_snapshot")return {data:{automation:{}},error:null};
      if(name==="app_customer_usage_report")return {data:{visits24h:0},error:null};
      throw Error("Unexpected RPC "+name);
    });
    render(<PlatformV6Operations money={String}/>);
    fireEvent.click(screen.getByRole("button",{name:/Customer activity/}));
    await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Usage report missing valid"));
    expect(screen.queryByText("Visits · 7 days")).toBeNull();
  });

  it("rejects invalid counts and absent result arrays",()=>{
    expect(verifiedCustomerUsageReport(valid)).toBe(valid);
    expect(()=>verifiedCustomerUsageReport({})).toThrow();
    expect(()=>verifiedCustomerUsageReport({...valid,visits7d:undefined})).toThrow();
    expect(()=>verifiedCustomerUsageReport({...valid,taps7d:-1})).toThrow();
    expect(()=>verifiedCustomerUsageReport({...valid,daily:null})).toThrow();
    expect(()=>verifiedCustomerUsageReport({...valid,users:[{actor:"x",visits:-1,days_active:0}]})).toThrow();
  });
});

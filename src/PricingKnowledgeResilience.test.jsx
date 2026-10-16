import React from "react";
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import * as Icons from "./icons.jsx";
import PricingKnowledgeCenter from "./PricingKnowledgeCenter.jsx";

const state=vi.hoisted(()=>({pending:[]}));
vi.mock("./supabaseClient",()=>({supabase:{
 rpc:vi.fn((name,args)=>{
  if(name==="knowledge_admin_list")return new Promise(resolve=>state.pending.push({args,resolve}));
  if(name==="knowledge_admin_summary")return Promise.resolve({data:{services:2},error:null});
  return Promise.resolve({data:null,error:null});
 })
}}));

const runtime={...Icons,Field:({label,children})=><label>{label}{children}</label>,
 Empty:({title})=><div>{title}</div>,Modal:({children})=><div>{children}</div>,
 money:()=> "₹0",todayISO:()=> "2026-10-16",exportRowsToExcel:vi.fn(),emitToast:vi.fn()};
const resolveRequest=(request,name)=>request.resolve({data:{items:name?[{id:name,slug:name,name}]:[],total:name?1:0,page_size:25},error:null});
beforeEach(()=>{state.pending=[];sessionStorage.clear();});
afterEach(cleanup);

describe("Pricing & Knowledge route cancellation",()=>{
 it("does not update React state after the route has unmounted",async()=>{
  const view=render(<PricingKnowledgeCenter isAdmin runtime={runtime}/>);
  await waitFor(()=>expect(state.pending.length).toBe(1));
  view.unmount();
  await act(async()=>{resolveRequest(state.pending[0],"Late result");await Promise.resolve();});
  expect(screen.queryByText("Late result")).toBeNull();
 });
 it("keeps the newest search response when an older request resolves later",async()=>{
  render(<PricingKnowledgeCenter isAdmin runtime={runtime}/>);
  await waitFor(()=>expect(state.pending.length).toBe(1));
  fireEvent.change(screen.getByLabelText("Search knowledge catalog"),{target:{value:"new"}});
  await waitFor(()=>expect(state.pending.some(r=>r.args.p_search==="new")).toBe(true));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,30)));
  const latest=state.pending.at(-1);
  expect(latest.args.p_search).toBe("new");
  await act(async()=>{resolveRequest(latest,"New result");await new Promise(resolve=>setTimeout(resolve,80));});
  expect(screen.getAllByText("New result").length).toBeGreaterThan(0);
  await act(async()=>{resolveRequest(state.pending[0],"Stale result");await Promise.resolve();});
  expect(screen.queryByText("Stale result")).toBeNull();
  expect(screen.getAllByText("New result").length).toBeGreaterThan(0);
 });
});

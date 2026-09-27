import React, {useState} from "react";
import {describe,it,expect,vi,afterEach} from "vitest";
import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
import APNLeadForm from "./APNLeadForm.jsx";
import APNQuoteForm from "./APNQuoteForm.jsx";
import {APNSupportTickets} from "./modules/apn/SupportTickets.jsx";
afterEach(cleanup);
const Icon=()=>null;
const Modal=({children,footer})=><div role="dialog">{children}{footer}</div>;
const Field=({label,children,error})=><label>{label}{children}{error&&<span role="alert">{error}</span>}</label>;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const services=[["website","Website"]];
describe("APN save feedback",()=>{
 it("keeps lead details after failure and prevents duplicate pending submissions",async()=>{
  const pending=deferred(),onClose=vi.fn(),onSave=vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce({});
  render(<APNLeadForm meRow={{id:"p",name:"Partner",unlocked:{website:true}}} db={{apn_leads:[]}} onSave={onSave} onClose={onClose} runtime={{APN_SERVICES:services,Field,Modal,uid:()=> "stable-lead"}}/>);
  fireEvent.change(screen.getByLabelText("Client name"),{target:{value:"Client"}});
  fireEvent.change(screen.getByLabelText("Mobile number"),{target:{value:"9000000000"}});
  fireEvent.click(screen.getByText("Submit lead"));fireEvent.click(screen.getByText("Submitting…"));
  expect(onSave).toHaveBeenCalledTimes(1);expect(onClose).not.toHaveBeenCalled();
  pending.reject(new Error("Connection interrupted"));
  await screen.findByText("Connection interrupted");expect(screen.getByLabelText(/^Client name/).value).toBe("Client");
  fireEvent.click(screen.getByText("Submit lead"));await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].id).toBe(onSave.mock.calls[1][0].id);
 });
 it("awaits quotation persistence and retains the same ID on retry",async()=>{
  const pending=deferred(),onClose=vi.fn(),onSave=vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce({});
  const rpc=vi.fn().mockResolvedValue({data:{base:15000,options:[]},error:null});
  render(<APNQuoteForm meRow={{id:"p",name:"Partner"}} onSave={onSave} onClose={onClose} runtime={{useState,supabase:{rpc},uid:()=>"stable-quote",round2:n=>n,money:String,Modal,Field,APN_SERVICES:services,APN_TIEUPS:{},Send:Icon,X:Icon}}/>);
  fireEvent.change(screen.getByLabelText("Client name"),{target:{value:"Client"}});
  await waitFor(()=>expect(screen.getByText("Save draft").disabled).toBe(false));
  fireEvent.click(screen.getByText("Save draft"));expect(onClose).not.toHaveBeenCalled();
  pending.reject(new Error("Save unavailable"));await screen.findByText("Save unavailable");
  expect(screen.getByLabelText(/^Client name/).value).toBe("Client");
  fireEvent.click(screen.getByText("Save draft"));await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].id).toBe(onSave.mock.calls[1][0].id);
 });
 it("recovers support tickets after a rejected request without leaving a loader",async()=>{
  const rpc=vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({data:[{id:"t",ticket_no:"T-1",status:"open",question:"Help"}],error:null});
  render(<APNSupportTickets pid="p" supabase={{rpc}} APNStatusBadge={({status})=><span>{status}</span>} fmtDateTime={()=>"Today"}/>);
  await screen.findByText("Offline");expect(screen.queryByLabelText("Loading your support tickets…")).toBeNull();
  fireEvent.click(screen.getByText("Try again"));await screen.findByText("T-1");expect(screen.queryByText("Offline")).toBeNull();
 });
});

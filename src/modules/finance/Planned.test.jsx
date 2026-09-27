import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Planned from "./Planned.jsx";
afterEach(cleanup);
const helpers={money:String,fmtDate:String,todayISO:()=>"2026-09-27",PLANNED_STATUS:["Planned","Approved","Purchased","Cancelled"],Empty:({title})=><p>{title}</p>};
describe("Planned expense screen",()=>{
 it("renders the empty state without missing icon bindings",()=>{
  render(<Planned db={{planned:[]}} helpers={helpers} />);
  expect(screen.getByText("Nothing planned yet")).toBeTruthy();
 });
 it("renders populated statuses and opens the existing expense save flow",()=>{
  const openIncome=vi.fn();
  render(<Planned db={{planned:[{id:"rent",title:"Office rent",amount:2000,category:"Rent",recurrence:"Monthly",status:"Approved"}]}} helpers={helpers} canFinance openIncome={openIncome} />);
  expect(screen.getByRole("combobox").value).toBe("Approved");
  fireEvent.click(screen.getByRole("button",{name:"Log expense"}));
  expect(openIncome).toHaveBeenCalledWith({kind:"expense",category:"Rent",amount:2000,notes:"Office rent",source:{kind:"planned",id:"rent"}});
 });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Concepts from "./Concepts.jsx";

const Empty = ({title,text,action})=><div><h4>{title}</h4><p>{text}</p>{action}</div>;
describe("lazy-loaded Concepts page",()=>{
 it("handles missing or malformed lists without breaking navigation",()=>{
  const openModal=vi.fn();
  const view=render(<Concepts db={{concepts:{bad:true}}} Empty={Empty} openModal={openModal} removeItem={vi.fn()}/>);
  expect(screen.getByText("No ideas saved")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button",{name:/New idea/})[0]);
  expect(openModal).toHaveBeenCalledWith({type:"concept"});
  view.unmount();
 });
 it("preserves convert, edit, and delete confirmation actions",()=>{
  const openModal=vi.fn(),removeItem=vi.fn();
  render(<Concepts db={{concepts:[null,{id:"i-1",title:"Useful idea",notes:"Make a portal",date:"2026-10-17",tags:["important",null,42]}]}} Empty={Empty} openModal={openModal} removeItem={removeItem}/>);
  expect(screen.getByText("Useful idea")).toBeTruthy();
  expect(screen.getByText("#important")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:/Convert to task/}));
  expect(openModal).toHaveBeenCalledWith({type:"task",initial:{title:"Useful idea",desc:"Make a portal"},fromConcept:"i-1"});
  fireEvent.click(screen.getByRole("button",{name:"Edit record"}));
  expect(openModal).toHaveBeenCalledWith(expect.objectContaining({type:"concept",initial:expect.objectContaining({id:"i-1"})}));
  fireEvent.click(screen.getByRole("button",{name:"Delete record"}));
  const confirm=openModal.mock.calls.at(-1)[0];
  expect(confirm.type).toBe("deleteConfirm");
  confirm.onConfirm();
  expect(removeItem).toHaveBeenCalledWith("concepts",expect.objectContaining({id:"i-1"}),expect.objectContaining({name:"Useful idea"}));
 });
});

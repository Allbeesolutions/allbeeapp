import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Modal, Field, SearchableSelect } from "./AllbeeApp.jsx";
afterEach(cleanup);
describe("Shared control accessibility", () => {
 it("connects a wrapped input to its label and current feedback", () => {
  const { rerender } = render(<Field label="Amount" required hint="In rupees"><div><input /></div></Field>);
  const input = screen.getByLabelText(/^Amount/);
  expect(input.getAttribute("aria-required")).toBe("true");
  expect(document.getElementById(input.getAttribute("aria-describedby")).textContent).toBe("In rupees");
  rerender(<Field label="Amount" error="Enter an amount"><div><input /></div></Field>);
  expect(screen.getByLabelText(/^Amount/).getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toContain("Enter an amount");
 });
 it("retains typing focus across parent rerenders and restores the opener", () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const close = vi.fn();
  const { rerender, unmount } = render(<Modal title="Edit" onClose={close}><input aria-label="Name" /></Modal>);
  screen.getByLabelText("Name").focus();
  rerender(<Modal title="Edit" onClose={() => close()}><input aria-label="Name" /></Modal>);
  expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  fireEvent.keyDown(document.activeElement, { key:"Escape" });
  expect(close).toHaveBeenCalledTimes(1);
  unmount(); expect(document.activeElement).toBe(opener); opener.remove();
 });
 it("lets Escape close the select without closing its dialog", async () => {
  const close = vi.fn();
  render(<Modal title="Edit" onClose={close}><Field label="Client"><SearchableSelect options={["Northwind"]} /></Field></Modal>);
  const trigger = screen.getByLabelText("Client");
  fireEvent.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Filter options")));
  fireEvent.keyDown(document.activeElement, {key:"Escape"});
  expect(close).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
 });
});

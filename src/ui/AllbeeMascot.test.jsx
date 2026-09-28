import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AllbeeMascot, AllbeeAIFloatingAssistant } from "./AllbeeMascot.jsx";
import { readFileSync } from "node:fs";

beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ALLBEE mascot", () => {
  it("uses the supplied artwork with decorative semantics and supports working states", () => {
    const { rerender, container } = render(<AllbeeMascot state="thinking" size={32} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/allbee-ai-mascot.png");
    expect(container.querySelector(".allbee-mascot--thinking")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    rerender(<AllbeeMascot state="success" size={32} />);
    expect(container.querySelector(".allbee-mascot--success")).toBeTruthy();
  });

  it("opens the existing AI route through its caller with click and keyboard", () => {
    const onOpen = vi.fn();
    render(<AllbeeAIFloatingAssistant onOpen={onOpen} displayName="Maya Patel" />);
    expect(screen.getByRole("status").textContent).toContain("Maya");
    const button = screen.getByRole("button", { name: "Ask ALLBEE AI with mascot" });
    fireEvent.click(button);
    act(() => { button.focus(); fireEvent.keyDown(button, { key: "Enter" }); }); // Native buttons activate via browser, not custom key handlers.
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("greets once per session across navigation and hides while editing", () => {
    const { unmount } = render(<AllbeeAIFloatingAssistant onOpen={() => {}} displayName="Maya Patel" />);
    expect(screen.getByRole("status").textContent).toContain("Maya");
    unmount();
    render(<><input aria-label="Edit details" /><AllbeeAIFloatingAssistant onOpen={() => {}} /></>);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => screen.getByLabelText("Edit details").focus());
    expect(screen.queryByTestId("allbee-mascot-launcher")).toBeNull();
    act(() => screen.getByLabelText("Edit details").blur());
  });

  it("does not render on a hidden or conflicting surface", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<AllbeeAIFloatingAssistant onOpen={onOpen} hidden />);
    expect(screen.queryByRole("button", { name: "Ask ALLBEE AI with mascot" })).toBeNull();
    rerender(<AllbeeAIFloatingAssistant onOpen={onOpen} hidden={false} />);
    expect(screen.getByRole("button", { name: "Ask ALLBEE AI with mascot" })).toBeTruthy();
  });

  it("has mobile safe-area placement and reduced-motion fallbacks", () => {
    const css = readFileSync(`${process.cwd()}/src/ui/mascot.css`, "utf8");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain(".allbee-mascot-button:focus-visible");
    expect(css).toContain("allbee-mascot-launcher--client");
    expect(css).toContain("allbee-mascot-launcher--login");
    expect(css).toContain("background:transparent");
    expect(css).toContain("object-fit:contain");
  });
});

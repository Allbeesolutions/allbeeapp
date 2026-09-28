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
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/allbee-ai-mascot.*\.png/);
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
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("status").textContent).toMatch(/Maya/);
    fireEvent.click(button);
    act(() => { button.focus(); fireEvent.keyDown(button, { key: "Enter" }); }); // Native buttons activate via browser, not custom key handlers.
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.blur(button);
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
    expect(css).toContain(".allbee-mascot--idle img { animation:allbee-mascot-idle");
    expect(css).toContain("will-change:transform");
    expect(css).toContain("transform:translateZ(0)");
    expect(css).not.toContain("translateY(");
    expect(css).toContain(".allbee-mascot-button { width:76px; height:76px; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none;");
    expect(css).not.toContain("--mascot-lift");
    const source = readFileSync(`${process.cwd()}/src/ui/AllbeeMascot.jsx`, "utf8");
    expect(source).not.toContain("setLift");
    expect(source).not.toContain("MutationObserver");
    expect(source).toContain("Hello,");
    expect(source).toContain("onMouseEnter={onEnter}");
    expect(source).toContain("onFocus={onEnter}");
  });
});

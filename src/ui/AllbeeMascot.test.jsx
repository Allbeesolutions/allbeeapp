import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AllbeeMascot, AllbeeAIFloatingAssistant, shortGreeting } from "./AllbeeMascot.jsx";
import { readFileSync } from "node:fs";

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches:false, addEventListener:vi.fn(), removeEventListener:vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const button = () => screen.getByRole("button", { name:"Ask ALLBEE AI with mascot" });
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const noIntro = () => sessionStorage.setItem("allbee-mascot-intro-v3", "shown");

describe("ALLBEE mascot", () => {
  it("keeps the canonical decorative fallback and gives each instance unique rig masks", () => {
    const { container } = render(<><AllbeeMascot state="thinking" size={32} /><AllbeeMascot state="success" /></>);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/allbee-ai-mascot.*\.png/);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(container.querySelector(".allbee-mascot--thinking")).toBeTruthy();
    expect(container.querySelector(".allbee-mascot--success")).toBeTruthy();
    expect(container.querySelectorAll(".allbee-mascot-leg")).toHaveLength(4);
    expect(container.querySelectorAll(".allbee-mascot-hand")).toHaveLength(4);
    expect(container.querySelectorAll(".allbee-mascot-eyelid")).toHaveLength(4);
    const ids = [...container.querySelectorAll("[id]")].map(el => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("greets the actual first name on tap and routes only after the explicit AI action", () => {
    const onOpen = vi.fn();
    render(<AllbeeAIFloatingAssistant onOpen={onOpen} displayName="Maya Patel" />);
    fireEvent.click(button());
    expect(screen.getByRole("status").textContent).toBe("Hi, Maya! 👋");
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name:"Open ALLBEE AI" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("supports a second mascot activation as a shortcut to the existing AI route", () => {
    const onOpen = vi.fn();
    render(<AllbeeAIFloatingAssistant onOpen={onOpen} greeting={false} />);
    fireEvent.click(button(), { detail:0 });
    expect(screen.getByRole("button", { name:"Open ALLBEE AI" })).toBeTruthy();
    fireEvent.click(button(), { detail:0 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("dismisses a manual greeting and uses Hello on the next tap", () => {
    render(<AllbeeAIFloatingAssistant displayName="Maya Patel" greeting={false} />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("button", { name:"Dismiss ALLBEE AI greeting" }));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(button());
    expect(screen.getByRole("status").textContent).toBe("Hello, Maya! 👋");
    expect(shortGreeting("  Amina   Khan ", true)).toBe("Hello, Amina! 👋");
    expect(shortGreeting(undefined, true)).toBe("Hello! 👋");
  });

  it("ends an active greeting when the shared shell navigates to another screen", () => {
    const {rerender}=render(<AllbeeAIFloatingAssistant displayName="Maya Patel" context="home" greeting={false}/>);
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    rerender(<AllbeeAIFloatingAssistant displayName="Maya Patel" context="ai" greeting={false}/>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("greets once per session across navigation and hides while editing", () => {
    const { unmount } = render(<AllbeeAIFloatingAssistant displayName="Maya Patel" />);
    expect(screen.getByRole("status").textContent).toContain("Maya");
    unmount();
    render(<><input aria-label="Edit details" /><AllbeeAIFloatingAssistant /></>);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => screen.getByLabelText("Edit details").focus());
    expect(screen.queryByTestId("allbee-mascot-launcher")).toBeNull();
    act(() => screen.getByLabelText("Edit details").blur());
    expect(screen.getByTestId("allbee-mascot-launcher")).toBeTruthy();
  });

  it("does not render on a hidden surface", () => {
    const { rerender } = render(<AllbeeAIFloatingAssistant hidden />);
    expect(screen.queryByRole("button", { name:"Ask ALLBEE AI with mascot" })).toBeNull();
    rerender(<AllbeeAIFloatingAssistant hidden={false} />);
    expect(button()).toBeTruthy();
  });

  it("yields to an underlying action and returns after scrolling", async () => {
    const original = document.elementsFromPoint;
    let obstructed = true;
    document.elementsFromPoint = () => obstructed ? [screen.getByRole("button", { name:"Save details" })] : [];
    try {
      render(<section id="workspace"><button>Save details</button><AllbeeAIFloatingAssistant collisionRootSelector="#workspace" greeting={false} /></section>);
      const launcher = screen.getByTestId("allbee-mascot-launcher");
      await waitFor(() => expect(launcher.classList.contains("is-covered")).toBe(true));
      obstructed = false;
      fireEvent.scroll(document);
      await waitFor(() => expect(launcher.classList.contains("is-covered")).toBe(false));
    } finally { document.elementsFromPoint = original; }
  });

  it("walks slowly inside its bounds and stops at the same position on interaction", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const original = document.elementsFromPoint;
    document.elementsFromPoint = () => [];
    try {
      render(<AllbeeAIFloatingAssistant greeting={false} />);
      tick(7500);
      const launcher = screen.getByTestId("allbee-mascot-launcher");
      expect(launcher.dataset.roaming).toBe("walking");
      const x = parseFloat(launcher.style.getPropertyValue("--mascot-x"));
      expect(x).toBeLessThan(-3);
      expect(x).toBeGreaterThan(-10);
      fireEvent.pointerEnter(launcher);
      expect(launcher.dataset.roaming).toBe("resting");
      tick(5000);
      expect(parseFloat(launcher.style.getPropertyValue("--mascot-x"))).toBe(x);
    } finally { document.elementsFromPoint = original; }
  });

  it("rejects a walk whose destination corridor crosses an action", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const original = document.elementsFromPoint;
    let blocked;
    document.elementsFromPoint = (x) => x < -20 ? [blocked] : [];
    try {
      render(<><button>Protected action</button><AllbeeAIFloatingAssistant greeting={false} /></>);
      blocked = screen.getByRole("button", { name:"Protected action" });
      tick(12000);
      const launcher = screen.getByTestId("allbee-mascot-launcher");
      expect(launcher.dataset.roaming).toBe("resting");
      expect(parseFloat(launcher.style.getPropertyValue("--mascot-x"))).toBe(0);
    } finally { document.elementsFromPoint = original; }
  });

  it("disables roaming and responds to reduced-motion preference changes", () => {
    vi.useFakeTimers();
    const media = new EventTarget();
    media.matches = true;
    vi.stubGlobal("matchMedia", () => media);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<AllbeeAIFloatingAssistant greeting={false} />);
    tick(15000);
    expect(screen.getByTestId("allbee-mascot-launcher").dataset.roaming).toBe("resting");
    media.matches = false;
    act(() => media.dispatchEvent(new Event("change")));
    tick(7500);
    expect(screen.getByTestId("allbee-mascot-launcher").dataset.roaming).toBe("walking");
    media.matches = true;
    act(() => media.dispatchEvent(new Event("change")));
    expect(screen.getByTestId("allbee-mascot-launcher").dataset.roaming).toBe("resting");
  });

  it("spaces contextual help nudges and caps them at three per session", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    noIntro();
    render(<AllbeeAIFloatingAssistant displayName="Maya Patel" />);
    tick(64000);
    expect(screen.queryByRole("status")).toBeNull();
    tick(1000);
    expect(screen.getByRole("status").textContent).toBe("Any doubts, Maya?");
    for (let i=0; i<2; i++) { tick(6000); tick(65000); }
    expect(JSON.parse(sessionStorage.getItem("allbee-mascot-help-v1")).count).toBe(3);
    tick(6000);
    tick(200000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not nudge while editing or in a hidden tab and clears timers on unmount", () => {
    vi.useFakeTimers();
    noIntro();
    const { unmount } = render(<><input aria-label="Draft" /><AllbeeAIFloatingAssistant /></>);
    act(() => screen.getByLabelText("Draft").focus());
    tick(200000);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => screen.getByLabelText("Draft").blur());
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    tick(200000);
    expect(screen.queryByRole("status")).toBeNull();
    hiddenSpy.mockRestore();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("yields while page content animates and rechecks when the transition finishes", () => {
    vi.useFakeTimers();
    let entering=true;
    render(<section id="workspace"><div className="page-enter" data-testid="entering-page">Page content</div><AllbeeAIFloatingAssistant collisionRootSelector="#workspace" greeting={false} /></section>);
    const page=screen.getByTestId("entering-page");
    page.getAnimations=()=>[{playState:entering?"running":"finished",effect:{getTiming:()=>({iterations:1})}}];
    tick(50);
    const launcher=screen.getByTestId("allbee-mascot-launcher");
    expect(launcher.classList.contains("is-covered")).toBe(true);
    entering=false;
    fireEvent.animationEnd(page);
    tick(50);
    expect(launcher.classList.contains("is-covered")).toBe(false);
  });

  it("finds a nearby clear resting spot after yielding to a footer action", () => {
    vi.useFakeTimers();
    const original = document.elementsFromPoint;
    let protectedButton;
    document.elementsFromPoint = (x,y) => x > 950 && y > 650 ? [protectedButton] : [];
    try {
      render(<><button>Footer action</button><AllbeeAIFloatingAssistant greeting={false} /></>);
      protectedButton = screen.getByRole("button", {name:"Footer action"});
      const launcher = screen.getByTestId("allbee-mascot-launcher");
      vi.spyOn(button(), "getBoundingClientRect").mockImplementation(() => {
        const x=parseFloat(launcher.style.getPropertyValue("--mascot-x"))||0;
        const y=parseFloat(launcher.style.getPropertyValue("--mascot-y"))||0;
        return {left:926+x,right:1002+x,top:668+y,bottom:744+y,width:76,height:76};
      });
      tick(100);
      expect(launcher.classList.contains("is-covered")).toBe(true);
      tick(500);
      expect(launcher.classList.contains("is-covered")).toBe(false);
      expect(parseFloat(launcher.style.getPropertyValue("--mascot-x"))).toBeLessThan(-30);
    } finally { document.elementsFromPoint=original; }
  });

  it("rests above a full-width mobile prompt stack without covering its actions", () => {
    vi.useFakeTimers();
    const original=document.elementsFromPoint;
    let protectedButton;
    document.elementsFromPoint=(x,y)=>y>705?[protectedButton]:[];
    try {
      render(<><button>Client prompt</button><AllbeeAIFloatingAssistant surface="client" greeting={false}/></>);
      protectedButton=screen.getByRole("button",{name:"Client prompt"});
      const launcher=screen.getByTestId("allbee-mascot-launcher");
      vi.spyOn(button(),"getBoundingClientRect").mockImplementation(()=>{
        const x=parseFloat(launcher.style.getPropertyValue("--mascot-x"))||0;
        const y=parseFloat(launcher.style.getPropertyValue("--mascot-y"))||0;
        return {left:926+x,right:990+x,top:820+y,bottom:884+y,width:64,height:64};
      });
      tick(100);
      expect(launcher.classList.contains("is-covered")).toBe(true);
      tick(500);
      expect(launcher.classList.contains("is-covered")).toBe(false);
      expect(parseFloat(launcher.style.getPropertyValue("--mascot-y"))).toBe(-180);
    } finally {document.elementsFromPoint=original;}
  });

  it("has mobile safe-area placement, independent joint animations and a static fallback", () => {
    const css = readFileSync("src/ui/mascot.css", "utf8");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain(".allbee-mascot-rig { display:none; }");
    expect(css).toContain(".allbee-mascot-static { opacity:1; }");
    expect(css).toContain(".allbee-mascot-button:focus-visible");
    expect(css).toContain("allbee-step-left");
    expect(css).toContain("allbee-hand-wave");
    expect(css).toContain("allbee-eye-blink");
    expect(css).toContain("background:transparent");
    expect(css).toContain("object-fit:contain");
  });
});

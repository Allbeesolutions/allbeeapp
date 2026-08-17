import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RemoteLockGate } from "./AllbeeApp.jsx";

// The founder lockdown gate, in PAUSE_TEST mode: it must render the lockdown
// UI instantly with ZERO network calls, replace the wrapped app, drain local
// sessions (signOut), and reject/accept codes through the UI affordances.

// Hidden logo-tap sequence (taps 1-16 idle → 17/18/19: 3/2/1 → 20 armed →
// 21 opens the existing authorization screen). Taps are spaced past the
// one-physical-tap de-duplication guard (250ms) so each registers exactly once.
const tapLogo = async (n) => {
  const logo = screen.getByAltText("ALLBEE");
  for (let i = 0; i < n; i++) {
    fireEvent.click(logo);
    await new Promise((r) => setTimeout(r, 280));
  }
};
const countdownShown = () => document.querySelector(".founder-count .founder-chip") || null;

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("RemoteLockGate (pause mode)", () => {
  it("replaces the app with the lockdown screen and signs the session out", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(
      <RemoteLockGate isDark={false} signOut={signOut} pause>
        <div>WRAPPED APP CONTENT</div>
      </RemoteLockGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Founder-controlled maintenance in progress")).toBeTruthy();
    });
    expect(screen.queryByText("WRAPPED APP CONTENT")).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });

  it("disables authorize until a code is entered", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    const input = await screen.findByLabelText(/authorization code/i);
    const button = screen.getByRole("button", { name: /authorize/i });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "123456" } });
    expect(button.disabled).toBe(false);
  });

  it("reveals and hides the code with the eye toggle", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    const toggle = await screen.findByRole("button", { name: /show code/i });
    const input = screen.getByLabelText(/authorization code/i);
    fireEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: /hide code/i }));
    expect(input.getAttribute("type")).toBe("password");
  });
});

describe("RemoteLockGate — hidden logo-tap countdown", () => {
  it("1-16 taps: no countdown is visible and the logo stays a plain image", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    await tapLogo(16);
    const logo = screen.getByAltText("ALLBEE");
    expect(logo.tagName).toBe("IMG");
    expect(screen.queryByText("3")).toBeNull();
    expect(screen.queryByText("2")).toBeNull();
    expect(screen.queryByText("1")).toBeNull();
    expect(countdownShown()).toBeNull();
  }, 15000);

  it("17 → '3', 18 → '2', 19 → '1', every tap swaps the number in place", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    expect(countdownShown()).toBeNull();
    await tapLogo(16);
    expect(countdownShown()).toBeNull();
    for (const expected of ["3", "2", "1"]) {
      await tapLogo(1);
      const chip = countdownShown();
      expect(chip).not.toBeNull();
      expect(chip.textContent).toBe(expected);
    }
  }, 15000);

  it("20 → armed completion state, 21 → opens the existing authorization screen", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(<RemoteLockGate isDark={false} signOut={signOut} pause />);
    await tapLogo(20);
    const armed = countdownShown();
    expect(armed).not.toBeNull();
    expect(armed.dataset.countdown).toBe("armed");
    await tapLogo(1);
    expect(screen.queryByText(/authorization code/i)).toBeTruthy();
    expect(screen.getByText("Founder-controlled maintenance in progress")).toBeTruthy();
    expect(screen.getByText(/not authorized/i)).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  }, 15000);

  it("incomplete sequence resets after inactivity — countdown disappears", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    await tapLogo(17);
    expect(countdownShown()?.textContent).toBe("3");
    await new Promise((r) => setTimeout(r, 2800));
    expect(countdownShown()).toBeNull();
    await tapLogo(17);
    expect(countdownShown()?.textContent).toBe("3");
  }, 20000);

  it("rapid repeated events of one physical tap are not double-counted", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    const logo = screen.getByAltText("ALLBEE");
    for (let i = 0; i < 21; i++) fireEvent.click(logo);
    expect(countdownShown()).toBeNull(); // count stays at one tap — no chip
    await new Promise((r) => setTimeout(r, 30));
    expect(countdownShown()).toBeNull(); // still no sequence after the burst settles
    await new Promise((r) => setTimeout(r, 500));
    fireEvent.click(logo);
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.click(logo);
    await new Promise((r) => setTimeout(r, 300));
    expect(countdownShown()).toBeNull(); // a few stray taps after the burst stay below 17
  }, 15000);

  it("prefers-reduced-motion: numbers swap without the pop animation", async () => {
    const mq = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(window, "matchMedia", {
      writable: true, configurable: true, value: vi.fn().mockReturnValue(mq),
    });
    render(<RemoteLockGate isDark={false} pause />);
    await tapLogo(17);
    const chip = countdownShown();
    expect(chip).not.toBeNull();
    expect(chip.classList.contains("shift")).toBe(false);
    expect(chip.textContent).toBe("3");
  }, 15000);
});

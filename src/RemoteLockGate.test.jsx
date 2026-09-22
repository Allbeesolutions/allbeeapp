import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RemoteLockGate, FounderTap } from "./AllbeeApp.jsx";

// The founder lockdown gate, in PAUSE_TEST mode: it must render the lockdown
// UI instantly with ZERO network calls, replace the wrapped app, drain local
// sessions (signOut), and reject/accept codes through the UI affordances.

// Hidden logo-tap sequence (taps 1-16 idle → 17/18/19: 3/2/1 →
// 20 opens the existing authorization screen). Taps are spaced past the
// one-physical-tap de-duplication guard (250ms) so each registers exactly once.
const tapLogo = async (n) => {
  const logo = screen.getByAltText("ALLBEE");
  for (let i = 0; i < n; i++) {
    if (vi.isFakeTimers()) {
      await act(async () => { fireEvent.click(logo); vi.advanceTimersByTime(280); });
    } else {
      fireEvent.click(logo);
      await new Promise((r) => setTimeout(r, 280));
    }
  }
};
const countdownShown = () => document.querySelector(".founder-tap .founder-chip") || null;

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
      expect(screen.getByText("Founder recovery authorization required")).toBeTruthy();
    });
    expect(screen.queryByText("WRAPPED APP CONTENT")).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });

  it("disables authorize until a code is entered", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    const input = await screen.findByLabelText(/recovery code/i);
    const button = screen.getByRole("button", { name: /recover allbee/i });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "123456" } });
    expect(button.disabled).toBe(false);
  });

  it("reveals and hides the code with the eye toggle", async () => {
    render(<RemoteLockGate isDark={false} pause />);
    const toggle = await screen.findByRole("button", { name: /show code/i });
    const input = screen.getByLabelText(/recovery code/i);
    fireEvent.click(toggle);
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: /hide code/i }));
    expect(input.getAttribute("type")).toBe("password");
  });
});

describe("RemoteLockGate — recovery from the blank lockdown surface", () => {
  it("locks to a blank surface, then opens recovery after 20 taps and accepts the recovery action", async () => {
    vi.useRealTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locked: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, recovered: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(
      <RemoteLockGate isDark={false} signOut={signOut}>
        <div>WRAPPED APP CONTENT</div>
      </RemoteLockGate>
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Locked ALLBEE recovery surface")).toBeTruthy();
    });
    expect(screen.queryByText("WRAPPED APP CONTENT")).toBeNull();
    expect(screen.queryByText(/recovery code/i)).toBeNull();

    const surface = screen.getByLabelText("Locked ALLBEE recovery surface");
    for (let i = 0; i < 20; i++) {
      fireEvent.click(surface);
      await new Promise((resolve) => setTimeout(resolve, 280));
    }

    expect(screen.getByLabelText(/recovery code/i)).toBeTruthy();
    const input = screen.getByLabelText(/recovery code/i);
    fireEvent.change(input, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /recover allbee/i }));

    await waitFor(() => {
      expect(screen.getByText("WRAPPED APP CONTENT")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/functions/v1/founder-lockdown"),
      expect.objectContaining({
        body: JSON.stringify({ action: "recover", code: "654321" }),
      })
    );
  }, 20000);
});

describe("RemoteLockGate — hidden logo-tap countdown", () => {
  it("sequence works from a logo inside the wrapped app shell (real app entry, gate unlocked)", async () => {
    // The production failure: the handler was only on the gate card, never on
    // the shell logo the user actually sees. Here the gate is LIVE and reports
    // unlocked, so the real app shell (with its own logo) passes through — the
    // sequence must open the authorization screen from THAT logo.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ locked: false }),
    }));
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(
      <RemoteLockGate isDark={false} signOut={signOut}>
        <div className="brand" role="button" aria-label="Go to Home Dashboard">
          <FounderTap className="brand-logo" src="/allbee-icon.png" alt="ALLBEE" style={{ height: 34 }} />
          <div><h1>ALLBEE</h1><p>Solutions</p></div>
        </div>
      </RemoteLockGate>
    );
    // gate must pass the app shell through once the status poll reports unlocked
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /go to home dashboard/i })).toBeTruthy();
    });
    await tapLogo(17);
    expect(countdownShown()?.textContent).toBe("3");
    await tapLogo(1);
    expect(countdownShown()?.textContent).toBe("2");
    await tapLogo(1);
    expect(countdownShown()?.textContent).toBe("1");
    // 20th tap: the existing emergency authorization screen replaces the app shell
    await tapLogo(1);
    await waitFor(() => {
      expect(screen.getByText(/recovery code/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /go to home dashboard/i })).toBeNull();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  }, 20000);

  it("1-16 taps: no countdown is visible and the logo stays a plain image", async () => {
    vi.useFakeTimers();
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
    vi.useFakeTimers();
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

  it("20 taps opens the existing authorization screen", async () => {
    vi.useFakeTimers();
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(<RemoteLockGate isDark={false} signOut={signOut} pause />);
    await tapLogo(20);
    expect(countdownShown()).toBeNull();
    expect(screen.queryByText(/recovery code/i)).toBeTruthy();
    expect(screen.getByText("Founder recovery authorization required")).toBeTruthy();
    expect(screen.getByText(/recovery code/i)).toBeTruthy();
    await act(async () => {});
    expect(signOut).toHaveBeenCalled();
  }, 15000);

  it("incomplete sequence resets after inactivity — countdown disappears", async () => {
    vi.useFakeTimers();
    render(<RemoteLockGate isDark={false} pause />);
    await tapLogo(17);
    expect(countdownShown()?.textContent).toBe("3");
    await act(async () => { vi.advanceTimersByTime(2800); });
    expect(countdownShown()).toBeNull();
    await tapLogo(17);
    expect(countdownShown()?.textContent).toBe("3");
  }, 20000);

  it("rapid repeated events of one physical tap are not double-counted", async () => {
    vi.useFakeTimers();
    render(<RemoteLockGate isDark={false} pause />);
    const logo = screen.getByAltText("ALLBEE");
    for (let i = 0; i < 21; i++) fireEvent.click(logo);
    expect(countdownShown()).toBeNull(); // count stays at one tap — no chip
    await act(async () => { vi.advanceTimersByTime(30); });
    expect(countdownShown()).toBeNull(); // still no sequence after the burst settles
    await act(async () => { vi.advanceTimersByTime(500); fireEvent.click(logo); vi.advanceTimersByTime(300); fireEvent.click(logo); vi.advanceTimersByTime(300); });
    expect(countdownShown()).toBeNull(); // a few stray taps after the burst stay below 17
  }, 15000);

  it("prefers-reduced-motion: numbers swap without the pop animation", async () => {
    vi.useFakeTimers();
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

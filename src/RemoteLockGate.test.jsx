import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { RemoteLockGate } from "./AllbeeApp.jsx";

// The founder lockdown gate, in PAUSE_TEST mode: it must render the lockdown
// UI instantly with ZERO network calls, replace the wrapped app, drain local
// sessions (signOut), and reject/accept codes through the UI affordances.
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

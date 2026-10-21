import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { APNTabErrorBoundary } from "./APNTabErrorBoundary.jsx";

vi.mock("../../supabaseClient.js", () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null, error: null })) },
}));

const Broken = ({ failure }) => {
  if (failure) throw new Error("Secret email owner@example.com should not appear");
  return <p>Healthy APN tab</p>;
};

describe("APN tab crash recovery privacy", () => {
  it("hides raw exception content and permits a retry without logging out", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const screenView = render(<APNTabErrorBoundary><Broken failure /></APNTabErrorBoundary>);
      expect(screen.getByText("Something went wrong")).toBeTruthy();
      expect(screen.getByText("This section encountered an unexpected error. Try again or contact support.")).toBeTruthy();
      expect(document.body.textContent).not.toContain("owner@example.com");
      screenView.rerender(<APNTabErrorBoundary><Broken failure={false} /></APNTabErrorBoundary>);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(screen.getByText("Healthy APN tab")).toBeTruthy();
    } finally {
      log.mockRestore();
    }
  });
});

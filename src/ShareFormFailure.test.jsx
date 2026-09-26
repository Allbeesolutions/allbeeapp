import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShareForm from "./ShareForm.jsx";

const Icon = () => null;
const runtime = {
  uid: () => "new-entry", todayISO: () => "2026-09-26", money: (n) => String(n), round2: (n) => n,
  fmtPeriod: (p) => p, expenseSharePlan: () => ({ haji: 50, alim: 50, fallback: true }), emptyDB: () => ({}),
  apnRateForPrior: () => 0, apnPartnerStats: () => ({ completed: 0 }), apnFinancePostedFor: () => ({}), apnIdFor: () => "APN",
  INCOME_CATEGORIES: ["Project"], PRESETS: [[50, 50]], COMPANY_EXPENSE_CATEGORIES: ["Office Rent"], PROJECT_EXPENSE_CATEGORIES: ["Other"],
  Modal: ({ title, children, footer }) => <div role="dialog" aria-label={title}>{children}{footer}</div>,
  Field: ({ label, children }) => <label>{label}{children}</label>,
  SelectOther: ({ value, onChange }) => <input value={value} onChange={(e) => onChange(e.target.value)} />,
  SplitBar: Icon, SearchableSelect: Icon, Trash2: Icon, Plus: Icon, X: Icon, Link2: Icon, Check: Icon,
};

describe.each(["income", "expense"])("%s write feedback", (kind) => {
  it("keeps the form open after a failed save and permits an explicit retry", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ShareForm kind={kind} initial={{ amount: 100, date: "2026-09-26", scope: "project" }} db={{ transactions: [] }} onSave={onSave} onClose={onClose} runtime={runtime} />);
    fireEvent.click(screen.getByRole("button", { name: kind === "income" ? "Add income" : "Add expense" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Save failed"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: kind === "income" ? "Add income" : "Add expense" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[0][0].id).toBe(onSave.mock.calls[1][0].id);
  });

  it("shows a rejected write's message without closing", async () => {
    const onClose = vi.fn();
    render(<ShareForm kind={kind} initial={{ amount: 100, date: "2026-09-26", scope: "project" }} db={{ transactions: [] }} onSave={vi.fn().mockRejectedValue(new Error("Saving transactions: denied"))} onClose={onClose} runtime={runtime} />);
    fireEvent.click(screen.getByRole("button", { name: kind === "income" ? "Add income" : "Add expense" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Saving transactions: denied"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

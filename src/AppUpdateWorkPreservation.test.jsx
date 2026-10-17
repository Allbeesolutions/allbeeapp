import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { editingNow } from "./appUpdateGuard.js";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.activeElement?.blur?.();
});

describe("PWA update work-preservation", () => {
  it("defers updates while a form or editable field has focus", () => {
    const {getByLabelText}=render(<form><input aria-label="Invoice notes" /></form>);
    const notes=getByLabelText("Invoice notes");
    notes.focus();
    expect(editingNow()).toBe(true);
    notes.blur();
    expect(editingNow()).toBe(false);
  });
  it("defers updates when an AI conversation is open, even without input focus", () => {
    const {getByText}=render(<><div className="assistant-workspace"><div className="assistant-messages"><article>Draft quotation</article></div><textarea aria-label="AI chat" /></div><button>Other</button></>);
    getByText("Other").focus();
    expect(editingNow()).toBe(true);
  });
  it("protects an unsent AI draft without assistant messages", () => {
    const {getByLabelText,getByText}=render(<><div className="assistant-workspace"><textarea aria-label="AI draft" /></div><button>Other</button></>);
    fireEvent.change(getByLabelText("AI draft"),{target:{value:"My unsent message"}});
    getByText("Other").focus();
    expect(editingNow()).toBe(true);
    fireEvent.change(getByLabelText("AI draft"),{target:{value:""}});
    expect(editingNow()).toBe(false);
  });
});

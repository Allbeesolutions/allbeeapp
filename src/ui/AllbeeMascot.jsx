import React, { useEffect, useState } from "react";
import "./mascot.css";
import mascotAsset from "../assets/allbee-ai-mascot.png";

const INTRO_KEY = "allbee-mascot-intro-v2";
const STATES = new Set(["idle", "hello", "wave", "thinking", "listening", "working", "success", "notification", "attention"]);
const CONTEXT_HINTS = {
  login: "Need help signing in?",
  wallet: "Need a wallet summary?",
  network: "Growing your network?",
  leads: "Need help with a lead?",
  quotations: "Need help with a quotation?",
  chat: "Need anything?",
  support: "Need help?",
  assistant: "ALLBEE AI is ready",
};

/** Canonical ALLBEE character. The image is decorative; the parent control owns accessibility. */
export function AllbeeMascot({ state = "idle", size = 72, className = "" }) {
  const safeState = STATES.has(state) ? state : "idle";
  return <span className={`allbee-mascot allbee-mascot--${safeState} ${className}`.trim()} style={{ "--mascot-size": `${size}px` }} aria-hidden="true">
    <img src={mascotAsset} alt="" width="1054" height="990" draggable="false" />
  </span>;
}

function shortGreeting(name) {
  const first = String(name || "").trim().split(/\s+/)[0].slice(0, 24);
  return first ? `Hi, ${first}! 👋` : "Hi! Need help? 👋";
}

/** Reusable floating launcher for APN, internal workspace, client portal and login. */
export function AllbeeAIFloatingAssistant({
  onOpen,
  displayName,
  context = "home",
  hidden = false,
  surface = "apn",
  greeting = true,
}) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (hidden || !greeting) { setShowGreeting(false); return undefined; }
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return undefined;
      sessionStorage.setItem(INTRO_KEY, "shown");
    } catch { /* Session storage may be unavailable; timeout still dismisses it. */ }
    setShowGreeting(true);
    const timer = window.setTimeout(() => setShowGreeting(false), 5200);
    return () => window.clearTimeout(timer);
  }, [hidden, greeting]);

  useEffect(() => {
    const isEditing = () => {
      const el = document.activeElement;
      return !!el && el.matches("input, textarea, select, [contenteditable='true']");
    };
    const update = () => setKeyboardOpen(isEditing());
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);



  if (hidden || keyboardOpen) return null;
  const hint = CONTEXT_HINTS[context] || "Ask ALLBEE AI";
  return <div
    className={`allbee-mascot-launcher allbee-mascot-launcher--${surface}`}
    data-testid="allbee-mascot-launcher"
  >
    {showGreeting && <span className="allbee-mascot-greeting" role="status">{shortGreeting(displayName)}</span>}
    <button type="button" className="allbee-mascot-button" onClick={() => { setShowGreeting(false); onOpen?.(); }} aria-label="Ask ALLBEE AI with mascot" title={hint}>
      <AllbeeMascot state={showGreeting ? "wave" : "idle"} size={68} />
    </button>
  </div>;
}

export { shortGreeting };

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./mascot.css";
import mascotAsset from "../assets/allbee-ai-mascot.png";

const INTRO_KEY = "allbee-mascot-intro-v3";
const STATES = new Set(["idle", "hello", "wave", "thinking", "listening", "working", "success", "notification", "attention", "breathe", "happy"]);
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

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/** Canonical ALLBEE character. The image is decorative; the parent control owns accessibility. */
export function AllbeeMascot({ state = "idle", size = 72, className = "" }) {
  const safeState = STATES.has(state) ? state : "idle";
  return <span className={`allbee-mascot allbee-mascot--${safeState} ${className}`.trim()} style={{ "--mascot-size": `${size}px` }} aria-hidden="true">
    <img src={mascotAsset} alt="" width="1054" height="990" draggable="false" />
  </span>;
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0].slice(0, 24);
}

function shortGreeting(name, hello = false) {
  const first = firstName(name);
  if (hello) return first ? `Hello, ${first}! 👋` : "Hello! 👋";
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
  const [hoverGreeting, setHoverGreeting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [personalityState, setPersonalityState] = useState("idle");
  const personalityTimer = useRef(null);
  const greetingTimer = useRef(null);
  const alive = useRef(true);

  const clearPersonalityTimer = () => {
    if (personalityTimer.current) window.clearTimeout(personalityTimer.current);
    personalityTimer.current = null;
  };

  useEffect(() => {
    alive.current = true;
    if (prefersReducedMotion()) return () => { alive.current = false; };

    // Humanised loop: mostly calm, with brief natural gestures separated by long rests.
    const schedule = (delay = 3600) => {
      clearPersonalityTimer();
      personalityTimer.current = window.setTimeout(() => {
        if (!alive.current) return;
        const sequence = ["breathe", "idle", "happy", "idle", "wave", "idle"];
        const next = sequence[Math.floor(Math.random() * sequence.length)];
        setPersonalityState(next);
        const gestureDuration = next === "idle" ? 4200 + Math.random() * 3600 : 900 + Math.random() * 650;
        personalityTimer.current = window.setTimeout(() => {
          if (!alive.current) return;
          setPersonalityState("idle");
          schedule(4200 + Math.random() * 5200);
        }, gestureDuration);
      }, delay);
    };
    schedule(2600 + Math.random() * 2600);
    return () => {
      alive.current = false;
      clearPersonalityTimer();
    };
  }, []);

  useEffect(() => {
    if (hidden || !greeting) { setShowGreeting(false); return undefined; }
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return undefined;
      sessionStorage.setItem(INTRO_KEY, "shown");
    } catch { /* Session storage may be unavailable; timeout still dismisses it. */ }
    setShowGreeting(true);
    greetingTimer.current = window.setTimeout(() => setShowGreeting(false), 4400);
    return () => {
      if (greetingTimer.current) window.clearTimeout(greetingTimer.current);
    };
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

  const interactiveGreeting = hoverGreeting && !showGreeting;
  const mascotState = useMemo(() => {
    if (showGreeting || hoverGreeting) return "wave";
    return personalityState;
  }, [showGreeting, hoverGreeting, personalityState]);

  if (hidden || keyboardOpen) return null;
  const hint = CONTEXT_HINTS[context] || "Ask ALLBEE AI";
  const onEnter = () => {
    setHoverGreeting(true);
    setPersonalityState("wave");
  };
  const onLeave = () => {
    setHoverGreeting(false);
    setPersonalityState("idle");
  };

  return <div
    className={`allbee-mascot-launcher allbee-mascot-launcher--${surface}`}
    data-testid="allbee-mascot-launcher"
  >
    {(showGreeting || interactiveGreeting) && <span className="allbee-mascot-greeting" role="status">
      {shortGreeting(displayName, interactiveGreeting)}
    </span>}
    <button
      type="button"
      className="allbee-mascot-button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={() => { setShowGreeting(false); setHoverGreeting(false); setPersonalityState("happy"); onOpen?.(); }}
      aria-label="Ask ALLBEE AI with mascot"
      title={hint}
    >
      <AllbeeMascot state={mascotState} size={68} />
    </button>
  </div>;
}

export { shortGreeting };
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
  collisionRootSelector = null,
  greeting = true,
}) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [hoverGreeting, setHoverGreeting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const launcherRef = useRef(null);
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

  // Keep the launcher anchored, but yield its hit area to underlying actions.
  // A fixed nine-point hit test avoids scanning every control on long pages.
  useEffect(() => {
    if (hidden || keyboardOpen) return undefined;
    let frame = 0;
    const root = collisionRootSelector ? document.querySelector(collisionRootSelector) : document.body;
    const check = () => {
      frame = 0;
      const launcher = launcherRef.current;
      const button = launcher?.querySelector("button");
      if (!button || typeof document.elementsFromPoint !== "function") return;
      const r = button.getBoundingClientRect();
      let collision = false;
      for (const x of [r.left + 2, (r.left + r.right) / 2, r.right - 2]) {
        for (const y of [r.top + 2, (r.top + r.bottom) / 2, r.bottom - 2]) {
          collision ||= document.elementsFromPoint(x, y).some((el) => {
            const control = el.closest("button, a[href], input, select, textarea, [role='button']");
            return control && !launcher.contains(control) && (!root || root.contains(control));
          });
        }
      }
      setCovered(collision);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (root) {
      observer?.observe(root);
      for (const child of root.children) observer?.observe(child);
    }
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    const settle = window.setTimeout(schedule, 600);
    schedule();
    return () => {
      observer?.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("load", schedule, true);
      window.clearTimeout(settle);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [hidden, keyboardOpen, context, surface, collisionRootSelector]);

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
    ref={launcherRef}
    className={`allbee-mascot-launcher allbee-mascot-launcher--${surface}${covered ? " is-covered" : ""}`}
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
import React, { useEffect, useRef, useState } from "react";
import "./mascot.css";

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
    <img src="/allbee-ai-mascot-v3.png" alt="" width="862" height="852" draggable="false" />
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
  collisionRootSelector = null,
  greeting = true,
}) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const [lift, setLift] = useState(0);
  const launcherRef = useRef(null);

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

  useEffect(() => {
    if (hidden || keyboardOpen) return undefined;
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    const check = () => {
      frame = 0;
      const launcher = launcherRef.current;
      const button = launcher?.querySelector("button");
      if (!launcher || !button) return;
      const currentLift = Number(launcher.dataset.lift || 0);
      const raw = button.getBoundingClientRect();
      const base = { left: raw.left, right: raw.right, top: raw.top + currentLift, bottom: raw.bottom + currentLift, width: raw.width, height: raw.height };
      const root = collisionRootSelector ? document.querySelector(collisionRootSelector) : document.body;
      const controls = root ? [...root.querySelectorAll("button, a[href], input, select, textarea, [role='button']")].filter((el) => !launcher.contains(el)) : [];
      const collides = (candidate) => controls.some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > candidate.left - 7 && r.left < candidate.right + 7 && r.bottom > candidate.top - 7 && r.top < candidate.bottom + 7;
      });
      const steps = [0, 76, 152, 228];
      let safeLift = null;
      for (const amount of steps) {
        const candidate = { left: base.left, right: base.right, top: base.top - amount, bottom: base.bottom - amount };
        if (candidate.top < 8 || candidate.right > window.innerWidth + 1 || candidate.left < -1) continue;
        if (!collides(candidate)) { safeLift = amount; break; }
      }
      setCovered(safeLift == null);
      setLift(safeLift == null ? 0 : safeLift);
    };
    const observer = new MutationObserver(schedule);
    const root = collisionRootSelector ? document.querySelector(collisionRootSelector) : document.body;
    if (root) observer.observe(root, { childList: true, subtree: true });
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    const timer = window.setTimeout(schedule, 400);
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hidden, keyboardOpen, context, surface, collisionRootSelector]);

  if (hidden || keyboardOpen) return null;
  const hint = CONTEXT_HINTS[context] || "Ask ALLBEE AI";
  return <div
    ref={launcherRef}
    className={`allbee-mascot-launcher allbee-mascot-launcher--${surface}${covered ? " is-covered" : ""}`}
    data-testid="allbee-mascot-launcher"
    data-lift={lift}
    style={{ "--mascot-lift": `${lift}px` }}
  >
    {showGreeting && <span className="allbee-mascot-greeting" role="status">{shortGreeting(displayName)}</span>}
    <button type="button" className="allbee-mascot-button" onClick={() => { setShowGreeting(false); onOpen?.(); }} aria-label="Ask ALLBEE AI with mascot" title={hint}>
      <AllbeeMascot state={showGreeting ? "wave" : "idle"} size={68} />
    </button>
  </div>;
}

export { shortGreeting };

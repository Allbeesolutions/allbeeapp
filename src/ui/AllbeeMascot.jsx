import React, { useEffect, useRef, useState } from "react";
import "./mascot.css";

const INTRO_KEY = "allbee-mascot-intro-v1";
const STATES = new Set(["idle", "hello", "wave", "thinking", "listening", "working", "success", "notification", "attention"]);

/** The canonical ALLBEE character. Decorative in chat; the parent button owns its label. */
export function AllbeeMascot({ state = "idle", size = 72, className = "" }) {
  const safeState = STATES.has(state) ? state : "idle";
  return <span className={`allbee-mascot allbee-mascot--${safeState} ${className}`.trim()} style={{ "--mascot-size": `${size}px` }} aria-hidden="true">
    <img src="/allbee-ai-mascot.jpeg" alt="" width="1254" height="1254" draggable="false" />
  </span>;
}

function shortGreeting(name) {
  const first = String(name || "").trim().split(/\s+/)[0].slice(0, 24);
  return first ? `Hi, ${first}! 👋` : "Hi! Need help? 👋";
}

/** A single APN launcher. Routing stays in the APN shell, so permissions remain unchanged. */
export function AllbeeAIFloatingAssistant({ onOpen, displayName, context = "home", hidden = false }) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (hidden) { setShowGreeting(false); return undefined; }
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return undefined;
      sessionStorage.setItem(INTRO_KEY, "shown");
    } catch { /* Private storage can be unavailable; the timer still dismisses it. */ }
    setShowGreeting(true);
    const timer = window.setTimeout(() => setShowGreeting(false), 5200);
    return () => window.clearTimeout(timer);
  }, [hidden]);

  useEffect(() => {
    const isEditing = () => {
      const el = document.activeElement;
      return !!el && (el.matches("input, textarea, select, [contenteditable='true']") || el.closest("[role='dialog']"));
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
    const check = () => {
      frame = 0;
      const launcher = launcherRef.current;
      const area = document.querySelector(".apn-body");
      if (!launcher || !area) return;
      const box = launcher.querySelector("button")?.getBoundingClientRect();
      if (!box) return;
      // Leave room around touch controls; a floating assistant must never steal their tap area.
      const overlaps = [...area.querySelectorAll("button, a[href], input, select, textarea, [role='button']")].some(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > box.left - 7 && r.left < box.right + 7 && r.bottom > box.top - 7 && r.top < box.bottom + 7;
      });
      setCovered(overlaps);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    const observer = new MutationObserver(schedule);
    const area = document.querySelector(".apn-body");
    if (area) observer.observe(area, { childList:true, subtree:true });
    document.addEventListener("scroll", schedule, { capture:true, passive:true });
    window.addEventListener("resize", schedule);
    schedule();
    const timer = window.setTimeout(schedule, 400);
    return () => {
      observer.disconnect(); document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule); window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hidden, keyboardOpen, context]);

  if (hidden || keyboardOpen) return null;
  const hint = { wallet: "Need a wallet summary?", network: "Growing your network?", home: "Your ALLBEE assistant" }[context] || "Ask ALLBEE AI";
  return <div ref={launcherRef} className={"allbee-mascot-launcher" + (covered ? " is-covered" : "")} data-testid="allbee-mascot-launcher">
    {showGreeting && <span className="allbee-mascot-greeting" role="status">{shortGreeting(displayName)}</span>}
    <button type="button" className="allbee-mascot-button" onClick={() => { setShowGreeting(false); onOpen(); }} aria-label="Ask ALLBEE AI with mascot" title={hint}>
      <AllbeeMascot state={showGreeting ? "wave" : "idle"} size={68} />
    </button>
  </div>;
}

export { shortGreeting };

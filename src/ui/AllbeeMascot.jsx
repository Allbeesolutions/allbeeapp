import React, { useEffect, useId, useRef, useState } from "react";
import "./mascot.css";
import mascotAsset from "../assets/allbee-ai-mascot.png";
import AllbeeMascotRig from "./AllbeeMascotRig.jsx";

const INTRO_KEY = "allbee-mascot-intro-v3";
const PROMPT_KEY = "allbee-mascot-help-v1";
const STATES = new Set(["idle", "hello", "wave", "walking", "curious", "thinking", "listening", "working", "success", "notification", "attention", "breathe", "happy"]);
const CONTEXT_HINTS = {
  login: "Need help signing in?",
  wallet: "Need a wallet summary?",
  network: "Growing your network?",
  leads: "Need help with a lead?",
  quotations: "Need help with a quotation?",
  chat: "Need anything?",
  support: "Need help?",
  assistant: "Any doubts? I'm here.",
};

/** Canonical pixels, with a jointed rig and an exact static fallback. */
export function AllbeeMascot({ state = "idle", size = 72, className = "" }) {
  const safeState = STATES.has(state) ? state : "idle";
  return <span className={`allbee-mascot allbee-mascot--${safeState} ${className}`.trim()} style={{ "--mascot-size": `${size}px` }} aria-hidden="true" data-mascot-state={safeState}>
    <img className="allbee-mascot-static" src={mascotAsset} alt="" width="1054" height="990" draggable="false" />
    <AllbeeMascotRig artwork={mascotAsset} />
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

function promptMemory() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PROMPT_KEY) || "{}");
    return { count: Number(value.count) || 0, last: Number(value.last) || 0 };
  } catch { return { count: 0, last: 0 }; }
}

function useEnvironment() {
  const [reducedMotion, setReducedMotion] = useState(() => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const changeMotion = () => setReducedMotion(!!media?.matches);
    const changeVisibility = () => setPageVisible(!document.hidden);
    media?.addEventListener?.("change", changeMotion);
    document.addEventListener("visibilitychange", changeVisibility);
    return () => {
      media?.removeEventListener?.("change", changeMotion);
      document.removeEventListener("visibilitychange", changeVisibility);
    };
  }, []);
  return { reducedMotion, pageVisible };
}

// Hit-test controls rather than scanning every row in long dashboards.
// The launcher yields if page content changes under its current position.
function blockedRect(rect, launcher) {
  if (typeof document.elementsFromPoint !== "function") return false;
  for (const x of [rect.left + 2, (rect.left + rect.right) / 2, rect.right - 2]) {
    for (const y of [rect.top + 2, (rect.top + rect.bottom) / 2, rect.bottom - 2]) {
      if (document.elementsFromPoint(x, y).some((el) => {
        const control = el.closest("button, a[href], input, select, textarea, [role='button']");
        return control && !launcher.contains(control);
      })) return true;
    }
  }
  return false;
}

/** Same greeting, motion and AI routing across each authorised app shell. */
export function AllbeeAIFloatingAssistant({
  onOpen,
  displayName,
  context = "home",
  hidden = false,
  surface = "apn",
  collisionRootSelector = null,
  greeting = true,
}) {
  const [bubble, setBubble] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [covered, setCovered] = useState(false);
  const [walking, setWalking] = useState(false);
  const [direction, setDirection] = useState("left");
  const [personalityState, setPersonalityState] = useState("idle");
  const { reducedMotion, pageVisible } = useEnvironment();
  const bubbleId = useId();
  const launcherRef = useRef(null);
  const position = useRef({ x: 0, y: 0 });
  const anchorY = useRef(0);
  const relocationState = useRef(null);
  const movementFrame = useRef(0);
  const walkTimer = useRef(0);
  const checkCollision = useRef(() => false);
  const tapCount = useRef(0);
  const previousContext = useRef(context);
  const helpMemory = useRef(promptMemory());
  const interacting = hovered || focused || !!bubble;
  const unavailable = hidden || keyboardOpen || !pageVisible;
  relocationState.current = { unavailable, reducedMotion, engaged: hovered || focused || !!bubble?.manual || walking };
  const stopWalking = () => {
    window.cancelAnimationFrame(movementFrame.current);
    window.clearTimeout(walkTimer.current);
    movementFrame.current = 0;
    walkTimer.current = 0;
    setWalking(false);
  };
  const place = (x, y) => {
    position.current = { x, y };
    launcherRef.current?.style.setProperty("--mascot-x", `${x}px`);
    launcherRef.current?.style.setProperty("--mascot-y", `${y}px`);
  };

  useEffect(() => {
    const update = () => setKeyboardOpen(!!document.activeElement?.matches("input, textarea, select, [contenteditable='true']"));
    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  useEffect(() => {
    if (unavailable) {
      setBubble(null);
      setHovered(false);
      setFocused(false);
      return;
    }
    if (!greeting) return;
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return;
      sessionStorage.setItem(INTRO_KEY, "shown");
    } catch { /* A private session can still dismiss the timed greeting. */ }
    setBubble({ kind: "intro", hello: false });
  }, [unavailable, greeting]);

  // A new screen ends the previous greeting so a covered launcher can find
  // a clear resting spot immediately after navigation.
  useEffect(() => {
    if (previousContext.current === context) return;
    previousContext.current = context;
    setBubble(null);
    setHovered(false);
    setFocused(false);
  }, [context]);

  useEffect(() => {
    if (!bubble) return undefined;
    const timer = window.setTimeout(() => setBubble(null), bubble.manual ? 14000 : 5200);
    const focusFrame = bubble.keyboard ? window.requestAnimationFrame(() => launcherRef.current?.querySelector(".allbee-mascot-ask")?.focus()) : 0;
    return () => { window.clearTimeout(timer); window.cancelAnimationFrame(focusFrame); };
  }, [bubble]);

  // At most three quiet help nudges per session, with 65–110 seconds between them.
  // Nothing is spoken aloud or sent to the AI until the user chooses Ask AI.
  useEffect(() => {
    const stored = promptMemory();
    const memory = { count: Math.max(stored.count, helpMemory.current.count), last: Math.max(stored.last, helpMemory.current.last) };
    if (unavailable || covered || interacting || !greeting || memory.count >= 3) return undefined;
    const delay = Math.max(65000 + Math.random() * 45000, memory.last + 65000 - Date.now());
    const timer = window.setTimeout(() => {
      const storedNow = promptMemory();
      const current = { count: Math.max(storedNow.count, helpMemory.current.count), last: Math.max(storedNow.last, helpMemory.current.last) };
      if (current.count >= 3) return;
      const name = firstName(displayName);
      const hints = [
        name ? `Any doubts, ${name}?` : "Any doubts? I'm here.",
        CONTEXT_HINTS[context] || "Need a hand here?",
        "Got a question? Ask me.",
      ];
      setBubble({ kind: "help", text: hints[Math.floor(Math.random() * hints.length)] });
      helpMemory.current = { count: current.count + 1, last: Date.now() };
      try { sessionStorage.setItem(PROMPT_KEY, JSON.stringify(helpMemory.current)); } catch { /* The in-memory cap still applies. */ }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [unavailable, covered, interacting, greeting, context, displayName]);

  useEffect(() => {
    if (unavailable || covered || interacting || walking || reducedMotion) {
      setPersonalityState("idle");
      return undefined;
    }
    let timer;
    const rest = () => {
      timer = window.setTimeout(() => {
        const states = ["breathe", "curious", "happy", "idle"];
        setPersonalityState(states[Math.floor(Math.random() * states.length)]);
        timer = window.setTimeout(() => { setPersonalityState("idle"); rest(); }, 2100);
      }, 8000 + Math.random() * 12000);
    };
    rest();
    return () => window.clearTimeout(timer);
  }, [unavailable, covered, interacting, walking, reducedMotion]);

  useEffect(() => {
    if (hidden || keyboardOpen) return undefined;
    let frame = 0, relocationTimer = 0;
    const root = collisionRootSelector ? document.querySelector(collisionRootSelector) : document.body;
    const check = () => {
      frame = 0;
      const launcher = launcherRef.current;
      const button = launcher?.querySelector(".allbee-mascot-button");
      if (!button) return false;
      const limit = Math.min(innerWidth < 773 ? 104 : 210, Math.max(0, innerWidth - 114));
      if (position.current.x < -limit) place(-limit, position.current.y);
      const entering = root?.querySelector(".page-enter")?.getAnimations?.().some(animation =>
        animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity);
      const collision = !!entering || blockedRect(button.getBoundingClientRect(), launcher);
      // Yield the hit area immediately; React keeps the visual state in sync.
      launcher.classList.toggle("is-covered", collision);
      setCovered(collision);
      if (!collision) { window.clearTimeout(relocationTimer); relocationTimer = 0; }
      else if (!relocationTimer) {
        // Reposition only while already hidden, never under an active pointer.
        // A bounded search also handles full-width mobile footer actions.
        relocationTimer = window.setTimeout(() => {
          relocationTimer = 0;
          const state = relocationState.current;
          const current = launcherRef.current;
          const currentButton = current?.querySelector(".allbee-mascot-button");
          if (!currentButton || state.unavailable || state.reducedMotion || state.engaged) return;
          const r = currentButton.getBoundingClientRect();
          const start = position.current;
          for (const y of [0, -28, -64, -100, -140, -180]) for (const x of [start.x, -limit / 3, -limit * 2 / 3, -limit, 0]) {
            const dx = x - start.x, dy = y - start.y;
            const candidate = { left:r.left+dx, right:r.right+dx, top:r.top+dy, bottom:r.bottom+dy };
            if (candidate.left < 8 || candidate.right > innerWidth-8 || candidate.top < 16) continue;
            if (!blockedRect(candidate, current)) {
              anchorY.current = y;
              place(x, y);
              setCovered(false);
              return;
            }
          }
        }, 400);
      }
      return collision;
    };
    checkCollision.current = check;
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (root) {
      observer?.observe(root);
      for (const child of root.children) observer?.observe(child);
    }
    // Async forms can change the controls under a fixed viewport without resizing it.
    const mutations = typeof MutationObserver === "function" ? new MutationObserver((records) => {
      if (records.some(record => !launcherRef.current?.contains(record.target))) schedule();
    }) : null;
    if (root) mutations?.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:["class", "hidden", "style"] });
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    document.addEventListener("animationend", schedule, true);
    document.addEventListener("transitionend", schedule, true);
    const settle = window.setTimeout(schedule, 600);
    place(position.current.x, position.current.y);
    schedule();
    return () => {
      checkCollision.current = () => false;
      observer?.disconnect();
      mutations?.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("load", schedule, true);
      document.removeEventListener("animationend", schedule, true);
      document.removeEventListener("transitionend", schedule, true);
      window.clearTimeout(settle);
      window.clearTimeout(relocationTimer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [hidden, keyboardOpen, context, surface, collisionRootSelector, reducedMotion, interacting]);

  // Short strolls at 12 CSS pixels/second; rest between walks. Check the entire
  // swept corridor first, then recheck live content during motion.
  useEffect(() => {
    if (unavailable || covered || interacting || reducedMotion) {
      stopWalking();
      return undefined;
    }
    let disposed = false;
    const schedule = () => {
      walkTimer.current = window.setTimeout(begin, 7000 + Math.random() * 9000);
    };
    const begin = () => {
      const launcher = launcherRef.current;
      const button = launcher?.querySelector(".allbee-mascot-button");
      if (disposed || !button) return;
      const start = { ...position.current };
      const limit = Math.min(innerWidth < 773 ? 104 : 210, Math.max(0, innerWidth - 114));
      let x = -Math.round(limit * (.3 + Math.random() * .7));
      if (Math.abs(x - start.x) < 28) x = start.x < -limit / 2 ? 0 : -limit;
      const end = { x, y: anchorY.current - Math.round(Math.random() * 12) };
      const dx = end.x - start.x, dy = end.y - start.y;
      const rect = button.getBoundingClientRect();
      const samples = Math.max(1, Math.ceil(Math.abs(dx) / 18));
      for (let i = 0; i <= samples; i++) {
        const f = i / samples;
        if (blockedRect({ left: rect.left + dx * f, right: rect.right + dx * f, top: rect.top + dy * f, bottom: rect.bottom + dy * f }, launcher)) { schedule(); return; }
      }
      const duration = Math.max(3200, Math.hypot(dx, dy) / 12 * 1000);
      let started = null, lastCheck = 0;
      setDirection(dx < 0 ? "left" : "right");
      setWalking(true);
      const step = (now) => {
        if (disposed) return;
        if (started === null) started = now;
        const progress = Math.min(1, (now - started) / duration);
        place(start.x + dx * progress, start.y + dy * progress);
        if (now - lastCheck > 100) {
          lastCheck = now;
          if (checkCollision.current()) { stopWalking(); return; }
        }
        if (progress < 1) movementFrame.current = window.requestAnimationFrame(step);
        else { movementFrame.current = 0; setWalking(false); schedule(); }
      };
      movementFrame.current = window.requestAnimationFrame(step);
    };
    schedule();
    return () => { disposed = true; stopWalking(); };
  }, [unavailable, covered, interacting, reducedMotion, context]);

  if (hidden || keyboardOpen) return null;
  const visibleBubble = bubble || ((hovered || focused) ? { kind: "hello", hello: true } : null);
  const mascotState = visibleBubble ? (visibleBubble.kind === "help" ? "attention" : "wave") : walking ? "walking" : personalityState;
  const onEnter = (event) => { if (event.pointerType !== "touch") { stopWalking(); setHovered(true); } };
  const onLeave = () => setHovered(false);
  const openAI = () => {
    stopWalking();
    setBubble(null);
    setHovered(false);
    setFocused(false);
    setPersonalityState("happy");
    onOpen?.();
  };
  const sayHello = (event) => {
    stopWalking();
    if (bubble?.manual) { openAI(); return; }
    tapCount.current++;
    setBubble({ kind: "hello", hello: tapCount.current % 2 === 0, manual: true, keyboard: event.detail === 0 });
  };

  return <div
    ref={launcherRef}
    className={`allbee-mascot-launcher allbee-mascot-launcher--${surface}${covered ? " is-covered" : ""}`}
    data-testid="allbee-mascot-launcher"
    data-roaming={walking ? "walking" : "resting"}
    data-direction={direction}
    onPointerEnter={onEnter}
    onPointerLeave={onLeave}
    onFocus={(event) => { if (event.target.matches(":focus-visible")) { stopWalking(); setFocused(true); } }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
  >
    {visibleBubble && <div className={`allbee-mascot-greeting${bubble?.manual ? " is-interactive" : ""}`} id={bubbleId}>
      <span role="status" aria-live="polite">{visibleBubble.kind === "help" ? visibleBubble.text : shortGreeting(displayName, visibleBubble.hello)}</span>
      {bubble?.manual && <>
        <span className="allbee-mascot-greeting-hint">Any doubts? I'm here to help.</span>
        <button type="button" className="allbee-mascot-ask" onClick={openAI} aria-label="Open ALLBEE AI">Ask AI <span aria-hidden="true">↗</span></button>
        <button type="button" className="allbee-mascot-dismiss" aria-label="Dismiss ALLBEE AI greeting" onClick={() => { setBubble(null); setHovered(false); setFocused(false); }}>×</button>
      </>}
    </div>}
    <button
      type="button"
      className="allbee-mascot-button"
      onPointerDown={stopWalking}
      onClick={sayHello}
      aria-label="Ask ALLBEE AI with mascot"
      aria-expanded={!!bubble?.manual}
      aria-controls={bubble?.manual ? bubbleId : undefined}
      title={CONTEXT_HINTS[context] || "Say hello to ALLBEE AI"}
    >
      <AllbeeMascot state={mascotState} size={74} />
    </button>
  </div>;
}

export { shortGreeting };

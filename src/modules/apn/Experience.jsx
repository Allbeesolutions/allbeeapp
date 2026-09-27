import React, { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import "../../ui/apn-experience.css";

export const APN_PAGES = {
  home: ["Your partner workspace", "Your progress, earnings and next opportunity — in one place."],
  leads: ["Build your pipeline", "Follow every opportunity from first introduction to conversion."],
  wallet: ["Your earnings, clearly", "Review commission records, eligibility and payments."],
  network: ["Grow together", "Manage referrals, connections and your partner network."],
  chat: ["Team Chat", "Stay connected with your AllBee network."],
  targets: ["Make progress", "Know your priorities and track the next milestone."],
  quotations: ["Make a great proposal", "Prepare clear quotations and follow their approval status."],
  documents: ["Your sales toolkit", "Find the materials you need for your next client conversation."],
  agreements: ["Your agreements", "Read the terms and review your acceptance history."],
  notifications: ["Stay in the loop", "Updates from your team, all in one place."],
  learn: ["Build your expertise", "Learn the services, complete quizzes and unlock opportunities."],
  withdrawals: ["Plan your payout", "Check available balances and track each withdrawal."],
  ai: ["ALLBEE AI", "Practical guidance, grounded in your APN records."],
  support: ["Help, with a human touch", "Track your questions and official team responses."],
  achievements: ["Celebrate your progress", "Every milestone is a step forward in your partner journey."],
  leaderboard: ["See where you stand", "Explore performance across your company and district."],
  district: ["Lead your network", "A focused workspace for your assigned partners."],
  profile: ["Make it yours", "Keep your identity, contact and payout details up to date."],
};

export function APNPageIntro({ tab, onAction }) {
  if (["chat", "ai"].includes(tab)) return null;
  const [title, description] = APN_PAGES[tab] || APN_PAGES.home;
  const action = { home: ["Submit a lead", "lead"], leads: ["Submit a lead", "lead"], quotations: ["New quotation", "quote"], support: ["Ask ALLBEE AI", "ai"] }[tab];
  return <div className="apn-page-intro">
    <div><div className="apn-eyebrow">ALLBEE PARTNER NETWORK</div><h2>{title}</h2><p>{description}</p></div>
    {action && <button className="btn primary" onClick={() => onAction(action[1])}>{action[0]}<ArrowUpRight size={16} aria-hidden="true" /></button>}
  </div>;
}

export function APNSkeleton({ label = "Loading your workspace…" }) {
  return <div className="apn-skeleton" role="status" aria-busy="true" aria-label={label}>
    <span className="apn-loader-mark" aria-hidden="true"><i /><i /><i /></span>
    <span className="apn-loading-label">{label}</span>
  </div>;
}

// The desktop sidebar remains persistent. Only the mobile drawer traps focus.
export function useAPNDrawer(open, close, sidebarRef, triggerRef) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 900px)").matches) return;
    const sidebar = sidebarRef.current;
    const main = document.querySelector(".apn-main");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    const focusable = () => [...(sidebar?.querySelectorAll('button:not(:disabled), [href], [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = e => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 900) closeRef.current(); };
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      main?.removeAttribute("inert");
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", resize);
      triggerRef.current?.focus();
    };
  }, [open, sidebarRef, triggerRef]);
}

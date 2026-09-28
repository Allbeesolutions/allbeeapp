import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function ExpandableChatButton({ expanded, onToggle, className = "", title }) {
  const label = expanded ? "Minimise chat" : "Maximise chat";
  return (
    <button
      type="button"
      className={`iconbtn chat-expand-toggle ${className}`.trim()}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={expanded}
      title={title || label}
    >
      {expanded ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
    </button>
  );
}

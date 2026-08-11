"use client";

import { useEffect, useState } from "react";

/**
 * Branded "draw & lock" loader: a single stroke draws itself into the
 * closed ring, the center seals solid once it closes, then resets.
 * Deliberate and continuous — not a spinner that never stops.
 *
 * This is the ONLY loading indicator in the app — every spot that shows a
 * "please wait" state (page loads, buttons, inline waits) renders this,
 * never a generic CSS spin div.
 * - `tone="brand"` is the fixed graphite/cream/cyan mark for use on its own
 *   (full-screen, empty states).
 * - `tone="inline"` swaps the stroke for currentColor and the lock dot for
 *   the theme accent, for a neutral surface (a card, a dashed drop-zone).
 * - `tone="mono"` uses currentColor for everything, for placement on an
 *   already-colored surface (e.g. inside an accent-filled button).
 */
export function LoaderRing({
  size = 44,
  tone = "brand",
}: {
  size?: number;
  tone?: "brand" | "inline" | "mono";
}) {
  const trackColor = tone === "brand" ? "#33373f" : tone === "mono" ? "currentColor" : "var(--line)";
  const trackOpacity = tone === "mono" ? 0.3 : 1;
  const drawColor = tone === "brand" ? "#f4f2ee" : "currentColor";
  const dotColor = tone === "brand" ? "#3ddbd0" : tone === "mono" ? "currentColor" : "var(--accent)";
  const strokeWidth = tone === "brand" ? 6 : 10;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="40" fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity={trackOpacity} />
      <circle
        cx="60"
        cy="60"
        r="40"
        fill="none"
        stroke={drawColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="251"
        strokeDashoffset="251"
        transform="rotate(-90 60 60)"
        className="loader-ring-draw"
      />
      <circle cx="60" cy="60" r="11" fill={dotColor} className="loader-ring-dot" />
    </svg>
  );
}

const DEFAULT_MESSAGES = ["Searching…", "Loading…", "Almost there…"];

export function Preloader({
  messages = DEFAULT_MESSAGES,
  fullscreen = true,
}: {
  messages?: string[];
  fullscreen?: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => setIdx((i) => (i + 1) % messages.length), 900);
    return () => clearInterval(interval);
  }, [messages.length]);

  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-[#1b1e24] rounded-xl p-3">
        <LoaderRing size={48} />
      </div>
      {messages.length > 0 && <p className="preloader-text">{messages[idx]}</p>}
    </div>
  );

  if (!fullscreen) return content;

  return <div className="preloader-overlay">{content}</div>;
}

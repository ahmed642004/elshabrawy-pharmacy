"use client";

import { useState } from "react";

// Templates remount on every navigation, giving each shop page a subtle
// fade-up entrance. Header/Footer live in layout.tsx above this, so they
// (and their state) are unaffected.
//
// The animation style is cleared on completion rather than left with
// `animation-fill-mode: both` applied indefinitely: a lingering non-`none`
// `transform` (even the identity translateY(0) the "to" keyframe ends on)
// establishes a new CSS containing block, which silently breaks
// `position: fixed` for every descendant — e.g. the mobile category filter
// bottom sheet rendered several levels down in page content would size
// itself to this wrapper's document-flow box instead of the viewport.
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  const [animating, setAnimating] = useState(true);
  return (
    <div
      className="flex flex-1 flex-col"
      style={animating ? { animation: "heroFadeUp 250ms ease-out both" } : undefined}
      onAnimationEnd={() => setAnimating(false)}
    >
      {children}
    </div>
  );
}

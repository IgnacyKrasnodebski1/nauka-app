import { LOGO } from "@nauka/shared";
import { useId } from "react";

/** Recall mark from shared logo.ts (same geometry as the app icons). `word` adds the wordmark. */
export function Logo({ size = 28, word = true, className }: { size?: number; word?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.32), lineHeight: 1 }}>
      <svg width={size} height={size} viewBox={LOGO.viewBox} aria-hidden="true" style={{ display: "block", borderRadius: size * 0.25, boxShadow: `0 ${Math.max(2, Math.round(size * 0.09))}px 0 #3B2E8A` }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={LOGO.gradient[0]} />
            <stop offset="1" stopColor={LOGO.gradient[1]} />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx={LOGO.tileRadius} fill={`url(#${id})`} />
        <path d={LOGO.r} fill="#fff" />
        <path d={LOGO.spark} fill="#FFE27A" />
      </svg>
      {word && <span className="display" style={{ fontWeight: 800, fontSize: size * 0.72, letterSpacing: "-0.03em", color: "var(--text)" }}>Recall</span>}
    </span>
  );
}

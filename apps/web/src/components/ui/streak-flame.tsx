"use client";
import { m, useReducedMotion } from "@/lib/motion";

/**
 * Animated flame. Intensity grows with the streak: 0 = grey ember, 1–6 = orange, 7–29 = orange with yellow core and
 * a flicker, 30+ = bigger torch with a second tongue.
 */
export function StreakFlame({ streak, size = 22, className }: { streak: number; size?: number; className?: string }) {
  const reduced = useReducedMotion();
  const off = streak <= 0;
  const tier = streak >= 30 ? 3 : streak >= 7 ? 2 : streak >= 1 ? 1 : 0;
  const outer = off ? "var(--faint)" : "var(--play-orange)";
  const inner = off ? "var(--bg4)" : tier >= 2 ? "var(--play-yellow)" : "#FFB84D";
  const dur = tier >= 3 ? 0.7 : 1.1;
  return (
    <m.svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", transformOrigin: "50% 100%" }}
      animate={!off && !reduced ? { scaleY: [1, 1.08, 0.96, 1.04, 1], scaleX: [1, 0.96, 1.03, 0.98, 1] } : undefined}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-1.5.5-2.8 1.3-3.8.3 1.1 1 2 1.9 2.4C10 8.5 10.8 4.6 12 2z" fill={outer} />
      <m.path
        d="M12 11c.6 2 2.5 2.8 2.5 5.2a2.5 2.5 0 0 1-5 0c0-1 .4-1.8 1-2.4.2.6.6 1 1 1.2-.3-1.5.1-2.8.5-4z"
        fill={inner}
        style={{ transformOrigin: "50% 100%" }}
        animate={!off && !reduced ? { scaleY: [1, 1.2, 0.9, 1.1, 1], opacity: [1, 0.85, 1] } : undefined}
        transition={{ duration: dur * 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {tier >= 3 && <path d="M17.5 6c.3 1.5 1.8 2 1.8 4a1.8 1.8 0 0 1-3.6 0c0-.6.2-1.1.5-1.5.1.4.4.8.8.9-.1-1.2.2-2.4.5-3.4z" fill={outer} />}
    </m.svg>
  );
}

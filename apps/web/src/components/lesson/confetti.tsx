"use client";
import { useMemo, type CSSProperties } from "react";

/** Deterministic pseudo-random in [0,1) — keeps render pure while still looking scattered. */
const pr = (i: number, k: number) => {
  const x = Math.sin(i * 9301 + k * 49297 + 7) * 233280;
  return x - Math.floor(x);
};

/** Restrained confetti burst: max 40 particles in the subject hue + gold, 1.2 s, radiating from the centre. */
export function Confetti({ n = 40 }: { n?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: Math.min(40, n) }, (_, i) => {
        const angle = pr(i, 1) * Math.PI * 2;
        const dist = 120 + pr(i, 2) * 220;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist + 160, color: i % 3 === 0 ? "var(--accent)" : "var(--hue)", delay: pr(i, 3) * 0.15, scale: 0.7 + pr(i, 4) * 0.6 };
      }),
    [n],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, background: b.color, animationDelay: `${b.delay}s`, transform: `scale(${b.scale})` } as CSSProperties} />
      ))}
    </div>
  );
}

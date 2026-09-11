"use client";
import { useMemo } from "react";

const COLORS = ["#ff2d95", "#a855f7", "#22d3ee", "#aaff00", "#ff7a00", "#1ed760"];

/** Deterministic pseudo-random in [0,1) — keeps render pure while still looking scattered. */
const pr = (i: number, k: number) => {
  const x = Math.sin(i * 9301 + k * 49297 + 7) * 233280;
  return x - Math.floor(x);
};

/** Lightweight CSS confetti burst (no deps). */
export function Confetti({ n = 60 }: { n?: number }) {
  const bits = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ left: pr(i, 1) * 100, delay: pr(i, 2) * 0.8, color: COLORS[i % COLORS.length]!, dur: 1.8 + pr(i, 3) * 1.2, rot: pr(i, 4) * 360 })),
    [n],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

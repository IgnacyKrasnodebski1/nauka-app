"use client";
import { useEffect, useState } from "react";

/** Animated XP number (ease-out cubic, ~900ms). With prefers-reduced-motion the value lands on the first frame. */
export function XpCounter({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 0 : 900;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = dur ? Math.min(1, (t - t0) / dur) : 1;
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="xpbig" aria-label={`${value} XP`}>
      +{n}<small>XP</small>
    </div>
  );
}

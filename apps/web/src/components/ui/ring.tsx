"use client";
import type { ReactNode } from "react";
import { m } from "@/lib/motion";

/** SVG progress ring. `pct` 0..100. Children render in the centre. */
export function Ring({ pct, size = 64, stroke = 8, color = "var(--play-green)", track = "var(--bg3)", children, animate = true, className }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; animate?: boolean; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const off = c * (1 - p / 100);
  return (
    <div className={className} style={{ position: "relative", width: size, height: size, flex: "none" }} role="img" aria-label={`${Math.round(p)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {animate ? (
          <m.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ type: "spring", stiffness: 60, damping: 18 }} />
        ) : (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

/** Daily goal ring: orange while in progress, green when done; centre shows XP / goal. */
export function DailyGoalRing({ xp, goal, size = 96 }: { xp: number; goal: number; size?: number }) {
  const pct = Math.min(100, Math.round((xp / goal) * 100));
  const done = xp >= goal;
  return (
    <Ring pct={pct} size={size} stroke={Math.round(size / 9)} color={done ? "var(--play-green)" : "var(--play-orange)"}>
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div className="display" style={{ fontSize: size * 0.26, fontWeight: 800, color: done ? "var(--play-green)" : "var(--text)" }}>{xp}</div>
        <div style={{ fontSize: size * 0.11, fontWeight: 800, color: "var(--muted)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>/ {goal} XP</div>
      </div>
    </Ring>
  );
}

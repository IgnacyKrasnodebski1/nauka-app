"use client";
import { m } from "@/lib/motion";

/** Treasure chest icon: grey closed / gold shaking (openable, handled by .node3d.chest.openable) / open (opened). */
export function Chest({ state, size = 40 }: { state: "closed" | "openable" | "opened"; size?: number }) {
  const gold = state !== "closed";
  const body = gold ? "#FFC800" : "#3A3F4E";
  const deep = gold ? "#CC9F00" : "#262A36";
  const band = gold ? "#8A5A00" : "#171A22";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      {state === "opened" ? (
        <>
          <rect x="6" y="22" width="36" height="20" rx="4" fill={deep} />
          <rect x="6" y="22" width="36" height="14" rx="4" fill={body} />
          <m.path d="M8 22 L40 22 L36 8 L12 8 Z" fill={deep} initial={{ rotate: 0 }} animate={{ rotate: -35 }} style={{ transformOrigin: "8px 22px" }} transition={{ type: "spring", stiffness: 200, damping: 14 }} />
          <circle cx="24" cy="26" r="3" fill={band} />
          {[0, 1, 2].map((k) => (
            <m.circle key={k} cx={16 + k * 8} cy="20" r="3" fill="#5EC8FF" initial={{ y: 0, opacity: 0 }} animate={{ y: [0, -14, -6], opacity: [0, 1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: k * 0.3 }} />
          ))}
        </>
      ) : (
        <>
          <rect x="6" y="20" width="36" height="22" rx="4" fill={deep} />
          <rect x="6" y="20" width="36" height="16" rx="4" fill={body} />
          <path d="M6 20 C6 10 42 10 42 20 Z" fill={body} />
          <path d="M6 20 C6 10 42 10 42 20 L42 22 L6 22 Z" fill={deep} opacity="0.5" />
          <rect x="21" y="16" width="6" height="12" rx="2" fill={band} />
          <circle cx="24" cy="22" r="2" fill={gold ? "#FFF3B0" : "#5C6176"} />
          {state === "openable" && <m.circle cx="38" cy="12" r="2.5" fill="#fff" animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }} transition={{ duration: 1.2, repeat: Infinity }} />}
        </>
      )}
    </svg>
  );
}

/** Gold trophy for the end of the path. */
export function Trophy({ state, size = 44 }: { state: "locked" | "claimable" | "claimed"; size?: number }) {
  const gold = state !== "locked";
  const cup = gold ? "#FFC800" : "#3A3F4E";
  const deep = gold ? "#CC9F00" : "#262A36";
  return (
    <m.svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", overflow: "visible" }} animate={state === "claimable" ? { rotate: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.6 }}>
      <path d="M14 6h20v6a10 10 0 0 1-20 0z" fill={cup} />
      <path d="M14 8H6a6 6 0 0 0 6 8h2zm20 0h8a6 6 0 0 1-6 8h-2z" fill={deep} />
      <path d="M20 22h8v6h-8z" fill={deep} />
      <rect x="14" y="28" width="20" height="4" rx="1" fill={cup} />
      <rect x="12" y="32" width="24" height="8" rx="2" fill={deep} />
      {gold && <ellipse cx="20" cy="11" rx="2" ry="4" fill="#fff" opacity="0.55" />}
      {state === "claimed" && <path d="m18 34 4 4 8-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </m.svg>
  );
}

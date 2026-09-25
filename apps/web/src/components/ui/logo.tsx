import { LOGO } from "@nauka/shared";

/** Recall mark (shared logo geometry, flat 2.0 tokens) + optional wordmark "Recall." with the acid dot. */
export function Logo({ size = 28, word = true, className }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.32), lineHeight: 1 }}>
      <svg width={size} height={size} viewBox={LOGO.viewBox} aria-hidden="true" style={{ display: "block", borderRadius: size * 0.25, boxShadow: `0 ${Math.max(2, Math.round(size * 0.09))}px 0 var(--acid-dark)` }}>
        <rect width="64" height="64" rx={LOGO.tileRadius} fill="var(--acid)" />
        <path d={LOGO.r} fill="var(--on-acid)" />
        <path d={LOGO.spark} fill="var(--gold)" />
      </svg>
      {word && <span className="logo brand" style={{ fontSize: size * 0.72 }}>Recall<span className="g">.</span></span>}
    </span>
  );
}

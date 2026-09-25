import type { CSSProperties } from "react";
import { accentVars, hueFromColor } from "@nauka/shared";
import { initial } from "@/lib/dates";

/** Subject theme container style (`--accent`, `--accent-dark`, `--on-accent`, `--accent-soft`) — design/DESIGN.md §1. */
export function themeStyle(color: string | null | undefined): CSSProperties {
  const h = hueFromColor(color || "#B4FF3A");
  const out: Record<string, string> = {};
  for (const part of accentVars(h.color).split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out as CSSProperties;
}

/** Monogram tile instead of a data emoji (legacy mono()). */
export function Mono({ text, cls, className }: { text: string; cls?: string; className?: string }) {
  return (
    <div className={`mono${cls ? " " + cls : ""}${className ? " " + className : ""}`} aria-hidden="true">
      {initial(text)}
    </div>
  );
}

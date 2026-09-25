import React, { createContext, useContext, useMemo } from "react";
import { TONES, accentOf, type Accent } from "@/lib/theme";

const Ctx = createContext<Accent>(TONES.acid);

/**
 * Motyw przedmiotu dla poddrzewa — odpowiednik `accentVars()` (`--accent`, `--accent-dark`, `--on-accent` na kontenerze).
 * `color` = `subjects.accent2` (jeden z SUBJECT_HUES); bez koloru = limonka.
 */
export function AccentProvider({ color, seed, children }: { color?: string | null; seed?: string; children: React.ReactNode }) {
  const value = useMemo(() => accentOf(color, seed), [color, seed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccent(): Accent {
  return useContext(Ctx);
}

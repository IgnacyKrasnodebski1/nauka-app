export const RANKS = [
  { name: "Nowicjusz", min: 0, color: "#9BA3B5" },
  { name: "Uczeń", min: 250, color: "#58CC02" },
  { name: "Ogarniacz", min: 750, color: "#1CB0F6" },
  { name: "Mózg", min: 1500, color: "#CE82FF" },
  { name: "Ekspert", min: 3000, color: "#FF9600" },
  { name: "Mistrz", min: 6000, color: "#FF4B4B" },
  { name: "Legenda", min: 12000, color: "#FFC800" },
  { name: "Recall", min: 25000, color: "#5EC8FF" },
] as const;

export interface Rank {
  tier: number;
  name: string;
  min: number;
  next: number | null;
  /** progress toward next tier 0..100 */
  pct: number;
  color: string;
}

export function rankFor(totalXp: number): Rank {
  let tier = 0;
  for (let i = 0; i < RANKS.length; i++) if (totalXp >= RANKS[i]!.min) tier = i;
  const r = RANKS[tier]!;
  const nextR = RANKS[tier + 1];
  const next = nextR ? nextR.min : null;
  const pct = next ? Math.min(100, Math.round(((totalXp - r.min) / (next - r.min)) * 100)) : 100;
  return { tier, name: r.name, min: r.min, next, pct, color: r.color };
}

/** The new rank when XP crossed a tier boundary, else null. */
export function rankChanged(prevXp: number, nextXp: number): Rank | null {
  const a = rankFor(prevXp), b = rankFor(nextXp);
  return b.tier > a.tier ? b : null;
}

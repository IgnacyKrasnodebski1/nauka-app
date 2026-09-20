/** In-lesson combo: consecutive correct answers multiply XP. */
export const COMBO_TIERS = [
  { at: 5, mult: 2 },
  { at: 10, mult: 3 },
] as const;

export interface ComboState {
  streak: number;
  best: number;
}

export const emptyCombo = (): ComboState => ({ streak: 0, best: 0 });

export function comboStep(s: ComboState, correct: boolean): ComboState {
  const streak = correct ? s.streak + 1 : 0;
  return { streak, best: Math.max(s.best, streak) };
}

export function comboMultiplier(streak: number): 1 | 2 | 3 {
  if (streak >= COMBO_TIERS[1].at) return 3;
  if (streak >= COMBO_TIERS[0].at) return 2;
  return 1;
}

/** Next tier threshold, or null at max. */
export function nextComboAt(streak: number): number | null {
  for (const t of COMBO_TIERS) if (streak < t.at) return t.at;
  return null;
}

/** XP for one correct answer at the current combo streak (streak already includes this answer). */
export function comboXp(base: number, streak: number): { xp: number; bonus: number; mult: 1 | 2 | 3 } {
  const mult = comboMultiplier(streak);
  return { xp: base * mult, bonus: base * (mult - 1), mult };
}

/** True when this streak value just crossed a tier (show the badge / play the sound). */
export function comboTierHit(streak: number): boolean {
  return COMBO_TIERS.some((t) => t.at === streak);
}

import type { Level, SubjectProgress, UserMeta } from "./types.js";
import { levelProgress } from "./gamification.js";

export const GEMS = { levelPass: 5, levelPerfect: 10, chest: 20, trophy: 50, examPass: 25, sessionDone: 5, dailyGoal: 10 } as const;
export const GEM_COSTS = { heartRefill: 150, streakFreeze: 100 } as const;

export function addGems(meta: UserMeta, n: number): UserMeta {
  return n ? { ...meta, gems: Math.max(0, meta.gems + n) } : meta;
}

/** null = not enough gems */
export function spendGems(meta: UserMeta, cost: number): UserMeta | null {
  return meta.gems >= cost ? { ...meta, gems: meta.gems - cost } : null;
}

/** Chest sits after every 3rd level (index of the level it follows), never after the last one — the trophy is there. */
export function chestIndexes(levelCount: number): number[] {
  const out: number[] = [];
  for (let i = 2; i < levelCount - 1; i += 3) out.push(i);
  return out;
}

/** A chest opens once every level up to and including `chestIdx` is done. */
export function chestOpenable(p: SubjectProgress, levels: Pick<Level, "id">[], chestIdx: number): boolean {
  if ((p.chests ?? []).includes(chestIdx)) return false;
  for (let i = 0; i <= chestIdx; i++) if (!levelProgress(p, levels[i]!.id).done) return false;
  return true;
}

/** Idempotent: returns null when already opened. */
export function openChest(p: SubjectProgress, chestIdx: number): { progress: SubjectProgress; gems: number } | null {
  if ((p.chests ?? []).includes(chestIdx)) return null;
  return { progress: { ...p, chests: [...(p.chests ?? []), chestIdx].sort((a, b) => a - b) }, gems: GEMS.chest };
}

/** Trophy (end of path) — claimed when every level is done; stored as chest index -1. */
export function trophyClaimable(p: SubjectProgress, levels: Pick<Level, "id">[]): boolean {
  if ((p.chests ?? []).includes(-1)) return false;
  return levels.length > 0 && levels.every((l) => levelProgress(p, l.id).done);
}
export function claimTrophy(p: SubjectProgress): { progress: SubjectProgress; gems: number } | null {
  if ((p.chests ?? []).includes(-1)) return null;
  return { progress: { ...p, chests: [...(p.chests ?? []), -1] }, gems: GEMS.trophy };
}

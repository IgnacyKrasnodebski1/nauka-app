import type { Level, SubjectProgress, UserMeta } from "./types.js";
import { levelProgress } from "./gamification.js";

/**
 * Gem rewards — values from the legacy engine (KROK 8 `GEM`): level +10 (+5 for 3 stars), chest +10, whole daily plan +5,
 * boss +25; missions pay 20–30 (quests.ts), weekly 100. `trophy` / `examPass` / `sessionDone` are online-only extras.
 */
export const GEMS = {
  levelPass: 10,
  /** bonus on top of levelPass for 3 stars (legacy `stars3`) */
  levelPerfect: 5,
  chest: 10,
  trophy: 50,
  examPass: 25,
  sessionDone: 5,
  /** whole daily plan done (legacy `plan`) */
  dailyGoal: 5,
  /** first boss win (legacy `boss`) */
  boss: 25,
} as const;

/** Shop prices (legacy `SHOP[]`): refill 50, freeze 100, double XP 80, theme 150. */
export const GEM_COSTS = { heartRefill: 50, streakFreeze: 100, xpBoost: 80, theme: 150 } as const;

/** Max streak freezes in the backpack. */
export const FREEZE_MAX = 2;
/** Double-XP boost length. */
export const BOOST_MS = 15 * 60_000;
/** Unlockable themes (blob colour on the Today screen), in unlock order. First one is owned from the start. */
export const THEMES: { id: string; name: string }[] = [
  { id: "violet", name: "Fiolet" },
  { id: "cyan", name: "Cyjan" },
  { id: "pink", name: "Róż" },
  { id: "gold", name: "Złoto" },
  { id: "amber", name: "Bursztyn" },
];

export type ShopItemId = "freeze" | "refill" | "boost" | "theme";
export interface ShopItem {
  id: ShopItemId;
  name: string;
  price: number;
  icon: string;
  tone: "cyan" | "red" | "gold" | "violet";
  /** motion class for the icon */
  anim: string;
}
/** Backpack items (Shop screen), legacy order. */
export const SHOP_ITEMS: ShopItem[] = [
  { id: "freeze", name: "Zamrożenie serii", price: GEM_COSTS.streakFreeze, icon: "snow", tone: "cyan", anim: "a-sway" },
  { id: "refill", name: "Uzupełnienie serc", price: GEM_COSTS.heartRefill, icon: "heart", tone: "red", anim: "a-beat" },
  { id: "boost", name: "Podwójne XP na 15 min", price: GEM_COSTS.xpBoost, icon: "bolt", tone: "gold", anim: "a-pulse" },
  { id: "theme", name: "Motyw", price: GEM_COSTS.theme, icon: "palette", tone: "violet", anim: "" },
];

/** "Where do gems come from" card. */
export const GEM_SOURCES: { label: string; gems: number }[] = [
  { label: "zaliczony poziom", gems: GEMS.levelPass },
  { label: "poziom na 3 gwiazdki", gems: GEMS.levelPass + GEMS.levelPerfect },
  { label: "skrzynia na ścieżce", gems: GEMS.chest },
  { label: "misja dzienna", gems: 20 },
  { label: "misja tygodniowa", gems: 100 },
  { label: "cały plan dnia", gems: GEMS.dailyGoal },
  { label: "boss rozdziału", gems: GEMS.boss },
];

/** Gems for a passed level (legacy: +10, +5 more for 3 stars). */
export function levelGems(stars: number): number {
  return GEMS.levelPass + (stars >= 3 ? GEMS.levelPerfect : 0);
}

/* ---------- double XP boost (legacy PROGRESS.boost.until) ---------- */
export function boostActive(until: number | string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const t = typeof until === "number" ? until : new Date(until).getTime();
  return t > now;
}
export function boostLeftMs(until: number | string | null | undefined, now = Date.now()): number {
  if (!until || !boostActive(until, now)) return 0;
  const t = typeof until === "number" ? until : new Date(until).getTime();
  return t - now;
}
/** XP after the boost: positive XP doubles while the boost is active (addXp is the single funnel — apply there). */
export function applyBoost(xp: number, until: number | string | null | undefined, now = Date.now()): number {
  return xp > 0 && boostActive(until, now) ? xp * 2 : xp;
}
/** Timestamp (ms) a freshly bought boost runs until. */
export function boostUntil(now = Date.now()): number {
  return now + BOOST_MS;
}

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

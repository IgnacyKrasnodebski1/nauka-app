import type { UserMeta } from "./types.js";

export const HEARTS_MAX = 5;
export const HEART_REGEN_MS = 30 * 60_000;
/** legacy KROK 8 `REFILL_GEMS` — same as GEM_COSTS.heartRefill */
export const HEART_REFILL_GEMS = 50;

export interface HeartsView {
  hearts: number;
  unlimited: boolean;
  /** ms until the next heart, null when full or unlimited */
  nextInMs: number | null;
}

function folded(meta: Pick<UserMeta, "hearts" | "heartsUpdatedAt">, now: number): { hearts: number; updatedAt: number } {
  const since = Math.max(0, now - new Date(meta.heartsUpdatedAt).getTime());
  if (meta.hearts >= HEARTS_MAX) return { hearts: HEARTS_MAX, updatedAt: now };
  const regen = Math.floor(since / HEART_REGEN_MS);
  const hearts = Math.min(HEARTS_MAX, meta.hearts + regen);
  const updatedAt = hearts >= HEARTS_MAX ? now : new Date(meta.heartsUpdatedAt).getTime() + regen * HEART_REGEN_MS;
  return { hearts, updatedAt };
}

export function heartsNow(meta: Pick<UserMeta, "hearts" | "heartsUpdatedAt">, now = Date.now(), unlimited = false): HeartsView {
  if (unlimited) return { hearts: HEARTS_MAX, unlimited: true, nextInMs: null };
  const f = folded(meta, now);
  return { hearts: f.hearts, unlimited: false, nextInMs: f.hearts >= HEARTS_MAX ? null : Math.max(0, f.updatedAt + HEART_REGEN_MS - now) };
}

/** Fold elapsed regeneration into the stored fields (keeps partial progress toward the next heart). */
export function normalizeHearts(meta: UserMeta, now = Date.now()): UserMeta {
  const f = folded(meta, now);
  if (f.hearts === meta.hearts && f.updatedAt === new Date(meta.heartsUpdatedAt).getTime()) return meta;
  return { ...meta, hearts: f.hearts, heartsUpdatedAt: new Date(f.updatedAt).toISOString() };
}

export function loseHeart(meta: UserMeta, now = Date.now(), unlimited = false): UserMeta {
  if (unlimited) return meta;
  const m = normalizeHearts(meta, now);
  if (m.hearts <= 0) return m;
  // when leaving "full", the regen timer starts now
  const updatedAt = m.hearts >= HEARTS_MAX ? new Date(now).toISOString() : m.heartsUpdatedAt;
  return { ...m, hearts: m.hearts - 1, heartsUpdatedAt: updatedAt };
}

export function gainHeart(meta: UserMeta, now = Date.now()): UserMeta {
  const m = normalizeHearts(meta, now);
  return { ...m, hearts: Math.min(HEARTS_MAX, m.hearts + 1), heartsUpdatedAt: m.hearts + 1 >= HEARTS_MAX ? new Date(now).toISOString() : m.heartsUpdatedAt };
}

export function refillHearts(meta: UserMeta, now = Date.now()): UserMeta {
  return { ...meta, hearts: HEARTS_MAX, heartsUpdatedAt: new Date(now).toISOString() };
}

export function canStartLesson(meta: UserMeta, unlimited: boolean, now = Date.now()): boolean {
  return heartsNow(meta, now, unlimited).hearts > 0;
}

export function formatCountdown(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

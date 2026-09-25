/**
 * Chapter boss (design/DESIGN.md §3 "Boss", legacy engine.js KROK 8 startBoss/renderBoss/finishBoss).
 * Last node of the path; unlocked when every level is done. HP = min(BOSS_HP, pool size) where the pool is every quiz
 * question + every task of the topic. Hit = −1 HP (+5 XP), miss = −1 heart. 20 s per quiz question (tasks untimed).
 * Win: first time +50 XP, +25 gems, badge; again +15 XP, no gems. Pure helpers — UIs keep the state.
 */
import type { BossRecord, QuizQuestion, SubjectProgress, Task, TopicContent } from "./types.js";
import { levelProgress } from "./gamification.js";
import { allQuiz, shuffle } from "./finalize.js";
import { allTasks, QUIZ_XP } from "./tasks.js";

export const BOSS_HP = 10;
/** seconds per quiz question in the fight */
export const BOSS_SEC = 20;
/** the timer turns red / blinks below this many seconds */
export const BOSS_WARN_SEC = 5;
export const BOSS_REWARDS = { firstXp: 50, repeatXp: 15, gems: 25, hitXp: QUIZ_XP } as const;

export type BossItem = { kind: "quiz"; q: QuizQuestion; lvl: string; levelId: string } | { kind: "task"; task: Task; lvl: string; levelId: string };

export interface BossState {
  hp: number;
  max: number;
  items: BossItem[];
  idx: number;
  hits: number;
  miss: number;
  /** blows so far (1-based counter shown as "Cios N") */
  n: number;
  /** ms timestamp of the start */
  t0: number;
}

export function bossName(topic: Pick<TopicContent, "name" | "short"> & { boss?: string }): string {
  return topic.boss || `Strażnik: ${topic.short || topic.name}`;
}

/** Boss is available once every level of the topic is done. */
export function bossUnlocked(topic: Pick<TopicContent, "levels">, p: SubjectProgress): boolean {
  return topic.levels.length > 0 && topic.levels.every((l) => levelProgress(p, l.id).done);
}

/** Question + task pool, shuffled. */
export function bossPool(topic: Pick<TopicContent, "levels">, rand: () => number = Math.random): BossItem[] {
  const qs: BossItem[] = allQuiz(topic).map((q) => ({ kind: "quiz", q: { q: q.q, a: q.a, c: q.c, e: q.e, src: q.src }, lvl: q.lvl, levelId: q.levelId }));
  const ts: BossItem[] = allTasks(topic).map((t) => ({ kind: "task", task: t.task, lvl: t.lvl, levelId: t.levelId }));
  return shuffle([...qs, ...ts], rand);
}

/** Boss HP for a pool size (0 = nothing to fight with). */
export function bossHp(poolSize: number): number {
  return Math.min(BOSS_HP, Math.max(0, poolSize));
}

/** null when the topic has nothing to fight with. */
export function startBoss(topic: Pick<TopicContent, "levels">, now = Date.now(), rand: () => number = Math.random): BossState | null {
  const items = bossPool(topic, rand);
  const hp = bossHp(items.length);
  if (!hp) return null;
  return { hp, max: hp, items, idx: 0, hits: 0, miss: 0, n: 0, t0: now };
}

/** Current item (pool wraps around and reshuffles when exhausted). */
export function bossNext(s: BossState, rand: () => number = Math.random): { state: BossState; item: BossItem } {
  let state = s;
  if (state.idx >= state.items.length) state = { ...state, items: shuffle(state.items, rand), idx: 0 };
  state = { ...state, n: state.n + 1 };
  return { state, item: state.items[state.idx]! };
}

/** Apply one answer. `xp` = XP to grant (hit), `loseHeart` = the UI should call loseHeart(). */
export function bossAnswer(s: BossState, ok: boolean): { state: BossState; xp: number; loseHeart: boolean; won: boolean } {
  const state: BossState = ok ? { ...s, hp: s.hp - 1, hits: s.hits + 1, idx: s.idx + 1 } : { ...s, miss: s.miss + 1, idx: s.idx + 1 };
  return { state, xp: ok ? BOSS_REWARDS.hitXp : 0, loseHeart: !ok, won: state.hp <= 0 };
}

export interface BossOutcome {
  record: BossRecord;
  xp: number;
  gems: number;
  /** first win → badge */
  first: boolean;
  seconds: number;
}

/** Finish the fight. Pure: returns the new record and rewards (XP through addXp, gems through addGems). */
export function finishBoss(prev: BossRecord | undefined, s: BossState, win: boolean, today: string, now = Date.now()): BossOutcome {
  const rec: BossRecord = prev ? { ...prev } : { done: false, n: 0 };
  const seconds = Math.max(0, Math.round((now - s.t0) / 1000));
  if (!win) return { record: rec, xp: 0, gems: 0, first: false, seconds };
  const first = !rec.done;
  rec.done = true;
  rec.n = (rec.n | 0) + 1;
  rec.at = today;
  if (!rec.best || seconds < rec.best) rec.best = seconds;
  return { record: rec, xp: first ? BOSS_REWARDS.firstXp : BOSS_REWARDS.repeatXp, gems: first ? BOSS_REWARDS.gems : 0, first, seconds };
}

/** Path node state for the boss node. */
export function bossNodeState(topic: Pick<TopicContent, "levels">, p: SubjectProgress): "locked" | "open" | "beaten" {
  if (p.boss?.done) return "beaten";
  return bossUnlocked(topic, p) ? "open" : "locked";
}

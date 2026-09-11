import type { LevelProgress, TopicContent, SubjectProgress, UserMeta } from "./types.js";

/** XP rewards — single source of truth for both apps. */
export const XP = {
  feedRead: 2,
  flashcardKnown: 1,
  quizCorrect: 5,
  gameCorrect: 3,
  levelPass: 25,
  levelPerfect: 50,
  examPass: 100,
} as const;

/** Level pass threshold in % (lesson quiz). */
export const LEVEL_PASS = 50;

export function starsFor(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= LEVEL_PASS) return 1;
  return 0;
}

export function emptyProgress(): SubjectProgress {
  return { xp: 0, levels: {} };
}

export function levelProgress(p: SubjectProgress, levelId: string): LevelProgress {
  return p.levels[levelId] ?? { done: false, best: 0, stars: 0, attempts: 0 };
}

/** Index of first level not yet passed; levels before it are done, after it locked. */
export function unlockedIndex(subject: Pick<TopicContent, "levels">, p: SubjectProgress): number {
  let i = 0;
  while (i < subject.levels.length && levelProgress(p, subject.levels[i]!.id).done) i++;
  return Math.min(i, subject.levels.length - 1);
}

export function isLevelUnlocked(subject: Pick<TopicContent, "levels">, p: SubjectProgress, levelId: string): boolean {
  const idx = subject.levels.findIndex((l) => l.id === levelId);
  if (idx <= 0) return true;
  return levelProgress(p, subject.levels[idx - 1]!.id).done;
}

/** Apply a quiz result to progress. Returns XP gained. Pure — does not mutate. */
export function applyQuizResult(
  p: SubjectProgress,
  levelId: string,
  correct: number,
  total: number,
): { progress: SubjectProgress; gained: number; passed: boolean; pct: number; stars: 0 | 1 | 2 | 3 } {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const stars = starsFor(pct);
  const prev = levelProgress(p, levelId);
  const passed = pct >= LEVEL_PASS;
  let gained = correct * XP.quizCorrect;
  if (passed && !prev.done) gained += XP.levelPass;
  if (pct === 100 && prev.best < 100) gained += XP.levelPerfect;
  const next: LevelProgress = {
    done: prev.done || passed,
    best: Math.max(prev.best, pct),
    stars: Math.max(prev.stars, stars) as 0 | 1 | 2 | 3,
    attempts: prev.attempts + 1,
  };
  return { progress: { ...p, xp: p.xp + gained, levels: { ...p.levels, [levelId]: next } }, gained, passed, pct, stars };
}

export function subjectCompletion(subject: Pick<TopicContent, "levels">, p: SubjectProgress): { done: number; total: number; pct: number } {
  const total = subject.levels.length;
  const done = subject.levels.filter((l) => levelProgress(p, l.id).done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function gradeFor(pct: number, grading: TopicContent["grading"]): string {
  for (const [thr, label] of grading.scale) if (pct >= thr) return label;
  return grading.failLabel;
}

/* ---------------- streak ---------------- */

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayDiff(a: string, b: string): number {
  const pa = a.split("-").map(Number) as [number, number, number];
  const pb = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

/** Live streak for display (0 if expired). */
export function streakDisplay(meta: UserMeta, today = todayStr()): number {
  if (!meta.lastDay) return 0;
  const d = dayDiff(meta.lastDay, today);
  return d === 0 || d === 1 ? meta.streak : 0;
}

/** Register activity today. Pure. `extended` is true when the streak grew/started today. */
export function touchStreak(meta: UserMeta, today = todayStr()): { meta: UserMeta; extended: boolean } {
  if (meta.lastDay === today) return { meta, extended: false };
  let streak = 1;
  if (meta.lastDay) {
    const d = dayDiff(meta.lastDay, today);
    streak = d === 1 ? meta.streak + 1 : 1;
  }
  return { meta: { streak, best: Math.max(meta.best, streak), lastDay: today }, extended: true };
}

export function emptyMeta(): UserMeta {
  return { streak: 0, best: 0, lastDay: null };
}

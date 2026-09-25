/**
 * Recall 2.0 — stan usera poza `UserMeta` (migracja 0003_recall2.sql). Kształty 1:1 z apps/web/src/lib/store/extra.ts,
 * żeby oba UI czytały te same kolumny `user_meta.*`, `profiles.goal`, `progress.boss/ghost`.
 */
import type { AlbumMap, Quest, QuizQuestion } from "@nauka/shared";
import type { TestPlan } from "./tests";

export type Goal = "sprawdziany" | "matura-p" | "matura-r" | "olimpiada" | "sesja" | "wlasny";
export interface Themes {
  owned: string[];
  active: string;
}
export interface Reminder {
  on: boolean;
  at: string;
}
export interface HistDay {
  levels: number;
  reviews: number;
  cards: number;
  combo: number;
  missions: number;
}
export type History = Record<string, HistDay>;
export interface DailyTask {
  id: string;
  done: boolean;
  need?: number;
  prog?: number;
}
export interface DailyPlan {
  date: string;
  tasks: DailyTask[];
  planDone?: boolean;
}
export type QuestionOverride = QuizQuestion & { at: string };
/** Wynik egzaminu (ExamStart „Ostatnie podejście”, legacy `subjState(id).exam`). */
export interface ExamEntry {
  pct: number;
  grade: string;
  correct: number;
  total: number;
  date: string;
}
export interface ExamRec {
  n: number;
  passed: number;
  best?: ExamEntry;
  last?: ExamEntry;
}
/** "<topicId>:<levelId>:<qi>" → poprawione pytanie; "hide:<topicId>:<levelId>" → true (poziom wyłączony w SubjectReady). */
export type Overrides = Record<string, QuestionOverride | true>;

export interface Extra {
  goal: Goal | null;
  themes: Themes;
  boostUntil: number | null;
  album: AlbumMap;
  overrides: Overrides;
  tests: TestPlan[];
  weekly: Quest | null;
  history: History;
  daily: DailyPlan | null;
  reduceMotion: boolean;
  reminder: Reminder | null;
  /** topicId → rekord egzaminu */
  exams: Record<string, ExamRec>;
}

export const emptyExtra = (): Extra => ({ goal: null, themes: { owned: ["violet"], active: "violet" }, boostUntil: null, album: {}, overrides: {}, tests: [], weekly: null, history: {}, daily: null, reduceMotion: false, reminder: null, exams: {} });

export function normalizeExtra(e: Partial<Extra> | null | undefined): Extra {
  const base = emptyExtra();
  if (!e) return base;
  return {
    goal: e.goal ?? null,
    themes: e.themes && Array.isArray(e.themes.owned) && e.themes.owned.length ? { owned: e.themes.owned, active: e.themes.active ?? e.themes.owned[0]! } : base.themes,
    boostUntil: typeof e.boostUntil === "number" ? e.boostUntil : e.boostUntil ? new Date(e.boostUntil as unknown as string).getTime() || null : null,
    album: e.album && typeof e.album === "object" ? e.album : {},
    overrides: e.overrides && typeof e.overrides === "object" ? e.overrides : {},
    tests: Array.isArray(e.tests) ? e.tests : [],
    weekly: e.weekly ?? null,
    history: e.history && typeof e.history === "object" ? e.history : {},
    daily: e.daily && typeof e.daily === "object" && Array.isArray(e.daily.tasks) ? e.daily : null,
    reduceMotion: !!e.reduceMotion,
    reminder: e.reminder ?? null,
    exams: e.exams && typeof e.exams === "object" ? e.exams : {},
  };
}

export const ovKey = (topicId: string, levelId: string, qi: number) => `${topicId}:${levelId}:${qi}`;
export const hideKey = (topicId: string, levelId: string) => `hide:${topicId}:${levelId}`;

/** Pytanie z nałożoną poprawką użytkownika (EditContent) — jedno źródło dla lekcji, quizu, egzaminu, bossa, powtórki i cramu. */
export function qOf(overrides: Overrides, topicId: string, levelId: string, qi: number, q: QuizQuestion): QuizQuestion & { edited?: boolean } {
  const o = overrides[ovKey(topicId, levelId, qi)];
  if (!o || o === true) return q;
  return { ...q, q: o.q, a: [...o.a], c: o.c, e: o.e, edited: true };
}
export function overridesFor(overrides: Overrides, topicId: string, levelId: string): Record<number, QuizQuestion> {
  const out: Record<number, QuizQuestion> = {};
  const pre = `${topicId}:${levelId}:`;
  for (const [k, v] of Object.entries(overrides)) if (k.startsWith(pre) && v !== true) out[+k.slice(pre.length)] = { q: v.q, a: v.a, c: v.c, e: v.e, src: v.src };
  return out;
}
export const emptyHist = (): HistDay => ({ levels: 0, reviews: 0, cards: 0, combo: 0, missions: 0 });

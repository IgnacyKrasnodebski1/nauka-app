/** Recall 2.0 per-user state beyond `UserMeta` (migration 0003_recall2.sql). */
import type { AlbumMap, Quest, QuizQuestion } from "@nauka/shared";
import type { TestPlan } from "@/lib/tests";

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
/** "<topicId>:<levelId>:<qi>" → replacement question; "hide:<topicId>:<levelId>" → true (level switched off in SubjectReady). */
export type Overrides = Record<string, QuestionOverride | true>;

/** Exam record per topic (legacy `subjState(id).exam`). */
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
  /** topicId → exam record */
  exams: Record<string, ExamRec>;
}

export const emptyExtra = (): Extra => ({ goal: null, themes: { owned: ["violet"], active: "violet" }, boostUntil: null, album: {}, overrides: {}, tests: [], weekly: null, history: {}, daily: null, reduceMotion: false, reminder: null, exams: {} });

export const ovKey = (topicId: string, levelId: string, qi: number) => `${topicId}:${levelId}:${qi}`;
export const hideKey = (topicId: string, levelId: string) => `hide:${topicId}:${levelId}`;

/** Question with the user's override applied (EditContent) — one source for lesson, quiz, exam, boss, review, cram. */
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

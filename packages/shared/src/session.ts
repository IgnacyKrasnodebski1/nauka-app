/**
 * Daily session + exam study plan. Pure functions shared by web and mobile.
 */
import { allFlashcards, allQuiz, shuffle } from "./finalize.js";
import { isLevelUnlocked, levelProgress } from "./gamification.js";
import { isDue, type SrsCard } from "./srs.js";
import type { Flashcard, QuizQuestion, SubjectProgress, Topic, TopicContent } from "./types.js";
import { dayDiff, todayStr } from "./gamification.js";

export interface SessionItem {
  topicId: string;
  kind: "review" | "weak" | "new";
  /** flashcard for review, question for weak; level id for new */
  card?: Flashcard & { key: string };
  question?: QuizQuestion & { levelId: string };
  levelId?: string;
}

export interface DailySession {
  items: SessionItem[];
  /** rough minutes */
  minutes: number;
  reviewCount: number;
  weakCount: number;
  newLevel?: { topicId: string; levelId: string; title: string };
}

/** Questions the user got wrong recently: stored per topic as level → wrong question indices. */
export type WeakMap = Record<string, Record<string, number[]>>; // topicId → levelId → question indices

/**
 * Build today's 10-minute session: due flashcards (max 12) + weak questions (max 6) + next unlocked level.
 */
export function buildDailySession(
  topics: Pick<Topic, "id" | "levels" | "name">[],
  progress: Record<string, SubjectProgress>,
  srs: Record<string, Record<string, SrsCard>>, // topicId → cardKey → card
  weak: WeakMap,
  now = new Date(),
): DailySession {
  const items: SessionItem[] = [];
  let reviewCount = 0,
    weakCount = 0;
  for (const t of topics) {
    const cards = allFlashcards(t);
    const state = srs[t.id] ?? {};
    for (const c of cards) {
      const key = `${c.levelId}:${c.index}`;
      const st = state[key];
      if (st && isDue(st, now) && reviewCount < 12) {
        items.push({ topicId: t.id, kind: "review", card: { t: c.t, d: c.d, key } });
        reviewCount++;
      }
    }
    const w = weak[t.id] ?? {};
    for (const l of t.levels) {
      for (const qi of w[l.id] ?? []) {
        const q = l.quiz[qi];
        if (q && weakCount < 6) {
          items.push({ topicId: t.id, kind: "weak", question: { ...q, levelId: l.id } });
          weakCount++;
        }
      }
    }
  }
  let newLevel: DailySession["newLevel"];
  for (const t of topics) {
    const p = progress[t.id] ?? { xp: 0, levels: {} };
    const next = t.levels.find((l) => !levelProgress(p, l.id).done && isLevelUnlocked(t, p, l.id));
    if (next) {
      newLevel = { topicId: t.id, levelId: next.id, title: next.title };
      items.push({ topicId: t.id, kind: "new", levelId: next.id });
      break;
    }
  }
  const minutes = Math.max(3, Math.round(reviewCount * 0.3 + weakCount * 0.7 + (newLevel ? 6 : 0)));
  return { items: shuffle(items.filter((i) => i.kind !== "new")).concat(items.filter((i) => i.kind === "new")), minutes, reviewCount, weakCount, newLevel };
}

export interface PlanDay {
  date: string; // YYYY-MM-DD
  /** what to do that day */
  tasks: { kind: "level" | "review" | "exam"; topicId?: string; levelId?: string; label: string }[];
}

/**
 * Study plan until an exam date: spread unfinished levels over the days, reviews every day, mock exam the day before.
 */
export function buildExamPlan(
  topics: Pick<Topic, "id" | "levels" | "name">[],
  progress: Record<string, SubjectProgress>,
  examDate: string,
  today = todayStr(),
): { days: PlanDay[]; daysLeft: number; levelsLeft: number } {
  const daysLeft = Math.max(0, dayDiff(today, examDate));
  const pending: { topicId: string; levelId: string; label: string }[] = [];
  for (const t of topics) {
    const p = progress[t.id] ?? { xp: 0, levels: {} };
    for (const l of t.levels) if (!levelProgress(p, l.id).done) pending.push({ topicId: t.id, levelId: l.id, label: `${t.name}: ${l.title}` });
  }
  const studyDays = Math.max(1, daysLeft); // last day = exam day itself is not a study day if daysLeft>1
  const days: PlanDay[] = [];
  const perDay = Math.ceil(pending.length / Math.max(1, studyDays - 1 || 1));
  let cursor = 0;
  for (let i = 0; i < studyDays; i++) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + i);
    const date = todayStr(d);
    const tasks: PlanDay["tasks"] = [];
    const isLast = i === studyDays - 1 && studyDays > 1;
    if (isLast) tasks.push({ kind: "exam", label: "Symulacja sprawdzianu" });
    else {
      for (let k = 0; k < perDay && cursor < pending.length; k++, cursor++) tasks.push({ kind: "level", ...pending[cursor]! });
    }
    tasks.push({ kind: "review", label: "Powtórka fiszek" });
    days.push({ date, tasks });
  }
  return { days, daysLeft, levelsLeft: pending.length };
}

/** Record wrong answers so the daily session can bring them back. Pure. */
export function markWeak(weak: WeakMap, topicId: string, levelId: string, wrongIdx: number[], rightIdx: number[]): WeakMap {
  const t = { ...(weak[topicId] ?? {}) };
  const set = new Set(t[levelId] ?? []);
  for (const i of rightIdx) set.delete(i);
  for (const i of wrongIdx) set.add(i);
  t[levelId] = [...set].slice(-20);
  return { ...weak, [topicId]: t };
}

export { allQuiz };

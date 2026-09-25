/**
 * Plan do sprawdzianu (design/DESIGN.md §4.3, TestPlan.html) — port legacy `buildTestPlan`/`syncTests` na model
 * przedmiot → tematy → poziomy. Poziom w zakresie = "<topicId>:<levelId>". Jeden plan na przedmiot, przechowywany w
 * user_meta.tests (JSONB). Dni przed końcówką: nauka niezaliczonych poziomów + powtórki (co trzeci wolny dzień odpoczynek);
 * końcówka: próbny (−3), słabe punkty (−2), krótka powtórka = Cram (−1). Przeliczany raz dziennie od dziś.
 */
import { dayDiff, levelProgress, todayStr, type SubjectProgress, type Topic, type WeakMap } from "@nauka/shared";
import { addDays } from "@/lib/dates";

export type PlanKind = "learn" | "review" | "mock" | "weak" | "rest";
export interface PlanRow {
  date: string;
  kind: PlanKind;
  minutes: number;
  /** learn: level keys "<topicId>:<levelId>" */
  lv?: string[];
  /** mock: question count */
  n?: number;
  /** review on the last day = Cram */
  short?: boolean;
  done?: boolean;
}
export interface TestPlan {
  id: string;
  subjectId: string;
  levels: string[];
  date: string;
  plan: PlanRow[];
  built: string | null;
}

export const TP_LABEL: Record<PlanKind, string> = { learn: "Nauka", review: "Powtórka + zadania", mock: "Próbny sprawdzian", weak: "Tylko słabe punkty", rest: "Wolne" };
export const TP_ICON: Record<PlanKind, string> = { learn: "book", review: "refresh", mock: "target", weak: "alert", rest: "clock" };

export const levelKey = (topicId: string, levelId: string) => `${topicId}:${levelId}`;
export function splitKey(k: string): { topicId: string; levelId: string } {
  const i = k.indexOf(":");
  return { topicId: k.slice(0, i), levelId: k.slice(i + 1) };
}

export function subjectLevelKeys(topics: Pick<Topic, "id" | "levels">[]): string[] {
  return topics.flatMap((t) => t.levels.map((l) => levelKey(t.id, l.id)));
}

export function unfinishedLevels(topics: Pick<Topic, "id" | "levels">[], progress: Record<string, SubjectProgress>, levels: string[]): string[] {
  return levels.filter((k) => {
    const { topicId, levelId } = splitKey(k);
    const t = topics.find((x) => x.id === topicId);
    if (!t || !t.levels.some((l) => l.id === levelId)) return false;
    return !levelProgress(progress[topicId] ?? { xp: 0, levels: {} }, levelId).done;
  });
}

export function questionsInScope(topics: Pick<Topic, "id" | "levels">[], levels: string[]): number {
  return topics.reduce((a, t) => a + t.levels.filter((l) => levels.includes(levelKey(t.id, l.id))).reduce((b, l) => b + l.quiz.length, 0), 0);
}

export function hasWeakDeck(weak: WeakMap, topics: Pick<Topic, "id">[]): boolean {
  return topics.some((t) => Object.values(weak[t.id] ?? {}).some((arr) => arr.length > 0));
}

export function buildTestPlan(t: TestPlan, topics: Pick<Topic, "id" | "levels">[], progress: Record<string, SubjectProgress>, weak: WeakMap, today = todayStr()): PlanRow[] {
  const N = dayDiff(today, t.date);
  const past = (t.plan ?? []).filter((r) => r.date < today);
  if (N <= 0) return past;
  const left = unfinishedLevels(topics, progress, t.levels);
  const nq = questionsInScope(topics, t.levels);
  const tail: PlanRow[] = [];
  tail.unshift({ date: addDays(t.date, -1), kind: "review", minutes: 20, short: true });
  if (N >= 2) tail.unshift({ date: addDays(t.date, -2), kind: N >= 3 || hasWeakDeck(weak, topics) ? "weak" : "review", minutes: 8 });
  if (N >= 3) tail.unshift({ date: addDays(t.date, -3), kind: "mock", minutes: Math.max(8, Math.min(20, nq)), n: Math.min(20, nq) });
  const D = N - tail.length, L = left.length;
  const head: PlanRow[] = [];
  if (D > 0) {
    if (L >= D) {
      const per = Math.ceil(L / D);
      for (let i = 0; i < D; i++) {
        const lv = left.slice(i * per, (i + 1) * per);
        head.push(lv.length ? { date: addDays(today, i), kind: "learn", lv, minutes: 4 + 6 * lv.length } : { date: addDays(today, i), kind: "review", minutes: 10 });
      }
    } else {
      const learnDays: number[] = [];
      for (let i = 0; i < L; i++) learnDays.push(Math.floor((i * D) / L));
      let free = 0;
      for (let i = 0; i < D; i++) {
        const date = addDays(today, i);
        const k = learnDays.indexOf(i);
        if (k >= 0) {
          head.push({ date, kind: "learn", lv: [left[k]!], minutes: 10 });
          free = 0;
        } else {
          free++;
          if (free === 3) {
            head.push({ date, kind: "rest", minutes: 0 });
            free = 0;
          } else head.push({ date, kind: "review", minutes: 10 });
        }
      }
    }
  }
  const rows = head.concat(tail);
  const prev = (t.plan ?? []).find((r) => r.date === today);
  if (prev && prev.done && rows[0] && rows[0].kind === prev.kind) rows[0].done = true;
  return past.concat(rows);
}

/** Once a day: drop expired plans, rebuild from today. Returns the same array when nothing changed. */
export function syncTests(tests: TestPlan[], topicsBySubject: (subjectId: string) => Pick<Topic, "id" | "levels">[], progress: Record<string, SubjectProgress>, weak: WeakMap, today = todayStr()): TestPlan[] {
  let changed = false;
  const out: TestPlan[] = [];
  for (const t of tests) {
    if (!t || t.date < today) {
      changed = true;
      continue;
    }
    if (t.built !== today) {
      out.push({ ...t, plan: buildTestPlan(t, topicsBySubject(t.subjectId), progress, weak, today), built: today });
      changed = true;
    } else out.push(t);
  }
  return changed ? out : tests;
}

export function createTest(tests: TestPlan[], subjectId: string, date: string, levels: string[], topics: Pick<Topic, "id" | "levels">[], progress: Record<string, SubjectProgress>, weak: WeakMap): { tests: TestPlan[]; test: TestPlan } {
  const t: TestPlan = { id: "t" + Date.now().toString(36), subjectId, levels: [...levels], date, plan: [], built: null };
  t.plan = buildTestPlan(t, topics, progress, weak);
  t.built = todayStr();
  return { tests: tests.filter((x) => x.subjectId !== subjectId).concat(t), test: t };
}

/** Mark today's row done (learn needs every level of the row passed). Returns null when nothing changed. */
export function testDone(tests: TestPlan[], subjectId: string, kind: PlanKind, progress: Record<string, SubjectProgress>, today = todayStr()): TestPlan[] | null {
  const t = tests.find((x) => x.subjectId === subjectId);
  if (!t) return null;
  const r = t.plan.find((x) => x.date === today);
  if (!r || r.done || r.kind !== kind) return null;
  if (kind === "learn" && r.lv) {
    if (!r.lv.every((k) => { const { topicId, levelId } = splitKey(k); return levelProgress(progress[topicId] ?? { xp: 0, levels: {} }, levelId).done; })) return null;
  }
  return tests.map((x) => (x.id === t.id ? { ...x, plan: x.plan.map((row) => (row === r ? { ...row, done: true } : row)) } : x));
}

export function tpTitle(r: PlanRow, topics: Pick<Topic, "id" | "levels">[]): string {
  if (r.kind === "learn") {
    const n = (r.lv ?? []).length;
    if (n === 1) {
      const { topicId, levelId } = splitKey(r.lv![0]!);
      const l = topics.find((t) => t.id === topicId)?.levels.find((x) => x.id === levelId);
      if (l) return "Nauka: " + l.title.replace(/[\p{Extended_Pictographic}️‍]/gu, "").trim();
    }
    return `Nauka: ${n} ${n === 1 ? "poziom" : n >= 2 && n <= 4 ? "poziomy" : "poziomów"}`;
  }
  if (r.kind === "review") return r.short ? "Noc przed egzaminem" : TP_LABEL.review;
  return TP_LABEL[r.kind];
}
export function tpSub(r: PlanRow): string {
  if (r.kind === "learn") return `${r.minutes} min · nowe pojęcia`;
  if (r.kind === "review") return r.short ? "20 min · 4 bloki, bez nowych rzeczy, potem spać" : `${r.minutes} min`;
  if (r.kind === "mock") return `${r.minutes} min · ${r.n} ${r.n === 1 ? "pytanie" : (r.n ?? 0) >= 2 && (r.n ?? 0) <= 4 ? "pytania" : "pytań"}`;
  if (r.kind === "weak") return `${r.minutes} min · błędy z próbnego`;
  return "odpoczynek też się liczy";
}

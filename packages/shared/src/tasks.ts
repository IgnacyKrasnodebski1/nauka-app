/**
 * Tasks 2.0 — shared logic for the 15 `tasks` types (design/DESIGN.md §4.1; legacy engine.js KROK 5/5b).
 * Pure: session mixing, legacy games → tasks, XP, answer checking. Both UIs render through the same registry.
 */
import type { Level, MiniGame, QuizQuestion, Task, TaskType, TopicContent, TfTask, FillTask, OrderTask, SortTask, TimelineTask, ChainTask, TypeTermTask, MatchTask, SwipeTask, HotspotTask, MathStepsTask } from "./types.js";
import { TASK_TYPES } from "./types.js";
import { shuffle } from "./finalize.js";
import { shuffleAnswers } from "./quiz-quality.js";

/** Base XP for one correct quiz answer / one solved task (× combo multiplier). Legacy: QUIZ_XP=5, TASK_XP=8. */
export const QUIZ_XP = 5;
export const TASK_XP = 8;
/** XP for a task solved in the practice tab (no hearts, no combo). */
export const PRACTICE_TASK_XP = 4;
/** "First letter" hint in typeterm costs XP (only when the user has some). */
export const TYPETERM_HINT_XP = 2;

export type TaskTone = "acid" | "pink" | "amber" | "cyan" | "gold" | "violet" | "red";

/** Label / tone / icon per task type — order = order of cards in the practice tab. */
export const TASK_META: Record<TaskType, { label: string; tone: TaskTone; icon: string; desc: string; preview: string }> = {
  tf: { label: "Prawda czy fałsz", tone: "gold", icon: "check", desc: "seria zdań, czasem na czas", preview: "TaskTrueFalse" },
  fill: { label: "Uzupełnij zdanie", tone: "pink", icon: "edit", desc: "wstaw brakujące słowa", preview: "TaskFill" },
  typeterm: { label: "Wpisz pojęcie", tone: "acid", icon: "keyboard", desc: "od definicji do nazwy", preview: "TypeTerm" },
  swipe: { label: "Dwie kategorie", tone: "cyan", icon: "swipe", desc: "przesuń kartę w lewo albo w prawo", preview: "Swipe" },
  thesis: { label: "Czyja to teza", tone: "violet", icon: "quote", desc: "dopasuj myśl do autora lub szkoły", preview: "WhoSaid" },
  scenario: { label: "Scenariusz", tone: "red", icon: "bulb", desc: "sytuacja i jej wyjaśnienie", preview: "Scenario" },
  finderror: { label: "Znajdź błąd", tone: "red", icon: "search", desc: "jedno zdanie jest fałszywe", preview: "FindError" },
  match: { label: "Połącz w pary", tone: "cyan", icon: "link", desc: "pojęcie i jego sedno", preview: "TaskMatch" },
  order: { label: "Ustaw kolejność", tone: "gold", icon: "list", desc: "ułóż etapy po kolei", preview: "TaskOrder" },
  sort: { label: "Przypisz do kategorii", tone: "acid", icon: "grid", desc: "rozdziel przykłady do grup", preview: "TaskSort" },
  timeline: { label: "Oś czasu", tone: "gold", icon: "calendar", desc: "przypnij wydarzenia do dat", preview: "Timeline" },
  chain: { label: "Łańcuch przyczyn", tone: "cyan", icon: "arrow-down", desc: "co z czego wynika", preview: "CauseChain" },
  chart: { label: "Wykres", tone: "violet", icon: "chart", desc: "odczytaj dane z wykresu", preview: "ChartRead" },
  mathsteps: { label: "Krok po kroku", tone: "gold", icon: "calc", desc: "rozwiąż zadanie etapami", preview: "MathSteps" },
  hotspot: { label: "Wskaż na schemacie", tone: "acid", icon: "pointer", desc: "dotknij właściwego miejsca", preview: "Hotspot" },
};

export function isTaskType(t: unknown): t is TaskType {
  return typeof t === "string" && (TASK_TYPES as string[]).includes(t);
}

/** Base XP a task is worth when solved (before combo). Uniform like legacy; kept as a function so types can be weighted later. */
export function taskPoints(task: Pick<Task, "type"> | Pick<MiniGame, "type">): number {
  return TASK_XP;
}

/* ---------------- legacy games → tasks ---------------- */

/**
 * Old generated topics have `games` (match | cloze | truefalse | order). Convert them to tasks so both UIs render
 * everything through the task renderers: match→match, cloze→fill (≤4 gaps per task), truefalse→tf, order→order.
 */
export function gamesAsTasks(games: readonly MiniGame[] | undefined | null): Task[] {
  const out: Task[] = [];
  for (const g of games ?? []) {
    switch (g.type) {
      case "match":
        if (g.pairs.length >= 2) out.push({ type: "match", title: g.title, pairs: g.pairs.map((p) => [p.l, p.r] as [string, string]) });
        break;
      case "cloze": {
        const items = g.items.filter((i) => i.s.includes("___"));
        for (let k = 0; k < items.length; k += 4) {
          const chunk = items.slice(k, k + 4);
          const blanks = chunk.map((i) => i.answer);
          const bank = dedupe(chunk.flatMap((i) => i.options).filter((o) => !blanks.some((b) => foldAnswer(b) === foldAnswer(o))));
          const text = chunk.map((i, idx) => i.s.replace("___", `{${idx}}`)).join("\n");
          const e = chunk.map((i) => i.e).filter(Boolean).join(" ") || undefined;
          out.push({ type: "fill", title: g.title, text, blanks, bank, e });
        }
        break;
      }
      case "truefalse":
        if (g.items.length >= 1) out.push({ type: "tf", title: g.title, statements: g.items.map((i) => ({ s: i.s, v: i.v, e: i.e })) });
        break;
      case "order":
        if (g.steps.length >= 2) out.push({ type: "order", title: g.title || g.prompt, items: [...g.steps] });
        break;
    }
  }
  return out;
}

/** Tasks of a level: `tasks` when present, else legacy `games` converted. Unknown types are dropped. */
export function levelTasks(level: Pick<Level, "tasks" | "games">): Task[] {
  const own = (level.tasks ?? []).filter((t) => t && isTaskType(t.type));
  return own.length ? own : gamesAsTasks(level.games);
}

/** Every task of a topic with its level (practice tab, boss pool). */
export function allTasks(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => levelTasks(l).map((task, ti) => ({ task, lvl: l.title, levelId: l.id, ti })));
}

/** Count tasks per type in a topic (practice tab cards). */
export function taskTypeCounts(s: Pick<TopicContent, "levels">): Partial<Record<TaskType, number>> {
  const out: Partial<Record<TaskType, number>> = {};
  for (const { task } of allTasks(s)) out[task.type] = (out[task.type] ?? 0) + 1;
  return out;
}

/* ---------------- level session ---------------- */

export type SessionQuizItem = { kind: "quiz"; id: string; q: QuizQuestion; qi: number; xp: number };
export type SessionTaskItem = { kind: "task"; id: string; task: Task; ti: number; xp: number };
export type SessionGameItem = { kind: "game"; id: string; game: MiniGame; gi: number; xp: number };
export type LevelSessionItem = SessionQuizItem | SessionTaskItem | SessionGameItem;

export interface LevelSessionOptions {
  /** max quiz questions (random subset), legacy 6 */
  maxQuiz?: number;
  /** max tasks (all by default) */
  maxTasks?: number;
  /** "convert" (default): legacy games become tasks when the level has none; "keep": emit games as kind "game"; "skip": ignore games */
  games?: "convert" | "keep" | "skip";
  rand?: () => number;
  /** quiz overrides (EditContent): index → replacement question */
  overrides?: Record<number, QuizQuestion>;
}

/**
 * One stream for a lesson: up to `maxQuiz` random quiz questions and the level's tasks. The first item is always a
 * question, tasks are spread evenly between the rest (legacy `levelSession`). Quiz answers are re-shuffled.
 */
export function levelSession(level: Pick<Level, "quiz" | "tasks" | "games">, opts: LevelSessionOptions = {}): LevelSessionItem[] {
  const rand = opts.rand ?? Math.random;
  const maxQuiz = opts.maxQuiz ?? 6;
  const mode = opts.games ?? "convert";
  const qs: LevelSessionItem[] = shuffle(
    (level.quiz ?? []).map((q, qi) => ({ kind: "quiz" as const, id: `q:${qi}`, q: shuffleAnswers(opts.overrides?.[qi] ?? q, rand), qi, xp: QUIZ_XP })),
    rand,
  ).slice(0, Math.min(maxQuiz, (level.quiz ?? []).length));
  let extras: LevelSessionItem[] = [];
  const own = (level.tasks ?? []).filter((t) => t && isTaskType(t.type));
  const taskList: Task[] = own.length ? own : mode === "convert" ? gamesAsTasks(level.games) : [];
  extras = taskList.map((task, ti) => ({ kind: "task" as const, id: `t:${ti}`, task, ti, xp: taskPoints(task) }));
  if (mode === "keep") extras = extras.concat((level.games ?? []).map((game, gi) => ({ kind: "game" as const, id: `g:${gi}`, game, gi, xp: taskPoints(game) })));
  extras = shuffle(extras, rand);
  if (opts.maxTasks != null) extras = extras.slice(0, opts.maxTasks);
  return interleave(qs, extras);
}

/** First item is a question; the rest of `extras` spread evenly among the remaining questions. */
export function interleave<A, B>(qs: A[], extras: B[]): (A | B)[] {
  if (!extras.length || !qs.length) return [...qs, ...extras];
  const out: (A | B)[] = [qs[0]!];
  const rest = qs.slice(1);
  let qi = 0, ti = 0;
  while (qi < rest.length || ti < extras.length) {
    const pickTask = ti < extras.length && (qi >= rest.length || ti * rest.length <= qi * extras.length);
    out.push(pickTask ? extras[ti++]! : rest[qi++]!);
  }
  return out;
}

/* ---------------- answer checking (pure, identical in both UIs) ---------------- */

/** Lowercase, collapse whitespace. */
export function normAnswer(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
/** Keyboard-answer comparison key: no case, no diacritics, no punctuation (legacy `fold`). */
export function foldAnswer(s: string): string {
  return normAnswer(s)
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** Edit distance (legacy `lev`). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

/** typeterm: typed answer vs `answer` / `accept`, tolerance `typo` (default 1). */
export function checkTypeTerm(task: Pick<TypeTermTask, "answer" | "accept" | "typo">, input: string): boolean {
  const got = foldAnswer(input);
  if (!got) return false;
  const tol = task.typo ?? 1;
  return [task.answer, ...(task.accept ?? [])].some((a) => {
    const want = foldAnswer(a);
    return want === got || (tol > 0 && levenshtein(want, got) <= tol);
  });
}
/** fill: `answers[i]` = tile placed in gap i. */
export function checkFill(task: Pick<FillTask, "blanks">, answers: readonly (string | null | undefined)[]): { ok: boolean; per: boolean[] } {
  const per = task.blanks.map((b, i) => normAnswer(answers[i] ?? "") === normAnswer(b));
  return { ok: per.every(Boolean), per };
}
/** Number of gaps referenced by a fill text (`{0}`, `{1}`…). */
export function fillSlots(text: string): number[] {
  return [...text.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]!);
}
/** order: `order` = indexes of `items` in the user's arrangement. */
export function checkOrder(task: Pick<OrderTask, "items">, order: readonly number[]): { ok: boolean; per: boolean[] } {
  const per = task.items.map((_, i) => order[i] === i);
  return { ok: per.every(Boolean) && order.length === task.items.length, per };
}
/** A shuffled start position for order/timeline that is never already solved. */
export function shuffledOrder(n: number, rand: () => number = Math.random): number[] {
  let order = shuffle(Array.from({ length: n }, (_, i) => i), rand);
  if (n > 1 && order.every((v, i) => v === i)) order = order.slice(1).concat(order[0]!);
  return order;
}
/** sort: `placement[item] = bucket index`. */
export function checkSort(task: Pick<SortTask, "buckets">, placement: Readonly<Record<string, number>>): { ok: boolean; wrong: string[] } {
  const wrong: string[] = [];
  task.buckets.forEach((b, bi) => b.items.forEach((it) => { if (placement[it] !== bi) wrong.push(it); }));
  return { ok: wrong.length === 0, wrong };
}
/** timeline: `order` = event indexes as pinned top→bottom; equal years are interchangeable. */
export function checkTimeline(task: Pick<TimelineTask, "events">, order: readonly number[]): { ok: boolean; per: boolean[] } {
  const years = [...task.events].map((e) => e.year).sort((a, b) => a - b);
  const per = years.map((y, i) => order[i] != null && task.events[order[i]!]?.year === y);
  return { ok: per.every(Boolean) && order.length === years.length, per };
}
/** chain: `filled[slotIndex] = text` for the slots not in `given`. */
export function checkChain(task: Pick<ChainTask, "steps" | "given">, filled: Readonly<Record<number, string | null | undefined>>): { ok: boolean; per: boolean[] } {
  const per = task.steps.map((s, i) => task.given.includes(i) || normAnswer(filled[i] ?? "") === normAnswer(s));
  return { ok: per.every(Boolean), per };
}
/** tf: all statements must be right. */
export function checkTf(task: Pick<TfTask, "statements">, answers: readonly (boolean | null | undefined)[]): { ok: boolean; wrong: number[] } {
  const wrong: number[] = [];
  task.statements.forEach((s, i) => { if (answers[i] !== s.v) wrong.push(i); });
  return { ok: wrong.length === 0, wrong };
}
/** swipe: all cards on the right side. */
export function checkSwipe(task: Pick<SwipeTask, "cards">, sides: readonly ("left" | "right" | null | undefined)[]): { ok: boolean; wrong: number[] } {
  const wrong: number[] = [];
  task.cards.forEach((c, i) => { if (sides[i] !== c.side) wrong.push(i); });
  return { ok: wrong.length === 0, wrong };
}
/** match: solved when every pair is joined; mistakes along the way = one "wrong". */
export function checkMatch(_task: Pick<MatchTask, "pairs">, mistakes: number): boolean {
  return mistakes === 0;
}
/** hotspot: tap (x,y in % of the image) hits target `t` when inside its radius (r in % of width, aspect = h/w). */
export function hotspotHit(t: HotspotTask["targets"][number], x: number, y: number, aspect = 1): boolean {
  const dx = x - t.x, dy = (y - t.y) * aspect;
  return Math.hypot(dx, dy) <= t.r;
}
/** mathsteps: passed only with zero mistakes. */
export function checkMathSteps(_task: Pick<MathStepsTask, "steps">, mistakes: number): boolean {
  return mistakes === 0;
}

/** Shuffled bank for fill (blanks + distractors) — legacy mixes them once at the start. */
export function fillBank(task: Pick<FillTask, "blanks" | "bank">, rand: () => number = Math.random): string[] {
  return shuffle([...task.blanks, ...task.bank], rand);
}
/** Shuffled bank for chain: missing steps + distractors. */
export function chainBank(task: Pick<ChainTask, "steps" | "given" | "bank">, rand: () => number = Math.random): string[] {
  return shuffle([...task.steps.filter((_, i) => !task.given.includes(i)), ...task.bank], rand);
}

/** Polish "Zostało N" / "Zostały N" (legacy leftText). */
export function leftText(n: number): string {
  return `${n >= 2 && n <= 4 ? "Zostały" : "Zostało"} ${n}`;
}

function dedupe(a: string[]): string[] {
  return [...new Set(a.map((s) => s.trim()).filter(Boolean))];
}

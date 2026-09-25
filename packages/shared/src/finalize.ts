import { TopicContentSchema, TaskSchema, type GeneratedTopic, type GenGame, type GenTask } from "./schema.js";
import type { MiniGame, QuizQuestion, Task, TaskSource, TopicContent, Stage } from "./types.js";

import { subjectHue } from "./theme.js";
import { shuffleAnswers } from "./quiz-quality.js";

/**
 * Subject/topic palette: [accent, accent2].
 * accent  = duotone of the hue for headers/tiles, accent2 = the hue itself (one of SUBJECT_HUES) for rings, progress, active states.
 */
export function paletteFor(seed: string): [string, string] {
  const h = subjectHue(seed);
  return [`linear-gradient(135deg, ${h.color} 0%, ${h.deep} 100%)`, h.color];
}

export const DEFAULT_GRADING: TopicContent["grading"] = {
  pass: 50,
  examMin: 20,
  scale: [
    [90, "5"],
    [80, "4,5"],
    [70, "4"],
    [60, "3,5"],
    [50, "3"],
  ],
  failLabel: "2 — niezaliczone",
};

const GRADING_BY_STAGE: Record<Stage, TopicContent["grading"]> = {
  podstawowa: { pass: 50, examMin: 15, scale: [[95, "6"], [85, "5"], [70, "4"], [50, "3"], [30, "2"]], failLabel: "1 — spróbuj jeszcze raz" },
  liceum: { pass: 50, examMin: 20, scale: [[95, "6"], [85, "5"], [70, "4"], [50, "3"], [30, "2"]], failLabel: "1 — spróbuj jeszcze raz" },
  studia: DEFAULT_GRADING,
  inne: { pass: 60, examMin: 20, scale: [[90, "🏆 mistrz"], [75, "💪 solidnie"], [60, "✅ zaliczone"]], failLabel: "❌ jeszcze nie" },
};

function convertGame(g: GenGame): MiniGame | null {
  const title = g.title || undefined;
  switch (g.type) {
    case "match":
      return g.pairs.length >= 3 ? { type: "match", title, pairs: g.pairs.slice(0, 10) } : null;
    case "cloze":
      return g.cloze.length >= 2
        ? { type: "cloze", title, items: g.cloze.slice(0, 12).map((i) => ({ s: i.s, answer: i.answer, options: dedupe([i.answer, ...i.options]).slice(0, 5), e: i.e || undefined })) }
        : null;
    case "truefalse":
      return g.tf.length >= 3 ? { type: "truefalse", title, items: g.tf.slice(0, 15).map((i) => ({ s: i.s, v: i.v, e: i.e || undefined })) } : null;
    case "order":
      return g.steps.length >= 3 && g.prompt ? { type: "order", title, prompt: g.prompt, steps: g.steps.slice(0, 8) } : null;
  }
}

function dedupe(a: string[]): string[] {
  return [...new Set(a.map((s) => s.trim()).filter(Boolean))];
}
const clean = (a: string[]) => a.map((s) => (s ?? "").trim()).filter(Boolean);
const opt = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

/** Build a `src` from the flat AI fields (+ the material id the API knows). */
export function sourceFrom(src_quote: string | undefined, src_page: number | undefined, materialId?: string): TaskSource | undefined {
  const quote = opt(src_quote);
  const page = typeof src_page === "number" && src_page > 0 ? Math.floor(src_page) : undefined;
  if (!quote && page == null && !materialId) return undefined;
  const src: TaskSource = {};
  if (materialId) src.material = materialId;
  if (page != null) src.page = page;
  if (quote) src.quote = quote.slice(0, 600);
  return src;
}

/** An all-empty GenTask (every field present) — fixtures and demo fill only what they need. */
export function blankGenTask(partial: Partial<GenTask> & { type: GenTask["type"] }): GenTask {
  return {
    title: "", e: "",
    pairs: [], text: "", blanks: [], bank: [], hint: "", items: [], buckets: [], seconds: 0, statements: [], events: [],
    sentences: [], wrong: 0, fix: "", thesis: "", options: [], scene: "", q: "", a: [], c: 0, steps: [], given: [],
    left: "", right: "", cards: [], definition: "", answer: "", accept: [], src_page: 0, src_quote: "",
    ...partial,
  };
}

/**
 * Flat AI task → valid `Task` (validated with TaskSchema) or null. Tolerant: trims, drops empty strings, accepts
 * `___` gaps in fill text, dedupes banks, clamps sizes.
 */
export function convertTask(g: GenTask, materialId?: string): Task | null {
  const base = { title: opt(g.title), e: opt(g.e), src: sourceFrom(g.src_quote, g.src_page, materialId) };
  let t: Task | null = null;
  switch (g.type) {
    case "match": {
      const pairs = g.pairs.filter((p) => p.l?.trim() && p.r?.trim()).slice(0, 10).map((p) => [p.l.trim(), p.r.trim()] as [string, string]);
      t = { type: "match", ...base, pairs };
      break;
    }
    case "fill": {
      let text = (g.text ?? "").trim();
      const blanks = clean(g.blanks).slice(0, 6);
      if (!/\{\d+\}/.test(text) && text.includes("___")) {
        let k = 0;
        text = text.replace(/_{2,}/g, () => `{${k++}}`);
      }
      const bank = dedupe(clean(g.bank)).filter((b) => !blanks.some((x) => x.toLowerCase() === b.toLowerCase())).slice(0, 10);
      t = { type: "fill", ...base, text, blanks, bank, hint: opt(g.hint) };
      break;
    }
    case "order":
      t = { type: "order", ...base, items: clean(g.items.length ? g.items : g.steps).slice(0, 8) };
      break;
    case "sort":
      t = { type: "sort", ...base, buckets: g.buckets.map((b) => ({ name: (b.name ?? "").trim(), items: clean(b.items).slice(0, 8) })).filter((b) => b.name && b.items.length).slice(0, 4) };
      break;
    case "tf":
      t = {
        type: "tf",
        ...base,
        seconds: g.seconds >= 10 ? Math.min(600, Math.round(g.seconds)) : undefined,
        statements: g.statements.filter((s) => s.s?.trim()).slice(0, 15).map((s) => ({ s: s.s.trim(), v: !!s.v, e: opt(s.e) })),
      };
      break;
    case "timeline":
      t = { type: "timeline", ...base, events: g.events.filter((e) => e.label?.trim() && Number.isFinite(e.year)).slice(0, 8).map((e) => ({ label: e.label.trim(), year: e.year })) };
      break;
    case "finderror":
      t = { type: "finderror", ...base, sentences: clean(g.sentences).slice(0, 6), wrong: g.wrong, fix: (g.fix ?? "").trim() };
      break;
    case "thesis":
      t = {
        type: "thesis",
        ...base,
        thesis: (g.thesis ?? "").trim(),
        q: opt(g.q),
        options: g.options.filter((o) => o.name?.trim()).slice(0, 6).map((o) => ({ name: o.name.trim(), sub: opt(o.sub) })),
        c: g.c,
      };
      break;
    case "chain": {
      const steps = clean(g.steps).slice(0, 8);
      const given = [...new Set(g.given.filter((i) => Number.isInteger(i) && i >= 0 && i < steps.length))];
      t = { type: "chain", ...base, steps, given: given.length ? given : steps.length ? [0] : [], bank: dedupe(clean(g.bank)).filter((b) => !steps.some((s) => s.toLowerCase() === b.toLowerCase())).slice(0, 8) };
      break;
    }
    case "scenario":
      t = { type: "scenario", ...base, scene: (g.scene ?? "").trim(), q: (g.q ?? "").trim(), a: g.a.map((s) => (s ?? "").trim()).slice(0, 5), c: g.c };
      if (t.a.some((s) => !s)) return null;
      break;
    case "swipe":
      t = {
        type: "swipe",
        ...base,
        left: (g.left ?? "").trim(),
        right: (g.right ?? "").trim(),
        cards: g.cards.filter((c) => c.front?.trim() && (c.side === "left" || c.side === "right")).slice(0, 12).map((c) => ({ front: c.front.trim(), sub: opt(c.sub), side: c.side, e: opt(c.e) })),
      };
      break;
    case "typeterm":
      t = { type: "typeterm", ...base, definition: (g.definition ?? "").trim(), answer: (g.answer ?? "").trim(), accept: clean(g.accept).slice(0, 8), typo: 1 };
      if (!t.accept!.length) delete t.accept;
      break;
    default:
      return null;
  }
  const r = TaskSchema.safeParse(t);
  return r.success ? (r.data as Task) : null;
}

export interface FinalizeOptions {
  lang?: boolean;
  /** stamp every `src` with this materials row id (materials mode) */
  materialId?: string;
}

/**
 * Turn raw AI output into a valid TopicContent: assign level ids, palette, grading; drop invalid items
 * instead of failing the whole generation. Keeps `games` and adds `tasks` (2.0).
 */
export function finalizeGenerated(gen: GeneratedTopic, stage: Stage, opts: FinalizeOptions = {}): TopicContent {
  const [accent, accent2] = paletteFor(gen.name);
  const levels = gen.levels
    .map((l, i) => {
      const tasks = (l.tasks ?? []).map((t) => convertTask(t, opts.materialId)).filter((t): t is Task => t !== null).slice(0, 20);
      return {
        id: `l${i + 1}`,
        title: l.title.trim() || `Poziom ${i + 1}`,
        emoji: l.emoji || "📘",
        summary: l.summary || undefined,
        feed: l.feed
          .filter((f) => f.title && f.body)
          .map((f) => ({ title: f.title, body: f.body, real: f.real || undefined, mnemo: f.mnemo || undefined })),
        flashcards: l.flashcards.filter((c) => c.t && c.d),
        quiz: l.quiz
          .filter((q) => q.q && q.a.length >= 2 && q.c >= 0 && q.c < q.a.length && q.e)
          .map((q) => {
            const src = sourceFrom(q.src_quote, q.src_page, opts.materialId);
            const base: QuizQuestion = { q: q.q, a: q.a.slice(0, 5), c: Math.min(q.c, 4), e: q.e };
            if (src) base.src = src;
            return shuffleAnswers(base);
          }),
        games: l.games.map(convertGame).filter((g): g is MiniGame => g !== null),
        ...(tasks.length ? { tasks } : {}),
      };
    })
    .filter((l) => l.quiz.length > 0 || l.flashcards.length > 0 || l.feed.length > 0);

  const content: TopicContent = {
    name: gen.name.trim() || "Nowy przedmiot",
    short: (gen.short || gen.name).trim().slice(0, 30) || "Przedmiot",
    emoji: gen.emoji || "📘",
    tagline: gen.tagline || "",
    accent,
    accent2,
    lang: opts.lang || undefined,
    grading: GRADING_BY_STAGE[stage],
    info: gen.info_html || "",
    levels: levels.length ? levels : [{ id: "l1", title: "Poziom 1", emoji: "📘", feed: [], flashcards: [], quiz: [], games: [] }],
  };
  return TopicContentSchema.parse(content) as TopicContent;
}

/** Flatten helpers shared by both UIs. */
export function allFlashcards(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => l.flashcards.map((c, i) => ({ ...c, lvl: l.title, levelId: l.id, index: i })));
}
/** Every quiz question of a topic, with answer positions re-shuffled for this call (anti-guessing). */
export function allQuiz(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => l.quiz.map((q, qi) => ({ ...shuffleAnswers(q), lvl: l.title, levelId: l.id, qi })));
}
export function allGames(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => (l.games ?? []).map((g) => ({ ...g, lvl: l.title, levelId: l.id })));
}

/** Deterministic shuffle helper (Fisher–Yates) so both UIs behave identically. */
export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pick exam questions: up to `n` random across levels. */
export function pickExam(s: Pick<TopicContent, "levels">, n = 20) {
  return shuffle(allQuiz(s)).slice(0, n);
}

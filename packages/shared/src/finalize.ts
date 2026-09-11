import { TopicContentSchema, type GeneratedTopic } from "./schema.js";
import type { MiniGame, TopicContent, Stage } from "./types.js";

const PALETTES: [string, string][] = [
  ["linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)", "#22d3ee"],
  ["linear-gradient(135deg,#f59e0b,#ef4444,#ec4899)", "#f59e0b"],
  ["linear-gradient(135deg,#10b981,#06b6d4,#3b82f6)", "#10b981"],
  ["linear-gradient(135deg,#1e3a8a,#3b82f6,#06b6d4)", "#3b82f6"],
  ["linear-gradient(135deg,#7c3aed,#c026d3,#f43f5e)", "#c026d3"],
  ["linear-gradient(135deg,#0ea5e9,#22c55e,#eab308)", "#22c55e"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteFor(seed: string): [string, string] {
  return PALETTES[hash(seed) % PALETTES.length]!;
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

function convertGame(g: GeneratedTopic["levels"][number]["games"][number]): MiniGame | null {
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

/**
 * Turn raw AI output into a valid TopicContent: assign level ids, palette, grading; drop invalid items
 * instead of failing the whole generation.
 */
export function finalizeGenerated(gen: GeneratedTopic, stage: Stage, opts: { lang?: boolean } = {}): TopicContent {
  const [accent, accent2] = paletteFor(gen.name);
  const levels = gen.levels
    .map((l, i) => ({
      id: `l${i + 1}`,
      title: l.title.trim() || `Poziom ${i + 1}`,
      emoji: l.emoji || "📘",
      summary: l.summary || undefined,
      feed: l.feed
        .filter((f) => f.title && f.body)
        .map((f) => ({ title: f.title, body: f.body, real: f.real || undefined, mnemo: f.mnemo || undefined })),
      flashcards: l.flashcards.filter((c) => c.t && c.d),
      quiz: l.quiz.filter((q) => q.q && q.a.length >= 2 && q.c >= 0 && q.c < q.a.length && q.e).map((q) => ({ ...q, a: q.a.slice(0, 5) })),
      games: l.games.map(convertGame).filter((g): g is MiniGame => g !== null),
    }))
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
  return TopicContentSchema.parse(content);
}

/** Flatten helpers shared by both UIs. */
export function allFlashcards(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => l.flashcards.map((c, i) => ({ ...c, lvl: l.title, levelId: l.id, index: i })));
}
export function allQuiz(s: Pick<TopicContent, "levels">) {
  return s.levels.flatMap((l) => l.quiz.map((q) => ({ ...q, lvl: l.title, levelId: l.id })));
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

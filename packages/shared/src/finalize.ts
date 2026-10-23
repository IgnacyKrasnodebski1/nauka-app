import { z } from "zod";
import { GenTaskSchema, KeyPointSchema, KEY_POINT_LIMITS, TopicContentSchema, TaskSchema, VizSchema, VIZ_LIMITS, type GeneratedTopic, type GenFeed, type GenGame, type GenPoint, type GenTask } from "./schema.js";
import { VIZ_TYPES, type FeedItem, type KeyPoint, type KeyPointItem, type MiniGame, type QuizQuestion, type Task, type TaskSource, type TopicContent, type Stage, type Viz, type VizType } from "./types.js";
import { plainText } from "./review.js";

import { subjectHue } from "./theme.js";
import { contentStems, resolveOptionLetters, shuffleAnswers, tidyPunctuation } from "./quiz-quality.js";

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
/** Expand the compact AI task (payload JSON) into the flat GenTask; null when the payload is not JSON. */
export function expandGenTask(c: { type: GenTask["type"]; title: string; e: string; payload: string; src_page?: number; src_quote?: string; p?: string }): GenTask | null {
  let data: Record<string, unknown> = {};
  try {
    const parsed = c.payload?.trim() ? JSON.parse(c.payload) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const blank = blankGenTask({ type: c.type });
  const out: Record<string, unknown> = { ...blank, title: c.title, e: c.e, src_page: c.src_page ?? 0, src_quote: c.src_quote ?? "" };
  // key point tag (plan-media §2.1): carried from the compact task, never read from the payload
  if (typeof c.p === "string") out.p = c.p;
  for (const k of Object.keys(blank)) {
    if (k in data && data[k] != null && typeof data[k] === typeof (blank as Record<string, unknown>)[k] && Array.isArray(data[k]) === Array.isArray((blank as Record<string, unknown>)[k])) out[k] = data[k];
  }
  const res = GenTaskSchema.safeParse(out);
  return res.success ? res.data : null;
}

/** Leading enumerator of an order item ("R0 ", "1. ", "Etap 2:", "B)") — it gives the order away. */
const ENUMERATOR = /^\s*(?:(?:etap|krok|faza|step)\s*\d+|[A-Z]?\d{1,2}|[A-Ha-h])\s*(?:[.):\-–—]\s*|\s+)(?=\S)/iu;

/**
 * Order items that all start with an enumerator ("R0 Refuse", "R3 Reuse"…) are solvable by sorting the numbers:
 * strip the enumerators. null = an item would be left empty (the task is dropped).
 */
export function stripOrderEnumerators(items: string[]): string[] | null {
  if (items.length < 2 || !items.every((x) => ENUMERATOR.test(x))) return items;
  const out = items.map((x) => x.replace(ENUMERATOR, "").trim());
  return out.every(Boolean) ? out : null;
}

/** Card / statement explanation too short to say why ("Model nordycki.", "To wymóg minimalny.") — better none than an empty line. */
const thinNote = (e: string | undefined) => (e && contentStems(e).length >= 3 ? e : undefined);

/** A swipe card's `sub` that names a category ("Szwecja" / "model nordycki" for the bucket "Model nordycki") gives the answer away. */
function subNamesCategory(sub: string | undefined, categories: string[]): boolean {
  if (!sub) return false;
  const st = new Set(contentStems(sub).filter((w) => w.length >= 4));
  return categories.some((c) => {
    const cs = contentStems(c).filter((w) => w.length >= 4);
    return cs.length > 0 && cs.every((w) => st.has(w));
  });
}

export function convertTask(g: GenTask, materialId?: string): Task | null {
  const base = { title: opt(g.title), e: opt(g.e) ? tidyPunctuation(g.e.trim()) : undefined, src: sourceFrom(g.src_quote, g.src_page, materialId) };
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
    case "order": {
      const items = stripOrderEnumerators(clean(g.items.length ? g.items : g.steps).slice(0, 8));
      if (!items) return null;
      t = { type: "order", ...base, items };
      break;
    }
    case "sort":
      t = { type: "sort", ...base, buckets: g.buckets.map((b) => ({ name: (b.name ?? "").trim(), items: clean(b.items).slice(0, 8) })).filter((b) => b.name && b.items.length).slice(0, 4) };
      break;
    case "tf":
      t = {
        type: "tf",
        ...base,
        seconds: g.seconds >= 10 ? Math.min(600, Math.round(g.seconds)) : undefined,
        statements: g.statements.filter((s) => s.s?.trim()).slice(0, 15).map((s) => ({ s: s.s.trim(), v: !!s.v, e: thinNote(opt(s.e)) })),
      };
      break;
    case "timeline":
      t = { type: "timeline", ...base, events: g.events.filter((e) => e.label?.trim() && Number.isFinite(e.year)).slice(0, 8).map((e) => ({ label: e.label.trim(), year: e.year })) };
      break;
    case "finderror":
      t = { type: "finderror", ...base, sentences: clean(g.sentences).slice(0, 6), wrong: g.wrong, fix: (g.fix ?? "").trim() };
      break;
    case "thesis": {
      const thesis = (g.thesis ?? "").trim();
      let options: { name: string; sub?: string }[] = g.options.filter((o) => o.name?.trim()).slice(0, 6).map((o) => ({ name: o.name.trim(), sub: opt(o.sub) }));
      // the correct option's sub restating the thesis ("małe państwo, deregulacja" for "Państwo ma być jak najmniejsze") is a giveaway: drop every sub
      const tst = new Set(contentStems(thesis));
      const echo = (sub: string | undefined) => (sub ? contentStems(sub).filter((w) => tst.has(w)).length : 0);
      if (options[g.c] && echo(options[g.c]!.sub) >= 1 && options.every((o, i) => i === g.c || echo(o.sub) === 0)) options = options.map((o) => ({ name: o.name }));
      t = { type: "thesis", ...base, thesis, q: opt(g.q), options, c: g.c };
      break;
    }
    case "chain": {
      const steps = clean(g.steps).slice(0, 8);
      const given = [...new Set(g.given.filter((i) => Number.isInteger(i) && i >= 0 && i < steps.length))];
      t = { type: "chain", ...base, steps, given: given.length ? given : steps.length ? [0] : [], bank: dedupe(clean(g.bank)).filter((b) => !steps.some((s) => s.toLowerCase() === b.toLowerCase())).slice(0, 8) };
      break;
    }
    case "scenario":
      t = { type: "scenario", ...base, scene: (g.scene ?? "").trim(), q: (g.q ?? "").trim(), a: g.a.map((s) => (s ?? "").trim()).slice(0, 5), c: g.c };
      if (t.a.some((s) => !s)) return null;
      if (t.e) t.e = resolveOptionLetters(t.e, t.a);
      break;
    case "swipe": {
      const left = (g.left ?? "").trim();
      const right = (g.right ?? "").trim();
      t = {
        type: "swipe",
        ...base,
        left,
        right,
        cards: g.cards
          .filter((c) => c.front?.trim() && (c.side === "left" || c.side === "right"))
          .slice(0, 12)
          .map((c) => ({ front: c.front.trim(), sub: subNamesCategory(opt(c.sub), [left, right]) ? undefined : opt(c.sub), side: c.side, e: thinNote(opt(c.e)) })),
      };
      break;
    }
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

/* ---------------- dose visuals: parse, sanitize, ground, cap ---------------- */

/** Why visuals were dropped while finalizing (generation quality stats). */
export interface VizDropStats {
  /** not JSON / not an object / unknown type / wrong shape or counts / bad numbers */
  schema: number;
  /** labels not found in the level, or numbers / dates not in the dose's body or real */
  grounding: number;
  /** over the per-level cap of ceil(feed / 2) */
  cap: number;
}

export type ParseVizResult = { viz: Viz; drop?: undefined } | { viz?: undefined; drop?: "schema" | "grounding" };

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

/** Plain, single-line, length-capped viz string ("" when not a string/number). Tags and stray brackets removed. */
function vtext(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return "";
  let t = plainText(v).replace(/[<>]/g, "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  // cut by code points: a cut through a surrogate pair would leave a lone surrogate, which jsonb rejects
  if (t.length > max) t = `${[...t].slice(0, max - 1).join("").slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "").trimEnd()}…`;
  return t;
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** Bars value: a finite number ≥ 0 (a numeric string such as "12,5" is accepted); anything else → NaN (fails the schema). */
function vnum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(",", "."));
  return NaN;
}

/** Keep only the known fields of the branch, as plain truncated strings (arrays above the max count are cut). */
function shapeViz(type: VizType, d: Record<string, unknown>): Record<string, unknown> {
  const L = VIZ_LIMITS;
  const caption = vtext(d.caption, L.caption) || undefined;
  const list = (v: unknown, max: number, n: number) => arr(v).slice(0, n).map((x) => vtext(x, max));
  switch (type) {
    case "timeline":
      return { type, caption, items: arr(d.items).slice(0, 7).map((x) => ({ when: vtext(rec(x).when, L.timeline.when), label: vtext(rec(x).label, L.timeline.label) })) };
    case "compare":
      return {
        type,
        caption,
        a: vtext(d.a, L.compare.a),
        b: vtext(d.b, L.compare.b),
        rows: arr(d.rows).slice(0, 5).map((x) => ({ k: vtext(rec(x).k, L.compare.k), a: vtext(rec(x).a, L.compare.cell), b: vtext(rec(x).b, L.compare.cell) })),
      };
    case "cycle":
      return { type, caption, steps: list(d.steps, L.step, 6) };
    case "flow":
      return { type, caption, kind: d.kind === "cause" ? "cause" : "process", steps: list(d.steps, L.step, 6) };
    case "tree":
      return {
        type,
        caption,
        root: vtext(d.root, L.tree.root),
        groups: arr(d.groups).slice(0, 4).map((x) => ({ name: vtext(rec(x).name, L.tree.name), items: list(rec(x).items, L.tree.item, 5) })),
      };
    case "bars":
      return { type, caption, unit: vtext(d.unit, L.bars.unit), items: arr(d.items).slice(0, 7).map((x) => ({ label: vtext(rec(x).label, L.bars.label), value: vnum(rec(x).value) })) };
    case "numbers":
      return { type, caption, items: arr(d.items).slice(0, 4).map((x) => ({ value: vtext(rec(x).value, L.numbers.value), label: vtext(rec(x).label, L.numbers.label) })) };
  }
}

/** Text strings of a visual that must be grounded in the level (data numbers are checked separately). */
function vizLabels(v: Viz): string[] {
  const out: string[] = v.caption ? [v.caption] : [];
  switch (v.type) {
    case "timeline":
      return [...out, ...v.items.map((i) => i.label)];
    case "compare":
      return [...out, v.a, v.b, ...v.rows.flatMap((r) => [r.k, r.a, r.b])];
    case "cycle":
    case "flow":
      return [...out, ...v.steps];
    case "tree":
      return [...out, v.root, ...v.groups.flatMap((g) => [g.name, ...g.items])];
    case "bars":
      return [...out, ...v.items.map((i) => i.label)];
    case "numbers":
      return [...out, ...v.items.map((i) => i.label)];
  }
}

/** Data fields whose numbers must appear in THIS dose's body or real: dates, key numbers, bar values. */
function vizData(v: Viz): string[] {
  switch (v.type) {
    case "timeline":
      return v.items.map((i) => i.when);
    case "numbers":
      return v.items.map((i) => i.value);
    case "bars":
      return v.items.map((i) => String(i.value));
    default:
      return [];
  }
}

const normText = (s: string) =>
  plainText(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u00a0\u2007\u202f]/g, " ");

/** Generic cell values of a comparison ("tak", "brak"…): grounded by themselves, like "nie" and "—". */
const NEUTRAL = ["tak", "brak", "yes", "none", "nic", "żaden", "żadna", "żadne"];
const STOP = new Set([...NEUTRAL, "oraz", "albo", "lub", "czyli", "przez", "przy", "jest", "się", "dla", "nie", "jak", "the", "and", "with", "from", "that", "this", "jego", "jej", "ich", "który", "która", "które", "tego", "tym", "ten", "też", "także", "pod", "nad", "bez", "między"]);
/** Word stems (first 4 letters — a rough cut through Polish inflection: król/króla, władza/władzą) of words with 3+ letters. */
function stems(s: string): string[] {
  return (normText(s).match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)).map((w) => w.slice(0, 4));
}

const SCALE: [RegExp, number][] = [
  [/^\s*(?:tys\.?|tysi[ęe]c\p{L}*|k\b)/u, 1e3],
  [/^\s*(?:mln\.?|milion\p{L}*)/u, 1e6],
  [/^\s*(?:mld\.?|miliard\p{L}*)/u, 1e9],
];
/** A number; the thousands group must end the digit run ("3 1789" is 3 and 1789, not 3178 and 9). */
const NUM = /(?<![\p{L}\d.,])(\d{1,3}(?: \d{3})+(?!\d)|\d+)(?:[.,](\d+))?/gu;
/** "14.07.1789" → "14/07/1789" in the haystack (a separator that cannot glue the parts into one number); in the needle (`yearOnly`) only the year has to match. */
const DOTTED_DATE = /\b(\d{1,2})\.(\d{1,2})\.(\d{3,4})\b/g;

/**
 * Number tokens of a text, each with its alternative readings: "1 000" / "1000" → 1000; "12,5" → 12.5;
 * "1.500" → 1.5 | 1500; "3 tys." → 3 | 3000; "21%" → 21. Digits glued to a letter on the left (CO2, H2O) are not numbers.
 */
function numberTokens(s: string, yearOnly = false): number[][] {
  const t = normText(s).replace(DOTTED_DATE, (_, d, m, y) => (yearOnly ? y : `${d}/${m}/${y}`));
  const out: number[][] = [];
  for (const m of t.matchAll(NUM)) {
    const int = m[1]!.replace(/ /g, "");
    const frac = m[2];
    const alts = [Number(frac ? `${int}.${frac}` : int)];
    if (frac && frac.length === 3) alts.push(Number(int + frac));
    const scale = SCALE.find(([r]) => r.test(t.slice((m.index ?? 0) + m[0].length)))?.[1];
    if (scale) for (const a of [...alts]) alts.push(Math.round(a * scale * 1000) / 1000);
    out.push(alts.filter(Number.isFinite));
  }
  return out;
}
function numberSet(s: string): Set<number> {
  return new Set(numberTokens(s).flat());
}
/** Every number token of `needle` has at least one reading in `hay`. */
function numbersCovered(needle: string, hay: Set<number>): boolean {
  return numberTokens(needle, true).every((alts) => alts.some((n) => hay.has(n)));
}

export interface VizGroundingContext {
  /** plain text of the whole level (every dose, flashcards, quiz) — labels must come from here */
  levelText: string;
  /** body + real of THIS dose — numbers and dates must come from here */
  doseText: string;
}

/** Plain text a visual is grounded against: every dose's title/body/real/mnemo, flashcards t/d, quiz q/a/e. */
export function levelTextForViz(l: { feed: { title: string; body: string; real?: string; mnemo?: string }[]; flashcards: { t: string; d: string }[]; quiz: { q: string; a: string[]; e: string }[] }): string {
  return [
    ...l.feed.flatMap((f) => [f.title, f.body, f.real ?? "", f.mnemo ?? ""]),
    ...l.flashcards.flatMap((c) => [c.t, c.d]),
    ...l.quiz.flatMap((q) => [q.q, ...q.a, q.e]),
  ].join("\n");
}

/**
 * Turn the model's `viz_type` + `viz` (JSON string, branch fields without `type`) into a stored `Viz`, or report why
 * it was dropped. Never throws. Order: JSON.parse → keep known fields, strip tags/emoji, truncate strings and cut
 * over-long arrays → VizSchema → grounding:
 *  - at least 3 of every 4 label strings share a word stem with the whole level's text (strings without words pass);
 *  - every number in the data fields (timeline.when, numbers.value, bars values) appears in this dose's body/real;
 *    numbers inside labels must appear there too, except small integers (0–10), which may come from anywhere in the level.
 */
export function parseViz(type: string | undefined, raw: string | undefined, ctx: VizGroundingContext): ParseVizResult {
  try {
    if (!type || type === "none") return {};
    if (!(VIZ_TYPES as readonly string[]).includes(type)) return { drop: "schema" };
    let data: unknown;
    try {
      data = JSON.parse(raw ?? "");
    } catch {
      return { drop: "schema" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { drop: "schema" };
    const shaped = shapeViz(type as VizType, data as Record<string, unknown>);
    if (shaped.caption === undefined) delete shaped.caption;
    const res = VizSchema.safeParse(shaped);
    if (!res.success) return { drop: "schema" };
    const viz = res.data as Viz;
    if (viz.type === "bars" && viz.items.every((i) => i.value === 0)) return { drop: "schema" };

    const levelStems = new Set(stems(ctx.levelText));
    // a 3-letter word is its own stem and would only match itself ("kot" vs "kota"): match it by prefix both ways
    const levelPrefix3 = new Set([...levelStems].map((x) => x.slice(0, 3)));
    const stemGrounded = (x: string) => levelStems.has(x) || (x.length === 3 && levelPrefix3.has(x)) || levelStems.has(x.slice(0, 3));
    const labels = vizLabels(viz);
    const grounded = labels.filter((l) => {
      const st = stems(l);
      return !st.length || st.some(stemGrounded);
    }).length;
    if (grounded * 4 < labels.length * 3) return { drop: "grounding" };

    const doseNums = numberSet(ctx.doseText);
    if (!vizData(viz).every((d) => numbersCovered(d, doseNums))) return { drop: "grounding" };
    const levelNums = numberSet(ctx.levelText);
    const smallInLevel = (n: number) => Number.isInteger(n) && n <= 10 && levelNums.has(n);
    for (const l of labels) {
      if (!numberTokens(l, true).every((alts) => alts.some((n) => doseNums.has(n) || smallInLevel(n)))) return { drop: "grounding" };
    }
    return { viz };
  } catch {
    return { drop: "schema" };
  }
}

/** Short plain-text rendering of a visual (fallback for text-only views, recap, tutor context). */
export function vizText(v: Viz): string {
  const cap = v.caption ? `${v.caption}: ` : "";
  switch (v.type) {
    case "timeline":
      return cap + v.items.map((i) => `${i.when} — ${i.label}`).join("; ");
    case "compare":
      return cap + `${v.a} / ${v.b}: ` + v.rows.map((r) => `${r.k}: ${r.a} / ${r.b}`).join("; ");
    case "cycle":
      return cap + [...v.steps, v.steps[0]].join(" → ");
    case "flow":
      return cap + v.steps.join(" → ");
    case "tree":
      return cap + `${v.root}: ` + v.groups.map((g) => `${g.name} (${g.items.join(", ")})`).join("; ");
    case "bars":
      return cap + v.items.map((i) => `${i.label}: ${i.value}${v.unit ? ` ${v.unit}` : ""}`).join("; ");
    case "numbers":
      return cap + v.items.map((i) => `${i.value} — ${i.label}`).join("; ");
  }
}

/**
 * "Po ludzku" line that only repeats the dose body (4+ content words, at least 80% of them already in the body) —
 * it should say the same thing in other words, so a copy adds nothing.
 */
export function realRepeatsBody(real: string, body: string): boolean {
  const r = contentStems(real);
  if (r.length < 4) return false;
  const b = new Set(contentStems(body));
  return r.filter((w) => b.has(w)).length >= r.length * 0.8;
}

/** Finalize one level's feed: copy dose fields explicitly, parse visuals, apply the ceil(feed / 2) cap. */
function finalizeFeed(feedIn: GenFeed[], levelText: string | null, stats: VizDropStats): FeedItem[] {
  const feed = feedIn.filter((f) => f.title && f.body);
  const cap = Math.ceil(feed.length / 2);
  let kept = 0;
  return feed.map((f) => {
    const real = f.real ? tidyPunctuation(f.real.trim()) : "";
    const item: FeedItem = { title: f.title, body: f.body, real: real && !realRepeatsBody(real, f.body) ? real : undefined, mnemo: f.mnemo || undefined };
    const r: ParseVizResult = levelText === null ? {} : parseViz(f.viz_type, f.viz, { levelText, doseText: `${f.body}\n${f.real ?? ""}` });
    if (r.drop) stats[r.drop]++;
    else if (r.viz) {
      if (kept < cap) {
        kept++;
        item.viz = r.viz;
      } else stats.cap++;
    }
    return item;
  });
}

/* ---------------- key points (docs/plan-media.md §1.1, §2.1) ---------------- */

/** How the key points of a generation came out (stored in `generations.quality.keyPoints`). */
export interface KeyPointStats {
  /** points stored in the topic (0 when omitted) */
  keyPoints: number;
  /** items whose `p` tag was missing or unknown and were assigned by the repair rules */
  repaired: number;
  /** points merged into another one (fewer than 3 items / 2 quiz + flashcard, or more than 15 points) */
  merged: number;
  /** outline points no item belongs to (dropped) */
  empty: number;
  /** true when the topic is stored without `keyPoints` (clients fall back to one point per level) */
  omitted: boolean;
  /** why `keyPoints` were omitted: `no_points` (outline had none) | `too_few` | `too_big` | `invalid` */
  reason?: string;
}

/** A key point as finalize gets it from the outline: texts + the ids of the levels it was planned for. */
export interface KeyPointDraft {
  key: string;
  title: string;
  short?: string;
  summary?: string;
  /** Level.id values the outline assigned the point to (used to place untagged items) */
  levels: string[];
}

/** One final level as `buildKeyPoints()` sees it: the `p` tag of every item, aligned with the level's FINAL arrays. */
export interface KeyPointLevel {
  id: string;
  title: string;
  flashcards: (string | undefined)[];
  quiz: (string | undefined)[];
  tasks: (string | undefined)[];
}

/** Most outline points the level prompts list; further ones are dropped (their items get repaired). */
export const MAX_OUTLINE_POINTS = 20;

const KIND_ORDER: Record<KeyPointItem["kind"], number> = { flashcard: 0, quiz: 1, task: 2 };
const tagKey = (t: unknown) => (typeof t === "string" ? t.trim().toLowerCase() : "");
const intsOf = (v: unknown) => arr(v).filter((n): n is number => typeof n === "number" && Number.isInteger(n));

/**
 * Outline `points` as the model wrote them → the points the level prompts list and finalize builds from. Texts become
 * plain single lines within the stored limits (no tags, no emoji); keys are unique (case-insensitive — a repeated key
 * only adds its levels to the first); level NUMBERS from 1 become 0-based indexes in range (a list that is plainly
 * 0-based — uses 0 and never the last level's number — is read as such); points without a title or a valid level are
 * dropped; at most MAX_OUTLINE_POINTS. Never throws; anything that is not an array → [].
 */
export function normalizeOutlinePoints(raw: unknown, levelCount: number): GenPoint[] {
  if (!Array.isArray(raw) || levelCount < 1) return [];
  const all = raw.flatMap((x) => intsOf(rec(x).levels));
  const zeroBased = all.includes(0) && !all.includes(levelCount);
  const out: GenPoint[] = [];
  const byKey = new Map<string, GenPoint>();
  raw.forEach((x, i) => {
    const r = rec(x);
    const title = vtext(r.title, KEY_POINT_LIMITS.title);
    if (!title) return;
    const levels = [...new Set(intsOf(r.levels).map((n) => (zeroBased ? n : n - 1)).filter((n) => n >= 0 && n < levelCount))].sort((a, b) => a - b);
    const key = (typeof r.key === "string" ? r.key.trim().slice(0, 40) : "") || `p${i + 1}`;
    const seen = byKey.get(key.toLowerCase());
    if (seen) {
      seen.levels = [...new Set([...seen.levels, ...levels])].sort((a, b) => a - b);
      return;
    }
    if (!levels.length || out.length >= MAX_OUTLINE_POINTS) return;
    const p: GenPoint = { key, title, levels };
    const short = vtext(r.short, KEY_POINT_LIMITS.short);
    const summary = vtext(r.summary, KEY_POINT_LIMITS.summary);
    if (short) p.short = short;
    if (summary) p.summary = summary;
    byKey.set(key.toLowerCase(), p);
    out.push(p);
  });
  return out;
}

type WorkItem = KeyPointItem & { li: number };
interface WorkPoint {
  key: string;
  title: string;
  short: string;
  summary?: string;
  /** level ids the outline planned the point for */
  declared: Set<string>;
  /** outline position (repair-created level points come after the outline's) */
  order: number;
  items: WorkItem[];
}

/**
 * Build `TopicContent.keyPoints` from the outline's points and the `p` tags of the FINAL items (after finalize's
 * filtering, so every index is final). Never throws; when the invariants cannot be met the topic simply has no
 * `keyPoints` (`stats.omitted`). Steps:
 *  1. every flashcard, question and task goes to the point its `p` names (key compared case-insensitively; "3" = "p3");
 *  2. repair of a missing / unknown `p`: the first outline point planned for that level, else the point with most
 *     items in that level, else a new point named after the level;
 *  3. points without items vanish; points are ordered by their first item (material order), outline order on ties;
 *  4. a point with < 3 items or < 2 quiz / flashcard is merged into the point with most items sharing a level (else
 *     its neighbour), smallest first; then, while there are more than 15, the smallest is merged into a neighbour
 *     (one sharing a level first, then the smaller one);
 *  5. 6–15 points (3–15 when the topic has < 18 quiz + flashcard items), ≤ 120 items each, ids `p1..pN` in order,
 *     checked with KeyPointSchema and `keyPointProblems()` — any failure → omitted.
 */
export function buildKeyPoints(drafts: KeyPointDraft[], levels: KeyPointLevel[]): { keyPoints?: KeyPoint[]; stats: KeyPointStats } {
  const stats: KeyPointStats = { keyPoints: 0, repaired: 0, merged: 0, empty: 0, omitted: true };
  const omit = (reason: string) => ({ stats: { ...stats, keyPoints: 0, omitted: true, reason } });
  try {
    const levelIds = new Set(levels.map((l) => l.id));
    const works: WorkPoint[] = [];
    const byKey = new Map<string, WorkPoint>();
    drafts.forEach((d, i) => {
      const title = vtext(d.title, KEY_POINT_LIMITS.title);
      const k = tagKey(d.key);
      if (!title || !k) return;
      const declared = arr(d.levels).filter((id): id is string => typeof id === "string" && levelIds.has(id));
      const seen = byKey.get(k);
      if (seen) {
        declared.forEach((id) => seen.declared.add(id));
        return;
      }
      const w: WorkPoint = { key: k, title, short: vtext(d.short, KEY_POINT_LIMITS.short) || vtext(title, KEY_POINT_LIMITS.short), declared: new Set(declared), order: i, items: [] };
      const summary = vtext(d.summary, KEY_POINT_LIMITS.summary);
      if (summary) w.summary = summary;
      byKey.set(k, w);
      works.push(w);
    });
    if (!works.length) return omit("no_points");

    // 1. tagged items
    const lookup = (tag: unknown): WorkPoint | undefined => {
      const t = tagKey(tag);
      if (!t) return undefined;
      return byKey.get(t) ?? (/^\d{1,2}$/.test(t) ? byKey.get(`p${Number(t)}`) : undefined);
    };
    const untagged: WorkItem[] = [];
    levels.forEach((l, li) => {
      const add = (kind: KeyPointItem["kind"], tags: (string | undefined)[]) =>
        tags.forEach((tag, index) => {
          const item: WorkItem = { kind, level: l.id, index, li };
          const w = lookup(tag);
          if (w) w.items.push(item);
          else untagged.push(item);
        });
      add("flashcard", l.flashcards);
      add("quiz", l.quiz);
      add("task", l.tasks);
    });

    // 2. repair
    const inLevel = (w: WorkPoint, id: string) => w.items.reduce((n, x) => n + (x.level === id ? 1 : 0), 0);
    for (const item of untagged) {
      let w = works.find((x) => x.declared.has(item.level));
      if (!w) {
        let best = 0;
        for (const x of works) {
          const n = inLevel(x, item.level);
          if (n > best) {
            best = n;
            w = x;
          }
        }
      }
      if (!w) {
        const l = levels[item.li]!;
        const title = vtext(l.title, KEY_POINT_LIMITS.title) || `Poziom ${item.li + 1}`;
        w = { key: `\u0000${l.id}`, title, short: vtext(title, KEY_POINT_LIMITS.short), declared: new Set([l.id]), order: drafts.length + item.li, items: [] };
        works.push(w);
      }
      w.items.push(item);
      stats.repaired++;
    }

    // 3. order
    stats.empty = works.filter((w) => !w.items.length).length;
    const live = works.filter((w) => w.items.length > 0);
    const sortItems = (w: WorkPoint) => w.items.sort((a, b) => a.li - b.li || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.index - b.index);
    const sortLive = () => live.sort((a, b) => a.items[0]!.li - b.items[0]!.li || a.order - b.order);
    live.forEach(sortItems);
    sortLive();
    const srs = (w: WorkPoint) => w.items.reduce((n, x) => n + (x.kind === "task" ? 0 : 1), 0);
    const shares = (a: WorkPoint, b: WorkPoint) => a.items.some((x) => b.items.some((y) => y.level === x.level));
    /** fewest items; on a tie the later one */
    const smallest = (pool: WorkPoint[]) => pool.reduce((a, b) => (b.items.length <= a.items.length ? b : a));
    const absorb = (target: WorkPoint, victim: WorkPoint) => {
      target.items.push(...victim.items);
      sortItems(target);
      live.splice(live.indexOf(victim), 1);
      sortLive();
      stats.merged++;
    };

    // 4a. too small → into the biggest point sharing a level, else the neighbour
    for (;;) {
      if (live.length < 2) break;
      const small = live.filter((w) => w.items.length < 3 || srs(w) < 2);
      if (!small.length) break;
      const victim = smallest(small);
      const sharing = live.filter((w) => w !== victim && shares(w, victim));
      const i = live.indexOf(victim);
      const target = sharing.length ? sharing.reduce((a, b) => (b.items.length > a.items.length ? b : a)) : (live[i + 1] ?? live[i - 1])!;
      absorb(target, victim);
    }
    // 4b. more than 15 → the smallest into a neighbour (one sharing a level first, then the smaller one; tie → previous)
    while (live.length > KEY_POINT_LIMITS.points) {
      const victim = smallest(live);
      const i = live.indexOf(victim);
      const nb = [live[i - 1], live[i + 1]].filter((w): w is WorkPoint => !!w);
      const share = nb.filter((w) => shares(w, victim));
      const pool = share.length ? share : nb;
      absorb(pool.reduce((a, b) => (b.items.length < a.items.length ? b : a)), victim);
    }

    // 5. invariants
    const totalSrs = levels.reduce((n, l) => n + l.flashcards.length + l.quiz.length, 0);
    if (live.length < (totalSrs < 18 ? KEY_POINT_LIMITS.minPoints : 6)) return omit("too_few");
    if (live.some((w) => w.items.length < 3 || srs(w) < 2)) return omit("too_few");
    if (live.some((w) => w.items.length > KEY_POINT_LIMITS.items)) return omit("too_big");
    const keyPoints: KeyPoint[] = live.map((w, i) => {
      const kp: KeyPoint = {
        id: `p${i + 1}`,
        title: w.title,
        short: w.short,
        levels: [...new Set(w.items.map((x) => x.level))],
        items: w.items.map(({ kind, level, index }) => ({ kind, level, index })),
      };
      if (w.summary) kp.summary = w.summary;
      return kp;
    });
    const parsed = z.array(KeyPointSchema).min(KEY_POINT_LIMITS.minPoints).max(KEY_POINT_LIMITS.points).safeParse(keyPoints);
    if (!parsed.success) return omit("invalid");
    if (keyPointProblems({ levels, keyPoints }).length) return omit("invalid");
    return { keyPoints, stats: { ...stats, keyPoints: keyPoints.length, omitted: false } };
  } catch {
    return omit("invalid");
  }
}

/**
 * What is wrong with a topic's `keyPoints` ([] = valid or absent): shape (KeyPointSchema, 3–15 points), ids `p1..pN`
 * in order, refs pointing at existing items, every quiz question and flashcard in exactly one point, every task in
 * at most one, ≥3 items with ≥2 quiz / flashcard per point, at least 6 points when the topic has ≥18 quiz + flashcard
 * items, `levels` = the item levels in level order.
 */
export function keyPointProblems(c: { levels: { id: string; flashcards: unknown[]; quiz: unknown[]; tasks?: unknown[] }[]; keyPoints?: unknown }): string[] {
  if (c.keyPoints === undefined) return [];
  const shape = z.array(KeyPointSchema).min(KEY_POINT_LIMITS.minPoints).max(KEY_POINT_LIMITS.points).safeParse(c.keyPoints);
  if (!shape.success) return [`shape: ${shape.error.issues[0]?.path.join(".") ?? ""} ${shape.error.issues[0]?.message ?? ""}`.trim()];
  const kp = shape.data;
  const out: string[] = [];
  const pos = new Map(c.levels.map((l, i) => [l.id, i]));
  const owner = new Map<string, string>();
  const totalSrs = c.levels.reduce((n, l) => n + l.flashcards.length + l.quiz.length, 0);
  if (totalSrs >= 18 && kp.length < 6) out.push(`${kp.length} points for ${totalSrs} quiz + flashcard items (need ≥ 6)`);
  kp.forEach((p, i) => {
    if (p.id !== `p${i + 1}`) out.push(`point ${i + 1} has id ${p.id}`);
    let srsN = 0;
    const lv: string[] = [];
    for (const it of p.items) {
      const li = pos.get(it.level);
      const l = li === undefined ? undefined : c.levels[li]!;
      const list = !l ? [] : it.kind === "quiz" ? l.quiz : it.kind === "flashcard" ? l.flashcards : (l.tasks ?? []);
      if (!l || it.index >= list.length) {
        out.push(`${p.id}: no ${it.kind} ${it.level}#${it.index}`);
        continue;
      }
      const ref = `${it.kind} ${it.level}#${it.index}`;
      const was = owner.get(ref);
      if (was) out.push(`${ref} is in ${was} and ${p.id}`);
      else owner.set(ref, p.id);
      if (it.kind !== "task") srsN++;
      if (!lv.includes(it.level)) lv.push(it.level);
    }
    if (p.items.length < 3 || srsN < 2) out.push(`${p.id}: ${p.items.length} items, ${srsN} quiz / flashcard`);
    lv.sort((a, b) => pos.get(a)! - pos.get(b)!);
    if (lv.join(",") !== p.levels.join(",")) out.push(`${p.id}: levels ${p.levels.join(",")} ≠ item levels ${lv.join(",")}`);
  });
  for (const l of c.levels) {
    l.flashcards.forEach((_, i) => owner.has(`flashcard ${l.id}#${i}`) || out.push(`flashcard ${l.id}#${i} is in no point`));
    l.quiz.forEach((_, i) => owner.has(`quiz ${l.id}#${i}`) || out.push(`quiz ${l.id}#${i} is in no point`));
  }
  return out;
}

export interface FinalizeOptions {
  lang?: boolean;
  /** stamp every `src` with this materials row id (materials mode) */
  materialId?: string;
  /** viz mode (`options.viz`): parse dose visuals; otherwise any `viz_type` / `viz` the model sent is ignored */
  viz?: boolean;
}

/**
 * Turn raw AI output into a valid TopicContent: assign level ids, palette, grading; drop invalid items
 * instead of failing the whole generation. Keeps `games` and adds `tasks` (2.0).
 */
export function finalizeGenerated(gen: GeneratedTopic, stage: Stage, opts: FinalizeOptions = {}): TopicContent {
  return finalizeGeneratedWithStats(gen, stage, opts).content;
}

/**
 * `finalizeGenerated` plus the stats: visuals kept / dropped and how the key points came out. `keyPoints` are built
 * AFTER the items are filtered (indexes final) from `gen.points` and each item's `p` tag; when they cannot satisfy the
 * invariants the topic is stored without them — key points never fail a generation.
 */
export function finalizeGeneratedWithStats(
  gen: GeneratedTopic,
  stage: Stage,
  opts: FinalizeOptions = {},
): { content: TopicContent; vizKept: number; vizDropped: VizDropStats; keyPoints: KeyPointStats } {
  const [accent, accent2] = paletteFor(gen.name);
  const vizDropped: VizDropStats = { schema: 0, grounding: 0, cap: 0 };
  const built = gen.levels
    .map((l, i) => {
      // every kept item keeps its key-point tag next to it, so the tags follow the filtering
      const tasks = (l.tasks ?? [])
        .map((t) => ({ task: convertTask(t, opts.materialId), p: t.p }))
        .filter((x): x is { task: Task; p: string | undefined } => x.task !== null)
        .slice(0, 20);
      const cards = l.flashcards.filter((c) => c.t && c.d);
      const quiz = l.quiz.filter((q) => q.q && q.a.length >= 2 && q.c >= 0 && q.c < q.a.length && q.e);
      const hasViz = opts.viz === true && l.feed.some((f) => f.viz_type && f.viz_type !== "none");
      const level = {
        id: `l${i + 1}`,
        title: l.title.trim() || `Poziom ${i + 1}`,
        emoji: l.emoji || "📘",
        summary: l.summary || undefined,
        feed: finalizeFeed(l.feed, hasViz ? levelTextForViz(l) : null, vizDropped),
        flashcards: cards.map((c) => ({ t: c.t, d: c.d })),
        quiz: quiz.map((q) => {
          const src = sourceFrom(q.src_quote, q.src_page, opts.materialId);
          const a = q.a.slice(0, 5);
          const base: QuizQuestion = { q: q.q, a, c: Math.min(q.c, 4), e: tidyPunctuation(resolveOptionLetters(q.e, a)) };
          if (src) base.src = src;
          return shuffleAnswers(base);
        }),
        games: l.games.map(convertGame).filter((g): g is MiniGame => g !== null),
        ...(tasks.length ? { tasks: tasks.map((x) => x.task) } : {}),
      };
      const tags = { flashcards: cards.map((c) => c.p), quiz: quiz.map((q) => q.p), tasks: tasks.map((x) => x.p) };
      return { level, genIndex: i, tags };
    })
    .filter(({ level: l }) => l.quiz.length > 0 || l.flashcards.length > 0 || l.feed.length > 0);
  const levels = built.map((b) => b.level);

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
  const parsed = TopicContentSchema.parse(content) as TopicContent;
  const vizKept = parsed.levels.reduce((n, l) => n + l.feed.filter((f) => f.viz).length, 0);

  // key points: outline level indexes → final level ids (a level dropped above takes its planned points with it)
  const idOf = new Map(built.map((b) => [b.genIndex, b.level.id]));
  const drafts: KeyPointDraft[] = (gen.points ?? []).map((p) => ({
    key: p.key,
    title: p.title,
    short: p.short,
    summary: p.summary,
    levels: p.levels.flatMap((i) => idOf.get(i) ?? []),
  }));
  const kp = buildKeyPoints(
    drafts,
    built.map((b) => ({ id: b.level.id, title: b.level.title, ...b.tags })),
  );
  if (kp.keyPoints && !keyPointProblems({ levels: parsed.levels, keyPoints: kp.keyPoints }).length) parsed.keyPoints = kp.keyPoints;
  const keyPoints: KeyPointStats = parsed.keyPoints ? kp.stats : { ...kp.stats, keyPoints: 0, omitted: true, reason: kp.stats.reason ?? "invalid" };
  return { content: parsed, vizKept, vizDropped, keyPoints };
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

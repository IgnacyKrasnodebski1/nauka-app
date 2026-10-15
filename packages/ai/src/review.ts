import type Anthropic from "@anthropic-ai/sdk";
import type { UsageMeter } from "./cost.js";
import { observeStream, type StreamObserver } from "./deadline.js";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  REVIEW_QUESTIONS_PROMPT,
  REVIEW_VIZ_RULES,
  answerHintInQuestion,
  buildReviewUserPrompt,
  biasedQuestionIndexes,
  sameOptions,
  taskForReview,
  weakExplanation,
  type Stage,
} from "@nauka/shared";

/**
 * Post-generation question review: ONE cheap call per level (run in parallel for all levels) that keeps or
 * rewrites every quiz question against a rubric (stage-appropriate wording, no unexplained notation such as IPA,
 * no trivia about example characters, no trick wording, one correct answer, plausible distractors of similar
 * length — this replaces the old distractor-length fix pass) and flags forced/unrelated `mnemo` and trivia `real`
 * for clearing. The model's answer is only a proposal: `applyReview()` enforces the hard constraints in code and
 * falls back to the original question when any of them is broken. Any error or timeout keeps the original level.
 */

/** Wall-clock cap of one review call (the calls run in parallel, so this caps the added latency). */
export const REVIEW_TIMEOUT_MS = 45_000;
/** Covers adaptive thinking at low effort + a full rewrite of a 10-question quiz. */
export const REVIEW_MAX_TOKENS = 8000;

/**
 * Same cheap model as the old distractor fix pass. An override must accept adaptive thinking + `effort`
 * (Sonnet 5, Opus 5…); Haiku 4.5 does not, so every review would fail and keep the original levels.
 */
export function reviewModelId(): string {
  return process.env.RECALL_AI_FIX_MODEL || "claude-sonnet-5";
}

/**
 * Structured output of the review call. Kept questions come back as `keep: true` with empty fields (saves output tokens).
 * Tasks get a keep/drop verdict only (no rewrites: the payloads are too varied to check in code).
 */
export const ReviewOutputSchema = z.object({
  questions: z.array(z.object({ keep: z.boolean(), drop: z.boolean(), q: z.string(), a: z.array(z.string()), c: z.number(), e: z.string() })),
  feed: z.array(z.object({ keep_mnemo: z.boolean(), keep_real: z.boolean() })),
  tasks: z.array(z.object({ keep: z.boolean() })),
});
/** Viz mode (`options.viz`): the same plus `keep_viz` per dose. */
export const ReviewOutputVizSchema = z.object({
  questions: ReviewOutputSchema.shape.questions,
  feed: z.array(z.object({ keep_mnemo: z.boolean(), keep_real: z.boolean(), keep_viz: z.boolean() })),
  tasks: ReviewOutputSchema.shape.tasks,
});
/** Answers are read leniently: an answer without `tasks` (older shape) still applies to questions and doses. */
const ReviewParseSchema = ReviewOutputSchema.extend({ tasks: ReviewOutputSchema.shape.tasks.optional() });
const ReviewParseVizSchema = ReviewOutputVizSchema.extend({ tasks: ReviewOutputSchema.shape.tasks.optional() });
export type ReviewOutput = z.infer<typeof ReviewParseSchema> | z.infer<typeof ReviewParseVizSchema>;

type Question = { q: string; a: string[]; c: number; e: string };
/** `viz_type` / `viz` exist only in viz mode (the raw JSON string from the level call, parsed later in finalize). */
type Dose = { title: string; body: string; real: string; mnemo: string; viz_type?: string; viz?: string };
const hasViz = (d: Dose) => !!d.viz_type && d.viz_type !== "none";
/** The slice of a generated level the review reads and may change (extra fields, e.g. src_page, are kept). */
export interface ReviewableLevel {
  feed: Dose[];
  quiz: Question[];
  /** generated tasks (flat GenTask shape) — keep/drop only */
  tasks?: (Record<string, unknown> & { type: string })[];
}

export interface ReviewStats {
  questionsRewritten: number;
  /** trivia / unanswerable questions removed on the reviewer's `drop` verdict (never below MIN_QUIZ) */
  questionsDropped: number;
  /** rewrites proposed by the model but rejected by the code checks (original kept) */
  rewritesRejected: number;
  mnemoCleared: number;
  realCleared: number;
  /** dose visuals cleared on the reviewer's `keep_viz: false` (viz mode only) */
  vizCleared: number;
  /** tasks removed on the reviewer's `keep: false` (never below MIN_TASKS) */
  tasksDropped: number;
}

export interface LevelReview<L> {
  level: L;
  /** true when the model's answer was usable (even if it changed nothing) */
  reviewed: boolean;
  /** why the review was skipped / failed (original level kept) */
  error?: string;
  stats: ReviewStats;
  usage: { input: number; output: number };
}

export const ZERO_REVIEW_STATS: ReviewStats = { questionsRewritten: 0, questionsDropped: 0, rewritesRejected: 0, mnemoCleared: 0, realCleared: 0, vizCleared: 0, tasksDropped: 0 };
const ZERO_STATS = ZERO_REVIEW_STATS;

/** A level keeps at least this many quiz questions (the prompt asks for 6–10); `drop` verdicts beyond that are ignored. */
export const MIN_QUIZ = 5;
/** A level keeps at least this many tasks; `keep: false` verdicts beyond that are ignored (the first ones win). */
export const MIN_TASKS = 2;

// limits of QuizQuestionSchema — a rewrite must never make finalizeGenerated() fail
const MAX_Q = 1000;
const MAX_A = 500;
const MAX_E = 2000;

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();

const numbers = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).sort().join("|");

const words = (s: string) => norm(s).split(" ").filter(Boolean);

/** Words that carry the truth of an answer: dropping one of them while "shortening" can flip the meaning. */
const KEY_WORDS = new Set(["nie", "ani", "bez", "tylko", "wyłącznie", "zawsze", "nigdy", "not", "no", "never", "only", "always", "without", "nor"]);

/** Phonetic / specialist notation such as /x/ or [ʎ] (what the review replaces with a plain description). */
const NOTATION = /\/[^/\s][^/]{0,15}\/|\[[^\]\s][^\]]{0,15}\]/g;

/**
 * Conservative "same meaning" check for the correct answer. Accepted only:
 *  - identical after normalization (case, punctuation, spacing);
 *  - the old answer had notation (/x/, [ʎ]) and every other word of it is still there, numbers unchanged;
 *  - pure shortening of a longer answer (3+ words): every new word was already there, at least half of the words
 *    stay, numbers and key words (nie / tylko / zawsze / not…) all kept.
 * Anything else fails — including one-word swaps that look similar ("hablo"→"habla", "es"→"está",
 * "prokarioty"→"eukarioty", "…tlen"→"…azot"), which a character-similarity test would let through.
 */
export function sameCorrectAnswer(before: string, after: string): boolean {
  const x = norm(before);
  const y = norm(after);
  if (!y) return false;
  if (x === y) return true;
  const ys = words(after);
  const withoutNotation = before.replace(NOTATION, " ");
  if (withoutNotation !== before) {
    const rest = words(withoutNotation);
    const have = new Set(ys);
    if (rest.length && rest.every((w) => have.has(w)) && numbers(withoutNotation) === numbers(after)) return true;
  }
  const xs = words(before);
  const had = new Set(xs);
  return (
    xs.length >= 3 &&
    ys.length * 2 >= xs.length &&
    ys.every((w) => had.has(w)) &&
    xs.every((w) => !KEY_WORDS.has(w) || ys.includes(w)) &&
    numbers(before) === numbers(after)
  );
}

/** Negation / "which one is wrong" markers in a question. */
const POLARITY_WORDS = new Set(["nie", "not", "no", "never", "nigdy", "false", "incorrect", "wrong", "untrue", "except"]);
const POLARITY_STEMS = ["nieprawd", "niepopraw", "błędn", "fałszyw"];

function polarity(q: string): number {
  return words(q.replace(/n['’]t\b/gi, " not")).filter((w) => POLARITY_WORDS.has(w) || POLARITY_STEMS.some((s) => w.startsWith(s))).length;
}

/**
 * Why a proposed rewrite must be rejected (null = acceptable).
 * `c` stays fixed, so a rewrite that flips the question ("Który NIE jest…" → "Który jest…") would silently make a
 * wrong option the marked answer — rejected when the parity of negation markers in `q` changes (removing a double
 * negation keeps the parity and passes).
 */
export function rewriteProblem(orig: Question, cand: Question): string | null {
  if (!Number.isInteger(cand.c) || cand.c !== orig.c) return "c changed";
  if (cand.a.length !== orig.a.length) return "answer count changed";
  if (cand.c < 0 || cand.c >= cand.a.length) return "c out of range";
  const q = cand.q.trim();
  const e = cand.e.trim();
  const a = cand.a.map((s) => s.trim());
  if (!q || q.length > MAX_Q) return "empty or too long question";
  if (!e || e.length > MAX_E) return "empty or too long explanation";
  if (a.some((s) => !s || s.length > MAX_A)) return "empty or too long answer";
  if (new Set(a.map(norm)).size !== a.length) return "duplicate answers";
  if (!sameCorrectAnswer(orig.a[orig.c] ?? "", a[cand.c]!)) return "correct answer changed";
  if (polarity(orig.q) % 2 !== polarity(q) % 2) return "question polarity flipped";
  if (biasedQuestionIndexes([{ q, a, c: cand.c, e }]).length && !biasedQuestionIndexes([orig]).length) return "new length bias";
  return null;
}

/**
 * Pure merge of the model's verdict into a level, enforcing the hard constraints:
 * same number of questions (else every question stays), per question same `c`, same answer count, same meaning of
 * the correct answer, non-empty `q`/`e`/answers within schema limits, no new length bias (else that question stays).
 * Feed flags apply only when the feed array has the same length. Never mutates the input.
 */
export function applyReview<L extends ReviewableLevel>(level: L, out: ReviewOutput): { level: L; stats: ReviewStats } {
  const stats: ReviewStats = { ...ZERO_STATS };
  let quiz = level.quiz;
  if (out.questions.length === level.quiz.length) {
    // `drop` (pure trivia that cannot be reworded with the same correct answer) removes the question — safe here,
    // the topic is not saved yet, so no progress keys point at quiz indexes. Never below MIN_QUIZ questions.
    let droppable = Math.max(0, level.quiz.length - MIN_QUIZ);
    const dropped = new Set<number>();
    out.questions.forEach((cand, i) => {
      if (!cand.keep && cand.drop && droppable > 0) {
        dropped.add(i);
        droppable--;
      }
    });
    stats.questionsDropped = dropped.size;
    quiz = level.quiz.flatMap((orig, i) => {
      if (dropped.has(i)) return [];
      const cand = out.questions[i]!;
      if (cand.keep) return [orig];
      if (cand.drop) return [orig]; // drop verdict over the MIN_QUIZ floor: keep the original as is
      if (rewriteProblem(orig, cand)) {
        stats.rewritesRejected++;
        return [orig];
      }
      const next = { ...orig, q: cand.q.trim(), a: cand.a.map((s) => s.trim()), e: cand.e.trim() };
      if (next.q === orig.q && next.e === orig.e && next.a.every((s, k) => s === orig.a[k])) return [orig];
      stats.questionsRewritten++;
      return [next];
    });
  } else {
    stats.rewritesRejected += out.questions.filter((q) => !q.keep).length;
  }

  let feed = level.feed;
  if (out.feed.length === level.feed.length) {
    feed = level.feed.map((dose, i) => {
      const flags = out.feed[i]!;
      const clearMnemo = !flags.keep_mnemo && dose.mnemo.trim() !== "";
      const clearReal = !flags.keep_real && dose.real.trim() !== "";
      const clearViz = "keep_viz" in flags && flags.keep_viz === false && hasViz(dose);
      if (!clearMnemo && !clearReal && !clearViz) return dose;
      if (clearMnemo) stats.mnemoCleared++;
      if (clearReal) stats.realCleared++;
      if (clearViz) stats.vizCleared++;
      const next = { ...dose, mnemo: clearMnemo ? "" : dose.mnemo, real: clearReal ? "" : dose.real };
      return clearViz ? { ...next, viz_type: "none", viz: "" } : next;
    });
  }

  let tasks = level.tasks;
  if (level.tasks && out.tasks && out.tasks.length === level.tasks.length) {
    let droppable = Math.max(0, level.tasks.length - MIN_TASKS);
    const drop = new Set<number>();
    out.tasks.forEach((v, i) => {
      if (!v.keep && droppable > 0) {
        drop.add(i);
        droppable--;
      }
    });
    if (drop.size) {
      tasks = level.tasks.filter((_, i) => !drop.has(i));
      stats.tasksDropped = drop.size;
    }
  }

  const same = <T>(a: T[], b: T[]) => a.every((x, i) => x === b[i]);
  if (quiz.length === level.quiz.length && same(quiz, level.quiz) && same(feed, level.feed) && tasks === level.tasks) return { level, stats };
  return { level: { ...level, quiz, feed, ...(tasks ? { tasks } : {}) }, stats };
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Review one level with a single structured-output call. Never throws: on error, refusal, truncated or invalid
 * output, or after `timeoutMs`, the original level comes back with `reviewed: false` and the reason in `error`.
 */
export async function reviewLevel<L extends ReviewableLevel>(
  client: Anthropic,
  level: L,
  ctx: {
    stage: Stage;
    lang?: boolean;
    title?: string;
    timeoutMs?: number;
    /** viz mode: review visuals too (keep_viz) */
    viz?: boolean;
    /** the generation deadline: aborting it aborts the review call too */
    signal?: AbortSignal;
    /** SDK retries for the review call (default 1; the generation passes 0 when the deadline is near) */
    maxRetries?: number;
    /** collects the call's tokens (also of an aborted call) for the generation's cost */
    meter?: UsageMeter;
  },
): Promise<LevelReview<L>> {
  const usage = { input: 0, output: 0 };
  const keep = (error: string): LevelReview<L> => ({ level, reviewed: false, error, stats: { ...ZERO_STATS }, usage });
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  if (ctx.signal) {
    if (ctx.signal.aborted) controller.abort();
    else ctx.signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: StreamObserver | null = null;
  let recorded = false;
  try {
    const viz = ctx.viz === true;
    if (!level.quiz.length && !level.tasks?.length && !level.feed.some((f) => f.mnemo.trim() || f.real.trim() || (viz && hasViz(f)))) return keep("nothing to review");
    const timeoutMs = ctx.timeoutMs ?? REVIEW_TIMEOUT_MS;
    if (timeoutMs <= 0) return keep("no time left");

    const biased = new Set(biasedQuestionIndexes(level.quiz));
    const prompt = buildReviewUserPrompt({
      stage: ctx.stage,
      lang: ctx.lang,
      title: ctx.title,
      feed: level.feed,
      questions: level.quiz.map((q, i) => ({ q: q.q, a: q.a, c: q.c, e: q.e, length_bias: biased.has(i), weak_e: weakExplanation(q), answer_hint: answerHintInQuestion(q), same_options: sameOptions(q) })),
      tasks: (level.tasks ?? []).map(taskForReview),
      ...(viz ? { viz: true } : {}),
    });
    const schema = viz ? ReviewOutputVizSchema : ReviewOutputSchema;
    const parseSchema = viz ? ReviewParseVizSchema : ReviewParseSchema;

    if (controller.signal.aborted) return keep("no time left");
    const stream = client.beta.messages.stream(
      {
        model: reviewModelId(),
        max_tokens: REVIEW_MAX_TOKENS,
        // No server-side `fallbacks` here: `fallbacks: "default"` is documented for Opus 5 / Fable, not verified on
        // Sonnet 5, and a 400 would silently disable every review. A refusal already just keeps the original level.
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        system: viz ? `${REVIEW_QUESTIONS_PROMPT}\n\n${REVIEW_VIZ_RULES}` : REVIEW_QUESTIONS_PROMPT,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal, maxRetries: ctx.maxRetries ?? 1 },
    );
    observer = observeStream(stream);
    const call = stream.finalMessage();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // reject first, so the race settles with the timeout and not with the abort error it triggers
        reject(new Error(`timeout after ${timeoutMs} ms`));
        controller.abort();
      }, timeoutMs);
    });
    const msg = (await Promise.race([call, deadline])) as Anthropic.Beta.BetaMessage & { parsed_output?: unknown };
    usage.input = msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
    usage.output = msg.usage.output_tokens;
    ctx.meter?.record("review", msg.usage, msg.model || reviewModelId());
    recorded = true;
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return keep(`stop_reason ${msg.stop_reason}`);
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = parseSchema.safeParse(msg.parsed_output ?? parseJson(text));
    if (!parsed.success) return keep("invalid output");
    const { level: next, stats } = applyReview(level, parsed.data);
    return { level: next, reviewed: true, stats, usage };
  } catch (e) {
    // a timed-out / aborted / failed call may still have been billed: cost what the stream reported
    const last = observer?.lastUsage();
    if (!recorded && last) {
      ctx.meter?.recordPartial("review", last.usage, last.model || reviewModelId());
      recorded = true;
    }
    return keep((e as Error)?.message || "review failed");
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onOuterAbort);
  }
}

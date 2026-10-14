import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  GENERATION_SYSTEM_PROMPT,
  TOPIC_SYSTEM_PROMPT,
  OUTLINE_INSTRUCTIONS,
  levelInstructions,
  GenerationOptionsSchema,
  OutlineSchema,
  LevelCoreGenSchema,
  LevelCoreGenVizSchema,
  LevelCoreGenVizLooseSchema,
  LevelTasksGenSchema,
  RAW_JSON_INSTRUCTION,
  expandGenTask,
  answerLengthBias,
  buildGenerationUserPrompt,
  maxLevelsFor,
  scopeCoverage,
  finalizeGenerated,
  finalizeGeneratedWithStats,
  type GeneratedTopic,
  type GenerationOptions,
  type Outline,
  type LevelGen,
  type GenTask,
  type TopicContent,
  type VizDropStats,
} from "@nauka/shared";
import { aiConfigured, getClient, modelId } from "./client.js";
import { demoGenerated } from "./demo.js";
import { deleteUploadedFiles, materialsToBlocks, uploadMaterials, type MaterialInput } from "./materials.js";
import { REVIEW_TIMEOUT_MS, ZERO_REVIEW_STATS, reviewLevel } from "./review.js";

export interface GenerateInput {
  materials: MaterialInput[];
  text?: string;
  options: GenerationOptions;
  /** PPTX decks among the materials (already unpacked by intake): the prompt then asks for slide numbers as src_page */
  decks?: number;
  /** optional progress callback: phase "outline" | "levels" | "done" */
  onProgress?: (phase: "outline" | "levels" | "done", detail?: string) => void;
}

export interface GenerateResult {
  content: TopicContent;
  category: string;
  model: string;
  usage: { input: number; output: number };
  demo: boolean;
  quality: GenerationQuality;
}

/** Outcome of the post-generation question review (one cheap call per level, see review.ts). */
export interface GenerationQuality {
  /** levels where the review changed something (questions, mnemo or real) */
  levelsFixed: number;
  /** residual length bias after the review: max over levels of the share of questions whose correct option is the longest */
  lengthBias: number;
  /** levels whose review call returned a usable answer */
  levelsReviewed: number;
  /** levels whose review failed, timed out or was skipped (original level kept) */
  reviewFailed: number;
  /** quiz questions replaced by a reviewed rewrite */
  questionsRewritten: number;
  /** trivia / unanswerable quiz questions removed by the review */
  questionsDropped: number;
  /** rewrites proposed by the review but rejected by the code checks (shape, c, correct-answer meaning, length) */
  rewritesRejected: number;
  /** feed doses whose forced / unrelated mnemonic was cleared */
  mnemoCleared: number;
  /** feed doses whose "po ludzku" line (trivia about the example) was cleared */
  realCleared: number;
  /** dose visuals cleared by the review (viz mode only) */
  vizCleared: number;
  /** dose visuals stored in the topic (viz mode only) */
  vizKept: number;
  /** dose visuals dropped in finalize: bad shape, not grounded in the material, over the per-level cap */
  vizDropped: VizDropStats;
  /** tasks removed by the review (answer not taught in the doses, giveaway, trivia, duplicate of a quiz question) */
  tasksDropped: number;
  /** levels of the outline whose generation failed and were left out (the rest of the topic is kept) */
  levelsFailed: number;
  /** key points of the outline scopes (all levels), and how many of them the doses / the questions seem to miss (stem check) */
  scopePoints: number;
  scopeUntaught: number;
  scopeUnchecked: number;
}

const NO_REVIEW: GenerationQuality = {
  levelsFixed: 0,
  lengthBias: 0,
  levelsReviewed: 0,
  reviewFailed: 0,
  questionsRewritten: 0,
  questionsDropped: 0,
  rewritesRejected: 0,
  mnemoCleared: 0,
  realCleared: 0,
  vizCleared: 0,
  vizKept: 0,
  vizDropped: { schema: 0, grounding: 0, cap: 0 },
  tasksDropped: 0,
  levelsFailed: 0,
  scopePoints: 0,
  scopeUntaught: 0,
  scopeUnchecked: 0,
};

/** Outline categories of a language-learning topic: the level prompts and the review then use the language rules. */
const LANG_CATEGORIES = new Set(["inny-język", "angielski"]);

/** Keep the whole generation under the API route's maxDuration (300 s): the review only gets the time that is left. */
const GENERATION_BUDGET_MS = 250_000;
/**
 * Output cap (thinking included) of a level's core call. A cap, not a target: the prompt asks for up to 7 doses of
 * 40–90 words, 1 game instead of 2 — about the same output as before; the headroom only avoids failing a level on
 * a long answer.
 */
const CORE_MAX_TOKENS = 20000;

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: "refusal" | "invalid_output" | "no_input" | "api" | "too_long",
  ) {
    super(message);
  }
}

type Usage = { input: number; output: number };

function addUsage(u: Usage, m: Anthropic.Beta.BetaMessage): Usage {
  return {
    input: u.input + m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0),
    output: u.output + m.usage.output_tokens,
  };
}

/**
 * Turn uploaded materials (mode "materials") or a typed topic (mode "prompt") into a full topic.
 *
 * Phases, so wall-clock stays ~2 min regardless of level count:
 *  1. outline (metadata + per-level scope) — small, fast;
 *  2. every level generated in parallel from the same materials + its scope;
 *  3. question review — one cheap call per level, in parallel (review.ts); best effort, never fails the generation.
 * Falls back to a demo topic when no API key is configured.
 *
 * PDFs (and images, when they are large together) are uploaded once to the Files API and referenced by file_id
 * in every call, so big materials never travel base64 inside the 32 MB Messages request. The uploads are deleted
 * when generation ends, successfully or not.
 */
export async function generateTopic(input: GenerateInput): Promise<GenerateResult> {
  const options = GenerationOptionsSchema.parse(input.options);
  const mode = options.mode ?? (input.materials.length || input.text?.trim() ? "materials" : "prompt");
  if (mode === "materials" && !input.materials.length && !input.text?.trim()) throw new GenerationError("Dodaj przynajmniej jeden plik albo tekst.", "no_input");
  if (mode === "prompt" && !options.hint?.trim()) throw new GenerationError("Wpisz temat, np. „fotosynteza, klasa 7”.", "no_input");

  if (!aiConfigured()) {
    const gen = demoGenerated(options.hint || input.text?.split("\n")[0] || "Demo", options.levels ?? 3);
    return { content: finalizeGenerated(gen, options.stage, { lang: options.lang }), category: gen.category, model: "demo", usage: { input: 0, output: 0 }, demo: true, quality: { ...NO_REVIEW, vizDropped: { ...NO_REVIEW.vizDropped } } };
  }

  const startedAt = Date.now();
  const client = getClient();
  const uploaded: string[] = [];
  try {
    let fileIds: (string | undefined)[] = [];
    if (mode === "materials" && input.materials.length) {
      try {
        fileIds = await uploadMaterials(client, input.materials, uploaded);
      } catch (e) {
        throw new GenerationError((e as Error).message || "Nie udało się przesłać materiałów do AI. Spróbuj ponownie za chwilę.", "api");
      }
    }
    return await generateWithAi(input, options, mode, client, fileIds, startedAt);
  } finally {
    await deleteUploadedFiles(client, uploaded);
  }
}

async function generateWithAi(
  input: GenerateInput,
  options: GenerationOptions,
  mode: "materials" | "prompt",
  client: Anthropic,
  fileIds: readonly (string | undefined)[],
  startedAt: number,
): Promise<GenerateResult> {
  const { blocks, summary } = mode === "materials" ? materialsToBlocks(input.materials, input.text, fileIds) : { blocks: [] as Anthropic.Beta.BetaContentBlockParam[], summary: "brak" };
  // cache the (possibly large) materials prefix so the parallel level calls reuse it
  if (blocks.length) {
    const last = blocks[blocks.length - 1]!;
    (last as { cache_control?: { type: "ephemeral" } }).cache_control = { type: "ephemeral" };
  }
  const model = modelId();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: mode === "materials" ? GENERATION_SYSTEM_PROMPT : TOPIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const basePrompt = buildGenerationUserPrompt({ ...options, mode }, summary, mode === "materials" && input.decks ? { decks: true } : {});
  let usage: Usage = { input: 0, output: 0 };
  let servedModel = model;

  type Format = ReturnType<typeof betaZodOutputFormat<any>>;

  async function callOnce<T>(userText: string, format: Format | undefined, maxTokens: number, parse: (text: string) => T | null): Promise<T> {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: format ? { effort: "medium", format } : { effort: "medium" },
      system,
      messages: [{ role: "user", content: [...blocks, { type: "text", text: format ? userText : `${userText}\n\n${RAW_JSON_INSTRUCTION}` }] }],
    });
    let msg: Anthropic.Beta.BetaMessage & { parsed_output?: unknown };
    try {
      msg = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.APIError && (e.status === 413 || /prompt is too long|too many (pages|tokens)|exceeds? (the )?(maximum|limit)|request too large/i.test(e.message)))
        throw new GenerationError("Materiał jest za duży na jedną lekcję (za dużo stron albo tekstu). Podziel go na mniejsze części, np. po rozdziale.", "too_long");
      if (e instanceof Anthropic.APIError) throw new GenerationError(`AI: ${e.status} ${e.message}`, "api");
      throw e;
    }
    usage = addUsage(usage, msg);
    servedModel = msg.model;
    if (msg.stop_reason === "refusal") throw new GenerationError("AI odmówiło przetworzenia tych materiałów.", "refusal");
    if (msg.stop_reason === "max_tokens") throw new GenerationError("Materiał za duży na jeden temat — podziel go na mniejsze części.", "invalid_output");
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = (msg.parsed_output as T | null | undefined) ?? parse(text);
    if (!parsed) throw new GenerationError("AI zwróciło nieprawidłową strukturę. Spróbuj ponownie.", "invalid_output");
    return parsed;
  }

  /**
   * Structured-output call with a fallback: when the API rejects the compiled grammar as too large (HTTP 400),
   * the same request is repeated without `output_config.format` and the JSON is parsed from the text.
   */
  async function call<T>(userText: string, format: Format, maxTokens: number, parse: (text: string) => T | null): Promise<T> {
    try {
      return await callOnce(userText, format, maxTokens, parse);
    } catch (e) {
      if (e instanceof GenerationError && e.code === "api" && /grammar/i.test(e.message)) return callOnce(userText, undefined, maxTokens, parse);
      throw e;
    }
  }

  // ---- phase 1: outline
  input.onProgress?.("outline");
  const outline = await call<Outline>(`${basePrompt}\n\n${OUTLINE_INSTRUCTIONS}`, betaZodOutputFormat(OutlineSchema), 8000, (t) => safeParse(OutlineSchema, t));
  // `levels` is the usual count; a long material may use up to maxLevelsFor() levels, so nothing important is cut
  const maxLevels = Math.max(1, maxLevelsFor({ ...options, mode }));
  if (outline.levels.length > maxLevels) console.warn(`[generate] outline had ${outline.levels.length} levels, cut to ${maxLevels} — the end of the material is not covered`);
  outline.levels = outline.levels.slice(0, maxLevels);
  if (!outline.levels.length) throw new GenerationError("AI nie znalazło w materiałach treści do nauki.", "invalid_output");
  // a language topic the client did not flag (Cramfox never sends `lang`): the level calls and the review use the
  // language rules; the stored `content.lang` stays as the client asked, so client behaviour does not change
  const lang = options.lang ?? LANG_CATEGORIES.has(outline.category);
  const levelPrompt = lang && !options.lang ? buildGenerationUserPrompt({ ...options, mode, lang }, summary, mode === "materials" && input.decks ? { decks: true } : {}) : basePrompt;

  // ---- phase 2: levels in parallel — two calls per level (core content + compact tasks), so each output grammar stays small.
  // Viz mode (`options.viz`, sent only by clients that render visuals): the core call also asks for `viz_type` + `viz`
  // (a JSON string, so the grammar grows by two flat fields only); without it the request is the pre-viz one.
  const viz = options.viz === true;
  const coreSchema = viz ? LevelCoreGenVizSchema : LevelCoreGenSchema;
  // raw-text parsing (grammar fallback) is lenient about the viz fields: a missing / unknown viz_type must not fail the level
  const coreParse = viz ? LevelCoreGenVizLooseSchema : LevelCoreGenSchema;
  input.onProgress?.("levels", `${outline.levels.length} poziomów`);
  const settled = await Promise.allSettled(
    outline.levels.map(async (_, i): Promise<LevelGen> => {
      const [core, tasksGen] = await Promise.all([
        call<LevelGen>(`${levelPrompt}\n\n${levelInstructions(outline, i, "core", viz ? { viz } : {})}`, betaZodOutputFormat(coreSchema), CORE_MAX_TOKENS, (t) => safeParse(coreParse, t)),
        call(`${levelPrompt}\n\n${levelInstructions(outline, i, "tasks")}`, betaZodOutputFormat(LevelTasksGenSchema), 12000, (t) => safeParse(LevelTasksGenSchema, t)).catch((e) => {
          // tasks are an enhancement: a failed tasks call must not lose the level (refusals still abort)
          if (e instanceof GenerationError && e.code !== "refusal") return { tasks: [] };
          throw e;
        }),
      ]);
      const tasks = tasksGen.tasks.map(expandGenTask).filter((t): t is GenTask => t !== null);
      return { ...core, tasks };
    }),
  );
  // One failed level (truncated or invalid output, API error) no longer fails the whole generation — the user is
  // charged either way, so the other levels are kept. A refusal, a too-large material or every level failing still fail.
  const fatal = settled.find((r): r is PromiseRejectedResult => r.status === "rejected" && !(r.reason instanceof GenerationError && (r.reason.code === "invalid_output" || r.reason.code === "api")));
  if (fatal) throw fatal.reason;
  const okIdx = settled.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []));
  if (!okIdx.length) throw (settled[0] as PromiseRejectedResult).reason;
  const levelsFailed = settled.length - okIdx.length;
  if (levelsFailed) {
    const why = settled.flatMap((r, i) => (r.status === "rejected" ? [`poziom ${i + 1}: ${(r.reason as Error)?.message}`] : []));
    console.warn(`[generate] ${levelsFailed}/${settled.length} levels failed and were left out — ${why.join("; ")}`);
    outline.levels = okIdx.map((i) => outline.levels[i]!);
  }
  const levels = okIdx.map((i) => (settled[i] as PromiseFulfilledResult<LevelGen>).value);

  // ---- phase 3: question review — one cheap call per level, all in parallel (rubric + anti-guessing length rule).
  // Never fails the generation: a failed / timed-out review keeps the original level.
  input.onProgress?.("levels", "sprawdzam pytania");
  const reviewTimeoutMs = Math.min(REVIEW_TIMEOUT_MS, GENERATION_BUDGET_MS - (Date.now() - startedAt));
  const reviews = await Promise.all(
    levels.map((lv, i) =>
      reviewLevel(client, lv, { stage: options.stage, lang, title: outline.levels[i]!.title, timeoutMs: reviewTimeoutMs, ...(viz ? { viz } : {}) }).catch((e: unknown) => ({
        level: lv,
        reviewed: false,
        error: (e as Error)?.message || "review failed",
        stats: { ...ZERO_REVIEW_STATS },
        usage: { input: 0, output: 0 },
      })),
    ),
  );
  const quality: GenerationQuality = { ...NO_REVIEW, vizDropped: { ...NO_REVIEW.vizDropped }, levelsFailed };
  const failures: string[] = [];
  reviews.forEach((r, i) => {
    levels[i] = r.level;
    usage = { input: usage.input + r.usage.input, output: usage.output + r.usage.output };
    if (r.reviewed) quality.levelsReviewed++;
    else if (r.error !== "nothing to review") {
      quality.reviewFailed++;
      failures.push(`poziom ${i + 1}: ${r.error}`);
    }
    const s = r.stats;
    if (s.questionsRewritten || s.questionsDropped || s.mnemoCleared || s.realCleared || s.vizCleared || s.tasksDropped) quality.levelsFixed++;
    quality.tasksDropped += s.tasksDropped;
    quality.questionsRewritten += s.questionsRewritten;
    quality.questionsDropped += s.questionsDropped;
    quality.rewritesRejected += s.rewritesRejected;
    quality.mnemoCleared += s.mnemoCleared;
    quality.realCleared += s.realCleared;
    quality.vizCleared += s.vizCleared;
  });
  if (failures.length) console.warn(`[generate] question review kept original levels — ${failures.join("; ")}`);
  quality.lengthBias = Math.max(0, ...levels.map((lv) => answerLengthBias(lv.quiz).longest));
  // coverage of the outline's key points (log line for prompt tuning; stems only, so a rough measure)
  const gaps: string[] = [];
  levels.forEach((lv, i) => {
    const cov = scopeCoverage(outline.levels[i]!.scope, lv);
    quality.scopePoints += cov.points;
    quality.scopeUntaught += cov.untaught.length;
    quality.scopeUnchecked += cov.unchecked.length;
    for (const p of cov.untaught) gaps.push(`L${i + 1} bez dawki: ${p.slice(0, 80)}`);
    for (const p of cov.unchecked) if (!cov.untaught.includes(p)) gaps.push(`L${i + 1} bez pytania: ${p.slice(0, 80)}`);
  });
  console.info(`[generate] coverage ${JSON.stringify({ levels: levels.length, levelsFailed, points: quality.scopePoints, untaught: quality.scopeUntaught, unchecked: quality.scopeUnchecked, tasksDropped: quality.tasksDropped })}${gaps.length ? ` — ${gaps.slice(0, 12).join("; ")}` : ""}`);

  const gen: GeneratedTopic = {
    name: outline.name,
    short: outline.short,
    emoji: outline.emoji,
    tagline: outline.tagline,
    category: outline.category,
    info_html: outline.info_html,
    levels: outline.levels.map((l, i) => ({ title: l.title, emoji: l.emoji, summary: l.summary, ...levels[i]! })),
  };
  input.onProgress?.("done");
  const { content, vizKept, vizDropped } = finalizeGeneratedWithStats(gen, options.stage, { lang: options.lang, viz });
  quality.vizKept = vizKept;
  quality.vizDropped = vizDropped;
  // one structured line per viz generation (prompt tuning reads these from the logs)
  if (viz) console.info(`[generate] viz ${JSON.stringify({ kept: vizKept, ...vizDropped, cleared: quality.vizCleared, doses: content.levels.reduce((n, l) => n + l.feed.length, 0) })}`);
  return { content, category: outline.category || "inne", model: servedModel, usage, demo: false, quality };
}

function safeParse<T>(schema: { parse: (v: unknown) => T }, text: string): T | null {
  const candidates = [text, text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, ""), text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    try {
      return schema.parse(JSON.parse(c));
    } catch {
      /* try next */
    }
  }
  return null;
}

/** @deprecated use generateTopic */
export const generateSubject = generateTopic;

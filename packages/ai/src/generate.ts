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
import { UsageMeter, type UsageSummary } from "./cost.js";
import { Deadline, GENERATION_DEADLINE_MS, observeStream, settledOrTimeout } from "./deadline.js";
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
  /**
   * Absolute time (ms since epoch) at which every AI request of this generation is aborted (GenerationError
   * `ai_timeout`). Default: now + GENERATION_DEADLINE_MS. The API route passes request start + 270 s.
   */
  deadlineAt?: number;
  /** Collects tokens and cost of every AI call, also when the generation fails (the route writes them to `generations`). */
  meter?: UsageMeter;
}

export interface GenerateResult {
  content: TopicContent;
  category: string;
  model: string;
  usage: { input: number; output: number };
  demo: boolean;
  quality: GenerationQuality;
  /** tokens split by price class and USD cost of every call of this generation (see cost.ts) */
  cost: UsageSummary;
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
  /** ms spent waiting for the first stream events of level 1 before starting the other levels (prompt-cache warm-up) */
  warmupMs?: number;
  /** ms from the start of the AI part to the finished topic */
  durationMs?: number;
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

/**
 * Output cap (thinking included) of a level's core call. A cap, not a target: the prompt asks for up to 7 doses of
 * 40–90 words, 1 game instead of 2 — about the same output as before; the headroom only avoids failing a level on
 * a long answer.
 */
const CORE_MAX_TOKENS = 20000;

/**
 * `ai_unavailable` (incident 2026-10-16: an invalid ANTHROPIC_API_KEY was shown to users as „the file is too big or
 * protected”): the AI service failed on our side — authentication / permission / billing of our account, rate limit,
 * overload, 5xx, a broken connection — not because of the user's material. See {@link classifyAiError}.
 */
export type GenerationErrorCode = "refusal" | "invalid_output" | "no_input" | "api" | "too_long" | "ai_timeout" | "ai_unavailable";

export class GenerationError extends Error {
  /** server-side description of the underlying API error (logs and `generations.error`; never sent to the client, no secrets) */
  readonly detail?: string;
  /** `api` only: the API rejected the user's material (bad / protected image or PDF), not our request */
  readonly material?: boolean;
  constructor(
    message: string,
    public readonly code: GenerationErrorCode,
    extra: { detail?: string; material?: boolean } = {},
  ) {
    super(message);
    if (extra.detail) this.detail = extra.detail;
    if (extra.material) this.material = true;
  }
}

export const AI_TIMEOUT_MESSAGE = "Tworzenie lekcji trwało za długo i zostało przerwane. Spróbuj z mniejszą ilością materiału.";
/** `ai_unavailable` after a charge that stays (some AI output was produced). The refunded variant is in pipeline.ts. */
export const AI_UNAVAILABLE_MESSAGE = "Tworzenie lekcji chwilowo nie działa. To problem po naszej stronie, nie z Twoim materiałem. Spróbuj ponownie za kilka minut.";
const TOO_LONG_AI_MESSAGE = "Materiał jest za duży na jedną lekcję (za dużo stron albo tekstu). Podziel go na mniejsze części, np. po rozdziale.";
const TOO_LONG_RE = /prompt is too long|too many (pages|tokens)|exceeds? (the )?(maximum|limit)|request too large/i;
/** 400 answers about OUR account, not the request (e.g. "Your credit balance is too low to access the Anthropic API"). */
const ACCOUNT_RE = /credit balance|billing|spend(ing)? limit|usage limits?|organization (has been |is )?(disabled|suspended)|workspace .*(disabled|archived)/i;
/** 400 / 415 / 422 answers about the user's material (unreadable, unsupported or protected image / PDF). */
const MATERIAL_RE = /image|\bpdf\b|document|media.?type|mime|password|encrypt|corrupt|decod|base64|could not process|unsupported (format|file|media)|invalid (file|format)/i;
/** Error types the API reports in the body (also in a stream's `error` event, where `status` is undefined). */
const UNAVAILABLE_TYPES = new Set(["authentication_error", "permission_error", "billing_error", "not_found_error", "rate_limit_error", "overloaded_error", "api_error", "timeout_error"]);
/** A per-attempt timeout this close to the deadline is the deadline (the SDK's timer may fire a moment before ours). */
const DEADLINE_SLACK_MS = 1_000;

export type AiErrorKind = "unavailable" | "too_long" | "material" | "request";

/**
 * What an Anthropic SDK error means for the user (incident 2026-10-16):
 *  - `unavailable` — our side: 401 / 403 (key, permissions), 404 (model or file id — our configuration), 408, 429,
 *    5xx incl. 529 overloaded, a broken connection, a 400 about our account's billing, and the same error types in a
 *    stream's `error` event. Becomes `ai_unavailable` (the route refunds it when no AI output was produced);
 *  - `too_long` — 413 or a "prompt is too long" answer (as before);
 *  - `material` — 400 / 415 / 422 about the image / PDF the user sent (as before code `api`, now flagged);
 *  - `request` — any other 4xx (as before code `api`).
 * Not an SDK error, or an abort: null.
 */
export function classifyAiError(e: unknown): AiErrorKind | null {
  if (!(e instanceof Anthropic.APIError) || e instanceof Anthropic.APIUserAbortError) return null;
  if (e instanceof Anthropic.APIConnectionError) return "unavailable";
  const status = e.status;
  const type = errorType(e);
  if (status === 413 || type === "request_too_large") return "too_long";
  if (status === 401 || status === 403 || status === 404 || status === 408 || status === 429 || (typeof status === "number" && status >= 500)) return "unavailable";
  if (TOO_LONG_RE.test(e.message)) return "too_long";
  if (type && UNAVAILABLE_TYPES.has(type)) return "unavailable";
  if (ACCOUNT_RE.test(e.message)) return "unavailable";
  if ((status === 400 || status === 415 || status === 422 || status === undefined) && MATERIAL_RE.test(e.message)) return "material";
  return "request";
}

function errorType(e: InstanceType<typeof Anthropic.APIError>): string | null {
  const body = e.error as { error?: { type?: unknown } } | undefined;
  const t = (e as { type?: unknown }).type ?? body?.error?.type ?? null;
  return typeof t === "string" ? t : null;
}

/** Never let a key-shaped string reach a log line or `generations.error`. */
const scrub = (s: string) => s.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***").replace(/\b(x-api-key|authorization|bearer)(["':=\s]+)(?!\*)[A-Za-z0-9._~+/=-]{12,}/gi, "$1$2***");

/** One line about an SDK error for the server logs and `generations.error`: status, error type, request id, message (scrubbed). */
export function describeAiError(e: unknown): string {
  if (e instanceof Anthropic.APIConnectionError) {
    const cause = (e as { cause?: { code?: unknown; message?: unknown } }).cause;
    const why = cause ? ` (${String(cause.code ?? cause.message ?? "")})` : "";
    return scrub(`connection: ${e.message}${why}`).slice(0, 500);
  }
  if (e instanceof Anthropic.APIError) {
    const id = e.requestID ? ` [${e.requestID}]` : "";
    return scrub(`${e.status ?? "stream"} ${errorType(e) ?? e.constructor.name}${id}: ${e.message}`).slice(0, 500);
  }
  return scrub(String((e as Error)?.message ?? e)).slice(0, 500);
}

/**
 * Before the charge, materials whose prompt (system + materials + base prompt, `count_tokens`) is larger than this
 * are rejected as `too_long` (AUDYT P1-29): a 100-page PDF costs ~$20–35 per generation, and a lesson from that much
 * material is poor anyway. ~150k tokens ≈ 50–60 pages of a dense PDF.
 */
export const MAX_INPUT_TOKENS = 150_000;
/** Level count used for every generation; the client's `options.levels` is ignored (P1-29). Materials mode may use up to +2. */
export const GENERATION_LEVELS = 4;
/** count_tokens is a free, quick call; it must not eat the generation's time when the API is slow. */
const COUNT_TOKENS_TIMEOUT_MS = 20_000;
/**
 * Prompt-cache warm-up (P1-2): the other levels start only after the first stream events of level 1 (core and tasks),
 * so they read the cache entries those calls wrote instead of each writing its own. Waiting longer than this (slow
 * prefill of a huge prompt) costs more time than the cache saves money.
 */
export const WARM_UP_CAP_MS = 30_000;

/** Map an SDK / network error of one AI request to a GenerationError (the deadline wins over whatever the abort caused). */
function aiError(e: unknown, deadline: Deadline): unknown {
  if (e instanceof GenerationError) return e;
  if (deadline.expired() || (e instanceof Anthropic.APIConnectionTimeoutError && deadline.left() < DEADLINE_SLACK_MS)) return new GenerationError(AI_TIMEOUT_MESSAGE, "ai_timeout");
  const kind = classifyAiError(e);
  if (kind === "too_long") return new GenerationError(TOO_LONG_AI_MESSAGE, "too_long");
  if (kind === "unavailable") return new GenerationError(AI_UNAVAILABLE_MESSAGE, "ai_unavailable", { detail: describeAiError(e) });
  // the old `AI: <status> …` text stays for `api`: Cramfox build 7 reads the status from it
  if (e instanceof Anthropic.APIError) return new GenerationError(scrub(`AI: ${e.status} ${e.message}`), "api", { detail: describeAiError(e), material: kind === "material" });
  return e;
}

/**
 * A generation after its pre-charge steps: options parsed, materials uploaded to the Files API (when needed) and,
 * optionally, its prompt size counted. Created by {@link prepareGeneration}; run with {@link runPreparedGeneration};
 * always released with {@link releasePreparedGeneration} (deletes the uploads).
 */
export interface PreparedGeneration {
  readonly input: GenerateInput;
  readonly options: GenerationOptions;
  readonly mode: "materials" | "prompt";
  /** no API key: the demo topic is used (nothing uploaded, nothing counted) */
  readonly demo: boolean;
  /** aligned with `input.materials`: Files API id, or undefined when the material goes inline */
  fileIds: (string | undefined)[];
  /** every Files API upload (deleted by releasePreparedGeneration) */
  readonly uploaded: string[];
  /** input tokens of system + materials + base prompt (count_tokens), null when not counted or the count failed */
  inputTokens: number | null;
}

function parseInput(input: GenerateInput): { options: GenerationOptions; mode: "materials" | "prompt" } {
  const options = GenerationOptionsSchema.parse(input.options);
  const mode = options.mode ?? (input.materials.length || input.text?.trim() ? "materials" : "prompt");
  if (mode === "materials" && !input.materials.length && !input.text?.trim()) throw new GenerationError("Dodaj przynajmniej jeden plik albo tekst.", "no_input");
  if (mode === "prompt" && !options.hint?.trim()) throw new GenerationError("Wpisz temat, np. „fotosynteza, klasa 7”.", "no_input");
  return { options, mode };
}

/** System prompt text, material blocks (without cache markers) and the shared user prompt of every generation call. */
function requestParts(prep: PreparedGeneration) {
  const { input, options, mode } = prep;
  const { blocks, summary } = mode === "materials" ? materialsToBlocks(input.materials, input.text, prep.fileIds) : { blocks: [] as Anthropic.Beta.BetaContentBlockParam[], summary: "brak" };
  const systemText = mode === "materials" ? GENERATION_SYSTEM_PROMPT : TOPIC_SYSTEM_PROMPT;
  const deckOpts = mode === "materials" && input.decks ? { decks: true } : {};
  return { blocks, summary, systemText, deckOpts, basePrompt: buildGenerationUserPrompt({ ...options, mode }, summary, deckOpts) };
}

/**
 * Pre-charge part of a generation (the API route runs it before reserving the user's quota):
 *  - validates the input (`no_input`);
 *  - uploads PDFs (and large image sets) to the Files API — free, and needed to count their tokens;
 *  - with `countTokens`, counts the prompt with `count_tokens` (free). An API answer that the prompt is too long
 *    becomes `too_long`; a 401 becomes `ai_unavailable`; any other counting problem only logs a warning (the token
 *    gate is a cost guard, not a reason to refuse a lesson). Pasted text alone is not counted (the route caps it at
 *    200k characters).
 * Throws GenerationError (`no_input`, `ai_unavailable` for an upload or count failing on our side — key, permissions,
 * 429, 5xx, network —, `api` for any other failed upload, `too_long`, `ai_timeout`); its own uploads are deleted
 * before it throws.
 */
export async function prepareGeneration(input: GenerateInput, ctx: { deadline: Deadline; countTokens?: boolean }): Promise<PreparedGeneration> {
  const { options, mode } = parseInput(input);
  const prep: PreparedGeneration = { input, options, mode, demo: !aiConfigured(), fileIds: [], uploaded: [], inputTokens: null };
  if (prep.demo) return prep;
  const client = getClient();
  try {
    if (mode === "materials" && input.materials.length) {
      try {
        prep.fileIds = await uploadMaterials(client, input.materials, prep.uploaded, ctx.deadline.requestOptions());
      } catch (e) {
        if (ctx.deadline.expired()) throw new GenerationError(AI_TIMEOUT_MESSAGE, "ai_timeout");
        // uploadMaterials wraps the SDK error in a MaterialUploadError: classify and log the original (status, type, request id)
        const cause = (e as Error)?.cause ?? e;
        // the AI unavailable on our side (incident 2026-10-16: an invalid key fails the PDF upload first) — before the charge,
        // the route answers 503 ai_unavailable with charged: false
        if (classifyAiError(cause) === "unavailable") throw new GenerationError(AI_UNAVAILABLE_MESSAGE, "ai_unavailable", { detail: describeAiError(cause) });
        // anything else, also before the charge: the route answers reserve_failed / ai_upload (nothing charged)
        throw new GenerationError(scrub((e as Error).message || "") || "Nie udało się przesłać materiałów do AI. Spróbuj ponownie za chwilę.", "api", { detail: describeAiError(cause) });
      }
      if (ctx.countTokens) prep.inputTokens = await countPromptTokens(client, prep, ctx.deadline);
    }
    return prep;
  } catch (e) {
    await deleteUploadedFiles(client, prep.uploaded);
    throw e;
  }
}

async function countPromptTokens(client: Anthropic, prep: PreparedGeneration, deadline: Deadline): Promise<number | null> {
  const { blocks, systemText, basePrompt } = requestParts(prep);
  try {
    const r = await client.beta.messages.countTokens(
      { model: modelId(), system: [{ type: "text", text: systemText }], messages: [{ role: "user", content: [...blocks, { type: "text", text: basePrompt }] }] },
      deadline.requestOptions({ maxRetries: 1, timeoutMs: COUNT_TOKENS_TIMEOUT_MS }),
    );
    return typeof r?.input_tokens === "number" ? r.input_tokens : null;
  } catch (e) {
    if (deadline.expired()) throw new GenerationError(AI_TIMEOUT_MESSAGE, "ai_timeout");
    const kind = classifyAiError(e);
    if (kind === "too_long") throw new GenerationError(TOO_LONG_AI_MESSAGE, "too_long");
    // An invalid / revoked API key fails every call of the generation: stop BEFORE the charge (incident 2026-10-16).
    // Other failures of this free call (429, 529, 5xx, network) only skip the token check, as before.
    if (e instanceof Anthropic.AuthenticationError) throw new GenerationError(AI_UNAVAILABLE_MESSAGE, "ai_unavailable", { detail: describeAiError(e) });
    console.warn(`[generate] count_tokens failed, generation continues without the token check: ${describeAiError(e)}`);
    return null;
  }
}

/** Deletes the Files API uploads of a prepared generation. Never throws. */
export async function releasePreparedGeneration(prep: PreparedGeneration | null | undefined): Promise<void> {
  if (!prep || !prep.uploaded.length) return;
  await deleteUploadedFiles(getClient(), prep.uploaded);
}

/**
 * Turn uploaded materials (mode "materials") or a typed topic (mode "prompt") into a full topic.
 *
 * Phases, so wall-clock stays ~2 min regardless of level count:
 *  1. outline (metadata + per-level scope) — small, fast;
 *  2. every level generated in parallel from the same materials + its scope (level 1 a moment earlier, so the
 *     others read its prompt-cache entries — see WARM_UP_CAP_MS);
 *  3. question review — one cheap call per level, in parallel (review.ts); best effort, never fails the generation.
 * Falls back to a demo topic when no API key is configured. Every AI request is aborted at `input.deadlineAt`.
 *
 * PDFs (and images, when they are large together) are uploaded once to the Files API and referenced by file_id
 * in every call, so big materials never travel base64 inside the 32 MB Messages request. The uploads are deleted
 * when generation ends, successfully or not.
 */
export async function generateTopic(input: GenerateInput): Promise<GenerateResult> {
  const deadline = new Deadline(input.deadlineAt ?? Date.now() + GENERATION_DEADLINE_MS);
  const meter = input.meter ?? new UsageMeter();
  let prep: PreparedGeneration | null = null;
  try {
    prep = await prepareGeneration(input, { deadline });
    return await runPreparedGeneration(prep, { deadline, meter });
  } finally {
    deadline.dispose();
    await releasePreparedGeneration(prep);
  }
}

/** Post-charge part: the AI calls. Does not delete the uploads (see releasePreparedGeneration). */
export async function runPreparedGeneration(prep: PreparedGeneration, ctx: { deadline: Deadline; meter: UsageMeter }): Promise<GenerateResult> {
  const { input, options } = prep;
  if (prep.demo) {
    const gen = demoGenerated(options.hint || input.text?.split("\n")[0] || "Demo", options.levels ?? 3);
    return {
      content: finalizeGenerated(gen, options.stage, { lang: options.lang }),
      category: gen.category,
      model: "demo",
      usage: { input: 0, output: 0 },
      demo: true,
      quality: { ...NO_REVIEW, vizDropped: { ...NO_REVIEW.vizDropped } },
      cost: ctx.meter.summary(),
    };
  }
  return generateWithAi(prep, getClient(), ctx.deadline, ctx.meter);
}

type Format = ReturnType<typeof betaZodOutputFormat<any>>;
/** A started AI request: `firstEvent` resolves when the answer starts streaming, `done` with the parsed result. */
interface Started<T> {
  firstEvent: Promise<void>;
  done: Promise<T>;
}

async function generateWithAi(prep: PreparedGeneration, client: Anthropic, deadline: Deadline, meter: UsageMeter): Promise<GenerateResult> {
  const { input, options, mode } = prep;
  const startedAt = Date.now();
  const { blocks, summary, systemText, deckOpts, basePrompt } = requestParts(prep);
  // Prompt cache (P1-2): the system prompt and the materials prefix are cached for the level calls only. The outline
  // call has another output format (so another cache entry) that nothing reads: no cache_control, no 1.25× write.
  const lastBlock = blocks[blocks.length - 1];
  const cachedBlocks: Anthropic.Beta.BetaContentBlockParam[] = lastBlock ? [...blocks.slice(0, -1), { ...lastBlock, cache_control: { type: "ephemeral" } } as Anthropic.Beta.BetaContentBlockParam] : [];
  const systemPlain: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemText }];
  const systemCached: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }];
  const model = modelId();
  let servedModel = model;

  function startOnce<T>(userText: string, format: Format | undefined, maxTokens: number, parse: (text: string) => T | null, cache: boolean, onFirstEvent: () => void): Promise<T> {
    let stream: ReturnType<typeof client.beta.messages.stream>;
    try {
      if (deadline.expired()) throw new GenerationError(AI_TIMEOUT_MESSAGE, "ai_timeout");
      stream = client.beta.messages.stream(
        {
          model,
          max_tokens: maxTokens,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: format ? { effort: "medium", format } : { effort: "medium" },
          system: cache ? systemCached : systemPlain,
          messages: [{ role: "user", content: [...(cache ? cachedBlocks : blocks), { type: "text", text: format ? userText : `${userText}\n\n${RAW_JSON_INSTRUCTION}` }] }],
        },
        deadline.requestOptions(),
      );
    } catch (e) {
      return Promise.reject(aiError(e, deadline));
    }
    const observer = observeStream(stream);
    void observer.firstEvent.then(onFirstEvent);
    return (async () => {
      let msg: Anthropic.Beta.BetaMessage & { parsed_output?: unknown };
      try {
        msg = await stream.finalMessage();
      } catch (e) {
        // an aborted / failed stream may still have been billed: cost what it reported
        const last = observer.lastUsage();
        if (last) meter.recordPartial("gen", last.usage, last.model || model);
        throw aiError(e, deadline);
      }
      meter.record("gen", msg.usage, msg.model || model);
      servedModel = msg.model || servedModel;
      if (msg.stop_reason === "refusal") throw new GenerationError("AI odmówiło przetworzenia tych materiałów.", "refusal");
      if (msg.stop_reason === "max_tokens") throw new GenerationError("Materiał za duży na jeden temat — podziel go na mniejsze części.", "invalid_output");
      const text = msg.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const parsed = (msg.parsed_output as T | null | undefined) ?? parse(text);
      if (!parsed) throw new GenerationError("AI zwróciło nieprawidłową strukturę. Spróbuj ponownie.", "invalid_output");
      return parsed;
    })();
  }

  /**
   * Structured-output call with a fallback: when the API rejects the compiled grammar as too large (HTTP 400),
   * the same request is repeated without `output_config.format` and the JSON is parsed from the text.
   */
  function start<T>(userText: string, format: Format, maxTokens: number, parse: (text: string) => T | null, cache: boolean): Started<T> {
    let fire!: () => void;
    const firstEvent = new Promise<void>((r) => (fire = r));
    const done = startOnce(userText, format, maxTokens, parse, cache, fire).catch((e) => {
      if (e instanceof GenerationError && e.code === "api" && /grammar/i.test(e.message)) return startOnce(userText, undefined, maxTokens, parse, cache, fire);
      throw e;
    });
    return { firstEvent, done };
  }

  // ---- phase 1: outline (not cached, see above)
  input.onProgress?.("outline");
  const outline = await start<Outline>(`${basePrompt}\n\n${OUTLINE_INSTRUCTIONS}`, betaZodOutputFormat(OutlineSchema), 8000, (t) => safeParse(OutlineSchema, t), false).done;
  // `levels` is the usual count; a long material may use up to maxLevelsFor() levels, so nothing important is cut
  const maxLevels = Math.max(1, maxLevelsFor({ ...options, mode }));
  if (outline.levels.length > maxLevels) console.warn(`[generate] outline had ${outline.levels.length} levels, cut to ${maxLevels} — the end of the material is not covered`);
  outline.levels = outline.levels.slice(0, maxLevels);
  if (!outline.levels.length) throw new GenerationError("AI nie znalazło w materiałach treści do nauki.", "invalid_output");
  // a language topic the client did not flag (Cramfox never sends `lang`): the level calls and the review use the
  // language rules; the stored `content.lang` stays as the client asked, so client behaviour does not change
  const lang = options.lang ?? LANG_CATEGORIES.has(outline.category);
  const levelPrompt = lang && !options.lang ? buildGenerationUserPrompt({ ...options, mode, lang }, summary, deckOpts) : basePrompt;

  // ---- phase 2: levels — two calls per level (core content + compact tasks), so each output grammar stays small.
  // Viz mode (`options.viz`, sent only by clients that render visuals): the core call also asks for `viz_type` + `viz`
  // (a JSON string, so the grammar grows by two flat fields only); without it the request is the pre-viz one.
  const viz = options.viz === true;
  const coreSchema = viz ? LevelCoreGenVizSchema : LevelCoreGenSchema;
  // raw-text parsing (grammar fallback) is lenient about the viz fields: a missing / unknown viz_type must not fail the level
  const coreParse = viz ? LevelCoreGenVizLooseSchema : LevelCoreGenSchema;
  input.onProgress?.("levels", `${outline.levels.length} poziomów`);
  const runLevel = (i: number) => {
    const core = start<LevelGen>(`${levelPrompt}\n\n${levelInstructions(outline, i, "core", viz ? { viz } : {})}`, betaZodOutputFormat(coreSchema), CORE_MAX_TOKENS, (t) => safeParse(coreParse, t), true);
    const tasks = start(`${levelPrompt}\n\n${levelInstructions(outline, i, "tasks")}`, betaZodOutputFormat(LevelTasksGenSchema), 12000, (t) => safeParse(LevelTasksGenSchema, t), true);
    // tasks are an enhancement: a failed tasks call must not lose the level (refusals still abort)
    const tasksSafe = tasks.done.catch((e) => {
      if (e instanceof GenerationError && e.code !== "refusal") return { tasks: [] };
      throw e;
    });
    let failure: unknown;
    const done = Promise.all([core.done, tasksSafe]).then(([c, t]): LevelGen => ({ ...c, tasks: t.tasks.map(expandGenTask).filter((x): x is GenTask => x !== null) }));
    // handled right away (no unhandled rejection while waiting); also records the failure for the early stop below
    const settledFlag = done.then(
      () => undefined,
      (e: unknown) => {
        failure = e ?? new Error("level failed");
      },
    );
    // "started" = both calls are streaming (their cache entries are readable) or the level already settled
    const started = Promise.race([Promise.all([core.firstEvent, tasks.firstEvent]).then(() => undefined), settledFlag]);
    return { done, started, failure: () => failure };
  };
  // Level 1 first; the others once its two calls stream, so they read the cache entries it wrote (P1-2).
  const warmFrom = Date.now();
  const first = runLevel(0);
  await settledOrTimeout(first.started, Math.min(WARM_UP_CAP_MS, deadline.left()));
  const warmupMs = Date.now() - warmFrom;
  // level 1 already failed for a reason that fails the whole generation: do not pay for the other levels
  const early = first.failure();
  const rest = early !== undefined && isFatalLevelError(early) ? [] : outline.levels.slice(1).map((_, k) => runLevel(k + 1).done);
  const settled = await Promise.allSettled([first.done, ...rest]);
  // One failed level (truncated or invalid output, API error, the deadline) no longer fails the whole generation —
  // the user is charged either way, so the other levels are kept. A refusal, a too-large material or every level
  // failing still fail.
  const fatal = settled.find((r): r is PromiseRejectedResult => r.status === "rejected" && isFatalLevelError(r.reason));
  if (fatal) throw fatal.reason;
  const okIdx = settled.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []));
  if (!okIdx.length) throw deadline.expired() ? new GenerationError(AI_TIMEOUT_MESSAGE, "ai_timeout") : (settled[0] as PromiseRejectedResult).reason;
  const levelsFailed = outline.levels.length - okIdx.length;
  if (levelsFailed) {
    // the original API error (status, type, request id — scrubbed) when there is one, not only the user-facing text
    const why = settled.flatMap((r, i) => (r.status === "rejected" ? [`poziom ${i + 1}: ${(r.reason as GenerationError)?.detail ?? (r.reason as Error)?.message}`] : []));
    console.warn(`[generate] ${levelsFailed}/${outline.levels.length} levels failed and were left out — ${why.join("; ")}`);
    outline.levels = okIdx.map((i) => outline.levels[i]!);
  }
  const levels = okIdx.map((i) => (settled[i] as PromiseFulfilledResult<LevelGen>).value);

  // ---- phase 3: question review — one cheap call per level, all in parallel (rubric + anti-guessing length rule).
  // Never fails the generation: a failed / timed-out review keeps the original level. It only gets the time left.
  input.onProgress?.("levels", "sprawdzam pytania");
  const reviewTimeoutMs = Math.min(REVIEW_TIMEOUT_MS, deadline.left());
  const reviewRetries = deadline.requestOptions().maxRetries;
  const reviews = await Promise.all(
    levels.map((lv, i) =>
      reviewLevel(client, lv, { stage: options.stage, lang, title: outline.levels[i]!.title, timeoutMs: reviewTimeoutMs, signal: deadline.signal, maxRetries: reviewRetries, meter, ...(viz ? { viz } : {}) }).catch((e: unknown) => ({
        level: lv,
        reviewed: false,
        error: (e as Error)?.message || "review failed",
        stats: { ...ZERO_REVIEW_STATS },
        usage: { input: 0, output: 0 },
      })),
    ),
  );
  const quality: GenerationQuality = { ...NO_REVIEW, vizDropped: { ...NO_REVIEW.vizDropped }, levelsFailed, warmupMs };
  const failures: string[] = [];
  reviews.forEach((r, i) => {
    levels[i] = r.level;
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
  quality.durationMs = Date.now() - startedAt;
  // one structured line per viz generation (prompt tuning reads these from the logs)
  if (viz) console.info(`[generate] viz ${JSON.stringify({ kept: vizKept, ...vizDropped, cleared: quality.vizCleared, doses: content.levels.reduce((n, l) => n + l.feed.length, 0) })}`);
  const cost = meter.summary();
  return { content, category: outline.category || "inne", model: servedModel, usage: { input: cost.input, output: cost.output }, demo: false, quality, cost };
}

/** A level error that fails the whole generation (anything but a truncated / invalid answer, an API error, the AI being unavailable or the deadline). */
function isFatalLevelError(e: unknown): boolean {
  return !(e instanceof GenerationError && (e.code === "invalid_output" || e.code === "api" || e.code === "ai_unavailable" || e.code === "ai_timeout"));
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

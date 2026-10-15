import { TopicContentSchema, type GenerationOptions, type GenerationScope, type Plan, type TopicContent } from "@nauka/shared";
import { costColumns, UsageMeter, type GenerationCostColumns, type UsageSummary } from "./cost.js";
import { Deadline, GENERATION_DEADLINE_MS, MIN_AI_TIME_MS, RESPOND_BY_MS, settledOrTimeout, valueOrTimeout } from "./deadline.js";
import { GENERATION_LEVELS, GenerationError, MAX_INPUT_TOKENS, prepareGeneration, releasePreparedGeneration, runPreparedGeneration, type PreparedGeneration } from "./generate.js";
import { intakeMaterials, TOO_LONG_MESSAGE, type IntakeFailure, type IntakeRow } from "./intake.js";

/**
 * `POST /api/generate` after authentication and body validation, without any database code (the route injects it),
 * so the whole charge / generate / save sequence is testable with mocks:
 *
 *   intake (MIME, read-only quota pre-check, download, PPTX, text budget)
 *   → prepare: Files API upload + count_tokens, `too_long` above MAX_INPUT_TOKENS          (nothing charged yet)
 *   → reserve: ONE transaction (RPC reserve_generation) — busy / daily / plan limit (free: lifetime per e-mail,
 *     pro: monthly) / global checks, then the `generations` row and the counters           (P0-1, D3)
 *     only within CHARGE_BY_MS (75 s) of the request start, checked before the upload AND right before the charge
 *   → AI, every request aborted at request start + 270 s                                   (P1-4)
 *   → finish: ONE transaction (RPC finish_generation) — topic row + `done` + cost columns  (P1-3, P1-4)
 *     (its reply lost after the commit → `lookup` finds the topic and the answer is still 200)
 *   or fail: `failed` + cost columns of whatever was spent.
 * Cleanup and `fail` are bounded by RESPOND_BY_MS, so the JSON answer leaves before Vercel's 300 s.
 */

/** `lifetime` = the free plan's generations for life are used up (D3); the others as before. */
export type ReserveRejection = "busy" | "daily" | "global" | "monthly" | "lifetime";
export type ReserveOutcome =
  | { ok: true; generationId: string; used?: number; limit?: number; plan?: Plan; scope?: GenerationScope }
  | { ok: false; reason: ReserveRejection; used?: number; limit?: number };

/** `used` values Cramfox reads as "daily limit of the account" / "daily limit of the server" (cloud-ui.js failGen). */
export const DAILY_CAP_SENTINEL = 999_999;
export const GLOBAL_CAP_SENTINEL = 1_999_999;

const failure = (status: number, code: string, message: string, extra?: Record<string, unknown>): IntakeFailure => ({ ok: false, status, code, message, extra });

/**
 * HTTP answer for a refused reservation. Same shapes as before the RPC (402 `limit_reached` + sentinels); `busy` is new.
 * Plan limits add `scope` (additive): `"month"` for the monthly limit, `"lifetime"` for the free plan's generations for
 * life — build 6 reads only `used` / `limit` (and shows its monthly text with the right numbers, "2 z 2").
 */
export function reserveRejection(r: { reason: ReserveRejection; used?: number; limit?: number }, monthlyLimit: number): IntakeFailure {
  switch (r.reason) {
    case "busy":
      return failure(409, "busy", "Trwa już tworzenie innej lekcji. Poczekaj, aż się skończy, i spróbuj ponownie.");
    case "daily":
      return failure(402, "limit_reached", "Dzienny limit nowych lekcji jest wykorzystany.", { used: DAILY_CAP_SENTINEL, limit: monthlyLimit });
    case "global":
      // rolling 24 h window (and 0 in app_config pauses generation) — "later", not "tomorrow"
      return failure(402, "limit_reached", "Serwer ma teraz bardzo dużo pracy. Spróbuj później.", { used: GLOBAL_CAP_SENTINEL, limit: monthlyLimit });
    case "lifetime": {
      const limit = r.limit ?? monthlyLimit;
      const used = r.used ?? limit;
      return failure(402, "limit_reached", `Wykorzystano ${Math.min(used, limit)}/${limit} darmowych lekcji`, { used, limit, scope: "lifetime" });
    }
    default: {
      const used = r.used ?? monthlyLimit;
      const limit = r.limit ?? monthlyLimit;
      return failure(402, "limit_reached", `Wykorzystano ${used}/${limit} generacji w tym miesiącu`, { used, limit, scope: "month" });
    }
  }
}

/** The client's `levels` is ignored (P1-29): every generation asks for GENERATION_LEVELS (materials mode may use up to +2). */
export function normalizeOptions(options: GenerationOptions): GenerationOptions {
  return { ...options, mode: options.mode ?? "materials", levels: GENERATION_LEVELS };
}

export interface FinishInput {
  name: string;
  emoji: string;
  source: "materials" | "prompt";
  content: TopicContent;
  model: string;
  cost: GenerationCostColumns;
  quality: Record<string, unknown>;
}

export interface FailInput {
  /** stored in `generations.error` (≤ 2000 chars) */
  error: string;
  code: string;
  cost: GenerationCostColumns;
  quality: Record<string, unknown>;
}

export interface GenerationRequest {
  /** `materials` rows (already checked to belong to the caller) */
  rows: IntakeRow[];
  /** pasted text (materials mode) */
  text?: string;
  options: GenerationOptions;
  /** Date.now() at the start of the HTTP request: the AI deadline is this + 270 s */
  startedAt: number;
  maxFileMb?: number;
  maxTotalMb?: number;
  monthlyLimit: number;
  /** cheap read-only quota check before downloading anything (only runs when there are files) */
  precheck?: () => Promise<IntakeFailure | null>;
  download: (row: IntakeRow) => Promise<Uint8Array>;
  /** the charge: RPC `reserve_generation` (inserts the `generations` row with these options) */
  reserve: (options: GenerationOptions) => Promise<ReserveOutcome>;
  /** RPC `finish_generation`: topic row + status `done` + cost, in one transaction */
  finish: (generationId: string, out: FinishInput) => Promise<{ topicId: string; topic: unknown }>;
  /** status `failed` + error + cost */
  fail: (generationId: string, info: FailInput) => Promise<void>;
  /**
   * After `finish` threw: the generation's topic when finish_generation did commit (its reply was lost), else null.
   * Without it a committed, paid lesson would be answered as a failure (build 6 then deletes its new subject).
   */
  lookup?: (generationId: string) => Promise<{ topicId: string; topic: unknown } | null>;
  /** overrides (tests) */
  deadlineMs?: number;
  minAiTimeMs?: number;
  respondByMs?: number;
  maxInputTokens?: number;
  now?: () => number;
  log?: Pick<Console, "info" | "warn" | "error">;
}

export interface GenerationResponse {
  status: number;
  body: Record<string, unknown>;
}

function costMeta(s: UsageSummary): Record<string, unknown> {
  return { calls: s.calls, partialCalls: s.partialCalls, ...(s.unpriced.length ? { unpriced: s.unpriced } : {}) };
}

export async function handleGenerationRequest(req: GenerationRequest): Promise<GenerationResponse> {
  const log = req.log ?? console;
  const now = req.now ?? Date.now;
  const options = normalizeOptions(req.options);
  const mode = options.mode ?? "materials";
  const text = mode === "materials" ? req.text : undefined;
  const deadline = new Deadline(req.startedAt + (req.deadlineMs ?? GENERATION_DEADLINE_MS), req.now);
  const meter = new UsageMeter();
  // set by `measure` (a closure, so kept in an object for the type checker)
  const st: { prep: PreparedGeneration | null } = { prep: null };
  const counted = () => ({ inputTokensCounted: st.prep?.inputTokens ?? null });
  /** ms left before the answer must leave (cleanup and `fail` get at most this) */
  const respondIn = () => Math.max(0, req.startedAt + (req.respondByMs ?? RESPOND_BY_MS) - now());
  // Downloads, PPTX parsing, the Files API upload or the token count ate the time: stop before charging rather than
  // time out after it — and never charge later than CHARGE_BY_MS after the start (Cramfox's 90 s `not_started` check).
  const tooLate = () => deadline.left() < (req.minAiTimeMs ?? MIN_AI_TIME_MS);
  const slowIntake = () =>
    failure(500, "download_failed", "Przygotowanie materiałów trwało za długo. Limit się nie zmienił — spróbuj ponownie za chwilę.", { reason: "slow_intake" });

  try {
    const intake = await intakeMaterials<{ generationId: string }>(req.rows, {
      maxFileMb: req.maxFileMb,
      maxTotalMb: req.maxTotalMb,
      pastedChars: text?.trim().length ?? 0,
      precheck: req.precheck,
      download: req.download,
      measure: async (materials, stats) => {
        if (tooLate()) return slowIntake();
        let prep: PreparedGeneration;
        try {
          prep = st.prep = await prepareGeneration({ materials, text, options, decks: stats.decks }, { deadline, countTokens: true });
        } catch (e) {
          if (e instanceof GenerationError && e.code === "too_long") return failure(400, "too_long", TOO_LONG_MESSAGE);
          if (e instanceof GenerationError && e.code === "no_input") return failure(400, "no_input", e.message);
          if (e instanceof GenerationError && e.code === "ai_timeout") return slowIntake();
          log.error("[generate] materials could not be handed to the AI (nothing charged):", (e as Error)?.message ?? e);
          return failure(500, "reserve_failed", "Nie udało się przekazać materiałów do AI. Limit się nie zmienił — spróbuj ponownie za chwilę.", { reason: "ai_upload" });
        }
        const max = req.maxInputTokens ?? MAX_INPUT_TOKENS;
        if (prep.inputTokens !== null && prep.inputTokens > max) {
          log.info(`[generate] too_long before charge: ${prep.inputTokens} input tokens > ${max}`);
          return failure(400, "too_long", TOO_LONG_MESSAGE, { tokens: prep.inputTokens, maxTokens: max });
        }
        return null;
      },
      reserve: async () => {
        // second check: the Files API upload (one retry, timeout = time left) and count_tokens (20 s × 2) run after the first
        if (tooLate()) {
          log.warn(`[generate] slow intake: ${Math.round((now() - req.startedAt) / 1000)} s before the charge — not charged`);
          return slowIntake();
        }
        let r: ReserveOutcome;
        try {
          r = await req.reserve(options);
        } catch (e) {
          log.error("[generate] reserve failed:", (e as Error)?.message ?? e);
          return failure(500, "reserve_failed", "Serwer chwilowo nie działa. Limit się nie zmienił — spróbuj za kilka minut.");
        }
        return r.ok ? { ok: true as const, value: { generationId: r.generationId } } : reserveRejection(r, req.monthlyLimit);
      },
    });
    if (!intake.ok) return { status: intake.status, body: { error: intake.message, code: intake.code, ...intake.extra } };
    if (intake.stats.decks) log.info("[generate] pptx", intake.stats);
    const generationId = intake.reserved.generationId;

    let phase: "ai" | "save" = "ai";
    let demo = false;
    try {
      if (!st.prep) throw new Error("internal: generation not prepared");
      const out = await runPreparedGeneration(st.prep, { deadline, meter });
      demo = out.demo;
      const content = TopicContentSchema.parse(out.content);
      if (out.demo && !content.tagline.includes("DEMO")) content.tagline = `DEMO · ${content.tagline}`.slice(0, 300);
      phase = "save";
      const saved = await req.finish(generationId, {
        name: content.name,
        emoji: content.emoji,
        source: mode,
        content,
        model: out.model,
        cost: costColumns(out.cost),
        quality: { ...out.quality, ...counted(), ...costMeta(out.cost) },
      });
      return { status: 200, body: { generationId, topicId: saved.topicId, topic: saved.topic, demo: out.demo } };
    } catch (e) {
      const raw = (e as Error)?.message || "Generowanie nie powiodło się";
      // finish_generation may have committed and only its reply got lost: then the lesson exists and is paid — answer 200
      if (phase === "save" && req.lookup) {
        try {
          const found = await valueOrTimeout(req.lookup(generationId), respondIn());
          if (found) {
            log.warn("[generate] finish answered with an error, but the generation is done — answering 200", generationId, raw);
            return { status: 200, body: { generationId, topicId: found.topicId, topic: found.topic, demo } };
          }
        } catch (err) {
          log.error("[generate] could not check the generation after a failed finish", generationId, (err as Error)?.message ?? err);
        }
      }
      const code = e instanceof GenerationError ? e.code : "generation_failed";
      // database errors stay in the logs and in generations.error, not in the client's message
      const message = e instanceof GenerationError ? raw : phase === "save" ? "Nie udało się zapisać lekcji." : "Generowanie nie powiodło się.";
      log.error("[generate] failed", generationId, code, raw);
      const summary = meter.summary();
      // bounded: a hung database call must not push the answer past Vercel's 300 s (the sweeper closes the row later)
      await settledOrTimeout(
        Promise.resolve()
          .then(() => req.fail(generationId, { error: raw.slice(0, 2000), code, cost: costColumns(summary), quality: { failedPhase: phase, ...counted(), ...costMeta(summary) } }))
          .catch((err) => {
          log.error("[generate] could not mark the generation failed", generationId, (err as Error)?.message ?? err);
        }),
        respondIn(),
      );
      // usage was already incremented — intentionally not refunded (refunds wait for decision D4, AUDYT P1-33)
      // The deadline answers with the existing code `lost` (Cramfox build 6 shows "Generowanie się nie dokończyło…
      // ta próba liczy się do limitu"), plus `reason` for newer clients.
      if (code === "ai_timeout") return { status: 500, body: { error: message, code: "lost", reason: "ai_timeout", generationId } };
      return { status: code === "no_input" || code === "too_long" ? 400 : 500, body: { error: message, code, generationId } };
    }
  } finally {
    deadline.dispose();
    // Files API cleanup never delays the answer past RESPOND_BY_MS (each delete: 10 s timeout + 1 retry); uploads expire anyway
    await settledOrTimeout(releasePreparedGeneration(st.prep), respondIn());
  }
}

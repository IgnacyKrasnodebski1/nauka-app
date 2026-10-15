/**
 * Token usage and cost of one generation (AUDYT P1-3).
 *
 * Every AI call of a generation reports its `usage` to a {@link UsageMeter}. The meter keeps the generation model's
 * (outline + levels) tokens split by price class — plain input, cache write, cache read, output — and the review
 * model's tokens apart, and prices every part with the model that actually served it (server-side fallbacks can
 * answer with another model; `usage.iterations` then lists each hop with its own model and tokens).
 *
 * The meter also records calls that failed or were aborted (deadline), from the last usage snapshot of the stream,
 * so a failed generation is costed too.
 */

/** USD per million tokens. Cache write = 5-minute TTL (1.25× input), the only TTL the generation uses. */
export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * First-party API prices (claude-api reference, 2026-09-25). Unknown models fall back to the price of the role's
 * default model and are listed in `unpriced`, so a wrong number is visible in `generations.quality`.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25 },
  "claude-mythos-5-1": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

/** Price of a model id; tolerates provider prefixes and date suffixes (`anthropic.claude-opus-5`, `claude-haiku-4-5-20251001`). */
export function priceFor(model: string | null | undefined): ModelPrice | null {
  if (!model) return null;
  const id = model.replace(/^anthropic\./, "").replace(/@.*$/, "");
  if (MODEL_PRICES[id]) return MODEL_PRICES[id]!;
  // longest known id that prefixes the given one (date-suffixed snapshot ids)
  const hit = Object.keys(MODEL_PRICES)
    .filter((k) => id.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? MODEL_PRICES[hit]! : null;
}

/** "gen" = outline and level calls (the generation model, columns `opus_*`), "review" = question review calls. */
export type AiRole = "gen" | "review";

/** Tokens of one model hop. */
export interface CallTokens {
  model: string;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/** The slice of a Messages API `usage` object the meter reads (top-level fields + optional `iterations`). */
export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  iterations?: ReadonlyArray<{
    type?: string;
    model?: string;
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  }> | null;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Splits a `usage` object into model hops. With `iterations` (server-side fallback, tool loops) every `message` /
 * `fallback_message` entry is one hop with its own model; otherwise the top-level fields belong to `servedModel`.
 */
export function tokensFromUsage(usage: UsageLike | null | undefined, servedModel: string): CallTokens[] {
  if (!usage) return [];
  const hops = (usage.iterations ?? []).filter((it) => it && (it.type === "message" || it.type === "fallback_message"));
  if (hops.length)
    return hops.map((it) => ({
      model: it.model || servedModel,
      input: n(it.input_tokens),
      cacheWrite: n(it.cache_creation_input_tokens),
      cacheRead: n(it.cache_read_input_tokens),
      output: n(it.output_tokens),
    }));
  return [{ model: servedModel, input: n(usage.input_tokens), cacheWrite: n(usage.cache_creation_input_tokens), cacheRead: n(usage.cache_read_input_tokens), output: n(usage.output_tokens) }];
}

/** USD cost of one hop (null when the model has no known price). */
export function costOf(t: CallTokens, price: ModelPrice | null = priceFor(t.model)): number | null {
  if (!price) return null;
  return (t.input * price.input + t.cacheWrite * price.cacheWrite + t.cacheRead * price.cacheRead + t.output * price.output) / 1_000_000;
}

export interface UsageSummary {
  /** generation model: uncached input, cache writes, cache reads, output */
  genInput: number;
  genCacheWrite: number;
  genCacheRead: number;
  genOutput: number;
  /** review model: all input (it is not cached) and output */
  reviewInput: number;
  reviewOutput: number;
  /** USD, rounded to 4 decimals (the column is numeric(8,4)) */
  costUsd: number;
  /** AI calls recorded (failed and aborted ones included) */
  calls: number;
  /** calls that were aborted or failed after the stream started (usage taken from the last stream snapshot) */
  partialCalls: number;
  /** models without a known price (costed with the role's fallback price) */
  unpriced: string[];
  /** legacy totals for `generations.input_tokens` / `output_tokens`: every input token (cached or not) and every output token */
  input: number;
  output: number;
}

const FALLBACK_MODEL: Record<AiRole, string> = { gen: "claude-opus-5", review: "claude-sonnet-5" };

export class UsageMeter {
  private readonly hops: { role: AiRole; t: CallTokens }[] = [];
  private calls = 0;
  private partial = 0;

  /** Record the usage of one finished call. */
  record(role: AiRole, usage: UsageLike | null | undefined, servedModel: string): void {
    this.calls++;
    for (const t of tokensFromUsage(usage, servedModel)) this.hops.push({ role, t });
  }

  /** Record what is known about a call that failed or was aborted mid-stream (may be nothing). */
  recordPartial(role: AiRole, usage: UsageLike | null | undefined, servedModel: string): void {
    if (!usage) return;
    this.partial++;
    this.record(role, usage, servedModel);
  }

  summary(): UsageSummary {
    const s: UsageSummary = { genInput: 0, genCacheWrite: 0, genCacheRead: 0, genOutput: 0, reviewInput: 0, reviewOutput: 0, costUsd: 0, calls: this.calls, partialCalls: this.partial, unpriced: [], input: 0, output: 0 };
    let cost = 0;
    for (const { role, t } of this.hops) {
      if (role === "gen") {
        s.genInput += t.input;
        s.genCacheWrite += t.cacheWrite;
        s.genCacheRead += t.cacheRead;
        s.genOutput += t.output;
      } else {
        s.reviewInput += t.input + t.cacheWrite + t.cacheRead;
        s.reviewOutput += t.output;
      }
      s.input += t.input + t.cacheWrite + t.cacheRead;
      s.output += t.output;
      let price = priceFor(t.model);
      if (!price) {
        if (!s.unpriced.includes(t.model)) s.unpriced.push(t.model);
        price = priceFor(FALLBACK_MODEL[role]);
      }
      cost += costOf(t, price) ?? 0;
    }
    s.costUsd = Math.round(cost * 10_000) / 10_000;
    return s;
  }
}

/** `generations` columns written by the route for a finished or failed generation (migration 0007). */
export interface GenerationCostColumns {
  input_tokens: number;
  output_tokens: number;
  opus_input: number;
  opus_cache_write: number;
  opus_cache_read: number;
  opus_output: number;
  review_input: number;
  review_output: number;
  cost_usd: number;
}

export function costColumns(s: UsageSummary): GenerationCostColumns {
  return {
    input_tokens: s.input,
    output_tokens: s.output,
    opus_input: s.genInput,
    opus_cache_write: s.genCacheWrite,
    opus_cache_read: s.genCacheRead,
    opus_output: s.genOutput,
    review_input: s.reviewInput,
    review_output: s.reviewOutput,
    // numeric(8,4): keep a runaway number from failing the whole update
    cost_usd: Math.min(s.costUsd, 9999.9999),
  };
}
